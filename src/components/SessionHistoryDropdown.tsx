// src/components/SessionHistoryDropdown.tsx
import React from 'react';
import { ClockIcon, TrashIcon } from '@heroicons/react/24/solid';

// Define the shape of a Chat Session
export interface ChatSession {
  id: string; // The ID of the initial job that started this session
  initialPrompt: string;
  createdAt: number;
  messages: { sender: 'user' | 'ai'; text: string | null; }[];
}

interface SessionHistoryDropdownProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onClearHistory: () => void;
}

const SessionHistoryDropdown: React.FC<SessionHistoryDropdownProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onClearHistory,
}) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <label htmlFor="session-select" className="flex items-center text-sm font-medium text-gray-300">
          <ClockIcon className="h-5 w-5 mr-2 text-gray-400" />
          Conversation History
        </label>
        <button
          onClick={onClearHistory}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50"
          disabled={sessions.length === 0}
          title="Clear all saved conversations"
        >
          <TrashIcon className="h-4 w-4" />
          Clear
        </button>
      </div>
      <select
        id="session-select"
        value={activeSessionId || ''}
        onChange={(e) => onSelectSession(e.target.value || null)}
        className="mt-2 w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none"
      >
        <option value="">— Start a New Conversation —</option>
        {sessions.sort((a, b) => b.createdAt - a.createdAt).map(session => (
          <option key={session.id} value={session.id}>
            {new Date(session.createdAt).toLocaleString()} - "{session.initialPrompt.substring(0, 50)}..."
          </option>
        ))}
      </select>
    </div>
  );
};

export default SessionHistoryDropdown;