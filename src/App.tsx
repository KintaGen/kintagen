// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DataIngestionPage from './pages/DataIngestionPage';
import ResearchChatPage from './pages/ResearchChatPage';


const App: React.FC = () => {
  return (
    // --- 3. Wrap with Providers ---
    <BrowserRouter>
      <div className="bg-gray-900 min-h-screen text-gray-200 flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/chat" element={<ResearchChatPage />} /> 
            <Route path="/ingest" element={<DataIngestionPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;