-- Anonymous visitors never need profiles or AI usage. RLS already returns no
-- rows to them; revoking SELECT also hides the tables from the anon API schema.
revoke select on public.profiles, public.ai_usage from anon;
