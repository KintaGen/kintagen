// pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { useNostr, type NostrLink } from '../contexts/NostrContext';
import { useFlowCurrentUser } from '@onflow/react-sdk';
import { Link } from 'react-router-dom';
import {
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
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import NostrInfo from '../components/profile/NostrInfo';
import ProjectGrid from '../components/projects/ProjectGrid';
import { useNftsByOwner } from '../flow/kintagen-nft';
import DataShareRequests from '../components/profile/DataShareRequests';
import DataSharedRequests from '../components/profile/DataSharedRequests';
import ConnectWalletPrompt from '../components/projects/ConnectWalletPrompt';
import SecureDataLogs from '../components/profile/SecureDataLogs';

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

    const [activeTab, setActiveTab] = useState<'profile' | 'nfts' | 'requests' | 'secure-logs' | 'data-shared'>('profile');
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [about, setAbout] = useState('');
    const [flowWalletAddress, setFlowWalletAddress] = useState('');
    const [picture, setPicture] = useState('');
    const [links, setLinks] = useState<NostrLink[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { ownedNfts, isLoading: isLoadingNfts } = useNftsByOwner(flowUser?.addr);

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

    const addLink = () => setLinks([...links, { title: '', url: '' }]);

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
            const validLinks = links.filter(l => l.title.trim() !== '' && l.url.trim() !== '');
            await updateProfile(name, about, validLinks, flowWalletAddress, picture);
            setLinks(validLinks);
            setIsEditing(false);
        } catch {
            alert('Failed to save profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const defaultPicture = 'https://via.placeholder.com/150/4B5563/D1D5DB?text=No+Pic';
    const currentProfilePicture = picture || profile?.picture || defaultPicture;

    if (!flowUser?.loggedIn) {
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-extrabold gradient-text mb-1">My Profile</h1>
                    <p className="text-gray-500 text-sm">Manage your decentralized research identity</p>
                </div>
                <div className="mt-10"><ConnectWalletPrompt /></div>
            </div>
        );
    }

    if (!pubkey) {
        return (
            <div className="max-w-md mx-auto text-center p-8 mt-10">
                <div className="relative overflow-hidden bg-gray-800 border border-gray-700/60 rounded-2xl p-8 shadow-card">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-violet-900/10 pointer-events-none rounded-2xl" />
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-violet-500 rounded-t-2xl" />
                    <div className="relative">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-600 mb-5 shadow-glow-purple">
                            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Initialize Identity</h1>
                        <p className="text-gray-400 mb-7 text-sm leading-relaxed">
                            Sign a message to generate your decentralized identity keys (Nostr).
                            These keys are derived deterministically from your Flow wallet.
                        </p>
                        <button
                            onClick={connectWithFlow}
                            disabled={isNostrLoading}
                            className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/40 transition-all"
                        >
                            {isNostrLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : null}
                            {isNostrLoading ? 'Generating Keys...' : 'Initialize Identity'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>{profile?.name ? `${profile.name}'s Profile` : 'My Profile'} - KintaGen</title>
                <meta name="description" content="Manage your KintaGen Nostr profile and view your minted NFTs." />
            </Helmet>

            {/* ── Gradient Page Banner ── */}
            <div className="relative overflow-hidden -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-8 px-4 md:px-8 py-8 bg-gradient-to-br from-gray-900 via-purple-950/30 to-gray-900 border-b border-gray-700/40">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-64 h-32 bg-purple-600/10 rounded-full blur-3xl" />
                    <div className="absolute top-0 right-1/4 w-48 h-24 bg-violet-600/10 rounded-full blur-2xl" />
                </div>
                <div className="relative max-w-3xl mx-auto">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-extrabold gradient-text mb-1">My Profile</h1>
                            <p className="text-gray-500 text-sm">Manage your decentralized research identity</p>
                        </div>
                        {pubkey && (
                            <div className="flex items-center gap-3">
                                <Link
                                    to={`/profile/${pubkey}`}
                                    className="text-sm text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1.5 bg-purple-900/30 border border-purple-700/40 rounded-lg px-3 py-1.5 transition-colors hover:bg-purple-900/50"
                                >
                                    <ShareIcon className="h-3.5 w-3.5" /> Share Profile
                                </Link>
                                <div className="hidden md:flex text-xs text-gray-500 font-mono bg-gray-900/60 border border-gray-700/60 px-3 py-1.5 rounded-lg">
                                    {pubkey.slice(0, 8)}…{pubkey.slice(-8)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 md:px-8 pb-8">
                {/* ── Tab Navigation ── */}
                <div className="mb-6">
                    <div className="flex gap-1 bg-gray-900/70 p-1 rounded-xl border border-gray-700/50 overflow-x-auto">
                        {([
                            { id: 'profile', label: 'Profile', icon: <PencilSquareIcon className="h-4 w-4" /> },
                            { id: 'nfts', label: `NFTs (${ownedNfts.length})`, icon: <WalletIcon className="h-4 w-4" /> },
                            { id: 'requests', label: 'Data Requests', icon: <EnvelopeIcon className="h-4 w-4" /> },
                            { id: 'secure-logs', label: 'Secure Logs', icon: <LockClosedIcon className="h-4 w-4" /> },
                            { id: 'data-shared', label: 'Data Shared', icon: <LockOpenIcon className="h-4 w-4" /> },
                        ] as const).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-1.5 whitespace-nowrap py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200
                                    ${activeTab === tab.id
                                        ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-900/30'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                                    }`}
                            >
                                {tab.icon}{tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Profile Tab ── */}
                {activeTab === 'profile' && (
                    <div className="bg-gray-800 p-6 md:p-8 rounded-xl shadow-card border border-gray-700/60">
                        {/* Header */}
                        <div className="flex items-start gap-6 mb-8 border-b border-gray-700/60 pb-8">
                            <div className="flex-shrink-0 relative">
                                <img
                                    src={currentProfilePicture}
                                    alt={name || 'Nostr User'}
                                    className="h-24 w-24 rounded-full object-cover border-2 border-purple-500 shadow-glow-purple"
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
                                                    reader.onloadend = () => setPicture(reader.result as string);
                                                    reader.readAsDataURL(file);
                                                    alert('Image upload not fully implemented. Local preview only.');
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
                                        className="text-2xl font-bold bg-gray-900 p-3 rounded-lg border border-gray-600 text-white w-full focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="e.g. Dr. Jane Doe"
                                    />
                                ) : (
                                    <h2 className="text-3xl font-bold text-white">{profile?.name || 'Anonymous User'}</h2>
                                )}
                            </div>
                        </div>

                        {/* About */}
                        <div className="mb-8">
                            <label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2 block">About</label>
                            {isEditing ? (
                                <textarea
                                    value={about}
                                    onChange={(e) => setAbout(e.target.value)}
                                    className="w-full bg-gray-900 p-4 rounded-lg border border-gray-600 text-gray-200 min-h-[120px] focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="Tell us about your research, academic background, or interests..."
                                />
                            ) : (
                                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {profile?.about || <span className="italic text-gray-500">No bio set.</span>}
                                </p>
                            )}
                        </div>

                        {/* Flow Wallet */}
                        <div className="mb-8">
                            <label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2 block">Flow Wallet Address</label>
                            <div className="flex items-center gap-2">
                                <WalletIcon className="h-5 w-5 text-green-400 flex-shrink-0" />
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={flowWalletAddress}
                                        onChange={(e) => setFlowWalletAddress(e.target.value)}
                                        className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                                        placeholder="Your Flow wallet address"
                                        readOnly
                                    />
                                ) : (
                                    <p className="text-gray-300 font-mono break-all text-sm">
                                        {profile?.flowWalletAddress || <span className="italic text-gray-500">Not connected.</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Links */}
                        <div className="mb-8">
                            <div className="flex justify-between items-end mb-3">
                                <label className="text-xs uppercase tracking-wider text-gray-500 font-bold block">Academic & Social Links</label>
                                {isEditing && (
                                    <button onClick={addLink} className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 font-bold">
                                        <PlusIcon className="h-4 w-4" /> Add Link
                                    </button>
                                )}
                            </div>
                            {isEditing ? (
                                <div className="space-y-3">
                                    {links.map((link, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                                <div className="md:col-span-1">
                                                    <input
                                                        type="text"
                                                        value={link.title}
                                                        onChange={(e) => updateLink(index, 'title', e.target.value)}
                                                        placeholder="Label (e.g. ORCID)"
                                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-purple-500 outline-none"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <input
                                                        type="text"
                                                        value={link.url}
                                                        onChange={(e) => updateLink(index, 'url', e.target.value)}
                                                        placeholder="URL (https://...)"
                                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-gray-300 focus:border-purple-500 outline-none font-mono"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeLink(index)}
                                                className="p-2 text-red-400 hover:bg-gray-700 rounded-lg"
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
                                                className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded-xl transition-all group"
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <LinkIcon className="h-4 w-4 text-purple-400 flex-shrink-0" />
                                                    <span className="font-medium text-white truncate text-sm">{link.title}</span>
                                                </div>
                                                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-500 group-hover:text-white flex-shrink-0" />
                                            </a>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm italic col-span-2">No links provided.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions Footer */}
                        <div className="mt-8 pt-6 border-t border-gray-700/60 flex justify-end">
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
                                        className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white font-bold py-2 px-6 rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/20 transition-all"
                                    >
                                        {isSaving ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <CheckCircleIcon className="h-5 w-5" />}
                                        Save Profile
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="bg-gray-700 text-white hover:bg-gray-600 font-semibold py-2 px-6 rounded-xl flex items-center gap-2 border border-gray-600 transition-all"
                                >
                                    <PencilSquareIcon className="h-5 w-5" />
                                    Edit Profile
                                </button>
                            )}
                        </div>

                        {/* Nostr Info */}
                        {pubkey && privKey && (
                            <div className="mt-8">
                                <NostrInfo pubkey={pubkey} privKey={privKey} />
                            </div>
                        )}
                    </div>
                )}

                {/* ── NFTs Tab ── */}
                {activeTab === 'nfts' && (
                    <ProjectGrid
                        projects={ownedNfts}
                        isLoading={isLoadingNfts}
                        onCardClick={() => { }}
                        emptyMessage={flowUser?.addr ? `You haven't minted any NFTs with Flow wallet ${flowUser.addr}.` : 'Connect your Flow wallet to view your minted NFTs.'}
                    />
                )}

                {/* ── Data Requests Tab ── */}
                {activeTab === 'requests' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700/60 shadow-card">
                        <DataShareRequests />
                    </div>
                )}

                {/* ── Secure Logs Tab ── */}
                {activeTab === 'secure-logs' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700/60 shadow-card">
                        <SecureDataLogs />
                    </div>
                )}

                {/* ── Data Shared Tab ── */}
                {activeTab === 'data-shared' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700/60 shadow-card">
                        <DataSharedRequests />
                    </div>
                )}
            </div>
        </>
    );
};

export default ProfilePage;