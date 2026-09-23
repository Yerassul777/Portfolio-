-- Phase 0 — revoke anonymous write access.
--
-- Before this script, every table carried policies written as
--   FOR INSERT/UPDATE/DELETE ... USING (true)
-- with no TO clause, which applies to PUBLIC and therefore includes `anon`.
-- Anyone holding the (publicly shipped) anon key could insert, update and
-- delete rows straight through PostgREST, bypassing the application entirely.
--
-- ORDER MATTERS. Deploy the ADMIN_TOKEN build FIRST, then run this. The admin
-- API writes with the service-role key, which bypasses RLS, so it keeps
-- working — but only if that deploy already carries the token check.
--
-- Safe to re-run: it drops whatever policies exist and recreates exactly one.

do $$
declare
  target_table text;
  existing_policy record;
begin
  foreach target_table in array array['olympiads', 'competitions', 'volunteering', 'universities']
  loop
    -- Historical policy names differ across scripts 000-010, so drop by
    -- discovery rather than by guessing names.
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy %I on public.%I', existing_policy.policyname, target_table);
    end loop;

    execute format('alter table public.%I enable row level security', target_table);

    -- Reading the catalogue stays public. That is the product.
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      'read_public_' || target_table,
      target_table
    );

    -- Belt and braces: even if a policy is later written wrong, the role has
    -- no table-level grant to write with.
    execute format(
      'revoke insert, update, delete on public.%I from anon, authenticated',
      target_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Verification. Run these and read the output before considering step 2 done.
-- ---------------------------------------------------------------------------

-- 1. Exactly one policy per table, SELECT only, scoped to anon+authenticated.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('olympiads', 'competitions', 'volunteering', 'universities')
order by tablename;

-- 2. No write grants left for anon or authenticated. Expect zero rows.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('olympiads', 'competitions', 'volunteering', 'universities')
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by table_name, grantee;

-- 3. Behave like an anonymous visitor: reads work, writes are refused.
--    Run this block on its own; the INSERT must raise an error.
-- begin;
--   set local role anon;
--   select count(*) from public.olympiads;              -- expect the real count
--   insert into public.olympiads (title, description, link)
--     values ('rls test', 'rls test', 'https://example.com');  -- MUST fail
-- rollback;
