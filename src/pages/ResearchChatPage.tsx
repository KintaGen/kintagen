// src/pages/ResearchChatPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { UserCircleIcon, CpuChipIcon } from '@heroicons/react/24/outline';


const API_URL = 'http://127.0.0.1:3001/api/chat'
// Define the structure of a chat message
interface ChatMessage {
  sender: 'user' | 'ai';
  text: string | null;
}


const ResearchChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // The FilCDN URL you provided, implement getting more later
  const KNOWLEDGE_BASE_URL = 'https://0xcb9e86945ca31e6c3120725bf0385cbad684040c.calibration.filcdn.io/baga6ea4seaqmwvk7m3zvgcbuxrwn7rfx74gr44wareax6ntxaxeid6yvuhacoba';

  // Automatically scroll to the bottom when new messages are added
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
      // In a REAL app, you would not fetch this here.
      // Your backend would do this fetch. We are just simulating.
      const response = await fetch(KNOWLEDGE_BASE_URL);
      const fileContent = await response.text();
      //const fileContent = "Simulated content from Filecoin network about Erythroxylum research papers...";
      // Call our mock API
      //const aiResponseText = await mockApiCall(inputValue, fileContent);
      const completionResponse = await fetch(API_URL,{
        method: 'POST',
        headers: {
          // 4. Set the correct header for JSON data
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            userMessage,
            ...messages
          ],
          filecoinContext: fileContent
        })
      });
    
      const aiResponseText = (await completionResponse.json()).reply;
      const aiMessage: ChatMessage = { sender: 'ai', text: aiResponseText };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error fetching data or getting AI response:", error);
      const errorMessage: ChatMessage = { sender: 'ai', text: "Sorry, I encountered an error. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)]">
      {/* --- Header --- */}
      <div className="pb-4 border-b border-gray-700">
        <h1 className="text-3xl font-bold">Research Chat</h1>
        <p className="text-gray-400 mt-1">Ask questions about your ingested documents.</p>
      </div>

      {/* --- Chat Messages Area --- */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'ai' && <CpuChipIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />}
            <div className={`max-w-xl p-4 rounded-lg ${
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
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
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
            placeholder="Ask about chemicals, methods, or findings..."
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