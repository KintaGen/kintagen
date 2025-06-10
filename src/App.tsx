// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DataIngestionPage from './pages/DataIngestionPage';
import ResearchChatPage from './pages/ResearchChatPage'; // <-- 1. Import the new page

// Create simple placeholder components for other routes
const DashboardPage: React.FC = () => <h1 className="text-3xl font-bold">Dashboard</h1>;
const ProjectsPage: React.FC = () => <h1 className="text-3xl font-bold">Projects</h1>;
const AnalysisPage: React.FC = () => <h1 className="text-3xl font-bold">Analysis Workbench</h1>;
const NetworkPage: React.FC = () => <h1 className="text-3xl font-bold">Lab Network</h1>;

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="bg-gray-900 min-h-screen text-gray-200 flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/chat" element={<ResearchChatPage />} /> 
            <Route path="/ingest" element={<DataIngestionPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/network" element={<NetworkPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;