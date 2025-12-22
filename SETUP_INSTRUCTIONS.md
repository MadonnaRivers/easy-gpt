# ✅ Setup Instructions

## Step 1: ✅ .env File Created
The `.env` file has been created with your Supabase anon key.

## Step 2: Create Database Tables

You need to run the SQL script in Supabase:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to SQL Editor** (left sidebar)
4. **Click "New Query"**
5. **Copy and paste** the contents of `setup_database.sql`
6. **Click "Run"** (or press Ctrl+Enter)

The script will create:
- `conversations` table - stores conversation metadata
- `messages` table - stores individual messages
- Indexes for better performance
- Auto-update trigger for `updated_at` field

## Step 3: Verify Tables

After running the SQL:
1. Go to **Table Editor** in Supabase
2. You should see two tables: `conversations` and `messages`
3. Both tables should be empty (ready to use)

## Step 4: Restart Dev Server

After creating the tables, restart your dev server:

```bash
# Stop current server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

## ✅ That's It!

Now your chatbot will:
- ✅ Save all conversations to Supabase
- ✅ Load conversation history
- ✅ Allow continuing previous conversations
- ✅ Track all messages per conversation

## 🧪 Test It

1. Open `http://localhost:3000`
2. Send a message
3. Check Supabase → Table Editor → `conversations` and `messages`
4. You should see your data there!

## 📝 Quick SQL Reference

If you need to check tables manually:
```sql
-- View all conversations
SELECT * FROM conversations ORDER BY updated_at DESC;

-- View all messages
SELECT * FROM messages ORDER BY created_at ASC;

-- View messages for a specific conversation
SELECT * FROM messages WHERE conversation_id = 'your-conversation-id';
```

