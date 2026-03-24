-- Add energy_level, mood_level, focus_level to day_meta (0-100 vibes)
alter table public.day_meta
  add column if not exists energy_level smallint,
  add column if not exists mood_level smallint,
  add column if not exists focus_level smallint;
