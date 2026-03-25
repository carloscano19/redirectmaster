'use client'

import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, GripVertical, Trash2,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { previewRules } from '@/lib/api'
import { useAppStore } from '@/store/appStore'
import type { TransformationRule, RuleType } from '@/types'

const RULE_TYPES: { value: RuleType; label: string; description: string }[] = [
  { value: 'REMOVE_PREFIX', label: 'Remove Prefix', description: 'Strip a prefix from the URL path' },
  { value: 'ADD_PREFIX', label: 'Add Prefix', description: 'Prepend a string to the URL path' },
  { value: 'REMOVE_SUFFIX', label: 'Remove Suffix', description: 'Strip a suffix from the URL' },
  { value: 'REPLACE', label: 'Find & Replace', description: 'Replace a string in the URL' },
  { value: 'STRIP_DOMAIN', label: 'Strip Domain', description: 'Keep only the path, remove domain' },
  { value: 'REGEX', label: 'Regex', description: 'Apply a regex transformation' },
]

function RuleCard({ rule }: { rule: TransformationRule }) {
  const { updateRule, removeRule } = useAppStore()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const ruleInfo = RULE_TYPES.find((r) => r.value === rule.type)

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--bg-elevated)',
        border: `1px solid ${rule.enabled ? 'var(--border)' : 'transparent'}`,
        borderRadius: '8px',
        padding: '14px 16px',
        opacity: rule.enabled ? 1 : 0.5,
        boxShadow: rule.enabled ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
        transition: 'all 0.2s ease',
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          style={{ color: 'var(--text-secondary)', cursor: 'grab', flexShrink: 0 }}
        >
          <GripVertical size={14} />
        </button>

        <span
          className="text-sm font-mono font-medium flex-1"
          style={{ color: 'var(--accent-blue)' }}
        >
          {ruleInfo?.label}
        </span>

        <label className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
            className="accent-blue-500"
          />
          enabled
        </label>

        <button
          onClick={() => removeRule(rule.id)}
          style={{ color: 'var(--accent-red)' }}
          className="hover:opacity-80 transition-opacity ml-1"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Parameters */}
      <div className="flex flex-col gap-1.5 pl-5">
        {(rule.type === 'REMOVE_PREFIX' || rule.type === 'ADD_PREFIX') && (
          <RuleInput
            label="Prefix"
            value={rule.params.prefix || ''}
            onChange={(v) => updateRule(rule.id, { params: { ...rule.params, prefix: v } })}
            placeholder="/old-prefix"
          />
        )}
        {rule.type === 'REMOVE_SUFFIX' && (
          <RuleInput
            label="Suffix"
            value={rule.params.suffix || ''}
            onChange={(v) => updateRule(rule.id, { params: { ...rule.params, suffix: v } })}
            placeholder=".html"
          />
        )}
        {rule.type === 'REPLACE' && (
          <>
            <RuleInput
              label="Find"
              value={rule.params.find || ''}
              onChange={(v) => updateRule(rule.id, { params: { ...rule.params, find: v } })}
              placeholder="https://staging.example.com"
            />
            <RuleInput
              label="Replace"
              value={rule.params.replace || ''}
              onChange={(v) => updateRule(rule.id, { params: { ...rule.params, replace: v } })}
              placeholder="https://example.com"
            />
          </>
        )}
        {rule.type === 'REGEX' && (
          <>
            <RuleInput
              label="Pattern"
              value={rule.params.pattern || ''}
              onChange={(v) => updateRule(rule.id, { params: { ...rule.params, pattern: v } })}
              placeholder="^/old/(.*)"
            />
            <RuleInput
              label="Replace"
              value={rule.params.replace || ''}
              onChange={(v) => updateRule(rule.id, { params: { ...rule.params, replace: v } })}
              placeholder="/new/\1"
            />
          </>
        )}
        {rule.type === 'STRIP_DOMAIN' && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Removes domain — keeps only the path
          </p>
        )}
      </div>
    </div>
  )
}

function RuleInput({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-16 text-right" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '6px 10px',
          color: 'var(--text-primary)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '13px',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        className="focus:border-blue-500"
      />
    </div>
  )
}

export function RulesBuilder() {
  const { rules, addRule, reorderRules, urlsB } = useAppStore()
  const [selectedType, setSelectedType] = useState<RuleType>('REMOVE_PREFIX')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewResult, setPreviewResult] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const previewMutation = useMutation({
    mutationFn: () => previewRules(previewUrl || (urlsB[0]?.raw ?? ''), rules),
    onSuccess: (data) => setPreviewResult(data.result),
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = rules.findIndex((r) => r.id === active.id)
      const newIndex = rules.findIndex((r) => r.id === over.id)
      const newOrder = [...rules]
      const [moved] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, moved)
      reorderRules(newOrder.map((r) => r.id))
    }
  }

  const handleAdd = () => {
    addRule({
      id: `rule_${Date.now()}`,
      type: selectedType,
      enabled: true,
      order: rules.length,
      params: {},
    })
  }

  return (
    <div
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      className="rounded-xl p-6 flex flex-col gap-4"
    >
      <h3 className="text-sm font-mono font-medium tracking-wide uppercase" style={{ color: 'var(--accent-purple)' }}>
        Rules Engine
      </h3>

      {/* Add Rule Bar */}
      <div className="flex gap-2">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as RuleType)}
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: 'var(--text-primary)',
            fontFamily: '"DM Mono", monospace',
            fontSize: '14px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {RULE_TYPES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          style={{
            background: 'var(--accent-purple)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontFamily: '"DM Mono", monospace',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'opacity 0.2s',
          }}
          className="hover:opacity-90"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Sortable rules */}
      {rules.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {[...rules].sort((a, b) => a.order - b.order).map((rule) => (
                <RuleCard key={rule.id} rule={rule} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {rules.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg"
          style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No rules defined.
          </p>
          <p className="text-xs opacity-70" style={{ color: 'var(--text-secondary)' }}>
            Add a rule to transform Web B URLs before matching.
          </p>
        </div>
      )}

      {/* Preview */}
      {rules.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Live Preview</p>
          <div className="flex gap-2">
            <input
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder={urlsB[0]?.raw || 'https://example.com/path'}
              style={{
                flex: 1,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent-purple)',
                borderRadius: '8px',
                padding: '10px 16px',
                color: 'var(--accent-purple)',
                fontFamily: '"DM Mono", monospace',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s text-primary',
              }}
              className="hover:bg-purple-500 hover:text-white"
            >
              {previewMutation.isPending ? '...' : 'Preview'}
            </button>
          </div>
          {previewResult && (
            <div
              className="mt-3 px-4 py-3 rounded-lg text-sm shadow-inner"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                fontFamily: '"JetBrains Mono", monospace',
                color: 'var(--accent-green)',
                wordBreak: 'break-all',
              }}
            >
              → {previewResult}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
