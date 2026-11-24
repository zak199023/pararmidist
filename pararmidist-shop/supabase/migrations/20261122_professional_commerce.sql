-- ParaRmi-Dist : remise commerciale et données du tableau de bord professionnel.
-- Migration additive : aucune table ni commande existante n'est supprimée.

alter table public.orders
  add column if not exists subtotal_before_discount numeric(12,2),
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists discount_rate numeric(5,2) not null default 0;

-- Les anciennes commandes restent inchangées ; on initialise seulement les nouveaux champs.
update public.orders
set subtotal_before_discount = coalesce(subtotal, total, 0)
where subtotal_before_discount is null;

create table if not exists public.promotion_settings (
  id smallint primary key default 1 check (id = 1),
  active boolean not null default true,
  discount_rate numeric(5,2) not null default 5 check (discount_rate >= 0 and discount_rate <= 90),
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint promotion_dates_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);

insert into public.promotion_settings (id, active, discount_rate, starts_at, ends_at)
values (
  1,
  true,
  5,
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month' - interval '1 second'
)
on conflict (id) do nothing;

alter table public.promotion_settings enable row level security;

drop policy if exists "Public can read promotion settings" on public.promotion_settings;
create policy "Public can read promotion settings"
on public.promotion_settings for select
using (true);

drop policy if exists "Admins can insert promotion settings" on public.promotion_settings;
create policy "Admins can insert promotion settings"
on public.promotion_settings for insert
with check (public.is_admin());

drop policy if exists "Admins can update promotion settings" on public.promotion_settings;
create policy "Admins can update promotion settings"
on public.promotion_settings for update
using (public.is_admin()) with check (public.is_admin());

comment on table public.promotion_settings is
  'Paramètres de la campagne mensuelle. Les produits déjà en prix promotionnel ne reçoivent pas la remise générale.';
comment on column public.orders.discount_amount is
  'Montant de la remise générale calculée côté serveur, hors promotions déjà appliquées au produit.';

-- Droits SQL de base, toujours filtrés par les politiques RLS ci-dessus.
grant select on public.promotion_settings to anon, authenticated;
grant insert, update on public.promotion_settings to authenticated;

-- CRM clients : table dédiée alimentée à partir des commandes historiques et futures.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone_normalized text not null unique,
  phone text not null,
  full_name text,
  email text,
  city text,
  first_order_at timestamptz,
  last_order_at timestamptz,
  order_count integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

-- Import historique non destructif : un client est regroupé par téléphone normalisé.
with grouped as (
  select
    case when regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = ''
      then 'order:' || id::text
      else regexp_replace(phone, '[^0-9]', '', 'g') end as phone_normalized,
    (array_agg(phone order by created_at desc))[1] as phone,
    (array_agg(customer_name order by created_at desc))[1] as full_name,
    (array_agg(email order by created_at desc) filter (where email is not null))[1] as email,
    (array_agg(city order by created_at desc))[1] as city,
    min(created_at) as first_order_at,
    max(created_at) as last_order_at,
    count(*)::integer as order_count,
    coalesce(sum(total) filter (where status = 'delivered' or coalesce(to_jsonb(orders)->>'payment_status','') = 'paid'),0) as total_spent
  from public.orders
  group by case when regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = ''
    then 'order:' || id::text
    else regexp_replace(phone, '[^0-9]', '', 'g') end
)
insert into public.customers (phone_normalized,phone,full_name,email,city,first_order_at,last_order_at,order_count,total_spent)
select phone_normalized,phone,full_name,email,city,first_order_at,last_order_at,order_count,total_spent from grouped
on conflict (phone_normalized) do update set
  phone = excluded.phone,
  full_name = coalesce(excluded.full_name, public.customers.full_name),
  email = coalesce(excluded.email, public.customers.email),
  city = coalesce(excluded.city, public.customers.city),
  first_order_at = least(public.customers.first_order_at, excluded.first_order_at),
  last_order_at = greatest(public.customers.last_order_at, excluded.last_order_at),
  order_count = excluded.order_count,
  total_spent = excluded.total_spent,
  updated_at = now();

update public.orders o
set customer_id = c.id
from public.customers c
where c.phone_normalized = case
  when regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g') = '' then 'order:' || o.id::text
  else regexp_replace(o.phone, '[^0-9]', '', 'g') end
  and o.customer_id is distinct from c.id;

create or replace function public.sync_customer_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_phone text;
  customer_uuid uuid;
begin
  normalized_phone := regexp_replace(coalesce(new.phone,''), '[^0-9]', '', 'g');
  if normalized_phone = '' then normalized_phone := 'order:' || new.id::text; end if;

  insert into public.customers (phone_normalized,phone,full_name,email,city,first_order_at,last_order_at)
  values (normalized_phone,new.phone,new.customer_name,new.email,new.city,new.created_at,new.created_at)
  on conflict (phone_normalized) do update set
    phone = excluded.phone,
    full_name = coalesce(excluded.full_name, public.customers.full_name),
    email = coalesce(excluded.email, public.customers.email),
    city = coalesce(excluded.city, public.customers.city),
    first_order_at = least(public.customers.first_order_at, excluded.first_order_at),
    last_order_at = greatest(public.customers.last_order_at, excluded.last_order_at),
    updated_at = now()
  returning id into customer_uuid;

  update public.orders set customer_id = customer_uuid where id = new.id and customer_id is distinct from customer_uuid;

  update public.customers c set
    order_count = (select count(*) from public.orders o where o.customer_id = c.id),
    total_spent = coalesce((select sum(o.total) from public.orders o where o.customer_id = c.id and (o.status = 'delivered' or coalesce(to_jsonb(o)->>'payment_status','') = 'paid')),0),
    first_order_at = (select min(o.created_at) from public.orders o where o.customer_id = c.id),
    last_order_at = (select max(o.created_at) from public.orders o where o.customer_id = c.id),
    updated_at = now()
  where c.id = customer_uuid;

  return new;
end;
$$;

drop trigger if exists orders_sync_customer on public.orders;
create trigger orders_sync_customer
after insert or update of customer_name, phone, email, city, total, status, created_at
on public.orders
for each row execute function public.sync_customer_from_order();

alter table public.customers enable row level security;
drop policy if exists "Admins can read customers" on public.customers;
create policy "Admins can read customers" on public.customers
for select to authenticated using (public.is_admin());
drop policy if exists "Admins can update customers" on public.customers;
create policy "Admins can update customers" on public.customers
for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update on public.customers to authenticated;
