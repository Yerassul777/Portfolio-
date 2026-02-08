-- Fix missing columns for all tables

-- Add missing columns to olympiads
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS duration TEXT;

-- Add missing columns to competitions
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add missing columns to volunteering
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE volunteering ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add missing columns to universities
ALTER TABLE universities ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS subject TEXT;

-- Change grant_available from TEXT to BOOLEAN (drop and recreate)
ALTER TABLE universities DROP COLUMN IF EXISTS grant_available;
ALTER TABLE universities ADD COLUMN grant_available BOOLEAN DEFAULT false;
