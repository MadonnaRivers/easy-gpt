# 🚀 Quick Setup Guide

## Step 1: Get Your Supabase Anon Key

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **anon/public** key (it's a long JWT token)

## Step 2: Create .env File

Create a `.env` file in the project root:

```bash
cd /home/kartik-joshi/Desktop/bot
touch .env
```

Add this line:
```
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace `your-anon-key-here` with the key you copied.

## Step 3: Create Database Tables

Go to Supabase Dashboard → **SQL Editor** and run:

```sql
-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'bot')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Disable RLS for now (enable in production with proper policies)
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
```

## Step 4: Restart Dev Server

After creating `.env` file, restart the dev server:

```bash
# Stop current server (Ctrl+C)
npm run dev
```

## ✅ That's It!

Now your chatbot will:
- ✅ Save all conversations to Supabase
- ✅ Load conversation history from database
- ✅ Allow users to continue previous conversations
- ✅ Track messages per conversation

## 🧪 Test It

1. Send a message in the chat
2. Check Supabase Dashboard → **Table Editor** → `conversations` and `messages` tables
3. You should see your data there!

