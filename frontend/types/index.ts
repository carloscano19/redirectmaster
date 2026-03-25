// RedirectMaster AI — Shared TypeScript Types

export type MatchStatus =
  | 'AUTO_APPROVED'
  | 'PENDING_REVIEW'
  | 'MANUALLY_APPROVED'
  | 'REJECTED'
  | 'NO_MATCH'

export type RuleType =
  | 'REMOVE_PREFIX'
  | 'ADD_PREFIX'
  | 'REMOVE_SUFFIX'
  | 'REPLACE'
  | 'STRIP_DOMAIN'
  | 'REGEX'

export type ExportFormat = 'csv' | 'json' | 'apache' | 'nginx'
export type StatusCode = 301 | 302 | 307 | 308

export interface URLEntry {
  id: string
  raw: string
  normalized: string
  domain: string
  path: string
  slug: string
  segments: string[]
  depth: number
  keywords: string
}

export interface RuleParams {
  find?: string
  replace?: string
  prefix?: string
  suffix?: string
  pattern?: string
}

export interface TransformationRule {
  id: string
  type: RuleType
  enabled: boolean
  order: number
  params: RuleParams
}

export interface AlgorithmScores {
  levenshtein: number
  cosine: number
  structural: number
}

export interface MatchResult {
  id: string
  source: URLEntry
  destination: URLEntry
  confidence: number
  scores: AlgorithmScores
  status: MatchStatus
  is_edited: boolean
  edited_destination?: string
}

export interface MatchingStats {
  total_a: number
  total_b: number
  auto_approved: number
  pending_review: number
  no_match: number
  processing_time_ms: number
}

export interface ExportConfig {
  format: ExportFormat
  status_code: StatusCode
  include_rejected: boolean
  filename: string
}

export interface ParseResponse {
  count: number
  urls: URLEntry[]
  discarded: number
  discarded_reasons: string[]
}

export interface RuleStep {
  rule_id: string
  rule_type: string
  input: string
  output: string
  changed: boolean
}

export interface RulesPreviewResponse {
  result: string
  steps: RuleStep[]
}

export interface MatchResponse {
  results: MatchResult[]
  stats: MatchingStats
}
