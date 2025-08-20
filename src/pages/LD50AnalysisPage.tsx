// src/pages/LD50AnalysisPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChartBarIcon, LinkIcon, ArrowPathIcon, SparklesIcon,
  BeakerIcon, DocumentMagnifyingGlassIcon, InboxArrowDownIcon,
  CheckCircleIcon, XCircleIcon, TrashIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/solid';
import JSZip from 'jszip'; // keep & use
import { fetchWithBypass } from '../utils/fetchWithBypass';

// --- shared polling utils ---
import {
  jobsStorage,
  startJobPolling,
  type Job,
  type JobState,
} from '../utils/jobs';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const FILECOIN_GATEWAY = 'https://0xcdb8cc9323852ab3bed33f6c54a7e0c15d555353.calibration.filcdn.io'; // preserved

// keep helper
const ipfsUrl = (cid: string) => `${FILECOIN_GATEWAY}/ipfs/${cid}`;

const Ld50AnalysisPage: React.FC = () => {
  // inputs
  const [projects, setProjects] = useState<Array<{ id: number; name: string; nft_id: number | null }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [experimentFiles, setExperimentFiles] = useState<Array<{ cid: string; title: string }>>([]);
  const [selectedFileCid, setSelectedFileCid] = useState<string>('');
  const [dataUrl, setDataUrl] = useState<string>('');
  const [label, setLabel] = useState<string>('LD50 run');

  // state
  const [areProjectsLoading, setAreProjectsLoading] = useState(true);
  const [areFilesLoading, setAreFilesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // jobs (persisted)
  const [jobs, setJobs] = useState<Job[]>(() => jobsStorage.load());
  useEffect(() => jobsStorage.save(jobs), [jobs]);

  // poller
  const stopRef = useRef<null | (() => void)>(null);
  const ld50Jobs = useMemo(() => jobs.filter(j => j.kind === 'ld50'), [jobs]);
  const incompleteIds = useMemo(
    () => ld50Jobs.filter(j => j.state !== 'completed' && j.state !== 'failed').map(j => j.id),
    [ld50Jobs]
  );

  useEffect(() => {
    // stop any running poller first
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }

    if (incompleteIds.length === 0) return;

    // start shared poller
    stopRef.current = startJobPolling({
      ids: incompleteIds,
      intervalMs: 1500,
      // how to fetch a job status
      fetcher: async (id: string) => {
        const r = await fetchWithBypass(`${API_BASE}/analyze/jobs/${id}`);
        if (!r.ok) throw new Error(`Failed to fetch job ${id}`);
        return r.json();
      },
      // how to merge updates into local state
      onUpdate: (snapshot) => {
        // snapshot is the freshly fetched job state from server
        setJobs(prev =>
          prev.map(j => j.id === snapshot.id
            ? {
                ...j,
                state: snapshot.state as JobState,
                progress: typeof snapshot.progress === 'number' ? snapshot.progress : j.progress,
                failedReason: snapshot.failedReason ?? null,
                returnvalue: snapshot.returnvalue ?? j.returnvalue ?? null,
                logs: Array.isArray(snapshot.logs) ? snapshot.logs : j.logs,
                finishedOn: snapshot.finishedOn ?? j.finishedOn ?? null,
              }
            : j
          )
        );
      },
    });

    return () => {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
    };
  }, [incompleteIds.join('|')]);

  // data loads
  useEffect(() => {
    (async () => {
      setAreProjectsLoading(true);
      try {
        const res = await fetchWithBypass(`${API_BASE}/projects`);
        if (!res.ok) throw new Error('Could not fetch projects');
        setProjects(await res.json());
      } catch (e: any) { setError(e.message); }
      finally { setAreProjectsLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setExperimentFiles([]);
      setSelectedFileCid('');
      return;
    }
    (async () => {
      setAreFilesLoading(true);
      try {
        const res = await fetchWithBypass(`${API_BASE}/data/experiment?projectId=${selectedProjectId}`);
        const data = await res.json();
        setExperimentFiles(data.data || []);
      } catch (e: any) { setError(e.message || 'Failed to load experiment files.'); }
      finally { setAreFilesLoading(false); }
    })();
  }, [selectedProjectId]);

  // queue LD50 job
  const queueJob = async () => {
    setError(null);
    try {
      const body: any = {
        label: label || 'LD50 run',
        projectId: selectedProjectId ? Number(selectedProjectId) : null,
      };
      if (selectedFileCid) body.dataCid = selectedFileCid;
      else if (dataUrl) body.dataUrl = dataUrl;
      else body.sample = true;

      const res = await fetchWithBypass(`${API_BASE}/analyze/ld50?async=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to start LD50 job (${res.status})`);
      const { jobId } = await res.json();

      const newJob: Job = {
        id: String(jobId),
        kind: 'ld50',
        label: body.label,
        projectId: body.projectId,
        createdAt: Date.now(),
        state: 'waiting',
      };
      setJobs(prev => [newJob, ...prev]);
    } catch (e: any) {
      setError(e.message || 'Failed to queue job');
    }
  };

  const projectIdNum = selectedProjectId ? Number(selectedProjectId) : null;
  const projectJobs = ld50Jobs.filter(j => j.projectId === projectIdNum);

  // zip downloader (uses JSZip so we don't remove it)
  const downloadBundle = async (job: Job) => {
    const zip = new JSZip();
    zip.file('meta.json', JSON.stringify({
      id: job.id,
      label: job.label,
      projectId: job.projectId,
      createdAt: job.createdAt,
      finishedOn: job.finishedOn ?? null,
      state: job.state ?? null,
    }, null, 2));
    if (job.returnvalue) zip.file('result.json', JSON.stringify(job.returnvalue, null, 2));
    if (Array.isArray(job.logs)) zip.file('logs.txt', job.logs.join('\n'));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ld50_${job.id}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="text-left">
      <h1 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <BeakerIcon className="h-7 w-7 text-cyan-400" />
        LD50 Analysis
      </h1>

      <div className="bg-gray-800 rounded border border-gray-700 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Project</label>
            <select
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-200"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={areProjectsLoading}
            >
              <option value="">General (no project)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-1">Experiment file (optional)</label>
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-200"
                value={selectedFileCid}
                onChange={(e) => setSelectedFileCid(e.target.value)}
                disabled={areFilesLoading || !selectedProjectId}
              >
                <option value="">— none —</option>
                {experimentFiles.map(f => <option key={f.cid} value={f.cid}>{f.title}</option>)}
              </select>
              {areFilesLoading && <div className="text-xs text-gray-500 mt-1">Loading files…</div>}
            </div>

            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-1">or CSV URL</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-200"
                placeholder="https://…/ld50.csv"
                value={dataUrl}
                onChange={(e) => setDataUrl(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-1">Label</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-200"
                value={label} onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={queueJob} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">
                Queue LD50 Job
              </button>
            </div>
            {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
          </div>

          <div className="bg-gray-900/40 rounded p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-300">
              <ChartBarIcon className="h-5 w-5" />
              Jobs are queued server-side. Status is polled every ~1.5s and <strong className="ml-1">persists across refresh</strong>.
            </div>
            <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Filecoin gateway in use: <code className="font-mono">{FILECOIN_GATEWAY}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Job tray */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">Recent Jobs</h3>
          <button
            onClick={() =>
              setJobs(prev =>
                prev.filter(
                  j =>
                    !(
                      j.kind === 'ld50' &&
                      j.projectId === projectIdNum &&
                      (j.state === 'completed' || j.state === 'failed')
                    )
                )
              )
            }
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-1"
            title="Clear completed/failed"
          >
            <TrashIcon className="h-4 w-4" />
            Clear done
          </button>
        </div>

        <ul className="space-y-2">
          {projectJobs.length === 0 && <li className="text-sm text-gray-500">No jobs yet for this scope.</li>}
          {projectJobs.map(job => {
            const state = job.state ?? 'waiting';
            const created = new Date(job.createdAt).toLocaleString();
            const badge = state === 'completed'
              ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-600/20 text-emerald-300 px-2 py-0.5 rounded"><CheckCircleIcon className="h-4 w-4" />completed</span>
              : state === 'failed'
              ? <span className="inline-flex items-center gap-1 text-xs bg-red-600/20 text-red-300 px-2 py-0.5 rounded"><XCircleIcon className="h-4 w-4" />failed</span>
              : <span className="inline-flex items-center gap-1 text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded"><ArrowPathIcon className="h-4 w-4 animate-spin" />{state}</span>;

            return (
              <li key={job.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-white font-medium">{job.label}</div>
                    <div className="text-gray-400">jobId: <span className="font-mono">{job.id}</span></div>
                    <div className="text-gray-500 text-xs mt-1">{created}</div>
                  </div>
                  <div className="flex items-center gap-2">{badge}</div>
                </div>

                {typeof job.progress === 'number' && state === 'active' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-700 h-2 rounded">
                      <div className="bg-blue-500 h-2 rounded" style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{job.progress}%</div>
                  </div>
                )}

                {/* IPFS links if present in returnvalue */}
                {job.returnvalue && (
                  <div className="mt-2 text-xs text-gray-300 space-y-1">
                    {['cid', 'resultCid', 'artifactCid', 'dataCid'].map(k => (
                      job.returnvalue?.[k] ? (
                        <div key={k}>
                          <span className="text-gray-400">{k}:</span>{' '}
                          <a className="text-cyan-300 underline break-all" href={ipfsUrl(job.returnvalue[k])} target="_blank" rel="noreferrer">
                            {ipfsUrl(job.returnvalue[k])}
                          </a>
                        </div>
                      ) : null
                    ))}
                  </div>
                )}

                {state === 'failed' && job.failedReason && (
                  <div className="mt-2 text-xs text-red-300">Reason: {job.failedReason}</div>
                )}
                {state === 'completed' && job.returnvalue && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => downloadBundle(job)} className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-100 flex items-center gap-1">
                      <ArrowDownTrayIcon className="h-4 w-4" /> Download bundle
                    </button>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-400">View JSON</summary>
                      <pre className="text-gray-300 bg-gray-900 p-2 rounded overflow-x-auto">{JSON.stringify(job.returnvalue, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default Ld50AnalysisPage;
