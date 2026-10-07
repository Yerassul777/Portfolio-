-- Security hardening (security review, 2026-10-07): limits that survive a
-- determined script, a recoverable catalogue, no default access to functions.

-- ---------------------------------------------------------------------------
-- 1. New functions in public are callable by nobody until granted. Supabase
--    grants EXECUTE to anon/authenticated by default; one forgotten revoke
--    would otherwise expose a function through /rpc.
-- ---------------------------------------------------------------------------
-- Per-schema defaults can only add to the global ones, so PUBLIC's EXECUTE is
-- revoked globally and Supabase's per-schema grant to the API roles here.
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- A schema the API does not expose: internal tables and settings.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The pre-Phase-2 row archive leaves the public table: it doubled the size
--    of every `select=*` anyone can make, for data no page uses.
-- ---------------------------------------------------------------------------
create table private.opportunities_legacy (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  legacy jsonb not null
);
insert into private.opportunities_legacy (opportunity_id, legacy)
select id, legacy from public.opportunities where legacy is not null;
alter table public.opportunities drop column legacy;

-- ---------------------------------------------------------------------------
-- 3. Search arguments are bounded in size, page size and depth, so a flood of
--    maximal requests cannot tie up the connection pool.
-- ---------------------------------------------------------------------------
create or replace function public.opportunity_search_check(p_kind text, p_filters jsonb, p_search jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  allowed constant text[] := array['subject', 'level', 'type', 'age_group', 'format', 'duration',
                                   'city', 'field', 'requirements', 'grant_available'];
  bad text;
  token jsonb;
begin
  if octet_length(coalesce(p_filters, '{}'::jsonb)::text) > 2048
     or octet_length(coalesce(p_search, '[]'::jsonb)::text) > 32768 then
    raise exception 'search arguments too large' using errcode = '54000';
  end if;

  if p_kind is not null and p_kind not in ('olympiads', 'competitions', 'volunteering', 'universities') then
    raise exception 'unknown kind: %', p_kind using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_filters, '{}'::jsonb)) <> 'object' then
    raise exception 'p_filters must be a JSON object' using errcode = '22023';
  end if;
  select k into bad from jsonb_object_keys(coalesce(p_filters, '{}'::jsonb)) as k where k <> all (allowed) limit 1;
  if bad is not null then
    raise exception 'unknown filter: %', bad using errcode = '22023';
  end if;

  if p_search is null then
    return;
  end if;
  if jsonb_typeof(p_search) <> 'array' then
    raise exception 'p_search must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_search) > 10 then
    raise exception 'p_search: at most 10 words' using errcode = '22023';
  end if;
  for token in select value from jsonb_array_elements(p_search)
  loop
    -- coalesce: a missing "t" yields NULL, and NULL <> 'string' is not true.
    if jsonb_typeof(token) <> 'object'
       or coalesce(jsonb_typeof(token -> 't'), '') <> 'string'
       or coalesce(length(token ->> 't'), 0) not between 1 and 100 then
      raise exception 'p_search: each word needs "t", 1 to 100 characters' using errcode = '22023';
    end if;
    if token ? 'f' then
      if jsonb_typeof(token -> 'f') <> 'object' then
        raise exception 'p_search: "f" must be an object' using errcode = '22023';
      end if;
      select k into bad from jsonb_object_keys(token -> 'f') as k where k <> all (allowed) limit 1;
      if bad is not null then
        raise exception 'p_search: unknown filter: %', bad using errcode = '22023';
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.search_opportunities(
  p_kind text default null,
  p_filters jsonb default '{}'::jsonb,
  p_only_open boolean default false,
  p_limit int default 100,
  p_offset int default 0,
  p_search jsonb default null,
  p_sort text default 'newest'
)
returns setof public.opportunities
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Almaty')::date;
begin
  perform public.opportunity_search_check(p_kind, p_filters, p_search);
  if coalesce(p_sort, 'newest') not in ('newest', 'deadline') then
    raise exception 'unknown sort: %', p_sort using errcode = '22023';
  end if;

  return query
  select o.*
  from public.opportunities o
  where o.status = 'published'
    and public.opportunity_matches(o, p_kind, p_filters, p_search, p_only_open, today)
  order by
    case when p_sort = 'deadline' then
      case when o.deadline is null then 1 when o.deadline >= today then 0 else 2 end
    end,
    case when p_sort = 'deadline' and o.deadline >= today then o.deadline end asc,
    case when p_sort = 'deadline' and o.deadline < today then o.deadline end desc,
    o.created_at desc,
    o.id
  -- The site asks for 24 (a page) or 50 (the home page highlights) at most;
  -- 24000 is the deepest page the catalogue links to (1000 pages of 24).
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset least(greatest(coalesce(p_offset, 0), 0), 24000);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Storage per user is bounded in bytes, not only in rows: on the free plan
--    a database over 500 MB turns read-only for everyone. Limits are checked
--    under a per-user lock so parallel inserts cannot slip past them.
-- ---------------------------------------------------------------------------
create or replace function public.notes_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  used bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('notes:' || new.user_id::text, 0));
  if tg_op = 'INSERT' then
    if (select count(*) from public.notes where user_id = new.user_id) >= 500 then
      raise exception 'note limit reached' using errcode = '23514';
    end if;
    new.created_at := least(coalesce(new.created_at, now()), now());
    new.updated_at := least(coalesce(new.updated_at, new.created_at), now());
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  -- 1 MB of notes per user: hundreds of long notes, far below abuse.
  select coalesce(sum(octet_length(n.title) + octet_length(n.content)), 0) into used
  from public.notes n
  where n.user_id = new.user_id and n.id <> new.id;
  if used + octet_length(new.title) + octet_length(new.content) > 1048576 then
    raise exception 'notes storage limit reached' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Chat messages: 4000 characters (the assistant's replies are far shorter),
-- at most 200 per insert, and the trim keeps the newest 200 with one indexed
-- lookup instead of a NOT IN per row.
alter table public.ai_messages drop constraint ai_messages_content_check;
alter table public.ai_messages
  add constraint ai_messages_content_check check (char_length(content) between 1 and 4000) not valid;

create or replace function public.ai_messages_after_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from new_rows) > 200 then
    raise exception 'too many messages in one request' using errcode = '54000';
  end if;
  delete from public.ai_messages m
  using (select distinct n.user_id from new_rows n) u
  where m.user_id = u.user_id
    and (m.created_at, m.id) < (
      select k.created_at, k.id
      from public.ai_messages k
      where k.user_id = u.user_id
      order by k.created_at desc, k.id desc
      offset 199
      limit 1
    );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The AI assistant: a ceiling for the whole site per day (a farm of
--    accounts cannot multiply spend without bound), a pause between one
--    user's messages, and cost statistics a user cannot inflate.
-- ---------------------------------------------------------------------------
create table private.app_limits (
  key text primary key,
  value numeric not null
);
insert into private.app_limits (key, value) values
  ('ai_global_daily_messages', 1500),
  ('ai_min_seconds_between', 3);

alter table public.ai_usage
  add column last_message_at timestamptz,
  add column recorded_count int not null default 0;

create index ai_usage_date_idx on public.ai_usage (usage_date);

create or replace function public.consume_ai_message()
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
  current_count int;
  min_gap float8 := (select value::float8 from private.app_limits where key = 'ai_min_seconds_between');
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if (select coalesce(sum(message_count), 0) from public.ai_usage where usage_date = today)
     >= (select value from private.app_limits where key = 'ai_global_daily_messages') then
    raise exception 'ai budget exhausted' using errcode = 'P0001', hint = 'global_budget';
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

  insert into public.ai_usage as u (user_id, usage_date, message_count, last_message_at)
  values (uid, today, 1, now())
  on conflict (user_id, usage_date) do update
    set message_count = u.message_count + 1, last_message_at = now()
    where u.message_count < plan_limit
      and (u.last_message_at is null or u.last_message_at < now() - make_interval(secs => min_gap))
  returning u.message_count into new_count;

  if new_count is null then
    select u.message_count into current_count from public.ai_usage u where u.user_id = uid and u.usage_date = today;
    if coalesce(current_count, 0) < plan_limit then
      raise exception 'too fast' using errcode = 'P0001', hint = 'too_fast';
    end if;
    return query select false, plan_limit, plan_limit;
  else
    return query select true, new_count, plan_limit;
  end if;
end;
$$;

revoke execute on function public.consume_ai_message() from public, anon;
grant execute on function public.consume_ai_message() to authenticated;

-- One record per message, with realistic bounds: cost_usd becomes data a
-- budget can rely on.
create or replace function public.record_ai_usage(p_input_tokens int, p_output_tokens int, p_cost_usd numeric)
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

  if p_input_tokens not between 0 and 60000
     or p_output_tokens not between 0 and 3000
     or p_cost_usd not between 0 and 0.05 then
    raise exception 'invalid usage values' using errcode = '22023';
  end if;

  update public.ai_usage
     set input_tokens = input_tokens + p_input_tokens,
         output_tokens = output_tokens + p_output_tokens,
         cost_usd = cost_usd + p_cost_usd,
         recorded_count = recorded_count + 1
   where user_id = uid
     and usage_date = (now() at time zone 'Asia/Almaty')::date
     and recorded_count < message_count;
end;
$$;

revoke execute on function public.record_ai_usage(int, int, numeric) from public, anon;
grant execute on function public.record_ai_usage(int, int, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The catalogue can be recovered from anything an admin account does:
--    no hard deletes through the API (removing = status 'archived'), every
--    change is logged with the old and new row, and a request may change at
--    most 5 rows (a stolen admin session cannot wipe the table in one call).
-- ---------------------------------------------------------------------------
drop policy opportunities_admin_delete on public.opportunities;
revoke delete on public.opportunities from authenticated;

create table private.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_role text,
  table_name text not null,
  op text not null,
  row_id uuid,
  old_row jsonb,
  new_row jsonb
);

create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_log (actor, actor_role, table_name, op, row_id, old_row, new_row)
  values (
    auth.uid(),
    -- current_user here is the function's owner; the caller's role is this setting.
    coalesce(nullif(current_setting('role', true), 'none'), session_user),
    tg_table_name,
    tg_op,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

revoke execute on function private.audit_row() from public, anon, authenticated;

create trigger opportunities_audit
  after insert or update or delete on public.opportunities
  for each row execute function private.audit_row();

create function private.guard_bulk()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (select count(*) from changed) > 5 then
    raise exception 'bulk % of % rows refused; use the SQL editor', tg_op, (select count(*) from changed)
      using errcode = '42501';
  end if;
  return null;
end;
$$;

revoke execute on function private.guard_bulk() from public, anon, authenticated;

create trigger opportunities_guard_bulk_update
  after update on public.opportunities
  referencing new table as changed
  for each statement execute function private.guard_bulk();

create trigger opportunities_guard_bulk_insert
  after insert on public.opportunities
  referencing new table as changed
  for each statement execute function private.guard_bulk();

-- ---------------------------------------------------------------------------
-- 7. Profile names are short (they are no longer filled from Google).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 80);
