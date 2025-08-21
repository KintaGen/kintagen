import React, { createContext, useState, useEffect, useContext } from 'react';
import { loadJobs, saveJobs, useJobPolling, type Job } from '../utils/jobs';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// 1. Define the shape of the context data
interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
}

// 2. Create the context
const JobContext = createContext<JobContextType | undefined>(undefined);

// 3. Create a "Provider" component that will manage the state
export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // All the logic from the pages is now centralized here
  const [jobs, setJobs] = useState<Job[]>(() => loadJobs());
  useEffect(() => saveJobs(jobs), [jobs]);
  useJobPolling({ jobs, setJobs, apiBase: API_BASE });

  return (
    <JobContext.Provider value={{ jobs, setJobs }}>
      {children}
    </JobContext.Provider>
  );
};

// 4. Create a custom hook for easy access
export const useJobs = (): JobContextType => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};