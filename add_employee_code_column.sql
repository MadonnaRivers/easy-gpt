-- Add employee_code column to conversations table
-- Run this in Supabase Dashboard → SQL Editor

-- Option 1: TEXT (String) - Recommended for alphanumeric codes like "EMP001", "E1234"
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS employee_code TEXT;

-- Option 2: INTEGER (if you want numeric only codes like 1234, 5678)
-- Uncomment below and comment out the TEXT version above if you prefer INTEGER
-- ALTER TABLE conversations
-- ADD COLUMN IF NOT EXISTS employee_code INTEGER;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_employee_code ON conversations(employee_code);

-- Verify column was added
SELECT 'Employee code column added to conversations table!' as status;

