-- 时间聚合 / 人生之书封面等：长期目标元数据、自定义标签、生命能量、下月焦点（localStorage 扩展）

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
