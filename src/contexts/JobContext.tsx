// src/contexts/JobContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { loadJobs, saveJobs, useJobPolling, type Job } from '../utils/jobs';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

// A helper function to remove large base64 strings from a job's returnvalue
const createPrunedJob = (job: Job): Job => {
  if (!job.returnvalue || typeof job.returnvalue !== 'object') {
    return job;
  }
  
  // Deep copy to avoid mutating the original object
  const newJob = JSON.parse(JSON.stringify(job));
  
  // Prune any key ending in _b64 from the results object
  if (newJob.returnvalue.results) {
    for (const key in newJob.returnvalue.results) {
      if (key.endsWith('_b64')) {
        delete newJob.returnvalue.results[key];
      }
    }
  }
  // Also prune chat replies to be safe
  if (newJob.returnvalue.reply) {
      delete newJob.returnvalue.reply;
  }

  return newJob;
};

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This `jobs` state is the "source of truth" in memory, with full data
  const [jobs, setJobs] = useState<Job[]>(() => loadJobs());
  
  // This effect is now responsible for saving a lightweight version to localStorage
  useEffect(() => {
    // Before saving, create a sanitized version of the jobs array
    // that doesn't include large payloads.
    const sanitizedJobs = jobs.map(job => {
      // We only need to prune completed jobs that have a return value
      if (job.returnvalue && (job.state === 'completed' || job.state === 'failed')) {
        return createPrunedJob(job);
      }
      return job;
    });
    
    saveJobs(sanitizedJobs);
  }, [jobs]);

  // The poller works with the full in-memory state
  useJobPolling({ jobs, setJobs, apiBase: API_BASE });

  return (
    <JobContext.Provider value={{ jobs, setJobs }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = (): JobContextType => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};