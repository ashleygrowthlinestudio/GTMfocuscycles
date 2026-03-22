'use client';

import React, { useState } from 'react';
import type { MonthlyResult, QuarterlyResult } from '@/lib/types';
import { formatCurrencyFull, formatNumber, formatMonthName } from '@/lib/format';

interface RevenueTableProps {
  monthly: MonthlyResult[];
  quarterly: QuarterlyResult[];
  startingARR: number;
  label?: string;
}

type ViewMode = 'quarterly' | 'monthly';

export default function RevenueTable({ monthly, quarterly, startingARR, label }: RevenueTableProps) {
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
          <QuarterlyTable quarterly={quarterly} startingARR={startingARR} />
        ) : (
          <MonthlyTable monthly={monthly} startingARR={startingARR} />
        )}
      </div>
    </div>
  );
}

function QuarterlyTable({ quarterly, startingARR }: { quarterly: QuarterlyResult[]; startingARR: number }) {
  const rows = [
    { label: 'Inbound Pipeline Created', key: 'inboundPipelineCreated' as const, fmt: formatCurrencyFull },
    { label: 'Outbound Pipeline Created', key: 'outboundPipelineCreated' as const, fmt: formatCurrencyFull },
    { label: 'New Product Inbound Pipeline', key: 'newProductInboundPipelineCreated' as const, fmt: formatCurrencyFull },
    { label: 'New Product Outbound Pipeline', key: 'newProductOutboundPipelineCreated' as const, fmt: formatCurrencyFull },
    { label: 'HIS Required', key: 'hisRequired' as const, fmt: formatNumber },
    { label: 'Inbound Closed Won', key: 'inboundClosedWon' as const, fmt: formatCurrencyFull },
    { label: 'Outbound Closed Won', key: 'outboundClosedWon' as const, fmt: formatCurrencyFull },
    { label: 'New Product Inbound Won', key: 'newProductInboundClosedWon' as const, fmt: formatCurrencyFull },
    { label: 'New Product Outbound Won', key: 'newProductOutboundClosedWon' as const, fmt: formatCurrencyFull },
    { label: 'Expansion', key: 'expansionRevenue' as const, fmt: formatCurrencyFull },
    { label: 'Churn', key: 'churnRevenue' as const, fmt: formatCurrencyFull },
    { label: 'Total New ARR', key: 'totalNewARR' as const, fmt: formatCurrencyFull },
    { label: 'Ending ARR', key: 'endingARR' as const, fmt: formatCurrencyFull },
  ];

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
          const isHighlight = row.key === 'totalNewARR' || row.key === 'endingARR';
          const isChurn = row.key === 'churnRevenue';
          const total = quarterly.reduce((s, q) => s + (q[row.key] as number), 0);

          return (
            <tr
              key={row.key}
              className={`border-b border-gray-100 ${isHighlight ? 'bg-blue-50 font-semibold' : ''}`}
            >
              <td className="py-1.5 px-3 text-gray-700">{row.label}</td>
              <td className="py-1.5 px-3 text-right text-gray-400">
                {row.key === 'endingARR' ? formatCurrencyFull(startingARR) : '—'}
              </td>
              {quarterly.map((q) => (
                <td
                  key={q.quarter}
                  className={`py-1.5 px-3 text-right ${isChurn ? 'text-red-600' : 'text-gray-900'}`}
                >
                  {row.fmt(q[row.key] as number)}
                </td>
              ))}
              <td className={`py-1.5 px-3 text-right font-medium ${isChurn ? 'text-red-600' : 'text-gray-900'}`}>
                {row.key === 'endingARR'
                  ? formatCurrencyFull(quarterly[3]?.endingARR ?? startingARR)
                  : row.fmt(total)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MonthlyTable({ monthly, startingARR }: { monthly: MonthlyResult[]; startingARR: number }) {
  const rows = [
    { label: 'Inbound Pipeline', key: 'inboundPipelineCreated' as const, fmt: formatCurrencyFull },
    { label: 'Outbound Pipeline', key: 'outboundPipelineCreated' as const, fmt: formatCurrencyFull },
    { label: 'HIS Required', key: 'hisRequired' as const, fmt: formatNumber },
    { label: 'Inbound Closed Won', key: 'inboundClosedWon' as const, fmt: formatCurrencyFull },
    { label: 'Outbound Closed Won', key: 'outboundClosedWon' as const, fmt: formatCurrencyFull },
    { label: 'NP Inbound Won', key: 'newProductInboundClosedWon' as const, fmt: formatCurrencyFull },
    { label: 'NP Outbound Won', key: 'newProductOutboundClosedWon' as const, fmt: formatCurrencyFull },
    { label: 'Expansion', key: 'expansionRevenue' as const, fmt: formatCurrencyFull },
    { label: 'Churn', key: 'churnRevenue' as const, fmt: formatCurrencyFull },
    { label: 'Net New ARR', key: 'totalNewARR' as const, fmt: formatCurrencyFull },
    { label: 'Cumulative ARR', key: 'cumulativeARR' as const, fmt: formatCurrencyFull },
  ];

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
        {rows.map((row) => {
          const isHighlight = row.key === 'totalNewARR' || row.key === 'cumulativeARR';
          const isChurn = row.key === 'churnRevenue';
          return (
            <tr
              key={row.key}
              className={`border-b border-gray-100 ${isHighlight ? 'bg-blue-50 font-semibold' : ''}`}
            >
              <td className="py-1.5 px-3 text-gray-700 sticky left-0 bg-inherit">{row.label}</td>
              {monthly.map((m) => (
                <td
                  key={m.month}
                  className={`py-1.5 px-2 text-right ${isChurn ? 'text-red-600' : 'text-gray-900'}`}
                >
                  {row.fmt(m[row.key] as number)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
