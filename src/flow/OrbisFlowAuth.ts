import { IOrbisAuth } from '@useorbis/db-sdk'; // Import the interface for type safety

/**
 * A custom authenticator for OrbisDB that uses a connected Flow wallet to sign messages.
 * This class implements the IOrbisAuth interface required by the OrbisDB `connectUser` method.
 */
export class OrbisFlowAuth implements IOrbisAuth {
  // The user object from the @onflow/react-sdk `useFlowCurrentUser` hook
  private flowUser: any;

  constructor(flowUser: any) {
    if (!flowUser || !flowUser.loggedIn) {
      throw new Error("A logged-in Flow user object is required.");
    }
    this.flowUser = flowUser;
  }

  /**
   * Returns the user's Decentralized Identifier (DID) in the 'did:pkh' format.
   * Orbis uses this as the user's unique, cross-chain identifier.
   */
  async getDid(): Promise<string> {
    const chain = `flow:${this.flowUser.network}`;
    return `did:pkh:${chain}:${this.flowUser.addr}`;
  }

  /**
   * Signs a message with the user's Flow wallet to authenticate and create a session.
   * The Orbis SDK calls this method internally during the `connectUser` process.
   */
  async signMessage(message: string): Promise<{ signature: string; address: string; }> {
    try {
      const hexMessage = Buffer.from(message).toString("hex");
      const signatures = await this.flowUser.signUserMessage(hexMessage);
      const userSignature = signatures.find((s: any) => s.addr === this.flowUser.addr);

      if (!userSignature) {
        throw new Error("Signature from the current user could not be found.");
      }
      
      return {
        signature: userSignature.signature,
        address: userSignature.addr,
      };
    } catch (error) {
      console.error("FCL signing failed:", error);
      throw error;
    }
  }
}