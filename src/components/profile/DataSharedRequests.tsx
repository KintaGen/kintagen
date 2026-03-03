// components/profile/DataSharedRequests.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  useNostr,
  NOSTR_APP_TAG,
  NOSTR_SHARE_DATA_OP_TAG,
  NOSTR_SHARING_DATA_OP_TAG,
} from '../../contexts/NostrContext';
import {
  ArrowDownTrayIcon,
  EnvelopeOpenIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  DocumentArrowDownIcon,
  LockOpenIcon,
} from '@heroicons/react/24/solid';
import { useSecureLog, type SecureDataMeta } from '../../hooks/useSecureLog';
import { BeakerIcon, LinkIcon } from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ReceivedShare {
  id: string;
  senderPubkey: string;
  message: string;
  dataCid: string | null;
  timestamp: number;
  decryptionError?: string;
}

interface SentRequest {
  id: string;
  recipientPubkey: string;
  requestedCid: string;
  message: string;
  timestamp: number;
  // Resolved from incoming shares
  granted: boolean;
  sharedCid?: string;
  sharedSenderPubkey?: string;
}

type InnerTab = 'received' | 'sent';

// ─────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  ld50: { label: 'LD50', color: 'bg-red-500/15 text-red-400 border-red-500/25' },
  nmr: { label: 'NMR', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  gcms: { label: 'GC-MS', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
};

const DataContextBadge: React.FC<{ meta: SecureDataMeta }> = ({ meta }) => {
  const badge = meta.type ? TYPE_BADGE[meta.type.toLowerCase()] : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2 bg-indigo-500/8 border border-indigo-500/15 rounded-lg px-3 py-2">
      <BeakerIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
      {meta.project && (
        <span className="text-xs font-semibold text-indigo-300">{meta.project}</span>
      )}
      {meta.nft_id && (
        <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
          <LinkIcon className="h-3 w-3" /> NFT #{meta.nft_id}
        </span>
      )}
      {badge && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
          {badge.label}
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

const Skeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse">
    {[0, 1].map((i) => (
      <div key={i} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-gray-700" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-24 bg-gray-700 rounded" />
            <div className="h-2.5 w-40 bg-gray-700 rounded" />
          </div>
        </div>
        <div className="h-2.5 w-3/4 bg-gray-700 rounded mb-2" />
        <div className="h-2.5 w-1/2 bg-gray-700 rounded" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({
  icon, title, subtitle,
}) => (
  <div className="flex flex-col items-center justify-center py-14 text-center select-none">
    <div className="mb-4 text-gray-600">{icon}</div>
    <p className="text-gray-400 font-semibold text-sm">{title}</p>
    <p className="text-gray-600 text-xs mt-1">{subtitle}</p>
  </div>
);

const Pill: React.FC<{ granted: boolean }> = ({ granted }) =>
  granted ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
      <CheckCircleIcon className="h-3 w-3" /> Access Granted
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/25 animate-pulse">
      <ClockIcon className="h-3 w-3" /> Pending Access
    </span>
  );

const avatarFallback = (pubkey: string) =>
  `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}&backgroundColor=1f2937`;

const shortKey = (key: string) => `${key.slice(0, 8)}…${key.slice(-8)}`;

const tsLabel = (ts: number) =>
  new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

const DataSharedRequests: React.FC = () => {
  const {
    pubkey: currentUserPubkey,
    decryptDM,
    subscribeToDMs,
    getProfileForMessage,
    encryptedMessages,
  } = useNostr();

  const { decryptAndDownloadSharedData, getSecureDataByCid } = useSecureLog(true);

  const [innerTab, setInnerTab] = useState<InnerTab>('received');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [receivedShares, setReceivedShares] = useState<ReceivedShare[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);

  // CID maps keyed by ownerPubkey — loaded lazily per unique owner
  const [ownerCidMaps, setOwnerCidMaps] = useState<Map<string, Map<string, SecureDataMeta>>>(new Map());

  // download state per-item (keyed by id)
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  // ── Subscribe to both DM tags so we get all relevant events ────────────
  useEffect(() => {
    // @ts-ignore – subscribeToDMs signature accepts optional args in runtime
    subscribeToDMs(NOSTR_SHARING_DATA_OP_TAG);
  }, [subscribeToDMs]);

  useEffect(() => {
    // @ts-ignore
    subscribeToDMs(NOSTR_SHARE_DATA_OP_TAG);
  }, [subscribeToDMs]);

  // ── Process encryptedMessages ───────────────────────────────────────────
  useEffect(() => {
    if (!currentUserPubkey) {
      setLoading(false);
      setError('Please log in to Nostr to view data shares.');
      return;
    }

    const process = async () => {
      if (encryptedMessages.length === 0 && loading) return;
      setLoading(true);

      const newReceived: ReceivedShare[] = [];
      const newSent: SentRequest[] = [];

      // Build a lookup of incoming confirmation shares: (originalCid|senderPubkey) → event
      const incomingShareMap = new Map<
        string,
        { sharedCid: string; senderPubkey: string }
      >();

      for (const event of encryptedMessages) {
        if (event.pubkey === currentUserPubkey) continue; // outgoing from us

        const isSharingOp = event.tags.some(
          (t) => t[0] === 'O' && t[1] === NOSTR_SHARING_DATA_OP_TAG
        );
        const sharedCidTag = event.tags.find((t) => t[0] === 'C');
        const originalCidTag = event.tags.find((t) => t[0] === 'I');

        if (isSharingOp && sharedCidTag && originalCidTag) {
          const key = `${originalCidTag[1]}|${event.pubkey}`;
          incomingShareMap.set(key, {
            sharedCid: sharedCidTag[1],
            senderPubkey: event.pubkey,
          });
        }
      }

      const processedIds = new Set<string>();

      for (const event of encryptedMessages) {
        if (processedIds.has(event.id)) continue;
        processedIds.add(event.id);

        const hasAppTag = event.tags.some(
          (t) => t[0] === 'A' && t[1] === NOSTR_APP_TAG
        );
        if (!hasAppTag) continue;

        const dataCidTag = event.tags.find((t) => t[0] === 'C');
        const isSharingOp = event.tags.some(
          (t) => t[0] === 'O' && t[1] === NOSTR_SHARING_DATA_OP_TAG
        );
        const isRequestOp = event.tags.some(
          (t) => t[0] === 'O' && t[1] === NOSTR_SHARE_DATA_OP_TAG
        );

        // ── Section 1: Data shared *to* us by someone else ────────────
        if (event.pubkey !== currentUserPubkey && isSharingOp) {
          let message = event.content;
          let decryptionError: string | undefined;
          try {
            const dec = await decryptDM(event);
            if (dec) message = dec;
          } catch (e: any) {
            decryptionError = e.message || 'Decryption failed';
          }

          newReceived.push({
            id: event.id,
            senderPubkey: event.pubkey,
            message,
            dataCid: dataCidTag?.[1] ?? null,
            timestamp: event.created_at,
            decryptionError,
          });
        }

        // ── Section 2: Requests *we* sent to others ───────────────────
        if (event.pubkey === currentUserPubkey && isRequestOp) {
          const recipientTag = event.tags.find((t) => t[0] === 'p');
          const requestedCid = dataCidTag?.[1];
          const recipientPubkey = recipientTag?.[1];

          if (!requestedCid || !recipientPubkey) continue;

          let message = event.content;
          try {
            const dec = await decryptDM(event);
            if (dec) message = dec;
          } catch (_) { }

          // Check if the owner replied with a share
          const shareKey = `${requestedCid}|${recipientPubkey}`;
          const correspondingShare = incomingShareMap.get(shareKey);

          newSent.push({
            id: event.id,
            recipientPubkey,
            requestedCid,
            message,
            timestamp: event.created_at,
            granted: !!correspondingShare,
            sharedCid: correspondingShare?.sharedCid,
            sharedSenderPubkey: correspondingShare?.senderPubkey,
          });
        }
      }

      setReceivedShares((prev) => {
        const combined = [...prev, ...newReceived];
        const unique = Array.from(new Map(combined.map((i) => [i.id, i])).values());
        return unique.sort((a, b) => b.timestamp - a.timestamp);
      });

      setSentRequests((prev) => {
        const combined = [...prev, ...newSent];
        const unique = Array.from(new Map(combined.map((i) => [i.id, i])).values());
        return unique.sort((a, b) => b.timestamp - a.timestamp);
      });

      setLoading(false);
    };

    const timer = setTimeout(() => {
      if (loading && encryptedMessages.length === 0) setLoading(false);
    }, 3000);

    process();
    return () => clearTimeout(timer);
  }, [encryptedMessages, currentUserPubkey, decryptDM]);

  // ── Download handler ────────────────────────────────────────────────────
  const handleDownload = useCallback(
    async (id: string, sharedCid: string, senderPubkey: string) => {
      setDownloadingId(id);
      try {
        const datePart = new Date().toISOString().slice(0, 10);
        const filename = `kintagen_shared_data_${datePart}.zip`;
        await decryptAndDownloadSharedData(sharedCid, senderPubkey, filename);
        setDownloadedIds((prev) => new Set(prev).add(id));
      } catch (err: any) {
        alert(`Download failed: ${err.message || 'Unknown error'}`);
      } finally {
        setDownloadingId(null);
      }
    },
    [decryptAndDownloadSharedData]
  );

  // ── Tab bar ─────────────────────────────────────────────────────────────
  const tabs: { id: InnerTab; label: string; count: number }[] = [
    { id: 'received', label: 'Shared With Me', count: receivedShares.length },
    { id: 'sent', label: 'My Requests', count: sentRequests.length },
  ];

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <LockOpenIcon className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Data Sharing</h2>
          <p className="text-xs text-gray-500">Manage encrypted data received and requested via Nostr</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 text-red-300 border border-red-700/40 p-3 rounded-lg text-sm">
          <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Inner tab bar */}
      <div className="flex gap-1 bg-gray-900/70 p-1 rounded-xl border border-gray-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInnerTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200
              ${innerTab === tab.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
          >
            {tab.id === 'received' ? (
              <EnvelopeOpenIcon className="h-4 w-4" />
            ) : (
              <PaperAirplaneIcon className="h-4 w-4" />
            )}
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${innerTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-700 text-gray-300'
                  }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {loading ? (
          <Skeleton />
        ) : (
          <>
            {/* ── Shared With Me ── */}
            {innerTab === 'received' && (
              <div className="space-y-3">
                {receivedShares.length === 0 ? (
                  <EmptyState
                    icon={<EnvelopeOpenIcon className="h-12 w-12" />}
                    title="No data shared with you yet"
                    subtitle="When someone grants you access to their encrypted data, it will appear here."
                  />
                ) : (
                  receivedShares.map((share) => {
                    const profile = getProfileForMessage(share.senderPubkey);
                    const isDownloading = downloadingId === share.id;
                    const downloaded = downloadedIds.has(share.id);

                    return (
                      <div
                        key={share.id}
                        className="group bg-gray-900/60 border border-gray-700/60 hover:border-purple-500/30 rounded-xl p-4 transition-all duration-200"
                      >
                        {/* Sender */}
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={profile?.picture || avatarFallback(share.senderPubkey)}
                            alt={profile?.name || 'User'}
                            className="h-9 w-9 rounded-full object-cover ring-2 ring-purple-500/30"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = avatarFallback(share.senderPubkey);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">
                              {profile?.name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {shortKey(share.senderPubkey)}
                            </p>
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {tsLabel(share.timestamp)}
                          </span>
                        </div>

                        {/* Message */}
                        {share.message && (
                          <p className="text-xs text-gray-400 mb-3 leading-relaxed line-clamp-2">
                            {share.message}
                          </p>
                        )}

                        {/* CID */}
                        {share.dataCid && (
                          <div className="bg-gray-800/80 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                            <DocumentArrowDownIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 font-medium mb-0.5">Data CID</p>
                              <p className="text-xs font-mono text-cyan-400 break-all">{share.dataCid}</p>
                            </div>
                          </div>
                        )}

                        {share.decryptionError && (
                          <p className="text-xs text-red-400 italic mb-2">
                            ⚠ {share.decryptionError}
                          </p>
                        )}

                        {/* Download button */}
                        {share.dataCid && (
                          <div className="flex justify-end pt-2 border-t border-gray-700/40">
                            <button
                              onClick={() =>
                                handleDownload(
                                  share.id,
                                  share.dataCid!,
                                  share.senderPubkey
                                )
                              }
                              disabled={!share.dataCid || isDownloading || downloaded}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                                ${downloaded
                                  ? 'bg-emerald-700/30 text-emerald-400 border border-emerald-600/30 cursor-not-allowed'
                                  : isDownloading
                                    ? 'bg-indigo-700/50 text-white cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-900/40'
                                }`}
                            >
                              {isDownloading ? (
                                <>
                                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                  Downloading…
                                </>
                              ) : downloaded ? (
                                <>
                                  <CheckCircleIcon className="h-4 w-4" />
                                  Downloaded
                                </>
                              ) : (
                                <>
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                  Decrypt &amp; Download
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── My Requests ── */}
            {innerTab === 'sent' && (
              <div className="space-y-3">
                {sentRequests.length === 0 ? (
                  <EmptyState
                    icon={<PaperAirplaneIcon className="h-12 w-12" />}
                    title="No access requests sent yet"
                    subtitle="When you request access to someone's encrypted data, your requests will appear here."
                  />
                ) : (
                  sentRequests.map((req) => {
                    const profile = getProfileForMessage(req.recipientPubkey);
                    const isDownloading = downloadingId === req.id;
                    const downloaded = downloadedIds.has(req.id);

                    return (
                      <div
                        key={req.id}
                        className={`group border rounded-xl p-4 transition-all duration-200 ${req.granted
                          ? 'bg-emerald-900/10 border-emerald-700/30 hover:border-emerald-500/40'
                          : 'bg-gray-900/60 border-gray-700/60 hover:border-amber-500/20'
                          }`}
                      >
                        {/* Recipient + status pill */}
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={profile?.picture || avatarFallback(req.recipientPubkey)}
                            alt={profile?.name || 'User'}
                            className={`h-9 w-9 rounded-full object-cover ring-2 ${req.granted ? 'ring-emerald-500/40' : 'ring-amber-400/25'
                              }`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = avatarFallback(req.recipientPubkey);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">
                              {profile?.name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {shortKey(req.recipientPubkey)}
                            </p>
                          </div>
                          <Pill granted={req.granted} />
                        </div>

                        {/* Timestamp */}
                        <p className="text-xs text-gray-600 mb-3">Requested: {tsLabel(req.timestamp)}</p>

                        {/* Requested CID */}
                        <div className="bg-gray-800/80 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                          <ShieldCheckIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 font-medium mb-0.5">Requested Data CID</p>
                            <p className="text-xs font-mono text-cyan-400 break-all">{req.requestedCid}</p>
                          </div>
                        </div>

                        {/* If granted, also show the shared CID */}
                        {req.granted && req.sharedCid && (
                          <div className="bg-emerald-900/20 border border-emerald-700/20 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                            <DocumentArrowDownIcon className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs text-emerald-400 font-medium mb-0.5">Shared Data CID (re-encrypted for you)</p>
                              <p className="text-xs font-mono text-emerald-300 break-all">{req.sharedCid}</p>
                            </div>
                          </div>
                        )}

                        {/* Action */}
                        <div className="flex justify-end pt-2 border-t border-gray-700/40">
                          {req.granted && req.sharedCid && req.sharedSenderPubkey ? (
                            <button
                              onClick={() =>
                                handleDownload(req.id, req.sharedCid!, req.sharedSenderPubkey!)
                              }
                              disabled={isDownloading || downloaded}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                                ${downloaded
                                  ? 'bg-emerald-700/30 text-emerald-400 border border-emerald-600/30 cursor-not-allowed'
                                  : isDownloading
                                    ? 'bg-indigo-700/50 text-white cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-900/40'
                                }`}
                            >
                              {isDownloading ? (
                                <>
                                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                  Downloading…
                                </>
                              ) : downloaded ? (
                                <>
                                  <CheckCircleIcon className="h-4 w-4" />
                                  Downloaded
                                </>
                              ) : (
                                <>
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                  Decrypt &amp; Download
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium text-amber-400/70 bg-amber-400/5 border border-amber-400/10 cursor-default">
                              <ClockIcon className="h-4 w-4" />
                              Awaiting response…
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DataSharedRequests;
