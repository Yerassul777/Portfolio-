-- Phase 3 — server-side search, deadline sorting and counts for pagination.
--
-- Backward compatible: search_opportunities keeps every parameter it had and
-- only gains new ones with defaults, so the deployed app keeps working while
-- this migration is applied ahead of the new code.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Case-insensitive, and "ё" matches "е": Russian readers type either.
create function public.search_normalize(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(coalesce(input, '')), 'ё', 'е');
$$;

-- One filterable column as text, by name. Only the ten filter columns are
-- reachable, so a caller can never match against status, legacy or anything else.
create function public.opportunity_field(o public.opportunities, field text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case field
    when 'subject' then o.subject
    when 'level' then o.level
    when 'type' then o.type
    when 'age_group' then o.age_group
    when 'format' then o.format
    when 'duration' then o.duration
    when 'city' then o.city
    when 'field' then o.field
    when 'requirements' then o.requirements
    when 'grant_available' then o.grant_available::text
  end;
$$;

-- Rejects malformed input with a clear error instead of silently matching
-- everything or nothing.
--
-- p_search is the query split into words by the client:
--   [{"t": "алматы", "f": {"city": ["almaty"]}}, {"t": "физика", "f": {...}}]
-- Every word must match: either inside the title or description, or through
-- "f" — filter values whose human label contains the word. Labels live in the
-- app (FILTER_CONFIGS), so the client resolves them and the database only
-- compares codes.
create function public.opportunity_search_check(p_kind text, p_filters jsonb, p_search jsonb)
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

-- The one definition of "does this row match", shared by search and count so
-- a page and its total can never disagree.
create function public.opportunity_matches(
  o public.opportunities,
  p_kind text,
  p_filters jsonb,
  p_search jsonb,
  p_only_open boolean,
  p_today date
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (p_kind is null or o.kind = p_kind)
    and (not coalesce(p_only_open, false) or o.deadline is null or o.deadline >= p_today)
    -- every non-empty filter must contain the row's value (a NULL value fails)
    and not exists (
      select 1
      from jsonb_each(coalesce(p_filters, '{}'::jsonb)) as f(key, val)
      where public.opportunity_filter_values(f.val) is not null
        and not coalesce(public.opportunity_field(o, f.key) = any (public.opportunity_filter_values(f.val)), false)
    )
    -- every search word must match the text or one of its label-resolved values
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_search, '[]'::jsonb)) as tok(value)
      where not (
        strpos(public.search_normalize(o.title || ' ' || o.description), public.search_normalize(tok.value ->> 't')) > 0
        or exists (
          select 1
          from jsonb_each(coalesce(tok.value -> 'f', '{}'::jsonb)) as m(key, val)
          where coalesce(public.opportunity_field(o, m.key) = any (public.opportunity_filter_values(m.val)), false)
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Search: same name, superset of the old parameters.
-- ---------------------------------------------------------------------------
drop function public.search_opportunities(text, jsonb, boolean, int, int);

create function public.search_opportunities(
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
    -- "deadline": open ones by nearest deadline, then those without one, then
    -- past ones, most recently closed first. "newest" skips straight to created_at.
    case when p_sort = 'deadline' then
      case when o.deadline is null then 1 when o.deadline >= today then 0 else 2 end
    end,
    case when p_sort = 'deadline' and o.deadline >= today then o.deadline end asc,
    case when p_sort = 'deadline' and o.deadline < today then o.deadline end desc,
    o.created_at desc,
    o.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create function public.count_opportunities(
  p_kind text default null,
  p_filters jsonb default '{}'::jsonb,
  p_only_open boolean default false,
  p_search jsonb default null
)
returns int
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.opportunity_search_check(p_kind, p_filters, p_search);
  return (
    select count(*)::int
    from public.opportunities o
    where o.status = 'published'
      and public.opportunity_matches(o, p_kind, p_filters, p_search, p_only_open,
                                     (now() at time zone 'Asia/Almaty')::date)
  );
end;
$$;

-- Both run as the caller (RLS decides what they see), so the helpers they
-- call must be executable by the same roles. None of them reads any table.
revoke execute on function public.search_opportunities(text, jsonb, boolean, int, int, jsonb, text) from public;
revoke execute on function public.count_opportunities(text, jsonb, boolean, jsonb) from public;
grant execute on function public.search_opportunities(text, jsonb, boolean, int, int, jsonb, text) to anon, authenticated;
grant execute on function public.count_opportunities(text, jsonb, boolean, jsonb) to anon, authenticated;

create index opportunities_deadline_idx on public.opportunities (kind, status, deadline);
