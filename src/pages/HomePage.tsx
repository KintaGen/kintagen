import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BeakerIcon, 
  CubeTransparentIcon, 
  LockClosedIcon, 
  CpuChipIcon, 
  FingerPrintIcon, // Changed from CloudArrowUpIcon
  DocumentDuplicateIcon,
  LinkIcon, // Changed from ArchiveBoxXMarkIcon
  ArrowRightIcon,
  ChartBarIcon
} from '@heroicons/react/24/solid';

import LatestMintsSection from '../components/home/LatestMintsSection'; // 1. IMPORT THE NEW COMPONENT

// A small feature card component for reusability (Unchanged)
const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
    <div className="flex items-center gap-3 mb-3">
      <div className="bg-gray-700 p-2 rounded-md">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
    </div>
    <p className="text-gray-400 text-sm">{children}</p>
  </div>
);

const HomePage: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 text-white">
      
      {/* --- Hero Section --- */}
      <div className="text-center py-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          KintaGen: The Verifiable Logbook for Your Research
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-gray-300 mb-8">
          Your data stays with you. KintaGen creates an unbreakable, on-chain link between your local datasets, your analysis, and your results. Never again question which data produced which outcome.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/projects" className="bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-500 transition-colors">
            Manage Projects
          </Link>
          <Link to="/analysis" className="bg-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors">
            Run Analysis
          </Link>
        </div>
      </div>

      {/* --- The Problem Section --- */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center mb-8">Solving Critical Lab Challenges</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard icon={<LinkIcon className="h-6 w-6 text-red-400" />} title="Broken Links & Data Mismatches">
            Stop relying on file names. KintaGen generates a unique 'digital fingerprint' for your data, ensuring you always use the correct version and preventing costly errors.
          </FeatureCard>
          <FeatureCard icon={<DocumentDuplicateIcon className="h-6 w-6 text-amber-400" />} title="The Reproducibility Crisis">
            Automatically create a verifiable, time-stamped record of your entire workflow. Confidently prove the link between a specific dataset, method, and result for peer review.
          </FeatureCard>
          <FeatureCard icon={<LockClosedIcon className="h-6 w-6 text-cyan-400" />} title="Verifying Collaboration">
            Ensure your whole team is working from the same page. Onboard collaborators to a project where they can independently verify they are using the correct source data for their work.
          </FeatureCard>
        </div>
      </div>

      {/* --- The Solution / Pillars Section --- */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center mb-8">A Foundation of Integrity & Provenance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard icon={<FingerPrintIcon className="h-6 w-6 text-blue-400" />} title="Data Integrity via Hashing">
            KintaGen doesn't store your sensitive files. It calculates a unique fingerprint (CID) for your data, which is then used to track its usage and verify its integrity over time.
          </FeatureCard>
          <FeatureCard icon={<LockClosedIcon className="h-6 w-6 text-green-400" />} title="Controlled Access to Records">
            A project's verifiable logbook is a valuable asset. Using a digital 'key', you grant collaborators permission to view and contribute to the immutable project record, not the raw data itself.
          </FeatureCard>
          <FeatureCard icon={<CubeTransparentIcon className="h-6 w-6 text-purple-400" />} title="Immutable Audit Trails">
            The fingerprints of your data, code, and results are permanently recorded in a project's on-chain log. This creates an unchangeable, time-stamped history of your research from start to finish.
          </FeatureCard>
        </div>
      </div>
      
      {/* --- The AI Layer --- */}
      <div className="text-center py-12">
        <div className="inline-block bg-gray-800 p-3 rounded-full mb-4">
          <CpuChipIcon className="h-8 w-8 text-fuchsia-400" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Unlock Deeper Insights from Your Records</h2>
        <p className="max-w-2xl mx-auto text-gray-300">
          KintaGen's AI works on the rich metadata within your project logs. Ask questions about your research history, find past analyses, and ensure consistency across your experiments, all without exposing your raw data.
        </p>
      </div>
      
      <LatestMintsSection />

      {/* --- Explore the Demo CTA --- */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center mb-8">Explore the Platform</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/projects" className="block bg-gray-800 p-6 rounded-lg hover:bg-gray-700/50 hover:border-purple-500 border border-gray-700 transition-all group">
            <div className="flex items-center gap-4 mb-3">
              <BeakerIcon className="h-8 w-8 text-purple-400" />
              <h3 className="text-xl font-bold">Manage Projects & Logs</h3>
            </div>
            <p className="text-gray-400 mb-4">Create projects that act as immutable logbooks. Register your local datasets to generate verifiable fingerprints and build a complete history of your work.</p>
            <span className="font-semibold text-purple-400 flex items-center gap-2">Go to Projects <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
          <Link to="/analysis" className="block bg-gray-800 p-6 rounded-lg hover:bg-gray-700/50 hover:border-cyan-500 border border-gray-700 transition-all group">
            <div className="flex items-center gap-4 mb-3">
              <ChartBarIcon className="h-8 w-8 text-cyan-400" />
              <h3 className="text-xl font-bold">Run Verifiable Analysis</h3>
            </div>
            <p className="text-gray-400 mb-4">Link a registered dataset to an analysis. Run the computation and permanently record the fingerprints of the results and plots to your project's log.</p>
            <span className="font-semibold text-cyan-400 flex items-center gap-2">Run an Analysis <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;