'use client';

import React, { useState } from 'react';
import type { QuarterlyResult, MonthlyResult } from '@/lib/types';
import { formatCurrencyFull, formatNumber, formatMonthName } from '@/lib/format';

interface BetComparisonTableProps {
  statusQuoQuarterly: QuarterlyResult[];
  withBetsQuarterly: QuarterlyResult[];
  targetQuarterly: QuarterlyResult[];
  statusQuoMonthly: MonthlyResult[];
  withBetsMonthly: MonthlyResult[];
  targetMonthly: MonthlyResult[];
  targetARR: number;
}

type ViewMode = 'quarterly' | 'monthly';

interface ComparisonRow {
  label: string;
  statusQuo: number;
  withBets: number;
  target: number;
}

export default function BetComparisonTable({
  statusQuoQuarterly,
  withBetsQuarterly,
  targetQuarterly,
  statusQuoMonthly,
  withBetsMonthly,
  targetMonthly,
  targetARR,
}: BetComparisonTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');

  // Annual summary
  const sqEndARR = statusQuoMonthly[11]?.cumulativeARR ?? 0;
  const betsEndARR = withBetsMonthly[11]?.cumulativeARR ?? 0;
  const targetEndARR = targetMonthly[11]?.cumulativeARR ?? 0;

  const sqTotalNew = statusQuoMonthly.reduce((s, m) => s + m.totalNewARR, 0);
  const betsTotalNew = withBetsMonthly.reduce((s, m) => s + m.totalNewARR, 0);
  const targetTotalNew = targetMonthly.reduce((s, m) => s + m.totalNewARR, 0);

  const gapClosed = betsEndARR - sqEndARR;
  const totalGap = targetARR - sqEndARR;
  const percentClosed = totalGap > 0 ? Math.min(100, (gapClosed / totalGap) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* Impact summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-xs text-amber-600 font-medium uppercase">Status Quo</div>
          <div className="text-lg font-bold text-amber-800">{formatCurrencyFull(sqEndARR)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium uppercase">With Bets</div>
          <div className="text-lg font-bold text-blue-800">{formatCurrencyFull(betsEndARR)}</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-600 font-medium uppercase">Target</div>
          <div className="text-lg font-bold text-gray-800">{formatCurrencyFull(targetARR)}</div>
        </div>
        <div className={`rounded-lg p-3 border ${percentClosed >= 80 ? 'bg-green-50 border-green-200' : percentClosed >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`text-xs font-medium uppercase ${percentClosed >= 80 ? 'text-green-600' : percentClosed >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            Gap Closed
          </div>
          <div className={`text-lg font-bold ${percentClosed >= 80 ? 'text-green-800' : percentClosed >= 50 ? 'text-amber-800' : 'text-red-800'}`}>
            {percentClosed.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-100 rounded-full h-3 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-amber-400 rounded-full transition-all"
          style={{ width: `${Math.min(100, (sqEndARR / targetARR) * 100)}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
          style={{ width: `${Math.min(100, (betsEndARR / targetARR) * 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Status Quo: {formatCurrencyFull(sqEndARR)}</span>
        <span>With Bets: {formatCurrencyFull(betsEndARR)}</span>
        <span>Target: {formatCurrencyFull(targetARR)}</span>
      </div>

      {/* Detail table */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Three-Way Comparison</h3>
          <div className="flex gap-1 bg-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('quarterly')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                viewMode === 'quarterly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Quarterly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                viewMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'quarterly' ? (
            <QuarterlyComparison
              sq={statusQuoQuarterly}
              bets={withBetsQuarterly}
              target={targetQuarterly}
            />
          ) : (
            <MonthlyComparison
              sq={statusQuoMonthly}
              bets={withBetsMonthly}
              target={targetMonthly}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function QuarterlyComparison({
  sq, bets, target,
}: {
  sq: QuarterlyResult[];
  bets: QuarterlyResult[];
  target: QuarterlyResult[];
}) {
  const metrics: { label: string; key: keyof QuarterlyResult }[] = [
    { label: 'Total New ARR', key: 'totalNewARR' },
    { label: 'Ending ARR', key: 'endingARR' },
    { label: 'Inbound Won', key: 'inboundClosedWon' },
    { label: 'Outbound Won', key: 'outboundClosedWon' },
    { label: 'Expansion', key: 'expansionRevenue' },
    { label: 'Churn', key: 'churnRevenue' },
  ];

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-36">Metric</th>
          {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
            <th key={q} colSpan={3} className="text-center py-2 px-1 font-medium text-gray-500 border-l border-gray-200">
              {q}
            </th>
          ))}
        </tr>
        <tr className="border-b border-gray-200 bg-gray-50/50">
          <th className="py-1 px-3"></th>
          {[0, 1, 2, 3].map((qi) => (
            <React.Fragment key={qi}>
              <th className="py-1 px-1 text-center font-normal text-amber-600 border-l border-gray-200">SQ</th>
              <th className="py-1 px-1 text-center font-normal text-blue-600">Bets</th>
              <th className="py-1 px-1 text-center font-normal text-gray-600">Target</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {metrics.map((m) => (
          <tr key={m.key} className="border-b border-gray-100">
            <td className="py-1.5 px-3 text-gray-700 font-medium">{m.label}</td>
            {[0, 1, 2, 3].map((qi) => (
              <React.Fragment key={qi}>
                <td className="py-1.5 px-1 text-right text-amber-700 border-l border-gray-100">
                  {formatCurrencyFull(sq[qi]?.[m.key] as number ?? 0)}
                </td>
                <td className="py-1.5 px-1 text-right text-blue-700">
                  {formatCurrencyFull(bets[qi]?.[m.key] as number ?? 0)}
                </td>
                <td className="py-1.5 px-1 text-right text-gray-700">
                  {formatCurrencyFull(target[qi]?.[m.key] as number ?? 0)}
                </td>
              </React.Fragment>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonthlyComparison({
  sq, bets, target,
}: {
  sq: MonthlyResult[];
  bets: MonthlyResult[];
  target: MonthlyResult[];
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-20">Month</th>
          <th className="text-right py-2 px-2 font-medium text-amber-600" colSpan={1}>SQ ARR</th>
          <th className="text-right py-2 px-2 font-medium text-blue-600">Bets ARR</th>
          <th className="text-right py-2 px-2 font-medium text-gray-600">Target ARR</th>
          <th className="text-right py-2 px-2 font-medium text-amber-600">SQ New</th>
          <th className="text-right py-2 px-2 font-medium text-blue-600">Bets New</th>
          <th className="text-right py-2 px-2 font-medium text-gray-600">Target New</th>
        </tr>
      </thead>
      <tbody>
        {sq.map((_, i) => (
          <tr key={i} className="border-b border-gray-100">
            <td className="py-1.5 px-3 text-gray-700 font-medium sticky left-0 bg-white">
              {formatMonthName(sq[i].month)}
            </td>
            <td className="py-1.5 px-2 text-right text-amber-700">{formatCurrencyFull(sq[i].cumulativeARR)}</td>
            <td className="py-1.5 px-2 text-right text-blue-700">{formatCurrencyFull(bets[i].cumulativeARR)}</td>
            <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrencyFull(target[i].cumulativeARR)}</td>
            <td className="py-1.5 px-2 text-right text-amber-700">{formatCurrencyFull(sq[i].totalNewARR)}</td>
            <td className="py-1.5 px-2 text-right text-blue-700">{formatCurrencyFull(bets[i].totalNewARR)}</td>
            <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrencyFull(target[i].totalNewARR)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
