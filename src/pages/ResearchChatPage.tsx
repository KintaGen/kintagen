import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { PaperAirplaneIcon, BeakerIcon } from '@heroicons/react/24/solid';
import { UserCircleIcon, CpuChipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import SessionHistoryDropdown from '../components/SessionHistoryDropdown';
import { type ChatSession, type ChatMessage, type ProjectWithNumberId, type PaperInfo } from '../types';

// Re-export for backward compatibility
export type { ChatSession } from '../types';

// Use ProjectWithNumberId for API responses
type Project = ProjectWithNumberId;

// --- PERSISTENCE FOR SESSIONS (Unchanged) ---
const SESSIONS_KEY = 'chatSessions_v4'; // Incremented version to avoid conflicts
const sessionStore = {
  load: (): ChatSession[] => {
    try {
      return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    } catch {
      return [];
    }
  },
  save: (sessions: ChatSession[]) => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error("Could not save sessions to localStorage:", error);
    }
  },
};

// --- COMPONENT ---
const ResearchChatPage: React.FC = () => {
  usePageTitle('Research Chat - KintaGen');
  
  // --- STATE MANAGEMENT ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => sessionStore.load());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- HOOKS & EFFECTS ---
  useEffect(() => {
    sessionStore.save(sessions);
  }, [sessions]);

  // Fetch projects on component mount
  useEffect(() => {
    const fetchProjects = async () => {
      setIsProjectsLoading(true);
      try {
        // In a real app, this would also be a serverless function call
        // For now, we assume it might come from a different API or static data
        // const res = await fetch('/api/projects'); 
        // setProjects(await res.json());
        console.log("Note: Project fetching is mocked for this example.");
        setProjects([{ id: 1, name: "AI Research Papers" }, { id: 2, name: "Web3 Analysis" }]);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setIsProjectsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isSendingMessage]);
  
  // Reset active session when project changes
  useEffect(() => {
    setActiveSessionId(null);
  }, [selectedProjectId]);
  
  // --- DERIVED STATE ---
  const projectIdOrNull = selectedProjectId ? selectedProjectId : null;
  const visibleSessions = useMemo(() => sessions.filter(s => s.projectId === projectIdOrNull), [sessions, projectIdOrNull]);
  const activeMessages = useMemo(() => sessions.find(s => s.id === activeSessionId)?.messages || [], [activeSessionId, sessions]);
  
  // --- HANDLERS ---
  const handleSelectSession = (sessionId: string | null) => {
    setActiveSessionId(sessionId);
  };
  
  const handleClearHistory = () => {
    setSessions(prev => prev.filter(s => s.projectId !== projectIdOrNull));
    setActiveSessionId(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentInput = inputValue.trim();
    if (!currentInput || isSendingMessage) return;

    setIsSendingMessage(true);
    setInputValue('');

    const userMessage: ChatMessage = { sender: 'user', text: currentInput };
    
    // Create new session and add user message immediately for responsive UI
    const newSession: ChatSession = {
      id: Date.now().toString(),
      projectId: projectIdOrNull,
      initialPrompt: currentInput,
      createdAt: Date.now(),
      messages: [userMessage],
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);

    try {
      // Step 1: Gather knowledge base context if a project is selected
      let knowledgeBaseContext = '';
      if (selectedProjectId) {
        // This logic remains the same, assuming these endpoints are available
        // In a real scenario, these could also be Netlify functions
        console.log("Fetching knowledge base for project:", selectedProjectId);
        // NOTE: The following is pseudo-code as we don't have the real API
        // const papersResponse = await fetch(`/api/data/paper?projectId=${selectedProjectId}`);
        // ... logic to build knowledgeBaseContext ...
        knowledgeBaseContext = `This is placeholder context for project "${projects.find(p => p.id.toString() === selectedProjectId)?.name}". In a real app, this would be the content of associated documents.`;
      }

      // Step 2: Call our secure serverless function
      const response = await fetch('/.netlify/functions/research-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: currentInput,
          knowledgeBase: knowledgeBaseContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'The server returned an error.');
      }

      const data = await response.json();
      const aiMessage: ChatMessage = { sender: 'ai', text: data.reply };
      
      // Step 3: Update the session with the AI's response
      setSessions(prev =>
        prev.map(s =>
          s.id === newSession.id
            ? { ...s, messages: [...s.messages, aiMessage] }
            : s
        )
      );

    } catch (error: any) {
      console.error('Error fetching AI response:', error);
      const errorMessage: ChatMessage = {
        sender: 'ai',
        text: `Sorry, I couldn't get a response. Error: ${error.message}`,
      };
      setSessions(prev =>
        prev.map(s =>
          s.id === newSession.id
            ? { ...s, messages: [...s.messages, errorMessage] }
            : s
        )
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Research Chat - KintaGen</title>
        <meta name="description" content="Chat with AI about your research history. Ask questions about your project logs, find past analyses, and get insights from your research metadata." />
        <meta name="keywords" content="AI chat, research assistant, research chat, scientific AI, research questions" />
        <meta property="og:title" content="Research Chat - KintaGen" />
        <meta property="og:description" content="Chat with AI about your research history and get insights from your project metadata." />
      </Helmet>
      <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] bg-gray-800 text-white">
        {/* Header and Controls */}
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-3xl font-bold mb-4">Research Chat</h1>
        <div className="mb-4">
          <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
            <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" /> Knowledge Base Scope
          </label>
          <select id="project-select" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={isProjectsLoading || isSendingMessage} className="w-full max-w-md bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
            <option value="">General Knowledge (No Project)</option>
            {projects.map(project => (<option key={project.id} value={project.id.toString()}>Project: {project.name}</option>))}
          </select>
        </div>
        <SessionHistoryDropdown sessions={visibleSessions} activeSessionId={activeSessionId} onSelectSession={handleSelectSession} onClearHistory={handleClearHistory} />
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        {activeMessages.length === 0 && !isSendingMessage && (
          <div className="text-center text-gray-500 pt-10">Select a past conversation or start a new one by typing below.</div>
        )}

        {activeMessages.map((msg, index) => (
          <div key={`${activeSessionId}-${index}`} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'ai' && <CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />}
            <div className={`max-w-3xl p-4 rounded-lg shadow-md ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
            {msg.sender === 'user' && <UserCircleIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />}
          </div>
        ))}
        
        {isSendingMessage && activeSessionId && (
          <div className="flex items-start gap-4">
            <CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />
            <div className="max-w-xl p-4 rounded-lg bg-gray-700 text-gray-300">
              <div className="flex items-center space-x-2">
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-3" />
                <span>AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
          <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={isSendingMessage ? "Waiting for AI response..." : "Ask a new question..."} disabled={isSendingMessage} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
          <button type="submit" disabled={isSendingMessage || !inputValue.trim()} className="bg-blue-600 text-white p-3 rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed flex-shrink-0">
            <PaperAirplaneIcon className="h-6 w-6" />
          </button>
        </form>
      </div>
    </div>
    </>
  );
};

export default ResearchChatPage;