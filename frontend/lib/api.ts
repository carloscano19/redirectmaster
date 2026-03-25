// RedirectMaster AI — API Client (axios + react-query)
import axios from 'axios'
import type {
  ParseResponse,
  RulesPreviewResponse,
  MatchResponse,
  TransformationRule,
  URLEntry,
  MatchResult,
  ExportConfig,
} from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000, // 2 min for large matching jobs
})

// ── Parse ────────────────────────────────────────────────────────────────────

export async function parseUrls(
  source: string,
  sourceType: 'text' | 'csv' | 'xml' = 'text',
  columnHint?: string,
): Promise<ParseResponse> {
  const formData = new FormData()
  formData.append('source', source)
  formData.append('source_type', sourceType)
  if (columnHint) formData.append('column_hint', columnHint)

  const { data } = await apiClient.post<ParseResponse>('/api/parse', formData)
  return data
}

export async function parseFile(file: File, columnHint?: string): Promise<ParseResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (columnHint) formData.append('column_hint', columnHint)

  const { data } = await apiClient.post<ParseResponse>('/api/parse/file', formData)
  return data
}

// ── Rules ────────────────────────────────────────────────────────────────────

export async function previewRules(
  sampleUrl: string,
  rules: TransformationRule[],
): Promise<RulesPreviewResponse> {
  const { data } = await apiClient.post<RulesPreviewResponse>('/api/rules/preview', {
    sample_url: sampleUrl,
    rules,
  })
  return data
}

// ── Match ────────────────────────────────────────────────────────────────────

export interface MatchConfig {
  auto_approve_threshold: number
  max_candidates: number
  algorithms: string[]
}

export async function runMatching(
  urlsA: URLEntry[],
  urlsB: URLEntry[],
  rules: TransformationRule[],
  config: MatchConfig,
): Promise<MatchResponse> {
  const { data } = await apiClient.post<MatchResponse>('/api/match', {
    urls_a: urlsA,
    urls_b: urlsB,
    rules,
    config,
  })
  return data
}

// ── Export ───────────────────────────────────────────────────────────────────

export async function exportRedirects(
  matches: MatchResult[],
  config: ExportConfig,
): Promise<void> {
  const response = await apiClient.post(
    '/api/export',
    { matches, config },
    { responseType: 'blob' },
  )

  const contentDisposition = response.headers['content-disposition'] || ''
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
  const filename = filenameMatch ? filenameMatch[1] : config.filename

  const url = window.URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}
