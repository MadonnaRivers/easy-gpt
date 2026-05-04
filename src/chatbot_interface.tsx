import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, User, Moon, Sun, RotateCw, Copy, Check, LayoutDashboard } from 'lucide-react';
import { conversationService, messageService } from './lib/storage';
import { verifyJwt } from './lib/jwtVerify';

const renderMessageText = (text: string) => {
  let cleanedText = text
    .replace(/^Hello!?\s+Please find below.*?:?\s*\n?/gim, '')
    .replace(/^Hello!?\s+Here are the (policy highlights|policy-based details|policy details).*?:\s*\n?/gim, '')
    .trim();

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
            `<th style="text-align: left; padding: 0.55rem 0.75rem; border-bottom: 1px solid rgba(156, 163, 175, 0.4); font-weight: 600; white-space: nowrap; font-size: 0.875rem;">${cell}</th>`
        )
        .join('');
      const bodyHtml = tableRows
        .map((row) => {
          const cols = headerCells.map((_, idx) => row[idx] || '');
          const cellsHtml = cols
            .map(
              (cell) =>
                `<td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(156, 163, 175, 0.18); vertical-align: top; font-size: 0.875rem;">${cell}</td>`
            )
            .join('');
          return `<tr>${cellsHtml}</tr>`;
        })
        .join('');

      processedLines.push(
        `<div style="margin: 0.5rem 0 0.75rem 0; overflow-x: auto;"><table style="width: 100%; border-collapse: separate; border-spacing: 0; line-height: 1.5; border: 1px solid rgba(156, 163, 175, 0.25); border-radius: 0.6rem; overflow: hidden;"><thead style="background: rgba(156, 163, 175, 0.1);"><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
      );
      isFirstContent = false;
      i = j - 1;
      continue;
    }

    if (trimmedLine.match(/^-{3,}$/)) {
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }
      processedLines.push('<hr style="border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 0.6rem 0; opacity: 0.3;" />');
      isFirstContent = false;
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const fontSize = level === 1 ? '1.4rem' : level === 2 ? '1.2rem' : '1.05rem';
      const marginTop = isFirstContent ? '0' : '0.9rem';
      processedLines.push(`<h${Math.min(level, 6)} style="font-size: ${fontSize}; font-weight: 700; margin: ${marginTop} 0 0.35rem 0; line-height: 1.3; letter-spacing: -0.01em;">${headingText}</h${Math.min(level, 6)}>`);
      isFirstContent = false;
      continue;
    }

    const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);

    if (bulletMatch) {
      const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
      const currentLevel = Math.min(Math.floor(leadingSpaces / 4), 2);

      while (listStack.length > 0 && listStack[listStack.length - 1] > currentLevel) {
        processedLines.push('</ul>');
        listStack.pop();
      }

      if (listStack.length === 0 || listStack[listStack.length - 1] < currentLevel) {
        const marginLeft = currentLevel === 0 ? '1.25rem' : `${1.25 + currentLevel}rem`;
        processedLines.push(`<ul style="list-style-type: disc; margin: 0.15rem 0; padding-left: 0; margin-left: ${marginLeft}; line-height: 1.55;">`);
        listStack.push(currentLevel);
      }

      const content = bulletMatch[1];
      const isSubHeading = content.trim().endsWith(':');
      processedLines.push(`<li style="margin-bottom: 0.15rem; line-height: 1.55; ${isSubHeading ? 'font-weight: 600;' : ''}">${content}</li>`);
      isFirstContent = false;
    } else {
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }

      if (trimmedLine === '') {
        if (processedLines[processedLines.length - 1] !== '<div style="height: 0.5rem"></div>') {
          processedLines.push('<div style="height: 0.5rem"></div>');
        }
      } else {
        const isSubHeading = trimmedLine.endsWith(':') && trimmedLine.length < 100;
        const marginY = isFirstContent ? '0 0 0.2rem 0' : (isSubHeading ? '0.45rem 0 0.2rem 0' : '0.15rem 0');
        processedLines.push(`<p style="margin: ${marginY}; line-height: 1.6; ${isSubHeading ? 'font-weight: 600;' : ''}">${line}</p>`);
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

type AuthStatus = 'pending' | 'valid' | 'invalid' | null;

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

const SUGGESTIONS = [
  { label: 'Home loan eligibility', hint: 'What are the requirements?' },
  { label: 'Interest rates', hint: 'Current rates & product types' },
  { label: 'Policy highlights', hint: 'Summarise key policy terms' },
  { label: 'EMI calculation', hint: 'How is monthly EMI computed?' },
];

const ChatbotInterface = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(initialAuthStatus);
  const [dashboardAllowed, setDashboardAllowed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
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
    const stored = localStorage.getItem('chatbot_session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatbot_session_id', newId);
    return newId;
  });

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

  useEffect(() => {
    if (authStatus === 'pending' || authStatus === 'invalid') {
      setDashboardAllowed(false);
      return;
    }
    setDashboardAllowed(sessionStorage.getItem('easygpt_access') === 'predefined');
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === 'pending' || authStatus === 'invalid') return;

    const initializeConversation = async () => {
      const emp = getEmployeeCode();
      if (!emp && !import.meta.env.DEV) return;

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

  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('current_conversation_id', currentConversationId);
    } else {
      localStorage.removeItem('current_conversation_id');
    }
  }, [currentConversationId]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleCopyMessage = async (text: string, messageId: string | number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const streamBotMessage = async (messageId: string, fullText: string) => {
    return new Promise<void>((resolve) => {
      let currentIndex = 0;
      const charsPerFrame = 2;
      const minDelay = 16;
      const scrollThreshold = 120;

      const animate = () => {
        if (currentIndex < fullText.length) {
          const endIndex = Math.min(currentIndex + charsPerFrame, fullText.length);
          const currentText = fullText.substring(0, endIndex);

          setMessages(prev =>
            prev.map(msg =>
              msg.id === messageId
                ? { ...msg, text: currentText, isStreaming: endIndex < fullText.length }
                : msg
            )
          );

          const chatContainer = document.querySelector('.messages-scroll');
          if (chatContainer) {
            const distanceFromBottom =
              chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
            if (distanceFromBottom < scrollThreshold) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }

          currentIndex = endIndex;
          setTimeout(animate, minDelay);
        } else {
          setMessages(prev =>
            prev.map(msg => (msg.id === messageId ? { ...msg, isStreaming: false } : msg))
          );
          resolve();
        }
      };

      setTimeout(animate, 0);
    });
  };

  const N8N_WEBHOOK_URL =
    'https://n8n.easyhomefinance.in/webhook/edf7c50a-2d5f-4e1e-b070-1e4de62e098e';

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || isSendingRef.current) return;

    isSendingRef.current = true;
    const userMessage = inputText.trim();

    let conversationId = currentConversationId;
    if (!conversationId) {
      const title = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
      const employeeCode = getEmployeeCode() || undefined;
      const source = localStorage.getItem('source') || 'web';
      const newConversation = await conversationService.createConversation(
        sessionId,
        title,
        employeeCode,
        source
      );
      if (newConversation && newConversation.id) {
        conversationId = newConversation.id;
        setCurrentConversationId(conversationId);
        localStorage.removeItem('new_chat_started');
      } else {
        console.error('Failed to create conversation');
        return;
      }
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: Message = { id: messageId, type: 'user', text: userMessage };
    setMessages(prev => [...prev, userMsg]);

    if (conversationId) {
      const source = localStorage.getItem('source') || undefined;
      await messageService.addMessage(conversationId, 'user', userMessage, source);
    }

    setIsLoading(true);

    const loadingMessageId = messageId + 1;
    setMessages(prev => [
      ...prev,
      { id: loadingMessageId, type: 'bot', text: '...', isLoading: true },
    ]);

    const employeeCode = getEmployeeCode();
    const source = localStorage.getItem('source') || 'web';

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'sendMessage',
          chatInput: userMessage,
          employee_code: employeeCode,
          source,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        throw new Error('Invalid response from server');
      }

      if (!response.ok || (data.code && (data.code === 404 || data.code === 500))) {
        const errorMsg = data.message || data.error || `HTTP error! status: ${response.status}`;
        if (errorMsg.includes('not registered') || errorMsg.includes('The requested webhook')) {
          throw new Error('N8N_WEBHOOK_NOT_REGISTERED');
        }
        if (errorMsg.includes('Error in workflow') || response.status === 500) {
          throw new Error('N8N_WORKFLOW_ERROR');
        }
        throw new Error(errorMsg);
      }

      let responseText = '';
      if (typeof data === 'string') responseText = data;
      else if (data.output) responseText = data.output;
      else if (data.response) responseText = data.response;
      else if (data.message && !data.code) responseText = data.message;
      else if (data.text) responseText = data.text;
      else responseText = JSON.stringify(data);

      const botMsgId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setMessages(prev =>
        prev
          .filter(msg => msg.id !== loadingMessageId)
          .concat([{ id: botMsgId, type: 'bot', text: '', isStreaming: true }])
      );

      await streamBotMessage(botMsgId, responseText);

      if (conversationId) {
        const src = localStorage.getItem('source') || undefined;
        await messageService.addMessage(conversationId, 'bot', responseText, src);
        const conv = await conversationService.getConversation(conversationId);
        if (conv && userMessage.length <= 50) {
          if (
            conv.title !== userMessage &&
            (conv.title.startsWith('New Chat') || conv.title.length > 50)
          ) {
            await conversationService.updateConversationTitle(conversationId, userMessage);
          }
        }
      }

      setTimeout(() => {
        const chatContainer = document.querySelector('.messages-scroll');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 100);
    } catch (error) {
      console.error('Error calling N8N webhook:', error);

      let errorMessage = '';

      if (error instanceof Error && error.message === 'N8N_WEBHOOK_NOT_REGISTERED') {
        errorMessage = `**⚠️ N8N Workflow Not Activated**\n\nYour N8N workflow needs to be activated!\n\n**To fix this:**\n\n1. Open N8N Dashboard\n2. Find your workflow with webhook ID: \`edf7c50a-2d5f-4e1e-b070-1e4de62e098e\`\n3. **Toggle the workflow to ACTIVE** (switch in top-right corner)\n4. Make sure the workflow is saved\n5. Wait a few seconds for N8N to register the webhook\n6. Try sending a message again\n\n**Note:** The workflow must be ACTIVE (green/ON) for production webhooks to work.`;
      } else if (error instanceof Error && error.message === 'N8N_WORKFLOW_ERROR') {
        errorMessage = `**⚠️ N8N Workflow Execution Error**\n\nGood news: The webhook is working! But there's an error inside your N8N workflow.\n\n**To fix this:**\n\n1. Open N8N: **http://localhost:5678**\n2. Go to **Executions** (left sidebar)\n3. Check the latest execution — it will show the error\n4. Common issues:\n   - Missing or incorrect node configuration\n   - Wrong data format expected\n   - Missing required fields\n   - Code errors in Code/Function nodes\n\n**Request sent:**\n\`\`\`json\n${JSON.stringify({ sessionId, action: 'sendMessage', chatInput: userMessage, employee_code: employeeCode, source }, null, 2)}\n\`\`\`\n\n**Check N8N Executions tab for detailed error information.**`;
      } else {
        errorMessage = `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n**Troubleshooting:**\n\n1. ✅ Is the N8N server accessible?\n2. ✅ Is the workflow **ACTIVATED** (toggle switch ON)?\n3. ✅ Does the webhook path match: \`/webhook/edf7c50a-2d5f-4e1e-b070-1e4de62e098e\`?\n4. ✅ Check N8N **Executions** tab for error details\n\n**Webhook URL:** https://n8n.easyhomefinance.in/webhook/edf7c50a-2d5f-4e1e-b070-1e4de62e098e`;
      }

      setMessages(prev =>
        prev
          .filter(msg => msg.id !== loadingMessageId)
          .concat([{ id: loadingMessageId, type: 'bot', text: errorMessage }])
      );
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
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const handleNewChat = async () => {
    setMessages([]);
    setInputText('');
    setCurrentConversationId(null);
    localStorage.removeItem('current_conversation_id');
    localStorage.setItem('new_chat_started', 'true');
    const newId = crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newId);
    localStorage.setItem('chatbot_session_id', newId);
  };

  const loadConversation = async (conversationId: string, forceLoad = false) => {
    if (!forceLoad && conversationId === currentConversationId && messages.length > 0) return;

    setIsLoading(true);
    try {
      const dbMessages = await messageService.getMessages(conversationId);
      const formattedMessages: Message[] = dbMessages.map((msg, index) => ({
        id: msg.id || `msg-${index}`,
        type: msg.role,
        text: msg.content,
      }));

      setMessages(formattedMessages);
      setCurrentConversationId(conversationId);

      const conv = await conversationService.getConversation(conversationId);
      if (conv?.session_id) {
        setSessionId(conv.session_id);
        localStorage.setItem('chatbot_session_id', conv.session_id);
      }

      setTimeout(() => {
        const chatContainer = document.querySelector('.messages-scroll');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 100);
    } catch (error) {
      console.error('Error loading conversation:', error);
      alert('Failed to load conversation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Auth gate screens ────────────────────────────────────── */

  if (authStatus === 'pending') {
    return (
      <div className={`h-screen w-full flex items-center justify-center ${isDarkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="text-center animate-fade-in-up">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
          </div>
          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Verifying your access…</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'invalid') {
    return (
      <div className={`h-screen w-full flex items-center justify-center ${isDarkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="text-center animate-fade-in-up max-w-sm px-6">
          <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-red-900/30' : 'bg-red-50'}`}>
            <span className="text-3xl">⏱</span>
          </div>
          <h1 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Session timed out</h1>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Please reload the page or contact support to continue.</p>
        </div>
      </div>
    );
  }

  /* ── Main App ─────────────────────────────────────────────── */

  const dm = isDarkMode;

  return (
    <div className={`h-screen w-full overflow-hidden flex ${dm ? 'bg-gray-950' : 'bg-[#f5f5f6]'}`}>

      {/* ─── Main area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header
          className={`flex items-center justify-between px-4 py-[11px] border-b z-10
            ${dm ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-gray-100'}
          `}
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <span className="brand-title text-[17px] font-bold tracking-tight">Pragati AI</span>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 border
                ${dm
                  ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'
                }`}
            >
              <RotateCw size={14} strokeWidth={2.5} />
              New chat
            </button>
            {dashboardAllowed && (
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 border
                  ${dm
                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'
                  }`}
              >
                <LayoutDashboard size={14} />
                Dashboard
              </Link>
            )}
            <button
              onClick={toggleDarkMode}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 border
                ${dm
                  ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'
                }`}
            >
              {dm ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
              <span className="hidden sm:inline">{dm ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          className={`messages-scroll flex-1 overflow-y-auto transition-colors ${dm ? 'bg-gray-950' : 'bg-[#f5f5f6]'}`}
        >
          {messages.length === 0 ? (
            /* ── Welcome screen ── */
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div
                className="animate-fade-in-up"
                style={{ animationDelay: '0ms' }}
              >
                <div className="w-[60px] h-[60px] mx-auto mb-6 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg animate-icon-float">
                  <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                </div>
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                <h2 className={`text-[22px] font-bold tracking-tight mb-2 ${dm ? 'text-white' : 'text-gray-900'}`}>
                  How can I help you today?
                </h2>
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                <p className={`text-sm max-w-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                  Ask me anything about Easy Home Finance policies and services.
                </p>
              </div>

              <div
                className="animate-fade-in-up mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-[480px]"
                style={{ animationDelay: '230ms' }}
              >
                {SUGGESTIONS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputText(chip.label);
                      textareaRef.current?.focus();
                    }}
                    className={`text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200
                      hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]
                      ${dm
                        ? 'bg-gray-800/80 border-gray-700 text-gray-200 hover:bg-gray-800 hover:border-gray-600'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="font-medium text-[13.5px]">{chip.label}</div>
                    <div className={`text-[12px] mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{chip.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Message list ── */
            <div className="max-w-[720px] mx-auto px-4 py-7 space-y-7">
              {messages.map(message => {
                if (message.isLoading) {
                  /* Thinking indicator */
                  return (
                    <div key={message.id} className="flex items-start gap-3.5 animate-chat-enter">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${dm ? 'bg-red-900/40' : 'bg-red-100'}`}>
                        <div className="w-[22px] h-[22px] bg-red-500 rounded-lg flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1.5">
                        <span className={`text-[13.5px] ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Thinking</span>
                        <div className="flex gap-[5px] ml-0.5">
                          {[0, 1, 2].map(i => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${dm ? 'bg-gray-500' : 'bg-gray-400'}`}
                              style={{
                                animation: 'thinking-wave 1.2s ease-in-out infinite',
                                animationDelay: `${i * 150}ms`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (message.type === 'bot') {
                  /* Bot message – no bubble, full-width text */
                  return (
                    <div key={message.id} className="flex items-start gap-3.5 animate-chat-enter group">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 ${dm ? 'bg-red-900/40' : 'bg-red-100'}`}>
                        <div className="w-[22px] h-[22px] bg-red-500 rounded-lg flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[14.5px] leading-relaxed ${dm ? 'text-gray-100' : 'text-gray-800'}`}
                          style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                        >
                          <div
                            dangerouslySetInnerHTML={{ __html: renderMessageText(message.text) }}
                            style={{ lineHeight: '1.65' }}
                          />
                          {message.isStreaming && (
                            <span
                              className={`inline-block w-[2px] h-[1em] ml-0.5 align-middle rounded-sm ${dm ? 'bg-gray-400' : 'bg-gray-500'}`}
                              style={{ animation: 'blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                            />
                          )}
                        </div>

                        {/* Copy button – visible on hover */}
                        <button
                          onClick={() => handleCopyMessage(message.text, message.id)}
                          className={`mt-2.5 flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-lg
                            transition-all duration-150 opacity-0 group-hover:opacity-100
                            ${dm
                              ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          {copiedMessageId === message.id ? (
                            <><Check size={12} className="text-green-500" /><span className="text-green-500">Copied</span></>
                          ) : (
                            <><Copy size={12} /><span>Copy</span></>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }

                /* User message – right-aligned pill */
                return (
                  <div key={message.id} className="flex justify-end animate-message-slide-up">
                    <div className="flex items-start gap-3 max-w-[78%]">
                      <div className="relative group">
                        <div className="bg-red-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[14.5px] leading-relaxed shadow-sm"
                          style={{ wordWrap: 'break-word', overflowWrap: 'break-word', lineHeight: '1.6' }}
                        >
                          {message.text}
                        </div>
                        <button
                          onClick={() => handleCopyMessage(message.text, message.id)}
                          className="absolute -top-1 -left-8 p-1.5 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100
                            text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          title="Copy"
                        >
                          {copiedMessageId === message.id ? (
                            <Check size={12} className="text-green-500" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${dm ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <User size={15} className={dm ? 'text-gray-300' : 'text-gray-500'} strokeWidth={2} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Input area ──────────────────────────────────────── */}
        <div className={`border-t px-4 py-4 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="max-w-[720px] mx-auto">
            <div
              className={`flex items-end gap-3 rounded-2xl border px-4 py-3 transition-all duration-200
                focus-within:ring-2 focus-within:ring-red-500/25 focus-within:border-red-400/50
                ${dm
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-gray-50 border-gray-200'
                }`}
            >
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyPress}
                placeholder="Message Pragati AI…"
                rows={1}
                disabled={isLoading || isSendingRef.current}
                className={`flex-1 bg-transparent resize-none outline-none text-[14.5px] transition-opacity
                  ${isLoading || isSendingRef.current ? 'opacity-50 cursor-not-allowed' : ''}
                  ${dm ? 'text-gray-100 placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}
                `}
                style={{ minHeight: '24px', maxHeight: '200px', lineHeight: '1.5' }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center flex-none transition-all duration-200
                  ${inputText.trim() && !isLoading
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md active:scale-95'
                    : dm
                      ? 'bg-gray-700 text-gray-600 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            </div>
            <p className={`text-[11.5px] text-center mt-2.5 ${dm ? 'text-gray-600' : 'text-gray-400'}`}>
              Pragati AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChatbotInterface;
