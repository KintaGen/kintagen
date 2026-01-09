import React, { useState, useEffect } from 'react';
import { useNostr } from '../contexts/NostrContext'; // Use new context
import { useFlowCurrentUser } from '@onflow/react-sdk';
import { UserCircleIcon, ArrowPathIcon, PencilSquareIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import ConnectWalletPrompt from '../components/projects/ConnectWalletPrompt';
import NostrInfo from '../components/profile/NostrInfo';

const ProfilePage: React.FC = () => {
    const { user: flowUser } = useFlowCurrentUser();
    const { pubkey, privKey, profile, connect, updateProfile, isLoading } = useNostr();

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [about, setAbout] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Sync local state when profile loads
    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setAbout(profile.about || '');
        }
    }, [profile]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateProfile(name, about);
            setIsEditing(false);
        } catch (e) {
            alert("Failed to save profile.");
        } finally {
            setIsSaving(false);
        }
    };

    // 1. Not connected to Flow
    if (!flowUser?.loggedIn) {
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                 <h1 className="text-3xl font-bold mb-8">My Profile</h1>
                 <div className="mt-10"><ConnectWalletPrompt /></div>
            </div>
        );
    }

    // 2. Flow Connected, but not signed into Nostr
    if (!pubkey) {
        return (
            <div className="max-w-md mx-auto text-center p-8 bg-gray-800 rounded-lg shadow-lg mt-10">
                <h1 className="text-2xl font-bold mb-4">Initialize Identity</h1>
                <p className="text-gray-400 mb-6">
                    Sign a message to generate your decentralized identity keys (Nostr). 
                    These keys are derived deterministically from your Flow wallet.
                </p>
                <button 
                    onClick={connect} 
                    disabled={isLoading}
                    className="bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 flex items-center mx-auto"
                >
                    {isLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin mr-2"/> : null}
                    {isLoading ? 'Generating Keys...' : 'Initialize Identity'}
                </button>
            </div>
        );
    }
    
    // 3. Main Profile UI
    return (
        <div className="max-w-2xl mx-auto p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">My Profile</h1>
                <div className="text-xs text-gray-500 font-mono bg-gray-900 p-2 rounded">
                    Nostr PubKey: {pubkey.slice(0, 8)}...{pubkey.slice(-8)}
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                    <UserCircleIcon className="h-20 w-20 text-gray-500"/>
                    <div className="flex-1">
                        {isEditing ? (
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-2xl font-bold bg-gray-700 p-2 rounded-md border border-gray-600 text-white w-full"
                                placeholder="Display Name"
                            />
                        ) : (
                            <h2 className="text-2xl font-bold">{profile?.name || "Anonymous User"}</h2>
                        )}
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-400">About</label>
                    {isEditing ? (
                        <textarea
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            className="w-full mt-1 bg-gray-700 p-3 rounded-md border border-gray-600 text-white h-24"
                            placeholder="Tell us about your research..."
                        />
                    ) : (
                        <p className="mt-1 text-gray-300 whitespace-pre-wrap min-h-[5rem]">
                            {profile?.about || <span className="italic text-gray-500">No bio set.</span>}
                        </p>
                    )}
                </div>

                <div className="mt-6 text-right">
                    {isEditing ? (
                        <div className="flex gap-4 justify-end">
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white">Cancel</button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center disabled:bg-gray-500"
                            >
                                {isSaving ? <ArrowPathIcon className="h-5 w-5 animate-spin mr-2"/> : <CheckCircleIcon className="h-5 w-5 mr-2"/>}
                                Save to Nostr
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center hover:bg-gray-600"
                        >
                            <PencilSquareIcon className="h-5 w-5 mr-2"/>
                            Edit Profile
                        </button>
                    )}
                    {pubkey && privKey && (
                        <NostrInfo pubkey={pubkey} privKey={privKey} />
                    )}
                </div>
                
            </div>
        </div>
    );
};

export default ProfilePage;