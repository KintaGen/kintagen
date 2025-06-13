# Project Kintagen: Your AI Research Co-pilot

**Project Kintagen** is a decentralized, AI-powered research assistant designed for scientific labs. It provides a secure, collaborative platform to ingest, analyze, and query private research data, turning your lab's collective knowledge into an interactive and intelligent resource.

Built on a foundation of decentralized technologies like Filecoin and Lit, Kintagen ensures that your sensitive research data remains private, verifiable, and owned by you.


*(**Action Required:** Replace this with a real screenshot of dashboard!)*

## The Problem

Scientific research labs generate a massive amount of valuable data:
*   Published papers and literature reviews.
*   Raw experimental data from equipment (GC-MS, NMR, etc.).
*   Internal notes, theses, and reports.

This knowledge is often siloed, difficult to search, and hard to share securely. New researchers spend months getting up to speed, and valuable insights can be lost in a sea of PDFs and disconnected files.

## The Solution

Project Kintagen acts as a centralized "brain" for your lab. It allows you to:

*   **🧠 Ingest Knowledge:** Securely upload research papers, experimental data, and notes. The system processes and understands the content, storing it on the decentralized Filecoin network.
*   **🤖 Chat with Your Data:** Use a familiar AI chat interface to ask complex questions about your ingested documents. Get instant, context-aware answers grounded in your lab's private data.
*   **🔬 Accelerate Research:** Quickly find chemical structures, experimental methods, or previously published findings without manually sifting through hundreds of documents.
*   **🤝 Collaborate Securely:** (Future) Use Flow Protocol to create rules for sharing specific knowledge between partner labs, fostering collaboration without giving up data ownership.

## Core Features

*   **AI-Powered Chat Interface:** Ask natural language questions and get precise answers from an AI that uses your private data as its knowledge base.
*   **Decentralized Data Ingestion:** Upload documents and data files. They are processed and stored on the Filecoin network, ensuring data persistence and verifiability.
*   **Secure API Architecture:** A robust Node.js backend acts as a secure proxy, protecting your AI service API keys and managing business logic.
*   **Modern, Responsive UI:** A clean and intuitive dashboard built with React, TypeScript, and Tailwind CSS.
*   **Project-Based Organization:** (Future) Group your data and chats into "Projects" to mirror real-world research workflows.

## Tech Stack & Architecture

Project Kintagen is built on a modern, decentralized technology stack:

*   **Frontend:**
    *   [React](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/): For a robust and scalable user interface.
    *   [Tailwind CSS](https://tailwindcss.com/): For rapid, utility-first styling.

*   **Backend:**
    *   [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/): A lightweight and powerful API server.
    *   [OpenAI SDK](https://github.com/openai/openai-node): To communicate with AI models like DeepSeek or OpenAI.

*   **Decentralized Infrastructure (The Vision):**
    *   **Filecoin:** For persistent, content-addressed storage of research data.
    *   **Flow Protocol:** For decentralized access control and secure knowledge sharing between agents/labs.
    *   **Bio.xyz:** For verifiable identity of human contributors.
    *   **Mosaia:** For cross-referencing and validating information across the network.


*(**Action Required:** Create a simple diagram showing React -> Node Backend -> AI Service -> Filecoin)*

---

## Getting Started

Follow these instructions to get a local copy of Project Cortex up and running for development.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or later recommended)
*   [pnpm](https://pnpm.io/installation) (recommended package manager) or npm/yarn
*   A Mosaia API Key

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/KintaGen/kintagen
    cd kintagen
    ```

2.  **Set up the Frontend Application:**
    *   Install frontend dependencies:
    ```bash
    pnpm install
    ```

### Running the Application

Project Kintagen requires two separate terminal processes to run concurrently: one for the backend and one for the frontend.

```bash
# Make sure you are in the project's root directory
pnpm start
```
    This will automatically open your browser to `http://localhost:3000`.
---


## License

Distributed under the MIT License. See `LICENSE` for more information.
