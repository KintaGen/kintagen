/* --------------------------------------------------------------------------
 *  DashboardPage.tsx · The main orchestrator for the dashboard.
 * -------------------------------------------------------------------------*/
import React, { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import ProjectDetail from '../components/projects/ProjectDetail';

// Import all the organized components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import StatCardsGrid from '../components/dashboard/StatCardsGrid';
import RecentActivityGrid from '../components/dashboard/RecentActivityGrid';
import DateRangeSelector from '../components/dashboard/DateRangeSelector';
import ChartWrapper from '../components/dashboard/ChartWrapper';
import AdditionsChart from '../components/dashboard/AdditionsChart';
import TotalsChart from '../components/dashboard/TotalsChart';

import { type ApiProject, type ApiGenericItem, type IndexedNftInfo, type View, type ProjectWithNumberId } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// This is the type expected by the ProjectDetail modal
interface Project extends ProjectWithNumberId {
  description: string;
  created_at: string;
}

const DashboardPage: React.FC = () => {
  usePageTitle('Dashboard - KintaGen');
  
  // --- State Management ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [papers, setPapers] = useState<ApiGenericItem[]>([]);
  const [experiments, setExperiments] = useState<ApiGenericItem[]>([]);
  const [analyses, setAnalyses] = useState<ApiGenericItem[]>([]);
  const [allNfts, setAllNfts] = useState<IndexedNftInfo[]>([]); // State holds the indexed NFTs
  const [selectedNft, setSelectedNft] = useState<Project | null>(null);
  const [view, setView] = useState<View>('monthly');

  // --- Data Fetching (Centralized) ---
  useEffect(() => {
    const getJSON = async <T,>(url: string): Promise<T> => {
      const r = await fetch(url, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
      if (!r.ok) throw new Error(`${url} → ${r.status}`);
      return r.json();
    };
    const getDataList = (type: string) => getJSON<{ data: ApiGenericItem[] }>(`${API_BASE}/data/${type}?limit=1000&sort=created_at&order=DESC`).then(res => res.data);

    const loadAllData = async () => {
      try {
        setError(null);
        setLoading(true);
        // Fetches all required data in parallel, including from the new /nfts endpoint
        const [prj, pap, exp, ana] = await Promise.all([
          getJSON<ApiProject[]>(`${API_BASE}/projects`),
          getDataList('paper'),
          getDataList('experiment'),
          getDataList('analysis'),
        ]);
        setProjects(prj);
        setPapers(pap);
        setExperiments(exp);
        setAnalyses(ana);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  // --- Memoized Data Processing ---
  const stats = useMemo(() => [
    { title: 'Projects', value: projects.length.toLocaleString() },
    { title: 'Papers', value: papers.length.toLocaleString() },
    { title: 'Experiments', value: experiments.length.toLocaleString() },
    { title: 'Analysis', value: analyses.length.toLocaleString() }, // This stat card now works correctly
  ], [projects, papers, experiments, analyses]);
  
  const timelineRows = useMemo(() => {
    const now = new Date();
    const labels: string[] = (() => {
      switch (view) {
        case 'weekly':
          return [...Array(7)].map((_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
          });
        case 'yearly':
          return [...Array(12)].map((_, i) => {
            const d = new Date(now);
            d.setMonth(d.getMonth() - (11 - i));
            return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
          });
        default: // 'monthly'
          return [...Array(30)].map((_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (29 - i));
            return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
          });
      }
    })();

    const bucketLabel = (d: Date): string => {
      switch (view) {
        case 'weekly':
        case 'monthly':
          return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
        case 'yearly':
          return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      }
    };

    const template = labels.reduce(
      (acc, l) => ({ ...acc, [l]: { Projects: 0, Papers: 0, Experiments: 0, Analyses: 0 } }),
      {} as Record<string, Record<string, number>>
    );

    const bump = (arr: { created_at: string }[], key: 'Projects' | 'Papers' | 'Experiments' | 'Analyses') => {
      arr.forEach(({ created_at }) => {
        const lab = bucketLabel(new Date(created_at));
        if (template[lab]) {
          template[lab][key] += 1;
        }
      });
    };

    bump(projects, 'Projects');
    bump(papers, 'Papers');
    bump(experiments, 'Experiments');
    bump(analyses, 'Analyses');

    return labels.map((lab) => ({ label: lab, ...template[lab] }));
  }, [view, projects, papers, experiments, analyses]);
  
  const barRows = useMemo(() => 
    Object.entries({
      Projects: projects.length,
      Papers: papers.length,
      Experiments: experiments.length,
      Analyses: analyses.length,
    }).map(([name, total]) => ({ name, total })), 
    [projects, papers, experiments, analyses]
  );
  
  // --- Handlers ---
  const handleNftClick = (nft: IndexedNftInfo) => {
    // Creates the object needed for the ProjectDetail modal from the indexed NFT data
    const syntheticProject: Project = {
      id: nft.id,
      name: nft.agent,
      description: nft.run_hash,
      created_at: nft.created_at,
      nft_id: nft.id
    };
    setSelectedNft(syntheticProject);
  };

  // --- Render ---
  return (
    <>
      <Helmet>
        <title>Dashboard - KintaGen</title>
        <meta name="description" content="View statistics and activity across all your research projects, papers, experiments, and analyses. Track your research progress at a glance." />
        <meta name="keywords" content="dashboard, research statistics, data analytics, research tracking" />
        <meta property="og:title" content="Dashboard - KintaGen" />
        <meta property="og:description" content="View statistics and activity across all your research projects." />
      </Helmet>
      <div>
        <DashboardHeader loading={loading} error={error} />
      {!loading && !error && (
        <>
          <StatCardsGrid stats={stats} />
          <RecentActivityGrid
            projects={projects}
            papers={papers}
            experiments={experiments}
            analyses={analyses}
          />
          <DateRangeSelector view={view} onViewChange={setView} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2 mb-10">
            <ChartWrapper title="Record Additions">
              <AdditionsChart data={timelineRows} />
            </ChartWrapper>
            <ChartWrapper title="Total Records by Type">
              <TotalsChart data={barRows} />
            </ChartWrapper>
          </div>
        </>
      )}
      {selectedNft && (
        <ProjectDetail project={selectedNft} onClose={() => setSelectedNft(null)} />
      )}
    </div>
    </>
  );
};

export default DashboardPage;