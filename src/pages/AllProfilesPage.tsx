// src/pages/AllProfilesPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { useNostr, type NostrProfile } from '../contexts/NostrContext'; // Import useNostr and NostrProfile type

import ProfileCard from '../components/profiles/ProfileCard'; // Import the new ProfileCard

const AllProfilesPage: React.FC = () => {
  usePageTitle('All KintaGen Profiles - Nostr');

  const { fetchAllProfiles } = useNostr();
  const [profiles, setProfiles] = useState<NostrProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Removed selectedProfile state and related functions

  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedProfiles = await fetchAllProfiles();
        setProfiles(fetchedProfiles);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfiles();
  }, [fetchAllProfiles]); // Rerun when fetchAllProfiles reference changes (unlikely with useCallback)


  const renderSkeletons = () => (
    Array.from({ length: 9 }).map((_, index) => (
      <div key={index} className="bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse">
        <div className="flex items-center justify-center p-4">
          <div className="w-24 h-24 rounded-full bg-gray-700"></div>
        </div>
        <div className="p-4 pt-0 text-center">
          <div className="h-6 bg-gray-700 rounded w-3/4 mx-auto mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-full mb-1"></div>
          <div className="h-3 bg-gray-700 rounded w-5/6 mx-auto"></div>
        </div>
        <div className="border-t border-gray-600 p-2 flex flex-col items-center bg-gray-800/40">
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-1"></div>
          <div className="h-4 bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    ))
  );

  return (
    <>
      <Helmet>
        <title>All KintaGen Profiles - Nostr</title>
        <meta name="description" content="Discover all KintaGen users and their Nostr profiles linked to Flow wallets." />
      </Helmet>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-8">All KintaGen Profiles</h1>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderSkeletons()}
          </div>
        )}

        {!isLoading && error && (
          <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
            Error loading profiles: {error.message}
          </div>
        )}

        {!isLoading && !error && profiles.length === 0 && (
          <div className="text-center text-gray-400 bg-gray-800/50 p-6 rounded-lg">
            No KintaGen Nostr profiles found yet. Be the first to create one!
          </div>
        )}

        {!isLoading && !error && profiles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map(p => (
              // No onClick prop passed here as it's no longer used for a modal
              <ProfileCard key={p.pubkey} profile={p} /> 
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default AllProfilesPage;