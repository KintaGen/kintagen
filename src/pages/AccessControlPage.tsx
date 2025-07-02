import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyIcon, LockClosedIcon, UserPlusIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon,
  UserCircleIcon, ExclamationTriangleIcon, UsersIcon, LinkIcon, XMarkIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/solid';
import {
  useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt
} from 'wagmi';
import { readContract } from 'wagmi/actions';
import { accessKeyAbi } from '../lit/accessKeyAbi';
import { config } from '../main';
import { KeyHoldersList } from '../components/KeyHoldersList';
import { useLitFlow } from '../lit/useLitFlow';

/* ------------------------------------------------------------------ */
/*  TYPE DEFINITIONS                                                  */
/* ------------------------------------------------------------------ */
interface EncryptedFileRecord {
  cid: string;
  title: string;
  is_encrypted: boolean;
  lit_token_id: string;
  uploaded_at: string;
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                         */
/* ------------------------------------------------------------------ */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ACCESS_CONTRACT = '0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2';
const FILECOIN_GATEWAY = 'https://0xcdb8cc9323852ab3bed33f6c54a7e0c15d555353.calibration.filcdn.io';

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                    */
/* ------------------------------------------------------------------ */
const AccessControlPage: React.FC = () => {
  /* ---------------- state ---------------- */
  const [ownedFiles, setOwnedFiles] = useState<EncryptedFileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* grant-modal */
  const [grantingFile, setGrantingFile] = useState<EncryptedFileRecord | null>(null);
  const [grantToAddress, setGrantToAddress] = useState('');

  /* decrypt loader */
  const [decryptingCid, setDecryptingCid] = useState<string | null>(null);

  /* ---------------- hooks ---------------- */
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  /* Lit helpers */
  const { checkAndDecryptFile, base64ToUint8Array, loading: isLitLoading } = useLitFlow();

  /* ------------------------------------------------------------------ */
  /*  FETCH & FILTER FILES                                              */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const fetchAndFilterFiles = async () => {
      if (!address) { setOwnedFiles([]); setIsLoading(false); return; }
      setIsLoading(true); setError(null);
      try {
        const [papersRes, experimentsRes] = await Promise.all([
          fetch(`${API_BASE}/data/paper?is_encrypted=true`),
          fetch(`${API_BASE}/data/experiment?is_encrypted=true`)
        ]);
        if (!papersRes.ok || !experimentsRes.ok) throw new Error('Failed to fetch data from server');
        const encrypted = [
          ...(await papersRes.json()).data ?? [],
          ...(await experimentsRes.json()).data ?? []
        ].filter((f: EncryptedFileRecord) => f.is_encrypted && f.lit_token_id);

        if (encrypted.length === 0) { setOwnedFiles([]); setIsLoading(false); return; }

        const tokenIds = encrypted.map(f => BigInt(f.lit_token_id));
        const ownerAddresses = encrypted.map(() => address as `0x${string}`);
        const balances = await readContract(config, {
          address: ACCESS_CONTRACT,
          abi: accessKeyAbi,
          functionName: 'balanceOfBatch',
          args: [ownerAddresses, tokenIds]
        }) as bigint[];

        setOwnedFiles(encrypted.filter((_f, i) => balances[i] > 0n));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndFilterFiles();
  }, [address]);

  /* close grant-modal after success */
  useEffect(() => {
    if (isConfirmed) { setGrantingFile(null); setGrantToAddress(''); }
  }, [isConfirmed]);

  /* ------------------------------------------------------------------ */
  /*  EVENT HANDLERS                                                    */
  /* ------------------------------------------------------------------ */
  const handleGrant = () => {
    if (!grantingFile || !grantToAddress.trim()) return;
    writeContract({
      address: ACCESS_CONTRACT,
      abi: accessKeyAbi,
      functionName: 'grantAccess',
      args: [grantToAddress as `0x${string}`, BigInt(grantingFile.lit_token_id)]
    });
  };

  /*  Put this near your other “constants” */
  const FLOW_NFT_CONTRACT = '0x5bc5A6E3dD358b67A752C9Dd58df49E863eA95F2';  

  /* ✨  DECRYPT & DOWNLOAD  ✨ */
  const handleDecryptAndDownload = async (file: EncryptedFileRecord) => {
    setError(null);
  
    try {
      /* 1️⃣  Grab the Lit-packaged JSON from Filecoin */
      const res = await fetch(`${FILECOIN_GATEWAY}/${file.cid}`);
      if (!res.ok) throw new Error(`Failed to fetch ${file.cid}`);
      const encryptedJsonString = await res.text();
      const encryptedBase64     = btoa(encryptedJsonString);   // hook wants b64
  
      /* 2️⃣  Lit: NFT check + decryption */
      const raw = await checkAndDecryptFile(
        encryptedBase64,
        FLOW_NFT_CONTRACT,          // your Flow collection
        file.lit_token_id
      );
      if (!raw) throw new Error('Decryption returned nothing');
  
      /* 3️⃣  ↓↓↓  make sure we pass a real Blob to createObjectURL ↓↓↓ */
      const blob: Blob =
        raw instanceof Blob
          ? raw
          : raw instanceof ArrayBuffer
            ? new Blob([raw])
            : raw instanceof Uint8Array
              ? new Blob([raw.buffer])
              : (() => { throw new Error('Unknown decrypted type'); })();
  
      /* 4️⃣  kick off download */
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = file.title.replace(/\.enc\.json$/i, '');
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Decryption failed:', e);
      setError(`Decryption failed: ${e.message}`);
    }
  };
  

  /* close modal on Esc / backdrop */
  const closeModal = useCallback(() => setGrantingFile(null), []);
  useEffect(() => {
    if (!grantingFile) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grantingFile, closeModal]);

  /* ------------------------------------------------------------------ */
  /*  RENDER HELPERS                                                    */
  /* ------------------------------------------------------------------ */
  const renderContent = () => {
    if (!isConnected) {
      return (
        <div className="p-6 text-center text-yellow-400 bg-yellow-900/50 border border-yellow-700 rounded-lg flex items-center justify-center gap-3">
          <ExclamationTriangleIcon className="h-6 w-6" />Please connect your wallet to manage your gated files.
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="p-6 text-center text-gray-400 flex items-center justify-center">
          <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />Loading your gated files…
        </div>
      );
    }
    if (error) return <p className="p-6 text-red-400">Error: {error}</p>;
    if (!ownedFiles.length) {
      return <li className="p-6 text-center text-gray-500">You do not hold any access keys for encrypted files.</li>;
    }

    return ownedFiles.map(f => {
      const busy = decryptingCid === f.cid || isLitLoading;
      return (
        <li key={f.cid} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-4">
          {/* header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-grow overflow-hidden">
              <p className="text-lg font-semibold text-white truncate flex items-center" title={f.title}>
                <LockClosedIcon className="h-5 w-5 mr-2 text-amber-400 flex-shrink-0" />{f.title}
              </p>
              <a href={`${FILECOIN_GATEWAY}/${f.cid}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline mt-2 flex items-center gap-1 w-fit">
                <LinkIcon className="h-3 w-3" /><span className="font-mono truncate">{f.cid}</span>
              </a>
            </div>

            {/* buttons */}
            <div className="flex-shrink-0 w-full sm:w-auto flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => handleDecryptAndDownload(f)}
                disabled={busy}
                className="w-full sm:w-auto flex items-center justify-center bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-wait"
              >
                {busy
                  ? <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  : <ArrowDownTrayIcon className="h-5 w-5 mr-2" />}
                {busy ? 'Decrypting…' : 'Decrypt & Download'}
              </button>
              <button
                onClick={() => setGrantingFile(f)}
                className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-500"
              >
                <UserPlusIcon className="h-5 w-5 mr-2" />Grant Access
              </button>
            </div>
          </div>

          {/* key-holders */}
          <div className="pt-4 border-t border-gray-700/50">
            <h3 className="text-md font-medium text-gray-300 mb-2 flex items-center">
              <UsersIcon className="h-5 w-5 mr-2" /> Users with Access
            </h3>
            <div className="bg-gray-900/50 p-3 rounded-lg max-h-48 overflow-y-auto">
              <KeyHoldersList contractAddress={ACCESS_CONTRACT} tokenId={f.lit_token_id} />
            </div>
          </div>
        </li>
      );
    });
  };

  /* ------------------------------------------------------------------ */
  /*  JSX                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Access Control Management</h1>
          {isConnected ? (
            <div className="text-right">
              <p className="text-sm text-green-400">Connected: {`${address?.slice(0, 6)}…${address?.slice(-4)}`}</p>
              <button onClick={disconnect} className="text-xs text-gray-400 hover:text-white">Disconnect</button>
            </div>
          ) : (
            <button onClick={() => connect({ connector: connectors[0] })}
              className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500">
              Connect Wallet
            </button>
          )}
        </div>

        <p className="text-gray-400 mb-8">
          View, decrypt, and share the files you control.
        </p>

        <div className="bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-xl font-semibold">Your Gated Files</h2>
          </div>
          <ul className="space-y-3 p-3">{renderContent()}</ul>
        </div>
      </div>

      {/* ───────────────── GRANT ACCESS MODAL ───────────────── */}
      {grantingFile && (
        <div onClick={closeModal} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog" aria-modal="true">
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-6 relative">
            <button onClick={closeModal} aria-label="Close"
              className="absolute top-3 right-3 text-gray-400 hover:text-white">
              <XMarkIcon className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold mb-2">Grant Access Key</h2>
            <p className="text-sm text-gray-400 mb-4">
              You are issuing a key for&nbsp;
              <span className="font-semibold text-white">“{grantingFile.title}”</span>
              &nbsp;(Token&nbsp;ID: {grantingFile.lit_token_id}).
            </p>

            <label htmlFor="grantAddress"
              className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
              <UserCircleIcon className="h-5 w-5 mr-2" /> Recipient Address
            </label>
            <input id="grantAddress" type="text" placeholder="0x…"
              value={grantToAddress}
              onChange={e => setGrantToAddress(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white
                              focus:outline-none focus:ring-2 focus:ring-blue-500"/>

            <div className="flex gap-3 mt-6">
              <button onClick={handleGrant}
                disabled={!grantToAddress || isPending || isConfirming}
                className="flex-1 flex items-center justify-center bg-green-600 text-white font-bold py-2 px-4 rounded-lg
                                 hover:bg-green-500 disabled:bg-gray-600">
                {(isPending || isConfirming)
                  ? <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  : <KeyIcon className="h-5 w-5 mr-2" />}
                {isPending ? 'Sending…' : isConfirming ? 'Confirming…' : 'Confirm & Grant'}
              </button>
              <button onClick={closeModal}
                className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 px-4 rounded-lg">Cancel</button>
            </div>

            <div className="mt-4 min-h-[40px]">
              {isConfirming && (
                <p className="text-sm text-center text-blue-300">
                  Waiting for transaction confirmation…
                </p>
              )}
              {isConfirmed && (
                <div className="text-green-400 flex items-center justify-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />Access granted successfully!
                </div>
              )}
              {contractError && (
                <div className="text-red-300 flex items-start space-x-2 text-sm">
                  <XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>Error: {contractError.shortMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccessControlPage;
