// src/pages/IndividualProfilePage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { useNostr, type NostrProfile } from '../contexts/NostrContext';
import { useNftsByOwner, type NftProject } from '../flow/kintagen-nft'; // Import useNftsByOwner and NftProject

import ProjectGrid from '../components/projects/ProjectGrid'; // For displaying minted NFTs
import { UserCircleIcon,LinkIcon,ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid'; // For loading state

const IndividualProfilePage: React.FC = () => {
  const { pubkey } = useParams<{ pubkey: string }>(); // Get pubkey from URL
  const { fetchProfileByPubkey } = useNostr();
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<Error | null>(null);

  const [activeTab, setActiveTab] = useState<'profile' | 'nfts'>('profile');

  // Fetch Nostr profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!pubkey) {
        setProfileError(new Error("Nostr public key not found in URL."));
        setIsProfileLoading(false);
        return;
      }
      setIsProfileLoading(true);
      setProfileError(null);
      try {
        const fetchedProfile = await fetchProfileByPubkey(pubkey);
        setProfile(fetchedProfile);
      } catch (err) {
        setProfileError(err as Error);
      } finally {
        setIsProfileLoading(false);
      }
    };
    loadProfile();
  }, [pubkey, fetchProfileByPubkey]);

  // Use the Flow wallet address from the fetched Nostr profile to get NFTs
  const flowWalletAddress = profile?.flowWalletAddress;
  const { ownedNfts, isLoading: isLoadingNfts, error: nftsError } = useNftsByOwner(flowWalletAddress);

  usePageTitle(profile?.name ? `${profile.name}'s Profile` : 'Nostr Profile');

  const defaultPicture = "https://via.placeholder.com/150/4B5563/D1D5DB?text=No+Pic"; // A gray placeholder
  const profilePicture = profile?.picture || defaultPicture;

  if (isProfileLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 text-center">
        <h1 className="text-3xl font-bold mb-8">Loading Profile...</h1>
        <UserCircleIcon className="h-24 w-24 text-gray-600 animate-pulse mx-auto" />
        <p className="text-gray-400 mt-4">Fetching Nostr profile data...</p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 text-center text-red-400 bg-red-900/50 rounded-lg">
        <h1 className="text-3xl font-bold mb-8">Error Loading Profile</h1>
        <p>{profileError.message}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 text-center text-gray-400 bg-gray-800/50 rounded-lg">
        <h1 className="text-3xl font-bold mb-8">Profile Not Found</h1>
        <p>No KintaGen Nostr profile found for public key: {pubkey}</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{profile.name ? `${profile.name}'s Profile` : 'Nostr Profile'} - KintaGen</title>
        <meta name="description" content={`Nostr profile for ${profile.name || pubkey} on KintaGen.`} />
        <meta property="og:title" content={`${profile.name || 'Nostr Profile'} - KintaGen`} />
        <meta property="og:description" content={`View the Nostr profile and minted NFTs for ${profile.name || pubkey}.`} />
      </Helmet>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-6 mb-8">
          {profilePicture ? (
            <img 
              src={profilePicture} 
              alt={profile.name || "Nostr User"} 
              className="w-20 h-20 rounded-full object-cover border-2 border-purple-500 flex-shrink-0" 
              onError={(e) => { (e.target as HTMLImageElement).src = defaultPicture; }}
            />
          ) : (
            <UserCircleIcon className="w-20 h-20 text-gray-500 flex-shrink-0" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{profile.name || "Anonymous Nostr User"}</h1>
            <p className="text-sm text-gray-500 font-mono">Pubkey: {pubkey?.slice(0, 8)}...{pubkey?.slice(-8)}</p>
          </div>
        </div>

        <div className="border-b border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button 
              onClick={() => setActiveTab('profile')} 
              className={`${activeTab === 'profile' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              Nostr Profile
            </button>
            <button 
              onClick={() => setActiveTab('nfts')} 
              className={`${activeTab === 'nfts' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              Minted NFTs ({ownedNfts.length})
            </button>
          </nav>
        </div>

        <div>
          {activeTab === 'profile' && (
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-bold mb-4">About</h2>
              <p className="text-gray-300 whitespace-pre-wrap leading-relaxed mb-6">{profile.about || <span className="italic text-gray-500">No bio set.</span>}</p>
              
              {profile.flowWalletAddress && (
                <div className="mb-4">
                  <span className="font-medium text-gray-400">Flow Wallet:</span>{' '}
                  <span className="text-green-400 font-mono break-all">{profile.flowWalletAddress}</span>
                </div>
              )}

              {profile.links && profile.links.length > 0 && (
                <div className="mb-4">
                  <span className="font-medium text-gray-400">Links:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {profile.links.map((link, index) => (
                      <a 
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded-lg transition-all group"
                      >
                          <div className="flex items-center gap-2 overflow-hidden">
                              <LinkIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                              <span className="font-medium text-white truncate">{link.title}</span>
                          </div>
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-500 group-hover:text-white" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'nfts' && (
            <ProjectGrid 
              projects={ownedNfts} 
              isLoading={isLoadingNfts} 
              onCardClick={() => { /* No modal needed for individual projects on this page */ }} 
              emptyMessage={flowWalletAddress ? `This user hasn't minted any NFTs with Flow wallet ${flowWalletAddress}.` : "No Flow wallet address available to fetch NFTs."}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default IndividualProfilePage;