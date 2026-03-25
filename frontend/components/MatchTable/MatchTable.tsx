'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CheckCircle, Clock, UserCheck, XCircle, MinusCircle, Edit2, Check, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { MatchResult, MatchStatus } from '@/types'

const STATUS_CONFIG: Record<MatchStatus, { label: string; color: string; icon: React.ReactNode; rowClass: string }> = {
  AUTO_APPROVED:    { label: 'Auto', color: 'var(--accent-green)', icon: <CheckCircle size={12} />, rowClass: 'row-auto-approved' },
  PENDING_REVIEW:   { label: 'Review', color: 'var(--accent-amber)', icon: <Clock size={12} />, rowClass: 'row-pending' },
  MANUALLY_APPROVED:{ label: 'Approved', color: 'var(--accent-blue)', icon: <UserCheck size={12} />, rowClass: 'row-manually' },
  REJECTED:         { label: 'Rejected', color: 'var(--accent-red)', icon: <XCircle size={12} />, rowClass: 'row-rejected' },
  NO_MATCH:         { label: 'No Match', color: 'var(--text-secondary)', icon: <MinusCircle size={12} />, rowClass: 'row-no-match' },
}

function StatusBadge({ status }: { status: MatchStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full"
      style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}40` }}
    >
      {cfg.icon} {cfg.label}
    </span>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 85 ? 'var(--accent-green)'
    : value >= 50 ? 'var(--accent-amber)'
    : 'var(--accent-red)'
  return (
    <div className="flex items-center gap-2">
      <div style={{ background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden', width: 60, height: 4 }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span className="text-xs font-mono tabular-nums" style={{ color, minWidth: 36, textAlign: 'right' }}>
        {value.toFixed(0)}%
      </span>
    </div>
  )
}

function EditableDestCell({ row }: { row: MatchResult }) {
  const { updateMatchResult } = useAppStore()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(row.edited_destination || row.destination.raw || row.destination.path)

  const save = () => {
    updateMatchResult(row.id, {
      edited_destination: val,
      status: 'MANUALLY_APPROVED',
      is_edited: true,
    })
    setEditing(false)
  }

  const cancel = () => {
    setVal(row.edited_destination || row.destination.raw || row.destination.path)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-blue)',
            borderRadius: '4px',
            padding: '2px 6px',
            color: 'var(--text-primary)',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            outline: 'none',
          }}
        />
        <button onClick={save} style={{ color: 'var(--accent-green)' }}><Check size={12} /></button>
        <button onClick={cancel} style={{ color: 'var(--accent-red)' }}><X size={12} /></button>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 group cursor-text"
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit"
    >
      <span
        className="text-xs truncate"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          color: row.status === 'NO_MATCH' ? 'var(--text-secondary)' : 'var(--text-primary)',
          maxWidth: 240,
        }}
      >
        {row.edited_destination || row.destination.raw || row.destination.path || '—'}
        {row.is_edited && <span style={{ color: 'var(--accent-blue)', marginLeft: 4 }}>✎</span>}
      </span>
      <Edit2 size={10} className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
    </div>
  )
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: (event: unknown) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
    />
  )
}

const col = createColumnHelper<MatchResult>()

export function MatchTable() {
  const { matchResults, matchStats, updateMatchResult, bulkUpdateStatus } = useAppStore()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  const filtered = React.useMemo(() => {
    let data = matchResults
    if (statusFilter !== 'ALL') data = data.filter((r) => r.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (r) =>
          r.source.path.includes(q) ||
          (r.destination.raw || r.destination.path).includes(q) ||
          (r.edited_destination || '').includes(q),
      )
    }
    return data
  }, [matchResults, statusFilter, search])

  const columns = [
    col.display({
      id: 'select',
      header: ({ table }) => {
        return (
          <IndeterminateCheckbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        )
      },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      size: 36,
    }),
    col.accessor('source', {
      header: 'Source URL',
      cell: (info) => (
        <span className="text-xs truncate block" style={{ fontFamily: '"JetBrains Mono", monospace', maxWidth: 260, color: 'var(--text-primary)' }}>
          {info.getValue().path || info.getValue().raw}
        </span>
      ),
    }),
    col.display({
      id: 'destination',
      header: 'Destination URL',
      cell: ({ row }) => <EditableDestCell row={row.original} />,
    }),
    col.accessor('confidence', {
      header: 'Score',
      cell: (info) => <ConfidenceBar value={info.getValue()} />,
      size: 120,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
      size: 120,
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex gap-1">
            {r.status !== 'MANUALLY_APPROVED' && r.status !== 'AUTO_APPROVED' && r.status !== 'NO_MATCH' && (
              <button
                onClick={() => updateMatchResult(r.id, { status: 'MANUALLY_APPROVED' })}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'var(--accent-green)18', color: 'var(--accent-green)', border: '1px solid var(--accent-green)40' }}
              >
                ✓
              </button>
            )}
            {r.status !== 'REJECTED' && (
              <button
                onClick={() => updateMatchResult(r.id, { status: 'REJECTED' })}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'var(--accent-red)18', color: 'var(--accent-red)', border: '1px solid var(--accent-red)40' }}
              >
                ✕
              </button>
            )}
          </div>
        )
      },
      size: 80,
    }),
  ]

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
  })

  const parentRef = React.useRef<HTMLDivElement>(null)
  const { rows } = table.getRowModel()
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  if (matchResults.length === 0) return null

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-base font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
          Validation Table
        </h3>
        {matchStats && (
          <div className="flex gap-4 text-sm ml-4" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent-green)' }}>✓ {matchStats.auto_approved} auto</span>
            <span style={{ color: 'var(--accent-amber)' }}>⚠ {matchStats.pending_review} review</span>
            <span style={{ color: 'var(--text-secondary)' }}>✕ {matchStats.no_match} no match</span>
            <span>({matchStats.processing_time_ms}ms)</span>
          </div>
        )}
        <div className="flex-1" />
        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedIds.length} selected</span>
            <button
              onClick={() => { bulkUpdateStatus(selectedIds, 'MANUALLY_APPROVED'); setRowSelection({}) }}
              className="text-xs px-2 py-1 rounded"
              style={{ background: 'var(--accent-green)18', color: 'var(--accent-green)', border: '1px solid var(--accent-green)40' }}
            >
              Approve All
            </button>
            <button
              onClick={() => { bulkUpdateStatus(selectedIds, 'REJECTED'); setRowSelection({}) }}
              className="text-xs px-2 py-1 rounded"
              style={{ background: 'var(--accent-red)18', color: 'var(--accent-red)', border: '1px solid var(--accent-red)40' }}
            >
              Reject All
            </button>
          </div>
        )}
        {/* Filters */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--text-primary)',
            fontFamily: '"DM Mono", monospace',
            fontSize: '13px',
            outline: 'none',
          }}
        >
          <option value="ALL">All Status</option>
          <option value="AUTO_APPROVED">Auto Approved</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="MANUALLY_APPROVED">Manually Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="NO_MATCH">No Match</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search URLs..."
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: 'var(--text-primary)',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '13px',
            outline: 'none',
            width: 240,
          }}
        />
      </div>

      {/* Column Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 1fr 140px 140px 100px',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          background: 'var(--bg-elevated)',
        }}
      >
        {table.getHeaderGroups()[0].headers.map((header) => (
          <div
            key={header.id}
            className="text-xs font-mono cursor-pointer select-none"
            style={{ color: 'var(--text-secondary)' }}
            onClick={header.column.getToggleSortingHandler()}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
            {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
          </div>
        ))}
      </div>

      {/* Virtualised rows */}
      <div ref={parentRef} style={{ height: Math.min(rows.length * 52, 600), overflowY: 'auto' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            const status = row.original.status
            const cfg = STATUS_CONFIG[status]
            return (
              <div
                key={row.id}
                className={cfg.rowClass}
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                  height: 52,
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr 1fr 140px 140px 100px',
                  alignItems: 'center',
                  padding: '0 16px',
                  borderBottom: '1px solid var(--border)',
                  background: row.getIsSelected() ? 'var(--bg-elevated)' : 'transparent',
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} style={{ overflow: 'hidden' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
