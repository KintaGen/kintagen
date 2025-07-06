import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { LitNodeClient } from "@lit-protocol/lit-node-client";

interface LitContextType {
  litNodeClient: LitNodeClient | null;
  isLoading: boolean;
}

const LitContext = createContext<LitContextType>({
  litNodeClient: null,
  isLoading: true,
});

export const LitProvider = ({ children }: { children: ReactNode }) => {
  const [litNodeClient, setLitNodeClient] = useState<LitNodeClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const connectToLit = async () => {
      try {
        const client = new LitNodeClient({
          litNetwork: "datil-test",
          debug: false,
        });
        await client.connect();
        setLitNodeClient(client);
      } catch (error) {
        console.error("Failed to connect to Lit Network:", error);
      } finally {
        setIsLoading(false);
      }
    };

    connectToLit();
  }, []);

  return (
    <LitContext.Provider value={{ litNodeClient, isLoading }}>
      {children}
    </LitContext.Provider>
  );
};

export const useLitContext = () => {
  const context = useContext(LitContext);
  if (!context) {
    throw new Error("useLitContext must be used within a LitProvider");
  }
  return context;
};