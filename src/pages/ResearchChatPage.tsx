// src/pages/ResearchChatPage.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PaperAirplaneIcon, BeakerIcon } from '@heroicons/react/24/solid';
import { UserCircleIcon, CpuChipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import SessionHistoryDropdown, { type ChatSession } from '../components/SessionHistoryDropdown';
import { queueChatJob, type Job } from '../utils/jobs';
import { useJobs } from '../contexts/JobContext';
import { fetchWithBypass } from '../utils/fetchWithBypass';

// --- TYPE DEFINITIONS ---
interface ChatMessage { sender: 'user' | 'ai'; text: string | null; }
interface Project { id: number; name: string; }
interface PaperInfo { cid: string; title: string; }

// --- PERSISTENCE FOR SESSIONS ---
const SESSIONS_KEY = 'chatSessions_v3';
const sessionStore = {
  load: (): ChatSession[] => JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'),
  save: (sessions: ChatSession[]) => localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)),
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// --- COMPONENT ---
const ResearchChatPage: React.FC = () => {
  // Global Job State from Context
  const { jobs, setJobs } = useJobs();

  // Page-Specific State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => sessionStore.load());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState<string>('');
  const [isQueuing, setIsQueuing] = useState<boolean>(false);

  // --- HOOKS & EFFECTS ---
  useEffect(() => sessionStore.save(sessions), [sessions]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // --- DERIVED STATE ---
  const projectIdOrNull = selectedProjectId ? selectedProjectId : null;
  const visibleSessions = useMemo(() => sessions.filter(s => s.projectId === projectIdOrNull), [sessions, projectIdOrNull]);
  const activeMessages = useMemo(() => sessions.find(s => s.id === activeSessionId)?.messages || [], [activeSessionId, sessions]);
  const aChatJobIsPending = useMemo(() => jobs.some(j => j.kind === 'chat' && j.state !== 'completed' && j.state !== 'failed'), [jobs]);
  const activeJobIsRunning = useMemo(() => {
    if (!activeSessionId) return false;
    const activeJob = jobs.find(j => j.id === activeSessionId);
    return activeJob ? (activeJob.state !== 'completed' && activeJob.state !== 'failed') : false;
  }, [activeSessionId, jobs]);

  // Effect to process finished jobs, add replies, and prevent storage quota errors
  useEffect(() => {
    let sessionsNeedUpdate = false;
    let jobsNeedPruning = false;

    const updatedSessions = [...sessions];

    jobs.forEach(job => {
      if (job.kind !== 'chat' || (job.state !== 'completed' && job.state !== 'failed')) return;

      const sessionIndex = updatedSessions.findIndex(s => s.id === job.id);
      if (sessionIndex === -1 || updatedSessions[sessionIndex].messages.some(m => m.sender === 'ai')) return;

      let newMessage: ChatMessage | null = null;
      if (job.state === 'completed') {
        newMessage = { sender: 'ai', text: job.returnvalue?.reply ?? 'The AI returned an empty response.' };
      } else if (job.state === 'failed') {
        newMessage = { sender: 'ai', text: `Sorry, I couldn’t complete that: ${job.failedReason || 'Unknown error'}` };
      }

      if (newMessage) {
        updatedSessions[sessionIndex] = { ...updatedSessions[sessionIndex], messages: [...updatedSessions[sessionIndex].messages, newMessage] };
        sessionsNeedUpdate = true;
        jobsNeedPruning = true;
      }
    });

    if (sessionsNeedUpdate) {
      setSessions(updatedSessions);
    }

    if (jobsNeedPruning) {
      setJobs(prevJobs =>
        prevJobs.map(job => {
          if (job.kind === 'chat' && job.returnvalue != null && (job.state === 'completed' || job.state === 'failed')) {
            return { ...job, returnvalue: null }; // Prune the large data
          }
          return job;
        })
      );
    }
  }, [jobs, setJobs, sessions]);

  // Effect to fetch projects on mount
  useEffect(() => {
    (async () => {
      setIsProjectsLoading(true);
      try {
        const res = await fetchWithBypass(`${API_BASE}/projects`);
        if (!res.ok) throw new Error("Could not fetch projects");
        setProjects(await res.json());
      } catch (err) { console.error(err); }
      finally { setIsProjectsLoading(false); }
    })();
  }, []);
  
  useEffect(() => { setActiveSessionId(null); }, [selectedProjectId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages]);
  
  const handleSelectSession = (sessionId: string | null) => setActiveSessionId(sessionId);
  const handleClearHistory = () => {
    const sessionsToClear = sessions.filter(s => s.projectId === projectIdOrNull).map(s => s.id);
    setSessions(prev => prev.filter(s => s.projectId !== projectIdOrNull));
    setJobs(prev => prev.filter(j => !sessionsToClear.includes(j.id)));
    setActiveSessionId(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentInput = inputValue.trim();
    if (!currentInput || isQueuing || aChatJobIsPending) return;

    const userMessage: ChatMessage = { sender: 'user', text: currentInput };
    setInputValue('');
    setIsQueuing(true);
    setActiveSessionId(null);

    try {
      let knowledgeBaseContext = '';
      if (selectedProjectId) {
        const papersResponse = await fetch(`${API_BASE}/data/paper?projectId=${selectedProjectId}`);
        if (papersResponse.ok) {
          const papers: PaperInfo[] = (await papersResponse.json()).data || [];
          const fetchPromises = papers.map(paper =>
            fetch(`${API_BASE}/document-content/${paper.cid}`)
              .then(res => res.ok ? res.json() : { content: '' })
              .then(data => `--- DOCUMENT: ${paper.title} ---\n${data.content || ''}`)
          );
          knowledgeBaseContext = (await Promise.all(fetchPromises)).join('\n\n');
        }
      }
      const { job } = await queueChatJob({
        apiBase: API_BASE, body: { messages: [userMessage], filecoinContext: knowledgeBaseContext },
      });
      const newSession: ChatSession = {
        id: job.id, projectId: projectIdOrNull, initialPrompt: job.label, createdAt: job.createdAt, messages: [userMessage],
      };
      setJobs(prev => [job, ...prev]);
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    } catch (error: any) { console.error('Error creating chat session:', error); }
    finally { setIsQueuing(false); }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)]">
      {/* Header and Controls */}
      <div className="pb-4 border-b border-gray-700">
        <h1 className="text-3xl font-bold mb-4">Research Chat</h1>
        <div className="mb-4">
          <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
            <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" /> Knowledge Base Scope
          </label>
          <select id="project-select" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={isProjectsLoading} className="w-full max-w-md bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none disabled:opacity-50">
            <option value="">General Knowledge (No Project)</option>
            {projects.map(project => (<option key={project.id} value={project.id.toString()}>Project: {project.name}</option>))}
          </select>
        </div>
        <SessionHistoryDropdown sessions={visibleSessions} activeSessionId={activeSessionId} onSelectSession={handleSelectSession} onClearHistory={handleClearHistory}/>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        {activeMessages.length === 0 && !activeJobIsRunning && (<div className="text-center text-gray-500 pt-10">Select a past conversation or start a new one by typing below.</div>)}
        {activeMessages.map((msg, index) => (<div key={`${activeSessionId}-${index}`} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>{msg.sender === 'ai' && <CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />}<div className={`max-w-3xl p-4 rounded-lg shadow-md ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}><p className="whitespace-pre-wrap">{msg.text}</p></div>{msg.sender === 'user' && <UserCircleIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />}</div>))}
        {activeJobIsRunning && (<div className="flex items-start gap-4"><CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" /><div className="max-w-xl p-4 rounded-lg bg-gray-700 text-gray-300"><div className="flex items-center space-x-2"><ArrowPathIcon className="h-5 w-5 animate-spin mr-3" /><span>AI is working on this conversation…</span></div></div></div>)}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form and Global Status */}
      <div className="pt-4 border-t border-gray-700">
        {aChatJobIsPending && !activeJobIsRunning && (
          <div className="text-xs text-gray-400 text-center pb-3 flex items-center justify-center">
            <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
            An AI job is running in the background. Please wait for it to complete before starting a new one.
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
          <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={aChatJobIsPending ? "Waiting for AI job to finish..." : "Ask a new question..."} disabled={isQueuing || aChatJobIsPending} className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-3 px-4 text-white focus:outline-none disabled:opacity-50" />
          <button type="submit" disabled={isQueuing || !inputValue.trim() || aChatJobIsPending} className="bg-blue-600 text-white p-3 rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed"><PaperAirplaneIcon className="h-6 w-6" /></button>
        </form>
      </div>
    </div>
  );
};

export default ResearchChatPage;