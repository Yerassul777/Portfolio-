-- The API roles keep only what row level security governs.
--
-- Supabase grants anon and authenticated every table privilege by default;
-- the migrations revoked select/insert/update/delete where RLS should rule,
-- but TRUNCATE, TRIGGER and REFERENCES stayed on profiles, ai_usage and plans.
-- TRUNCATE is not subject to RLS: it empties a table whole. The REST API has
-- no way to send it, so nothing was exposed, but no API role needs any of
-- the three (found by the 2026-10-26 audit: as `authenticated`, TRUNCATE
-- profiles was allowed). Future tables start without them too.

revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
