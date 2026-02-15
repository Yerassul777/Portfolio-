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

CREATE POLICY "Allow public read olympiads" ON olympiads FOR SELECT USING (true);
CREATE POLICY "Allow public insert olympiads" ON olympiads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete olympiads" ON olympiads FOR DELETE USING (true);
CREATE POLICY "Allow public update olympiads" ON olympiads FOR UPDATE USING (true);
