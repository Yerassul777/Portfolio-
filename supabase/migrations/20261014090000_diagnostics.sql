-- Diagnostics: errors and launch timings from real devices (lib/diagnostics.ts).
--
-- Reports are anonymous: no user, no IP. The browser sends them to
-- app/api/diag, which limits how often one address may report and passes them
-- on with the cron secret; only that route can write here. Admins read them in
-- /admin/diagnostics. Kept for 30 days.

create table public.client_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('error', 'launch')),
  -- The deploy the page came from (short commit hash).
  build text check (char_length(build) <= 40),
  report jsonb not null check (pg_column_size(report) <= 8192)
);
create index client_reports_created_at on public.client_reports (created_at desc);

alter table public.client_reports enable row level security;
revoke all on public.client_reports from anon, authenticated;
grant select on public.client_reports to authenticated;
create policy "Admins read reports" on public.client_reports
  for select to authenticated using ((select public.is_admin()));

-- The route uses the cron secret (CRON_SECRET in Vercel).
insert into public.job_secrets (name, sha256)
select 'diagnostics', sha256 from public.job_secrets where name = 'reminders'
on conflict (name) do nothing;

/**
 * Stores a batch of reports (up to 20). A client stuck in a loop, or anyone
 * who got hold of the route, cannot fill the database: past 600 reports in
 * an hour the rest are dropped, and anything older than 30 days goes.
 */
create function public.diag_report(p_key text, p_build text, p_reports jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.job_secret_ok('diagnostics', p_key) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_reports) <> 'array' or jsonb_array_length(p_reports) > 20 then
    raise exception 'bad reports' using errcode = '22023';
  end if;
  if (select count(*) from public.client_reports where created_at > now() - interval '1 hour') >= 600 then
    return;
  end if;

  insert into public.client_reports (kind, build, report)
  select r ->> 'kind', left(p_build, 40), r -> 'report'
  from jsonb_array_elements(p_reports) as r
  where r ->> 'kind' in ('error', 'launch') and jsonb_typeof(r -> 'report') = 'object';

  delete from public.client_reports where created_at < now() - interval '30 days';
end;
$$;

revoke execute on function public.diag_report(text, text, jsonb) from public, authenticated;
grant execute on function public.diag_report(text, text, jsonb) to anon;
