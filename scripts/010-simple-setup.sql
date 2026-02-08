-- Simple database setup without RLS complexities
-- Creates tables with proper columns

-- Create olympiads table
CREATE TABLE IF NOT EXISTS olympiads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  image_url TEXT,
  deadline TEXT,
  age_group TEXT,
  type TEXT,
  duration TEXT,
  subject TEXT,
  level TEXT,
  format TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  image_url TEXT,
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
  image_url TEXT,
  deadline TEXT,
  type TEXT,
  age_group TEXT,
  level TEXT,
  subject TEXT,
  location TEXT,
  duration TEXT,
  format TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create universities table
CREATE TABLE IF NOT EXISTS universities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  image_url TEXT,
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
  requirements TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE olympiads ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteering ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

-- Create simple policies for public access
CREATE POLICY IF NOT EXISTS "public_read_olympiads" ON olympiads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "public_insert_olympiads" ON olympiads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "public_delete_olympiads" ON olympiads FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY IF NOT EXISTS "public_read_competitions" ON competitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "public_insert_competitions" ON competitions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "public_delete_competitions" ON competitions FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY IF NOT EXISTS "public_read_volunteering" ON volunteering FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "public_insert_volunteering" ON volunteering FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "public_delete_volunteering" ON volunteering FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY IF NOT EXISTS "public_read_universities" ON universities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "public_insert_universities" ON universities FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "public_delete_universities" ON universities FOR DELETE TO anon, authenticated USING (true);
