-- Last year's ENT pass score for a state grant, on a university's card
-- (Phase 7): "from 85 points in 2025". The lowest score that won a grant on
-- any of the university's programmes that year, from the published results of
-- the grant competition; a particular programme may need more. Entered by the
-- project team, never guessed: empty means the card shows nothing.
--
-- The student's own ENT score stays on their device (lib/ent.ts): the card
-- compares the two in the browser, and the score never reaches the server.

alter table public.opportunities
  add column pass_score smallint,
  add column pass_score_year smallint;

alter table public.opportunities
  -- Both or neither (spelled out: a check that comes out NULL passes).
  add constraint opportunities_pass_score check (
    (pass_score is null) = (pass_score_year is null)
    and (
      pass_score is null
      or (kind = 'universities' and pass_score between 0 and 140 and pass_score_year between 2015 and 2100)
    )
  );

comment on column public.opportunities.pass_score is
  'Lowest ENT score that won a state grant at this university in pass_score_year (0-140); universities only.';
comment on column public.opportunities.pass_score_year is
  'Year of pass_score; set together with it.';
