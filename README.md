📖 **Full README:** [View the documentation on GitHub](https://github.com/KintaGen)

🚀 **Live Demo:** [https://kintagendemo.vercel.app/](https://kintagendemo.vercel.app/)

---

# KintaGen UI (Frontend and Serverless functions)

> The user interface for KintaGen, a decentralized scientific logbook on the Flow blockchain.

This repository contains the complete frontend application for the KintaGen platform. It provides the user-facing interface for all on-chain and off-chain interactions, acting as the primary gateway for scientists to create, manage, and verify their research history.

KintaGen runs R analyses (NMR, GC-MS) via Vercel/Redis/QStash, logging results to Flow NFTs & IPFS. **Integrated with Nostr, it adds decentralized profiles and encryption to securely link private data to public on-chain provenance.**

The application is built with a "tool-first, crypto-second" philosophy, offering a full suite of analysis features in a wallet-free "Demo Mode" to ensure a frictionless onboarding experience.

### Key Features Implemented in This UI:

*   **Decentralized Researcher Profiles (Nostr):** Uses the Nostr protocol to generate deterministic identities derived from the user's Flow wallet. Researchers can maintain a portable, censorship-resistant profile with academic links (ORCID, Lattes, LinkedIn) that exists independently of the KintaGen platform.
*   **Secure Data Vault (NIP-44 Encryption):** Allows scientists to encrypt sensitive raw data (CSV, PDF) client-side using their Nostr private keys. The encrypted data is pinned to IPFS and linked to the public blockchain log, ensuring that while the *provenance* is public, the *content* remains accessible only to the owner and authorized peers.
*   **Project Minting:** A user interface for creating new scientific projects by minting them as unique NFTs on the Flow blockchain.
*   **Analysis Execution:** Forms for uploading raw scientific data (Varian `.zip`, `.mzML`, `.csv`) and triggering complex, server-side R analyses for NMR, GC-MS, and LD50 workflows.
*   **On-Chain Logging:** A guided process for taking the results of a completed analysis, packaging them into a standardized IPFS artifact (including `metadata.json`), and permanently logging them to the corresponding project NFT.
*   **Field Observations:** A dedicated module for logging qualitative data, including notes, custom attributes, photos, and geospatial map data.
*   **Public Logbook Viewer:** A shareable, public page that fetches and displays the full, immutable on-chain history for any project NFT, making scientific progress transparent and accessible to anyone.
*   **Cryptographic Verification:** A tool that allows any user to verify the integrity of an original input data file by comparing its hash against the permanent record stored in the on-chain `metadata.json`.

---

## 1. Core Technologies

*   **Framework:** React & TypeScript
*   **Deployment:** Vercel (including Serverless Functions for the backend)
*   **Styling:** Tailwind CSS
*   **Blockchain:** Flow (via `@onflow/react-sdk`)
*   **Identity & Encryption:** Nostr Protocol (`nostr-tools`, NIP-01, NIP-19, NIP-44)
*   **File Storage:** IPFS (via Pinata)
*   **Mapping:** React Leaflet

---

## 2. Quick Start

### Prerequisites

*   **Node.js** (v18+ LTS)
*   **pnpm** (`npm i -g pnpm`)
*   **Vercel CLI** (`npm i -g vercel`)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/KintaGen/kintagen
    cd kintagen
    ```

2.  **Create .env file following .env.example pattern**

3.  **Install dependencies:**
    ```bash
    pnpm install
    ```

4.  **Run the development server:**
    The `vercel dev` command starts a local server that perfectly replicates the Vercel production environment, including serverless functions, environment variables, and rewrite rules.
    ```bash
    vercel dev
    ```
    The application will be available at `http://localhost:3000`.

---

## 3. Available Scripts

| Command | Description |
| :--- | :--- |
| `vercel dev` | Starts the complete local development environment. |
| `vercel deploy --prod`| Deploys to your main production URL. |

--- 

## 4. .env.example

```
# --- VITE: Frontend Variables ---
DISABLE_ESLINT_PLUGIN=true
# The Flow network to connect to ('testnet' or 'mainnet').
VITE_FLOW_NETWORK="testnet"

# The PUBLIC Flow account address of your deployed KintaGen NFT smart contract.
# Used by the frontend to interact with collections.
VITE_API_PUBLIC_KINTAGEN_ADDRESS="0x3c16354a3859c81b"


# --- BACKEND: Vercel Serverless Function Variables (Secrets) ---

# -- Pinata (IPFS Uploads via Lighthouse alternative) --
# Your Pinata JWT, used by the /api/pinata/upload function.
PINATA_JWT="ey..."
# Your dedicated Pinata Gateway URL (e.g., scarlet-rabbit.mypinata.cloud).
# Used by the frontend to display IPFS images and artifacts.
PINATA_GATEWAY="https://your-gateway-name.mypinata.cloud"

# -- QStash (Asynchronous Job Queue) --
# Used by the /api/jobs/create function to enqueue jobs.
QSTASH_TOKEN="ey..."
QSTASH_URL="https://qstash.upstash.io/v2/publish/"
QSTASH_CURRENT_SIGNING_KEY="mkey_..."
QSTASH_NEXT_SIGNING_KEY="mkey_..."

# -- Redis (Job State Management) --
# Your Redis connection string. For Vercel KV, this is provided as KV_URL.
# Used by /api/jobs/create, /api/jobs/status, and /api/jobs/update-status.
REDIS_URL="redis://..."

# -- Vercel Blob (Knowledge Graph or File Upload Tokens) --
# Token for /api/jobs/upload-token to generate upload URLs, and for the graphology blob.
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# -- Internal Worker Communication --
# The base URL of your separate R-script processing worker.
# Used by QStash in /api/jobs/create to know where to send the job.
NODE_WORKER_URL="https://your-r-script-worker-url.com"

# A shared secret to ensure that only QStash can trigger your R-script worker.
WORKER_SECRET="generate-a-strong-random-string-here"

```
