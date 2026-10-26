-- Indexes for the foreign keys that had none (Supabase performance advisor,
-- 2026-10-26 audit). goal_steps.user_id matters most: its RLS policies filter
-- on it in every query. The others are checked whenever an opportunity, a
-- source or a plan is deleted or changed. The tables are small now; the
-- indexes keep it that way as they grow.

create index if not exists goal_steps_user_id_idx on public.goal_steps (user_id);
create index if not exists goal_steps_opportunity_id_idx on public.goal_steps (opportunity_id);
create index if not exists ingest_pages_opportunity_id_idx on public.ingest_pages (opportunity_id);
create index if not exists ingest_pages_source_id_idx on public.ingest_pages (source_id);
create index if not exists portfolio_entries_opportunity_id_idx on public.portfolio_entries (opportunity_id);
create index if not exists profiles_plan_idx on public.profiles (plan);
create index if not exists reminder_deliveries_opportunity_id_idx on public.reminder_deliveries (opportunity_id);
