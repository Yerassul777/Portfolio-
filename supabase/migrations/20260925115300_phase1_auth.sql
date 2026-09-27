-- Phase 1 — accounts, admin role, AI quota.
--
-- Purely additive: the live site keeps working before and after. It writes
-- through the service-role key until the Phase 1 code is deployed, and that
-- key bypasses RLS, so the new write policies below change nothing for it.
--
-- Every function below is SECURITY DEFINER with an empty search_path, so every
-- object is schema-qualified and a caller cannot shadow one with their own.

-- ---------------------------------------------------------------------------
-- Plans: the daily AI allowance per plan. Changing a limit is an UPDATE here,
-- not a code change or a deploy.
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key,
  daily_ai_messages int not null check (daily_ai_messages >= 0)
);

insert into public.plans (id, daily_ai_messages) values ('free', 15), ('pro', 200);

alter table public.plans enable row level security;
create policy plans_read on public.plans for select to anon, authenticated using (true);
revoke insert, update, delete on public.plans from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created by trigger.
-- Users can read their own row and write nothing: `plan` decides the AI quota,
-- so letting users update their row would let them grant themselves "pro".
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  plan text not null default 'free' references public.plans (id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy profiles_read_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Admins: RLS on and zero policies, so neither anon nor authenticated can read
-- or write it through the API at all. Admins are added from the SQL editor.
-- A separate table rather than a profiles column: a column on a row the user
-- can see invites exactly the self-promotion bug this design rules out.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Catalogue writes: admins only, enforced by the database.
-- Phase 0 revoked every write grant from anon and authenticated. Authenticated
-- gets INSERT and DELETE back (the admin panel has no edit, so no UPDATE), and
-- the policies admit only admins. anon stays read-only.
-- ---------------------------------------------------------------------------
do $$
declare
  target_table text;
begin
  foreach target_table in array array['olympiads', 'competitions', 'volunteering', 'universities']
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
      'admin_insert_' || target_table, target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))',
      'admin_delete_' || target_table, target_table
    );
    execute format('grant insert, delete on public.%I to authenticated', target_table);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- AI usage: one row per user per day (Asia/Almaty). Users can read their own
-- rows; they change them only through the two functions below.
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default ((now() at time zone 'Asia/Almaty')::date),
  message_count int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;
create policy ai_usage_read_own on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.ai_usage from anon, authenticated;

-- Reserves one message from today's allowance in a single statement, so two
-- concurrent requests cannot both slip under the limit. The limit comes from
-- the caller's plan, never from the caller. A user calling this directly can
-- only spend their own quota; nothing here lowers a counter.
create function public.consume_ai_message()
returns table (allowed boolean, used int, daily_limit int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Almaty')::date;
  plan_limit int;
  new_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select pl.daily_ai_messages into plan_limit
  from public.profiles pr
  join public.plans pl on pl.id = pr.plan
  where pr.id = uid;

  if plan_limit is null then
    select pl.daily_ai_messages into plan_limit from public.plans pl where pl.id = 'free';
  end if;

  if plan_limit <= 0 then
    return query select false, 0, plan_limit;
    return;
  end if;

  insert into public.ai_usage as u (user_id, usage_date, message_count)
  values (uid, today, 1)
  on conflict (user_id, usage_date) do update
    set message_count = u.message_count + 1
    where u.message_count < plan_limit
  returning u.message_count into new_count;

  if new_count is null then
    return query select false, plan_limit, plan_limit;
  else
    return query select true, new_count, plan_limit;
  end if;
end;
$$;

revoke execute on function public.consume_ai_message() from public, anon;
grant execute on function public.consume_ai_message() to authenticated;

-- Adds token counts and cost to today's row, for real cost data before any
-- pricing decision. Values are bounded; the only thing a user can do by
-- calling it directly is inflate their own statistics, never their quota.
create function public.record_ai_usage(p_input_tokens int, p_output_tokens int, p_cost_usd numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_input_tokens not between 0 and 1000000
     or p_output_tokens not between 0 and 100000
     or p_cost_usd not between 0 and 10 then
    raise exception 'invalid usage values' using errcode = '22023';
  end if;

  update public.ai_usage
     set input_tokens = input_tokens + p_input_tokens,
         output_tokens = output_tokens + p_output_tokens,
         cost_usd = cost_usd + p_cost_usd
   where user_id = uid
     and usage_date = (now() at time zone 'Asia/Almaty')::date;
end;
$$;

revoke execute on function public.record_ai_usage(int, int, numeric) from public, anon;
grant execute on function public.record_ai_usage(int, int, numeric) to authenticated;
