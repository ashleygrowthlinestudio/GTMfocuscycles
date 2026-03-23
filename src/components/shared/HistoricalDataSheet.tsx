'use client';

import React, { useMemo, useCallback, useState } from 'react';
import type { QuarterlyHistoricalData, ChannelConfig, Month } from '@/lib/types';

// ── Quarter label generation ─────────────────────────────────

function generateQuarterSlots(planYear: number): { quarterLabel: string; year: number; quarter: 1 | 2 | 3 | 4 }[] {
  const slots: { quarterLabel: string; year: number; quarter: 1 | 2 | 3 | 4 }[] = [];
  for (let i = 0; i < 8; i++) {
    const year = planYear - 2 + Math.floor(i / 4);
    const q = ((i % 4) + 1) as 1 | 2 | 3 | 4;
    slots.push({ quarterLabel: `Q${q} ${year}`, year, quarter: q });
  }
  return slots;
}

// ── Empty quarter factory ────────────────────────────────────

function createEmptyQuarter(slot: { quarterLabel: string; year: number; quarter: 1 | 2 | 3 | 4 }): QuarterlyHistoricalData {
  return {
    ...slot,
    inboundHIS: 0, inboundHISToPipelineRate: 0, inboundQualifiedPipeline: 0,
    inboundWinRate: 0, inboundACV: 0, inboundSalesCycle: 0,
    inboundClosedWon: 0, inboundNewCustomers: 0,
    outboundQualifiedPipeline: 0, outboundWinRate: 0, outboundACV: 0,
    outboundSalesCycle: 0, outboundClosedWon: 0, outboundNewCustomers: 0,
    expansionRevenue: 0, expansionRate: 0, expansionPipeline: 0, expansionWinRate: 0, expansionACV: 0, expansionSalesCycle: 0,
    churnRevenue: 0, churnRate: 0,
    newProductHIS: 0, newProductHISToPipelineRate: 0, newProductQualifiedPipeline: 0,
    newProductWinRate: 0, newProductACV: 0, newProductSalesCycle: 0,
    newProductClosedWon: 0, newProductNewCustomers: 0,
  };
}

// ── Check if a quarter has data ──────────────────────────────

const DATA_FIELDS: (keyof QuarterlyHistoricalData)[] = [
  'inboundHIS', 'inboundHISToPipelineRate', 'inboundQualifiedPipeline',
  'inboundWinRate', 'inboundACV', 'inboundSalesCycle',
  'inboundClosedWon', 'inboundNewCustomers',
  'outboundQualifiedPipeline', 'outboundWinRate', 'outboundACV',
  'outboundSalesCycle', 'outboundClosedWon', 'outboundNewCustomers',
  'expansionRevenue', 'expansionPipeline', 'expansionWinRate', 'expansionACV', 'expansionSalesCycle', 'churnRevenue', 'churnRate',
  'newProductHIS', 'newProductHISToPipelineRate', 'newProductQualifiedPipeline',
  'newProductWinRate', 'newProductACV', 'newProductSalesCycle',
  'newProductClosedWon', 'newProductNewCustomers',
];

function isQuarterFilled(q: QuarterlyHistoricalData): boolean {
  return DATA_FIELDS.some((f) => (q[f] as number) > 0);
}

// ── Metric row definitions ───────────────────────────────────

type MetricType = 'number' | 'currency' | 'percent' | 'months';
type Section = 'inbound' | 'outbound' | 'expansion' | 'churn' | 'newProduct';

interface MetricRowDef {
  label: string;
  field: keyof QuarterlyHistoricalData;
  type: MetricType;
  section: Section;
}

const METRIC_ROWS: MetricRowDef[] = [
  // Inbound
  { section: 'inbound', label: 'High Intent Submissions', field: 'inboundHIS', type: 'number' },
  { section: 'inbound', label: 'HIS → Pipeline Rate', field: 'inboundHISToPipelineRate', type: 'percent' },
  { section: 'inbound', label: 'Qualified Pipeline Created', field: 'inboundQualifiedPipeline', type: 'currency' },
  { section: 'inbound', label: 'Win Rate', field: 'inboundWinRate', type: 'percent' },
  { section: 'inbound', label: 'ACV', field: 'inboundACV', type: 'currency' },
  { section: 'inbound', label: 'Sales Cycle', field: 'inboundSalesCycle', type: 'months' },
  { section: 'inbound', label: 'Closed Won', field: 'inboundClosedWon', type: 'currency' },
  { section: 'inbound', label: 'New Customers', field: 'inboundNewCustomers', type: 'number' },
  // Outbound
  { section: 'outbound', label: 'Qualified Pipeline Created', field: 'outboundQualifiedPipeline', type: 'currency' },
  { section: 'outbound', label: 'Win Rate', field: 'outboundWinRate', type: 'percent' },
  { section: 'outbound', label: 'ACV', field: 'outboundACV', type: 'currency' },
  { section: 'outbound', label: 'Sales Cycle', field: 'outboundSalesCycle', type: 'months' },
  { section: 'outbound', label: 'Closed Won', field: 'outboundClosedWon', type: 'currency' },
  { section: 'outbound', label: 'New Customers', field: 'outboundNewCustomers', type: 'number' },
  // Expansion
  { section: 'expansion', label: 'Expansion Revenue', field: 'expansionRevenue', type: 'currency' },
  { section: 'expansion', label: 'Expansion Pipeline Created $', field: 'expansionPipeline', type: 'currency' },
  { section: 'expansion', label: 'Expansion Win Rate', field: 'expansionWinRate', type: 'percent' },
  { section: 'expansion', label: 'Expansion ACV', field: 'expansionACV', type: 'currency' },
  { section: 'expansion', label: 'Expansion Sales Cycle (mo)', field: 'expansionSalesCycle', type: 'number' },
  // Churn
  { section: 'churn', label: 'Churned Revenue', field: 'churnRevenue', type: 'currency' },
  { section: 'churn', label: 'Churn Rate (% of ARR)', field: 'churnRate', type: 'percent' },
  // New Product
  { section: 'newProduct', label: 'High Intent Submissions', field: 'newProductHIS', type: 'number' },
  { section: 'newProduct', label: 'HIS → Pipeline Rate', field: 'newProductHISToPipelineRate', type: 'percent' },
  { section: 'newProduct', label: 'Qualified Pipeline Created', field: 'newProductQualifiedPipeline', type: 'currency' },
  { section: 'newProduct', label: 'Win Rate', field: 'newProductWinRate', type: 'percent' },
  { section: 'newProduct', label: 'ACV', field: 'newProductACV', type: 'currency' },
  { section: 'newProduct', label: 'Sales Cycle', field: 'newProductSalesCycle', type: 'months' },
  { section: 'newProduct', label: 'Closed Won', field: 'newProductClosedWon', type: 'currency' },
  { section: 'newProduct', label: 'New Customers', field: 'newProductNewCustomers', type: 'number' },
];

const SECTION_LABELS: Record<Section, string> = {
  inbound: 'INBOUND',
  outbound: 'OUTBOUND',
  expansion: 'EXPANSION',
  churn: 'CHURN',
  newProduct: 'NEW PRODUCT',
};

function isSectionActive(section: Section, cc: ChannelConfig): boolean {
  switch (section) {
    case 'inbound': return cc.hasInbound;
    case 'outbound': return cc.hasOutbound;
    case 'expansion': return cc.hasExpansion;
    case 'churn': return cc.hasChurn;
    case 'newProduct': return cc.hasNewProduct;
  }
}

// ── QoQ trend calculation ────────────────────────────────────

function calcTrend(quarters: QuarterlyHistoricalData[], field: keyof QuarterlyHistoricalData): 'up' | 'down' | 'flat' | null {
  const values = quarters.map((q) => q[field] as number).filter((v) => v > 0);
  if (values.length < 2) return null;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev * 1.02) return 'up';
  if (last < prev * 0.98) return 'down';
  return 'flat';
}

// ── Input formatting helpers ─────────────────────────────────

function displayValue(value: number, type: MetricType): string {
  if (value === 0) return '';
  switch (type) {
    case 'percent': return String(Math.round(value * 10000) / 100); // 0.25 → "25"
    case 'currency': return String(value);
    case 'months': return String(value);
    default: return String(value);
  }
}

function parseValue(raw: string, type: MetricType): number {
  const num = parseFloat(raw);
  if (isNaN(num)) return 0;
  switch (type) {
    case 'percent': return num / 100; // "25" → 0.25
    default: return num;
  }
}

function inputStep(type: MetricType): number {
  switch (type) {
    case 'currency': return 1000;
    case 'percent': return 0.1;
    case 'months': return 1;
    default: return 1;
  }
}

function inputSuffix(type: MetricType): string {
  switch (type) {
    case 'percent': return '%';
    case 'currency': return '$';
    case 'months': return 'mo';
    default: return '';
  }
}

// ── Component ────────────────────────────────────────────────

interface HistoricalDataSheetProps {
  historicalQuarters: QuarterlyHistoricalData[];
  channelConfig: ChannelConfig;
  planYear: number;
  onChange: (quarters: QuarterlyHistoricalData[]) => void;
}

export default function HistoricalDataSheet({ historicalQuarters, channelConfig, planYear, onChange }: HistoricalDataSheetProps) {
  const slots = useMemo(() => generateQuarterSlots(planYear), [planYear]);

  // Track which metric note is being edited
  const [editingNote, setEditingNote] = useState<string | null>(null);

  // Ensure we have 8 quarter entries (backfill any missing)
  const quarters = useMemo(() => {
    return slots.map((slot) => {
      const existing = historicalQuarters.find(
        (q) => q.year === slot.year && q.quarter === slot.quarter,
      );
      return existing ?? createEmptyQuarter(slot);
    });
  }, [slots, historicalQuarters]);

  const filledCount = useMemo(() => quarters.filter(isQuarterFilled).length, [quarters]);

  const visibleRows = useMemo(() => {
    return METRIC_ROWS.filter((row) => isSectionActive(row.section, channelConfig));
  }, [channelConfig]);

  // Group rows by section for section headers
  const sections = useMemo(() => {
    const seen = new Set<Section>();
    const result: { section: Section; rows: MetricRowDef[]; startIdx: number }[] = [];
    let idx = 0;
    for (const row of visibleRows) {
      if (!seen.has(row.section)) {
        seen.add(row.section);
        result.push({ section: row.section, rows: [], startIdx: idx });
      }
      result[result.length - 1].rows.push(row);
      idx++;
    }
    return result;
  }, [visibleRows]);

  const handleCellChange = useCallback(
    (qi: number, field: keyof QuarterlyHistoricalData, raw: string, type: MetricType) => {
      const value = parseValue(raw, type);
      const updated = quarters.map((q, i) => {
        if (i !== qi) return q;
        const patched = { ...q, [field]: value };
        return patched;
      });
      onChange(updated);
    },
    [quarters, onChange],
  );

  // Get a metric note (read from first quarter's metricNotes)
  const getNote = useCallback(
    (field: string): string => {
      return quarters[0]?.metricNotes?.[field] ?? '';
    },
    [quarters],
  );

  // Set a metric note (write to all quarters' metricNotes to keep in sync)
  const handleNoteChange = useCallback(
    (field: string, note: string) => {
      const updated = quarters.map((q) => ({
        ...q,
        metricNotes: { ...(q.metricNotes ?? {}), [field]: note },
      }));
      onChange(updated);
    },
    [quarters, onChange],
  );

  // Completeness badge
  const badgeColor =
    filledCount >= 8 ? 'bg-green-100 text-green-800 border-green-300' :
    filledCount >= 4 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
    'bg-red-100 text-red-800 border-red-300';

  const badgeText =
    filledCount >= 8 ? 'Complete — 8/8 quarters' :
    filledCount >= 4 ? `${filledCount}/8 quarters filled` :
    `${filledCount}/8 — Add at least 4 quarters for accurate projections`;

  const colCount = quarters.length + 2; // metric label + 8 quarters + trend

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Historical Data Sheet</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter quarterly data for the {slots[0]?.quarterLabel} — {slots[7]?.quarterLabel} period. First 4 quarters required, last 4 optional.
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${badgeColor}`}>
          {badgeText}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-1">
          {quarters.map((q, i) => (
            <div key={q.quarterLabel} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-2 w-full rounded-full transition-colors ${
                  isQuarterFilled(q)
                    ? i < 4 ? 'bg-blue-500' : 'bg-blue-400'
                    : i < 4 ? 'bg-red-200' : 'bg-gray-200'
                }`}
              />
              <span className="text-[9px] text-gray-400 leading-none">{q.quarterLabel}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto p-4 pt-2">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-white min-w-[180px] z-10">
                Metric
              </th>
              {quarters.map((q, i) => (
                <th
                  key={q.quarterLabel}
                  className={`text-center py-2 px-1 text-[10px] font-semibold uppercase tracking-wide min-w-[100px] ${
                    i < 4 ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {q.quarterLabel}
                  {i < 4 && <span className="text-red-400 ml-0.5">*</span>}
                </th>
              ))}
              <th className="text-center py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide min-w-[60px]">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <React.Fragment key={sec.section}>
                {/* Section header row */}
                <tr>
                  <td
                    colSpan={colCount}
                    className="py-2 px-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-50 border-t border-b border-gray-200"
                  >
                    {SECTION_LABELS[sec.section]}
                  </td>
                </tr>
                {/* Metric rows */}
                {sec.rows.map((row) => {
                  const trend = calcTrend(quarters, row.field);
                  const note = getNote(row.field);
                  const isEditing = editingNote === row.field;

                  return (
                    <React.Fragment key={row.field}>
                      <tr className="border-b border-gray-100 hover:bg-blue-50/30">
                        <td className="py-1 px-2 text-gray-700 font-medium sticky left-0 bg-white z-10 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            {row.label}
                            {row.type === 'currency' && <span className="text-gray-400 text-[9px]">$</span>}
                            {row.type === 'percent' && <span className="text-gray-400 text-[9px]">%</span>}
                            {row.type === 'months' && <span className="text-gray-400 text-[9px]">mo</span>}
                            {/* Add source / note toggle */}
                            {!isEditing && !note && (
                              <button
                                onClick={() => setEditingNote(row.field)}
                                className="ml-1 text-[9px] text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                + source
                              </button>
                            )}
                            {!isEditing && note && (
                              <button
                                onClick={() => setEditingNote(row.field)}
                                className="ml-1 flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-gray-600 transition-colors max-w-[140px]"
                                title={note}
                              >
                                <span className="italic truncate">{note.length > 40 ? note.slice(0, 40) + '...' : note}</span>
                                <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}
                          </span>
                        </td>
                        {quarters.map((q, qi) => (
                          <td key={q.quarterLabel} className="py-0.5 px-0.5">
                            <input
                              type="number"
                              value={displayValue(q[row.field] as number, row.type)}
                              onChange={(e) => handleCellChange(qi, row.field, e.target.value, row.type)}
                              placeholder="—"
                              step={inputStep(row.type)}
                              className="w-full text-right rounded border border-gray-200 py-1 px-1.5 text-xs text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white hover:border-gray-300 transition-colors placeholder:text-gray-300"
                            />
                          </td>
                        ))}
                        <td className="py-1 px-2 text-center">
                          {trend === 'up' && <span className="text-green-600 font-bold">↑</span>}
                          {trend === 'down' && <span className="text-red-500 font-bold">↓</span>}
                          {trend === 'flat' && <span className="text-gray-400">→</span>}
                          {trend === null && <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                      {/* Inline note editing row */}
                      {isEditing && (
                        <tr>
                          <td colSpan={colCount} className="py-0.5 px-2">
                            <div className="flex items-center gap-1.5 pl-1">
                              <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              <input
                                type="text"
                                value={note}
                                onChange={(e) => handleNoteChange(row.field, e.target.value)}
                                onBlur={() => setEditingNote(null)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingNote(null); }}
                                autoFocus
                                placeholder="e.g. Pulled from HubSpot report, Q1 2024 board deck, Salesforce pipeline report..."
                                className="flex-1 text-[10px] text-gray-500 italic border-b border-gray-200 focus:border-blue-400 outline-none py-0.5 bg-transparent placeholder:text-gray-300"
                              />
                              {note && (
                                <button
                                  onMouseDown={(e) => { e.preventDefault(); handleNoteChange(row.field, ''); setEditingNote(null); }}
                                  className="text-[9px] text-gray-300 hover:text-red-400 flex-shrink-0"
                                >
                                  clear
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Exported helpers for auto-calculation ─────────────────────

export { isQuarterFilled, generateQuarterSlots, createEmptyQuarter };
