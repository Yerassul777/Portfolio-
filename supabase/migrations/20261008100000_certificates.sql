-- Phase 5, part B: a photo of the certificate on a portfolio entry, and the
-- scanner that reads one into the entry's fields.
--
-- Photos live in a private Storage bucket, one folder per user
-- (<user id>/<random id>.jpg). Only the owner can read, add or delete them;
-- the app shows them through short-lived signed URLs. The browser re-encodes
-- every photo before upload, which drops EXIF (GPS, camera, time).
--
-- Scanning sends the photo to OpenAI, so it has its own consent
-- (consents.kind 'certificate_scan', recorded when first used) and its own
-- daily allowance, separate from the assistant's messages.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

/** Photos a user may still add (100 in all). Security definer: a policy on storage.objects cannot count storage.objects itself under RLS. */
create function public.certificate_slots_left()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select 100 - count(*)::int
  from storage.objects
  where bucket_id = 'certificates'
    and (storage.foldername(name))[1] = (select auth.uid())::text
$$;

revoke execute on function public.certificate_slots_left() from public, anon;
grant execute on function public.certificate_slots_left() to authenticated;

create policy certificates_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy certificates_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$'
    and public.certificate_slots_left() > 0
  );

create policy certificates_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- The photo on a portfolio entry
-- ---------------------------------------------------------------------------
alter table public.portfolio_entries
  add column certificate_path text
    check (certificate_path is null or certificate_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$');

-- An entry can point only at a photo in its owner's own folder.
create function public.portfolio_certificate_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.certificate_path is not null and split_part(new.certificate_path, '/', 1) <> new.user_id::text then
    raise exception 'certificate belongs to another user' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.portfolio_certificate_guard() from public, anon, authenticated;

-- After portfolio_entries_before_write (alphabetical), which fixes user_id on update.
create trigger portfolio_entries_certificate_guard
  before insert or update of certificate_path, user_id on public.portfolio_entries
  for each row execute function public.portfolio_certificate_guard();

-- ---------------------------------------------------------------------------
-- Scanner allowance: per plan per day, and a site-wide daily ceiling
-- ---------------------------------------------------------------------------
alter table public.plans add column daily_scans int not null default 5 check (daily_scans >= 0);
update public.plans set daily_scans = 30 where id = 'pro';

alter table public.ai_usage
  add column scan_count int not null default 0,
  add column scan_recorded int not null default 0;

insert into private.app_limits (key, value) values ('scan_global_daily', 300)
on conflict (key) do nothing;

create function public.consume_certificate_scan()
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

  if (select coalesce(sum(scan_count), 0) from public.ai_usage where usage_date = today)
     >= (select value from private.app_limits where key = 'scan_global_daily') then
    raise exception 'scan budget exhausted' using errcode = 'P0001', hint = 'global_budget';
  end if;

  select pl.daily_scans into plan_limit
  from public.profiles pr
  join public.plans pl on pl.id = pr.plan
  where pr.id = uid;
  if plan_limit is null then
    select pl.daily_scans into plan_limit from public.plans pl where pl.id = 'free';
  end if;

  insert into public.ai_usage as u (user_id, usage_date, scan_count)
  values (uid, today, 1)
  on conflict (user_id, usage_date) do update
    set scan_count = u.scan_count + 1
    where u.scan_count < plan_limit
  returning u.scan_count into new_count;

  if new_count is null or new_count > plan_limit then
    return query select false, plan_limit, plan_limit;
  else
    return query select true, new_count, plan_limit;
  end if;
end;
$$;

revoke execute on function public.consume_certificate_scan() from public, anon;
grant execute on function public.consume_certificate_scan() to authenticated;

-- What a scan cost, once per scan and within realistic bounds.
create function public.record_scan_usage(p_input_tokens int, p_output_tokens int, p_cost_usd numeric)
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
     or p_output_tokens not between 0 and 1000
     or p_cost_usd not between 0 and 0.02 then
    raise exception 'invalid usage values' using errcode = '22023';
  end if;
  update public.ai_usage
     set input_tokens = input_tokens + p_input_tokens,
         output_tokens = output_tokens + p_output_tokens,
         cost_usd = cost_usd + p_cost_usd,
         scan_recorded = scan_recorded + 1
   where user_id = uid
     and usage_date = (now() at time zone 'Asia/Almaty')::date
     and scan_recorded < scan_count;
end;
$$;

revoke execute on function public.record_scan_usage(int, int, numeric) from public, anon;
grant execute on function public.record_scan_usage(int, int, numeric) to authenticated;
