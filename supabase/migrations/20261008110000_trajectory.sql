-- Phase 5, part C: "Моя траектория". A goal ("поступить на грант по IT")
-- and its dated plan: catalogue opportunities to take part in, kinds of
-- opportunities to look for, preparation tasks, and gaps in the portfolio.
-- The plan is written by /api/trajectory acting as the user (RLS applies);
-- the user ticks steps off and deletes goals.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  -- First day of the month the goal is for; none = "no fixed date".
  target_month date check (target_month is null or (extract(day from target_month) = 1 and target_month between date '2020-01-01' and date '2040-12-01')),
  summary text not null default '' check (char_length(summary) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_idx on public.goals (user_id, created_at desc);

create table public.goal_steps (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null check (position between 0 and 29),
  kind text not null check (kind in ('opportunity', 'search', 'task', 'gap')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  detail text not null default '' check (char_length(detail) <= 500),
  due_month date check (due_month is null or (extract(day from due_month) = 1 and due_month between date '2020-01-01' and date '2040-12-01')),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  search_query text check (search_query is null or char_length(search_query) <= 80),
  search_kind text check (search_kind is null or search_kind in ('olympiads', 'competitions', 'volunteering', 'universities')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index goal_steps_goal_idx on public.goal_steps (goal_id, position);

-- Five goals per user, thirty steps per goal; a step belongs to its goal's owner.
create function public.goals_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('goals:' || new.user_id::text, 0));
    if (select count(*) from public.goals where user_id = new.user_id) >= 5 then
      raise exception 'goal limit reached' using errcode = '23514', hint = 'goal_limit';
    end if;
    new.created_at := now();
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function public.goal_steps_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner uuid;
begin
  if tg_op = 'INSERT' then
    select user_id into owner from public.goals where id = new.goal_id;
    if owner is null or owner <> new.user_id then
      raise exception 'step must belong to the goal owner' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('goal_steps:' || new.goal_id::text, 0));
    if (select count(*) from public.goal_steps where goal_id = new.goal_id) >= 30 then
      raise exception 'step limit reached' using errcode = '23514';
    end if;
    new.created_at := now();
  else
    -- Only "done" changes after the plan is written.
    new.id := old.id;
    new.goal_id := old.goal_id;
    new.user_id := old.user_id;
    new.position := old.position;
    new.kind := old.kind;
    new.title := old.title;
    new.detail := old.detail;
    new.due_month := old.due_month;
    new.opportunity_id := case when new.opportunity_id is null then null else old.opportunity_id end;
    new.search_query := old.search_query;
    new.search_kind := old.search_kind;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.goals_before_write() from public, anon, authenticated;
revoke execute on function public.goal_steps_before_write() from public, anon, authenticated;

create trigger goals_before_write before insert or update on public.goals
  for each row execute function public.goals_before_write();
create trigger goal_steps_before_write before insert or update on public.goal_steps
  for each row execute function public.goal_steps_before_write();

alter table public.goals enable row level security;
alter table public.goal_steps enable row level security;

create policy goals_select_own on public.goals for select to authenticated using (user_id = (select auth.uid()));
create policy goals_insert_own on public.goals for insert to authenticated with check (user_id = (select auth.uid()));
create policy goals_update_own on public.goals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy goals_delete_own on public.goals for delete to authenticated using (user_id = (select auth.uid()));

create policy goal_steps_select_own on public.goal_steps for select to authenticated using (user_id = (select auth.uid()));
create policy goal_steps_insert_own on public.goal_steps for insert to authenticated with check (user_id = (select auth.uid()));
create policy goal_steps_update_own on public.goal_steps for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy goal_steps_delete_own on public.goal_steps for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.goals, public.goal_steps from anon, authenticated;
grant select, insert, delete on public.goals, public.goal_steps to authenticated;
grant update (title, target_month, summary) on public.goals to authenticated;
grant update (done) on public.goal_steps to authenticated;
