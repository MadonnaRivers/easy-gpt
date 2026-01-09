-- Add source column to messages table
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS source TEXT;

-- Create index for better performance (optional)
CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(source);

-- Verify column was added
SELECT 'Source column added to messages table!' as status;
