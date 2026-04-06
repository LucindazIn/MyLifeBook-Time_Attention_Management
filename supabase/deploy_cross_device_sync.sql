-- =============================================================================
-- Feather Schedule — 跨设备同步所需表（一次性在 Supabase SQL Editor 中执行即可）
--
-- 用途：
--   1. life_book_snapshot     — 人生之书章节列表（JSON）
--   2. user_collection_state  — 时间聚合扩展：长期目标元数据、封面三行、自定义标签、
--                               人生曲线能量点、下月焦点等（单 JSON payload）
--
-- 前提：已有 auth.users；若你从未跑过主 schema，请先部署项目根目录 supabase/schema.sql，
--       或至少保证下方 set_updated_at 已存在（本文件已包含 create or replace，可重复执行）。
-- =============================================================================

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
-- 1) 人生之书章节
-- -----------------------------
create table if not exists public.life_book_snapshot (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chapters jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_life_book_snapshot_updated_at on public.life_book_snapshot;
create trigger trg_life_book_snapshot_updated_at
before update on public.life_book_snapshot
for each row execute function public.set_updated_at();

alter table public.life_book_snapshot enable row level security;

drop policy if exists life_book_snapshot_select_own on public.life_book_snapshot;
create policy life_book_snapshot_select_own on public.life_book_snapshot
for select using (auth.uid() = user_id);

drop policy if exists life_book_snapshot_insert_own on public.life_book_snapshot;
create policy life_book_snapshot_insert_own on public.life_book_snapshot
for insert with check (auth.uid() = user_id);

drop policy if exists life_book_snapshot_update_own on public.life_book_snapshot;
create policy life_book_snapshot_update_own on public.life_book_snapshot
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists life_book_snapshot_delete_own on public.life_book_snapshot;
create policy life_book_snapshot_delete_own on public.life_book_snapshot
for delete using (auth.uid() = user_id);

-- -----------------------------
-- 2) 时间聚合 / 封面等客户端状态
-- -----------------------------
create table if not exists public.user_collection_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_collection_state_updated_at on public.user_collection_state;
create trigger trg_user_collection_state_updated_at
before update on public.user_collection_state
for each row execute function public.set_updated_at();

alter table public.user_collection_state enable row level security;

drop policy if exists user_collection_state_select_own on public.user_collection_state;
create policy user_collection_state_select_own on public.user_collection_state
for select using (auth.uid() = user_id);

drop policy if exists user_collection_state_insert_own on public.user_collection_state;
create policy user_collection_state_insert_own on public.user_collection_state
for insert with check (auth.uid() = user_id);

drop policy if exists user_collection_state_update_own on public.user_collection_state;
create policy user_collection_state_update_own on public.user_collection_state
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_collection_state_delete_own on public.user_collection_state;
create policy user_collection_state_delete_own on public.user_collection_state
for delete using (auth.uid() = user_id);
