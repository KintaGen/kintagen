// src/components/ProjectDetail.tsx
import React, { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  XMarkIcon,
  BeakerIcon,
  CubeTransparentIcon
} from '@heroicons/react/24/solid';
import { fetchWithBypass } from '../utils/fetchWithBypass';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

/* ---------- INTERFACE DEFINITIONS ---------- */
interface Project {
  id: number;
  name: string;
  nft_id: number | null;
}

interface DataItem {
  cid: string;
  title: string;
  created_at: string;
}

// This is the correct, simpler structure that your analysis pages save
interface LogEntry {
  action: string;
  resultCID: string | null;
  timestamp: string; // This will be a Unix timestamp string like "1681333733.0"
}

interface ProjectDetailProps {
  project: Project;
  onClose: () => void;
}

/* ---------- HELPER FUNCTIONS (FIXED) ---------- */
const formatTimestamp = (timestamp: string) => {
  // Handles Unix timestamp strings (e.g., "1681333733.0")
  const num = parseFloat(timestamp);
  if (isNaN(num)) {
    return "Invalid Date";
  }
  return new Date(num * 1000).toLocaleString();
};

const shortenCID = (cid: string) =>
  cid.length > 10 ? `${cid.slice(0, 6)}…${cid.slice(-6)}` : cid;

/* ---------- COMPONENT ---------- */
const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onClose }) => {
  const [papers, setPapers] = useState<DataItem[]>([]);
  const [experiments, setExperiments] = useState<DataItem[]>([]);
  const [analyses, setAnalyses] = useState<DataItem[]>([]);
  const [story, setStory] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----- DATA FETCHING (FIXED)----- */
  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // --- Step 1: Fetch data assets. These can fail without stopping the process. ---
        const dataAssetsPromise = Promise.all([
          fetchWithBypass(`${API_BASE}/data/paper?projectId=${project.id}`).then(res => res.json()),
          fetchWithBypass(`${API_BASE}/data/experiment?projectId=${project.id}`).then(res => res.json()),
          fetchWithBypass(`${API_BASE}/data/analysis?projectId=${project.id}`).then(res => res.json()),
        ]);

        const [papersData, experimentsData, analysesData] = await dataAssetsPromise;
        setPapers(papersData.data || []);
        setExperiments(experimentsData.data || []);
        setAnalyses(analysesData.data || []);

        // --- Step 2: Fetch the story log independently. ---
        if (project.nft_id) {
          try {
            const storyRes = await fetchWithBypass(`${API_BASE}/nfts/${project.nft_id}/story`);
            if (!storyRes.ok) throw new Error('Failed to fetch NFT story.');
            const storyData = await storyRes.json();
            setStory(storyData || []);
          } catch (storyErr: any) {
            // If only the story fails, show a specific error but still show the data assets
            setError("Could not load the on-chain log. " + storyErr.message);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError('Failed to load project data assets.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [project.id, project.nft_id]);

  /* ---------- RENDER ---------- */
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-start pt-16 md:pt-24 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- HEADER --- */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold flex items-center">
            <BeakerIcon className="h-7 w-7 mr-3 text-cyan-400" />
            {project.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* --- BODY --- */}
        {isLoading && (
          <div className="flex-grow flex justify-center items-center p-10">
            <ArrowPathIcon className="h-10 w-10 text-blue-400 animate-spin" />
          </div>
        )}
        
        {!isLoading && (
          <div className="flex-grow overflow-y-auto p-6 space-y-8">
            {error && <div className="p-4 bg-red-900/50 text-red-300 rounded-lg">{error}</div>}
            
            {/* ---------- PROJECT DATA CARDS ---------- */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-white">Project Data</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                 {/* Papers */}
                 <div className="bg-gray-900/50 p-4 rounded-lg"><h4 className="font-bold mb-2">Papers ({papers.length})</h4><ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">{papers.length > 0 ? papers.map(p => <li key={p.cid} className="flex items-start gap-2 truncate" title={p.title}><DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" /><span>{p.title}</span></li>) : <li className="text-gray-500">No papers found.</li>}</ul></div>
                 {/* Experiments */}
                 <div className="bg-gray-900/50 p-4 rounded-lg"><h4 className="font-bold mb-2">Experiment Data ({experiments.length})</h4><ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">{experiments.length > 0 ? experiments.map(e => <li key={e.cid} className="flex items-start gap-2 truncate" title={e.title}><DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" /><span>{e.title}</span></li>) : <li className="text-gray-500">No experiments found.</li>}</ul></div>
                 {/* Analyses */}
                 <div className="bg-gray-900/50 p-4 rounded-lg"><h4 className="font-bold mb-2">Analyses ({analyses.length})</h4><ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">{analyses.length > 0 ? analyses.map(a => <li key={a.cid} className="flex items-start gap-2 truncate" title={a.title}><DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" /><span>{a.title}</span></li>) : <li className="text-gray-500">No analyses found.</li>}</ul></div>
              </div>
            </div>

            {/* ---------- ON-CHAIN AUDIT LOG ---------- */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
                <CubeTransparentIcon className="h-5 w-5" /> On-Chain Log
              </h3>
              <div className="bg-gray-900/50 p-4 rounded-lg max-h-64 overflow-y-auto border border-gray-700">
                {!project.nft_id && <p className="text-sm text-gray-500">This project has not been minted as an NFT yet.</p>}
                {project.nft_id && story.length > 0 ? (
                  <ul className="space-y-4">
                    {story.map((entry, index) => (
                      <li key={index} className="text-sm border-l-2 border-purple-500 pl-4 space-y-1">
                        <p className="font-bold text-white">{entry.action}</p>
                        {entry.resultCID && (
                          <a
                            href={`https://0xcdb8cc9323852ab3bed33f6c54a7e0c15d555353.calibration.filcdn.io/${entry.resultCID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-300 font-mono hover:underline break-all"
                            title={entry.resultCID}
                          >
                            Result CID: {shortenCID(entry.resultCID)}
                          </a>
                        )}
                        <p className="text-gray-400 font-mono text-xs">
                          {/* USE THE CORRECTED FORMATTER */}
                          Timestamp: {formatTimestamp(entry.timestamp)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : project.nft_id && !error ? (
                  <p className="text-sm text-gray-500">No log entries found for this NFT.</p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;