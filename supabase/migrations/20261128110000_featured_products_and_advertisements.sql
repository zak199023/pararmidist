alter table public.products add column if not exists is_featured boolean not null default false, add column if not exists featured_sort integer not null default 0;
create table if not exists public.advertisements (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 2 and 120),
 body text,
 image_url text,
 link_url text,
 button_label text,
 is_active boolean not null default false,
 starts_at timestamptz,
 ends_at timestamptz,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint advertisements_schedule_check check (ends_at is null or (starts_at is not null and ends_at > starts_at)),
 constraint advertisements_image_url_check check (image_url is null or image_url ~* '^https?://'),
 constraint advertisements_link_url_check check (link_url is null or link_url ~* '^https?://')
);
alter table public.advertisements enable row level security;
grant select on public.advertisements to anon, authenticated;
grant insert, update, delete on public.advertisements to authenticated;
drop policy if exists "Public can read active advertisements" on public.advertisements;
create policy "Public can read active advertisements" on public.advertisements for select to anon, authenticated using (is_active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()));
drop policy if exists "Admins manage advertisements" on public.advertisements;
create policy "Admins manage advertisements" on public.advertisements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index if not exists advertisements_active_schedule_idx on public.advertisements (is_active,sort_order,starts_at,ends_at);
create index if not exists products_featured_sort_idx on public.products (is_featured,featured_sort) where published=true;