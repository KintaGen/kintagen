// src/contexts/JobContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { loadJobs, saveJobs, useJobPolling, type Job } from '../utils/jobs';
import { fetchWithBypass } from '../utils/fetchWithBypass'; // Import fetch

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>(() => loadJobs());
  
  useEffect(() => {
    saveJobs(jobs);
  }, [jobs]);

  useJobPolling({ jobs, setJobs, apiBase: API_BASE });

  // *** THE DEFINITIVE FIX: Global Follow-Up Logic ***
  // This effect watches for completed jobs that need a follow-up action.
  useEffect(() => {
    // Find completed upload jobs that have the "logAfterUpload" marker and haven't been processed yet.
    const jobsToLog = jobs.filter(
      j => j.state === 'completed' &&
           j.meta?.logAfterUpload &&
           !j.meta?.logged
    );

    if (jobsToLog.length > 0) {
      jobsToLog.forEach(async (job) => {
        try {
          // The upload job's returnvalue contains the CID.
          const cid = job.returnvalue?.cid;
          const { action } = job.meta?.logAfterUpload;
          
          if (!action || !cid || !job.projectId) {
            throw new Error(`Missing data for logging job ${job.id}`);
          }
          
          console.log(`[JobContext] Performing follow-up log for Job ID: ${job.id} with CID: ${cid}`);
          
          // Perform the logging action directly from the context.
          const logResponse = await fetchWithBypass(`${API_BASE}/projects/${job.projectId}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, outputCID: cid })
          });

          if (!logResponse.ok) {
            const errorText = await logResponse.text();
            throw new Error(`API error during logging: ${errorText}`);
          }

        } catch (err) {
          console.error(`[JobContext] Error during post-upload logging for job ${job.id}:`, err);
        } finally {
          // Mark the job as logged to prevent this from ever running again.
          setJobs(prevJobs =>
            prevJobs.map(j =>
              j.id === job.id ? { ...j, meta: { ...j.meta, logged: true } } : j
            )
          );
        }
      });
    }
  }, [jobs, setJobs]); // It runs whenever the global jobs state changes.

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