-- ParaRmi-Dist V7 : migration additive, ne supprime aucune donnée existante.
alter table public.orders add column if not exists terms_accepted boolean not null default false;
alter table public.orders add column if not exists terms_accepted_at timestamptz;

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  search_term text not null check (char_length(search_term) between 2 and 160),
  result_count integer not null default 0 check (result_count >= 0),
  searched_at timestamptz not null default now()
);
alter table public.search_history enable row level security;
drop policy if exists "Public can log searches" on public.search_history;
create policy "Public can log searches" on public.search_history for insert to anon, authenticated with check (char_length(search_term) between 2 and 160 and result_count >= 0);
drop policy if exists "Admins can read search history" on public.search_history;
create policy "Admins can read search history" on public.search_history for select to authenticated using (public.is_admin());

-- Droits SQL explicites : l'écriture publique reste limitée par la politique RLS ci-dessus.
grant insert on table public.search_history to anon, authenticated;
grant select on table public.search_history to authenticated;
