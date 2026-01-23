// src/components/profiles/ProfileCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { UserCircleIcon, LinkIcon, ArrowTopRightOnSquareIcon, WalletIcon } from '@heroicons/react/24/solid'; // Added WalletIcon
import type { NostrProfile } from '../../contexts/NostrContext'; // Import NostrProfile

interface ProfileCardProps {
  profile: NostrProfile;
  onClick?: (profile: NostrProfile) => void; // Made onClick optional
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onClick }) => {
  const defaultPicture = "https://via.placeholder.com/150/4B5563/D1D5DB?text=No+Pic"; // A gray placeholder
  const profilePicture = profile.picture || defaultPicture;
  // const shortPubkey = profile.pubkey ? `${profile.pubkey.substring(0, 8)}...${profile.pubkey.substring(profile.pubkey.length - 4)}` : 'N/A'; // No longer directly used in display

  return (
    <Link to={`/profile/${profile.pubkey}`} >
      <div 
        className="bg-gray-800/50 rounded-lg border border-gray-700 group relative transition-all duration-300 ease-in-out hover:border-purple-500 hover:scale-[1.03] hover:bg-gray-800"
      >
        <div className="flex items-center justify-center p-4">
          {profilePicture ? (
            <img 
              src={profilePicture} 
              alt={profile.name || "Nostr User"} 
              className="w-24 h-24 rounded-full object-cover border-2 border-purple-500 group-hover:scale-110 transition-transform duration-300" 
              onError={(e) => { (e.target as HTMLImageElement).src = defaultPicture; }} // Fallback on error
            />
          ) : (
            <UserCircleIcon className="w-24 h-24 text-gray-500" />
          )}
        </div>

        <div className="p-4 pt-0 text-center">
          <h3 className="font-semibold text-white text-lg truncate mb-1" title={profile.name}>{profile.name || "Anonymous Nostr User"}</h3>
          <p className="text-sm text-gray-400 mb-3 h-12 overflow-hidden">{profile.about || "No bio provided."}</p>
        </div>

        <div className="border-t border-gray-600 p-2 flex flex-col items-center bg-gray-800/40">
          {profile.flowWalletAddress && (
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1" title={profile.flowWalletAddress}>
                  <WalletIcon className="h-4 w-4 text-green-400" /> {/* Changed to WalletIcon */}
                  Flow: {profile.flowWalletAddress.substring(0, 6)}...{profile.flowWalletAddress.substring(profile.flowWalletAddress.length - 4)}
              </div>
          )}
          
          {/* Display up to 2 external links */}
          {profile.links && profile.links.slice(0, 2).map((link, index) => (
              <a 
                  key={index} 
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-blue-300 hover:text-blue-200 font-semibold transition-colors flex items-center gap-1 mb-1"
                  onClick={(e) => e.stopPropagation()} // Prevent any parent click handlers
              >
                  <LinkIcon className="h-4 w-4 text-blue-400" />
                  {link.title.substring(0, 15)}{link.title.length > 15 ? '...' : ''} <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </a>
          ))}

          {profile.pubkey && (
              <Link 
                  to={`/profile/${profile.pubkey}`} // Link to a dedicated profile page if you build one
                  className="text-xs text-purple-300 hover:text-purple-200 font-semibold transition-colors flex items-center gap-1 mt-1" // Added mt-1 for spacing
                  onClick={(e) => e.stopPropagation()} // Prevent parent div's onClick if it were still there
              >
                  View Nostr Profile 
                  <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </Link>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProfileCard;