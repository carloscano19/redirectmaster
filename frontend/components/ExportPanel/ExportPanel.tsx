'use client'

import React, { useState } from 'react'
import { Download, FileText, Code, Globe, Server } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { exportRedirects } from '@/lib/api'
import { useAppStore } from '@/store/appStore'
import { toast } from 'sonner'
import type { ExportFormat, StatusCode } from '@/types'

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string; icon: React.ReactNode; ext: string }[] = [
  { value: 'csv', label: 'CSV', description: 'Spreadsheet-compatible', icon: <FileText size={14} />, ext: '.csv' },
  { value: 'json', label: 'JSON', description: 'API-ready format', icon: <Code size={14} />, ext: '.json' },
  { value: 'apache', label: 'Apache', description: '.htaccess redirect rules', icon: <Globe size={14} />, ext: '.htaccess' },
  { value: 'nginx', label: 'Nginx', description: 'map block config', icon: <Server size={14} />, ext: '.conf' },
]

const STATUS_CODES: StatusCode[] = [301, 302, 307, 308]
const STATUS_DESCRIPTIONS: Record<StatusCode, string> = {
  301: 'Moved Permanently',
  302: 'Found (Temporary)',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
}

export function ExportPanel() {
  const { matchResults } = useAppStore()
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [statusCode, setStatusCode] = useState<StatusCode>(301)
  const [filename, setFilename] = useState('redirects')

  const approvedCount = matchResults.filter(
    (r) => r.status === 'AUTO_APPROVED' || r.status === 'MANUALLY_APPROVED',
  ).length

  const exportMutation = useMutation({
    mutationFn: () =>
      exportRedirects(matchResults, {
        format,
        status_code: statusCode,
        include_rejected: false,
        filename,
      }),
    onSuccess: () => toast.success(`Exported ${approvedCount} redirects as ${format.toUpperCase()}`),
    onError: () => toast.error('Export failed. Please try again.'),
  })

  if (matchResults.length === 0) return null

  return (
    <div
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px' }}
      className="p-4"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
          Export Redirects
        </h3>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {approvedCount} approved • {matchResults.length - approvedCount} excluded
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {/* Format selector */}
        <div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Format</p>
          <div className="grid grid-cols-4 gap-2">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFormat(opt.value)}
                style={{
                  background: format === opt.value ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                  border: `1px solid ${format === opt.value ? 'var(--accent-blue)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  padding: '12px',
                  color: format === opt.value ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                {opt.icon}
                <span className="text-sm font-mono font-medium">{opt.label}</span>
                <span className="text-sm" style={{ color: format === opt.value ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', fontSize: '11px' }}>
                  {opt.ext}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* HTTP Status Code */}
        <div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>HTTP Status Code</p>
          <div className="flex gap-3">
            {STATUS_CODES.map((code) => (
              <button
                key={code}
                onClick={() => setStatusCode(code)}
                style={{
                  background: statusCode === code ? 'var(--accent-purple)' : 'var(--bg-elevated)',
                  border: `1px solid ${statusCode === code ? 'var(--accent-purple)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: statusCode === code ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: '"DM Mono", monospace',
                  fontSize: '13px',
                  transition: 'all 0.2s',
                }}
                title={STATUS_DESCRIPTIONS[code]}
              >
                {code}
              </button>
            ))}
            <span className="text-sm self-center ml-2" style={{ color: 'var(--text-secondary)' }}>
              {STATUS_DESCRIPTIONS[statusCode]}
            </span>
          </div>
        </div>

        {/* Filename */}
        <div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Filename</p>
          <div className="flex items-center gap-0">
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRight: 'none',
                borderRadius: '8px 0 0 8px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <span
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: '0 8px 8px 0',
                padding: '8px 12px',
                color: 'var(--text-secondary)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '13px',
              }}
            >
              {FORMAT_OPTIONS.find((o) => o.value === format)?.ext}
            </span>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending || approvedCount === 0}
          style={{
            background: approvedCount > 0 ? 'var(--accent-blue)' : 'var(--bg-elevated)',
            color: approvedCount > 0 ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '8px',
            padding: '14px 24px',
            fontFamily: '"DM Mono", monospace',
            fontSize: '14px',
            fontWeight: 500,
            cursor: approvedCount > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.2s',
            letterSpacing: '0.05em',
          }}
        >
          <Download size={14} />
          {exportMutation.isPending
            ? 'EXPORTING...'
            : `DOWNLOAD ${approvedCount} REDIRECTS`}
        </button>
      </div>
    </div>
  )
}
