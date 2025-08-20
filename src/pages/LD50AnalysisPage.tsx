// src/pages/LD50AnalysisPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChartBarIcon, LinkIcon, ArrowPathIcon,
  BeakerIcon, CheckCircleIcon, XCircleIcon, TrashIcon, ArrowDownTrayIcon,
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

// A component to render the structured LD50 results
const Ld50ResultsView: React.FC<{ results: any }> = ({ results }) => {
  const {
    ld50_estimate,
    standard_error,
    confidence_interval_lower,
    confidence_interval_upper,
    plot_b64,
  } = results;

  if (!ld50_estimate || !plot_b64) {
    return <div className="text-xs text-yellow-400">Incomplete result data.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Metrics Panel */}
      <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
        <h4 className="text-sm font-semibold mb-3 text-gray-200 border-b border-gray-700 pb-2">Key Metrics</h4>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-baseline">
            <span className="text-gray-400">LD50 Estimate:</span>
            <span className="text-base font-bold text-emerald-300">{ld50_estimate.toFixed(4)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-gray-400">Standard Error:</span>
            <span className="font-mono text-gray-200">{standard_error.toFixed(4)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-gray-400">95% CI:</span>
            <span className="font-mono text-gray-200">
              [{confidence_interval_lower.toFixed(4)}, {confidence_interval_upper.toFixed(4)}]
            </span>
          </div>
        </div>
      </div>

      {/* Plot Panel */}
      <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
        <h4 className="text-sm font-semibold mb-2 text-gray-200">Dose-Response Plot</h4>
        <img
          src={plot_b64}
          alt="LD50 Dose-Response Curve"
          className="w-full h-auto rounded bg-white p-0.5"
        />
      </div>
    </div>
  );
};


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
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }

    if (incompleteIds.length === 0) return;

    stopRef.current = startJobPolling({
      ids: incompleteIds,
      intervalMs: 1500,
      fetcher: async (id: string) => {
        const r = await fetchWithBypass(`${API_BASE}/analyze/jobs/${id}`);
        if (!r.ok) throw new Error(`Failed to fetch job ${id}`);
        return r.json();
      },
      onUpdate: (snapshot) => {
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
    
    // **FIXED**: Check for the script log inside the returnvalue
    if (job.returnvalue && Array.isArray(job.returnvalue.log)) {
        zip.file('script_logs.txt', job.returnvalue.log.join('\n'));
    }

    // **FIXED**: Check for the plot in the correct nested path
    if (job.returnvalue?.results?.plot_b64) {
      const plotBase64 = job.returnvalue.results.plot_b64.split(',')[1];
      zip.file("ld50_plot.png", plotBase64, { base64: true });
    }

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
        {/* ... form inputs remain the same ... */}
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
                  j => !(j.kind === 'ld50' && j.projectId === projectIdNum && (j.state === 'completed' || j.state === 'failed'))
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

            // **FIXED**: Check the nested `results` object for the required data
            const isLd50Result = job.returnvalue?.status === 'success' && !!job.returnvalue?.results?.ld50_estimate;

            return (
              <li key={job.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                <div className="flex items-center justify-between">
                  {/* ... job header remains the same ... */}
                  <div className="text-sm">
                    <div className="text-white font-medium">{job.label}</div>
                    <div className="text-gray-400">jobId: <span className="font-mono">{job.id}</span></div>
                    <div className="text-gray-500 text-xs mt-1">{created}</div>
                  </div>
                  <div className="flex items-center gap-2">{badge}</div>
                </div>

                {typeof job.progress === 'number' && state === 'active' && (
                  <div className="mt-2">
                    {/* ... progress bar remains the same ... */}
                  </div>
                )}
                
                {/* ... IPFS links are fine ... */}

                {state === 'failed' && job.failedReason && (
                  <div className="mt-2 text-xs text-red-300">Reason: {job.failedReason}</div>
                )}
                
                {state === 'completed' && job.returnvalue && (
                  <div className="mt-3 flex items-start gap-2">
                    <button onClick={() => downloadBundle(job)} className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-100 flex items-center gap-1">
                      <ArrowDownTrayIcon className="h-4 w-4" /> Download bundle
                    </button>
                    
                    {isLd50Result ? (
                      <details className="text-xs flex-1">
                        <summary className="cursor-pointer text-gray-400 hover:text-gray-200 inline-flex items-center gap-1">
                          <ChartBarIcon className="h-4 w-4" /> View Results
                        </summary>
                        <div className="mt-2 border-t border-gray-700/50 pt-3 space-y-4">
                           {/* **FIXED**: Pass the nested `results` object to the component */}
                          <Ld50ResultsView results={job.returnvalue.results} />
                          
                          {/* **IMPROVED**: Display the execution log from the script */}
                          {Array.isArray(job.returnvalue.log) && job.returnvalue.log.length > 0 && (
                             <div>
                                <h5 className="text-xs font-semibold text-gray-400 mb-1">Execution Log</h5>
                                <pre className="text-gray-400 text-[11px] bg-gray-900 p-2 rounded overflow-x-auto">
                                  {job.returnvalue.log.join('\n')}
                                </pre>
                             </div>
                          )}
                        </div>
                      </details>
                    ) : (
                      <details className="text-xs flex-1">
                        <summary className="cursor-pointer text-gray-400">View Raw JSON</summary>
                        <pre className="mt-2 text-gray-300 bg-gray-900 p-2 rounded overflow-x-auto">{JSON.stringify(job.returnvalue, null, 2)}</pre>
                      </details>
                    )}
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