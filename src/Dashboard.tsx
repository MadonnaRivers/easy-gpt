import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Trash2, Moon, Sun, ArrowLeft, Search, X } from 'lucide-react';
import { conversationService, messageService, Conversation, Message } from './lib/supabaseClient';
import { supabase } from './lib/supabaseClient';

const Dashboard = () => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false;
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeCodeFilter, setEmployeeCodeFilter] = useState<string>('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    loadConversations();
  }, [employeeCodeFilter]);

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
          <button
            onClick={() => navigate('/')}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'hover:bg-gray-700 text-white'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-bold transition-colors ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>Easy GPT Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
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
        {/* Left Sidebar - Conversations List */}
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

        {/* Right Panel - Conversation Details */}
        <div className={`flex-1 overflow-y-auto transition-colors ${
          isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
        }`}>
          {selectedConversation ? (
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
    </div>
  );
};

export default Dashboard;
