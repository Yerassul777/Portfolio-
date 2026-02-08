-- Add new fields for Kazakhstan-focused filters
-- Add format (online/offline/hybrid) to all tables
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS format TEXT;

-- Add requirements field to all tables
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS requirements TEXT;

-- Add grant_available for universities
ALTER TABLE universities ADD COLUMN IF NOT EXISTS grant_available TEXT;

-- Add rating/prestige level
ALTER TABLE universities ADD COLUMN IF NOT EXISTS rating TEXT;

-- Ensure city field exists in all tables (for Kazakhstan cities)
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS city TEXT;
