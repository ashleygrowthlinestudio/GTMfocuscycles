'use client';

import React, { useState } from 'react';
import type { QuarterlyResult, MonthlyResult, StrategicBet } from '@/lib/types';
import { getBetValueForMonth, getBetRampPct } from '@/lib/engine';
import { formatCurrencyFull, formatNumber, formatMonthName, formatPercent } from '@/lib/format';

interface BetComparisonTableProps {
  statusQuoQuarterly: QuarterlyResult[];
  withBetsQuarterly: QuarterlyResult[];
  targetQuarterly: QuarterlyResult[];
  statusQuoMonthly: MonthlyResult[];
  withBetsMonthly: MonthlyResult[];
  targetMonthly: MonthlyResult[];
  targetARR: number;
  bets?: StrategicBet[];
}

type ViewMode = 'quarterly' | 'monthly';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isMixMetric(metric: string): boolean {
  return metric.endsWith('MixPct');
}

function isPercentMetric(metric: string): boolean {
  return ['winRate', 'hisToPipelineRate', 'expansionRate', 'monthlyChurnRate'].includes(metric);
}

function formatBetValue(metric: string, value: number): string {
  if (isMixMetric(metric) || isPercentMetric(metric)) return formatPercent(value);
  if (['acv', 'pipelineMonthly'].includes(metric)) return formatCurrencyFull(value);
  if (metric === 'salesCycleMonths') return `${value.toFixed(1)} mo`;
  return value.toFixed(0);
}

export default function BetComparisonTable({
  statusQuoQuarterly,
  withBetsQuarterly,
  targetQuarterly,
  statusQuoMonthly,
  withBetsMonthly,
  targetMonthly,
  targetARR,
  bets,
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

  const enabledBets = (bets || []).filter((b) => b.enabled);

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

      {/* Ramp Timelines per bet */}
      {enabledBets.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Bet Ramp Timelines</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-500 w-36">Bet</th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="text-center py-2 px-1 font-medium text-gray-500 min-w-[52px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enabledBets.map((bet) => (
                  <tr key={bet.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-gray-700 font-medium">{bet.name}</td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      const rampPct = getBetRampPct(bet, month);
                      const val = getBetValueForMonth(bet, month);
                      const rampDisplay = Math.round(rampPct * 100);

                      let bgColor: string;
                      let textColor: string;
                      if (rampPct === 0) {
                        bgColor = 'bg-gray-100';
                        textColor = 'text-gray-400';
                      } else if (rampPct >= 1) {
                        bgColor = 'bg-blue-100';
                        textColor = 'text-blue-700';
                      } else {
                        bgColor = 'bg-blue-50';
                        textColor = 'text-blue-600';
                      }

                      return (
                        <td
                          key={month}
                          className={`py-2 px-1 text-center ${bgColor} ${textColor}`}
                          title={`${MONTH_LABELS[i]}: ${formatBetValue(bet.metric, val)} (${rampDisplay}% ramped)`}
                        >
                          <div className="text-[10px] font-medium">{formatBetValue(bet.metric, val)}</div>
                          <div className="h-1 mt-0.5 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${rampDisplay}%` }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
