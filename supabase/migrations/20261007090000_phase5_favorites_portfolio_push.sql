-- Phase 5, part A: favorites, portfolio entries ("I'm participating" and
-- achievements), Web Push subscriptions and deadline reminders.
--
-- Every user table: RLS on, own rows only, anon has no access, bounded per
-- user, owner and timestamps fixed by triggers. Reminders are sent by a daily
-- job that never holds the service-role key: it calls claim_due_reminders()
-- with a secret whose SHA-256 is stored below, and that function returns only
-- what a reminder needs.

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create index favorites_opportunity_idx on public.favorites (opportunity_id);

create function public.favorites_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('favorites:' || new.user_id::text, 0));
  if (select count(*) from public.favorites where user_id = new.user_id) >= 500 then
    raise exception 'favorite limit reached' using errcode = '23514';
  end if;
  new.created_at := now();
  return new;
end;
$$;

revoke execute on function public.favorites_before_insert() from public, anon, authenticated;

create trigger favorites_before_insert
  before insert on public.favorites
  for each row execute function public.favorites_before_insert();

alter table public.favorites enable row level security;

create policy favorites_select_own on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_insert_own on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy favorites_delete_own on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

-- ---------------------------------------------------------------------------
-- Portfolio entries: something the user takes part in ("participating") or
-- has done ("completed"). Linked to a catalogue item when it came from one.
-- ---------------------------------------------------------------------------
create table public.portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  status text not null default 'completed' check (status in ('participating', 'completed')),
  kind text not null default 'other'
    check (kind in ('olympiads', 'competitions', 'volunteering', 'universities', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  organizer text not null default '' check (char_length(organizer) <= 200),
  result text not null default '' check (char_length(result) <= 200),
  event_date date check (event_date between date '1990-01-01' and date '2100-12-31'),
  description text not null default '' check (char_length(description) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One entry per catalogue item per user; entries typed in by hand have none.
create unique index portfolio_entries_user_opportunity_key
  on public.portfolio_entries (user_id, opportunity_id) where opportunity_id is not null;
create index portfolio_entries_user_date_idx on public.portfolio_entries (user_id, event_date desc nulls last);

create function public.portfolio_entries_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('portfolio:' || new.user_id::text, 0));
    if (select count(*) from public.portfolio_entries where user_id = new.user_id) >= 300 then
      raise exception 'portfolio limit reached' using errcode = '23514';
    end if;
    new.created_at := now();
  else
    new.id := old.id;
    new.user_id := old.user_id;
    -- The catalogue link may be dropped (ON DELETE SET NULL when an item is
    -- removed) but never pointed at another item.
    if new.opportunity_id is not null then
      new.opportunity_id := old.opportunity_id;
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.portfolio_entries_before_write() from public, anon, authenticated;

create trigger portfolio_entries_before_write
  before insert or update on public.portfolio_entries
  for each row execute function public.portfolio_entries_before_write();

alter table public.portfolio_entries enable row level security;

create policy portfolio_select_own on public.portfolio_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy portfolio_insert_own on public.portfolio_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy portfolio_update_own on public.portfolio_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy portfolio_delete_own on public.portfolio_entries
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.portfolio_entries from anon, authenticated;
grant select, insert, update, delete on public.portfolio_entries to authenticated;

-- ---------------------------------------------------------------------------
-- Web Push subscriptions (one per device and browser).
-- Written through save_push_subscription(): an endpoint belongs to a device,
-- so when another account signs in on that device it takes the endpoint over,
-- which a plain insert under RLS could not do.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (
    char_length(endpoint) <= 1000
    and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
  ),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
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
  perform pg_advisory_xact_lock(hashtextextended('push:' || uid::text, 0));
  if (select count(*) from public.push_subscriptions where user_id = uid and endpoint <> p_endpoint) >= 5 then
    raise exception 'subscription limit reached' using errcode = '23514';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reminders: favorites with a deadline get a push 7 days and 1 day before.
-- ---------------------------------------------------------------------------
create table public.reminder_deliveries (
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  kind text not null check (kind in ('d7', 'd1')),
  sent_at timestamptz not null default now(),
  primary key (user_id, opportunity_id, kind)
);

-- Nobody reads or writes this through the API; only the functions below.
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon, authenticated;

-- The job's secret, stored as a SHA-256 hash. RLS on, no policies, no grants.
create table public.job_secrets (
  name text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$')
);
alter table public.job_secrets enable row level security;
revoke all on public.job_secrets from anon, authenticated;

insert into public.job_secrets (name, sha256)
values ('reminders', '0f954b9bdb399442ea7fee90a823e358531fd14bd65098afa3f315f167f617be');

create function public.job_secret_ok(p_name text, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_secrets s
    where s.name = p_name
      and s.sha256 = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex')
  );
$$;

revoke execute on function public.job_secret_ok(text, text) from public, anon, authenticated;

/**
 * Returns every reminder due now and records it as sent, in one statement, so
 * a retried or overlapping run never sends the same reminder twice.
 * "d7": the deadline is 2–7 days away; "d1": today or tomorrow. A run that was
 * missed (the job runs daily) still catches up the next day.
 */
create function public.claim_due_reminders(p_key text)
returns table (
  endpoint text,
  p256dh text,
  auth text,
  opportunity_slug text,
  opportunity_title text,
  deadline date,
  days_left int,
  kind text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Almaty')::date;
begin
  if not public.job_secret_ok('reminders', p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with due as (
    select f.user_id, o.id as opportunity_id, o.slug, o.title, o.deadline,
           (o.deadline - today) as left_days,
           case when o.deadline - today <= 1 then 'd1' else 'd7' end as reminder_kind
    from public.favorites f
    join public.opportunities o on o.id = f.opportunity_id
    where o.status = 'published'
      and o.deadline is not null
      and o.deadline - today between 0 and 7
      and exists (select 1 from public.push_subscriptions p where p.user_id = f.user_id)
  ),
  claimed as (
    insert into public.reminder_deliveries (user_id, opportunity_id, kind)
    select d.user_id, d.opportunity_id, d.reminder_kind from due d
    on conflict do nothing
    returning reminder_deliveries.user_id, reminder_deliveries.opportunity_id, reminder_deliveries.kind
  )
  select p.endpoint, p.p256dh, p.auth, d.slug, d.title, d.deadline, d.left_days, d.reminder_kind
  from claimed c
  join due d on d.user_id = c.user_id and d.opportunity_id = c.opportunity_id and d.reminder_kind = c.kind
  join public.push_subscriptions p on p.user_id = c.user_id;
end;
$$;

revoke execute on function public.claim_due_reminders(text) from public, authenticated;
grant execute on function public.claim_due_reminders(text) to anon;

-- The push service said this endpoint is gone (HTTP 404/410): drop it.
create function public.forget_push_endpoint(p_key text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.job_secret_ok('reminders', p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke execute on function public.forget_push_endpoint(text, text) from public, authenticated;
grant execute on function public.forget_push_endpoint(text, text) to anon;

-- ---------------------------------------------------------------------------
-- Consents: a log, never edited. Withdrawing is a new row with granted =
-- false; the latest row of a kind is the current answer.
--   terms         the privacy policy, with the age bracket; for anyone under
--                 18 it records that a parent or guardian agrees
--   ai_processing the notice that messages go to OpenAI (USA)
--   notes_to_ai   sending the user's notes to the assistant as context
--   push          deadline reminders
--   certificate_scan, public_portfolio: later features, reserved here
-- ---------------------------------------------------------------------------
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'ai_processing', 'notes_to_ai', 'push', 'certificate_scan', 'public_portfolio')),
  version text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  age_bracket text check (age_bracket in ('18plus', '13to17', 'under13')),
  parent_ok boolean not null default false,
  granted boolean not null,
  created_at timestamptz not null default now(),
  -- Terms always say how old the user is; under 18 needs the parent's agreement.
  check (kind <> 'terms' or not granted or (age_bracket is not null and (age_bracket = '18plus' or parent_ok)))
);

create index consents_user_kind_idx on public.consents (user_id, kind, created_at desc);

create function public.consents_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('consents:' || new.user_id::text, 0));
  if (select count(*) from public.consents where user_id = new.user_id) >= 200 then
    raise exception 'consent log limit reached' using errcode = '23514';
  end if;
  new.created_at := now();
  return new;
end;
$$;

revoke execute on function public.consents_before_insert() from public, anon, authenticated;

create trigger consents_before_insert
  before insert on public.consents
  for each row execute function public.consents_before_insert();

alter table public.consents enable row level security;

create policy consents_select_own on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

revoke all on public.consents from anon, authenticated;
grant select, insert on public.consents to authenticated;

-- The current answer for each kind, for the signed-in user.
create function public.my_consents()
returns table (kind text, version text, age_bracket text, granted boolean, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (c.kind) c.kind, c.version, c.age_bracket, c.granted, c.created_at
  from public.consents c
  where c.user_id = (select auth.uid())
  order by c.kind, c.created_at desc, c.id desc;
$$;

revoke execute on function public.my_consents() from public, anon;
grant execute on function public.my_consents() to authenticated;

-- ---------------------------------------------------------------------------
-- Deleting one's own account. Everything that belongs to the user goes with
-- it (every user table references auth.users on delete cascade).
-- ---------------------------------------------------------------------------
create function public.delete_my_account()
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
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Data minimisation: the profile no longer copies the full name from Google
-- (nothing uses it). Existing copies are cleared.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles set display_name = null where display_name is not null;
