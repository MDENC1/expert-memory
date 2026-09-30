alter table public.schedule_entries
  drop constraint if exists valid_timing_source;

alter table public.schedule_entries
  add constraint valid_timing_source
  check (
    timing_source is null
    or timing_source in ('fixed','plag','sunset','candle_lighting','shema_gra','follows')
  );
