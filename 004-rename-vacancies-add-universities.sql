-- Rename vacancies table to competitions
ALTER TABLE IF EXISTS vacancies RENAME TO competitions;

-- Create universities table
CREATE TABLE IF NOT EXISTS universities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  deadline TEXT,
  city TEXT,
  country TEXT,
  field TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add filter columns to existing tables
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS level TEXT;

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS age_group TEXT;

ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS duration TEXT;

-- Enable RLS for universities
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access on universities" ON universities;
DROP POLICY IF EXISTS "Allow public insert access on universities" ON universities;
DROP POLICY IF EXISTS "Allow public delete access on universities" ON universities;

-- Create policies for universities
CREATE POLICY "Allow public read access on universities" ON universities FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on universities" ON universities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on universities" ON universities FOR DELETE USING (true);
