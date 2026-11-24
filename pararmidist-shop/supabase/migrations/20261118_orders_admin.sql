-- Migration ParaRmi-Dist : commandes visibles uniquement par les administrateurs
alter table public.orders alter column shipping_fee set default 0;
drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders" on public.orders
for select using (public.is_admin());
drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders
for update using (public.is_admin()) with check (public.is_admin());
