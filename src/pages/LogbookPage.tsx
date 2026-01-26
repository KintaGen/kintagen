import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNftStory } from '../flow/kintagen-nft';
import { useFlowConfig } from '@onflow/react-sdk';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { ArrowLeftIcon, ClockIcon, BeakerIcon, ArrowTopRightOnSquareIcon, CameraIcon } from '@heroicons/react/24/solid';

// Components
import { LogbookAnalysisEntry } from '../components/LogbookAnalysisEntry';
import { CustomObservationDisplay } from '../components/analysis/custom/CustomObservationDisplay';
import { LogbookMapDisplay } from '../components/LogbookMapDisplay';
// NEW IMPORTS FOR PROFILE CARD AND SECURE DATA DISPLAY
import ProfileCard from '../components/profiles/ProfileCard';
import { useNostr, type NostrProfile } from '../contexts/NostrContext';

const LogbookPage = () => {
  const { ownerAddress, nftId } = useParams();
  const numericNftId = nftId ? parseInt(nftId, 10) : undefined;

  const flowConfig = useFlowConfig();
  const { fetchProfileByFlowWalletAddress } = useNostr();

  // State for the NFT owner's Nostr profile
  const [ownerNostrProfile, setOwnerNostrProfile] = useState<NostrProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<Error | null>(null);

  // Using the hook structure that you've confirmed works correctly
  const { projectName, story, isLoading, error } = useNftStory({
    nftId: numericNftId,
    ownerAddress: ownerAddress,
  });

  const pageTitle = projectName ? `${projectName} - KintaGen Logbook` : 'Logbook - KintaGen';
  usePageTitle(pageTitle);

  // Effect to fetch the owner's Nostr profile
  useEffect(() => {
    const loadOwnerProfile = async () => {
      if (!ownerAddress) {
        setIsProfileLoading(false);
        return;
      }
      setIsProfileLoading(true);
      setProfileError(null);
      try {
        const profile = await fetchProfileByFlowWalletAddress(ownerAddress);
        console.log(profile)
        setOwnerNostrProfile(profile);
      } catch (err) {
        console.error("Failed to fetch owner's Nostr profile:", err);
        setProfileError(err as Error);
      } finally {
        setIsProfileLoading(false);
      }
    };

    loadOwnerProfile();
  }, [ownerAddress, fetchProfileByFlowWalletAddress]); // Re-fetch if ownerAddress or fetchProfile changes


  const flowscanURL = (nftId: string) => {
    const contractAddr = flowConfig.addresses["KintaGenNFT"];
    const network = flowConfig.flowNetwork;
    if (network === 'testnet' && contractAddr) {
      return `https://testnet.flowscan.org/nft/A.${contractAddr.replace("0x", "")}.PublicKintaGenNFTv3.NFT/${nftId}`;
    }
    return `#`;
  };

  // Render loading state
  if (isLoading) {
    return (
      <>
        <Helmet><title>Loading Logbook...</title></Helmet>
        <div className="text-white text-center p-10">Loading NFT Logbook...</div>
      </>
    );
  }

  // Render error state
  if (error) {
    return (
       <>
        <Helmet><title>Error</title></Helmet>
        <div className="text-red-400 text-center p-10">Error fetching NFT data: {error.message}</div>
      </>
    );
  }

  // Render empty state
  if (!story || story.length === 0) {
    return (
      <>
        <Helmet><title>Logbook Not Found</title></Helmet>
        <div className="text-gray-400 text-center p-10">No log history found for this NFT.</div>
      </>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`On-chain logbook for ${projectName || 'this project'}.`} />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center"> {/* Adjusted for back button and profile */}
          <Link to="/projects" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to All Projects
          </Link>
        </div>

        {/* NFT Owner's Profile Card */}
        {isProfileLoading && (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse p-6 mb-8 text-center">
            <div className="w-24 h-24 rounded-full bg-gray-700 mx-auto mb-4"></div>
            <div className="h-6 bg-gray-700 rounded w-3/4 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mx-auto"></div>
          </div>
        )}

        {!isProfileLoading && profileError && (
          <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg mb-8">
            Error loading owner's profile: {profileError.message}
          </div>
        )}

        {!isProfileLoading && ownerNostrProfile && (
          <div className="mb-8"> {/* Added margin-bottom for spacing */}
            <h2 className="text-xl font-bold mb-4">NFT Owner</h2>
            <ProfileCard profile={ownerNostrProfile} />
          </div>
        )}

        <h3 className="text-2xl font-semibold text-white mb-4 mt-8">On-Chain Logbook</h3> {/* Added mt-8 */}

        <div className="space-y-8">
          {story.map((step, index) => {

            // --- ENTRY 1: The Origin (Project Minting) ---
            if (index === 0) {
              return (
                <div key={index} className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700">
                  <img
                    src={`https://dweb.link/ipfs/${step.ipfsHash}`}
                    alt={step.title}
                    className="w-full h-auto max-h-80 object-cover"
                  />
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <h1 className="text-xl font-bold flex items-center gap-3">
                        <BeakerIcon className="h-6 w-6 text-cyan-400" />
                        {projectName}
                      </h1>

                      <a
                        href={flowscanURL(nftId || "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        View on Explorer
                        <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                      </a>
                    </div>

                    <p className="text-gray-300 mt-2 text-sm">{step.description}</p>
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                      <ClockIcon className="h-3 w-3" />
                      Minted: {new Date(parseFloat(step.timestamp) * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            }

            // --- ENTRY TYPE CHECKING ---
            const isFieldObservation = step.agent.includes("Field Observer") || step.title.includes("Field Obs");

            // --- ENTRY 2A: Custom Field Observations (with Map) ---
            if (isFieldObservation) {
              const mockJob = {
                projectId: nftId || "",
                state: 'logged' as const,
                logData: step,
                inputDataHash: step.description.includes('Hash: ') ? step.description.split('Hash: ')[1] : ''
              };

              return (
                <div key={index} className="relative pl-4 md:pl-0">
                  {/* Timeline Line (Visual Connector) */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-700 md:-left-8 hidden md:block"></div>

                  <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                    {/* Header Bar */}
                    <div className="bg-gray-800/50 p-4 border-b border-gray-700 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-green-400">
                        <CameraIcon className="h-5 w-5" />
                        <span className="font-semibold text-sm uppercase tracking-wider">Field Observation</span>
                      </div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {new Date(parseFloat(step.timestamp) * 1000).toLocaleString()}
                      </span>
                    </div>

                    {/* NEW LAYOUT: Display and Map Side-by-Side */}
                    <div className="p-4 space-y-4">
                        <div>
                            <CustomObservationDisplay job={mockJob} />
                        </div>
                        <div>
                            {/* 2. RENDER THE MAP COMPONENT, passing the main artifact hash */}
                            <LogbookMapDisplay ipfsHash={step.ipfsHash} />
                        </div>
                    </div>
                  </div>
                </div>
              );
            }

            // --- ENTRY 2B: Standard Analysis (LD50, GCMS, etc) ---
            return (
              <div key={index} className="relative pl-4 md:pl-0">
                 {/* Timeline Line */}
                 <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-700 md:-left-8 hidden md:block"></div>
                 <LogbookAnalysisEntry step={step} /> {/* Pass secureData to LogbookAnalysisEntry */}

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LogbookPage;