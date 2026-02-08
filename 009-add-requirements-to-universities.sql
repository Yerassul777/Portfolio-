-- Add requirements column to universities table
ALTER TABLE universities ADD COLUMN IF NOT EXISTS requirements TEXT;

-- Add image_url column to all tables for card backgrounds
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS image_url TEXT;
