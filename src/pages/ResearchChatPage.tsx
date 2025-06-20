// src/pages/ResearchChatPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { PaperAirplaneIcon, BeakerIcon } from '@heroicons/react/24/solid';
import { UserCircleIcon, CpuChipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

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
const API_URL = 'http://127.0.0.1:3001/api';
const buildFilcdnUrl = (cid: string) => `https://0xcdb8cc9323852ab3bed33f6c54a7e0c15d555353.calibration.filcdn.io/${cid}`;

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

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- DATA FETCHING & EFFECTS ---
  useEffect(() => {
    const fetchProjects = async () => {
      setIsProjectsLoading(true);
      try {
        const response = await fetch(`${API_URL}/projects`);
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
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = { sender: 'user', text: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
        let knowledgeBaseContext = '';

        if (selectedProjectId) {
            setStatus("Finding project documents...");
            const papersResponse = await fetch(`${API_URL}/data/paper?projectId=${selectedProjectId}`);
            if (!papersResponse.ok) throw new Error("Could not fetch papers for this project.");
            
            const papersResult = await papersResponse.json();
            const papers: PaperInfo[] = papersResult.data || [];

            if (papers.length === 0) {
                knowledgeBaseContext = "Note to AI: The user selected a project with no documents. Inform them of this.";
                setStatus(`Project has no documents. Asking AI...`);
            } else {
                setStatus(`Found ${papers.length} documents. Preparing knowledge base...`);
                
                // --- THIS IS THE MODIFIED BLOCK ---
                // We now call our backend endpoint for each paper to get its text content.
                const fetchPromises = papers.map(paper => 
                    fetch(`${API_URL}/document-content/${paper.cid}`)
                        .then(res => {
                            if (!res.ok) {
                                console.error(`Failed to get text for CID: ${paper.cid}`);
                                // Return an empty string on failure so Promise.all doesn't break
                                return { text: '' }; 
                            }
                            return res.json();
                        })
                        .then(data => data.text || '') // Get the 'text' property from the JSON response
                );
                // --- END MODIFIED BLOCK ---
                
                const documentsContent = await Promise.all(fetchPromises);
                
                knowledgeBaseContext = documentsContent.map((content, index) => 
                    `--- DOCUMENT START: ${papers[index].title} ---\n${content}\n--- DOCUMENT END ---`
                ).join('\n\n');
            }
        } else {
            setStatus("Engaging general AI model...");
        }
        
        setStatus("Asking AI...");

        const completionResponse = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [...messages, userMessage],
                filecoinContext: knowledgeBaseContext
            })
        });
        
        if (!completionResponse.ok) throw new Error("The AI service failed to respond.");
    
        const aiResponseData = await completionResponse.json();
        const aiMessage: ChatMessage = { sender: 'ai', text: aiResponseData.reply };
        setMessages((prev) => [...prev, aiMessage]);

    } catch (error: any) {
        console.error("Error during chat process:", error);
        const errorMessage: ChatMessage = { sender: 'ai', text: `Sorry, an error occurred: ${error.message}` };
        setMessages((prev) => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
        setStatus("Ready for your next question.");
    }
};

  const selectedProject = projects.find(p => p.id === Number(selectedProjectId));

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
        {messages.length === 0 && (
            <div className="text-center text-gray-500 pt-10">
                {selectedProjectId 
                  ? `Ask a question about the "${selectedProject?.name}" project.` 
                  : `Ask a general question. No project-specific knowledge will be used.`}
            </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'ai' && <CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />}
            <div className={`max-w-3xl p-4 rounded-lg shadow-md ${
                msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
              }`
            }>
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

      {/* --- Input Form --- */}
      <div className="pt-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            // --- MODIFIED: Placeholder text now reflects the mode ---
            placeholder={selectedProjectId ? `Ask about "${selectedProject?.name}"...` : "Ask a general question..."}
            // --- MODIFIED: No longer disabled when a project isn't selected ---
            disabled={isLoading}
            className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            // --- MODIFIED: No longer disabled when a project isn't selected ---
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