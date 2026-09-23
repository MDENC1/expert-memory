-- Recurring notices/events and calendar-originated content.

alter table public.notices
  add column if not exists display_start_date date,
  add column if not exists display_end_date date,
  add column if not exists event_time time,
  add column if not exists source text not null default 'notices',
  add column if not exists source_calendar_dates date[] not null default '{}';

update public.notices
set display_start_date = coalesce(display_start_date, starts_at::date),
    display_end_date = coalesce(display_end_date, coalesce(ends_at::date, starts_at::date))
where display_start_date is null or display_end_date is null;

create table public.notice_recurrence_rules (
  notice_id uuid primary key references public.notices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  frequency text,
  interval_count integer not null default 1 check (interval_count > 0),
  weekdays smallint[] not null default '{}',
  month_days smallint[] not null default '{}',
  hebrew_month text,
  hebrew_day smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notice_recurrence_frequency_check
    check (frequency is null or frequency in ('daily','weekly','monthly','yearly_hebrew')),
  constraint notice_recurrence_weekdays_check
    check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  constraint notice_recurrence_month_days_check
    check (month_days <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]::smallint[])
);

create index notices_display_window_idx
  on public.notices(organization_id, display_start_date, display_end_date);

create index notice_recurrence_org_idx
  on public.notice_recurrence_rules(organization_id);

alter table public.notice_recurrence_rules enable row level security;

create policy "org members read recurrence"
on public.notice_recurrence_rules for select
using (public.is_org_member(organization_id));

create policy "org admins manage recurrence"
on public.notice_recurrence_rules for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

-- Calendar-originated content uses the same notices table:
-- source='calendar' and source_calendar_dates contains one or more explicitly selected dates.
-- Recurring items use notice_recurrence_rules instead of duplicating one record per occurrence.
-- Device/render services expand recurrence rules into concrete dates when rendering screens.
