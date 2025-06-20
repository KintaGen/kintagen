// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ProjectsPage from './pages/ProjectsPage';
import DataIngestionPage from './pages/DataIngestionPage';
import ResearchChatPage from './pages/ResearchChatPage';
import LD50AnalysisPage from './pages/LD50AnalysisPage';
import GCMSAnalysisPage from './pages/GCMSAnalysisPage';


const App: React.FC = () => {
  return (
    // --- 3. Wrap with Providers ---
    <BrowserRouter>
      <div className="bg-gray-900 min-h-screen text-gray-200 flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} /> 
            <Route path="/chat" element={<ResearchChatPage />} /> 
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/ingest" element={<DataIngestionPage />} />
            <Route path="/analysis" element={<LD50AnalysisPage />} />
            <Route path="/analyze-gcms" element={<GCMSAnalysisPage />} /> 

          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;