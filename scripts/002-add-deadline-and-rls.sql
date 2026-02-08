-- Add deadline column to all tables
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS deadline DATE;

-- Enable Row Level Security
ALTER TABLE olympiads ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteering ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access
CREATE POLICY "Allow public read access on olympiads" ON olympiads FOR SELECT USING (true);
CREATE POLICY "Allow public read access on vacancies" ON vacancies FOR SELECT USING (true);
CREATE POLICY "Allow public read access on volunteering" ON volunteering FOR SELECT USING (true);

-- Create policies to allow public insert access (for admin form)
CREATE POLICY "Allow public insert on olympiads" ON olympiads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on vacancies" ON vacancies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on volunteering" ON volunteering FOR INSERT WITH CHECK (true);

-- Create policies to allow public delete access (for admin)
CREATE POLICY "Allow public delete on olympiads" ON olympiads FOR DELETE USING (true);
CREATE POLICY "Allow public delete on vacancies" ON vacancies FOR DELETE USING (true);
CREATE POLICY "Allow public delete on volunteering" ON volunteering FOR DELETE USING (true);
