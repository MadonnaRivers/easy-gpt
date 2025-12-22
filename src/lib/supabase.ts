import { createClient } from '@supabase/supabase-js';

// Supabase connection string
const SUPABASE_URL = 'https://ytevegpwacefnvvuuqzw.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key'; // We'll need to get this or use service role

// Parse the connection string to get credentials
const connectionString = 'postgresql://postgres.ytevegpwacefnvvuuqzw:@Supabase2003@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

// Extract project ref from URL
const projectRef = 'ytevegpwacefnvvuuqzw';

// Create Supabase client
// Note: For direct PostgreSQL access, we might need to use the service role key
// For now, we'll use the REST API with anon key
export const supabase = createClient(
  `https://${projectRef}.supabase.co`,
  // You'll need to get your anon key from Supabase dashboard
  // For now, we'll create a service that uses the connection string directly
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZXZlZ3B3YWNlZm52dnV1cXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2MTI4MDAsImV4cCI6MjA1MDE4ODgwMH0.placeholder'
);

// Database types
export interface Conversation {
  id: string;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'bot';
  content: string;
  created_at: string;
}

