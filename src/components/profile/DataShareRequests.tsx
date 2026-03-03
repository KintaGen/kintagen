// components/profile/DataShareRequests.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  useNostr,
  NOSTR_APP_TAG,
  NOSTR_SHARE_DATA_OP_TAG,
  NOSTR_SHARING_DATA_OP_TAG,
} from '../../contexts/NostrContext';
import {
  ShieldCheckIcon,
  ExclamationCircleIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/24/outline';
import {
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';
import { useSecureLog } from '../../hooks/useSecureLog';

interface IncomingRequest {
  id: string;
  senderPubkey: string;
  message: string;
  dataCid: string | null;
  timestamp: number;
  decryptionError?: string;
}

const avatarFallback = (k: string) =>
  `https://api.dicebear.com/7.x/identicon/svg?seed=${k}&backgroundColor=1f2937`;

const shortKey = (k: string) => `${k.slice(0, 8)}…${k.slice(-8)}`;

const tsLabel = (ts: number) =>
  new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const Skeleton = () => (
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

const DataShareRequests: React.FC = () => {
  const {
    pubkey: currentUserPubkey,
    decryptDM,
    subscribeToDMs,
    getProfileForMessage,
    encryptedMessages,
    pool,
    RELAYS,
  } = useNostr();
  const { shareSecureData } = useSecureLog(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // @ts-ignore
    subscribeToDMs(NOSTR_SHARE_DATA_OP_TAG);
  }, [subscribeToDMs]);

  useEffect(() => {
    if (!currentUserPubkey) {
      setLoading(false);
      setError('Please log in to Nostr to view data share requests.');
      return;
    }

    const process = async () => {
      const newRequests: IncomingRequest[] = [];
      const processedIds = new Set(requests.map((r) => r.id));

      // Build a set of already-shared CIDs from pool
      const newSharedKeys = new Set<string>();

      for (const event of encryptedMessages) {
        const hasAppTag = event.tags.some((t) => t[0] === 'A' && t[1] === NOSTR_APP_TAG);
        if (!hasAppTag) continue;

        const dataCidTag = event.tags.find((t) => t[0] === 'C');
        const dataCid = dataCidTag?.[1] ?? null;

        // Check if we already sent a share back for this CID
        if (dataCid) {
          const shareEvent = await pool.get(RELAYS, {
            kinds: [4],
            authors: [currentUserPubkey],
            '#I': [dataCid],
            '#O': [NOSTR_SHARING_DATA_OP_TAG],
          });
          if (shareEvent) {
            const recipientTag = shareEvent.tags.find((t) => t[0] === 'p');
            if (recipientTag) newSharedKeys.add(`${dataCid}|${recipientTag[1]}`);
          }
        }

        const isIncoming =
          event.pubkey !== currentUserPubkey &&
          event.tags.some((t) => t[0] === 'O' && t[1] === NOSTR_SHARE_DATA_OP_TAG);

        if (isIncoming && !processedIds.has(event.id)) {
          let message = event.content;
          let decryptionError: string | undefined;
          try {
            const dec = await decryptDM(event);
            if (dec) message = dec;
          } catch (e: any) {
            decryptionError = e.message || 'Decryption failed';
          }

          newRequests.push({
            id: event.id,
            senderPubkey: event.pubkey,
            message,
            dataCid,
            timestamp: event.created_at,
            decryptionError,
          });
        }
      }

      if (newRequests.length > 0) {
        setRequests((prev) => {
          const combined = [...prev, ...newRequests];
          const unique = Array.from(new Map(combined.map((r) => [r.id, r])).values());
          return unique.sort((a, b) => b.timestamp - a.timestamp);
        });
      }

      if (newSharedKeys.size > 0) {
        setSharedIds((prev) => new Set([...prev, ...newSharedKeys]));
      }

      setLoading(false);
    };

    const timer = setTimeout(() => {
      if (loading && encryptedMessages.length === 0) setLoading(false);
    }, 3000);

    if (encryptedMessages.length > 0 || !loading) process();
    return () => clearTimeout(timer);
  }, [encryptedMessages, currentUserPubkey, decryptDM]);

  const handleAccept = useCallback(
    async (req: IncomingRequest) => {
      if (!req.dataCid) return;
      setSharingId(req.id);
      try {
        await shareSecureData(req.dataCid, req.senderPubkey, `kintagen-shared-${req.id.slice(0, 6)}.enc`);
        setSharedIds((prev) => new Set(prev).add(`${req.dataCid}|${req.senderPubkey}`));
      } catch (err: any) {
        console.error('Share failed:', err);
      } finally {
        setSharingId(null);
      }
    },
    [shareSecureData]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <InboxArrowDownIcon className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Incoming Access Requests</h2>
          <p className="text-xs text-gray-500">Researchers requesting access to your encrypted data</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 text-red-300 border border-red-700/40 p-3 rounded-lg text-sm">
          <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton />
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <InboxArrowDownIcon className="h-12 w-12 text-gray-700 mb-4" />
          <p className="text-gray-400 font-semibold text-sm">No access requests yet</p>
          <p className="text-gray-600 text-xs mt-1">
            When another researcher requests access to your data, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const profile = getProfileForMessage(req.senderPubkey);
            const alreadyShared = req.dataCid
              ? sharedIds.has(`${req.dataCid}|${req.senderPubkey}`)
              : false;
            const isSharing = sharingId === req.id;

            return (
              <div
                key={req.id}
                className={`border rounded-xl p-4 transition-all duration-200 ${alreadyShared
                  ? 'bg-emerald-900/10 border-emerald-700/30'
                  : 'bg-gray-900/60 border-gray-700/60 hover:border-green-500/30'
                  }`}
              >
                {/* Sender */}
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={profile?.picture || avatarFallback(req.senderPubkey)}
                    alt={profile?.name || 'User'}
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-green-500/25"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = avatarFallback(req.senderPubkey);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {profile?.name || 'Unknown Researcher'}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{shortKey(req.senderPubkey)}</p>
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">{tsLabel(req.timestamp)}</span>
                </div>

                {/* Message */}
                <div className="bg-gray-800/60 rounded-lg px-3 py-2.5 mb-3">
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{req.message}</p>
                </div>

                {/* CID */}
                {req.dataCid && (
                  <div className="bg-gray-800/80 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                    <ShieldCheckIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-medium mb-0.5">Requested Data CID</p>
                      <p className="text-xs font-mono text-cyan-400 break-all">{req.dataCid}</p>
                    </div>
                  </div>
                )}

                {req.decryptionError && (
                  <p className="text-xs text-red-400 italic mb-2">⚠ {req.decryptionError}</p>
                )}

                {/* Action */}
                <div className="flex justify-end pt-2 border-t border-gray-700/40">
                  {alreadyShared ? (
                    <span className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-700/20 text-emerald-400 border border-emerald-600/30">
                      <CheckCircleIcon className="h-4 w-4" /> Access Granted
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAccept(req)}
                      disabled={!req.dataCid || isSharing}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${isSharing
                        ? 'bg-green-700/50 text-white cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white shadow-sm shadow-green-900/40'
                        }`}
                    >
                      {isSharing ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin" /> Granting Access…
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4" /> Grant Access
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DataShareRequests;