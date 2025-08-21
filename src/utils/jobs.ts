// src/utils/jobs.ts
import * as React from 'react';
import { fetchWithBypass } from './fetchWithBypass';

/* ---------------------------------- Types --------------------------------- */
export type JobState = 'waiting' | 'delayed' | 'active' | 'completed' | 'failed';

export interface Job {
  id: string;
  kind: string;              // e.g. 'ld50', 'gcms-differential', 'gcms-profiling', 'researchchat'
  label: string;
  projectId: number | null;
  createdAt: number;

  state?: JobState;
  progress?: number;
  failedReason?: string | null;
  returnvalue?: any | null;
  logs?: string[];
  finishedOn?: number | null;
}

export interface JobStatusFromAPI {
  id: string;
  state?: JobState;
  progress?: number;
  failedReason?: string | null;
  returnvalue?: any | null;
  logs?: string[];
  finishedOn?: number | null;
}

/** Accept both real fetch and "string-only" light fetchers that return JSON directly. */
type FetcherLike = (input: any, init?: RequestInit) => Promise<any>;

/* ------------------------------- Local store ------------------------------- */
export const JOBS_KEY = 'kg:jobs:v1';

export const loadJobs = (): Job[] => {
  try { return JSON.parse(localStorage.getItem(JOBS_KEY) || '[]') as Job[]; }
  catch { return []; }
};

export const saveJobs = (items: Job[]) =>
  localStorage.setItem(JOBS_KEY, JSON.stringify(items));

export const clearJobs = () => localStorage.removeItem(JOBS_KEY);

/** Convenience storage facade for legacy imports. */
export const jobsStorage = {
  key: JOBS_KEY,
  load: loadJobs,
  save: saveJobs,
  clear: clearJobs,
};

export const isTerminal = (s?: JobState) => s === 'completed' || s === 'failed';

/* --------------------------------- Helpers -------------------------------- */
function isResponse(x: any): x is Response {
  return x && typeof x === 'object' && 'ok' in x && 'status' in x;
}

async function toJson<T = any>(r: any): Promise<T> {
  if (isResponse(r) && typeof (r as any).json === 'function') return r.json();
  return r as T; // already JSON from a light fetcher
}

/* ------------------------------- React Hook -------------------------------- */
/**
 * Generic polling hook for job statuses.
 * Polls `${apiBase}/analyze/jobs/:id` for all non-terminal jobs.
 */
export function useJobPolling(params: {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  apiBase: string;
  intervalMs?: number;
  fetcher?: FetcherLike; // can be fetchWithBypass or a string-only fetcher
}) {
  const {
    jobs,
    setJobs,
    apiBase,
    intervalMs = 1500,
    fetcher = fetchWithBypass as unknown as FetcherLike,
  } = params;

  const ids = React.useMemo(
    () => jobs.filter(j => !isTerminal(j.state)).map(j => j.id),
    [jobs]
  );

  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (ids.length === 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    const tick = async () => {
      await Promise.all(ids.map(async (id) => {
        try {
          const r = await fetcher(`${apiBase}/analyze/jobs/${id}`);
          if (isResponse(r) && !r.ok) return;
          const s: JobStatusFromAPI = await toJson(r);

          setJobs(prev => prev.map(j => j.id === s.id ? {
            ...j,
            state: s.state,
            progress: typeof s.progress === 'number' ? s.progress : j.progress,
            failedReason: s.failedReason ?? null,
            returnvalue: s.returnvalue ?? j.returnvalue ?? null,
            logs: Array.isArray(s.logs) ? s.logs : j.logs,
            finishedOn: s.finishedOn ?? j.finishedOn ?? null,
          } : j));
        } catch {
          /* swallow */
        }
      }));
    };

    // initial + interval
    tick();
    timerRef.current = window.setInterval(tick, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  }, [ids.join('|'), apiBase, intervalMs, fetcher, setJobs]);
}

/* --------------------------- Queue & Imperative API ------------------------ */
/** POST an async worker job and return a Job you can add to state. */
export async function queueWorkerJob(args: {
  apiBase: string;
  endpoint: string;          // e.g. '/analyze/gcms-differential'
  body: Record<string, any>;
  kind: string;
  label: string;
  projectId: number | null;
  fetcher?: FetcherLike;
}): Promise<{ jobId: string | number; job: Job }> {
  const {
    apiBase, endpoint, body, kind, label, projectId,
    fetcher = fetchWithBypass as unknown as FetcherLike,
  } = args;

  const res = await fetcher(`${apiBase}${endpoint}?async=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (isResponse(res) && !res.ok) {
    throw new Error(`Failed to start job (${res.status})`);
  }
  const parsed = await toJson<{ jobId: string | number }>(res);
  const { jobId } = parsed;

  const job: Job = {
    id: String(jobId),
    kind,
    label,
    projectId,
    createdAt: Date.now(),
    state: 'waiting',
  };
  return { jobId, job };
}

/* ------------------------------ startJobPolling ---------------------------- */
export type StopPolling = () => void;

function ensureArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

/* ------------------------------ observeJobIds ------------------------------- */
/**
 * Thin wrapper around `startJobPolling` so pages can call `observeJobIds(...)`.
 * Returns a stop() function to cancel polling.
 */
export function observeJobIds(params: {
  /** Optional if your custom `fetcher` already knows the full URL. */
  apiBase?: string;
  ids: string | string[];
  onUpdate: (status: JobStatusFromAPI) => void;
  intervalMs?: number;
  fetcher?: FetcherLike;
}): StopPolling {
  return startJobPolling(params);
}

/* ------------------------------ observeJobId -------------------------------- */
/** Convenience single-id variant. */
export function observeJobId(params: {
  apiBase?: string;
  id: string;
  onUpdate: (status: JobStatusFromAPI) => void;
  intervalMs?: number;
  fetcher?: FetcherLike;
}): StopPolling {
  const { id, ...rest } = params;
  return startJobPolling({ ...rest, ids: id });
}

/* -------- extra friendly aliases (keep old imports working if any) --------- */
export const observeJobs = observeJobIds;
export const observeJob = observeJobId;

/**
 * Imperative polling for one or many job IDs. Returns a stop() function.
 */
// Replace the existing startJobPolling with this version:

/**
 * Imperative polling for one or many job IDs. Returns a stop() function.
 * If apiBase is omitted, it will try VITE_API_BASE_URL. If neither is present,
 * it will WARN and fall back to treating ids as full URLs (advanced use).
 */

/**
 * Imperative polling for one or many job IDs. Returns a stop() function.
 * If apiBase is omitted, we fall back to VITE_API_BASE_URL (when available).
 */
export function startJobPolling(params: {
  apiBase?: string;
  ids: string[] | string;
  onUpdate: (status: JobStatusFromAPI) => void;
  intervalMs?: number;
  fetcher?: FetcherLike; // can be fetchWithBypass or a string-only fetcher like (id) => ...
}): StopPolling {
  const {
    apiBase,
    ids,
    onUpdate,
    intervalMs = 1500,
    fetcher = fetchWithBypass as unknown as FetcherLike,
  } = params;

  const idList = ensureArray(ids).filter(Boolean);
  if (idList.length === 0) return () => {};

  // Inline-safe fallback (no external const)
  const viteBase =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || '';
  const baseCandidate = (apiBase ?? viteBase) as string;
  const base = baseCandidate ? baseCandidate.replace(/\/+$/, '') : '';

  let stopped = false;

  const tick = async () => {
    await Promise.all(
      idList.map(async (id) => {
        try {
          const url = base ? `${base}/analyze/jobs/${id}` : String(id); // if no base, treat id as full URL
          const r = await fetcher(url);
          if (isResponse(r) && !r.ok) return;
          const status: JobStatusFromAPI = await toJson(r);
          onUpdate(status);
        } catch {
          /* swallow */
        }
      })
    );
  };

  // initial + interval
  tick();
  const handle = window.setInterval(() => {
    if (!stopped) tick();
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(handle);
  };
}

export async function queueChatJob(args: {
  apiBase: string;
  body: Record<string, any>;
  fetcher?: any; // Use `any` to match your existing file's flexibility
}): Promise<{ jobId: string | number; job: Job }> {
  // We re-use the generic queueWorkerJob with chat-specific parameters
  const lastUserMessage = args.body.messages?.filter((m: any) => m.sender === 'user').pop();
  
  return queueWorkerJob({
    ...args,
    endpoint: '/chat', // Chat endpoint does not have /analyze prefix
    kind: 'chat',
    label: lastUserMessage?.text || 'Chat Conversation',
    projectId: null, // Chat jobs are not tied to a project in the jobs list
  });
}
// keep this legacy alias working too
export const startjobpoling = startJobPolling;

/** Legacy alias for misspelled imports. */
