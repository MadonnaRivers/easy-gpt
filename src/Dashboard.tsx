import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Trash2, Moon, Sun, Search, X, Upload, FileText, History, CheckCircle, AlertCircle } from 'lucide-react';
import { conversationService, fileHashService, Conversation, Message, FileHash } from './lib/storage';

// Webhook URLs for dashboard data (n8n → MySQL)
const CONVERSATIONS_WEBHOOK_URL = 'https://uat-n8n.easyhomefinance.in/webhook/f5c7f525-6af7-47d4-b080-715892d350f6';
const MESSAGES_WEBHOOK_URL = 'https://uat-n8n.easyhomefinance.in/webhook/48a93076-1569-4e6d-8a2b-d773ef94655b';

// File upload: in dev we use same-origin /api/upload (Vite proxies to n8n) to avoid CORS
const FILE_UPLOAD_WEBHOOK_URL = import.meta.env.DEV
  ? '/api/upload'
  : 'https://uat-n8n.easyhomefinance.in/webhook/bfeed288-3ed4-4428-9b28-b39842289d3c';
// Client-side limit (MB). Server may have a lower limit (413 = Request Entity Too Large).
const MAX_UPLOAD_FILE_SIZE_MB = 25;

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

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(CONVERSATIONS_WEBHOOK_URL, { method: 'GET' });
      if (!res.ok) throw new Error(`Failed to load conversations: ${res.status}`);
      const data: Conversation[] = await res.json();
      let list = Array.isArray(data) ? data : [];

      // Filter by employee_code if provided
      if (employeeCodeFilter.trim()) {
        list = list.filter((c) => (c.employee_code || '').toString().trim() === employeeCodeFilter.trim());
      }

      list.sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
      setConversations(list.slice(0, 100));
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(MESSAGES_WEBHOOK_URL, { method: 'GET' });
      if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);
      const data: Message[] = await res.json();
      const list = Array.isArray(data) ? data : [];
      const messages = list
        .filter((m) => m.conversation_id === conversationId)
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      setConversationMessages(messages);
      const conv = conversations.find((c) => c.id === conversationId);
      setSelectedConversation(conv || null);
    } catch (error) {
      console.error('Error loading messages:', error);
      setConversationMessages([]);
    } finally {
      setIsLoading(false);
    }
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
    return date.toLocaleString();
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
      formData.append('file', file);
      formData.append('filename', file.name);
      formData.append('fileType', file.type || 'application/octet-stream');
      formData.append('fileSize', file.size.toString());
      formData.append('uploadedBy', localStorage.getItem('chatbot_session_id') || 'unknown');

      // Send file to webhook
      const response = await fetch(FILE_UPLOAD_WEBHOOK_URL, {
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
    <div className={`h-screen w-full overflow-hidden transition-colors ${
      isDarkMode 
        ? 'bg-gray-900' 
        : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`shadow-sm px-6 py-4 flex items-center justify-between transition-colors ${
        isDarkMode
          ? 'bg-gray-800 border-b border-gray-700'
          : 'bg-white'
      }`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-xl font-bold transition-colors ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>Easy GPT Dashboard</h1>
          <Link
            to="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border text-sm font-medium ${
              isDarkMode
                ? 'bg-red-600 hover:bg-red-500 border-red-500 text-white'
                : 'bg-red-500 hover:bg-red-600 border-red-600 text-white'
            }`}
          >
            <MessageSquare size={18} />
            Easy GPT
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleViewMode}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${
              isDarkMode
                ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
            }`}
          >
            {viewMode === 'conversations' ? <Upload size={18} /> : <History size={18} />}
            <span className="text-sm font-medium">
              {viewMode === 'conversations' ? 'Upload Documents' : 'Conversation History'}
            </span>
          </button>
          <button
            onClick={toggleDarkMode}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${
              isDarkMode
                ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
            }`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span className="text-sm font-medium">{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Conversations List (hidden in upload mode) */}
        {viewMode === 'conversations' && (
        <div className={`w-80 border-r transition-colors ${
          isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          {/* Header with Filter */}
          <div className={`p-4 border-b transition-colors ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className={`text-sm font-semibold mb-3 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Conversation History
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
                placeholder="Filter by Employee Code"
                className={`w-full pl-10 pr-8 py-2 rounded-lg text-sm border transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-red-500`}
              />
              {employeeCodeFilter && (
                <button
                  onClick={() => setEmployeeCodeFilter('')}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded ${
                    isDarkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                  }`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Conversations List */}
          <div className="overflow-y-auto h-[calc(100%-120px)]">
            <div className="p-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Loading conversations...
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {employeeCodeFilter ? 'No conversations found for this employee code' : 'No conversations yet'}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversationMessages(conv.id!)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedConversation?.id === conv.id
                          ? isDarkMode
                            ? 'bg-red-500/20 border border-red-500/50'
                            : 'bg-red-50 border border-red-200'
                          : isDarkMode
                            ? 'hover:bg-gray-700'
                            : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm truncate ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {conv.title}
                          </div>
                          <div className={`text-xs mt-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {conv.employee_code && (
                              <span className="mr-2">Code: {conv.employee_code}</span>
                            )}
                            {formatDate(conv.updated_at || conv.created_at || '')}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conv.id!);
                          }}
                          className={`p-1 rounded hover:bg-red-500/20 transition-colors ${
                            isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Right Panel - Conversation Details or Upload Interface */}
        <div className={`flex-1 overflow-y-auto transition-colors ${
          isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
        }`}>
          {viewMode === 'upload' ? (
            /* Upload Document Interface */
            <div className="h-full flex flex-col">
              {/* Upload Section */}
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="max-w-2xl w-full">
                  <div className="text-center mb-8">
                    <h2 className={`text-3xl font-bold mb-2 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Upload Your Files for Easy GPT
                    </h2>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Upload documents to enhance your chatbot's knowledge base
                    </p>
                  </div>

                  {/* Upload Area */}
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                      isUploading
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:border-red-500'
                    } ${
                      isDarkMode
                        ? 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
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
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <Upload size={32} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                      </div>
                      {isUploading ? (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Uploading to webhook...
                        </p>
                      ) : (
                        <>
                          <p className={`text-lg font-medium mb-2 ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            Click to upload or drag and drop
                          </p>
                          <p className={`text-sm ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Supported formats: TXT, PDF, DOC, DOCX, and more
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* File History Section */}
              <div className={`border-t ${
                isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}>
                <div className="p-6">
                  <h3 className={`text-lg font-semibold mb-4 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Upload History
                  </h3>
                  
                  {uploadedFiles.length === 0 ? (
                    <div className="text-center py-8">
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No files uploaded yet
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {uploadedFiles.map((file) => (
                        <div
                          key={file.id || `file-${file.file_name}`}
                          className={`p-4 rounded-lg border ${
                            isDarkMode
                              ? 'bg-gray-800 border-gray-700'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                              }`}>
                                <FileText size={20} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`font-medium text-sm truncate ${
                                  isDarkMode ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {file.file_name}
                                </div>
                                <div className={`text-xs mt-1 ${
                                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  ID: {file.id} {file.created_at && `• ${formatDate(file.created_at)}`}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteFile(file.id!)}
                              className={`p-2 rounded hover:bg-red-500/20 transition-colors flex-shrink-0 ${
                                isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'
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
            <div className="p-6">
              <div className={`mb-6 pb-4 border-b ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <h2 className={`text-2xl font-bold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {selectedConversation.title}
                </h2>
                <div className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {selectedConversation.employee_code && (
                    <span className="mr-3">Employee Code: <strong>{selectedConversation.employee_code}</strong></span>
                  )}
                  {selectedConversation.source && (
                    <span className="mr-3">Source: <strong>{selectedConversation.source}</strong></span>
                  )}
                  Created: {formatDate(selectedConversation.created_at || '')} • 
                  Updated: {formatDate(selectedConversation.updated_at || '')}
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Loading messages...
                  </div>
                </div>
              ) : conversationMessages.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No messages in this conversation
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversationMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-lg ${
                        msg.role === 'user'
                          ? isDarkMode
                            ? 'bg-red-500/20 border border-red-500/30'
                            : 'bg-red-50 border border-red-200'
                          : isDarkMode
                            ? 'bg-gray-800 border border-gray-700'
                            : 'bg-white border border-gray-200'
                      }`}
                    >
                      <div className={`text-xs font-semibold mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {msg.role === 'user' ? 'User' : 'Bot'}
                      </div>
                      <div className={`text-sm whitespace-pre-wrap ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {msg.content}
                      </div>
                      <div className={`text-xs mt-2 ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {formatDate(msg.created_at || '')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto ${
                  isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
                }`}>
                  <MessageSquare size={32} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Select a conversation to view details
                </h3>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Choose a conversation from the sidebar to see its messages
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
