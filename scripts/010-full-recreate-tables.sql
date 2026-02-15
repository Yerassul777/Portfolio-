-- Full table setup: creates all 4 category tables with all columns, RLS, and policies.
-- Safe to run multiple times (IF NOT EXISTS everywhere).

-- ============================================
-- 1. OLYMPIADS
-- ============================================
CREATE TABLE IF NOT EXISTS olympiads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  deadline TEXT,
  image_url TEXT,
  subject TEXT,
  level TEXT,
  age_group TEXT,
  type TEXT,
  format TEXT,
  duration TEXT,
  city TEXT,
  requirements TEXT,
  rating TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE olympiads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on olympiads" ON olympiads;
DROP POLICY IF EXISTS "Allow public insert access on olympiads" ON olympiads;
DROP POLICY IF EXISTS "Allow public delete access on olympiads" ON olympiads;
DROP POLICY IF EXISTS "Allow public update access on olympiads" ON olympiads;

CREATE POLICY "Allow public read access on olympiads" ON olympiads FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on olympiads" ON olympiads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on olympiads" ON olympiads FOR DELETE USING (true);
CREATE POLICY "Allow public update access on olympiads" ON olympiads FOR UPDATE USING (true);

-- Ensure all columns exist (in case table was created earlier without some columns)
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS rating TEXT;

-- ============================================
-- 2. COMPETITIONS
-- ============================================
CREATE TABLE IF NOT EXISTS competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  deadline TEXT,
  image_url TEXT,
  subject TEXT,
  level TEXT,
  age_group TEXT,
  type TEXT,
  format TEXT,
  duration TEXT,
  city TEXT,
  requirements TEXT,
  rating TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on competitions" ON competitions;
DROP POLICY IF EXISTS "Allow public insert access on competitions" ON competitions;
DROP POLICY IF EXISTS "Allow public delete access on competitions" ON competitions;
DROP POLICY IF EXISTS "Allow public update access on competitions" ON competitions;

CREATE POLICY "Allow public read access on competitions" ON competitions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on competitions" ON competitions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on competitions" ON competitions FOR DELETE USING (true);
CREATE POLICY "Allow public update access on competitions" ON competitions FOR UPDATE USING (true);

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS rating TEXT;

-- ============================================
-- 3. VOLUNTEERING
-- ============================================
CREATE TABLE IF NOT EXISTS volunteering (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  deadline TEXT,
  image_url TEXT,
  subject TEXT,
  level TEXT,
  age_group TEXT,
  type TEXT,
  format TEXT,
  duration TEXT,
  city TEXT,
  location TEXT,
  requirements TEXT,
  rating TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE volunteering ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on volunteering" ON volunteering;
DROP POLICY IF EXISTS "Allow public insert access on volunteering" ON volunteering;
DROP POLICY IF EXISTS "Allow public delete access on volunteering" ON volunteering;
DROP POLICY IF EXISTS "Allow public update access on volunteering" ON volunteering;

CREATE POLICY "Allow public read access on volunteering" ON volunteering FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on volunteering" ON volunteering FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on volunteering" ON volunteering FOR DELETE USING (true);
CREATE POLICY "Allow public update access on volunteering" ON volunteering FOR UPDATE USING (true);

ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS rating TEXT;

-- ============================================
-- 4. UNIVERSITIES
-- ============================================
CREATE TABLE IF NOT EXISTS universities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  deadline TEXT,
  image_url TEXT,
  subject TEXT,
  level TEXT,
  age_group TEXT,
  type TEXT,
  format TEXT,
  duration TEXT,
  city TEXT,
  country TEXT,
  field TEXT,
  grant_available BOOLEAN DEFAULT false,
  requirements TEXT,
  rating TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on universities" ON universities;
DROP POLICY IF EXISTS "Allow public insert access on universities" ON universities;
DROP POLICY IF EXISTS "Allow public delete access on universities" ON universities;
DROP POLICY IF EXISTS "Allow public update access on universities" ON universities;

CREATE POLICY "Allow public read access on universities" ON universities FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on universities" ON universities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on universities" ON universities FOR DELETE USING (true);
CREATE POLICY "Allow public update access on universities" ON universities FOR UPDATE USING (true);

ALTER TABLE universities ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS field TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS rating TEXT;
