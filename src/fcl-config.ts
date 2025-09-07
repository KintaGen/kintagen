import { config } from '@onflow/fcl';

// Read the network environment variable from Vite
const flowNetwork = import.meta.env.VITE_FLOW_NETWORK;

// --- EMULATOR CONFIGURATION ---
// This object is used when VITE_FLOW_NETWORK is "emulator"
const emulatorConfig = {
  "accessNode.api": "http://localhost:8888",
  "discovery.wallet": "http://localhost:8701/fcl/authn",
  "discovery.wallet.method": "POP/RPC", // Use POPUP for local dev wallet
  "app.detail.title": "KintaGen (Emulator)",
  "app.detail.icon": "https://avatars.githubusercontent.com/u/215318019?s=200&v=4",
  
  // Aliases for your contracts, based on flow.json
  "KintaGenNFTv4": "0xf8d6e0586b0a20c7",
  "FungibleToken": "0xee82856bf20e2aa6",
  "NonFungibleToken": "0xf8d6e0586b0a20c7",
  "MetadataViews": "0xf8d6e0586b0a20c7",
  "ViewResolver": "0xf8d6e0586b0a20c7",
  "FlowToken": "0x0ae53cb6e3f42a79"
};

// --- TESTNET CONFIGURATION ---
// This object is used when VITE_FLOW_NETWORK is "testnet"
const testnetConfig = {
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn",
  "app.detail.title": "KintaGen Platform",
  "app.detail.icon": "https://avatars.githubusercontent.com/u/215318019?s=200&v=4",
  
  // Aliases for your contracts, based on flow.json
  "KintaGenNFTv4": "0x3c16354a3859c81b",
  "FungibleToken": "0x9a0766d93b6608b7",
  "NonFungibleToken": "0x631e88ae7f1d7c20",
  "MetadataViews": "0x631e88ae7f1d7c20",
  "ViewResolver": "0x631e88ae7f1d7c20",
  "FlowToken": "0x7e60df042a9c0868"
};

// Use the environment variable to select the correct configuration
const configToUse = flowNetwork === 'emulator' ? emulatorConfig : testnetConfig;

console.log(`%cFCL Initialized for: ${flowNetwork?.toUpperCase()}`, "color: #2bff88;");

// Apply the chosen configuration
config(configToUse);