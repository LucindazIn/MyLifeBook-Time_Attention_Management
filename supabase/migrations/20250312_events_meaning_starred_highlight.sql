-- Narrative & Life Curve: meaning (事件意义), starred (星标), highlight (高光)
-- role 若已存在可忽略
alter table public.events
  add column if not exists role text,
  add column if not exists meaning text,
  add column if not exists starred boolean default false,
  add column if not exists highlight boolean default false;
