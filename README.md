
📖 **Full README:** [View the documentation on GitHub](https://github.com/KintaGen)

🚀 **Live Demo:** [Try the KintaGen app](https://kintagen.vercel.app)


---

# KintaGen UI (Frontend)

> React 19 · TypeScript · Vite · TailwindCSS · Wagmi

This repository contains the **browser-based client** for the KintaGen platform. Follow the steps below to install dependencies, configure environment variables, and run the development and production builds.

---

## 1. Prerequisites

| Tool | Version | Install Guide |
| :--- | :--- | :--- |
| **Node.js** | ≥ 18 (LTS) | [nodejs.org](https://nodejs.org/en) |
| **pnpm** | ≥ 8 (recommended) | `npm i -g pnpm` |
| **Flow/EVM Wallet** | Blocto, MetaMask, etc. | Connect in-app when prompted |

*Note: The backend server must be running for the frontend to function correctly. See the backend setup guide.*

---

## 2. Key Technologies

This project is built with a modern, type-safe stack:

*   **UI Framework:** [React 19](https://react.dev/) with TypeScript.
*   **Build Tool:** [Vite](https://vitejs.dev/) for fast development and optimized builds.
*   **Routing:** [React Router](https://reactrouter.com/) for SPA navigation.
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
*   **Icons:** [Heroicons](https://heroicons.com/) for a consistent icon set.
*   **Blockchain Integration:** [Wagmi](https://wagmi.sh/) for connecting to EVM-compatible chains (like Flow EVM).
*   **Client-Side Encryption:** [Lit Protocol SDK](https://litprotocol.com/) for in-browser file encryption and decryption.
*   **Data Fetching & State:** [TanStack Query](https://tanstack.com/query/latest) for managing server state, caching, and background data fetching.
*   **Data Visualization:** [Recharts](https://recharts.org/) for rendering charts on the dashboard.

---

## 3. Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/KintaGen/kintagen.git
    cd kintagen
    ```

2.  **Install all dependencies:**
    ```bash
    pnpm install
    ```
    > This single command installs dependencies for both the frontend and backend workspaces.

---

## 4. Environment Variables

Copy the example environment file and edit the values as needed.

```bash
# Ensure you are in the root directory of the project
cp .env.example .env
```

The frontend uses the following variables from the `.env` file at the root:

| Variable | Purpose | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | The full URL of the backend REST API. | `http://localhost:3001/api` |
| `DISABLE_ESLINT_PLUGIN` | *(Optional)* Skips ESLint in Vite dev mode if your editor already runs it. | `true` |

> **Tip:** No need to restart `pnpm dev` when you change `.env`; Vite reloads automatically.

---

## 5. Running in Development

To run the frontend development server:

```bash
# From the repository root
pnpm dev
```

*   This will open a browser window at `http://localhost:5173` (or the next available port).
*   The Vite server proxies any request starting with `/flow-rpc` to the real Flow EVM Testnet RPC endpoint, avoiding CORS issues during development (see `vite.config.ts`).

---

## 6. Available Scripts

All scripts should be run from the repository root.

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts the Vite development server with Hot Module Replacement (HMR). |
| `pnpm build` | Creates a production-ready build in the `dist/` directory. |
| `pnpm preview` | Serves the `dist/` folder locally to verify the production build. |
| `pnpm lint` | Runs ESLint to check for code quality and style issues. |

---

## 7. Project Structure

The frontend source code is organized as follows:

```
src/
├── components/   # Reusable React components (Sidebar, StatCard, etc.)
├── config/       # Shared configuration (Wagmi chain definitions)
├── lit/          # Lit Protocol integration (hooks, providers, actions)
├── pages/        # Top-level route components (Dashboard, ProjectsPage, etc.)
├── App.tsx       # Main application component with routing setup
└── main.tsx      # Application entry point, providers setup
```

---

## 8. Production Deployment

1.  **Build the application:**
    ```bash
    pnpm build
    ```

2.  **Deploy the output:**
    *   Upload the contents of the `dist/` directory to any static hosting provider (Vercel, Netlify, AWS S3, etc.).
    *   Ensure your hosting service is configured to handle Single-Page Applications (SPAs) by rewriting all routes to `index.html`.

---

## 9. Troubleshooting

| Symptom | Common Fix |
| :--- | :--- |
| **API requests fail (404 or CORS error)** | Ensure the backend server is running and that `VITE_API_BASE_URL` in your `.env` file is correct and points to the backend's address. |
| **"Cannot read properties of undefined" on wallet connection** | Check that your browser wallet (e.g., MetaMask) is installed, enabled, and set to the correct network (Flow EVM Testnet). |
| **Lit Protocol decryption fails** | Verify you are connected with the wallet that holds the correct access key NFT. Check the browser console for specific Lit Protocol errors. |
| **On-chain actions hang or fail (e.g., `grantAccess`)** | Make sure your connected wallet has a small amount of testnet FLOW for gas fees. You can get some from the [Flow Testnet Faucet](https://testnet-faucet.onflow.org/). |
| **Page appears unstyled** | This can happen if Tailwind CSS fails to initialize. Run `pnpm install` again and restart the dev server. |
