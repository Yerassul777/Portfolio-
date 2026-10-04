-- Retire the four pre-Phase-2 catalogue tables and clean up the seed data.
--
-- The old tables were kept read-only as the rollback path to the Phase 1
-- deployment. Phase 3 and account sync have shipped on top of Phase 2 since,
-- so that rollback is no longer a real option, and every row lives on in
-- public.opportunities (same id; columns plus the `legacy` jsonb archive).
-- A JSON export of all five tables was taken before this ran.

-- ---------------------------------------------------------------------------
-- 1. Preflight: stop if any old row is not in opportunities.
-- ---------------------------------------------------------------------------
do $$
declare
  missing int;
begin
  select count(*) into missing from (
    select id from public.olympiads
    union all select id from public.competitions
    union all select id from public.volunteering
    union all select id from public.universities
  ) old
  where not exists (select 1 from public.opportunities o where o.id = old.id);

  if missing > 0 then
    raise exception 'preflight: % old row(s) are not in opportunities', missing;
  end if;
end $$;

drop table public.olympiads;
drop table public.competitions;
drop table public.volunteering;
drop table public.universities;

-- ---------------------------------------------------------------------------
-- 2. Seed-data fixes. Each update matches the old value too, so it never
--    overwrites something an admin has changed since.
-- ---------------------------------------------------------------------------

-- Free text instead of a link.
update public.opportunities set link = 'https://daryn.kz/'
where slug = 'rnpts-daryn-642adc' and link = 'source:%20Daryn.kz';

-- An image URL instead of a link; the festival has its own page.
update public.opportunities set link = 'https://binom.edu.kz/b-fest/'
where slug = 'bifest-985485' and link = 'https://binom.edu.kz/wp-content/uploads/2022/06/694461cc0dbc34d82.jpg';

-- A WebSphere portal URL with session state encoded in it; the root redirects there.
update public.opportunities set link = 'https://admissions.nu.edu.kz/'
where slug = 'nazarbayev-university-08558f' and link like 'https://admissions.nu.edu.kz/wps/portal/!ut/p/%';

-- Instagram share-tracking parameter.
update public.opportunities set link = 'https://www.instagram.com/astana_zhastary_volunteers/'
where slug = 'astana-jastary-b35d02' and link like 'https://www.instagram.com/astana_zhastary_volunteers?igsh=%';

-- ---------------------------------------------------------------------------
-- 3. Inline base64 images become static files (public/images/opportunities),
--    served from the CDN and cached, instead of 5-10 KB inside every HTML
--    page and its RSC payload. The image check now admits those site paths
--    and no longer admits data: URLs, so blobs cannot come back.
-- ---------------------------------------------------------------------------
alter table public.opportunities drop constraint opportunities_image_is_web_or_data;

update public.opportunities set image_url = '/images/opportunities/rnpts-daryn-642adc-90570c37eb.jpg'
where slug = 'rnpts-daryn-642adc' and image_url like 'data:image/%';
update public.opportunities set image_url = '/images/opportunities/infomatrix-2a0907-7e7585ee72.jpg'
where slug = 'infomatrix-2a0907' and image_url like 'data:image/%';
update public.opportunities set image_url = '/images/opportunities/astana-jastary-b35d02-193f7e5217.jpg'
where slug = 'astana-jastary-b35d02' and image_url like 'data:image/%';
update public.opportunities set image_url = '/images/opportunities/nazarbayev-university-08558f-b361701093.jpg'
where slug = 'nazarbayev-university-08558f' and image_url like 'data:image/%';

alter table public.opportunities
  add constraint opportunities_image_is_web_or_site_file
    check (image_url is null or image_url ~* '^(https?://|/images/opportunities/[a-z0-9._-]+$)');

-- ---------------------------------------------------------------------------
-- 4. Every row now passes both checks, so they hold for all rows, not only
--    new writes (they were added NOT VALID because of the rows fixed above).
-- ---------------------------------------------------------------------------
alter table public.opportunities validate constraint opportunities_link_is_web;
