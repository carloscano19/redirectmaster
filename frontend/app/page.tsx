'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Play, RotateCcw, Zap, Moon, Sun } from 'lucide-react'
import { URLLoader } from '@/components/URLLoader/URLLoader'
import { RulesBuilder } from '@/components/RulesEngine/RulesBuilder'
import { MatchTable } from '@/components/MatchTable/MatchTable'
import { ExportPanel } from '@/components/ExportPanel/ExportPanel'
import { useAppStore } from '@/store/appStore'
import { runMatching } from '@/lib/api'
import { toast } from 'sonner'

type Step = 1 | 2 | 3

const STEP_LABELS: Record<Step, string> = {
  1: '01 · Load URLs',
  2: '02 · Configure Rules',
  3: '03 · Review & Export',
}

export default function HomePage() {
  const [step, setStep] = useState<Step>(1)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const {
    urlsA, setUrlsA,
    urlsB, setUrlsB,
    rules,
    matchResults, setMatchResults,
    isMatching, setIsMatching,
    autoApproveThreshold,
    reset,
  } = useAppStore()


  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const matchMutation = useMutation({
    mutationFn: () =>
      runMatching(urlsA, urlsB, rules, {
        auto_approve_threshold: autoApproveThreshold,
        max_candidates: 3,
        algorithms: ['levenshtein', 'cosine', 'structural'],
      }),
    onMutate: () => setIsMatching(true),
    onSuccess: (data) => {
      setMatchResults(data.results, data.stats)
      setIsMatching(false)
      setStep(3)
      toast.success(
        `Matching complete — ${data.stats.auto_approved} auto-approved in ${data.stats.processing_time_ms}ms`,
      )
    },
    onError: () => {
      setIsMatching(false)
      toast.error('Matching failed. Check that both URL lists are loaded.')
    },
  })

  const canMatch = urlsA.length > 0 && urlsB.length > 0 && !isMatching

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Header */}
      <header
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="max-w-[1440px] w-full mx-auto px-8 py-4 flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              style={{
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
              }}
            >
              <Zap size={20} color="#fff" />
            </div>
            <div>
              <h1 className="text-base font-mono font-medium" style={{ color: 'var(--text-primary)', lineHeight: 1 }}>
                RedirectMaster
              </h1>
              <span className="text-sm font-mono" style={{ color: 'var(--accent-blue)' }}>AI</span>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-1 ml-6">
            {([1, 2, 3] as Step[]).map((s) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                style={{
                  background: step === s ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                  border: `1px solid ${step === s ? 'var(--accent-blue)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  padding: '6px 14px',
                  color: step === s ? '#fff' : 'var(--text-secondary)',
                  fontFamily: '"DM Mono", monospace',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {STEP_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* URL counts */}
          {urlsA.length > 0 && urlsB.length > 0 && (
            <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              {urlsA.length} × {urlsB.length} URLs
            </span>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Reset */}
          {matchResults.length > 0 && (
            <button
              onClick={() => { reset(); setStep(1) }}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 14px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: '"DM Mono", monospace',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1440px] w-full mx-auto px-8 py-8 flex flex-col gap-8">
        {/* Step 1 + 2: Load and Rules on same screen */}
        {(step === 1 || step === 2) && (
          <div className="animate-in">
            {/* URL Loaders Row */}
            <div className="grid grid-cols-3 gap-6 mb-6">
              <URLLoader
                label="Web A — Origin"
                accent="var(--accent-blue)"
                onParsed={(urls, d) => setUrlsA(urls, d)}
              />
              <RulesBuilder />
              <URLLoader
                label="Web B — Destination"
                accent="var(--accent-green)"
                onParsed={(urls, d) => setUrlsB(urls, d)}
              />
            </div>

            {/* Status bar */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px 24px',
              }}
              className="flex items-center gap-6"
            >
              <div className="flex gap-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>
                  Web A:{' '}
                  <span style={{ color: urlsA.length > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                    {urlsA.length > 0 ? `${urlsA.length} URLs` : 'not loaded'}
                  </span>
                </span>
                <span>
                  Web B:{' '}
                  <span style={{ color: urlsB.length > 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                    {urlsB.length > 0 ? `${urlsB.length} URLs` : 'not loaded'}
                  </span>
                </span>
                <span>
                  Rules:{' '}
                  <span style={{ color: rules.length > 0 ? 'var(--accent-purple)' : 'var(--text-secondary)' }}>
                    {rules.length > 0 ? `${rules.length} active` : 'none'}
                  </span>
                </span>
              </div>

              <div className="flex-1" />

              {/* Threshold slider */}
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>Auto-approve threshold:</span>
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={autoApproveThreshold}
                  onChange={(e) => useAppStore.getState().setAutoApproveThreshold(Number(e.target.value))}
                  className="w-24"
                  style={{ accentColor: 'var(--accent-blue)' }}
                />
                <span style={{ color: 'var(--accent-blue)', fontFamily: '"DM Mono", monospace', minWidth: 32 }}>
                  {autoApproveThreshold}%
                </span>
              </div>

              <button
                onClick={() => matchMutation.mutate()}
                disabled={!canMatch}
                style={{
                  background: canMatch
                    ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))'
                    : 'var(--bg-elevated)',
                  color: canMatch ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 28px',
                  fontFamily: '"DM Mono", monospace',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: canMatch ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                  letterSpacing: '0.05em',
                  boxShadow: canMatch ? '0 4px 20px rgba(77,158,255,0.3)' : 'none',
                }}
              >
                {isMatching ? (
                  <>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    MATCHING...
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" />
                    RUN MATCHING
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Export */}
        {step === 3 && matchResults.length > 0 && (
          <div className="flex flex-col gap-4 animate-in">
            <MatchTable />
            <ExportPanel />
          </div>
        )}

        {/* Matching in progress overlay hint */}
        {isMatching && (
          <div className="text-center py-12">
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid var(--bg-elevated)',
                borderTopColor: 'var(--accent-blue)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              Running ensemble matching...
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {urlsA.length} × {urlsB.length} URLs
            </p>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
