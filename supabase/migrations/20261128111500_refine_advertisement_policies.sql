drop policy if exists "Admins manage advertisements" on public.advertisements;
drop policy if exists "Public can read active advertisements" on public.advertisements;
create policy "Read active advertisements or admin" on public.advertisements for select to anon, authenticated using ((is_active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())) or public.is_admin());
create policy "Admins insert advertisements" on public.advertisements for insert to authenticated with check (public.is_admin());
create policy "Admins update advertisements" on public.advertisements for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete advertisements" on public.advertisements for delete to authenticated using (public.is_admin());