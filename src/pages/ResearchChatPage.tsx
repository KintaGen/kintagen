// src/pages/ResearchChatPage.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PaperAirplaneIcon, BeakerIcon } from '@heroicons/react/24/solid';
import { UserCircleIcon, CpuChipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

import { observeJobIds } from '../utils/jobs';

import { fetchWithBypass } from '../utils/fetchWithBypass';
import {
  jobsStorage,
  startJobPolling,
  type Job,
  type JobState,
} from '../utils/jobs';

// --- TYPE DEFINITIONS ---
interface ChatMessage {
  sender: 'user' | 'ai';
  text: string | null;
}

interface Project {
  id: number;
  name: string;
}

interface PaperInfo {
  cid: string;
  title: string;
}

// --- CONSTANTS ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// --- COMPONENT ---
const ResearchChatPage: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState("Select a project or ask a general question.");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  // jobs (persisted; shared utils)
  const [jobs, setJobs] = useState<Job[]>(() => jobsStorage.load());
  useEffect(() => jobsStorage.save(jobs), [jobs]);

  // we only care about chat jobs here
  const chatJobs = useMemo(() => jobs.filter(j => j.kind === 'chat'), [jobs]);
  const incompleteChatIds = useMemo(
    () => chatJobs.filter(j => j.state !== 'completed' && j.state !== 'failed').map(j => j.id),
    [chatJobs]
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const stopPollRef = useRef<null | (() => void)>(null);
  const appendedJobIdsRef = useRef<Set<string>>(new Set()); // prevent duplicate message appends

  // --- DATA FETCHING & EFFECTS ---
  useEffect(() => {
    const fetchProjects = async () => {
      setIsProjectsLoading(true);
      try {
        const response = await fetchWithBypass(`${API_BASE}/projects`);
        if (!response.ok) throw new Error('Could not fetch projects');
        const data: Project[] = await response.json();
        setProjects(data);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
        setStatus("Could not load projects. General chat is available.");
      } finally {
        setIsProjectsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatJobs.length]);

  // start/stop polling for any incomplete chat jobs
  useEffect(() => {
    if (stopPollRef.current) {
      stopPollRef.current();
      stopPollRef.current = null;
    }
    if (incompleteChatIds.length === 0) return;

    stopPollRef.current = startJobPolling({
      ids: incompleteChatIds,
      intervalMs: 1500,
      fetcher: async (id: string) => {
        const r = await fetchWithBypass(`${API_BASE}/analyze/jobs/${id}`);
        if (!r.ok) throw new Error(`Failed to fetch job ${id}`);
        return r.json();
      },
      onUpdate: (snapshot) => {
        // Update job state in local list
        setJobs(prev =>
          prev.map(j => j.id === snapshot.id
            ? {
                ...j,
                state: snapshot.state as JobState,
                progress: typeof snapshot.progress === 'number' ? snapshot.progress : j.progress,
                failedReason: snapshot.failedReason ?? null,
                returnvalue: snapshot.returnvalue ?? j.returnvalue ?? null,
                logs: Array.isArray(snapshot.logs) ? snapshot.logs : j.logs,
                finishedOn: snapshot.finishedOn ?? j.finishedOn ?? null,
              }
            : j
          )
        );

        // If the chat job just completed and we haven't appended its reply yet, append it to messages
        if (snapshot.state === 'completed' && !appendedJobIdsRef.current.has(snapshot.id)) {
          const reply =
            typeof snapshot.returnvalue === 'string'
              ? snapshot.returnvalue
              : snapshot.returnvalue?.reply ?? snapshot.returnvalue?.text ?? '';

          if (reply && reply.trim().length > 0) {
            setMessages(prev => [...prev, { sender: 'ai', text: reply }]);
          } else {
            setMessages(prev => [...prev, { sender: 'ai', text: 'Done, but no reply payload was returned.' }]);
          }
          appendedJobIdsRef.current.add(snapshot.id);
          setStatus("Ready for your next question.");
        }

        // If the job failed, drop a failure bubble once
        if (snapshot.state === 'failed' && !appendedJobIdsRef.current.has(snapshot.id)) {
          const reason = snapshot.failedReason || 'The job failed.';
          setMessages(prev => [...prev, { sender: 'ai', text: `Sorry, I couldn’t complete that: ${reason}` }]);
          appendedJobIdsRef.current.add(snapshot.id);
          setStatus("Ready for your next question.");
        }
      },
    });

    return () => {
      if (stopPollRef.current) {
        stopPollRef.current();
        stopPollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incompleteChatIds.join('|')]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
  
    const userMessage: ChatMessage = { sender: 'user', text: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setStatus('Queuing AI job…');
  
    try {
      // Build knowledge-base context (unchanged behavior)
      let knowledgeBaseContext = '';
  
      if (selectedProjectId) {
        setStatus('Finding project documents…');
        const papersResponse = await fetch(`${API_BASE}/data/paper?projectId=${selectedProjectId}`);
        if (!papersResponse.ok) throw new Error('Could not fetch papers for this project.');
        const papersResult = await papersResponse.json();
        const papers: PaperInfo[] = papersResult.data || [];
  
        if (papers.length === 0) {
          knowledgeBaseContext = 'Note to AI: The user selected a project with no documents. Inform them of this.';
          setStatus('Project has no documents. Asking AI…');
        } else {
          setStatus(`Found ${papers.length} documents. Preparing knowledge base…`);
          const fetchPromises = papers.map((paper) =>
            fetch(`${API_BASE}/document-content/${paper.cid}`)
              .then((res) => (res.ok ? res.json() : { content: '' }))
              .then((data) => data.content || '')
          );
          const documentsContent = await Promise.all(fetchPromises);
          knowledgeBaseContext = documentsContent
            .map((content, index) => `--- DOCUMENT START: ${papers[index].title} ---\n${content}\n--- DOCUMENT END ---`)
            .join('\n\n');
        }
      } else {
        setStatus('Engaging general AI model…');
      }
  
      // *** enqueue the worker job (ALWAYS returns { jobId }) ***
      setStatus('AI is working… 0%');
      const r = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          filecoinContext: knowledgeBaseContext,
        }),
      });
      if (!r.ok) throw new Error('Failed to enqueue chat');
      const { jobId } = await r.json();
  
      // *** follow only this job until it completes ***
      const stop = observeJobIds({
        apiBase: API_BASE,
        ids: jobId,
        intervalMs: 1200,
        onUpdate: (snap) => {
          // progress UI
          if (typeof snap.progress === 'number') {
            const pct = Math.max(0, Math.min(100, Math.round(snap.progress)));
            setStatus(`AI is working… ${pct}%`);
          }
  
          // terminal states
          if (snap.state === 'completed') {
            const reply = snap.returnvalue?.reply ?? '(no content)';
            setMessages((prev) => [...prev, { sender: 'ai', text: reply }]);
            setIsLoading(false);
            setStatus('Ready for your next question.');
            stop(); // stop polling this job
          } else if (snap.state === 'failed') {
            const reason = snap.failedReason || 'Unknown error';
            setMessages((prev) => [...prev, { sender: 'ai', text: `Sorry, the job failed: ${reason}` }]);
            setIsLoading(false);
            setStatus('Ready for your next question.');
            stop();
          }
        },
      });
    } catch (error: any) {
      console.error('Error during chat process:', error);
      const errorMessage: ChatMessage = { sender: 'ai', text: `Sorry, an error occurred: ${error.message}` };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      setStatus('Ready for your next question.');
    }
  };
  const selectedProject = projects.find(p => p.id === Number(selectedProjectId));
  const pendingChatJobs = chatJobs.filter(j => j.state !== 'completed' && j.state !== 'failed');

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)]">
      {/* --- Header & Project Selector --- */}
      <div className="pb-4 border-b border-gray-700">
        <h1 className="text-3xl font-bold">Research Chat</h1>
        <div className="mt-4">
          <label htmlFor="project-select" className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
            <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" />
            Knowledge Base Scope
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setMessages([]);
              setStatus(e.target.value ? "Project selected. Ready for your question." : "Switched to General Chat.");
            }}
            disabled={isProjectsLoading || isLoading}
            className="w-full max-w-md bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none"
          >
            <option value="">General Knowledge (No Project)</option>
            {projects.map(project => (
              <option key={project.id} value={project.id.toString()}>
                Project: {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- Chat Messages Area --- */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && pendingChatJobs.length === 0 && (
          <div className="text-center text-gray-500 pt-10">
            {selectedProjectId
              ? `Ask a question about the "${selectedProject?.name}" project.`
              : `Ask a general question. No project-specific knowledge will be used.`}
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={`msg-${index}`} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'ai' && <CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />}
            <div
              className={`max-w-3xl p-4 rounded-lg shadow-md ${
                msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
            {msg.sender === 'user' && <UserCircleIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />}
          </div>
        ))}

        {/* Pending chat jobs show as "AI is working" bubbles; persists across refresh */}
        {pendingChatJobs.map(job => (
          <div key={`job-${job.id}`} className="flex items-start gap-4">
            <CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />
            <div className="max-w-xl p-4 rounded-lg bg-gray-700 text-gray-300">
              <div className="flex items-center space-x-2">
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-3" />
                <span>
                  {job.state === 'active' ? 'AI is working…' : job.state === 'delayed' ? 'Waiting in queue…' : 'Queued…'}
                  {typeof job.progress === 'number' ? ` ${Math.max(0, Math.min(100, job.progress))}%` : ''}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-400">“{job.label}”</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-4">
            <CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />
            <div className="max-w-xl p-4 rounded-lg bg-gray-700 text-gray-400">
              <div className="flex items-center space-x-2">
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-3" />
                <span>{status}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* --- Input Form --- */}
      <div className="pt-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={selectedProjectId ? `Ask about "${selectedProject?.name}"...` : "Ask a general question..."}
            disabled={isLoading}
            className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-blue-600 text-white p-3 rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-6 w-6" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResearchChatPage;
