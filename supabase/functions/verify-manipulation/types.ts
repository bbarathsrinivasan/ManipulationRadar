/**
 * Type definitions for the verify-manipulation Edge Function
 */

export type Platform = 'chatgpt' | 'claude' | 'other';
export type Sensitivity = 'low' | 'medium' | 'high';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type ReliabilityLevel = 'High' | 'Caution' | 'Low' | 'Unreliable';

export interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VerifyRequestOptions {
  sensitivity?: Sensitivity;
  return_spans?: boolean;
  max_suggestions?: number;
  store_event?: boolean;
}

export interface VerifyRequest {
  message_id: string;
  platform: Platform;
  user_prompt?: string;
  assistant_response: string;
  context?: ContextMessage[];
  options?: VerifyRequestOptions;
}

export interface ManipulationDetection {
  type: 'sycophancy' | 'flattery' | 'persuasion' | 'emotional' | 'authority';
  severity: number; // 0-10
  rationale: string;
  spans?: Array<[number, number]>; // Character offsets [start, end]
}

export interface ReliabilityAnalysis {
  score: number; // 0-100
  top_issues: string[];
}

export interface Suggestion {
  label: string;
  prompt_to_insert: string;
  reason: string;
}

export interface AzureOpenAIResponse {
  detections: ManipulationDetection[];
  reliability: ReliabilityAnalysis;
  suggestions: Suggestion[];
}

export interface ManipulationResult {
  risk_score: number; // 0-100
  risk_level: RiskLevel;
  detections: ManipulationDetection[];
  counts_by_type: Record<string, number>;
}

export interface ReliabilityResult {
  score: number; // 0-100
  level: ReliabilityLevel;
  top_issues: string[];
}

export interface VerifyResponse {
  message_id: string;
  manipulation: ManipulationResult;
  reliability: ReliabilityResult;
  suggestions: Suggestion[];
  meta: {
    provider: 'azure_openai';
    base_url: string;
    deployment: string;
    cached: boolean;
    latency_ms: number;
  };
}

export interface CacheEntry {
  cache_key: string;
  result: VerifyResponse;
  expires_at: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until next window
}
