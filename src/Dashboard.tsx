import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Trash2, Moon, Sun, Search, X, Upload, FileText, History, CheckCircle } from 'lucide-react';
import { conversationService, messageService, Conversation, Message } from './lib/supabaseClient';
import { supabase } from './lib/supabaseClient';

// Webhook URL for file uploads
const FILE_UPLOAD_WEBHOOK_URL = 'http://localhost:5678/webhook/f40e8d3d-8343-4648-9ed7-9c2f8649c007';

// Local file interface (not from Supabase)
interface UploadedFile {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    if (viewMode === 'conversations') {
      loadConversations();
    } else {
      loadLocalFiles();
    }
  }, [employeeCodeFilter, viewMode]);

  // Load files from localStorage (local history)
  const loadLocalFiles = () => {
    try {
      const stored = localStorage.getItem('uploaded_files');
      if (stored) {
        setUploadedFiles(JSON.parse(stored));
      } else {
        setUploadedFiles([]);
      }
    } catch (error) {
      console.error('Error loading local files:', error);
      setUploadedFiles([]);
    }
  };

  // Save files to localStorage
  const saveLocalFiles = (files: UploadedFile[]) => {
    try {
      localStorage.setItem('uploaded_files', JSON.stringify(files));
    } catch (error) {
      console.error('Error saving local files:', error);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100);

      // Filter by employee_code if provided
      if (employeeCodeFilter.trim()) {
        query = query.eq('employee_code', employeeCodeFilter.trim());
      }

      const { data, error } = await query;

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const messages = await messageService.getMessages(conversationId);
      setConversationMessages(messages);
      const conv = conversations.find(c => c.id === conversationId);
      setSelectedConversation(conv || null);
    } catch (error) {
      console.error('Error loading messages:', error);
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      // Add to local history
      const newFile: UploadedFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        uploadedAt: new Date().toISOString()
      };

      const updatedFiles = [newFile, ...uploadedFiles];
      setUploadedFiles(updatedFiles);
      saveLocalFiles(updatedFiles);

      // Show success notification
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 3000); // Auto-dismiss after 3 seconds
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error uploading file: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFile = (fileId: string) => {
    if (!confirm('Are you sure you want to remove this file from history?')) return;

    const updatedFiles = uploadedFiles.filter(f => f.id !== fileId);
    setUploadedFiles(updatedFiles);
    saveLocalFiles(updatedFiles);
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
                          key={file.id}
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
                                  {file.filename}
                                </div>
                                <div className={`text-xs mt-1 ${
                                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  {file.fileType} • {formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteFile(file.id)}
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
