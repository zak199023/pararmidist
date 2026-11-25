-- ParaRmi-Dist V5 : comptes clients et historique personnel des commandes
-- A executer dans Supabase SQL Editor apres sauvegarde de la base.
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Le role customer est attribue automatiquement aux nouveaux comptes.
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_pararmidist on auth.users;
create trigger on_auth_user_created_pararmidist
after insert on auth.users
for each row execute procedure public.handle_new_customer();

alter table public.profiles enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
on public.orders for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
on public.orders for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
on public.orders for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Les clients ne peuvent ni modifier leur role ni lire les profils des autres.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- IMPORTANT : les commandes creees par Edge Function utilisent la cle service role.
-- Ne jamais exposer cette cle dans app.js ou dans le navigateur.
