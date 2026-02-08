-- Complete database setup script
-- This script creates all necessary tables with all columns and RLS policies

-- Create olympiads table
CREATE TABLE IF NOT EXISTS olympiads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  deadline TEXT,
  age_group TEXT,
  type TEXT,
  duration TEXT,
  subject TEXT,
  level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  deadline TEXT,
  level TEXT,
  city TEXT,
  format TEXT,
  requirements TEXT,
  duration TEXT,
  subject TEXT,
  type TEXT,
  age_group TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create volunteering table
CREATE TABLE IF NOT EXISTS volunteering (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  deadline TEXT,
  type TEXT,
  age_group TEXT,
  level TEXT,
  subject TEXT,
  location TEXT,
  duration TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  grant_available BOOLEAN DEFAULT false,
  type TEXT,
  age_group TEXT,
  level TEXT,
  duration TEXT,
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE olympiads ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteering ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access on olympiads" ON olympiads;
DROP POLICY IF EXISTS "Allow public insert access on olympiads" ON olympiads;
DROP POLICY IF EXISTS "Allow public delete access on olympiads" ON olympiads;

DROP POLICY IF EXISTS "Allow public read access on competitions" ON competitions;
DROP POLICY IF EXISTS "Allow public insert access on competitions" ON competitions;
DROP POLICY IF EXISTS "Allow public delete access on competitions" ON competitions;

DROP POLICY IF EXISTS "Allow public read access on volunteering" ON volunteering;
DROP POLICY IF EXISTS "Allow public insert access on volunteering" ON volunteering;
DROP POLICY IF EXISTS "Allow public delete access on volunteering" ON volunteering;

DROP POLICY IF EXISTS "Allow public read access on universities" ON universities;
DROP POLICY IF EXISTS "Allow public insert access on universities" ON universities;
DROP POLICY IF EXISTS "Allow public delete access on universities" ON universities;

-- Create policies for olympiads
CREATE POLICY "Allow public read access on olympiads" ON olympiads FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on olympiads" ON olympiads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on olympiads" ON olympiads FOR DELETE USING (true);

-- Create policies for competitions
CREATE POLICY "Allow public read access on competitions" ON competitions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on competitions" ON competitions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on competitions" ON competitions FOR DELETE USING (true);

-- Create policies for volunteering
CREATE POLICY "Allow public read access on volunteering" ON volunteering FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on volunteering" ON volunteering FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on volunteering" ON volunteering FOR DELETE USING (true);

-- Create policies for universities
CREATE POLICY "Allow public read access on universities" ON universities FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on universities" ON universities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on universities" ON universities FOR DELETE USING (true);
