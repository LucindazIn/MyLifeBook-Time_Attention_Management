-- One row per user: full Life Book chapters JSON (cross-device sync for 人生之书章节)

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
