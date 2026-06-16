import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Trash2, Moon, Sun, Search, X, Upload, FileText, History, CheckCircle, AlertCircle, Bot, User, Clock, Hash, Inbox, Sparkles, FileUp } from 'lucide-react';
import { conversationService, fileHashService, Conversation, Message, FileHash } from './lib/storage';

// Single combined webhook: returns one row per message, joined with its
// conversation + the salesperson name. We group it client-side into the
// conversation list and per-conversation messages (no separate messages call).
const CONVERSATIONS_WEBHOOK_URL = 'https://n8n.easyhomefinance.in/webhook/f5c7f525-6af7-47d4-b080-715892d350f6';

// File upload: always go same-origin via /api/upload to avoid CORS.
// In dev, Vite proxies it to n8n; in prod, server.mjs forwards it to n8n.
const FILE_UPLOAD_WEBHOOK_URL = '/api/upload';
// Client-side limit (MB). Server may have a lower limit (413 = Request Entity Too Large).
const MAX_UPLOAD_FILE_SIZE_MB = 25;

// One row of the combined query (conversations ⨝ messages ⨝ sales_team).
interface CombinedRow {
  conversation_id: string;
  employee_code?: string | null;
  name?: string | null;
  title?: string | null;
  conversation_created_at?: string | null;
  conversation_updated_at?: string | null;
  message_id?: string | null;
  role?: 'user' | 'bot' | null;
  content?: string | null;
  message_created_at?: string | null;
  message_source?: string | null;
}

// Webhooks may return an empty body (200 with no content). res.json() throws
// "Unexpected end of JSON input" on that, so parse the text defensively.
async function parseJsonResponse<T>(res: Response): Promise<T | []> {
  const text = await res.text();
  if (!text.trim()) return [];
  try {
    return JSON.parse(text) as T;
  } catch {
    return [];
  }
}

const Dashboard = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false;
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeCodeFilter, setEmployeeCodeFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'conversations' | 'upload'>('conversations');
  const [uploadedFiles, setUploadedFiles] = useState<FileHash[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Messages grouped by conversation_id, built from the combined webhook response.
  const messagesByConversation = useRef<Record<string, Message[]>>({});

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    if (viewMode === 'conversations') {
      loadConversations();
    } else {
      loadFiles();
    }
  }, [employeeCodeFilter, viewMode]);

  // Load files from Supabase file_hash table
  const loadFiles = async () => {
    try {
      setIsLoading(true);
      console.log('Loading files from file_hash table...');
      const files = await fileHashService.getFileHashes();
      console.log('Loaded files:', files);
      console.log('Number of files:', files.length);
      setUploadedFiles(files);
    } catch (error) {
      console.error('Error loading files:', error);
      setUploadedFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const getEmployeeCodeForWebhook = () => {
    const fromFilter = employeeCodeFilter.trim();
    if (fromFilter) return fromFilter;
    return localStorage.getItem('employee_code')?.trim() || '';
  };

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const url = new URL(CONVERSATIONS_WEBHOOK_URL);
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) throw new Error(`Failed to load conversations: ${res.status}`);
      const rows = await parseJsonResponse<CombinedRow[]>(res);
      const list = Array.isArray(rows) ? rows : [];

      // Collapse the message-level rows into unique conversations + grouped messages.
      const convMap = new Map<string, Conversation>();
      const msgMap: Record<string, Message[]> = {};

      for (const row of list) {
        const convId = row.conversation_id;
        if (!convId) continue;

        if (!convMap.has(convId)) {
          const name = (row.name || '').trim();
          const title = (row.title || '').trim();
          convMap.set(convId, {
            id: convId,
            session_id: '',
            title: name || title || 'New Chat',
            employee_code: row.employee_code || undefined,
            created_at: row.conversation_created_at || undefined,
            updated_at: row.conversation_updated_at || undefined,
          });
        }

        // A LEFT JOIN row with no message has a null message_id — skip those.
        if (row.message_id && row.role) {
          (msgMap[convId] ||= []).push({
            id: row.message_id,
            conversation_id: convId,
            role: row.role,
            content: row.content || '',
            source: row.message_source || undefined,
            created_at: row.message_created_at || undefined,
          });
        }
      }

      // Sort each conversation's messages oldest → newest.
      for (const convId of Object.keys(msgMap)) {
        msgMap[convId].sort(
          (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
      }
      messagesByConversation.current = msgMap;

      let conversations = Array.from(convMap.values());

      // Filter by employee_code if provided
      if (employeeCodeFilter.trim()) {
        conversations = conversations.filter(
          (c) => (c.employee_code || '').toString().trim() === employeeCodeFilter.trim()
        );
      }

      conversations.sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
      setConversations(conversations.slice(0, 100));
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Messages already arrived with the combined webhook; just read from the cache.
  const loadConversationMessages = (conversationId: string) => {
    setConversationMessages(messagesByConversation.current[conversationId] || []);
    const conv = conversations.find((c) => c.id === conversationId);
    setSelectedConversation(conv || null);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await conversationService.deleteConversation(conversationId);
      await loadConversations();
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setConversationMessages([]);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxBytes = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`File is too large. Maximum size is ${MAX_UPLOAD_FILE_SIZE_MB} MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`);
      return;
    }

    try {
      setIsUploading(true);

      // Create FormData to send file to webhook
      const formData = new FormData();
      const employeeCode = getEmployeeCodeForWebhook();
      formData.append('file', file);
      formData.append('filename', file.name);
      formData.append('fileType', file.type || 'application/octet-stream');
      formData.append('fileSize', file.size.toString());
      formData.append('uploadedBy', localStorage.getItem('chatbot_session_id') || 'unknown');
      if (employeeCode) {
        formData.append('employee_code', employeeCode);
      }

      // Send file to webhook
      const uploadUrl = new URL(FILE_UPLOAD_WEBHOOK_URL, window.location.origin);
      if (employeeCode) {
        uploadUrl.searchParams.set('employee_code', employeeCode);
      }
      const response = await fetch(uploadUrl.toString(), {
        method: 'POST',
        body: formData
      });

      // Get response text and parse it
      const responseText = await response.text();
      let responseData: unknown = null;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      // Store the webhook response and show modal
      setWebhookResponse(responseData);
      setShowResponseModal(true);

      // Check if response indicates duplicate file
      const isDuplicate =
        (responseData && typeof responseData === 'object' && (responseData as { status?: string }).status === 'duplicate') ||
        (Array.isArray(responseData) && (responseData[0] as { status?: string })?.status === 'duplicate') ||
        ((responseData as { json?: { status?: string } })?.json?.status === 'duplicate');

      if (isDuplicate) {
        return;
      }

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error(
            'File too large (413). The server has a size limit. Try a smaller file, or ask your admin to increase the server/proxy limit (e.g. nginx client_max_body_size).'
          );
        }
        throw new Error(`Upload failed: ${response.status} - ${JSON.stringify(responseData)}`);
      }

      // Reload files after successful upload
      await loadFiles();

      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 3000);
    } catch (error) {
      console.error('Error uploading file:', error);
      const err = error instanceof Error ? error.message : 'Unknown error occurred';
      const isCorsOrNetwork = err === 'Failed to fetch' || err.includes('Load failed');
      const message = isCorsOrNetwork
        ? 'Upload failed (network/CORS). Ensure the n8n server allows your origin and accepts the file size. Check the browser console for details.'
        : err;
      alert(`Error uploading file: ${message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileHashId: string) => {
    if (!confirm('Are you sure you want to remove this file from history?')) return;

    try {
      const success = await fileHashService.deleteFileHash(fileHashId);
      if (success) {
        await loadFiles(); // Reload from Supabase
      } else {
        alert('Failed to delete file. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file. Please try again.');
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'conversations' ? 'upload' : 'conversations');
  };

  return (
    <div
      className={`h-screen w-full overflow-hidden transition-colors ${
        isDarkMode
          ? 'bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-gray-100'
          : 'bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900'
      }`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-30 px-5 md:px-6 py-3.5 flex items-center justify-between backdrop-blur-xl transition-colors ${
          isDarkMode
            ? 'bg-gray-900/80 border-b border-white/10'
            : 'bg-white/80 border-b border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0" aria-label="Pragati AI Dashboard">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30">
            <Sparkles size={18} />
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="brand-title text-[16px] md:text-[19px] font-bold leading-none whitespace-nowrap tracking-tight">
              Pragati AI
            </h1>
            <span className={`h-5 w-px ${isDarkMode ? 'bg-white/15' : 'bg-gray-300'}`} />
            <span className={`text-xs md:text-sm font-semibold tracking-[0.12em] uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Dashboard
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Segmented view toggle */}
          <div className={`hidden sm:flex items-center gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-white/5 ring-1 ring-white/10' : 'bg-gray-100 ring-1 ring-gray-200'}`}>
            <button
              onClick={() => setViewMode('conversations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'conversations'
                  ? isDarkMode
                    ? 'bg-gray-700 text-white shadow'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDarkMode
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <History size={16} /> History
            </button>
            <button
              onClick={() => setViewMode('upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'upload'
                  ? isDarkMode
                    ? 'bg-gray-700 text-white shadow'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDarkMode
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Upload size={16} /> Upload
            </button>
          </div>

          {/* Mobile view toggle */}
          <button
            onClick={toggleViewMode}
            aria-label="Toggle view"
            className={`sm:hidden grid h-9 w-9 place-items-center rounded-xl border transition-colors ${
              isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {viewMode === 'conversations' ? <Upload size={18} /> : <History size={18} />}
          </button>

          <button
            onClick={toggleDarkMode}
            aria-label="Toggle theme"
            className={`grid h-9 w-9 place-items-center rounded-xl border transition-colors ${
              isDarkMode ? 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25 transition-all active:scale-95"
          >
            <MessageSquare size={17} />
            <span className="hidden sm:inline">Chat</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-65px)]">
        {/* Left Sidebar - Conversations List (hidden in upload mode) */}
        {viewMode === 'conversations' && (
        <aside className={`w-80 flex flex-col border-r transition-colors ${
          isDarkMode ? 'border-white/10 bg-gray-900/40' : 'border-gray-200 bg-white/60'
        }`}>
          {/* Header with Filter */}
          <div className={`p-4 border-b transition-colors ${
            isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Conversation History
              </div>
              <span className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold ${
                isDarkMode ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-600'
              }`}>
                {conversations.length}
              </span>
            </div>

            {/* Employee Code Filter */}
            <div className="relative">
              <Search
                size={16}
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}
              />
              <input
                type="text"
                value={employeeCodeFilter}
                onChange={(e) => setEmployeeCodeFilter(e.target.value)}
                placeholder="Search by name"
                className={`w-full pl-10 pr-8 py-2.5 rounded-xl text-sm border transition-all ${
                  isDarkMode
                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:bg-white/10'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white'
                } focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:border-transparent`}
              />
              {employeeCodeFilter && (
                <button
                  onClick={() => setEmployeeCodeFilter('')}
                  aria-label="Clear filter"
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-lg ${
                    isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                  }`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Conversations List */}
          <div className="overflow-y-auto flex-1">
            <div className="p-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-[60px] rounded-xl animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}
                    />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center text-center py-14 px-4">
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl mb-3 ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                    <MessageSquare size={22} />
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {employeeCodeFilter ? 'No matches found' : 'No conversations yet'}
                  </div>
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {employeeCodeFilter ? 'Try a different name' : 'Conversations will appear here'}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {conversations.map((conv) => {
                    const isActive = selectedConversation?.id === conv.id;
                    return (
                    <div
                      key={conv.id}
                      onClick={() => loadConversationMessages(conv.id!)}
                      className={`group relative p-3 pl-4 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? isDarkMode
                            ? 'bg-red-500/15 ring-1 ring-red-500/40'
                            : 'bg-red-50 ring-1 ring-red-200'
                          : isDarkMode
                            ? 'hover:bg-white/5'
                            : 'hover:bg-gray-100/70'
                      }`}
                    >
                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full transition-all ${
                        isActive ? 'bg-gradient-to-b from-red-500 to-rose-600' : 'bg-transparent'
                      }`} />
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${
                          isActive
                            ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
                            : isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <MessageSquare size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {conv.title}
                          </div>
                          <div className={`flex items-center flex-wrap gap-x-2 gap-y-1 text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {conv.employee_code && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                                <Hash size={10} />{conv.employee_code}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Clock size={10} />
                              {formatDate(conv.updated_at || conv.created_at || '')}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conv.id!);
                          }}
                          aria-label="Delete conversation"
                          className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all ${
                            isDarkMode ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>
        )}

        {/* Right Panel - Conversation Details or Upload Interface */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'upload' ? (
            /* Upload Document Interface */
            <div className="min-h-full flex flex-col">
              {/* Upload Section */}
              <div className="flex-1 flex items-center justify-center p-6 md:p-10">
                <div className="max-w-2xl w-full animate-fade-in-up">
                  <div className="text-center mb-8">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                      isDarkMode ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-600'
                    }`}>
                      <Sparkles size={13} /> Knowledge Base
                    </div>
                    <h2 className={`text-3xl font-bold mb-2 tracking-tight ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Upload your files
                    </h2>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Add documents to enrich your chatbot&apos;s knowledge base
                    </p>
                  </div>

                  {/* Upload Area */}
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`group relative overflow-hidden rounded-2xl p-12 text-center transition-all ${
                      isUploading
                        ? 'opacity-70 cursor-not-allowed'
                        : 'cursor-pointer hover:-translate-y-0.5'
                    } ${
                      isDarkMode
                        ? 'bg-white/5 ring-1 ring-dashed ring-white/15 hover:ring-red-500/60 hover:bg-white/[0.07]'
                        : 'bg-white ring-1 ring-dashed ring-gray-300 hover:ring-red-400 hover:shadow-lg hover:shadow-red-500/5'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <div className="flex flex-col items-center">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 ${
                        isUploading
                          ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
                          : isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-red-50 text-red-500'
                      }`}>
                        {isUploading
                          ? <Upload size={30} className="animate-bounce" />
                          : <FileUp size={30} />}
                      </div>
                      {isUploading ? (
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Uploading your document…
                        </p>
                      ) : (
                        <>
                          <p className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Click to browse files
                          </p>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            TXT, PDF, DOC, DOCX and more · up to {MAX_UPLOAD_FILE_SIZE_MB} MB
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* File History Section */}
              <div className={`border-t backdrop-blur-sm ${
                isDarkMode ? 'border-white/10 bg-gray-900/40' : 'border-gray-200 bg-white/60'
              }`}>
                <div className="p-6 max-w-3xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Upload History
                    </h3>
                    {uploadedFiles.length > 0 && (
                      <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {uploadedFiles.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-10">
                      <div className={`grid h-12 w-12 place-items-center rounded-2xl mb-3 ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                        <Inbox size={22} />
                      </div>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No files uploaded yet
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {uploadedFiles.map((file) => (
                        <div
                          key={file.id || `file-${file.file_name}`}
                          className={`group p-3.5 rounded-xl border transition-colors ${
                            isDarkMode
                              ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isDarkMode ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-500'
                              }`}>
                                <FileText size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {file.file_name}
                                </div>
                                <div className={`flex items-center gap-1 text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {file.created_at && (
                                    <><Clock size={10} /> {formatDate(file.created_at)}</>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteFile(file.id!)}
                              aria-label="Remove file"
                              className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all flex-shrink-0 ${
                                isDarkMode ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                              }`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : selectedConversation ? (
            <div className="max-w-3xl mx-auto p-5 md:p-8">
              <div className={`mb-6 p-5 rounded-2xl border ${
                isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-white border-gray-200 shadow-sm'
              }`}>
                <h2 className={`text-2xl font-bold mb-3 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {selectedConversation.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {selectedConversation.employee_code && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium ${isDarkMode ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-600'}`}>
                      <Hash size={11} />{selectedConversation.employee_code}
                    </span>
                  )}
                  {selectedConversation.source && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg font-medium ${isDarkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                      {selectedConversation.source}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Clock size={11} /> {formatDate(selectedConversation.updated_at || selectedConversation.created_at || '')}
                  </span>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`h-20 rounded-2xl animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`} />
                  ))}
                </div>
              ) : conversationMessages.length === 0 ? (
                <div className="flex flex-col items-center text-center py-16">
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl mb-3 ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                    <MessageSquare size={22} />
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No messages in this conversation
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversationMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                    <div key={msg.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-white ${
                        isUser ? 'bg-gradient-to-br from-red-500 to-rose-600' : isDarkMode ? 'bg-gray-700' : 'bg-gray-800'
                      }`}>
                        {isUser ? <User size={15} /> : <Bot size={15} />}
                      </div>
                      <div className={`max-w-[80%] p-4 rounded-2xl ${
                        isUser
                          ? isDarkMode
                            ? 'bg-red-500/15 border border-red-500/25 rounded-tr-sm'
                            : 'bg-red-50 border border-red-200 rounded-tr-sm'
                          : isDarkMode
                            ? 'bg-white/[0.04] border border-white/10 rounded-tl-sm'
                            : 'bg-white border border-gray-200 shadow-sm rounded-tl-sm'
                      }`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {isUser ? 'User' : 'Bot'}
                        </div>
                        <div className={`text-sm whitespace-pre-wrap leading-relaxed ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {msg.content}
                        </div>
                        <div className={`text-[11px] mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {formatDate(msg.created_at || '')}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center animate-fade-in-up">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 mx-auto ${
                  isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-white shadow-sm text-gray-400'
                }`}>
                  <MessageSquare size={36} className="animate-icon-float" />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Select a conversation
                </h3>
                <p className={`text-sm max-w-xs mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Choose a conversation from the sidebar to read its messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {showSuccessNotification && (
        <div 
          className="fixed top-20 right-4 z-50 transition-all duration-300 ease-out"
          style={{
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm ${
            isDarkMode
              ? 'bg-green-900/90 border-green-700 text-green-100'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            <CheckCircle size={20} className={`flex-shrink-0 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            <div>
              <p className="font-medium text-sm">Document uploaded successfully!</p>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showResponseModal && webhookResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`relative w-full max-w-md mx-4 rounded-lg shadow-xl border ${
            isDarkMode
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} />
                <h3 className={`text-lg font-semibold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Warning
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowResponseModal(false);
                  setWebhookResponse(null);
                }}
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className={`text-base ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                File has been uploaded.
              </p>
            </div>

            {/* Footer */}
            <div className={`flex justify-end gap-2 p-4 border-t ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <button
                onClick={() => {
                  setShowResponseModal(false);
                  setWebhookResponse(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
