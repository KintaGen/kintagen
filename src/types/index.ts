// ============================================================================
// Project Types
// ============================================================================

export interface NftProject {
    id: string;
    name: string;
    description: string;
    owner: string;
    thumbnailCid?: string;
}

/**
 * Base Project interface - used across the application
 * Note: Some APIs return id as number, others as string. Use ProjectWithStringId or ProjectWithNumberId for specific cases.
 */
export interface BaseProject {
    id: string | number;
    name: string;
    description?: string;
    nft_id?: string | number | null;
    created_at?: string;
    owner?: string;
    story?: any[];
}

/**
 * Project with string ID (used in most Flow/on-chain contexts)
 */
export interface ProjectWithStringId extends Omit<BaseProject, 'id' | 'nft_id'> {
    id: string;
    nft_id: string;
}

/**
 * Project with number ID (used in API responses)
 */
export interface ProjectWithNumberId extends Omit<BaseProject, 'id' | 'nft_id'> {
    id: number;
    nft_id: number | null;
}

// ============================================================================
// Job Types (re-exported from utils/jobs.ts for convenience)
// ============================================================================

export type { Job, JobState, JobStatusFromAPI } from '../utils/jobs';

// ============================================================================
// Chat Types
// ============================================================================

export interface ChatMessage {
    sender: 'user' | 'ai';
    text: string | null;
}

export interface ChatSession {
    id: string;
    projectId?: string | null;
    initialPrompt: string;
    createdAt: number;
    messages: ChatMessage[];
}

// ============================================================================
// Analysis Types
// ============================================================================

export type AnalysisType = 'ld50' | 'nmr' | 'gcms' | 'differential' | 'profiling' | 'unknown';

export type VerificationStatus = 'success' | 'failure';

export interface DisplayJob {
    id: string;
    label: string;
    projectId: string;
    state: 'completed' | 'failed' | 'processing' | 'logged' | 'waiting';
    failedReason?: string;
    returnvalue?: any;
    logData?: any;
    inputDataHash?: string;
}

export interface AnalysisMetadata {
    analysis_agent: string;
    input_data_hash_sha256: string;
    [key: string]: any;
}

// ============================================================================
// Data Ingestion Types
// ============================================================================

export interface GenericDataInfo {
    cid: string;
    title: string;
    is_encrypted: boolean;
    lit_token_id?: string;
    year?: string;
    authors?: string[];
    doi?: string;
    keywords?: string[];
    project_id: number | null;
    is_logged: boolean;
}

export interface SuccessInfo {
    cid: string;
    title: string;
    projectId: number | null;
    isEncrypted: boolean;
    litTokenId?: string;
}

export interface EncryptedFileRecord {
    cid: string;
    title: string;
    is_encrypted: boolean;
    lit_token_id: string;
    uploaded_at: string;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export type View = 'weekly' | 'monthly' | 'yearly';

export interface ApiProject {
    id: number;
    name: string;
    created_at: string;
}

export interface ApiGenericItem {
    cid: string;
    title: string;
    created_at: string;
}

export interface IndexedNftInfo {
    id: number;
    agent: string;
    run_hash: string;
    owner_address: string;
    created_at: string;
}

export interface PaperInfo {
    cid: string;
    title: string;
}