-- ParaRmi-Dist : schéma initial Supabase (PostgreSQL)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  brand text,
  category text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  promo_price numeric(12,2) check (promo_price is null or (promo_price >= 0 and promo_price < price)),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text,
  city text not null,
  address text not null,
  notes text,
  items jsonb not null,
  subtotal numeric(12,2) not null,
  shipping_fee numeric(12,2),
  total numeric(12,2) not null,
  payment_method text not null default 'cash_on_delivery',
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','shipped','delivered','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create policy "Public can read published products" on public.products for select using (published = true or public.is_admin());
create policy "Admins can insert products" on public.products for insert with check (public.is_admin());
create policy "Admins can update products" on public.products for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete products" on public.products for delete using (public.is_admin());

create policy "Users can read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "Admins can manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- Aucune création de compte public ni écriture de commande publique n'est ouverte par défaut.
-- Pour activer un formulaire de commande en ligne, ajouter une Edge Function validant les données,
-- les quantités, les stocks, les frais de livraison et les protections anti-spam avant insertion.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Public can view product images" on storage.objects for select using (bucket_id = 'product-images');
create policy "Admins can upload product images" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admins can update product images" on storage.objects for update using (bucket_id = 'product-images' and public.is_admin());
create policy "Admins can delete product images" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());

-- Après avoir créé votre utilisateur via Supabase Authentication, attribuez-lui le rôle admin :
-- insert into public.profiles (id, role) values ('UUID_DE_VOTRE_UTILISATEUR', 'admin');
