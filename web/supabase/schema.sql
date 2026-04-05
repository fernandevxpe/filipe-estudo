-- Executar no Supabase → SQL Editor (nova query) → Run.
-- Depois: Authentication → Providers → Email (ativar); opcional desativar "Confirm email" para testes.

-- Tabelas de progresso (por utilizador autenticado)
create table if not exists public.study_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  pool_id text,
  started_at timestamptz not null,
  ended_at timestamptz,
  score double precision,
  total integer,
  correct integer,
  session_kind text default 'single'
);

create table if not exists public.session_answers (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  item_id text not null,
  choice text,
  correct_letter text,
  is_correct boolean,
  time_ms integer not null,
  evidence_type text default 'objective',
  area text,
  study_topic text,
  skipped boolean default false,
  source_pool_id text
);

create table if not exists public.daily_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  day text not null,
  status text not null default 'perdido',
  target_questions integer default 0,
  done_questions integer default 0,
  notes text,
  correct_cum integer default 0,
  graded_cum integer default 0,
  primary key (user_id, day)
);

create table if not exists public.audit_flags (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text,
  kind text,
  detail text,
  created_at timestamptz
);

create index if not exists idx_study_sessions_user_ended on public.study_sessions (user_id, ended_at desc);
create index if not exists idx_session_answers_user on public.session_answers (user_id);
create index if not exists idx_session_answers_session on public.session_answers (session_id);
create index if not exists idx_audit_flags_user on public.audit_flags (user_id, created_at desc);

alter table public.study_sessions enable row level security;
alter table public.session_answers enable row level security;
alter table public.daily_log enable row level security;
alter table public.audit_flags enable row level security;

drop policy if exists "study_sessions_own" on public.study_sessions;
drop policy if exists "session_answers_own" on public.session_answers;
drop policy if exists "daily_log_own" on public.daily_log;
drop policy if exists "audit_flags_own" on public.audit_flags;

create policy "study_sessions_own" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "session_answers_own" on public.session_answers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily_log_own" on public.daily_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "audit_flags_own" on public.audit_flags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
