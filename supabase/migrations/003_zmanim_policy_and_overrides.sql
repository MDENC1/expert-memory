-- MyZmanim-backed yearly zmanim policy.
-- MyZmanim supplies location-based astronomical/zmanim values.
-- Organization policy chooses how those source values are displayed/applied.

alter table public.organization_calendar_settings
  add column if not exists postal_code text,
  add column if not exists myzmanim_location_id text,
  add column if not exists myzmanim_enabled boolean not null default true,
  add column if not exists fast_start_method text not null default 'dawn_degrees',
  add column if not exists fast_end_offset_minutes integer not null default 42;

alter table public.organization_calendar_settings
  add constraint organization_calendar_settings_fast_end_offset_check
  check (fast_end_offset_minutes in (42, 60, 72));

create table public.zmanim_day_values (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  local_date date not null,
  source text not null default 'myzmanim',
  source_location_id text,
  postal_code text,
  dawn_degrees time,
  dawn_fixed time,
  sunrise time,
  sunset time,
  nightfall_three_stars time,
  nightfall_72_fixed time,
  candle_lighting time,
  source_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (organization_id, local_date, source)
);

create table public.zman_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  local_date date not null,
  zman_key text not null,
  override_time time not null,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, local_date, zman_key)
);

create index zmanim_day_values_org_date_idx
  on public.zmanim_day_values(organization_id, local_date);

create index zman_overrides_org_date_idx
  on public.zman_overrides(organization_id, local_date);

alter table public.zmanim_day_values enable row level security;
alter table public.zman_overrides enable row level security;

create policy "org members read zmanim values"
on public.zmanim_day_values for select
using (public.is_org_member(organization_id));

create policy "org members read zman overrides"
on public.zman_overrides for select
using (public.is_org_member(organization_id));

create policy "org admins manage zman overrides"
on public.zman_overrides for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

-- Intended server workflow:
-- 1. Resolve organization postal_code / MyZmanim Location ID.
-- 2. Fetch/cache MyZmanim values for the Jewish year.
-- 3. For minor fasts, use configured MyZmanim dawn for fast start.
-- 4. For configured fast end, derive sunset + 42/60/72 minutes according to org policy.
-- 5. Apply zman_overrides last, so a shul can change one date without changing its yearly rule.
-- 6. Admin UI shows source attribution + ZIP; device-rendered magnet does not.
