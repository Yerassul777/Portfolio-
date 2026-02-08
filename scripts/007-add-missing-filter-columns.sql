-- Add missing columns to olympiads table
ALTER TABLE olympiads
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add missing columns to volunteering table
ALTER TABLE volunteering
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add missing columns to universities table
ALTER TABLE universities
ADD COLUMN IF NOT EXISTS format TEXT;

-- Verify the columns were added
-- Run a quick test query to ensure the schema cache is updated
SELECT column_name FROM information_schema.columns WHERE table_name = 'olympiads' AND column_name = 'city';
SELECT column_name FROM information_schema.columns WHERE table_name = 'volunteering' AND column_name = 'city';
SELECT column_name FROM information_schema.columns WHERE table_name = 'universities' AND column_name = 'format';
