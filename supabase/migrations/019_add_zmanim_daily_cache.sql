create table if not exists public.zmanim_daily_cache (
  location_id text not null,
  zman_date date not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (location_id, zman_date)
);

alter table public.zmanim_daily_cache enable row level security;

revoke all on table public.zmanim_daily_cache from anon, authenticated;
grant select, insert, update, delete on table public.zmanim_daily_cache to service_role;

comment on table public.zmanim_daily_cache is
  'Server-side cache of deterministic MyZmanim GetDay responses keyed by location and date.';
