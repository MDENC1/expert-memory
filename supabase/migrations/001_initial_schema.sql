-- Magnets multi-tenant starter schema
-- Intended for Supabase/Postgres. Review before production deployment.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('super_admin','organization_admin','editor');
create type public.notice_status as enum ('draft','scheduled','live','expired');
create type public.publish_mode as enum ('scheduled','immediate');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  timezone text not null default 'America/New_York',
  branding jsonb not null default '{}'::jsonb,
  regular_update_time time not null default '00:15',
  immediate_push_limit integer not null default 2 check (immediate_push_limit >= 0),
  created_at timestamptz not null default now()
);

create table public.organization_users (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  serial_number text unique not null,
  organization_id uuid references public.organizations(id) on delete set null,
  label text,
  firmware_version text,
  battery_percent integer check (battery_percent between 0 and 100),
  last_checkin_at timestamptz,
  cellular_identifier text,
  status text not null default 'provisioning',
  created_at timestamptz not null default now()
);

create table public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  is_global boolean not null default false,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.schedule_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  local_date date not null,
  hebrew_date_label text,
  template_id uuid references public.schedule_templates(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (organization_id, local_date)
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  headline text not null,
  details text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  priority text not null default 'normal',
  publish_mode public.publish_mode not null default 'scheduled',
  status public.notice_status not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.push_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notice_id uuid references public.notices(id) on delete set null,
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  local_day date not null,
  status text not null default 'queued'
);

create table public.screen_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version bigint generated always as identity,
  content_hash text,
  image_path text,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.device_checkins (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  battery_percent integer,
  firmware_version text,
  network_info jsonb,
  reported_screen_version bigint,
  diagnostics jsonb
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_users ou
    where ou.organization_id = org_id
      and ou.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_users ou
    where ou.organization_id = org_id
      and ou.user_id = auth.uid()
      and ou.role in ('organization_admin','super_admin')
  );
$$;

create or replace function public.request_immediate_push(p_org_id uuid, p_notice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
  v_local_day date;
  v_timezone text;
  v_id uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  select immediate_push_limit, timezone
    into v_limit, v_timezone
  from public.organizations
  where id = p_org_id;

  v_local_day := (now() at time zone v_timezone)::date;

  select count(*) into v_count
  from public.push_requests
  where organization_id = p_org_id
    and local_day = v_local_day
    and status not in ('cancelled','failed');

  if v_count >= v_limit then
    raise exception 'Immediate push limit reached for today';
  end if;

  insert into public.push_requests(organization_id, notice_id, requested_by, local_day)
  values (p_org_id, p_notice_id, auth.uid(), v_local_day)
  returning id into v_id;

  return v_id;
end;
$$;

alter table public.organizations enable row level security;
alter table public.organization_users enable row level security;
alter table public.devices enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_days enable row level security;
alter table public.notices enable row level security;
alter table public.push_requests enable row level security;
alter table public.screen_versions enable row level security;
alter table public.device_checkins enable row level security;
alter table public.audit_logs enable row level security;

create policy "org members read organization"
on public.organizations for select
using (public.is_org_member(id));

create policy "org members read devices"
on public.devices for select
using (organization_id is not null and public.is_org_member(organization_id));

create policy "org members read schedule days"
on public.schedule_days for select
using (public.is_org_member(organization_id));

create policy "org admins manage schedule days"
on public.schedule_days for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "org members read notices"
on public.notices for select
using (public.is_org_member(organization_id));

create policy "org admins manage notices"
on public.notices for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "org members read templates"
on public.schedule_templates for select
using (is_global or (organization_id is not null and public.is_org_member(organization_id)));

create policy "org admins manage own templates"
on public.schedule_templates for all
using (organization_id is not null and public.is_org_admin(organization_id))
with check (organization_id is not null and public.is_org_admin(organization_id));

create policy "org members read push requests"
on public.push_requests for select
using (public.is_org_member(organization_id));

create policy "org members read screen versions"
on public.screen_versions for select
using (public.is_org_member(organization_id));

-- Device check-ins and audit logs should normally be written by trusted server/device APIs.
