alter table public.notices_events
add column if not exists recurrence_excluded_dates date[] not null default '{}'::date[];
