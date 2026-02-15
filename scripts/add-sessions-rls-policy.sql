-- Add RLS policy for sessions table to allow all operations
-- This policy allows public access to INSERT, SELECT, UPDATE, and DELETE operations

CREATE POLICY "Allow all access to sessions"
ON public.sessions
FOR ALL
TO public
USING (true);
