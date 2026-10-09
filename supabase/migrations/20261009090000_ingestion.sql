-- Phase 6: automatic search for opportunities.
--
-- A daily job (app/api/cron/ingest) reads the listing pages of configured
-- sources, opens only pages it has not seen, and asks a model to extract an
-- opportunity in the catalogue's own vocabulary. Nothing goes on the site
-- by itself: every find is a row with status 'pending' that an admin
-- approves, edits or rejects (/admin/review). Until an admin switches the
-- job to live, it only reports what it would have added (dry run).
--
-- The job holds no database password and no service-role key: it calls the
-- security definer functions below with the cron secret, whose SHA-256 is in
-- job_secrets (the same pattern as the reminders job).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. One key per web page: scheme, "www.", fragment, trackers and the
--    trailing slash do not make a page different.
-- ---------------------------------------------------------------------------
create function public.url_key(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  host text;
  rest text;
begin
  if p_url is null or p_url !~* '^https?://' then
    return null;
  end if;
  host := lower(substring(p_url from '^https?://(?:www\.)?([^/?#]+)'));
  rest := coalesce(substring(p_url from '^https?://[^/?#]+([^#]*)'), '');
  rest := regexp_replace(rest, '([?&])(utm_[a-z_]+|fbclid|gclid|yclid|igsh)=[^&]*', '\1', 'gi');
  rest := regexp_replace(rest, '[?&]+$', '');
  rest := regexp_replace(rest, '&{2,}', '&', 'g');
  rest := regexp_replace(rest, '\?&', '?');
  rest := regexp_replace(rest, '/+(\?|$)', '\1');
  return host || rest;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Where a catalogue item came from, and how sure the extraction was
-- ---------------------------------------------------------------------------
alter table public.opportunities
  add column source_url text check (source_url is null or (source_url ~ '^https://' and char_length(source_url) <= 1000)),
  add column source_key text,
  add column source_name text check (source_name is null or char_length(source_name) <= 80),
  add column extraction_confidence real check (extraction_confidence is null or extraction_confidence between 0 and 1),
  -- The sentence of the source page that states the deadline, word for word.
  add column evidence text check (evidence is null or char_length(evidence) <= 500),
  add column ingested_at timestamptz,
  -- Set when an admin approves, rejects or edits a find: the job then never
  -- overwrites the text a person checked.
  add column reviewed_at timestamptz,
  -- Kazakh and English, written by the same extraction; shown from Phase 7.
  add column title_kk text check (title_kk is null or char_length(title_kk) <= 300),
  add column title_en text check (title_en is null or char_length(title_en) <= 300),
  add column description_kk text check (description_kk is null or char_length(description_kk) <= 4000),
  add column description_en text check (description_en is null or char_length(description_en) <= 4000);

-- The only hard gate against duplicates: one row per source page, whatever
-- its status, so a rejected find stays rejected instead of coming back nightly.
create unique index opportunities_source_key_key on public.opportunities (source_key) where source_key is not null;
create index opportunities_review_idx on public.opportunities (extraction_confidence desc nulls last) where status = 'pending';
-- "Looks like …" warnings for the reviewer (never a block: trigrams catch
-- typos, not rewordings, and a merge must stay a human decision).
create index opportunities_title_trgm_idx on public.opportunities using gin (title extensions.gin_trgm_ops);

create function public.opportunities_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.source_key := public.url_key(new.source_url);
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.opportunities_provenance() from public, anon, authenticated;

create trigger opportunities_provenance
  before insert or update on public.opportunities
  for each row execute function public.opportunities_provenance();

-- ---------------------------------------------------------------------------
-- 3. Sources, runs, and every page the job has looked at
-- ---------------------------------------------------------------------------
create table public.ingest_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  listing_url text not null check (listing_url ~ '^https://[^/\s]+/' and char_length(listing_url) <= 500),
  -- Which links on the listing are opportunity pages (a regular expression).
  link_pattern text not null check (char_length(link_pattern) between 3 and 300),
  kind_hint text check (kind_hint is null or kind_hint in ('olympiads', 'competitions', 'volunteering', 'universities')),
  enabled boolean not null default true,
  max_new_per_run int not null default 10 check (max_new_per_run between 1 and 20),
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.ingest_sources_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An invalid pattern fails here, when it is saved, not in the nightly job.
  perform 'probe' ~ new.link_pattern;
  return new;
end;
$$;

revoke execute on function public.ingest_sources_check() from public, anon, authenticated;

create trigger ingest_sources_check before insert or update on public.ingest_sources
  for each row execute function public.ingest_sources_check();

create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null check (trigger in ('cron', 'manual')),
  mode text not null check (mode in ('dry', 'live')),
  stats jsonb not null default '{}'::jsonb,
  -- What was found, for the reviewer (titles, deadlines, quotes, outcomes).
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 200),
  error text check (error is null or char_length(error) <= 500)
);

create index ingest_runs_started_idx on public.ingest_runs (started_at desc);

create table public.ingest_pages (
  url_key text primary key,
  url text not null,
  source_id uuid references public.ingest_sources (id) on delete set null,
  outcome text not null check (outcome in ('inserted', 'updated', 'duplicate', 'not_opportunity', 'expired', 'low_quality', 'error', 'blocked')),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  checked_at timestamptz not null default now()
);

alter table public.ingest_sources enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.ingest_pages enable row level security;

create policy ingest_sources_admin on public.ingest_sources for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ingest_runs_admin_read on public.ingest_runs for select to authenticated using ((select public.is_admin()));
create policy ingest_pages_admin_read on public.ingest_pages for select to authenticated using ((select public.is_admin()));

revoke all on public.ingest_sources, public.ingest_runs, public.ingest_pages from anon, authenticated;
grant select, insert, update, delete on public.ingest_sources to authenticated;
grant select on public.ingest_runs, public.ingest_pages to authenticated;

-- Off until an admin has read a week of dry runs (plan, Phase 6).
insert into private.app_limits (key, value) values
  ('ingest_live', 0),
  ('ingest_max_pending', 300),
  ('ingest_max_inserts_per_run', 60)
on conflict (key) do nothing;

-- The job uses the cron secret (CRON_SECRET in Vercel).
insert into public.job_secrets (name, sha256)
select 'ingest', sha256 from public.job_secrets where name = 'reminders'
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 4. The job's functions (anon + secret)
-- ---------------------------------------------------------------------------

/** Starts a run: refuses overlapping runs, says whether it is live, lists the sources. */
create function public.ingest_begin(p_key text, p_trigger text, p_force_dry boolean default false)
returns table (run_id uuid, live boolean, sources jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_live boolean;
  new_id uuid;
begin
  if not public.job_secret_ok('ingest', p_key) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ingest:run', 0));
  if exists (select 1 from public.ingest_runs where finished_at is null and started_at > now() - interval '10 minutes')
     or exists (select 1 from public.ingest_runs where started_at > now() - interval '2 minutes') then
    raise exception 'a run is in progress' using errcode = 'P0001', hint = 'busy';
  end if;
  is_live := not p_force_dry and coalesce((select value from private.app_limits where key = 'ingest_live'), 0) = 1;
  insert into public.ingest_runs (trigger, mode) values (p_trigger, case when is_live then 'live' else 'dry' end)
  returning id into new_id;
  return query
    select new_id, is_live, coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'listing_url', s.listing_url, 'link_pattern', s.link_pattern,
                                          'kind_hint', s.kind_hint, 'max_new_per_run', s.max_new_per_run) order by s.created_at)
      from public.ingest_sources s where s.enabled), '[]'::jsonb);
end;
$$;

/** Of these URLs, the ones the job need not open again: in the catalogue, or checked in the last 30 days. */
create function public.ingest_seen(p_key text, p_urls text[])
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.job_secret_ok('ingest', p_key) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if coalesce(array_length(p_urls, 1), 0) > 500 then
    raise exception 'too many urls' using errcode = '22023';
  end if;
  return query
    select u from unnest(p_urls) as u
    where exists (select 1 from public.opportunities o where o.source_key = public.url_key(u))
       or exists (select 1 from public.ingest_pages p where p.url_key = public.url_key(u) and p.checked_at > now() - interval '30 days');
end;
$$;

/** Remembers a page that produced nothing for the catalogue. */
create function public.ingest_mark_page(p_key text, p_source uuid, p_url text, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.job_secret_ok('ingest', p_key) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_outcome not in ('not_opportunity', 'expired', 'low_quality', 'error', 'blocked') then
    raise exception 'bad outcome' using errcode = '22023';
  end if;
  insert into public.ingest_pages (url_key, url, source_id, outcome)
  values (public.url_key(p_url), left(p_url, 1000), p_source, p_outcome)
  on conflict (url_key) do update set outcome = excluded.outcome, checked_at = now(), source_id = excluded.source_id;
end;
$$;

/**
 * Adds a find to the review queue, or refreshes one: an untouched pending
 * row is replaced; a reviewed or published one only gets a later deadline
 * (next year's edition of the same page); a rejected one stays rejected.
 * Returns the outcome. Only in live mode, within the queue's limits.
 */
create function public.ingest_submit(p_key text, p_run uuid, p_source uuid, p_item jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_mode text;
  v_key text := public.url_key(p_item->>'source_url');
  existing public.opportunities%rowtype;
  new_deadline date := nullif(p_item->>'deadline', '')::date;
  inserted_in_run int;
  new_id uuid;
  outcome text;
begin
  if not public.job_secret_ok('ingest', p_key) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select mode into run_mode from public.ingest_runs where id = p_run and finished_at is null;
  if run_mode is distinct from 'live' then
    raise exception 'not a live run' using errcode = '42501';
  end if;
  if v_key is null then
    raise exception 'source_url required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ingest:submit', 0));
  select * into existing from public.opportunities where source_key = v_key;

  if found then
    if existing.status = 'rejected' then
      outcome := 'duplicate';
    elsif existing.status = 'pending' and existing.reviewed_at is null then
      update public.opportunities set
        kind = p_item->>'kind', title = p_item->>'title', description = coalesce(p_item->>'description', ''),
        link = p_item->>'link', deadline = new_deadline,
        subject = p_item->>'subject', level = p_item->>'level', type = p_item->>'type', age_group = p_item->>'age_group',
        format = p_item->>'format', duration = p_item->>'duration', city = p_item->>'city', field = p_item->>'field',
        requirements = p_item->>'requirements', grant_available = (p_item->>'grant_available')::boolean,
        title_kk = p_item->>'title_kk', title_en = p_item->>'title_en',
        description_kk = p_item->>'description_kk', description_en = p_item->>'description_en',
        source_name = p_item->>'source_name', extraction_confidence = (p_item->>'confidence')::real,
        evidence = p_item->>'evidence', ingested_at = now()
      where id = existing.id;
      outcome := 'updated';
    elsif new_deadline is not null and (existing.deadline is null or new_deadline > existing.deadline) then
      update public.opportunities set deadline = new_deadline, evidence = p_item->>'evidence', ingested_at = now()
      where id = existing.id;
      outcome := 'updated';
    else
      outcome := 'duplicate';
    end if;
    new_id := existing.id;
  else
    if (select count(*) from public.opportunities where status = 'pending')
       >= (select value from private.app_limits where key = 'ingest_max_pending') then
      raise exception 'review queue is full' using errcode = 'P0001', hint = 'queue_full';
    end if;
    select count(*) into inserted_in_run from public.ingest_pages p
      where p.outcome = 'inserted' and p.checked_at >= (select started_at from public.ingest_runs where id = p_run);
    if inserted_in_run >= (select value from private.app_limits where key = 'ingest_max_inserts_per_run') then
      raise exception 'run insert limit reached' using errcode = 'P0001', hint = 'run_limit';
    end if;
    insert into public.opportunities (
      kind, status, title, description, link, deadline,
      subject, level, type, age_group, format, duration, city, field, requirements, grant_available,
      title_kk, title_en, description_kk, description_en,
      source_url, source_name, extraction_confidence, evidence, ingested_at
    ) values (
      p_item->>'kind', 'pending', p_item->>'title', coalesce(p_item->>'description', ''), p_item->>'link', new_deadline,
      p_item->>'subject', p_item->>'level', p_item->>'type', p_item->>'age_group', p_item->>'format', p_item->>'duration',
      p_item->>'city', p_item->>'field', p_item->>'requirements', (p_item->>'grant_available')::boolean,
      p_item->>'title_kk', p_item->>'title_en', p_item->>'description_kk', p_item->>'description_en',
      p_item->>'source_url', p_item->>'source_name', (p_item->>'confidence')::real, p_item->>'evidence', now()
    ) returning id into new_id;
    outcome := 'inserted';
  end if;

  insert into public.ingest_pages (url_key, url, source_id, outcome, opportunity_id)
  values (v_key, left(p_item->>'source_url', 1000), p_source, outcome, new_id)
  on conflict (url_key) do update set outcome = excluded.outcome, opportunity_id = excluded.opportunity_id, checked_at = now();
  return outcome;
end;
$$;

create function public.ingest_finish(p_key text, p_run uuid, p_stats jsonb, p_items jsonb, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.job_secret_ok('ingest', p_key) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  update public.ingest_runs
     set finished_at = now(),
         stats = coalesce(p_stats, '{}'::jsonb),
         items = case when jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) <= 200 then p_items else '[]'::jsonb end,
         error = left(p_error, 500)
   where id = p_run and finished_at is null;
  update public.ingest_sources set last_run_at = now() where enabled;
end;
$$;

revoke execute on function public.ingest_begin(text, text, boolean), public.ingest_seen(text, text[]),
  public.ingest_mark_page(text, uuid, text, text), public.ingest_submit(text, uuid, uuid, jsonb),
  public.ingest_finish(text, uuid, jsonb, jsonb, text) from public;
grant execute on function public.ingest_begin(text, text, boolean), public.ingest_seen(text, text[]),
  public.ingest_mark_page(text, uuid, text, text), public.ingest_submit(text, uuid, uuid, jsonb),
  public.ingest_finish(text, uuid, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.url_key(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin functions
-- ---------------------------------------------------------------------------
create function public.admin_ingest_settings()
returns table (live boolean, pending int, max_pending int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query select
    coalesce((select value from private.app_limits where key = 'ingest_live'), 0) = 1,
    (select count(*)::int from public.opportunities where status = 'pending'),
    (select value::int from private.app_limits where key = 'ingest_max_pending');
end;
$$;

create function public.admin_set_ingest_live(p_live boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update private.app_limits set value = case when p_live then 1 else 0 end where key = 'ingest_live';
end;
$$;

/** Catalogue items whose titles look like this one's ("похоже на …"). */
create function public.admin_similar_opportunities(p_id uuid)
returns table (id uuid, slug text, title text, status text, score real)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select o.id, o.slug, o.title, o.status, extensions.similarity(o.title, t.title)
    from public.opportunities o, public.opportunities t
    where t.id = p_id and o.id <> p_id and o.status <> 'rejected'
      and extensions.similarity(o.title, t.title) > 0.4
    order by 5 desc
    limit 3;
end;
$$;

revoke execute on function public.admin_ingest_settings(), public.admin_set_ingest_live(boolean), public.admin_similar_opportunities(uuid) from public, anon;
grant execute on function public.admin_ingest_settings(), public.admin_set_ingest_live(boolean), public.admin_similar_opportunities(uuid) to authenticated;

-- The first source: РНПЦ «Дарын», the republic's olympiad centre. Its
-- contest pages share one address shape (daryn.kz/<name>-ru/) and its
-- robots.txt allows them.
insert into public.ingest_sources (name, listing_url, link_pattern, kind_hint, max_new_per_run)
values ('РНПЦ «Дарын»', 'https://daryn.kz/', '^https://daryn\.kz/[a-z0-9-]+-ru/?$', 'olympiads', 10);
