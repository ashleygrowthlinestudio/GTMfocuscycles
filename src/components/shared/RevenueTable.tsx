'use client';

import React, { useState } from 'react';
import type { MonthlyResult, QuarterlyResult } from '@/lib/types';
import { formatCurrencyFull, formatNumber, formatMonthName } from '@/lib/format';

interface RevenueTableProps {
  monthly: MonthlyResult[];
  quarterly: QuarterlyResult[];
  startingARR: number;
  label?: string;
  averageACV?: number;
}

type ViewMode = 'quarterly' | 'monthly';

export default function RevenueTable({ monthly, quarterly, startingARR, label, averageACV }: RevenueTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{label || 'Revenue Projections'}</h3>
        <div className="flex gap-1 bg-gray-200 rounded-md p-0.5">
          <button
            onClick={() => setViewMode('quarterly')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              viewMode === 'quarterly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              viewMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {viewMode === 'quarterly' ? (
          <QuarterlyTable quarterly={quarterly} startingARR={startingARR} averageACV={averageACV} />
        ) : (
          <MonthlyTable monthly={monthly} startingARR={startingARR} averageACV={averageACV} />
        )}
      </div>
    </div>
  );
}

type RowDef = {
  label: string;
  getValue: (data: Record<string, number>) => number;
  fmt: (v: number) => string;
  isDeal?: boolean;
  isChurn?: boolean;
  isHighlight?: boolean;
};

function buildRows(averageACV: number): RowDef[] {
  const acv = averageACV || 1;
  return [
    { label: 'Inbound Pipeline Created', getValue: (d) => d.inboundPipelineCreated, fmt: formatCurrencyFull },
    { label: 'Outbound Pipeline Created', getValue: (d) => d.outboundPipelineCreated, fmt: formatCurrencyFull },
    { label: 'New Product Inbound Pipeline', getValue: (d) => d.newProductInboundPipelineCreated, fmt: formatCurrencyFull },
    { label: 'New Product Outbound Pipeline', getValue: (d) => d.newProductOutboundPipelineCreated, fmt: formatCurrencyFull },
    { label: 'HIS Required', getValue: (d) => d.hisRequired, fmt: formatNumber },
    { label: 'Inbound Closed Won', getValue: (d) => d.inboundClosedWon, fmt: formatCurrencyFull },
    { label: 'Inbound Deals', getValue: (d) => d.inboundDeals, fmt: formatNumber, isDeal: true },
    { label: 'Outbound Closed Won', getValue: (d) => d.outboundClosedWon, fmt: formatCurrencyFull },
    { label: 'Outbound Deals', getValue: (d) => d.outboundDeals, fmt: formatNumber, isDeal: true },
    { label: 'New Product Inbound Won', getValue: (d) => d.newProductInboundClosedWon, fmt: formatCurrencyFull },
    { label: 'NP Inbound Deals', getValue: (d) => d.newProductInboundDeals, fmt: formatNumber, isDeal: true },
    { label: 'New Product Outbound Won', getValue: (d) => d.newProductOutboundClosedWon, fmt: formatCurrencyFull },
    { label: 'NP Outbound Deals', getValue: (d) => d.newProductOutboundDeals, fmt: formatNumber, isDeal: true },
    { label: 'Expansion', getValue: (d) => d.expansionRevenue, fmt: formatCurrencyFull },
    { label: 'Expansion Customers', getValue: (d) => d.expansionRevenue / acv, fmt: formatNumber, isDeal: true },
    { label: 'Churn', getValue: (d) => d.churnRevenue, fmt: formatCurrencyFull, isChurn: true },
    { label: 'Churned Customers', getValue: (d) => d.churnRevenue / acv, fmt: formatNumber, isDeal: true, isChurn: true },
    { label: 'Total New ARR', getValue: (d) => d.totalNewARR, fmt: formatCurrencyFull, isHighlight: true },
  ];
}

function QuarterlyTable({ quarterly, startingARR, averageACV }: { quarterly: QuarterlyResult[]; startingARR: number; averageACV?: number }) {
  const rows = buildRows(averageACV ?? 0);
  // Add ending ARR as special final row
  const endingRow: RowDef = { label: 'Ending ARR', getValue: (d) => d.endingARR, fmt: formatCurrencyFull, isHighlight: true };

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-24">Start</th>
          {quarterly.map((q) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500 w-28">
              {q.quarter}
            </th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-28">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const total = quarterly.reduce((s, q) => s + row.getValue(q as unknown as Record<string, number>), 0);
          return (
            <tr
              key={row.label}
              className={`border-b border-gray-100 ${row.isHighlight ? 'bg-blue-50 font-semibold' : ''} ${row.isDeal ? 'bg-gray-50/50' : ''}`}
            >
              <td className={`py-1.5 px-3 ${row.isDeal ? 'text-gray-500 pl-6 italic' : 'text-gray-700'}`}>{row.label}</td>
              <td className="py-1.5 px-3 text-right text-gray-400">—</td>
              {quarterly.map((q) => (
                <td
                  key={q.quarter}
                  className={`py-1.5 px-3 text-right ${row.isChurn ? 'text-red-600' : row.isDeal ? 'text-gray-600' : 'text-gray-900'}`}
                >
                  {row.fmt(row.getValue(q as unknown as Record<string, number>))}
                </td>
              ))}
              <td className={`py-1.5 px-3 text-right font-medium ${row.isChurn ? 'text-red-600' : row.isDeal ? 'text-gray-600' : 'text-gray-900'}`}>
                {row.fmt(total)}
              </td>
            </tr>
          );
        })}
        {/* Ending ARR row */}
        <tr className="border-b border-gray-100 bg-blue-50 font-semibold">
          <td className="py-1.5 px-3 text-gray-700">{endingRow.label}</td>
          <td className="py-1.5 px-3 text-right text-gray-400">{formatCurrencyFull(startingARR)}</td>
          {quarterly.map((q) => (
            <td key={q.quarter} className="py-1.5 px-3 text-right text-gray-900">
              {formatCurrencyFull(q.endingARR)}
            </td>
          ))}
          <td className="py-1.5 px-3 text-right font-medium text-gray-900">
            {formatCurrencyFull(quarterly[3]?.endingARR ?? startingARR)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function MonthlyTable({ monthly, startingARR, averageACV }: { monthly: MonthlyResult[]; startingARR: number; averageACV?: number }) {
  const rows = buildRows(averageACV ?? 0);
  // Replace last few rows for monthly view naming
  const monthlyRows: RowDef[] = [
    ...rows.slice(0, -1).map((r) => {
      // Shorten labels for monthly view
      if (r.label === 'Inbound Pipeline Created') return { ...r, label: 'Inbound Pipeline' };
      if (r.label === 'Outbound Pipeline Created') return { ...r, label: 'Outbound Pipeline' };
      if (r.label === 'New Product Inbound Won') return { ...r, label: 'NP Inbound Won' };
      if (r.label === 'New Product Outbound Won') return { ...r, label: 'NP Outbound Won' };
      if (r.label === 'New Product Inbound Pipeline') return { ...r, label: 'NP Inbound Pipeline' };
      if (r.label === 'New Product Outbound Pipeline') return { ...r, label: 'NP Outbound Pipeline' };
      if (r.label === 'Total New ARR') return { ...r, label: 'Net New ARR' };
      return r;
    }),
    { label: 'Net New ARR', getValue: (d) => d.totalNewARR, fmt: formatCurrencyFull, isHighlight: true },
    { label: 'Cumulative ARR', getValue: (d) => d.cumulativeARR, fmt: formatCurrencyFull, isHighlight: true },
  ];

  // Deduplicate: remove the original "Net New ARR" that was kept from rows slice
  const seen = new Set<string>();
  const dedupedRows = monthlyRows.filter((r) => {
    if (seen.has(r.label)) return false;
    seen.add(r.label);
    return true;
  });

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-40">Metric</th>
          {monthly.map((m) => (
            <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]">
              {formatMonthName(m.month)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dedupedRows.map((row) => (
          <tr
            key={row.label}
            className={`border-b border-gray-100 ${row.isHighlight ? 'bg-blue-50 font-semibold' : ''} ${row.isDeal ? 'bg-gray-50/50' : ''}`}
          >
            <td className={`py-1.5 px-3 sticky left-0 bg-inherit ${row.isDeal ? 'text-gray-500 pl-6 italic' : 'text-gray-700'}`}>
              {row.label}
            </td>
            {monthly.map((m) => (
              <td
                key={m.month}
                className={`py-1.5 px-2 text-right ${row.isChurn ? 'text-red-600' : row.isDeal ? 'text-gray-600' : 'text-gray-900'}`}
              >
                {row.fmt(row.getValue(m as unknown as Record<string, number>))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
