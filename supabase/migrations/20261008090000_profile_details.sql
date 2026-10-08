-- The profile a user fills in themselves (Portfolio → Profile): how to address
-- them, an avatar colour, and what helps the assistant pick opportunities
-- (grade, city, interests). All optional, all editable by the owner only.
--
-- The date of birth replaces the age buttons of the sign-up form. It is
-- written once: the assistant is closed under 13 (OpenAI's terms), and an age
-- that could be edited back and forth would close nothing. A mistake is fixed
-- by the project team, not by the user.

alter table public.profiles
  add column nickname text,
  add column grade text,
  add column city text,
  add column interests text,
  add column avatar_color smallint not null default 0,
  add column birth_date date,
  add column updated_at timestamptz;

alter table public.profiles
  add constraint profiles_nickname_format check (nickname is null or nickname ~ '^[^[:cntrl:][:space:]@]{2,32}$'),
  add constraint profiles_display_name_text check (display_name is null or display_name !~ '[[:cntrl:]]'),
  add constraint profiles_grade_known check (
    grade is null or grade in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'college', 'student', 'other')
  ),
  add constraint profiles_city_len check (city is null or (char_length(city) <= 60 and city !~ '[[:cntrl:]]')),
  add constraint profiles_interests_len check (interests is null or char_length(interests) <= 300),
  add constraint profiles_avatar_color_range check (avatar_color between 0 and 7),
  add constraint profiles_birth_date_range check (birth_date is null or birth_date >= date '1920-01-01');

-- Owners write these columns and nothing else: `plan` decides the AI quota and
-- stays out of reach (column privileges, not a trigger that could be forgotten).
grant update (display_name, nickname, grade, city, interests, avatar_color, birth_date) on public.profiles to authenticated;

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create function public.profiles_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null and new.birth_date > current_date then
    raise exception 'birth date is in the future' using errcode = '22023';
  end if;
  -- Set once by the user; the project team (no auth.uid()) can correct it.
  if old.birth_date is not null
     and new.birth_date is distinct from old.birth_date
     and (select auth.uid()) is not null then
    raise exception 'birth date is already set' using errcode = '42501', hint = 'birth_date_locked';
  end if;
  new.display_name := nullif(btrim(new.display_name), '');
  new.nickname := nullif(btrim(new.nickname), '');
  new.city := nullif(btrim(new.city), '');
  new.interests := nullif(btrim(new.interests), '');
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();
