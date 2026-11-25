-- ParaRmi-Dist V8 : référence de commande persistée.
-- Migration additive et non destructive : aucune commande existante n'est supprimée.
alter table public.orders
  add column if not exists order_number text;

-- Références historiques : conserver l'identifiant existant sous une forme lisible.
update public.orders
set order_number = 'PRD-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where order_number is null or btrim(order_number) = '';

create unique index if not exists orders_order_number_unique
  on public.orders (order_number);

comment on column public.orders.order_number is
  'Référence commerciale unique communiquée au client ; générée côté serveur.';
