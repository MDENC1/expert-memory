-- Jewish-calendar automation layer.
-- The calendar engine generates event instances; admins enter only organization-specific times.

create table public.organization_calendar_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  diaspora_mode boolean not null default true,
  minhag text not null default 'ashkenaz',
  candle_lighting_offset_minutes integer not null default 18,
  havdalah_method text not null default 'configured',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.jewish_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  local_date date not null,
  hebrew_year integer not null,
  hebrew_month text not null,
  hebrew_day integer not null,
  event_key text not null,
  event_label text not null,
  event_type text not null,
  source text not null default 'calendar_engine',
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique (organization_id, local_date, event_key)
);

create table public.organization_special_times (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hebrew_year integer not null,
  hebrew_month text not null,
  event_key text not null,
  label text not null,
  time_value time,
  enabled boolean not null default true,
  display_priority integer not null default 100,
  notes text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (organization_id, hebrew_year, hebrew_month, event_key)
);

create index jewish_calendar_events_org_date_idx
  on public.jewish_calendar_events(organization_id, local_date);

create index organization_special_times_lookup_idx
  on public.organization_special_times(organization_id, hebrew_year, hebrew_month);

alter table public.organization_calendar_settings enable row level security;
alter table public.jewish_calendar_events enable row level security;
alter table public.organization_special_times enable row level security;

create policy "org members read calendar settings"
on public.organization_calendar_settings for select
using (public.is_org_member(organization_id));

create policy "org admins manage calendar settings"
on public.organization_calendar_settings for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "org members read generated calendar events"
on public.jewish_calendar_events for select
using (public.is_org_member(organization_id));

create policy "org members read special times"
on public.organization_special_times for select
using (public.is_org_member(organization_id));

create policy "org admins manage special times"
on public.organization_special_times for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

-- Important architecture rule:
-- Rosh Chodesh, holidays, fast days and other date-based events should be generated
-- by the trusted Jewish-calendar engine. The organization admin does not choose their dates.
-- organization_special_times stores only shul-specific values such as Shofar, Yizkor,
-- Selichos, Hakafos and special minyan times.
