import React, { useState, useEffect } from 'react';
import { Send, ArrowLeft, Trash2, User, Menu, Plus, MessageSquare, Settings, HelpCircle, LogOut, Search, MoreVertical, Edit2, Archive } from 'lucide-react';
import { conversationService, messageService, Conversation, Message as DBMessage } from './lib/supabaseClient';

interface Message {
  id: number | string;
  type: 'user' | 'bot';
  text: string;
  isLoading?: boolean;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  active?: boolean;
}

const ChatbotInterface = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const [sessionId] = useState(() => {
    // Generate a unique session ID for this chat session (persist in localStorage)
    const stored = localStorage.getItem('chatbot_session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatbot_session_id', newId);
    return newId;
  });

  // Load conversations from Supabase on mount
  useEffect(() => {
    loadConversations();
  }, [sessionId]);

  // Load conversations from database
  const loadConversations = async () => {
    setIsLoadingHistory(true);
    try {
      const conversations = await conversationService.getConversations(sessionId);
      const historyItems: ChatHistoryItem[] = conversations.map(conv => ({
        id: conv.id!,
        title: conv.title,
        date: formatDate(conv.updated_at || conv.created_at || ''),
        active: conv.id === currentConversationId // Highlight active conversation
      }));
      // Sort by updated_at (most recent first)
      historyItems.sort((a, b) => {
        const aDate = conversations.find(c => c.id === a.id)?.updated_at || '';
        const bDate = conversations.find(c => c.id === b.id)?.updated_at || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
      setChatHistory(historyItems);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  };
  
  // Use proxy endpoint to avoid CORS issues
  // Vite proxy will forward /api/n8n to the N8N webhook
  const N8N_WEBHOOK_URL = '/api/n8n';

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    
    // Create a NEW conversation if we don't have one (New Chat was clicked)
    let conversationId = currentConversationId;
    if (!conversationId) {
      // Create new conversation with first message as title
      const title = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
      const newConversation = await conversationService.createConversation(sessionId, title);
      if (newConversation && newConversation.id) {
        conversationId = newConversation.id;
        setCurrentConversationId(conversationId);
        await loadConversations(); // Refresh sidebar to show new conversation
      } else {
        console.error('Failed to create conversation');
        return; // Don't proceed if conversation creation failed
      }
    }
    
    // Generate unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add user message immediately
    const userMsg: Message = {
      id: messageId,
      type: 'user',
      text: userMessage
    };
    setMessages(prev => [...prev, userMsg]);
    
    // Save user message to database
    if (conversationId) {
      await messageService.addMessage(conversationId, 'user', userMessage);
    }
    
    setInputText('');
    setIsLoading(true);

    // Add loading message
    const loadingMessageId = messageId + 1;
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      type: 'bot',
      text: '...',
      isLoading: true
    }]);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          action: 'sendMessage',
          chatInput: userMessage
        })
      });

      // Get response data first (even if status is not ok)
      let data;
      try {
        data = await response.json();
      } catch (e) {
        // If response isn't JSON
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        throw new Error('Invalid response from server');
      }

      // Check if N8N returned an error
      if (!response.ok || (data.code && (data.code === 404 || data.code === 500))) {
        const errorMsg = data.message || data.error || `HTTP error! status: ${response.status}`;
        
        // Check if it's a webhook not registered error
        if (errorMsg.includes('not registered') || errorMsg.includes('The requested webhook')) {
          throw new Error('N8N_WEBHOOK_NOT_REGISTERED');
        }
        
        // Check if it's a workflow execution error
        if (errorMsg.includes('Error in workflow') || response.status === 500) {
          throw new Error('N8N_WORKFLOW_ERROR');
        }
        
        throw new Error(errorMsg);
      }
      
      // Extract response text (handle different response formats)
      // N8N workflow returns { output: "..." }
      let responseText = '';
      if (typeof data === 'string') {
        responseText = data;
      } else if (data.output) {
        responseText = data.output;
      } else if (data.response) {
        responseText = data.response;
      } else if (data.message && !data.code) {
        responseText = data.message;
      } else if (data.text) {
        responseText = data.text;
      } else {
        responseText = JSON.stringify(data);
      }

      // Remove loading message and add bot response
      const botMsg: Message = {
        id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'bot',
        text: responseText
      };
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId).concat([botMsg]));
      
      // Save bot response to database
      if (conversationId) {
        await messageService.addMessage(conversationId, 'bot', responseText);
        // Update conversation title with first user message if it's a new conversation
        const conv = await conversationService.getConversation(conversationId);
        if (conv && userMessage.length <= 50) {
          // Only update if title is generic or needs updating
          if (conv.title !== userMessage && (conv.title.startsWith('New Chat') || conv.title.length > 50)) {
            await conversationService.updateConversationTitle(conversationId, userMessage);
            await loadConversations(); // Refresh sidebar with updated title
          }
        }
      }
      
      // Scroll to bottom after bot response
      setTimeout(() => {
        const chatContainer = document.querySelector('.flex-1.overflow-y-auto');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);

    } catch (error) {
      console.error('Error calling N8N webhook:', error);
      
      // Remove loading message and add error message
      let errorMessage = '';
      
      if (error instanceof Error && error.message === 'N8N_WEBHOOK_NOT_REGISTERED') {
        errorMessage = `**⚠️ N8N Workflow Not Activated**\n\nYour N8N workflow needs to be activated!\n\n**To fix this:**\n\n1. Open N8N: **http://localhost:5678**\n2. Find your workflow with webhook ID: \`e61a4f26-156f-4802-ae33-743399345186\`\n3. **Toggle the workflow to ACTIVE** (switch in top-right corner)\n4. Make sure the workflow is saved\n5. Wait a few seconds for N8N to register the webhook\n6. Try sending a message again\n\n**Note:** The workflow must be ACTIVE (green/ON) for production webhooks to work.`;
      } else if (error instanceof Error && error.message === 'N8N_WORKFLOW_ERROR') {
        errorMessage = `**⚠️ N8N Workflow Execution Error**\n\nGood news: The webhook is working! But there's an error inside your N8N workflow.\n\n**To fix this:**\n\n1. Open N8N: **http://localhost:5678**\n2. Go to **Executions** (left sidebar)\n3. Check the latest execution - it will show the error\n4. Common issues:\n   - Missing or incorrect node configuration\n   - Wrong data format expected\n   - Missing required fields\n   - Code errors in Code/Function nodes\n\n**Request sent:**\n\`\`\`json\n${JSON.stringify({ sessionId: sessionId, action: 'sendMessage', chatInput: userMessage }, null, 2)}\n\`\`\`\n\n**Check N8N Executions tab for detailed error information.**`;
      } else {
        errorMessage = `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n**Troubleshooting:**\n\n1. ✅ Is N8N running on port 5678?\n2. ✅ Is the workflow **ACTIVATED** (toggle switch ON)?\n3. ✅ Does the webhook path match: \`/webhook/e61a4f26-156f-4802-ae33-743399345186/chat\`?\n4. ✅ Check N8N **Executions** tab for error details\n\n**Webhook URL:** http://localhost:5678/webhook/e61a4f26-156f-4802-ae33-743399345186/chat`;
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId).concat([{
        id: loadingMessageId,
        type: 'bot',
        text: errorMessage
      }]));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = async () => {
    // Clear current conversation and start fresh (like ChatGPT)
    setMessages([]);
    setInputText('');
    setCurrentConversationId(null); // Reset to null so next message creates new conversation
    await loadConversations(); // Refresh sidebar to update active states
  };

  // Load a conversation and its messages (like ChatGPT - click to continue)
  const loadConversation = async (conversationId: string) => {
    // Don't load if it's already the current conversation
    if (conversationId === currentConversationId) return;
    
    setIsLoading(true);
    try {
      // Load messages from database
      const dbMessages = await messageService.getMessages(conversationId);
      const formattedMessages: Message[] = dbMessages.map((msg, index) => ({
        id: msg.id || `msg-${index}`,
        type: msg.role,
        text: msg.content
      }));
      
      // Set the loaded conversation as current
      setMessages(formattedMessages);
      setCurrentConversationId(conversationId);
      
      // Refresh sidebar to update active state
      await loadConversations();
      
      // Scroll to bottom to show latest messages
      setTimeout(() => {
        const chatContainer = document.querySelector('.flex-1.overflow-y-auto');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error loading conversation:', error);
      alert('Failed to load conversation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-72' : 'w-0'} bg-gray-900 text-white transition-all duration-300 overflow-hidden flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-gray-700">
          <button 
            onClick={handleNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Plus size={20} />
            <span className="font-medium">New Chat</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {isLoadingHistory ? (
            <div className="text-center text-gray-400 py-8">Loading conversations...</div>
          ) : chatHistory.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">No conversations yet</div>
          ) : (
            chatHistory.map((chat) => (
              <div key={chat.id} className="group relative">
                <button 
                  onClick={() => loadConversation(chat.id)}
                  className={`w-full text-left px-3 py-3 rounded-lg hover:bg-gray-800 transition-colors ${chat.active ? 'bg-gray-800' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare size={18} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{chat.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{chat.date}</p>
                    </div>
                  </div>
                </button>
                {/* Hover actions */}
                <div className="absolute right-2 top-3 hidden group-hover:flex items-center gap-1">
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm('Delete this conversation?')) {
                        await conversationService.deleteConversation(chat.id);
                        if (chat.id === currentConversationId) {
                          handleNewChat();
                        } else {
                          await loadConversations();
                        }
                      }
                    }}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-gray-700 p-3 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 rounded-lg transition-colors text-sm">
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 rounded-lg transition-colors text-sm">
            <HelpCircle size={18} />
            <span>Help & FAQ</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 rounded-lg transition-colors text-sm">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-gray-700 hover:text-gray-900"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Easy GPT</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-gray-700 hover:text-gray-900">
              <MoreVertical size={24} />
            </button>
            <button className="text-red-500 hover:text-red-600">
              <Trash2 size={24} />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <MessageSquare size={32} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">How can I help you today?</h2>
              <p className="text-gray-500 mb-8">Ask me anything about Easy Home Finance Limited</p>
              
              {/* Suggestion Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                <button className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors text-left">
                  <p className="font-medium text-gray-900 mb-1">📝 Loan Application</p>
                  <p className="text-sm text-gray-500">Guide me through the loan application process</p>
                </button>
                <button className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors text-left">
                  <p className="font-medium text-gray-900 mb-1">💳 Credit Score</p>
                  <p className="text-sm text-gray-500">What are the CIBIL score requirements?</p>
                </button>
                <button className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors text-left">
                  <p className="font-medium text-gray-900 mb-1">📋 Documentation</p>
                  <p className="text-sm text-gray-500">What documents do I need to submit?</p>
                </button>
                <button className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors text-left">
                  <p className="font-medium text-gray-900 mb-1">💰 EMI Calculator</p>
                  <p className="text-sm text-gray-500">Help me calculate my monthly EMI</p>
                </button>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex items-start gap-3">
                {message.type === 'bot' && (
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-red-500 rounded-sm flex items-center justify-center">
                      {message.isLoading ? (
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                )}
                
                <div className={`flex-1 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${
                    message.type === 'user' 
                      ? 'bg-red-500 text-white rounded-l-3xl rounded-tr-3xl rounded-br-md' 
                      : 'bg-white text-gray-900 rounded-r-3xl rounded-tl-3xl rounded-bl-md shadow-sm'
                  } px-5 py-3`}>
                    {message.isLoading ? (
                      <div className="flex gap-1 py-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.text}</div>
                    )}
                  </div>
                </div>

                {message.type === 'user' && (
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <User size={20} className="text-red-500" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button 
                onClick={handleSend}
                className="flex-shrink-0 w-14 h-14 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!inputText.trim() || isLoading}
              >
                <Send size={24} className="text-white" fill="white" />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">
              Easy GPT can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
};

export default ChatbotInterface;