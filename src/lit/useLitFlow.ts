import { useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useLitContext } from "./litProvider";
// We use the high-level encryptToJson and the standard decryptToFile
import { encryptToJson, decryptToFile } from "@lit-protocol/encryption";
import { LitActionResource, createSiweMessage } from "@lit-protocol/auth-helpers";
import litActionCode from "./litAction";
import type { AuthSig, DecryptRequest } from "@lit-protocol/types";

const FORMAL_ACC_CHAIN = "polygon";
const FLOW_RPC_URL = "https://testnet.evm.nodes.onflow.org";

export const useLitFlow = () => {
  const { litNodeClient } = useLitContext();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [loading, setLoading] = useState(false);
  function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  // This function now encrypts everything into a single, portable JSON string.
  const encryptFileAndPackage = useCallback(async (file: File) => {
    if (!litNodeClient) throw new Error("Lit Node Client not connected.");
    setLoading(true);
    try {
      const accessControlConditions = [{ contractAddress: "", standardContractType: "", chain: FORMAL_ACC_CHAIN, method: "eth_getBalance", parameters: [":userAddress", "latest"], returnValueTest: { comparator: ">=", value: "0" },},];
      
      const jsonString = await encryptToJson({
        accessControlConditions,
        chain: "polygon",
        file,
        litNodeClient,
      });
      
      return jsonString;
    } catch (e: any) {
      console.error("Encryption hook error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [litNodeClient]);

  const checkAndDecryptFile = useCallback(async (
    encryptedJsonString: string, // Expect the full JSON package
    flowNftAddress: string,
    tokenId: string
  ) => {
    if (!litNodeClient || !address) throw new Error("Lit Client or wallet not connected.");
    setLoading(true);
    try {
      // Step 1: Execute Lit Action to check for Flow NFT
      const sessionSigs = await litNodeClient.getSessionSigs({
        chain: FORMAL_ACC_CHAIN,
        resourceAbilityRequests: [{ resource: new LitActionResource("*"), ability: "lit-action-execution" }],
        authNeededCallback: async (params): Promise<AuthSig> => {
          const { uri, expiration, resourceAbilityRequests } = params;
          const toSign = await createSiweMessage({ uri, expiration, resources: resourceAbilityRequests, walletAddress: address, nonce: await litNodeClient.getLatestBlockhash(), litNodeClient });
          const signature = await signMessageAsync({ message: toSign });
          return { sig: signature, derivedVia: "web3.eth.personal.sign", signedMessage: toSign, address };
        },
      });

      const checkResult = await litNodeClient.executeJs({
        code: litActionCode,
        sessionSigs,
        jsParams: { userAddress: address, nftAddress: flowNftAddress, tokenId, rpcUrl: FLOW_RPC_URL },
      });

      const { hasAccess, error: checkError } = JSON.parse(checkResult.response as string);
      if (checkError || !hasAccess) {
        throw new Error(checkError || "Access Denied: You do not hold the required Flow NFT.");
      }

      // Step 2: If check passes, parse the JSON and decrypt on the client-side
      const paramsToDecrypt: DecryptRequest = JSON.parse(encryptedJsonString);

      const decryptedFile = await decryptToFile({
        ...paramsToDecrypt, // Spread all properties from the JSON
        sessionSigs,        // Add the session signatures
      }, litNodeClient);

      return decryptedFile;

    } catch (e: any) {
      console.error("Decryption hook error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [litNodeClient, address, signMessageAsync]);

  return { encryptFileAndPackage, checkAndDecryptFile,base64ToUint8Array, loading };
};