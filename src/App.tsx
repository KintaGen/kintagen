import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import ResearchChatPage from './pages/ResearchChatPage';
import MintingComponent from './pages/ProjectsPage';
import LD50AnalysisPage from './pages/LD50AnalysisPage';
import NetworkGuard from './components/NetworkGuard';
import { JobProvider, useJobs } from './contexts/JobContext';
import GlobalJobStatusToast from './components/GlobalJobStatusToast';
import { FlowProvider } from '@onflow/react-sdk';


const ToastManager = () => {
  const { jobs } = useJobs(); // Get the global jobs state
  return <GlobalJobStatusToast jobs={jobs} />;
};

const testnetConfig = {
  // --- Network Information ---
  "accessNodeUrl": "https://rest-testnet.onflow.org",
  "discoveryWallet": "https://fcl-discovery.onflow.org/testnet/authn",

  // --- App Information ---
  "appDetailTitle": "KintaGen Platform",
  "appDetailIcon": "https://avatars.githubusercontent.com/u/215318019?s=200&v=4",
  "flowNetwork": "testnet",
  "addresses": {
    "NonFungibleToken": "0x631e88ae7f1d7c20",    // Standard NFT contract address on Crescendo
    "MetadataViews": "0x631e88ae7f1d7c20",       // Standard Metadata contract address on Crescendo
    "ViewResolver": "0x631e88ae7f1d7c20",        // Standard ViewResolver contract address on Crescendo
    "FlowToken": "0x7e60df042a9c0868",
    "KintaGenNFT": "0x3c16354a3859c81b",          // Your contract's address
    "FungibleToken": "0x9a0766d93b6608b7",
  }
};
const testnetJson = {
  "0xNonFungibleToken": "0x631e88ae7f1d7c20",    // Standard NFT contract address on Crescendo
  "0xMetadataViews": "0x631e88ae7f1d7c20",       // Standard Metadata contract address on Crescendo
  "0xViewResolver": "0x631e88ae7f1d7c20",        // Standard ViewResolver contract address on Crescendo
  "0xFlowToken": "0x7e60df042a9c0868",
  "0xKintaGenNFTv1": "0x3c16354a3859c81b",          // Your contract's address
  "0xFungibleToken": "0x9a0766d93b6608b7",
} as const;
const emulatorConfig = {
  // --- Network Information ---
  "accessNodeUrl": "http://localhost:8888",
  "discoveryWallet": "http://localhost:8701/fcl/authn",
  "flowNetwork": "emulator",
  // --- App Information ---
  "appDetailTitle": "KintaGen Platform Demo",
  "appDetailIcon": "https://avatars.githubusercontent.com/u/215318019?s=200&v=4",
} as const;
const emulatorJSON = {
  "0xNonFungibleToken": "f8d6e0586b0a20c7",    // Standard NFT contract address on Crescendo
  "0xMetadataViews": "f8d6e0586b0a20c7",       // Standard Metadata contract address on Crescendo
  "0xViewResolver": "f8d6e0586b0a20c7",        // Standard ViewResolver contract address on Crescendo
  "0xFlowToken": "0ae53cb6e3f42a79",
  "0xKintaGenNFT": "f8d6e0586b0a20c7",          // Your contract's address
  "0xFungibleToken": "f8d6e0586b0a20c7"
}

// 1. Read the network name from our environment variable.
const flowNetwork = import.meta.env.VITE_FLOW_NETWORK;

// 2. Choose the correct configuration object based on the variable.
const configToUse = flowNetwork === 'emulator' ? emulatorConfig : testnetConfig;
const jsonToUse = flowNetwork === 'emulator' ? emulatorJSON : testnetJson;

const App: React.FC = () => {

  return (
      // @ts-ignore

      <FlowProvider
        // Pass all configuration through the `config` prop
        config={configToUse}
        flowJson={jsonToUse}

      >
      <HashRouter>
        <JobProvider>

        <div className="bg-gray-900 min-h-screen text-gray-200 flex">
          <Sidebar />
          <main className="flex-1 ml-64 p-8">

            <Routes>
              <Route path="/" element={<HomePage />} /> 
              <Route path="/projects" element={<MintingComponent />} />
              <Route path="/chat" element={<ResearchChatPage />} />

              <Route path="/analysis" element={<LD50AnalysisPage />} />

              {/* --- 2. Add the new route for /network --- */}
              {/*
              <Route path="/network" element={
                <NetworkGuard>
                  <AccessControlPage />
                </NetworkGuard>
              } />
              */}

            </Routes>
          </main>
        </div>
        <ToastManager />
        </JobProvider>
      </HashRouter>
    </FlowProvider>

  );
};

export default App;