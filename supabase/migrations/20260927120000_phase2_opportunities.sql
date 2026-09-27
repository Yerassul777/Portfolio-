-- Phase 2 — one catalogue table instead of four.
--
-- Runs as a single transaction: any failed check below aborts everything and
-- leaves the database exactly as it was.
--
-- The four old tables are not dropped or renamed. They stay readable, so the
-- previous deployment keeps working if the app is rolled back, and they are
-- the backup. Writes to them are revoked at the end, so they cannot drift
-- from the new table. They are dropped in a later migration.

-- ---------------------------------------------------------------------------
-- 1. Preflight gates: stop before creating anything if the data is not what
--    this migration assumes.
-- ---------------------------------------------------------------------------
do $$
declare
  dup_ids int;
  bad_uni_deadlines int;
  missing_titles int;
begin
  select count(*) into dup_ids from (
    select id from (
      select id from public.olympiads
      union all select id from public.competitions
      union all select id from public.volunteering
      union all select id from public.universities
    ) ids group by id having count(*) > 1
  ) dups;
  if dup_ids > 0 then
    raise exception 'preflight: the same id exists in more than one table';
  end if;

  -- universities.deadline is text; anything that is not a leading ISO date
  -- would become NULL. Refuse rather than silently drop a deadline.
  select count(*) into bad_uni_deadlines
  from public.universities
  where nullif(btrim(deadline::text), '') is not null
    and deadline::text !~ '^\d{4}-\d{2}-\d{2}';
  if bad_uni_deadlines > 0 then
    raise exception 'preflight: % universities.deadline value(s) are not ISO dates', bad_uni_deadlines;
  end if;

  select count(*) into missing_titles from (
    select title from public.olympiads
    union all select title from public.competitions
    union all select title from public.volunteering
    union all select title from public.universities
  ) t where nullif(btrim(title), '') is null;
  if missing_titles > 0 then
    raise exception 'preflight: % row(s) without a title', missing_titles;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

-- Latin slug from Russian or Kazakh text, for /o/<slug> links.
create function public.slugify(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        replace(replace(replace(replace(replace(replace(replace(replace(replace(
          lower(coalesce(input, '')),
          'щ', 'shch'), 'ж', 'zh'), 'х', 'kh'), 'ц', 'ts'), 'ч', 'ch'), 'ш', 'sh'),
          'ю', 'yu'), 'я', 'ya'), 'ё', 'e'),
        -- ъ and ь have no counterpart, so translate() drops them.
        'абвгдезийклмнопрстуфыэәғқңөұүһіъь',
        'abvgdeziiklmnoprstufyeagqnouuhi'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  );
$$;

-- A filter value from the API as a list: "x" and ["x", "y"] both work, and
-- null or [] mean "do not filter on this key".
create function public.opportunity_filter_values(value jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(value)
    when 'array' then nullif(array(select jsonb_array_elements_text(value)), '{}')
    when 'string' then array[value #>> '{}']
    when 'boolean' then array[value #>> '{}']
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The table
-- ---------------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('olympiads', 'competitions', 'volunteering', 'universities')),
  status text not null default 'published'
    check (status in ('pending', 'published', 'rejected', 'archived')),
  slug text not null unique,
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  link text,
  deadline date,
  image_url text,

  -- Filter columns. Allowed values live in FILTER_CONFIGS (lib/types.ts), the
  -- single source of truth for the UI, the admin form and the AI tool.
  subject text,
  level text,
  type text,
  age_group text,
  format text,
  duration text,
  city text,
  field text,
  requirements text,
  grant_available boolean,

  -- Everything the old tables held that has no column here, verbatim.
  legacy jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_listing_idx on public.opportunities (kind, status, created_at desc);

create function public.opportunities_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.slug is null then
    new.slug := coalesce(nullif(left(public.slugify(new.title), 60), ''), 'item')
                || '-' || left(replace(new.id::text, '-', ''), 6);
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger opportunities_before_write
  before insert or update on public.opportunities
  for each row execute function public.opportunities_before_write();

-- ---------------------------------------------------------------------------
-- 4. Copy the data, keeping every id and created_at. One statement per table
--    with every column named: the old tables differ in column order and in
--    the type of deadline, so nothing here may rely on column position.
--    Deadlines stored as timestamps become the calendar date in Almaty.
-- ---------------------------------------------------------------------------
do $$
declare
  old_table text;
  deadline_expr text;
begin
  foreach old_table in array array['olympiads', 'competitions', 'volunteering', 'universities']
  loop
    deadline_expr := case
      when (select data_type from information_schema.columns
            where table_schema = 'public' and table_name = old_table and column_name = 'deadline')
           = 'timestamp with time zone'
        then '(t.deadline at time zone ''Asia/Almaty'')::date'
      else 'left(nullif(btrim(t.deadline::text), ''''), 10)::date'
    end;

    execute format($sql$
      insert into public.opportunities (
        id, kind, status, title, description, link, deadline, image_url,
        subject, level, type, age_group, format, duration, city, field, requirements, grant_available,
        legacy, created_at
      )
      select
        t.id, %1$L, 'published', btrim(t.title), coalesce(t.description, ''), t.link, %2$s, t.image_url,
        t.subject, t.level, t.type, t.age_group, t.format, t.duration, t.city, t.field, t.requirements,
        t.grant_available,
        jsonb_strip_nulls(to_jsonb(t) - 'image_url') || jsonb_build_object('source_table', %1$L),
        coalesce(t.created_at, now())
      from public.%1$I t
    $sql$, old_table, deadline_expr);
  end loop;
end $$;

-- Only web links are rendered as links. Added after the copy and NOT VALID:
-- enforced for every new or edited row, while one legacy row whose link is
-- not a URL is kept as is until someone fixes it.
alter table public.opportunities
  add constraint opportunities_link_is_web
    check (link is null or link ~* '^https?://') not valid,
  add constraint opportunities_image_is_web_or_data
    check (image_url is null or image_url ~* '^(https?://|data:image/)') not valid;

-- ---------------------------------------------------------------------------
-- 5. Postflight gate: every old row arrived, under its own id and kind.
-- ---------------------------------------------------------------------------
do $$
declare
  missing int;
begin
  select count(*) into missing from (
    select 'olympiads' as kind, id from public.olympiads
    union all select 'competitions', id from public.competitions
    union all select 'volunteering', id from public.volunteering
    union all select 'universities', id from public.universities
  ) old
  where not exists (
    select 1 from public.opportunities o where o.id = old.id and o.kind = old.kind
  );
  if missing > 0 then
    raise exception 'postflight: % row(s) did not arrive in opportunities', missing;
  end if;

  if (select count(*) from public.opportunities) <>
     (select (select count(*) from public.olympiads) + (select count(*) from public.competitions)
           + (select count(*) from public.volunteering) + (select count(*) from public.universities)) then
    raise exception 'postflight: row count mismatch';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Access. Supabase grants everything on new tables by default, so start
--    from nothing and add back exactly what is needed.
-- ---------------------------------------------------------------------------
alter table public.opportunities enable row level security;

revoke all on public.opportunities from anon, authenticated;
grant select on public.opportunities to anon, authenticated;
grant insert, update, delete on public.opportunities to authenticated;

create policy opportunities_read_published on public.opportunities
  for select to anon, authenticated
  using (status = 'published');

-- Admins also see pending and rejected rows (the moderation queue).
create policy opportunities_admin_read_all on public.opportunities
  for select to authenticated
  using ((select public.is_admin()));

create policy opportunities_admin_insert on public.opportunities
  for insert to authenticated
  with check ((select public.is_admin()));

create policy opportunities_admin_update on public.opportunities
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy opportunities_admin_delete on public.opportunities
  for delete to authenticated
  using ((select public.is_admin()));

revoke execute on function public.opportunities_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Search. SECURITY INVOKER, so RLS applies exactly as for a direct read:
--    only published rows, whoever calls it.
-- ---------------------------------------------------------------------------
create function public.search_opportunities(
  p_kind text default null,
  p_filters jsonb default '{}'::jsonb,
  p_only_open boolean default false,
  p_limit int default 100,
  p_offset int default 0
)
returns setof public.opportunities
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  filters jsonb := coalesce(p_filters, '{}'::jsonb);
  unknown_key text;
begin
  if p_kind is not null and p_kind not in ('olympiads', 'competitions', 'volunteering', 'universities') then
    raise exception 'unknown kind: %', p_kind using errcode = '22023';
  end if;

  if jsonb_typeof(filters) <> 'object' then
    raise exception 'p_filters must be a JSON object' using errcode = '22023';
  end if;

  select k into unknown_key
  from jsonb_object_keys(filters) as k
  where k <> all (array['subject', 'level', 'type', 'age_group', 'format', 'duration',
                        'city', 'field', 'requirements', 'grant_available'])
  limit 1;
  if unknown_key is not null then
    raise exception 'unknown filter: %', unknown_key using errcode = '22023';
  end if;

  return query
  select o.*
  from public.opportunities o
  where o.status = 'published'
    and (p_kind is null or o.kind = p_kind)
    and (not p_only_open or o.deadline is null
         or o.deadline >= (now() at time zone 'Asia/Almaty')::date)
    and coalesce(o.subject = any (public.opportunity_filter_values(filters -> 'subject')), filters -> 'subject' is null or public.opportunity_filter_values(filters -> 'subject') is null)
    and coalesce(o.level = any (public.opportunity_filter_values(filters -> 'level')), filters -> 'level' is null or public.opportunity_filter_values(filters -> 'level') is null)
    and coalesce(o.type = any (public.opportunity_filter_values(filters -> 'type')), filters -> 'type' is null or public.opportunity_filter_values(filters -> 'type') is null)
    and coalesce(o.age_group = any (public.opportunity_filter_values(filters -> 'age_group')), filters -> 'age_group' is null or public.opportunity_filter_values(filters -> 'age_group') is null)
    and coalesce(o.format = any (public.opportunity_filter_values(filters -> 'format')), filters -> 'format' is null or public.opportunity_filter_values(filters -> 'format') is null)
    and coalesce(o.duration = any (public.opportunity_filter_values(filters -> 'duration')), filters -> 'duration' is null or public.opportunity_filter_values(filters -> 'duration') is null)
    and coalesce(o.city = any (public.opportunity_filter_values(filters -> 'city')), filters -> 'city' is null or public.opportunity_filter_values(filters -> 'city') is null)
    and coalesce(o.field = any (public.opportunity_filter_values(filters -> 'field')), filters -> 'field' is null or public.opportunity_filter_values(filters -> 'field') is null)
    and coalesce(o.requirements = any (public.opportunity_filter_values(filters -> 'requirements')), filters -> 'requirements' is null or public.opportunity_filter_values(filters -> 'requirements') is null)
    and coalesce(o.grant_available::text = any (public.opportunity_filter_values(filters -> 'grant_available')), filters -> 'grant_available' is null or public.opportunity_filter_values(filters -> 'grant_available') is null)
  order by o.created_at desc, o.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.search_opportunities(text, jsonb, boolean, int, int) from public;
grant execute on function public.search_opportunities(text, jsonb, boolean, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Freeze the old tables: still readable (rollback safety), no more writes.
-- ---------------------------------------------------------------------------
do $$
declare
  old_table text;
begin
  foreach old_table in array array['olympiads', 'competitions', 'volunteering', 'universities']
  loop
    execute format('drop policy if exists %I on public.%I', 'admin_insert_' || old_table, old_table);
    execute format('drop policy if exists %I on public.%I', 'admin_delete_' || old_table, old_table);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', old_table);
  end loop;
end $$;
