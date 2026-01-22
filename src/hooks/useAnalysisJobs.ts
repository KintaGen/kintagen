import { useEffect, useMemo } from 'react';
import { useJobs } from '../contexts/JobContext';
import { useOwnedNftProjects } from '../flow/kintagen-nft';
import { DEMO_PROJECT_ID, type DisplayJob } from '../types';

export const useAnalysisJobs = (
    analysisKind: 'ld50' | 'nmr',
    logTitlePrefix: string,
    selectedProjectId: string
) => {
    const { jobs, setJobs } = useJobs();
    const { projects } = useOwnedNftProjects();

    // 1. POLLING LOGIC
    useEffect(() => {
        const activeJobs = jobs.filter(job => (job.state === 'waiting' || job.state === 'processing') && job.kind === analysisKind);
        if (activeJobs.length === 0) return;

        const intervalId = setInterval(async () => {
            let jobsWereUpdated = false;
            const updatedJobs = await Promise.all(jobs.map(async (job) => {
                if (job.kind !== analysisKind || (job.state !== 'waiting' && job.state !== 'processing')) return job;
                try {
                    const response = await fetch(`/api/jobs/status/${job.id}`);
                    if (!response.ok) {
                        if (response.status === 404 && job.state !== 'waiting') {
                            jobsWereUpdated = true;
                            return { ...job, state: 'failed', failedReason: 'Job not found on server.' };
                        }
                        return job;
                    }
                    const serverJob = await response.json();
                    const newClientState = serverJob.status === 'completed' || serverJob.status === 'failed' ? serverJob.status : 'processing';
                    if (newClientState !== job.state) {
                        jobsWereUpdated = true;
                        return { ...job, state: newClientState as any, returnvalue: serverJob.result || job.returnvalue, failedReason: serverJob.error || job.failedReason };
                    }
                } catch (e) { console.error("Polling error", e); }
                return job;
            }));
            if (jobsWereUpdated) setJobs(updatedJobs);
        }, 4000);
        return () => clearInterval(intervalId);
    }, [jobs, setJobs, analysisKind]);

    // 2. DISPLAY LOGIC (Merging On-Chain + Local)
    const displayJobs = useMemo((): DisplayJob[] => {
        if (selectedProjectId && selectedProjectId !== DEMO_PROJECT_ID) {
            const project = projects.find(p => p.id === selectedProjectId);
            if (!project) return [];

            const onChainLogs: DisplayJob[] = (project.story || [])
                .filter(step => step.title.startsWith(logTitlePrefix))
                .map((step, index) => {
                    const rawSegment = step.description.split('input hash: ')[1] || '';
                    const cleanHash = rawSegment.split(' ')[0].trim();
                    return {
                        id: `log-${project.id}-${index}`,
                        label: step.title,
                        projectId: project.id,
                        state: 'logged',
                        logData: step,
                        inputDataHash: cleanHash
                    };
                });

            const loggedInputHashes = new Set(onChainLogs.map(log => log.inputDataHash).filter(Boolean));

            const localJobs: DisplayJob[] = jobs
                .filter(job => job.kind === analysisKind && job.projectId === selectedProjectId)
                .filter(job => !loggedInputHashes.has(job.inputDataHash!))
                .map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any }));

            return [...onChainLogs, ...localJobs];
        }
        
        // Demo Mode
        return jobs.filter(job => job.kind === analysisKind && job.projectId === DEMO_PROJECT_ID)
            .map(job => ({ ...job, id: job.id, projectId: job.projectId as string, state: job.state as any }));
    }, [selectedProjectId, projects, jobs, analysisKind, logTitlePrefix]);

    return { displayJobs, setJobs };
};