import React, { createContext, useState, useContext, ReactNode } from 'react';

// Keep your existing Job interface, or use this simplified one.
// The important part is that there are no server-specific fields.
export interface Job {
  id: string;
  kind: string;
  label: string;
  projectId?: string | null;
  createdAt: number;
  state: 'waiting' | 'processing' | 'completed' | 'failed';
  returnvalue?: any;
  failedReason?: string;
  meta?: any;
}

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

// The JobProvider is now just a simple state wrapper.
// It performs NO network requests and has NO timers.
export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>([]);

  return (
    <JobContext.Provider value={{ jobs, setJobs }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};