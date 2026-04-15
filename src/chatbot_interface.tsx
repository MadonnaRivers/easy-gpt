import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, User, MessageSquare, Moon, Sun, RotateCw, Copy, Check, LayoutDashboard } from 'lucide-react';
import { conversationService, messageService } from './lib/storage';
import { verifyJwt } from './lib/jwtVerify';

// Text formatter to support markdown formatting (headings, bold, bullet points, horizontal rules)
const renderMessageText = (text: string) => {
  // Remove common greeting/intro lines
  let cleanedText = text
  // This specific line deletes the intro seen in your image  
    .replace(/^Hello!?\s+Please find below.*?:?\s*\n?/gim, '') 
    .replace(/^Hello!?\s+Here are the (policy highlights|policy-based details|policy details).*?:\s*\n?/gim, '')
    .trim(); // This removes the empty space left behind
  
  const escaped = cleanedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  const lines = escaped.split('\n');
  const processedLines: string[] = [];
  const listStack: number[] = [];
  let isFirstContent = true;
  
  const isTableSeparator = (line: string) => {
    const normalized = line.trim();
    if (!normalized.includes('|')) return false;
    const cells = normalized
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };

  const parseTableRow = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 0. Handle Markdown-style tables
    const nextLine = lines[i + 1]?.trim() || '';
    if (trimmedLine.includes('|') && isTableSeparator(nextLine)) {
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }

      const headerCells = parseTableRow(trimmedLine);
      const tableRows: string[][] = [];
      let j = i + 2;
      while (j < lines.length) {
        const rowLine = lines[j].trim();
        if (!rowLine.includes('|') || rowLine === '') break;
        tableRows.push(parseTableRow(rowLine));
        j++;
      }

      const headerHtml = headerCells
        .map(
          (cell) =>
            `<th style="text-align: left; padding: 0.55rem 0.7rem; border-bottom: 1px solid rgba(156, 163, 175, 0.45); font-weight: 600; white-space: nowrap;">${cell}</th>`
        )
        .join('');
      const bodyHtml = tableRows
        .map((row) => {
          const cols = headerCells.map((_, idx) => row[idx] || '');
          const cellsHtml = cols
            .map(
              (cell) =>
                `<td style="padding: 0.5rem 0.7rem; border-bottom: 1px solid rgba(156, 163, 175, 0.22); vertical-align: top;">${cell}</td>`
            )
            .join('');
          return `<tr>${cellsHtml}</tr>`;
        })
        .join('');

      processedLines.push(
        `<div style="margin: 0.45rem 0 0.6rem 0; overflow-x: auto;"><table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.92rem; line-height: 1.45; border: 1px solid rgba(156, 163, 175, 0.3); border-radius: 0.65rem; overflow: hidden;"><thead style="background: rgba(156, 163, 175, 0.12);"><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
      );
      isFirstContent = false;
      i = j - 1;
      continue;
    }
    
    // 1. Handle Horizontal Rules
    if (trimmedLine.match(/^-{3,}$/)) {
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }
      processedLines.push('<hr style="border: none; border-top: 1px solid rgba(0, 0, 0, 0.1); margin: 0.5rem 0; opacity: 0.3;" />');
      isFirstContent = false;
      continue;
    }
    
    // 2. Handle Markdown Headings (### Heading)
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const fontSize = level === 1 ? '1.5rem' : level === 2 ? '1.35rem' : '1.7rem';
      // Reduced top margin from 1rem to 0.5rem
      const marginTop = isFirstContent ? '0' : '0.8rem'; 
      processedLines.push(`<h${Math.min(level, 6)} style="font-size: ${fontSize}; font-weight: bold; margin: ${marginTop} 0 0.4rem 0; line-height: 1.3;">${headingText}</h${Math.min(level, 6)}>`);
      isFirstContent = false;
      continue;
    }
    
    // 3. Handle Bullet Points
    const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/); // Added support for * and •
    
    if (bulletMatch) {
      const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
      const currentLevel = Math.min(Math.floor(leadingSpaces / 4), 2);
      
      while (listStack.length > 0 && listStack[listStack.length - 1] > currentLevel) {
        processedLines.push('</ul>');
        listStack.pop();
      }
      
      if (listStack.length === 0 || listStack[listStack.length - 1] < currentLevel) {
        const marginLeft = currentLevel === 0 ? '1.25rem' : `${1.25 + (currentLevel * 1)}rem`;
        // Reduced list margin from 0.375rem to 0.125rem
        processedLines.push(`<ul style="list-style-type: disc; margin: 0.125rem 0; padding-left: 0; margin-left: ${marginLeft}; line-height: 1.5;">`);
        listStack.push(currentLevel);
      }
      
      const content = bulletMatch[1];
      const isSubHeading = content.trim().endsWith(':');
      // Tightened bottom margin on list items
      const itemStyle = `margin-bottom: 0.125rem; line-height: 1.5; ${isSubHeading ? 'font-weight: 600;' : ''}`;
      processedLines.push(`<li style="${itemStyle}">${content}</li>`);
      isFirstContent = false;
    } else {
      // 4. Handle Regular Text & Paragraphs
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }
      
      if (trimmedLine === '') {
        // Only add a break if the previous line wasn't also a break (prevent triple spacing)
        if (processedLines[processedLines.length - 1] !== '<div style="height: 0.5rem"></div>') {
           processedLines.push('<div style="height: 0.5rem"></div>'); 
        }
      } else {
        const isSubHeading = trimmedLine.endsWith(':') && trimmedLine.length < 100;
        // Reduced paragraph margins from 0.5rem to 0.2rem
        const marginY = isFirstContent ? '0 0 0.2rem 0' : (isSubHeading ? '0.4rem 0 0.2rem 0' : '0.15rem 0');
        processedLines.push(`<p style="margin: ${marginY}; line-height: 1.5; ${isSubHeading ? 'font-weight: 600;' : ''}">${line}</p>`);
        isFirstContent = false;
      }
    }
  }
  
  while (listStack.length > 0) {
    processedLines.push('</ul>');
    listStack.pop();
  }
  
  let result = processedLines.join('\n');
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  return result;
};

interface Message {
  id: number | string;
  type: 'user' | 'bot';
  text: string;
  isLoading?: boolean;
  isStreaming?: boolean;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  active?: boolean;
}

type AuthStatus = 'pending' | 'valid' | 'invalid' | null;

/** Employee code for predefined-token login (FastAPI /load). Sent with chat webhook. */
const PREDEFINED_INTERNAL_EMPLOYEE = '__EASYGPT_INTERNAL__';

function getEmployeeCode(): string {
  const c = localStorage.getItem('employee_code')?.trim();
  if (c) return c;
  return import.meta.env.DEV ? 'DEV_LOCAL' : '';
}

function initialAuthStatus(): AuthStatus {
  if (import.meta.env.DEV) return null;
  if (typeof window === 'undefined') return 'pending';
  const p = new URLSearchParams(window.location.search);
  if (p.get('access') === 'predefined') return 'valid';
  if (p.get('jwt_token')?.trim()) return 'pending';
  if (sessionStorage.getItem('easygpt_access') === 'predefined') return 'valid';
  if (sessionStorage.getItem('easygpt_jwt_ok') === '1') return 'valid';
  return 'invalid';
}

const ChatbotInterface = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(initialAuthStatus);
  const [dashboardAllowed, setDashboardAllowed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    // Try to restore conversation ID from localStorage
    const saved = localStorage.getItem('current_conversation_id');
    return saved || null;
  });
  const [copiedMessageId, setCopiedMessageId] = useState<string | number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSendingRef = useRef(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false;
  });
  
  const [sessionId, setSessionId] = useState(() => {
    // Generate a unique session ID for this chat session (persist in localStorage)
    const stored = localStorage.getItem('chatbot_session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatbot_session_id', newId);
    return newId;
  });

  // Auth: predefined (?access=predefined), JWT (?jwt_token) via n8n webhook, or session (prod)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('access') === 'predefined') {
      sessionStorage.setItem('easygpt_access', 'predefined');
      localStorage.setItem('employee_code', PREDEFINED_INTERNAL_EMPLOYEE);
      localStorage.setItem('source', 'web');
      params.delete('access');
      const q = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash);
      setAuthStatus('valid');
      return;
    }

    const token = params.get('jwt_token')?.trim();
    if (token) {
      setAuthStatus('pending');
      verifyJwt(token)
        .then((result) => {
          if (result.valid === true) {
            localStorage.setItem('employee_code', result.employee_code);
            localStorage.setItem('source', result.source);
            sessionStorage.setItem('easygpt_access', 'jwt');
            sessionStorage.setItem('easygpt_jwt_ok', '1');
            params.delete('jwt_token');
            const q = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash);
            setAuthStatus('valid');
          } else {
            setAuthStatus('invalid');
          }
        })
        .catch(() => setAuthStatus('invalid'));
      return;
    }

    if (import.meta.env.DEV) {
      if (!localStorage.getItem('employee_code')) {
        localStorage.setItem('employee_code', 'DEV_LOCAL');
        localStorage.setItem('source', 'web');
      }
      setAuthStatus(null);
      return;
    }

    if (sessionStorage.getItem('easygpt_access') === 'predefined') {
      if (!localStorage.getItem('employee_code')) {
        localStorage.setItem('employee_code', PREDEFINED_INTERNAL_EMPLOYEE);
      }
      setAuthStatus('valid');
      return;
    }
    if (sessionStorage.getItem('easygpt_jwt_ok') === '1' && localStorage.getItem('employee_code')) {
      setAuthStatus('valid');
      return;
    }
    setAuthStatus('invalid');
  }, []);

  // Dashboard is strictly for predefined internal flow only.
  useEffect(() => {
    if (authStatus === 'pending' || authStatus === 'invalid') {
      setDashboardAllowed(false);
      return;
    }
    setDashboardAllowed(sessionStorage.getItem('easygpt_access') === 'predefined');
  }, [authStatus]);

  // Load conversations per employee_code (ChatGPT-style) after auth is ready
  useEffect(() => {
    if (authStatus === 'pending' || authStatus === 'invalid') return;

    const initializeConversation = async () => {
      const emp = getEmployeeCode();
      if (!emp && !import.meta.env.DEV) return;

      await loadConversations();

      const newChatStarted = localStorage.getItem('new_chat_started') === 'true';

      if (currentConversationId && !newChatStarted) {
        await loadConversation(currentConversationId, true);
      } else if (!newChatStarted) {
        const conversations = await conversationService.getConversationsForEmployee(emp);
        if (conversations.length > 0) {
          const sorted = [...conversations].sort((a, b) => {
            const aDate = a.updated_at || a.created_at || '';
            const bDate = b.updated_at || b.created_at || '';
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          });
          await loadConversation(sorted[0].id!, true);
        }
      }
    };

    initializeConversation();
  }, [authStatus, sessionId]);

  // Save conversation ID to localStorage when it changes
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('current_conversation_id', currentConversationId);
    } else {
      localStorage.removeItem('current_conversation_id');
    }
  }, [currentConversationId]);

  // Apply dark mode to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleCopyMessage = async (text: string, messageId: string | number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  // Stream bot message character by character (ChatGPT-like). Uses setTimeout so it keeps
  // running when the tab is in the background. Auto-scrolls only if user is near bottom.
  const streamBotMessage = async (messageId: string, fullText: string) => {
    return new Promise<void>((resolve) => {
      let currentIndex = 0;
      const charsPerFrame = 2;
      const minDelay = 16;
      const scrollThreshold = 120; // Only auto-scroll if within this many px of bottom

      const animate = () => {
        if (currentIndex < fullText.length) {
          const endIndex = Math.min(currentIndex + charsPerFrame, fullText.length);
          const currentText = fullText.substring(0, endIndex);

          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, text: currentText, isStreaming: endIndex < fullText.length }
              : msg
          ));

          // Only scroll to bottom if user hasn't scrolled up (so they can read above while generating)
          const chatContainer = document.querySelector('.flex-1.overflow-y-auto');
          if (chatContainer) {
            const distanceFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
            if (distanceFromBottom < scrollThreshold) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }

          currentIndex = endIndex;
          setTimeout(animate, minDelay);
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, isStreaming: false } : msg
          ));
          resolve();
        }
      };

      // setTimeout so streaming continues when tab is in background (unlike requestAnimationFrame)
      setTimeout(animate, 0);
    });
  };

  // Load conversations from database
  const loadConversations = async () => {
    try {
      const emp = getEmployeeCode();
      const conversations = await conversationService.getConversationsForEmployee(emp);
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
  
  // N8N webhook URL (requires sessionId + chatInput in body)
  const N8N_WEBHOOK_URL = 'https://uat-n8n.easyhomefinance.in/webhook/edf7c50a-2d5f-4e1e-b070-1e4de62e098e';

  const handleSend = async () => {
    // Prevent multiple submissions
    if (!inputText.trim() || isLoading || isSendingRef.current) return;
    
    isSendingRef.current = true;
    const userMessage = inputText.trim();
    
    // Create a NEW conversation if we don't have one (New Chat was clicked)
    let conversationId = currentConversationId; 
    if (!conversationId) {
      // Create new conversation with first message as title
      const title = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
      // Get employee_code and source from localStorage if available
      const employeeCode = getEmployeeCode() || undefined;
      const source = localStorage.getItem('source') || 'web';
      const newConversation = await conversationService.createConversation(sessionId, title, employeeCode, source);
      if (newConversation && newConversation.id) {
        conversationId = newConversation.id;
        setCurrentConversationId(conversationId);
        localStorage.removeItem('new_chat_started'); // Clear the flag since we created a new conversation
        await loadConversations(); // Refresh sidebar to show new conversation
      } else {
        console.error('Failed to create conversation');
        return; // Don't proceed if conversation creation failed
      }
    }
    
    // Generate unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Clear input immediately for better UX
    setInputText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Add user message with animation
    const userMsg: Message = {
      id: messageId,
      type: 'user',
      text: userMessage
    };
    setMessages(prev => [...prev, userMsg]);
    
    // Save user message to database
    if (conversationId) {
      const source = localStorage.getItem('source') || undefined;
      await messageService.addMessage(conversationId, 'user', userMessage, source);
    }
    
    setIsLoading(true);

    // Add loading message
    const loadingMessageId = messageId + 1;
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      type: 'bot',
      text: '...',
      isLoading: true
    }]);

    const employeeCode = getEmployeeCode();
    const source = localStorage.getItem('source') || 'web';

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          action: 'sendMessage',
          chatInput: userMessage,
          employee_code: employeeCode,
          source,
        }),
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

      // Remove loading message and add bot response with streaming animation
      const botMsgId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Start with empty text for streaming effect
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId).concat([{
        id: botMsgId,
        type: 'bot',
        text: '',
        isStreaming: true
      }]));

      // Stream the response character by character (ChatGPT-like)
      await streamBotMessage(botMsgId, responseText);
      
      // Save bot response to database
      if (conversationId) {
        const source = localStorage.getItem('source') || undefined;
        await messageService.addMessage(conversationId, 'bot', responseText, source);
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
        errorMessage = `**⚠️ N8N Workflow Not Activated**\n\nYour N8N workflow needs to be activated!\n\n**To fix this:**\n\n1. Open N8N Dashboard\n2. Find your workflow with webhook ID: \`edf7c50a-2d5f-4e1e-b070-1e4de62e098e\`\n3. **Toggle the workflow to ACTIVE** (switch in top-right corner)\n4. Make sure the workflow is saved\n5. Wait a few seconds for N8N to register the webhook\n6. Try sending a message again\n\n**Note:** The workflow must be ACTIVE (green/ON) for production webhooks to work.`;
      } else if (error instanceof Error && error.message === 'N8N_WORKFLOW_ERROR') {
        errorMessage = `**⚠️ N8N Workflow Execution Error**\n\nGood news: The webhook is working! But there's an error inside your N8N workflow.\n\n**To fix this:**\n\n1. Open N8N: **http://localhost:5678**\n2. Go to **Executions** (left sidebar)\n3. Check the latest execution - it will show the error\n4. Common issues:\n   - Missing or incorrect node configuration\n   - Wrong data format expected\n   - Missing required fields\n   - Code errors in Code/Function nodes\n\n**Request sent:**\n\`\`\`json\n${JSON.stringify({ sessionId, action: 'sendMessage', chatInput: userMessage, employee_code: employeeCode, source }, null, 2)}\n\`\`\`\n\n**Check N8N Executions tab for detailed error information.**`;
      } else {
        errorMessage = `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n**Troubleshooting:**\n\n1. ✅ Is the N8N server accessible?\n2. ✅ Is the workflow **ACTIVATED** (toggle switch ON)?\n3. ✅ Does the webhook path match: \`/webhook/edf7c50a-2d5f-4e1e-b070-1e4de62e098e\`?\n4. ✅ Check N8N **Executions** tab for error details\n\n**Webhook URL:** https://n8n.easyhomefinance.in/webhook/edf7c50a-2d5f-4e1e-b070-1e4de62e098e`;
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId).concat([{
        id: loadingMessageId,
        type: 'bot',
        text: errorMessage
      }]));
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; // Max height 200px
  };

  const handleNewChat = async () => {
    // Clear current conversation and start fresh (like ChatGPT)
    setMessages([]);
    setInputText('');
    setCurrentConversationId(null); // Reset to null so next message creates new conversation
    localStorage.removeItem('current_conversation_id'); // Clear saved conversation ID
    localStorage.setItem('new_chat_started', 'true'); // Flag to prevent auto-load on refresh
    // New chat = new session ID so n8n and backend see a distinct conversation
    const newId = crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newId);
    localStorage.setItem('chatbot_session_id', newId);
    await loadConversations(); // Refresh sidebar to update active states
  };

  // Load a conversation and its messages (like ChatGPT - click to continue)
  const loadConversation = async (conversationId: string, forceLoad = false) => {
    // Don't load if it's already the current conversation (unless forced)
    if (!forceLoad && conversationId === currentConversationId && messages.length > 0) return;
    
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

      const conv = await conversationService.getConversation(conversationId);
      if (conv?.session_id) {
        setSessionId(conv.session_id);
        localStorage.setItem('chatbot_session_id', conv.session_id);
      }

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

  // Session timed out
  if (authStatus === 'invalid' || authStatus === 'pending') {
    if (authStatus === 'pending') {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600">Verifying…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-2xl">⏱</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Session timed out</h1>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-full overflow-hidden transition-colors ${
        isDarkMode 
        ? 'bg-gray-900' 
        : 'bg-gray-50'
    }`}>
      {/* Main Chat Area */}
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <div className={`shadow-sm px-4 py-4 flex items-center justify-between transition-colors ${
          isDarkMode
            ? 'bg-gray-800 border-b border-gray-700'
            : 'bg-white'
        }`}>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold brand-title">Pragati AI</h1>
          </div>
          <div className="flex items-center gap-3 flex-1 justify-center">
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
          <div className="flex items-center gap-3">
            {dashboardAllowed && (
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border text-sm font-medium ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
                }`}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </Link>
            )}
            <button
              onClick={handleNewChat}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
              }`}
            >
              <RotateCw size={18} />
              <span className="text-sm font-medium">New Chat</span>
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className={`flex-1 overflow-y-auto px-4 py-6 space-y-4 transition-colors ${
          isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
        }`}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-colors ${
                isDarkMode ? 'bg-red-900/30' : 'bg-red-100'
              }`}>
                <MessageSquare size={32} className="text-red-500" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 transition-colors ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>How can I help you today?</h2>
              <p className={`mb-8 transition-colors ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>Ask me anything about Easy Home Finance Limited</p>
            </div>
          ) : (
            messages.map((message) => (
              message.isLoading ? (
                // Loading state - just "Thinking" text without bubble
                <div key={message.id} className="flex items-start gap-3 animate-chat-enter">
                  {message.type === 'bot' && (
                    <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 bg-red-500 rounded-sm flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 flex justify-start items-center">
                    <div className="flex items-center gap-1.5 py-2">
                      <span className={`text-[15px] leading-relaxed ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>Thinking</span>
                      <div className="flex gap-1 items-center">
                        <span className={`inline-block w-1 h-1 rounded-full ${
                          isDarkMode ? 'bg-gray-500' : 'bg-gray-400'
                        }`} style={{ 
                          animation: 'thinking-dot 1.4s ease-in-out infinite',
                          animationDelay: '0ms'
                        }}></span>
                        <span className={`inline-block w-1 h-1 rounded-full ${
                          isDarkMode ? 'bg-gray-500' : 'bg-gray-400'
                        }`} style={{ 
                          animation: 'thinking-dot 1.4s ease-in-out infinite',
                          animationDelay: '200ms'
                        }}></span>
                        <span className={`inline-block w-1 h-1 rounded-full ${
                          isDarkMode ? 'bg-gray-500' : 'bg-gray-400'
                        }`} style={{ 
                          animation: 'thinking-dot 1.4s ease-in-out infinite',
                          animationDelay: '400ms'
                        }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Normal message with bubble
                <div key={message.id} className={`flex items-start gap-3 animate-chat-enter ${
                  message.type === 'user' ? 'animate-message-slide-up' : ''
                }`}>
                  {message.type === 'bot' && (
                    <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 bg-red-500 rounded-sm flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex-1 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] group relative ${
                      message.type === 'user' 
                        ? 'bg-red-500 text-white rounded-l-3xl rounded-tr-3xl rounded-br-md border border-red-600/40' 
                        : isDarkMode
                          ? 'bg-gray-800 text-gray-100 rounded-r-3xl rounded-tl-3xl rounded-bl-md shadow-sm border border-gray-700'
                          : 'bg-white text-gray-900 rounded-r-3xl rounded-tl-3xl rounded-bl-md shadow-sm border border-gray-200'
                    } px-5 py-4`}>
                      <div className="text-[15px] leading-relaxed prose prose-sm max-w-none" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                        <div
                          dangerouslySetInnerHTML={{ __html: renderMessageText(message.text) }}
                          style={{ lineHeight: '1.6' }}
                        />
                        {message.isStreaming && (
                          <span 
                            className="inline-block w-0.5 h-4 ml-1 bg-gray-500 align-middle" 
                            style={{ 
                              animation: 'blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                              willChange: 'opacity',
                              transform: 'translateZ(0)'
                            }}
                          ></span>
                        )}
                      </div>
                      {/* Copy button - appears on hover */}
                      <button
                        onClick={() => handleCopyMessage(message.text, message.id)}
                        className={`absolute top-2 right-2 p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 ${
                          message.type === 'user'
                            ? 'hover:bg-red-600/80 text-white'
                            : isDarkMode
                              ? 'hover:bg-gray-700 text-gray-300'
                              : 'hover:bg-gray-100 text-gray-600'
                        }`}
                        title="Copy message"
                      >
                        {copiedMessageId === message.id ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  {message.type === 'user' && (
                    <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <User size={20} className="text-red-500" />
                    </div>
                  )}
                </div>
              )
            ))
          )}
        </div>

        {/* Input Area */}
        <div className={`border-t px-4 py-4 transition-colors ${
          isDarkMode
            ? 'bg-gray-900 border-gray-700'
            : 'bg-white border-gray-200'
        }`}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Type a message..."
                  rows={1}
                  disabled={isLoading || isSendingRef.current}
                  className={`w-full rounded-2xl px-5 py-[7px] text-[15px] focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none overflow-hidden ${
                    isLoading || isSendingRef.current
                      ? 'opacity-60 cursor-not-allowed'
                      : ''
                  } ${
                    isDarkMode
                      ? 'bg-gray-800 text-white placeholder-gray-400'
                      : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                  }`}
                  style={{
                    minHeight: '38px',
                    maxHeight: '200px',
                    lineHeight: '1.4'
                  }}
                />
              </div>
              <button 
                onClick={handleSend}
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-200 ease-out mb-0.5 -translate-y-0.5 ${
                  inputText.trim() && !isLoading
                    ? isDarkMode
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md active:scale-95 border-transparent'
                      : 'bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md active:scale-95 border-transparent'
                    : isDarkMode
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-60 border-gray-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60 border-gray-200'
                }`}
                disabled={!inputText.trim() || isLoading}
                title={inputText.trim() ? 'Send message' : 'Enter a message'}
              >
                <ArrowRight 
                  size={20} 
                  className={inputText.trim() && !isLoading ? 'text-white' : ''} 
                  strokeWidth={inputText.trim() && !isLoading ? 2.5 : 2}
                />
              </button>
            </div>
            <p className={`text-xs text-center mt-3 transition-colors ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              Pragati AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
};

export default ChatbotInterface;