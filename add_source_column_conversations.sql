-- Add source column to conversations table
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS source TEXT;

-- Create index for better performance (optional)
CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source);

-- Verify column was added
SELECT 'Source column added to conversations table!' as status;
