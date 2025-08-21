import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ProjectsPage from './pages/ProjectsPage';
import DataIngestionPage from './pages/DataIngestionPage';
import ResearchChatPage from './pages/ResearchChatPage';
import LD50AnalysisPage from './pages/LD50AnalysisPage';
import GCMSAnalysisPage from './pages/GCMSAnalysisPage';
import NetworkGuard from './components/NetworkGuard';
import AccessControlPage from './pages/AccessControlPage';
import { JobProvider, useJobs } from './contexts/JobContext';
import GlobalJobStatusToast from './components/GlobalJobStatusToast';

const ToastManager = () => {
  const { jobs } = useJobs(); // Get the global jobs state
  return <GlobalJobStatusToast jobs={jobs} />;
};
const App: React.FC = () => {
  return (
    <HashRouter>
      <JobProvider>

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

            {/* --- 2. Add the new route for /network --- */}
            <Route path="/network" element={
              <NetworkGuard>
                <AccessControlPage />
              </NetworkGuard>
            } />

          </Routes>
        </main>
      </div>
      <ToastManager />
      </JobProvider>
    </HashRouter>
  );
};

export default App;