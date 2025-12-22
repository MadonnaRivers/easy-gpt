-- Check existing tables and their structure
-- Run this FIRST to see what you already have

-- Check if tables exist and show their structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('conversations', 'messages')
ORDER BY table_name, ordinal_position;

-- Count rows in each table (if they exist)
SELECT 'conversations' as table_name, COUNT(*) as row_count 
FROM conversations
UNION ALL
SELECT 'messages' as table_name, COUNT(*) as row_count 
FROM messages;

