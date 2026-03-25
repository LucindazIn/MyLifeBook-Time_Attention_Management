-- Supabase schema for My Life Book / 人生之书 (online-first, full history)
-- Includes: events, event_tags, event_instance_completions, day_meta, daily_quotes, devices, subscriptions
-- RLS: all private to auth.uid()
-- RPC: register_device (per-user cap via subscriptions.max_devices, default 8)

-- Enable extensions
create extension if not exists pgcrypto;

-- Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------
-- events
-- -----------------------------
create table if not exists public.events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  type text not null,
  recurrence jsonb,
  label_text text,
  label_color text,
  completed boolean default false,
  deleted boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_user_start_time on public.events(user_id, start_time);
create index if not exists events_user_updated_at on public.events(user_id, updated_at);
create index if not exists events_user_deleted on public.events(user_id, deleted);

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.events enable row level security;

drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
for select using (auth.uid() = user_id);

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
for insert with check (auth.uid() = user_id);

drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------
-- event_tags (separate table)
-- -----------------------------
create table if not exists public.event_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  tag text not null,
  deleted boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id, tag)
);

create index if not exists event_tags_user_tag on public.event_tags(user_id, tag);
create index if not exists event_tags_user_updated_at on public.event_tags(user_id, updated_at);
create index if not exists event_tags_event_id on public.event_tags(event_id);

drop trigger if exists trg_event_tags_updated_at on public.event_tags;
create trigger trg_event_tags_updated_at
before update on public.event_tags
for each row execute function public.set_updated_at();

alter table public.event_tags enable row level security;

drop policy if exists event_tags_select_own on public.event_tags;
create policy event_tags_select_own on public.event_tags
for select using (auth.uid() = user_id);

drop policy if exists event_tags_insert_own on public.event_tags;
create policy event_tags_insert_own on public.event_tags
for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid())
);

drop policy if exists event_tags_update_own on public.event_tags;
create policy event_tags_update_own on public.event_tags
for update using (
  auth.uid() = user_id
  and exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid())
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid())
);

-- -----------------------------
-- event_instance_completions (per-instance completion)
-- -----------------------------
create table if not exists public.event_instance_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  instance_date date not null,
  completed boolean not null,
  deleted boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id, instance_date)
);

create index if not exists completions_user_instance_date on public.event_instance_completions(user_id, instance_date);
create index if not exists completions_user_updated_at on public.event_instance_completions(user_id, updated_at);

drop trigger if exists trg_completions_updated_at on public.event_instance_completions;
create trigger trg_completions_updated_at
before update on public.event_instance_completions
for each row execute function public.set_updated_at();

alter table public.event_instance_completions enable row level security;

drop policy if exists completions_select_own on public.event_instance_completions;
create policy completions_select_own on public.event_instance_completions
for select using (auth.uid() = user_id);

drop policy if exists completions_insert_own on public.event_instance_completions;
create policy completions_insert_own on public.event_instance_completions
for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid())
);

drop policy if exists completions_update_own on public.event_instance_completions;
create policy completions_update_own on public.event_instance_completions
for update using (
  auth.uid() = user_id
  and exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid())
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid())
);

-- -----------------------------
-- day_meta (dayName/dayTag/journal)
-- -----------------------------
create table if not exists public.day_meta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  day_name text,
  day_name_is_manual boolean,
  day_name_language text,
  day_tag text,
  journal text,
  energy_level smallint,
  mood_level smallint,
  focus_level smallint,
  deleted boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists day_meta_user_updated_at on public.day_meta(user_id, updated_at);

drop trigger if exists trg_day_meta_updated_at on public.day_meta;
create trigger trg_day_meta_updated_at
before update on public.day_meta
for each row execute function public.set_updated_at();

alter table public.day_meta enable row level security;
drop policy if exists day_meta_select_own on public.day_meta;
create policy day_meta_select_own on public.day_meta
for select using (auth.uid() = user_id);
drop policy if exists day_meta_insert_own on public.day_meta;
create policy day_meta_insert_own on public.day_meta
for insert with check (auth.uid() = user_id);
drop policy if exists day_meta_update_own on public.day_meta;
create policy day_meta_update_own on public.day_meta
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------
-- daily_quotes
-- -----------------------------
create table if not exists public.daily_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  text text not null,
  author text,
  deleted boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists daily_quotes_user_updated_at on public.daily_quotes(user_id, updated_at);

drop trigger if exists trg_daily_quotes_updated_at on public.daily_quotes;
create trigger trg_daily_quotes_updated_at
before update on public.daily_quotes
for each row execute function public.set_updated_at();

alter table public.daily_quotes enable row level security;
drop policy if exists daily_quotes_select_own on public.daily_quotes;
create policy daily_quotes_select_own on public.daily_quotes
for select using (auth.uid() = user_id);
drop policy if exists daily_quotes_insert_own on public.daily_quotes;
create policy daily_quotes_insert_own on public.daily_quotes
for insert with check (auth.uid() = user_id);
drop policy if exists daily_quotes_update_own on public.daily_quotes;
create policy daily_quotes_update_own on public.daily_quotes
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------
-- subscriptions (V1: default free)
-- -----------------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free',
  max_devices int not null default 8,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
for select using (auth.uid() = user_id);
drop policy if exists subscriptions_insert_own on public.subscriptions;
create policy subscriptions_insert_own on public.subscriptions
for insert with check (auth.uid() = user_id);
drop policy if exists subscriptions_update_own on public.subscriptions;
create policy subscriptions_update_own on public.subscriptions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------
-- devices + register_device RPC (max_devices enforcement)
-- -----------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_id)
);

create index if not exists devices_user_active on public.devices(user_id, revoked_at);

alter table public.devices enable row level security;
drop policy if exists devices_select_own on public.devices;
create policy devices_select_own on public.devices
for select using (auth.uid() = user_id);
drop policy if exists devices_insert_own on public.devices;
create policy devices_insert_own on public.devices
for insert with check (auth.uid() = user_id);
drop policy if exists devices_update_own on public.devices;
create policy devices_update_own on public.devices
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.register_device(device_id text, device_name text)
returns void
language plpgsql
security definer
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  max_devices int;
  active_count int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- ensure subscription row exists
  insert into public.subscriptions(user_id) values (uid)
  on conflict (user_id) do nothing;

  select s.max_devices into max_devices from public.subscriptions s where s.user_id = uid;
  if max_devices is null then
    max_devices := 8;
  end if;

  select count(*) into active_count
  from public.devices d
  where d.user_id = uid and d.revoked_at is null;

  -- allow reusing existing device_id without counting extra (use d. prefix to avoid param/column ambiguity)
  if exists (select 1 from public.devices d where d.user_id = uid and d.device_id = register_device.device_id and d.revoked_at is null) then
    update public.devices d
      set last_seen_at = now(), device_name = register_device.device_name
      where d.user_id = uid and d.device_id = register_device.device_id;
    return;
  end if;

  if active_count >= max_devices then
    raise exception 'device_limit_reached';
  end if;

  insert into public.devices(user_id, device_id, device_name)
  values (uid, register_device.device_id, register_device.device_name)
  on conflict (user_id, device_id) do update
    set last_seen_at = now(), revoked_at = null, device_name = register_device.device_name;
end;
$$;

revoke all on function public.register_device(text, text) from public;
grant execute on function public.register_device(text, text) to authenticated;

