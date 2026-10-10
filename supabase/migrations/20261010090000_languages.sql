-- Phase 7: the catalogue in three languages.
--
-- 1. Search also looks in the Kazakh and English title and description, so
--    "физика", "physics" and "физика" in a Kazakh sentence all find a row.
-- 2. The items entered before the nightly search existed get their Kazakh
--    and English text (the nightly search writes it for new ones), plus two
--    obvious fixes: a lost first letter and lower-case names.

create or replace function public.opportunity_matches(
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
    -- every search word must match the text (in any of the three languages)
    -- or one of its label-resolved values
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_search, '[]'::jsonb)) as tok(value)
      where not (
        strpos(
          public.search_normalize(concat_ws(' ', o.title, o.description, o.title_kk, o.description_kk, o.title_en, o.description_en)),
          public.search_normalize(tok.value ->> 't')
        ) > 0
        or exists (
          select 1
          from jsonb_each(coalesce(tok.value -> 'f', '{}'::jsonb)) as m(key, val)
          where coalesce(public.opportunity_field(o, m.key) = any (public.opportunity_filter_values(m.val)), false)
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- The items from before the nightly search
-- ---------------------------------------------------------------------------
update public.opportunities set
  title = 'Astana Jastary',
  description = 'К' || description,
  title_kk = 'Astana Jastary',
  title_en = 'Astana Jastary',
  description_kk = 'Астана қаласы әкімдігінің «Astana Jastary» жастар ресурстық орталығы 2014 жылғы 7 ақпанда өңірлік деңгейде жастар саясатын іске асыру үшін құрылған. Орталық 14 пен 35 жас аралығындағы жастармен жұмыс істейді. Негізгі бағыттары: жұмысқа орналасу және кәсіптік бағдар беру; құқықтық көмек; аула клубтарын дамыту; волонтерлік қозғалысты дамыту; жастардың бастамаларын қолдау; NEET санатындағы жастармен жұмыс (Жастарға қызмет көрсету орталығы).',
  description_en = 'Astana Jastary is the youth resource centre of the Astana city administration, founded on 7 February 2014 to carry out youth policy in the region. It works with young people aged 14 to 35. Its main areas: employment and career guidance; legal help; neighbourhood youth clubs; developing the volunteer movement; supporting youth initiatives; and work with young people not in education, employment or training (the Youth Service Centre).'
where slug = 'astana-jastary-b35d02' and description like 'оммунальное%';

update public.opportunities set
  title = 'Infomatrix',
  title_kk = 'Infomatrix',
  title_en = 'Infomatrix',
  description_kk = 'Infomatrix (Infomatrix Asia) — оқушылар мен студенттерге арналған компьютерлік жобалардың беделді халықаралық байқауы. Ол IT, ғылым және цифрлық өнер саласындағы таланттарды дамытуға бағытталған. Бағыттары: жасанды интеллект (AI Programming/Hackathon), робототехника (Hardware Control), компьютерлік өнер (Computer Art), қысқаметражды фильм, қолданбалы ғылымдар және стартап-жобалар. Жеңімпаздар жүлделер, соның ішінде университетте оқуға гранттар алады (мысалы, SDU University). Байқау көбіне халықаралық білім беру мекемелерінде өтеді және жас өнертапқыштар үшін ауқымды алаң болып табылады.',
  description_en = 'Infomatrix (also Infomatrix Asia) is a prestigious international competition of computer projects for school and university students, aimed at developing talent in IT, science and digital art. Categories include artificial intelligence (AI Programming/Hackathon), robotics (Hardware Control), Computer Art, short film, applied sciences and startup projects. Winners receive prizes, including university study grants (for example at SDU University). The competition is often held at international educational institutions and is a large stage for young inventors.'
where slug = 'infomatrix-2a0907';

update public.opportunities set
  title = 'Nazarbayev University',
  title_kk = 'Назарбаев Университеті',
  title_en = 'Nazarbayev University',
  description_kk = 'Назарбаев Университеті (НУ) — Астанадағы жетекші автономды зерттеу университеті, 2010 жылы құрылған, оқыту толығымен ағылшын тілінде жүреді. Университет меритократия, академиялық еркіндік және әлемдік деңгейдегі ЖОО-лармен серіктестік қағидаттарына сүйенеді. Құрамында 7 мектеп бар: инженерия және цифрлық ғылымдар; жаратылыстану, гуманитарлық және әлеуметтік ғылымдар; бизнес; мемлекеттік басқару; білім беру; медицина; тау-кен ісі, сондай-ақ дайындық мектебі. Оқуға түсу лайықтылық қағидатына негізделген. НУ Орталық Азиядағы үздік университеттердің қатарында, Кембридж университеті, Дьюк университеті және Сингапур ұлттық университеті сияқты жетекші ЖОО-лармен серіктес.',
  description_en = 'Nazarbayev University (NU) is a leading autonomous research university in Astana, founded in 2010, with all teaching in English. It is built on meritocracy, academic freedom and partnerships with world-class universities. It has seven schools — engineering and digital sciences; sciences and humanities; business; public policy; education; medicine; mining — and a foundation school. Admission is merit-based. NU is among the best universities in Central Asia, ranks highly among young universities in Times Higher Education, and partners with Cambridge, Duke and the National University of Singapore.'
where slug = 'nazarbayev-university-08558f';

update public.opportunities set
  title_kk = '«Дарын» РҒПО',
  title_en = 'Daryn Republican Research and Practical Centre',
  description_kk = '«Дарын» республикалық ғылыми-практикалық орталығы — ҚР Оқу-ағарту министрлігінің дарынды балалар мен талантты жастарды анықтау, қолдау және дамыту жөніндегі жетекші мемлекеттік ұйымы. Орталық республикалық пән олимпиадаларын (соның ішінде ауыл мектептері үшін), «Зерде» сияқты ғылыми жобалар байқауларын өткізеді және халықаралық пән олимпиадаларына қатысатын ҚР құрама командасын жасақтайды. Daryn.kz сайтында ережелер мен іс-шаралар күнтізбесі жарияланады.',
  description_en = 'The Daryn Republican Research and Practical Centre is the leading state body of the Ministry of Education of Kazakhstan for finding, supporting and developing gifted children and talented young people. It runs the national subject olympiads (including ones for rural schools) and research project competitions such as Zerde, and forms Kazakhstan''s teams for international olympiads. Daryn.kz publishes the rules and the calendar of events.'
where slug = 'rnpts-daryn-642adc';

update public.opportunities set
  title = 'BIFest',
  title_kk = 'BIFest',
  title_en = 'BIFest',
  description_kk = 'Binom мектептерінде көп жылдан бері өтіп келе жатқан жарыс — идеялар мен стартаптар байқауы.',
  description_en = 'A competition held at Binom schools for many years: a contest of ideas and startups.'
where slug = 'bifest-985485';

update public.opportunities set
  title_kk = 'Samsung Solve for Tomorrow',
  title_en = 'Samsung Solve for Tomorrow',
  description_kk = 'Samsung Solve for Tomorrow — оқушылар мен студенттер өз өңірінің өзекті әлеуметтік және экологиялық мәселелерін шешу үшін STEM тәсілдерін (ғылым, технология, инженерия және математика) қолданатын жаһандық білім беру байқауы.',
  description_en = 'Samsung Solve for Tomorrow is a global education competition in which school and university students use STEM — science, technology, engineering and mathematics — to solve pressing social and environmental problems in their region.'
where slug = 'samsung-solve-for-tomorrow-6ea1fb';

-- ---------------------------------------------------------------------------
-- 3. Deadline reminders in the language the user turned them on in
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions
  add column locale text not null default 'ru' check (locale in ('ru', 'kz', 'en'));

drop function public.save_push_subscription(text, text, text);

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_locale text default 'ru')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  lang text := case when p_locale in ('ru', 'kz', 'en') then p_locale else 'ru' end;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('push:' || uid::text, 0));
  if (select count(*) from public.push_subscriptions where user_id = uid and endpoint <> p_endpoint) >= 5 then
    raise exception 'subscription limit reached' using errcode = '23514';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, locale)
  values (uid, p_endpoint, p_p256dh, p_auth, lang)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, locale = excluded.locale, created_at = now();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

drop function public.claim_due_reminders(text);

-- As before, plus each subscription's language and the title in it.
create function public.claim_due_reminders(p_key text)
returns table (
  endpoint text,
  p256dh text,
  auth text,
  opportunity_slug text,
  opportunity_title text,
  deadline date,
  days_left int,
  kind text,
  locale text
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
    select f.user_id, o.id as opportunity_id, o.slug, o.title, o.title_kk, o.title_en, o.deadline,
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
  select p.endpoint, p.p256dh, p.auth, d.slug,
         case p.locale
           when 'kz' then coalesce(nullif(btrim(d.title_kk), ''), d.title)
           when 'en' then coalesce(nullif(btrim(d.title_en), ''), d.title)
           else d.title
         end,
         d.deadline, d.left_days, d.reminder_kind, p.locale
  from claimed c
  join due d on d.user_id = c.user_id and d.opportunity_id = c.opportunity_id and d.reminder_kind = c.kind
  join public.push_subscriptions p on p.user_id = c.user_id;
end;
$$;

revoke execute on function public.claim_due_reminders(text) from public, authenticated;
grant execute on function public.claim_due_reminders(text) to anon;
