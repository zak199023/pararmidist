-- Préparation CMI ParaRmi-Dist — aucune transaction bancaire activée par cette migration.
-- À exécuter dans Supabase SQL Editor après sauvegarde.
alter table public.orders
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('unpaid','pending','authorized','paid','failed','cancelled','refunded'));
  end if;
end $$;

comment on column public.orders.payment_status is
  'État du règlement. paid doit être défini uniquement après vérification serveur du retour/notification acquéreur.';
comment on column public.orders.payment_reference is
  'Référence non sensible fournie par la passerelle/acquéreur; ne jamais stocker de données de carte.';
