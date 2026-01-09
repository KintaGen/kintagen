import React, { useState, useEffect } from 'react';
import { useNostr, type NostrLink } from '../contexts/NostrContext';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import { 
    UserCircleIcon, 
    ArrowPathIcon, 
    PencilSquareIcon, 
    CheckCircleIcon, 
    PlusIcon, 
    TrashIcon, 
    LinkIcon,
    ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/solid';
import ConnectWalletPrompt from '../components/projects/ConnectWalletPrompt';
import NostrInfo from '../components/profile/NostrInfo'; // Assuming you moved the component here

const ProfilePage: React.FC = () => {
    const { user: flowUser } = useFlowCurrentUser();
    const { pubkey, privKey, profile, connect, updateProfile, isLoading } = useNostr();

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [about, setAbout] = useState('');
    
    // State for the dynamic list of links
    const [links, setLinks] = useState<NostrLink[]>([]);
    
    const [isSaving, setIsSaving] = useState(false);

    // Sync local state when profile loads
    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setAbout(profile.about || '');
            // Load existing links or initialize empty
            setLinks(profile.links || []);
        }
    }, [profile]);

    // --- Link Management Functions ---
    const addLink = () => {
        setLinks([...links, { title: '', url: '' }]);
    };

    const removeLink = (index: number) => {
        const newLinks = [...links];
        newLinks.splice(index, 1);
        setLinks(newLinks);
    };

    const updateLink = (index: number, field: keyof NostrLink, value: string) => {
        const newLinks = [...links];
        newLinks[index] = { ...newLinks[index], [field]: value };
        setLinks(newLinks);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Filter out empty links before saving
            const validLinks = links.filter(l => l.title.trim() !== "" && l.url.trim() !== "");
            await updateProfile(name, about, validLinks);
            setLinks(validLinks); // Update local state with cleaned list
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
        <div className="max-w-3xl mx-auto p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">My Profile</h1>
                <div className="text-xs text-gray-500 font-mono bg-gray-900 p-2 rounded border border-gray-700">
                    Nostr PubKey: {pubkey.slice(0, 8)}...{pubkey.slice(-8)}
                </div>
            </div>

            <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg border border-gray-700">
                {/* --- HEADER SECTION --- */}
                <div className="flex items-start gap-6 mb-8 border-b border-gray-700 pb-8">
                    <UserCircleIcon className="h-24 w-24 text-gray-500 flex-shrink-0"/>
                    <div className="flex-1 w-full">
                        <label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-1 block">Display Name</label>
                        {isEditing ? (
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-2xl font-bold bg-gray-900 p-3 rounded-md border border-gray-600 text-white w-full focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="e.g. Dr. Jane Doe"
                            />
                        ) : (
                            <h2 className="text-3xl font-bold text-white">{profile?.name || "Anonymous User"}</h2>
                        )}
                    </div>
                </div>

                {/* --- ABOUT SECTION --- */}
                <div className="mb-8">
                    <label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2 block">About</label>
                    {isEditing ? (
                        <textarea
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            className="w-full bg-gray-900 p-4 rounded-md border border-gray-600 text-gray-200 min-h-[120px] focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="Tell us about your research, academic background, or interests..."
                        />
                    ) : (
                        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {profile?.about || <span className="italic text-gray-500">No bio set.</span>}
                        </p>
                    )}
                </div>

                {/* --- LINKS SECTION --- */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-3">
                        <label className="text-xs uppercase tracking-wider text-gray-500 font-bold block">
                            Academic & Social Links
                        </label>
                        {isEditing && (
                            <button 
                                onClick={addLink}
                                className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 font-bold"
                            >
                                <PlusIcon className="h-4 w-4" /> Add Link
                            </button>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="space-y-3">
                            {links.map((link, index) => (
                                <div key={index} className="flex gap-2 items-start animate-fade-in-up">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {/* Label Input */}
                                        <div className="md:col-span-1">
                                            <input
                                                type="text"
                                                value={link.title}
                                                onChange={(e) => updateLink(index, 'title', e.target.value)}
                                                placeholder="Label (e.g. ORCID)"
                                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-purple-500 outline-none"
                                            />
                                        </div>
                                        {/* URL Input */}
                                        <div className="md:col-span-2">
                                            <input
                                                type="text"
                                                value={link.url}
                                                onChange={(e) => updateLink(index, 'url', e.target.value)}
                                                placeholder="URL (https://...)"
                                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-300 focus:border-purple-500 outline-none font-mono"
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => removeLink(index)}
                                        className="p-2 text-red-400 hover:bg-gray-700 rounded"
                                        title="Remove Link"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                            {links.length === 0 && (
                                <div className="text-center p-4 border border-dashed border-gray-700 rounded-lg text-gray-500 text-sm">
                                    No links added yet. Click "Add Link" to verify your credentials.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {profile?.links && profile.links.length > 0 ? (
                                profile.links.map((link, index) => (
                                    <a 
                                        key={index}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded-lg transition-all group"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <LinkIcon className="h-4 w-4 text-purple-400 flex-shrink-0" />
                                            <span className="font-medium text-white truncate">{link.title}</span>
                                        </div>
                                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-500 group-hover:text-white" />
                                    </a>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm italic col-span-2">No links provided.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* --- ACTIONS FOOTER --- */}
                <div className="mt-8 pt-6 border-t border-gray-700 flex justify-end">
                    {isEditing ? (
                        <div className="flex gap-4">
                            <button 
                                onClick={() => {
                                    setIsEditing(false);
                                    // Reset links to what's in profile
                                    setLinks(profile?.links || []);
                                }} 
                                className="px-4 py-2 text-gray-400 hover:text-white font-medium"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg shadow-green-900/20"
                            >
                                {isSaving ? <ArrowPathIcon className="h-5 w-5 animate-spin mr-2"/> : <CheckCircleIcon className="h-5 w-5 mr-2"/>}
                                Save Profile
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="bg-gray-700 text-white hover:bg-gray-600 font-semibold py-2 px-6 rounded-lg flex items-center border border-gray-600"
                        >
                            <PencilSquareIcon className="h-5 w-5 mr-2"/>
                            Edit Profile
                        </button>
                    )}
                </div>

                {/* --- ADVANCED NOSTR INFO --- */}
                {pubkey && privKey && (
                    <div className="mt-8">
                        <NostrInfo pubkey={pubkey} privKey={privKey} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfilePage;