'use client'

import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Link2, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { parseUrls, parseFile } from '@/lib/api'
import type { URLEntry } from '@/types'

interface URLLoaderProps {
  label: string
  accent: string
  onParsed: (urls: URLEntry[], discarded: number) => void
}

export function URLLoader({ label, accent, onParsed }: URLLoaderProps) {
  const [text, setText] = useState('')
  const [parsedCount, setParsedCount] = useState<number | null>(null)
  const [discardedCount, setDiscardedCount] = useState(0)
  const [fileName, setFileName] = useState<string | null>(null)

  const parseMutation = useMutation({
    mutationFn: async ({ source, type }: { source: string; type: 'text' | 'csv' | 'xml' }) => {
      return parseUrls(source, type)
    },
    onSuccess: (data) => {
      setParsedCount(data.count)
      setDiscardedCount(data.discarded)
      onParsed(data.urls, data.discarded)
    },
  })

  const fileMutation = useMutation({
    mutationFn: async (file: File) => parseFile(file),
    onSuccess: (data) => {
      setParsedCount(data.count)
      setDiscardedCount(data.discarded)
      onParsed(data.urls, data.discarded)
    },
  })

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      setFileName(file.name)
      setText('')
      fileMutation.mutate(file)
    },
    [fileMutation],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'text/csv': ['.csv'], 'application/xml': ['.xml'], 'text/xml': ['.xml'] },
    maxFiles: 1,
    noClick: text.length > 0,
  })

  const handleParse = () => {
    if (!text.trim()) return
    setFileName(null)
    const type = text.trim().startsWith('<') ? 'xml' : 'text'
    parseMutation.mutate({ source: text, type })
  }

  const isPending = parseMutation.isPending || fileMutation.isPending
  const isError = parseMutation.isError || fileMutation.isError

  return (
    <div
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      className="rounded-xl flex flex-col gap-4 p-6"
    >
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-mono font-medium tracking-wide uppercase"
          style={{ color: accent }}
        >
          {label}
        </h3>
        {parsedCount !== null && !isPending && (
          <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
            <span style={{ color: 'var(--accent-green)' }}>{parsedCount} URLs</span>
            {discardedCount > 0 && (
              <span style={{ color: 'var(--accent-amber)' }}>({discardedCount} discarded)</span>
            )}
          </div>
        )}
      </div>

      {/* Dropzone + Textarea */}
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? accent : 'var(--border)'}`,
          background: isDragActive ? 'rgba(77,158,255,0.05)' : 'var(--bg-elevated)',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        className="rounded-lg relative"
      >
        <input {...getInputProps()} />
        {fileName ? (
          <div className="flex items-center gap-2 p-3 text-sm">
            <Link2 size={14} style={{ color: accent }} />
            <span style={{ color: 'var(--text-primary)' }}>{fileName}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setFileName(null); setParsedCount(null) }}
              style={{ color: 'var(--text-secondary)' }}
              className="ml-auto hover:opacity-100 opacity-70 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder={`Paste URLs here (one per line)\nor drop a .txt / .csv / .xml file`}
              rows={14}
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '13px',
                resize: 'none',
                width: '100%',
                outline: 'none',
                padding: '12px 14px',
              }}
            />
            {!text && (
              <div
                className="absolute bottom-4 right-4 flex items-center gap-1.5 text-sm pointer-events-none"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Upload size={14} />
                drag &amp; drop
              </div>
            )}
          </>
        )}
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--accent-red)' }}>
          <AlertCircle size={12} />
          Failed to parse. Check URL format and try again.
        </div>
      )}

      {/* Parse Button */}
      {!fileName && (
        <button
          onClick={handleParse}
          disabled={!text.trim() || isPending}
          style={{
            background: text.trim() && !isPending ? accent : 'var(--bg-elevated)',
            color: text.trim() && !isPending ? '#000' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontFamily: '"DM Mono", monospace',
            fontSize: '13px',
            fontWeight: 500,
            cursor: text.trim() && !isPending ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            letterSpacing: '0.05em',
          }}
        >
          {isPending ? 'PARSING...' : 'PARSE URLs'}
        </button>
      )}
    </div>
  )
}
