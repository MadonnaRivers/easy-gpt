import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// Extract project ref from your connection string: ytevegpwacefnvvuuqzw
const SUPABASE_URL = 'https://ytevegpwacefnvvuuqzw.supabase.co';

// Get your Supabase anon key from:
// Supabase Dashboard → Project Settings → API → anon/public key
// Add it to .env file as VITE_SUPABASE_ANON_KEY
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase anon key not found! Please add VITE_SUPABASE_ANON_KEY to your .env file');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database types
export interface Conversation {
  id?: string;
  session_id: string;
  title: string;
  employee_code?: string; // Employee code (string format)
  source?: string; // Source (string format)
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id?: string;
  conversation_id: string;
  role: 'user' | 'bot';
  content: string;
  source?: string; // Source (string format)
  created_at?: string;
}

export interface File {
  id?: string;
  filename: string;
  file_type: string;
  file_size: number;
  file_content?: string;
  uploaded_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FileHash {
  id?: string;
  data: string; // Hash value
  file_name: string; // File name
  created_at?: string;
  updated_at?: string;
}

export interface FileHash {
  id?: string;
  data: string; // Hash value
  file_name: string; // File name
  created_at?: string;
}

// Conversation operations
export const conversationService = {
  // Create a new conversation
  async createConversation(sessionId: string, title: string, employeeCode?: string, source?: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        session_id: sessionId,
        title: title,
        employee_code: employeeCode || null,
        source: source || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    return data;
  },

  // Get all conversations for a user (by session_id)
  async getConversations(sessionId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations').select('*')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }

    return data || [];
  },

  // Get a single conversation
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations').select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      console.error('Error fetching conversation:', error);
      return null;
    }

    return data;
  },

  // Update conversation title
  async updateConversationTitle(conversationId: string, title: string): Promise<boolean> {
    const { error } = await supabase
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      console.error('Error updating conversation:', error);
      return false;
    }

    return true;
  },

  // Delete a conversation
  async deleteConversation(conversationId: string): Promise<boolean> {
    // First delete all messages
    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    
    // Then delete the conversation
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }

    return true;
  },
};

// Message operations
export const messageService = {
  // Add a message to a conversation
  async addMessage(conversationId: string, role: 'user' | 'bot', content: string, source?: string): Promise<Message | null> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        source: source || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding message:', error);
      return null;
    }

    // Update conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  },

  // Get all messages for a conversation
  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    return data || [];
  },
};

// File operations
export const fileService = {
  // Check if files table exists
  async checkTableExists(): Promise<boolean> {
    const { error } = await supabase
      .from('files')
      .select('id')
      .limit(1);

    // If error is "table not found", return false
    if (error && (error.code === 'PGRST205' || error.message?.includes('Could not find the table'))) {
      return false;
    }
    
    return !error;
  },

  // Upload a file
  async uploadFile(
    filename: string,
    fileType: string,
    fileSize: number,
    fileContent: string,
    uploadedBy?: string
  ): Promise<File | null> {
    const { data, error } = await supabase
      .from('files')
      .insert({
        filename,
        file_type: fileType,
        file_size: fileSize,
        file_content: fileContent,
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single();

    if (error) {
      // Don't log errors if table doesn't exist (expected)
      if (error.code !== 'PGRST205' && !error.message?.includes('Could not find the table')) {
        console.error('Error uploading file:', error);
      }
      return null;
    }

    return data;
  },

  // Get all files
  async getFiles(): Promise<File[]> {
    const { data, error } = await supabase
      .from('files').select('*')
      .order('id', { ascending: false });

    if (error) {
      // Don't log errors if table doesn't exist (expected)
      if (error.code !== 'PGRST205' && !error.message?.includes('Could not find the table')) {
        console.error('Error fetching files:', error);
      }
      return [];
    }

    return data || [];
  },

  // Delete a file
  async deleteFile(fileId: string): Promise<boolean> {
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (error) {
      // Don't log errors if table doesn't exist (expected)
      if (error.code !== 'PGRST205' && !error.message?.includes('Could not find the table')) {
        console.error('Error deleting file:', error);
      }
      return false;
    }

    return true;
  },
};

// File Hash operations (for file_hash table)
export const fileHashService = {
  // Get all files from file_hash table
  async getFileHashes(): Promise<FileHash[]> {
    const { data, error } = await supabase
      .from('file_hash')
      .select('id, data, file_name')
      .order('id', { ascending: false });

    if (error) {
      // Don't log errors if table doesn't exist (expected)
      if (error.code !== 'PGRST205' && !error.message?.includes('Could not find the table')) {
        console.error('Error fetching file hashes:', error);
      }
      return [];
    }

    return data || [];
  },

  // Delete a file hash
  async deleteFileHash(fileHashId: string): Promise<boolean> {
    const { error } = await supabase
      .from('file_hash')
      .delete()
      .eq('id', fileHashId);

    if (error) {
      console.error('Error deleting file hash:', error);
      return false;
    }

    return true;
  },
};

