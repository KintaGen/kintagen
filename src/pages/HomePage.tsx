import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BeakerIcon, 
  CubeTransparentIcon, 
  LockClosedIcon, 
  CpuChipIcon, 
  CloudArrowUpIcon,
  DocumentDuplicateIcon,
  ArchiveBoxXMarkIcon,
  ArrowRightIcon,
  ChartBarIcon
} from '@heroicons/react/24/solid';

// A small feature card component for reusability
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
          KintaGen: The AI-Powered Lab Assistant
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-gray-300 mb-8">
          An integrated platform for modern life-science labs, combining decentralized storage, on-chain audit trails, and powerful AI agents to accelerate reproducible research.
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
          <FeatureCard icon={<ArchiveBoxXMarkIcon className="h-6 w-6 text-red-400" />} title="Insecure & Ephemeral Data">
            Eliminate version control chaos and lost files. KintaGen provides a single, permanent source of truth for your datasets, served at CDN speeds.
          </FeatureCard>
          <FeatureCard icon={<DocumentDuplicateIcon className="h-6 w-6 text-amber-400" />} title="Lack of Reproducibility">
            Create a tamper-proof, on-chain log for every project. Prove exactly which script and dataset produced a result, ensuring FAIR compliance.
          </FeatureCard>
          <FeatureCard icon={<LockClosedIcon className="h-6 w-6 text-cyan-400" />} title="Data Silos & Security Risks">
            Securely collaborate on pre-publication data. On-chain, NFT-gated access control ensures your intellectual property remains private until you're ready to share.
          </FeatureCard>
        </div>
      </div>

      {/* --- The Solution / Pillars Section --- */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center mb-8">Our Decentralized Foundation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard icon={<CloudArrowUpIcon className="h-6 w-6 text-blue-400" />} title="Verifiable, High-Speed Storage">
            <strong>Filecoin & FilCDN:</strong> All data is stored verifiably on Filecoin and served globally via the FilCDN hot-storage cache for sub-second downloads, even for multi-gigabyte datasets.
          </FeatureCard>
          <FeatureCard icon={<LockClosedIcon className="h-6 w-6 text-green-400" />} title="On-Chain Access Control">
            <strong>Flow EVM & Lit Protocol:</strong> Files can be AES-encrypted in-browser. A Flow EVM NFT acts as a transferable key, allowing only the wallet holder to grant decryption permissions.
          </FeatureCard>
          <FeatureCard icon={<CubeTransparentIcon className="h-6 w-6 text-purple-400" />} title="Immutable Logbooks">
            <strong>Flow (Cadence) NFTs:</strong> Every analysis step is appended to a project-specific Cadence NFT, creating an immutable, verifiable audit trail perfect for compliance and reproducibility.
          </FeatureCard>
        </div>
      </div>
      
      {/* --- The AI Layer --- */}
      <div className="text-center py-12">
        <div className="inline-block bg-gray-800 p-3 rounded-full mb-4">
          <CpuChipIcon className="h-8 w-8 text-fuchsia-400" />
        </div>
        <h2 className="text-2xl font-bold mb-4">On-Chain Data Meets AI</h2>
        <p className="max-w-2xl mx-auto text-gray-300">
          KintaGen layers a suite of AI services on this robust data foundation, transforming it into an autonomous research co-pilot that can extract metadata, run complex analyses, and perform Q&A on your project's data.
        </p>
      </div>

      {/* --- Explore the Demo CTA --- */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center mb-8">Explore the Demo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/projects" className="block bg-gray-800 p-6 rounded-lg hover:bg-gray-700/50 hover:border-purple-500 border border-gray-700 transition-all group">
            <div className="flex items-center gap-4 mb-3">
              <BeakerIcon className="h-8 w-8 text-purple-400" />
              <h3 className="text-xl font-bold">Projects & On-Chain Logs</h3>
            </div>
            <p className="text-gray-400 mb-4">Create new research projects and view your existing on-chain assets. Each project is an NFT that serves as an immutable logbook.</p>
            <span className="font-semibold text-purple-400 flex items-center gap-2">Go to Projects <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
          <Link to="/analysis" className="block bg-gray-800 p-6 rounded-lg hover:bg-gray-700/50 hover:border-cyan-500 border border-gray-700 transition-all group">
            <div className="flex items-center gap-4 mb-3">
              <ChartBarIcon className="h-8 w-8 text-cyan-400" />
              <h3 className="text-xl font-bold">LD50 Dose-Response Analysis</h3>
            </div>
            <p className="text-gray-400 mb-4">Select an on-chain project and run a real LD₅₀ analysis in your browser using WebR. Log the results permanently to the project's NFT.</p>
            <span className="font-semibold text-cyan-400 flex items-center gap-2">Run an Analysis <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;