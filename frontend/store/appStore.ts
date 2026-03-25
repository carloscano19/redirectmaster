// RedirectMaster AI — Zustand Store
import { create } from 'zustand'
import type { URLEntry, TransformationRule, MatchResult, MatchingStats } from '@/types'

interface AppState {
  // ── Web A (Origin) ──────────────────────────────────────
  urlsA: URLEntry[]
  urlsADiscarded: number
  setUrlsA: (urls: URLEntry[], discarded: number) => void

  // ── Web B (Destination) ─────────────────────────────────
  urlsB: URLEntry[]
  urlsBDiscarded: number
  setUrlsB: (urls: URLEntry[], discarded: number) => void

  // ── Rules Engine ─────────────────────────────────────────
  rules: TransformationRule[]
  addRule: (rule: TransformationRule) => void
  updateRule: (id: string, updates: Partial<TransformationRule>) => void
  removeRule: (id: string) => void
  reorderRules: (orderedIds: string[]) => void

  // ── Matching Results ─────────────────────────────────────
  matchResults: MatchResult[]
  matchStats: MatchingStats | null
  isMatching: boolean
  setMatchResults: (results: MatchResult[], stats: MatchingStats) => void
  setIsMatching: (value: boolean) => void
  updateMatchResult: (id: string, updates: Partial<MatchResult>) => void
  bulkUpdateStatus: (ids: string[], status: MatchResult['status']) => void

  // ── Settings ─────────────────────────────────────────────
  autoApproveThreshold: number
  setAutoApproveThreshold: (value: number) => void

  // ── Reset ────────────────────────────────────────────────
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  urlsA: [],
  urlsADiscarded: 0,
  setUrlsA: (urls, discarded) => set({ urlsA: urls, urlsADiscarded: discarded }),

  urlsB: [],
  urlsBDiscarded: 0,
  setUrlsB: (urls, discarded) => set({ urlsB: urls, urlsBDiscarded: discarded }),

  rules: [],
  addRule: (rule) =>
    set((state) => ({
      rules: [...state.rules, { ...rule, order: state.rules.length }],
    })),
  updateRule: (id, updates) =>
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),
  removeRule: (id) =>
    set((state) => ({
      rules: state.rules
        .filter((r) => r.id !== id)
        .map((r, i) => ({ ...r, order: i })),
    })),
  reorderRules: (orderedIds) =>
    set((state) => ({
      rules: orderedIds
        .map((id, i) => {
          const rule = state.rules.find((r) => r.id === id)!
          return { ...rule, order: i }
        })
        .filter(Boolean),
    })),

  matchResults: [],
  matchStats: null,
  isMatching: false,
  setMatchResults: (results, stats) =>
    set({ matchResults: results, matchStats: stats }),
  setIsMatching: (value) => set({ isMatching: value }),
  updateMatchResult: (id, updates) =>
    set((state) => ({
      matchResults: state.matchResults.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    })),
  bulkUpdateStatus: (ids, status) =>
    set((state) => ({
      matchResults: state.matchResults.map((r) =>
        ids.includes(r.id) ? { ...r, status } : r,
      ),
    })),

  autoApproveThreshold: 85,
  setAutoApproveThreshold: (value) => set({ autoApproveThreshold: value }),

  reset: () =>
    set({
      urlsA: [],
      urlsADiscarded: 0,
      urlsB: [],
      urlsBDiscarded: 0,
      rules: [],
      matchResults: [],
      matchStats: null,
      isMatching: false,
    }),
}))
