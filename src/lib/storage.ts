/**
 * Local storage for conversations and messages. File/fileHash services are no-op stubs.
 */

const CONVERSATIONS_KEY = 'chat_conversations';
const MESSAGES_KEY = 'chat_messages';

function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface Conversation {
  id?: string;
  session_id: string;
  title: string;
  employee_code?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id?: string;
  conversation_id: string;
  role: 'user' | 'bot';
  content: string;
  source?: string;
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
  data: string;
  file_name: string;
  created_at?: string;
}

function getConversationsStore(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setConversationsStore(convs: Conversation[]) {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convs));
}

function getMessagesStore(): Record<string, Message[]> {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setMessagesStore(store: Record<string, Message[]>) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(store));
}

export const conversationService = {
  async createConversation(
    sessionId: string,
    title: string,
    employeeCode?: string,
    source?: string
  ): Promise<Conversation | null> {
    const convs = getConversationsStore();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: genId(),
      session_id: sessionId,
      title,
      employee_code: employeeCode ?? undefined,
      source: source ?? undefined,
      created_at: now,
      updated_at: now,
    };
    convs.push(conversation);
    setConversationsStore(convs);
    return conversation;
  },

  /** All conversations for this employee (ChatGPT-style history per user). */
  async getConversationsForEmployee(employeeCode: string): Promise<Conversation[]> {
    const code = (employeeCode || '').trim();
    const convs = getConversationsStore();
    const filtered = convs.filter((c) => (c.employee_code || '').trim() === code);
    return filtered.sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });
  },

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const convs = getConversationsStore();
    return convs.find((c) => c.id === conversationId) ?? null;
  },

  async updateConversationTitle(conversationId: string, title: string): Promise<boolean> {
    const convs = getConversationsStore();
    const i = convs.findIndex((c) => c.id === conversationId);
    if (i === -1) return false;
    convs[i].title = title;
    convs[i].updated_at = new Date().toISOString();
    setConversationsStore(convs);
    return true;
  },

  async deleteConversation(conversationId: string): Promise<boolean> {
    const convs = getConversationsStore().filter((c) => c.id !== conversationId);
    const messages = getMessagesStore();
    delete messages[conversationId];
    setConversationsStore(convs);
    setMessagesStore(messages);
    return true;
  },
};

export const messageService = {
  async addMessage(
    conversationId: string,
    role: 'user' | 'bot',
    content: string,
    _source?: string
  ): Promise<Message | null> {
    const store = getMessagesStore();
    const list = store[conversationId] ?? [];
    const now = new Date().toISOString();
    const msg: Message = {
      id: genId(),
      conversation_id: conversationId,
      role,
      content,
      created_at: now,
    };
    list.push(msg);
    store[conversationId] = list;
    setMessagesStore(store);
    const convs = getConversationsStore();
    const c = convs.find((x) => x.id === conversationId);
    if (c) {
      c.updated_at = now;
      setConversationsStore(convs);
    }
    return msg;
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const store = getMessagesStore();
    const list = store[conversationId] ?? [];
    return list.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return aTime - bTime;
    });
  },
};

export const fileService = {
  async checkTableExists(): Promise<boolean> {
    return false;
  },
  async uploadFile(): Promise<File | null> {
    return null;
  },
  async getFiles(): Promise<File[]> {
    return [];
  },
  async deleteFile(): Promise<boolean> {
    return false;
  },
};

export const fileHashService = {
  async getFileHashes(): Promise<FileHash[]> {
    return [];
  },
  async deleteFileHash(_fileHashId?: string): Promise<boolean> {
    return true;
  },
};
