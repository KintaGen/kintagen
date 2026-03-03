import React from 'react';
import type { Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { motion } from 'framer-motion';
import {
  BeakerIcon,
  CubeTransparentIcon,
  LockClosedIcon,
  CpuChipIcon,
  FingerPrintIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  ArrowRightIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/solid';

import LatestMintsSection from '../components/home/LatestMintsSection';

// Animation variants for staggered entrance
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

// Color config for feature cards
type IconColor = 'red' | 'amber' | 'cyan' | 'blue' | 'green' | 'purple' | 'fuchsia';
const colorMap: Record<IconColor, { border: string; bg: string; glow: string }> = {
  red: { border: 'border-red-500/40', bg: 'bg-red-900/20', glow: 'hover:border-red-500/70' },
  amber: { border: 'border-amber-500/40', bg: 'bg-amber-900/20', glow: 'hover:border-amber-500/70' },
  cyan: { border: 'border-cyan-500/40', bg: 'bg-cyan-900/20', glow: 'hover:border-cyan-500/70' },
  blue: { border: 'border-blue-500/40', bg: 'bg-blue-900/20', glow: 'hover:border-blue-500/70' },
  green: { border: 'border-green-500/40', bg: 'bg-green-900/20', glow: 'hover:border-green-500/70' },
  purple: { border: 'border-purple-500/40', bg: 'bg-purple-900/20', glow: 'hover:border-purple-500/70' },
  fuchsia: { border: 'border-fuchsia-500/40', bg: 'bg-fuchsia-900/20', glow: 'hover:border-fuchsia-500/70' },
};

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  color: IconColor;
  children: React.ReactNode;
}> = ({ icon, title, color, children }) => {
  const c = colorMap[color];
  return (
    <motion.div
      variants={itemVariants}
      className={`group relative bg-gray-800/60 border ${c.border} ${c.glow} p-6 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card cursor-default`}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-6 right-6 h-px ${c.bg} rounded-full opacity-60`} />
      <div className="flex items-center gap-3 mb-3">
        <div className={`${c.bg} border ${c.border} p-2.5 rounded-lg`}>
          {icon}
        </div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed">{children}</p>
    </motion.div>
  );
};

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-center mb-10">
    <h2 className="text-2xl font-bold text-white mb-3">{children}</h2>
    <div className="section-divider" />
  </div>
);

const HomePage: React.FC = () => {
  usePageTitle('KintaGen - Verifiable Logbook for Research');

  return (
    <>
      <Helmet>
        <title>KintaGen - Verifiable Logbook for Research</title>
        <meta name="description" content="KintaGen creates an unbreakable, on-chain link between your local datasets, your analysis, and your results." />
        <meta name="keywords" content="research, data integrity, blockchain, provenance, verifiable logbook, scientific research" />
        <meta property="og:title" content="KintaGen - Verifiable Logbook for Research" />
        <meta property="og:description" content="Your data stays with you. KintaGen creates an unbreakable, on-chain link between your local datasets, your analysis, and your results." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="max-w-6xl mx-auto">

        {/* ── Hero Section ── */}
        <div className="relative text-center py-20 px-4 overflow-hidden">
          {/* Background mesh gradients */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
            <div className="absolute top-10 right-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-600/10 rounded-full blur-2xl" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-purple-900/40 border border-purple-700/50 rounded-full px-4 py-1.5 mb-6 text-sm font-medium text-purple-300">
              <ShieldCheckIcon className="h-4 w-4" />
              Blockchain-Verified Research Platform
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
              The{' '}
              <span className="gradient-text">Verifiable Logbook</span>
              <br />
              for Your Research
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-gray-400 mb-10 leading-relaxed">
              Your data stays with you. KintaGen creates an unbreakable, on-chain link between your local datasets,
              your analysis, and your results. Never again question which data produced which outcome.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/projects"
                className="group flex items-center gap-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold py-3 px-7 rounded-xl transition-all duration-200 shadow-lg shadow-purple-900/40 hover:shadow-purple-900/60 hover:-translate-y-0.5"
              >
                Manage Projects
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/analysis"
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-white font-semibold py-3 px-7 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
              >
                Run Analysis
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ── Problem Section ── */}
        <section className="py-14 px-4">
          <SectionHeader>Solving Critical Lab Challenges</SectionHeader>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <FeatureCard color="red" icon={<LinkIcon className="h-5 w-5 text-red-400" />} title="Broken Links & Data Mismatches">
              Stop relying on file names. KintaGen generates a unique 'digital fingerprint' for your data, ensuring you always use the correct version and preventing costly errors.
            </FeatureCard>
            <FeatureCard color="amber" icon={<DocumentDuplicateIcon className="h-5 w-5 text-amber-400" />} title="The Reproducibility Crisis">
              Automatically create a verifiable, time-stamped record of your entire workflow. Confidently prove the link between a specific dataset, method, and result for peer review.
            </FeatureCard>
            <FeatureCard color="cyan" icon={<LockClosedIcon className="h-5 w-5 text-cyan-400" />} title="Verifying Collaboration">
              Ensure your whole team is working from the same page. Onboard collaborators to a project where they can independently verify they are using the correct source data.
            </FeatureCard>
          </motion.div>
        </section>

        {/* ── Solution Section ── */}
        <section className="py-14 px-4">
          <SectionHeader>A Foundation of Integrity & Provenance</SectionHeader>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <FeatureCard color="blue" icon={<FingerPrintIcon className="h-5 w-5 text-blue-400" />} title="Data Integrity via Hashing">
              KintaGen doesn't store your sensitive files. It calculates a unique fingerprint (CID) for your data, which is then used to track its usage and verify its integrity over time.
            </FeatureCard>
            <FeatureCard color="green" icon={<LockClosedIcon className="h-5 w-5 text-green-400" />} title="Controlled Access to Records">
              A project's verifiable logbook is a valuable asset. Using a digital 'key', you grant collaborators permission to view and contribute to the immutable project record.
            </FeatureCard>
            <FeatureCard color="purple" icon={<CubeTransparentIcon className="h-5 w-5 text-purple-400" />} title="Immutable Audit Trails">
              The fingerprints of your data, code, and results are permanently recorded in an on-chain log. This creates an unchangeable, time-stamped history of your research.
            </FeatureCard>
          </motion.div>
        </section>

        {/* ── AI Layer ── */}
        <section className="py-14 px-4">
          <motion.div
            className="relative overflow-hidden text-center bg-gradient-to-br from-gray-800/80 to-fuchsia-900/20 border border-fuchsia-700/30 rounded-2xl p-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-48 h-48 bg-fuchsia-600/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl" />
            </div>
            <div className="relative">
              <div className="inline-block bg-fuchsia-900/40 border border-fuchsia-700/50 p-3 rounded-xl mb-4">
                <CpuChipIcon className="h-7 w-7 text-fuchsia-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Unlock Deeper Insights from Your Records</h2>
              <p className="max-w-2xl mx-auto text-gray-400 leading-relaxed">
                KintaGen's AI works on the rich metadata within your project logs. Ask questions about your research history,
                find past analyses, and ensure consistency across your experiments — all without exposing your raw data.
              </p>
            </div>
          </motion.div>
        </section>

        <LatestMintsSection />

        {/* ── CTA Section ── */}
        <section className="py-14 px-4 pb-8">
          <SectionHeader>Explore the Platform</SectionHeader>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div variants={itemVariants}>
              <Link
                to="/projects"
                className="group block bg-gray-800/60 border border-purple-700/30 hover:border-purple-500/60 p-7 rounded-xl hover:bg-gray-800/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-purple-900/40 border border-purple-700/40 p-3 rounded-xl">
                    <BeakerIcon className="h-7 w-7 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Manage Projects & Logs</h3>
                </div>
                <p className="text-gray-400 mb-5 leading-relaxed text-sm">
                  Create projects that act as immutable logbooks. Register your local datasets to generate verifiable fingerprints and build a complete history of your work.
                </p>
                <span className="font-semibold text-purple-400 flex items-center gap-2 text-sm">
                  Go to Projects <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Link
                to="/analysis"
                className="group block bg-gray-800/60 border border-cyan-700/30 hover:border-cyan-500/60 p-7 rounded-xl hover:bg-gray-800/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-cyan-900/40 border border-cyan-700/40 p-3 rounded-xl">
                    <ChartBarIcon className="h-7 w-7 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Run Verifiable Analysis</h3>
                </div>
                <p className="text-gray-400 mb-5 leading-relaxed text-sm">
                  Link a registered dataset to an analysis. Run the computation and permanently record the fingerprints of the results and plots to your project's log.
                </p>
                <span className="font-semibold text-cyan-400 flex items-center gap-2 text-sm">
                  Run an Analysis <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>
          </motion.div>
        </section>
      </div>
    </>
  );
};

export default HomePage;