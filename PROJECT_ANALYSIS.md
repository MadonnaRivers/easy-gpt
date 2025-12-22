# 📊 Easy GPT Project - Complete File Analysis

## 🏗️ Architecture Overview

This is a **React + TypeScript chatbot interface** that integrates with:
- **Supabase** (PostgreSQL database) for conversation/message persistence
- **N8N** (workflow automation) for AI chat processing via webhooks
- **Vite** as the build tool and dev server

---

## 📁 File Structure & Connections

### **Entry Point Flow**
```
index.html 
  → src/main.tsx (React entry point)
    → src/App.tsx (App wrapper)
      → src/chatbot_interface.tsx (Main UI component)
```

### **1. Entry Files**

#### `index.html`
- **Purpose**: HTML template that loads the React app
- **Connections**: 
  - Loads `/src/main.tsx` as module script
  - Contains `<div id="root">` where React mounts

#### `src/main.tsx`
- **Purpose**: React application entry point
- **Imports**: 
  - `App` component from `./App`
  - `index.css` for global styles
- **Function**: Creates React root and renders `<App />` in StrictMode

#### `src/App.tsx`
- **Purpose**: Simple wrapper component
- **Imports**: `ChatbotInterface` from `./chatbot_interface`
- **Function**: Renders the main chatbot component

---

### **2. Core Component**

#### `src/chatbot_interface.tsx` ⭐ **MAIN COMPONENT**
- **Purpose**: Complete chatbot UI with sidebar, chat history, and message handling
- **Key Features**:
  - Sidebar with conversation history
  - Chat message display
  - Input handling and sending
  - Integration with Supabase (database)
  - Integration with N8N (webhook API)

**State Management:**
- `messages`: Array of Message objects (user/bot)
- `chatHistory`: Array of conversation items for sidebar
- `currentConversationId`: Active conversation UUID
- `sessionId`: Unique session ID (stored in localStorage)
- `isLoading`: Loading state for API calls

**Key Functions:**
- `handleSend()`: Sends message to N8N webhook, saves to Supabase
- `loadConversation()`: Loads conversation history from database
- `handleNewChat()`: Creates new conversation
- `loadConversations()`: Fetches all conversations for sidebar

**External Dependencies:**
- `./lib/supabaseClient` → Database operations
- `lucide-react` → Icons
- N8N webhook via `/api/n8n` proxy

**API Integration:**
```typescript
N8N_WEBHOOK_URL = '/api/n8n'  // Proxied to N8N via Vite config
```

---

### **3. Database Layer**

#### `src/lib/supabaseClient.ts` ⭐ **DATABASE CLIENT**
- **Purpose**: Supabase client configuration and database service layer
- **Exports**:
  - `supabase`: Supabase client instance
  - `conversationService`: CRUD operations for conversations
  - `messageService`: CRUD operations for messages
  - TypeScript interfaces: `Conversation`, `Message`

**Configuration:**
- `SUPABASE_URL`: `https://ytevegpwacefnvvuuqzw.supabase.co`
- `SUPABASE_ANON_KEY`: From environment variable `VITE_SUPABASE_ANON_KEY`

**Services:**

**conversationService:**
- `createConversation(sessionId, title)` → Creates new conversation
- `getConversations(sessionId)` → Gets all conversations for a session
- `getConversation(conversationId)` → Gets single conversation
- `updateConversationTitle(conversationId, title)` → Updates title
- `deleteConversation(conversationId)` → Deletes conversation + messages

**messageService:**
- `addMessage(conversationId, role, content)` → Adds message to conversation
- `getMessages(conversationId)` → Gets all messages for a conversation

**Database Tables:**
- `conversations`: id, session_id, title, created_at, updated_at
- `messages`: id, conversation_id, role, content, created_at

#### `src/lib/supabase.ts`
- **Purpose**: Alternative/legacy Supabase client (appears unused)
- **Status**: Likely deprecated in favor of `supabaseClient.ts`

---

### **4. Styling**

#### `src/index.css`
- **Purpose**: Global CSS styles
- **Imports**: Tailwind CSS directives (`@tailwind base/components/utilities`)
- **Styles**: Global resets, font configuration, root container

#### `tailwind.config.js`
- **Purpose**: Tailwind CSS configuration
- **Content Paths**: `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`
- **Theme**: Default Tailwind theme (extended if needed)

#### `postcss.config.js`
- **Purpose**: PostCSS configuration for Tailwind
- **Plugins**: `tailwindcss`, `autoprefixer`

---

### **5. Build Configuration**

#### `vite.config.ts` ⭐ **BUILD CONFIG**
- **Purpose**: Vite build tool configuration
- **Key Settings**:
  - Port: `3000`
  - Auto-open browser: `true`
  - React plugin enabled

**Proxy Configuration:**
```typescript
'/api/n8n' → 'http://localhost:5678/webhook/e61a4f26-156f-4802-ae33-743399345186/chat'
```
- **Purpose**: Proxies frontend requests to N8N webhook (avoids CORS)
- **Rewrite**: Converts `/api/n8n` to N8N webhook path
- **CORS Headers**: Added automatically

#### `tsconfig.json`
- **Purpose**: TypeScript compiler configuration
- **Settings**: 
  - Target: ES2020
  - Module: ESNext
  - JSX: react-jsx
  - Strict mode enabled
  - Includes: `src` directory

#### `tsconfig.node.json`
- **Purpose**: TypeScript config for Node.js files (Vite config, etc.)

#### `package.json`
- **Purpose**: NPM dependencies and scripts
- **Dependencies**:
  - `react`, `react-dom`: UI framework
  - `@supabase/supabase-js`: Database client
  - `lucide-react`: Icons
- **DevDependencies**:
  - `vite`: Build tool
  - `@vitejs/plugin-react`: React plugin
  - `typescript`: Type checking
  - `tailwindcss`, `postcss`, `autoprefixer`: Styling
- **Scripts**:
  - `npm run dev`: Start dev server (port 3000)
  - `npm run build`: Production build
  - `npm run preview`: Preview production build

---

### **6. Database Setup**

#### `setup_database.sql`
- **Purpose**: SQL script to create database tables in Supabase
- **Creates**:
  - `conversations` table (UUID primary key, session_id, title, timestamps)
  - `messages` table (UUID primary key, conversation_id FK, role, content)
  - Indexes for performance
  - Trigger for auto-updating `updated_at` timestamp
  - Disables RLS (Row Level Security) for development

#### `check_tables.sql`
- **Purpose**: SQL script to verify tables exist (likely)

#### `safe_setup.sql`
- **Purpose**: Safe database setup script (likely with error handling)

---

### **7. Documentation Files**

#### `README.md`
- Quick start guide, commands, tech stack overview

#### `QUICK_SETUP.md`
- Step-by-step setup instructions (Supabase key, .env, database tables)

#### `SETUP_INSTRUCTIONS.md`
- Detailed setup guide with database table creation

#### `SUPABASE_SETUP.md`
- Supabase-specific configuration guide

#### `FIX_WEBHOOK.md`
- Troubleshooting guide for N8N webhook issues

#### `N8N_SETUP_GUIDE.md`
- N8N workflow setup instructions

#### `ACTIVATE_WORKFLOW.md`
- Guide to activating N8N workflows

#### `DEBUG_WORKFLOW.md`
- Debugging guide for N8N workflows

#### `SAFE_TO_RUN.md`
- Safety/security information

---

### **8. Other Files**

#### `.gitignore`
- Excludes: `node_modules/`, `.env`, `dist/`, build artifacts

#### `test-webhook.sh`
- Shell script to test N8N webhook (likely)

---

## 🔄 Data Flow

### **Message Sending Flow:**
```
User types message
  → handleSend() in chatbot_interface.tsx
    → Creates/uses conversationId (Supabase)
    → Saves user message to Supabase (messages table)
    → Sends POST to /api/n8n (Vite proxy)
      → Proxy forwards to N8N webhook
        → N8N processes with AI/workflow
          → Returns response
    → Receives bot response
    → Saves bot message to Supabase
    → Updates conversation updated_at
    → Displays message in UI
```

### **Conversation Loading Flow:**
```
Component mounts
  → loadConversations() called
    → conversationService.getConversations(sessionId)
      → Supabase query: SELECT * FROM conversations WHERE session_id = ?
    → Updates chatHistory state
    → Renders in sidebar

User clicks conversation
  → loadConversation(conversationId)
    → messageService.getMessages(conversationId)
      → Supabase query: SELECT * FROM messages WHERE conversation_id = ?
    → Formats messages
    → Updates messages state
    → Displays in chat area
```

### **New Chat Flow:**
```
User clicks "New Chat"
  → handleNewChat()
    → Clears messages state
    → Sets currentConversationId to null
    → Next message creates new conversation
```

---

## 🔌 External Integrations

### **1. Supabase (Database)**
- **URL**: `https://ytevegpwacefnvvuuqzw.supabase.co`
- **Auth**: Anon key from `.env` file (`VITE_SUPABASE_ANON_KEY`)
- **Tables**: `conversations`, `messages`
- **Used By**: `src/lib/supabaseClient.ts`

### **2. N8N (Workflow Automation)**
- **URL**: `http://localhost:5678`
- **Webhook Path**: `/webhook/e61a4f26-156f-4802-ae33-743399345186/chat`
- **Proxy**: Vite proxies `/api/n8n` → N8N webhook
- **Used By**: `src/chatbot_interface.tsx` → `handleSend()`

---

## 🎨 UI Components Structure

```
ChatbotInterface
├── Sidebar (left)
│   ├── New Chat button
│   ├── Search input
│   ├── Chat History list (from Supabase)
│   └── Footer (Settings, Help, Logout)
│
└── Main Chat Area (right)
    ├── Header (Menu toggle, Title, Actions)
    ├── Messages Container
    │   ├── Empty state (suggestion cards)
    │   └── Message list (user/bot bubbles)
    └── Input Area (text input + send button)
```

---

## 🔑 Key Environment Variables

Required in `.env` file:
```
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

---

## 📝 Summary

**Frontend**: React + TypeScript + Tailwind CSS  
**Database**: Supabase (PostgreSQL)  
**Backend API**: N8N webhook (workflow automation)  
**Build Tool**: Vite  
**State**: React hooks (useState, useEffect)  
**Persistence**: Supabase for conversations/messages  
**Session**: localStorage for session ID  

**Main Entry**: `index.html` → `main.tsx` → `App.tsx` → `chatbot_interface.tsx`  
**Database Layer**: `supabaseClient.ts` (conversationService, messageService)  
**API Proxy**: `vite.config.ts` (proxies `/api/n8n` to N8N)

---

## 🚀 Ready to Work!

All files are analyzed and connections mapped. The project is ready for development!

