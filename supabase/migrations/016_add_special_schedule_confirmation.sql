alter table public.special_schedule_days
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid;

update public.special_schedule_days d
set confirmed_at=coalesce(d.confirmed_at,d.created_at)
where d.confirmed_at is null
  and (
    d.replace_normal_schedule=false
    or exists(
      select 1
      from public.special_schedule_entries e
      where e.shul_id=d.shul_id
        and e.event_date=d.event_date
        and e.active=true
    )
  );

comment on column public.special_schedule_days.confirmed_at is
  'When the shul admin explicitly confirmed this special-date schedule for the current year/date.';
comment on column public.special_schedule_days.confirmed_by is
  'Auth user who last confirmed the special-date schedule, when available.';
