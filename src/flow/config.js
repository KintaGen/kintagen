// Path: kintagen-viewer/src/flow/config.js

import { config } from "@onflow/fcl";

config({
  // Point FCL to the local emulator's access node
  "accessNode.api": "http://127.0.0.1:8888",
  
  // Point FCL to the local dev wallet for authentication services
  "discovery.wallet": "http://localhost:8701/fcl/authn",
  
  // --- Your Contract Alias ---
  // This tells FCL that whenever it sees `import KintaGenNFT from 0xKintaGenNFT`
  // in a Cadence script, it should replace `0xKintaGenNFT` with the contract's
  // actual address on the emulator.
  "0xKintaGenNFT": "0xf8d6e0586b0a20c7",
  
  // Add aliases for standard contracts for good practice
  "0xNonFungibleToken": "0xf8d6e0586b0a20c7",
  "0xViewResolver": "0xf8d6e0586b0a20c7"
});