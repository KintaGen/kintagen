// src/components/ProjectDetail.tsx
import React, { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  XMarkIcon,
  BeakerIcon,
} from '@heroicons/react/24/solid';

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

interface StoryStep {
  stepNumber: number | string; // Flow sometimes returns it as a string
  agent: string;
  action: string;
  resultCID: string;
  timestamp: string; // e.g. "1681333733.0"
}

interface ProjectDetailProps {
  project: Project;
  onClose: () => void;
}

/* ---------- HELPER FUNCTIONS ---------- */
const formatTimestamp = (timestamp: string) => {
  const date = new Date(parseFloat(timestamp) * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
};


const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const shortenCID = (cid: string) =>
  cid.length > 10 ? `${cid.slice(0, 5)}…${cid.slice(-5)}` : cid;

/* ---------- COMPONENT ---------- */
const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onClose }) => {
  const [papers, setPapers] = useState<DataItem[]>([]);
  const [experiments, setExperiments] = useState<DataItem[]>([]);
  const [analyses, setAnalyses] = useState<DataItem[]>([]);
  const [story, setStory] = useState<StoryStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----- DATA FETCHING ----- */
  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [papersRes, experimentsRes, analysesRes, storyRes] =
          await Promise.all([
            fetch(
              `${API_BASE}/data/paper?projectId=${project.id}`
            ),
            fetch(
              `${API_BASE}/data/experiment?projectId=${project.id}`
            ),
            fetch(
              ` ${API_BASE}/data/analysis?projectId=${project.id}`
            ),
            project.nft_id
              ? fetch(
                  `${API_BASE}/nfts/${project.nft_id}/story`
                )
              : Promise.resolve(null),
          ]);

        if (!papersRes.ok) throw new Error('Failed to fetch papers.');
        const papersData = await papersRes.json();

        if (!experimentsRes.ok) throw new Error('Failed to fetch experiments.');
        const experimentsData = await experimentsRes.json();

        if (!analysesRes.ok) throw new Error('Failed to fetch analyses.');
        const analysesData = await analysesRes.json();

        setPapers(papersData.data || []);
        setExperiments(experimentsData.data || []);
        setAnalyses(analysesData.data || []);

        if (storyRes && storyRes.ok) {
          const storyData = await storyRes.json();
          setStory(storyData || []);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load project details. Please try again.');
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
        {error && (
          <div className="p-10 text-center text-red-400">{error}</div>
        )}

        {!isLoading && !error && (
          <div className="flex-grow overflow-y-auto p-6 space-y-8">
            {/* ---------- PROJECT DATA CARDS ---------- */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-white">
                Project Data
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* --- Papers --- */}
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h4 className="font-bold mb-2">
                    Papers ({papers.length})
                  </h4>
                  <ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">
                    {papers.length > 0 ? (
                      papers.map((p) => (
                        <li
                          key={p.cid}
                          className="flex items-start gap-2 truncate"
                          title={p.title}
                        >
                          <DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" />
                          <span>{p.title}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500">No papers found.</li>
                    )}
                  </ul>
                </div>

                {/* --- Experiments --- */}
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h4 className="font-bold mb-2">
                    Experiment Data ({experiments.length})
                  </h4>
                  <ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">
                    {experiments.length > 0 ? (
                      experiments.map((e) => (
                        <li
                          key={e.cid}
                          className="flex items-start gap-2 truncate"
                          title={e.title}
                        >
                          <DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" />
                          <span>{e.title}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500">
                        No experiments found.
                      </li>
                    )}
                  </ul>
                </div>

                {/* --- Analyses --- */}
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h4 className="font-bold mb-2">
                    Analyses ({analyses.length})
                  </h4>
                  <ul className="text-sm space-y-2 text-gray-300 max-h-48 overflow-y-auto pr-2">
                    {analyses.length > 0 ? (
                      analyses.map((a) => (
                        <li
                          key={a.cid}
                          className="flex items-start gap-2 truncate"
                          title={a.title}
                        >
                          <DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" />
                          <span>{a.title}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500">No analyses found.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* ---------- ON-CHAIN AUDIT LOG ---------- */}
            {project.nft_id && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-white">
                  <a
                    href={`https://testnet.flowscan.io/nft/A.4971e1983b20b758.KintaGenNFT.NFT/token/A.4971e1983b20b758.KintaGenNFT.NFT-${project.nft_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Block&nbsp;Explorer&nbsp;LOG:&nbsp;{project.nft_id}
                  </a>
                </h3>

                <div className="bg-gray-900/50 p-4 rounded-lg max-h-64 overflow-y-auto">
                  {story.length > 0 ? (
                    <ul className="space-y-4">
                      {story.map((step) => {
                        const stepIdx = Number(step.stepNumber);
                        const cleanedAction = step.action.replace(
                          /\s*Results:.*/i,
                          ''
                        );

                        return (
                          <li
                            key={step.stepNumber}
                            className="text-sm border-l-2 border-purple-500 pl-4 space-y-1"
                          >
                            {/* Step number and action */}
                            <p className="font-bold text-white">
                              Step&nbsp;{stepIdx}:&nbsp;{cleanedAction}
                            </p>

                            {/* Done at */}
                            <p className="text-gray-400 font-mono text-xs">
                              Done&nbsp;at:&nbsp;
                              {formatTimestamp(step.timestamp)}
                            </p>

                            {/* Result CID (skip for step 0) */}
                            {stepIdx !== 0 && step.resultCID && (
                              <a
                                href={`https://0xcdb8cc9323852ab3bed33f6c54a7e0c15d555353.calibration.filcdn.io/${step.resultCID}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-300 font-mono hover:underline break-all"
                              >
                                Result&nbsp;CID:&nbsp;
                                {shortenCID(step.resultCID)}
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No log entries found for this NFT.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
