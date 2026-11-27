-- Rmi-Dist V9 : calcul des remises au moment de l'enregistrement de la commande.
-- Migration additive : les commandes existantes et le catalogue ne sont pas supprimés.
-- discount_amount représente toutes les réductions (prix promotionnel produit + remise générale).
-- La remise générale ne se cumule jamais avec un prix déjà promotionnel.

alter table public.orders
  add column if not exists subtotal_before_discount numeric(12,2),
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists discount_rate numeric(5,2) not null default 0;

update public.orders
set subtotal_before_discount = coalesce(subtotal, total, 0)
where subtotal_before_discount is null;

comment on column public.orders.subtotal_before_discount is
  'Sous-total calculé sur les prix catalogue avant toute réduction.';
comment on column public.orders.discount_amount is
  'Montant total des réductions appliquées, y compris les prix promotionnels produit et la remise générale.';
comment on column public.orders.discount_rate is
  'Taux de remise générale actif au moment de la commande.';

create or replace function public.create_order_secure(
  p_customer jsonb,
  p_items jsonb,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text;
  v_phone text;
  v_email text;
  v_city text;
  v_address text;
  v_notes text;

  v_shipping_fee numeric := 50;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_subtotal_before_discount numeric := 0;
  v_discount_amount numeric := 0;
  v_discount_rate numeric := 0;
  v_promo_enabled boolean := false;
  v_promo_active boolean := false;
  v_promo_starts_at timestamptz;
  v_promo_ends_at timestamptz;

  v_item jsonb;
  v_product record;
  v_order_items jsonb := '[]'::jsonb;

  v_product_id uuid;
  v_quantity integer;
  v_original_unit_price numeric;
  v_unit_price numeric;
  v_product_has_promo boolean;

  v_order_number text;
  v_saved_order public.orders%rowtype;
begin
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Informations client invalides';
  end if;

  v_name := btrim(coalesce(p_customer->>'customer_name', ''));
  v_phone := btrim(coalesce(p_customer->>'phone', ''));
  v_email := nullif(btrim(coalesce(p_customer->>'email', '')), '');
  v_city := btrim(coalesce(p_customer->>'city', ''));
  v_address := btrim(coalesce(p_customer->>'address', ''));
  v_notes := nullif(btrim(coalesce(p_customer->>'notes', '')), '');

  if v_name = '' or v_phone = '' or v_city = '' or v_address = '' then
    raise exception 'Nom, téléphone, ville et adresse obligatoires';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 40 then
    raise exception 'Panier invalide';
  end if;

  -- Lire la campagne active côté serveur : le navigateur ne décide jamais du prix final.
  select coalesce(active, false),
         coalesce(discount_rate, 0),
         starts_at,
         ends_at
    into v_promo_enabled, v_discount_rate, v_promo_starts_at, v_promo_ends_at
  from public.promotion_settings
  where id = 1;

  if not found then
    v_promo_enabled := false;
    v_discount_rate := 0;
    v_promo_starts_at := null;
    v_promo_ends_at := null;
  end if;

  v_promo_active :=
    coalesce(v_promo_enabled, false)
    and coalesce(v_discount_rate, 0) > 0
    and (v_promo_starts_at is null or now() >= v_promo_starts_at)
    and (v_promo_ends_at is null or now() <= v_promo_ends_at);

  if not v_promo_active then
    v_discount_rate := 0;
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'product_id', '') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(v_item->>'quantity', '') !~ '^[0-9]+$'
       or (v_item->>'quantity')::integer not between 1 and 50 then
      raise exception 'Article ou quantité invalide';
    end if;
  end loop;

  -- Livraison gratuite à Casablanca ; les autres villes utilisent le tarif actif configuré.
  if lower(v_city) = 'casablanca' then
    v_shipping_fee := 0;
  else
    select sr.shipping_fee
      into v_shipping_fee
    from public.shipping_rates sr
    where translate(
      lower(btrim(sr.city)),
      'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
      'aaaaaaeeeeiiiiooooouuuuyycn'
    ) = translate(
      lower(v_city),
      'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
      'aaaaaaeeeeiiiiooooouuuuyycn'
    )
      and sr.is_active = true
    limit 1;

    if not found then
      v_shipping_fee := 50;
    end if;
  end if;

  -- Prix et remises recalculés depuis les données produits, sans stock.
  for v_product_id, v_quantity in
    select
      (value->>'product_id')::uuid,
      sum((value->>'quantity')::integer)::integer
    from jsonb_array_elements(p_items)
    group by (value->>'product_id')::uuid
    order by (value->>'product_id')::uuid
  loop
    select *
      into v_product
    from public.products
    where id = v_product_id;

    if not found then
      raise exception 'Produit introuvable';
    end if;

    if v_product.published is not true then
      raise exception 'Produit indisponible : %', v_product.name;
    end if;

    v_original_unit_price := coalesce(v_product.price, 0);

    if v_original_unit_price <= 0 then
      raise exception 'Prix produit invalide';
    end if;

    v_product_has_promo :=
      v_product.promo_price is not null
      and v_product.promo_price > 0
      and v_product.promo_price < v_original_unit_price;

    if v_product_has_promo then
      -- Un prix promotionnel produit exclut la remise générale.
      v_unit_price := v_product.promo_price;
    else
      v_unit_price := v_original_unit_price;
      if v_promo_active then
        v_unit_price := round(v_unit_price * (1 - v_discount_rate / 100), 2);
      end if;
    end if;

    v_subtotal_before_discount :=
      v_subtotal_before_discount + (v_original_unit_price * v_quantity);
    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
    v_discount_amount :=
      v_discount_amount + ((v_original_unit_price - v_unit_price) * v_quantity);

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'sku', v_product.sku,
        'quantity', v_quantity,
        'original_unit_price', v_original_unit_price,
        'unit_price', v_unit_price,
        'line_total', (v_unit_price * v_quantity)
      )
    );
  end loop;

  v_subtotal_before_discount := round(v_subtotal_before_discount, 2);
  v_subtotal := round(v_subtotal, 2);
  v_discount_amount := round(v_discount_amount, 2);
  v_total := round(v_subtotal + v_shipping_fee, 2);

  v_order_number :=
    'PRD-' ||
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
    '-' ||
    upper(substr(gen_random_uuid()::text, 1, 6));

  insert into public.orders (
    user_id,
    order_number,
    customer_name,
    phone,
    email,
    city,
    address,
    notes,
    items,
    subtotal,
    subtotal_before_discount,
    discount_amount,
    discount_rate,
    shipping_fee,
    total,
    payment_method,
    status
  )
  values (
    p_user_id,
    v_order_number,
    v_name,
    v_phone,
    v_email,
    v_city,
    v_address,
    v_notes,
    v_order_items,
    v_subtotal,
    v_subtotal_before_discount,
    v_discount_amount,
    v_discount_rate,
    v_shipping_fee,
    v_total,
    'cash_on_delivery',
    'pending'
  )
  returning * into v_saved_order;

  return to_jsonb(v_saved_order);
end;
$function$;

