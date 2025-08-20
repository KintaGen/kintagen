import React, { useState, useEffect, useRef } from 'react';
import { PaperAirplaneIcon, BeakerIcon } from '@heroicons/react/24/solid';
import { UserCircleIcon, CpuChipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';

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

interface JobStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  // Support both legacy and new shapes
  result?: { reply?: string; output?: string; ok?: boolean } | null;
  error?: string | null;
  text?: string | null; // backend alias for convenience
}

interface PromptHistoryItem {
  id: string;
  prompt: string;
  status: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed';
}

// --- CONSTANTS ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const POLLING_INTERVAL_MS = 2000; // Poll every 2 seconds

// --- PERSISTENT USER ID HELPER ---
function getUserId() {
  let userId = localStorage.getItem('chatUserId');
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem('chatUserId', userId);
  }
  return userId;
}
const USER_ID = getUserId();

// --- Helpers ---
function extractJobText(data?: JobStatus | null): string {
  if (!data) return '';
  const text =
    (typeof data.text === 'string' ? data.text : undefined) ??
    (typeof (data.result as any)?.reply === 'string' ? (data.result as any).reply : undefined) ??
    (typeof (data.result as any)?.output === 'string' ? (data.result as any).output : undefined) ??
    '';
  return (text || '').trim();
}

// --- COMPONENT ---
const ResearchChatPage: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState('Initializing...');

  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // --- INITIAL DATA FETCHING (PROJECTS & HISTORY) ---
  useEffect(() => {
    const loadInitialData = async () => {
      setStatus('Loading projects and chat history...');
      setIsProjectsLoading(true);

      try {
        const [projectsResponse, historyResponse] = await Promise.all([
          fetch(`${API_BASE}/projects`),
          fetch(`${API_BASE}/prompts?user=${USER_ID}&limit=50`),
        ]);

        if (!projectsResponse.ok) throw new Error('Could not fetch projects');
        const projectsData: Project[] = await projectsResponse.json();
        setProjects(projectsData);

        if (!historyResponse.ok) throw new Error('Could not fetch chat history');
        const historyData: { items: PromptHistoryItem[] } = await historyResponse.json();

        const reconstructedMessages: ChatMessage[] = [];
        let jobToResumePolling: string | null = null;

        const sortedJobs = historyData.items.reverse();

        for (const job of sortedJobs) {
          const userQuestion = job.prompt.split('Question: ')[1]?.trim() || job.prompt;
          reconstructedMessages.push({ sender: 'user', text: userQuestion });

          if (job.status === 'completed') {
            const jobDetailsRes = await fetch(`${API_BASE}/prompts/${job.id}`);
            if (jobDetailsRes.ok) {
              const jobDetails: JobStatus = await jobDetailsRes.json();
              const text = extractJobText(jobDetails) || 'Response not found.';
              reconstructedMessages.push({ sender: 'ai', text });
            } else {
              reconstructedMessages.push({ sender: 'ai', text: 'Could not retrieve this response.' });
            }
          } else if (job.status === 'failed') {
            reconstructedMessages.push({ sender: 'ai', text: 'Sorry, this request failed.' });
          } else if (job.status === 'active' || job.status === 'waiting' || job.status === 'delayed') {
            jobToResumePolling = job.id;
          }
        }

        setMessages(reconstructedMessages);

        if (jobToResumePolling) {
          setIsLoading(true);
          setPollingJobId(jobToResumePolling);
          setStatus('Resuming previous request...');
        } else {
          setStatus('Select a project or ask a general question.');
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        setStatus('Could not load projects or history. General chat is available.');
      } finally {
        setIsProjectsLoading(false);
      }
    };

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [messages]);

  // --- POLLING LOGIC ---
  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (!pollingJobId) return;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/prompts/${pollingJobId}`);
        if (!response.ok) throw new Error(`Failed to get job status: ${response.statusText}`);
        const data: JobStatus = await response.json();

        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setPollingJobId(null);

          const text = extractJobText(data) || 'The AI returned an empty response.';
          const aiMessage: ChatMessage = { sender: 'ai', text };
          setMessages((prev) => [...prev, aiMessage]);
          setIsLoading(false);
          setStatus('Ready for your next question.');
        } else if (data.status === 'failed') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setPollingJobId(null);

          const errorMessage: ChatMessage = {
            sender: 'ai',
            text: `Sorry, an error occurred: ${data.error || 'Unknown job failure.'}`,
          };
          setMessages((prev) => [...prev, errorMessage]);
          setIsLoading(false);
          setStatus('An error occurred. Please try again.');
        } else {
          setStatus(`AI is processing... (Status: ${data.status})`);
        }
      } catch (error: any) {
        console.error('Polling error:', error);
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setPollingJobId(null);
        const errorMessage: ChatMessage = {
          sender: 'ai',
          text: `A network error occurred while checking the result: ${error.message}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsLoading(false);
        setStatus('An error occurred. Please try again.');
      }
    };

    poll();
    pollIntervalRef.current = window.setInterval(poll, POLLING_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [pollingJobId]);

  // --- SEND MESSAGE HANDLER ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = { sender: 'user', text: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      let knowledgeBaseContext = '';
      if (selectedProjectId) {
        setStatus('Finding project documents...');
        const papersResponse = await fetch(`${API_BASE}/data/paper?projectId=${selectedProjectId}`);
        if (!papersResponse.ok) throw new Error('Could not fetch papers for this project.');

        const papersResult = await papersResponse.json();
        const papers: PaperInfo[] = papersResult.data || [];

        if (papers.length === 0) {
          knowledgeBaseContext = 'Note to AI: The user selected a project with no documents. Inform them of this.';
          setStatus(`Project has no documents. Submitting question to AI...`);
        } else {
          setStatus(`Found ${papers.length} documents. Preparing knowledge base...`);
          const fetchPromises = papers.map((paper) =>
            fetch(`${API_BASE}/document-content/${paper.cid}`)
              .then((res) => (res.ok ? res.json() : { content: '' }))
              .then((data) => (data.content || ''))
          );
          const documentsContent = await Promise.all(fetchPromises);
          knowledgeBaseContext = documentsContent
            .map(
              (content, index) =>
                `--- DOCUMENT START: ${papers[index].title} ---\n${content}\n--- DOCUMENT END ---`
            )
            .join('\n\n');
        }
      } else {
        setStatus('Engaging general AI model...');
      }

      setStatus('Submitting job to AI queue...');
      const fullPrompt = `Context:\n${knowledgeBaseContext || 'None'}\n\n---\n\nQuestion: ${currentInput}`;

      const createPromptResponse = await fetch(`${API_BASE}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: USER_ID,
          prompt: fullPrompt,
        }),
      });

      if (!createPromptResponse.ok) throw new Error('The AI service failed to accept the job.');

      const jobData = await createPromptResponse.json();
      setStatus('Job submitted. Waiting for result...');
      setPollingJobId(jobData.jobId);
    } catch (error: any) {
      console.error('Error submitting job:', error);
      const errorMessage: ChatMessage = {
        sender: 'ai',
        text: `Sorry, an error occurred when submitting your question: ${error.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      setPollingJobId(null);
      setStatus('Ready for your next question.');
    }
  };

  const selectedProject = projects.find((p) => p.id === Number(selectedProjectId));

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)]">
      {/* Header & Project Selector */}
      <div className="pb-4 border-b border-gray-700">
        <h1 className="text-3xl font-bold">Research Chat</h1>
        <div className="mt-4">
          <label
            htmlFor="project-select"
            className="block text-sm font-medium text-gray-300 mb-2 flex items-center"
          >
            <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400" />
            Knowledge Base Scope
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setStatus(e.target.value ? 'Project selected. Ready for your question.' : 'Switched to General Chat.');
            }}
            disabled={isProjectsLoading || isLoading}
            className="w-full max-w-md bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none"
          >
            <option value="">General Knowledge (No Project)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id.toString()}>
                Project: {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 pt-10">
            {selectedProjectId
              ? `Ask a question about the "${selectedProject?.name}" project.`
              : `Ask a general question. Your conversation history will be saved.`}
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
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

      {/* Input Form */}
      <div className="pt-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={selectedProjectId ? `Ask about "${selectedProject?.name}"...` : 'Ask a general question...'}
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
