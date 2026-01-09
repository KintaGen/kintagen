// Not being used now, need to undestand orbisDB better, it can be an option in future,
// keeping nostr usage for its simplicity

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OrbisDB } from "@useorbis/db-sdk";
import { OrbisKeyDidAuth } from "@useorbis/db-sdk/auth";
import { useFlowCurrentUser } from '@onflow/react-sdk';
import * as fcl from "@onflow/fcl";
fcl.config()
   .put("accessNode.api", "https://rest-testnet.onflow.org")
   .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn");

const ORBIS_SEED_KEY = "kintagen_orbis_seed";
const OrbisContext = createContext<any>(null);

export const OrbisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: flowUser } = useFlowCurrentUser();
  const [orbis, setOrbis] = useState<OrbisDB | null>(null);

  const [session, setSession] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const db = new OrbisDB({
      ceramic: { gateway: "https://ceramic-orbis.com" },
      nodes: [{ gateway: "https://orbisdb.k-la.io" }],
    });
    setOrbis(db);

    const connectWithStoredSeed = async () => {
        const storedSeed = window.localStorage.getItem(ORBIS_SEED_KEY);
        if (db && storedSeed) {
            try {
                const seed = new Uint8Array(JSON.parse(storedSeed));
                const auth = await OrbisKeyDidAuth.fromSeed(seed);
                const result = await db.connectUser({ auth });

                if (result.status === 200) {
                  setSession(result);
                } else {
                  window.localStorage.removeItem(ORBIS_SEED_KEY);
                }
            } catch (e) {
                console.error("Failed to connect with stored seed:", e);
                window.localStorage.removeItem(ORBIS_SEED_KEY);
            }
        }
    };
    
    connectWithStoredSeed();
  }, []);

  const connect = useCallback(async () => {
    if (!orbis || !flowUser?.loggedIn) {
      alert("Please connect your Flow wallet first.");
      return;
    }
    if (isConnecting) return;

    setIsConnecting(true);
    try {

      const messageToSign = "Sign this message to generate your private seed for KintaGen on OrbisDB. This is a one-time setup and will not cost any gas.";
      const hexMessage = Buffer.from(messageToSign).toString("hex");
      
      const signatures = await fcl.currentUser.signUserMessage(hexMessage);
      const userSignature = signatures.find((s: any) => s.addr === flowUser.addr);
      if (!userSignature) throw new Error("Signature from Flow wallet failed or was rejected.");

      const signatureBuffer = Buffer.from(userSignature.signature, 'hex');
      const seedDigest = await crypto.subtle.digest('SHA-256', signatureBuffer);
      const seed = new Uint8Array(seedDigest);

      const auth = await OrbisKeyDidAuth.fromSeed(seed);
      const result = await orbis.connectUser({ auth });
      console.log(result)
      if (result.error) throw result.error;
      
      window.localStorage.setItem(ORBIS_SEED_KEY, JSON.stringify(Array.from(seed)));
      setSession(result);

    } catch (error) {
      console.error("Orbis connection failed:", error);
      alert(`Connection failed: ${(error as Error).message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [orbis, flowUser, isConnecting]);

  const logout = () => {
    window.localStorage.removeItem(ORBIS_SEED_KEY);
    setSession(null);
  };

  return (
    <OrbisContext.Provider value={{ orbis, session, connect, logout, isConnecting }}>
      {children}
    </OrbisContext.Provider>
  );
};

export const useOrbis = () => {
  const context = useContext(OrbisContext);
  if (!context) {
    throw new Error('useOrbis must be used within an OrbisProvider');
  }
  return context;
};