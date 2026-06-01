-- Goal linking: persist event -> medium-term goal association.
alter table public.events
  add column if not exists medium_term_goal_id text;

create index if not exists events_user_medium_term_goal
  on public.events(user_id, medium_term_goal_id);
