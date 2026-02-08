-- Add deadline column if it doesn't exist
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS deadline DATE;

-- Drop existing policies first
DROP POLICY IF EXISTS "Allow public read access on olympiads" ON olympiads;
DROP POLICY IF EXISTS "Allow public insert on olympiads" ON olympiads;
DROP POLICY IF EXISTS "Allow public delete on olympiads" ON olympiads;

DROP POLICY IF EXISTS "Allow public read access on vacancies" ON vacancies;
DROP POLICY IF EXISTS "Allow public insert on vacancies" ON vacancies;
DROP POLICY IF EXISTS "Allow public delete on vacancies" ON vacancies;

DROP POLICY IF EXISTS "Allow public read access on volunteering" ON volunteering;
DROP POLICY IF EXISTS "Allow public insert on volunteering" ON volunteering;
DROP POLICY IF EXISTS "Allow public delete on volunteering" ON volunteering;

-- Enable RLS on all tables
ALTER TABLE olympiads ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteering ENABLE ROW LEVEL SECURITY;

-- Create policies for olympiads
CREATE POLICY "Allow public read access on olympiads" ON olympiads FOR SELECT USING (true);
CREATE POLICY "Allow public insert on olympiads" ON olympiads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on olympiads" ON olympiads FOR DELETE USING (true);

-- Create policies for vacancies
CREATE POLICY "Allow public read access on vacancies" ON vacancies FOR SELECT USING (true);
CREATE POLICY "Allow public insert on vacancies" ON vacancies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on vacancies" ON vacancies FOR DELETE USING (true);

-- Create policies for volunteering
CREATE POLICY "Allow public read access on volunteering" ON volunteering FOR SELECT USING (true);
CREATE POLICY "Allow public insert on volunteering" ON volunteering FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on volunteering" ON volunteering FOR DELETE USING (true);
