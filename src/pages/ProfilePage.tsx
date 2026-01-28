// pages/ProfilePage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNostr, type NostrLink } from '../contexts/NostrContext';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import { Link } from 'react-router-dom';
import {
    UserCircleIcon,
    ArrowPathIcon,
    PencilSquareIcon,
    CheckCircleIcon,
    PlusIcon,
    TrashIcon,
    LinkIcon,
    ArrowTopRightOnSquareIcon,
    WalletIcon,
    ShareIcon,
    EnvelopeIcon,
    LockClosedIcon,
    LockOpenIcon
} from '@heroicons/react/24/solid';
import NostrInfo from '../components/profile/NostrInfo';
import ProjectGrid from '../components/projects/ProjectGrid';
import { useNftsByOwner } from '../flow/kintagen-nft';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import DataShareRequests from '../components/profile/DataShareRequests';
import DataSharedRequests from '../components/profile/DataSharedRequests';

import ConnectWalletPrompt from '../components/projects/ConnectWalletPrompt';
import SecureDataLogs from '../components/profile/SecureDataLogs'; // <--- IMPORT THE NEW COMPONENT

const ProfilePage: React.FC = () => {
    usePageTitle('My Profile - KintaGen');

    const { user: flowUser } = useFlowCurrentUser();
    const { 
        pubkey,
        privKey,
        profile,
        connectWithFlow,
        updateProfile,
        isLoading: isNostrLoading
    } = useNostr();


    // Add 'secure-logs' to the activeTab state
    const [activeTab, setActiveTab] = useState<'profile' | 'nfts' | 'requests' | 'secure-logs' | 'data-shared'>('profile');

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [about, setAbout] = useState('');
    const [flowWalletAddress, setFlowWalletAddress] = useState('');
    const [picture, setPicture] = useState('');
    const [links, setLinks] = useState<NostrLink[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { ownedNfts, isLoading: isLoadingNfts, error: nftsError } = useNftsByOwner(flowUser?.addr);

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setAbout(profile.about || '');
            setFlowWalletAddress(profile.flowWalletAddress || flowUser?.addr || '');
            setPicture(profile.picture || '');
            setLinks(profile.links || []);
        } else if (flowUser?.loggedIn) {
            setFlowWalletAddress(flowUser.addr || '');
        }
    }, [profile, flowUser]);


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
            const validLinks = links.filter(l => l.title.trim() !== "" && l.url.trim() !== "");
            await updateProfile(name, about, validLinks, flowWalletAddress, picture);
            setLinks(validLinks);
            setIsEditing(false);
        } catch (e) {
            alert("Failed to save profile.");
        } finally {
            setIsSaving(false);
        }
    };


    const defaultPicture = "https://via.placeholder.com/150/4B5563/D1D5DB?text=No+Pic";
    const currentProfilePicture = picture || profile?.picture || defaultPicture;


    if (!flowUser?.loggedIn) {
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                 <h1 className="text-3xl font-bold mb-8">My Profile</h1>
                 <div className="mt-10"><ConnectWalletPrompt /></div>
            </div>
        );
    }

    if (!pubkey) {
        return (
            <div className="max-w-md mx-auto text-center p-8 bg-gray-800 rounded-lg shadow-lg mt-10">
                <h1 className="text-2xl font-bold mb-4">Initialize Identity</h1>
                <p className="text-gray-400 mb-6">
                    Sign a message to generate your decentralized identity keys (Nostr).
                    These keys are derived deterministically from your Flow wallet.
                </p>
                <button
                    onClick={connectWithFlow}
                    disabled={isNostrLoading}
                    className="bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 flex items-center mx-auto"
                >
                    {isNostrLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin mr-2"/> : null}
                    {isNostrLoading ? 'Generating Keys...' : 'Initialize Identity'}
                </button>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>{profile?.name ? `${profile.name}'s Profile` : 'My Profile'} - KintaGen</title>
                <meta name="description" content="Manage your KintaGen Nostr profile and view your minted NFTs." />
            </Helmet>
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">My Profile</h1>
                    {pubkey && (
                        <div className="flex items-center gap-2">
                             <Link
                                to={`/profile/${pubkey}`}
                                className="text-sm text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
                            >
                                <ShareIcon className="h-4 w-4" /> Share Profile
                            </Link>
                            <div className="text-xs text-gray-500 font-mono bg-gray-900 p-2 rounded border border-gray-700">
                                Nostr PubKey: {pubkey.slice(0, 8)}...{pubkey.slice(-8)}
                            </div>
                        </div>
                    )}
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
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`${activeTab === 'requests' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-1`}
                        >
                            <EnvelopeIcon className="h-4 w-4" /> Data Requests
                        </button>
                        {/* New Tab for Secure Data Logs */}
                        <button
                            onClick={() => setActiveTab('secure-logs')}
                            className={`${activeTab === 'secure-logs' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-1`}
                        >
                            <LockClosedIcon className="h-4 w-4" /> Secure Data Logs
                        </button>
                        <button
                            onClick={() => setActiveTab('data-shared')}
                            className={`${activeTab === 'data-shared' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-1`}
                        >
                            <LockOpenIcon className="h-4 w-4" /> Data Shared
                        </button>
                    </nav>
                </div>

                {activeTab === 'profile' && (
                    <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg border border-gray-700">
                        {/* --- HEADER SECTION --- */}
                        <div className="flex items-start gap-6 mb-8 border-b border-gray-700 pb-8">
                            <div className="flex-shrink-0 relative">
                                <img
                                    src={currentProfilePicture}
                                    alt={name || "Nostr User"}
                                    className="h-24 w-24 rounded-full object-cover border-2 border-purple-500"
                                    onError={(e) => { (e.target as HTMLImageElement).src = defaultPicture; }}
                                />
                                {isEditing && (
                                    <label className="absolute -bottom-1 -right-1 bg-purple-600 p-2 rounded-full cursor-pointer hover:bg-purple-500 transition-colors">
                                        <PencilSquareIcon className="h-5 w-5 text-white" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setPicture(reader.result as string);
                                                    };
                                                    reader.readAsDataURL(file);
                                                    alert("Image upload functionality not fully implemented. This is a local preview.");
                                                }
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
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

                        {/* --- FLOW WALLET ADDRESS SECTION --- */}
                        <div className="mb-8">
                            <label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2 block">
                                Flow Wallet Address
                            </label>
                            <div className="flex items-center gap-2">
                                <WalletIcon className="h-5 w-5 text-green-400" />
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={flowWalletAddress}
                                        onChange={(e) => setFlowWalletAddress(e.target.value)}
                                        className="w-full bg-gray-900 p-3 rounded-md border border-gray-600 text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                                        placeholder="Your Flow wallet address (e.g., 0x123abc...)"
                                        readOnly
                                    />
                                ) : (
                                    <p className="text-gray-300 font-mono break-all">
                                        {profile?.flowWalletAddress || <span className="italic text-gray-500">Not connected.</span>}
                                    </p>
                                )}
                            </div>
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
                                                <div className="md:col-span-1">
                                                    <input
                                                        type="text"
                                                        value={link.title}
                                                        onChange={(e) => updateLink(index, 'title', e.target.value)}
                                                        placeholder="Label (e.g. ORCID)"
                                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-purple-500 outline-none"
                                                    />
                                                </div>
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
                                            setName(profile?.name || '');
                                            setAbout(profile?.about || '');
                                            setFlowWalletAddress(profile?.flowWalletAddress || flowUser?.addr || '');
                                            setPicture(profile?.picture || '');
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
                )}

                {activeTab === 'nfts' && (
                    <ProjectGrid
                        projects={ownedNfts}
                        isLoading={isLoadingNfts}
                        onCardClick={() => { /* No modal needed for individual projects on this page */ }}
                        emptyMessage={flowUser?.addr ? `You haven't minted any NFTs with Flow wallet ${flowUser.addr}.` : "Connect your Flow wallet to view your minted NFTs."}
                    />
                )}

                {activeTab === 'requests' && (
                    <DataShareRequests />
                )}

                {/* Render the new SecureDataLogs component when 'secure-logs' tab is active */}
                {activeTab === 'secure-logs' && (
                    <SecureDataLogs />
                )}

                {activeTab === 'data-shared' && (
                    <DataSharedRequests />
                )}
            </div>

        </>
    );
};

export default ProfilePage;