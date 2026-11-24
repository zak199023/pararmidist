-- ParaRmi-Dist V5 : suivi des prix concurrents et calcul tarifaire
alter table public.products
  add column if not exists competitor_average_price numeric(12,2),
  add column if not exists competitor_price_count integer not null default 0,
  add column if not exists competitor_sources text,
  add column if not exists source_url text,
  add column if not exists price_formula text,
  add column if not exists price_checked_at timestamptz;

alter table public.products
  add constraint products_competitor_average_price_nonnegative
  check (competitor_average_price is null or competitor_average_price >= 0);

comment on column public.products.competitor_average_price is
  'Prix moyen observé chez les concurrents, en MAD.';
comment on column public.products.price_formula is
  'Règle utilisée : average_competitors_minus_15_percent ou manual.';
comment on column public.products.competitor_sources is
  'Sources concurrentes consultées, séparées par |.';
