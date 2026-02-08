-- Add format column to olympiads table
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS format TEXT;

-- Add format column to volunteering table  
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS format TEXT;

-- Add duration column to volunteering table if it doesn't exist
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS duration TEXT;
