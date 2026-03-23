'use client';

import React, { useState, useMemo } from 'react';
import type { StrategicBet, BetMetric } from '@/lib/types';
import type { EngineMonthlyResult, EngineQuarterlyResult } from '@/lib/engine';
import { formatCurrencyFull, formatNumber, formatMonthName, formatPercent } from '@/lib/format';

interface BetComparisonTableProps {
  statusQuoQuarterly: EngineQuarterlyResult[];
  withBetsQuarterly: EngineQuarterlyResult[];
  targetQuarterly: EngineQuarterlyResult[] | null;
  statusQuoMonthly: EngineMonthlyResult[];
  withBetsMonthly: EngineMonthlyResult[];
  targetMonthly: EngineMonthlyResult[] | null;
  targetARR: number;
  startingARR: number;
  bets?: StrategicBet[];
  gapClosedPct: number;
}

type ViewMode = 'quarterly' | 'monthly';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Row definition ──────────────────────────────────────────────

type TableRow = {
  label: string;
  monthlyLabel?: string;
  getMonthly: (m: EngineMonthlyResult) => number;
  getQuarterly: (q: EngineQuarterlyResult) => number;
  fmt: (v: number) => string;
  isSecondary?: boolean;
  isChurn?: boolean;
  isHighlight?: boolean;
  isClosedWon?: boolean;
  isPurple?: boolean;
  isConstant?: boolean;
  betMetrics?: { metric: BetMetric; channel?: 'inbound' | 'outbound'; category?: string }[];
};

// Safe number helper — prevents NaN from propagating to display
const n = (v: number | undefined | null): number => (v != null && isFinite(v) ? v : 0);

const fmtSalesCycle = (v: number): string => `${n(v).toFixed(1)} mo`;

function buildComparisonRows(): TableRow[] {
  const rows: TableRow[] = [];

  // ── Inbound ──
  rows.push({
    label: 'HIS Volume', getMonthly: (m) => n(m.inboundHIS), getQuarterly: (q) => n(q.inboundHIS), fmt: formatNumber,
    betMetrics: [{ metric: 'hisMonthly', channel: 'inbound', category: 'newBusiness' }],
  });
  rows.push({
    label: 'HIS \u2192 Pipeline Rate', getMonthly: (m) => n(m.inboundHisToPipelineRate), getQuarterly: (q) => n(q.months[0].inboundHisToPipelineRate), fmt: formatPercent, isSecondary: true, isConstant: true,
    betMetrics: [{ metric: 'hisToPipelineRate', channel: 'inbound', category: 'newBusiness' }],
  });
  rows.push({
    label: 'Inbound Qualified Pipeline $', monthlyLabel: 'IB Qual. Pipeline', getMonthly: (m) => n(m.inboundPipelineCreated), getQuarterly: (q) => n(q.inboundPipelineCreated), fmt: formatCurrencyFull,
    betMetrics: [{ metric: 'hisMonthly', channel: 'inbound', category: 'newBusiness' }, { metric: 'hisToPipelineRate', channel: 'inbound', category: 'newBusiness' }],
  });
  rows.push(
    { label: 'IB Win Rate', getMonthly: (m) => n(m.inboundWinRate), getQuarterly: (q) => n(q.months[0].inboundWinRate), fmt: formatPercent, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'winRate', channel: 'inbound', category: 'newBusiness' }] },
    { label: 'IB ACV', getMonthly: (m) => n(m.inboundACV), getQuarterly: (q) => n(q.months[0].inboundACV), fmt: formatCurrencyFull, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'acv', channel: 'inbound', category: 'newBusiness' }] },
    { label: 'IB Sales Cycle', getMonthly: (m) => n(m.inboundSalesCycle), getQuarterly: (q) => n(q.months[0].inboundSalesCycle), fmt: fmtSalesCycle, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'salesCycleMonths', channel: 'inbound', category: 'newBusiness' }] },
  );
  rows.push({
    label: 'Inbound Closed Won', getMonthly: (m) => n(m.inboundClosedWon), getQuarterly: (q) => n(q.inboundClosedWon), fmt: formatCurrencyFull, isClosedWon: true,
    betMetrics: [{ metric: 'winRate', channel: 'inbound', category: 'newBusiness' }, { metric: 'acv', channel: 'inbound', category: 'newBusiness' }],
  });
  rows.push({
    label: 'Inbound New Customers', getMonthly: (m) => n(m.inboundDeals), getQuarterly: (q) => n(q.inboundDeals), fmt: formatNumber,
  });

  // ── Outbound ──
  rows.push({
    label: 'Outbound Qualified Pipeline $', monthlyLabel: 'OB Qual. Pipeline', getMonthly: (m) => n(m.outboundPipelineCreated), getQuarterly: (q) => n(q.outboundPipelineCreated), fmt: formatCurrencyFull,
    betMetrics: [{ metric: 'pipelineMonthly', channel: 'outbound', category: 'newBusiness' }],
  });
  rows.push(
    { label: 'OB Win Rate', getMonthly: (m) => n(m.outboundWinRate), getQuarterly: (q) => n(q.months[0].outboundWinRate), fmt: formatPercent, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'winRate', channel: 'outbound', category: 'newBusiness' }] },
    { label: 'OB ACV', getMonthly: (m) => n(m.outboundACV), getQuarterly: (q) => n(q.months[0].outboundACV), fmt: formatCurrencyFull, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'acv', channel: 'outbound', category: 'newBusiness' }] },
    { label: 'OB Sales Cycle', getMonthly: (m) => n(m.outboundSalesCycle), getQuarterly: (q) => n(q.months[0].outboundSalesCycle), fmt: fmtSalesCycle, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'salesCycleMonths', channel: 'outbound', category: 'newBusiness' }] },
  );
  rows.push({
    label: 'Outbound Closed Won', getMonthly: (m) => n(m.outboundClosedWon), getQuarterly: (q) => n(q.outboundClosedWon), fmt: formatCurrencyFull, isClosedWon: true,
    betMetrics: [{ metric: 'winRate', channel: 'outbound', category: 'newBusiness' }, { metric: 'acv', channel: 'outbound', category: 'newBusiness' }],
  });
  rows.push({
    label: 'Outbound New Customers', getMonthly: (m) => n(m.outboundDeals), getQuarterly: (q) => n(q.outboundDeals), fmt: formatNumber,
  });

  // ── NP Inbound ──
  rows.push({ label: 'NP Inbound Qual. Pipeline $', monthlyLabel: 'NP IB Pipeline', getMonthly: (m) => n(m.newProductPipelineCreated), getQuarterly: (q) => n(q.newProductPipelineCreated), fmt: formatCurrencyFull });
  rows.push(
    { label: 'NP IB Win Rate', getMonthly: (m) => n(m.newProductWinRate), getQuarterly: (q) => n(q.months[0].newProductWinRate), fmt: formatPercent, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'winRate', channel: 'inbound', category: 'newProduct' }] },
    { label: 'NP IB ACV', getMonthly: (m) => n(m.newProductACV), getQuarterly: (q) => n(q.months[0].newProductACV), fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
    { label: 'NP IB Sales Cycle', getMonthly: (m) => n(m.newProductSalesCycle), getQuarterly: (q) => n(q.months[0].newProductSalesCycle), fmt: fmtSalesCycle, isSecondary: true, isConstant: true },
  );
  rows.push({ label: 'NP Inbound Won', getMonthly: (m) => n(m.newProductClosedWon), getQuarterly: (q) => n(q.newProductClosedWon), fmt: formatCurrencyFull, isClosedWon: true });
  rows.push({ label: 'NP Inbound Customers', getMonthly: (m) => n(m.newProductDeals), getQuarterly: (q) => n(q.newProductDeals), fmt: formatNumber });

  // ── Expansion ──
  rows.push({
    label: 'Expansion Pipeline $', getMonthly: (m) => n(m.expansionPipelineCreated), getQuarterly: (q) => n(q.expansionPipelineCreated), fmt: formatCurrencyFull, isSecondary: true,
    betMetrics: [{ metric: 'pipelineMonthly', category: 'expansion' }],
  });
  rows.push({ label: 'Expansion Revenue', getMonthly: (m) => n(m.expansionRevenue), getQuarterly: (q) => n(q.expansionRevenue), fmt: formatCurrencyFull, isPurple: true, betMetrics: [{ metric: 'pipelineMonthly', category: 'expansion' }] });

  // ── Churn ──
  rows.push({ label: 'Churn Revenue', getMonthly: (m) => n(m.churnRevenue), getQuarterly: (q) => n(q.churnRevenue), fmt: formatCurrencyFull, isChurn: true, isPurple: true, betMetrics: [{ metric: 'monthlyChurnRate', category: 'churn' }] });

  // ── Totals ──
  rows.push({ label: 'Total New ARR', monthlyLabel: 'Net New ARR', getMonthly: (m) => n(m.totalNewARR), getQuarterly: (q) => n(q.totalNewARR), fmt: formatCurrencyFull, isHighlight: true });

  return rows;
}

// ── Bet-to-row matching ──────────────────────────────────────

function getBetsForRow(row: TableRow, enabledBets: StrategicBet[]): StrategicBet[] {
  if (!row.betMetrics || row.betMetrics.length === 0) return [];
  return enabledBets.filter((bet) =>
    row.betMetrics!.some((bm) => {
      if (bm.metric !== bet.metric) return false;
      if (bm.category && bm.category !== bet.category) return false;
      if (bm.channel && bet.channel && bm.channel !== bet.channel) return false;
      if (bm.channel && !bet.channel) return true;
      return true;
    }),
  );
}

function formatBetValue(metric: string, value: number): string {
  const v = n(value);
  if (['winRate', 'hisToPipelineRate', 'expansionRate', 'monthlyChurnRate'].includes(metric) || metric.endsWith('MixPct')) return formatPercent(v);
  if (['acv', 'pipelineMonthly'].includes(metric)) return formatCurrencyFull(v);
  if (metric === 'salesCycleMonths') return `${v.toFixed(1)} mo`;
  return v.toFixed(0);
}

function betTooltip(bet: StrategicBet): string {
  const from = formatBetValue(bet.metric, bet.currentValue);
  const to = formatBetValue(bet.metric, bet.improvedValue);
  const startLabel = MONTH_LABELS[(bet.startMonth ?? 1) - 1];
  return `${bet.name}: ${from} \u2192 ${to} (starting ${startLabel}, ${bet.rampMonths ?? 3} months to full impact)`;
}

function getRowLabelForBet(bet: StrategicBet): string {
  const ch = bet.channel === 'inbound' ? 'IB' : bet.channel === 'outbound' ? 'OB' : '';
  const cat = bet.category === 'newProduct' ? 'NP ' : '';
  const metricLabels: Record<string, string> = {
    winRate: `${cat}${ch} Win Rate`,
    salesCycleMonths: `${cat}${ch} Sales Cycle`,
    hisToPipelineRate: 'HIS \u2192 Pipeline Rate',
    hisMonthly: 'HIS Volume',
    pipelineMonthly: bet.category === 'expansion' ? 'Expansion Pipeline' : 'OB Qual. Pipeline',
    acv: `${cat}${ch} ACV`,
    monthlyChurnRate: 'Churn Rate',
  };
  return metricLabels[bet.metric] || bet.metric;
}

// ── Styling helpers ─────────────────────────────────────────

function rowBgClass(row: TableRow, hasBet: boolean): string {
  if (hasBet) return 'bg-yellow-50';
  if (row.isHighlight) return 'bg-blue-50 font-semibold';
  if (row.isClosedWon || row.isPurple) return 'bg-purple-50/50';
  return '';
}

function cellLabelClass(row: TableRow): string {
  if (row.isSecondary) return 'py-1 px-3 pl-6 text-gray-400 italic text-[11px]';
  if (row.isHighlight) return 'py-1.5 px-3 text-gray-700 font-semibold';
  if (row.isClosedWon || row.isPurple) return 'py-1.5 px-3 text-purple-900 font-medium';
  if (row.isChurn) return 'py-1.5 px-3 text-red-700';
  return 'py-1.5 px-3 text-gray-700';
}

// ── Safe display helper ─────────────────────────────────────

function safeDisplay(val: number | undefined | null, fmt: (v: number) => string): string {
  if (val === undefined || val === null || isNaN(val)) return '\u2014';
  return fmt(val);
}

// ── Main Component ──────────────────────────────────────────

export default function BetComparisonTable({
  statusQuoQuarterly,
  withBetsQuarterly,
  targetQuarterly,
  statusQuoMonthly,
  withBetsMonthly,
  targetMonthly,
  targetARR,
  startingARR,
  bets,
  gapClosedPct,
}: BetComparisonTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');

  const sqEndARR = n(statusQuoMonthly[11]?.cumulativeARR);
  const betsEndARR = n(withBetsMonthly[11]?.cumulativeARR);

  const gapClosed = betsEndARR - sqEndARR;
  const percentClosed = gapClosedPct;

  const enabledBets = (bets || []).filter((b) => b.enabled);

  const rows = useMemo(() => buildComparisonRows(), []);

  return (
    <div className="space-y-4">
      {/* Impact summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-xs text-amber-600 font-medium uppercase">Status Quo</div>
          <div className="text-lg font-bold text-amber-800">{formatCurrencyFull(sqEndARR)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium uppercase">With Bets</div>
          <div className="text-lg font-bold text-blue-800">{formatCurrencyFull(betsEndARR)}</div>
          {gapClosed !== 0 && (
            <div className={`text-xs font-medium mt-0.5 ${gapClosed > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {gapClosed > 0 ? '+' : ''}{formatCurrencyFull(Math.round(gapClosed))} vs SQ
            </div>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-600 font-medium uppercase">Target</div>
          <div className="text-lg font-bold text-gray-800">{formatCurrencyFull(targetARR)}</div>
        </div>
        <div className={`rounded-lg p-3 border ${percentClosed >= 80 ? 'bg-green-50 border-green-200' : percentClosed >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`text-xs font-medium uppercase ${percentClosed >= 80 ? 'text-green-600' : percentClosed >= 50 ? 'text-amber-600' : 'text-red-600'}`}>Gap Closed</div>
          <div className={`text-lg font-bold ${percentClosed >= 80 ? 'text-green-800' : percentClosed >= 50 ? 'text-amber-800' : 'text-red-800'}`}>{percentClosed.toFixed(0)}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-100 rounded-full h-3 relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all" style={{ width: `${targetARR > 0 ? Math.min(100, (betsEndARR / targetARR) * 100) : 0}%` }} />
        <div className="absolute inset-y-0 left-0 bg-amber-400 rounded-full transition-all" style={{ width: `${targetARR > 0 ? Math.min(100, (sqEndARR / targetARR) * 100) : 0}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Status Quo: {formatCurrencyFull(sqEndARR)}</span>
        <span>With Bets: {formatCurrencyFull(betsEndARR)}</span>
        <span>Target: {formatCurrencyFull(targetARR)}</span>
      </div>

      {/* Bet impact pills */}
      {enabledBets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {enabledBets.map((bet) => {
            const rowLabel = getRowLabelForBet(bet);
            const perBet = enabledBets.length > 0 ? gapClosed / enabledBets.length : 0;
            return (
              <div key={bet.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 border border-yellow-300 rounded-full text-xs" title={betTooltip(bet)}>
                <span className="text-yellow-600">&#127919;</span>
                <span className="font-medium text-gray-800">{bet.name}</span>
                <span className="text-gray-400">&#8594;</span>
                <span className="text-gray-500">{rowLabel}</span>
                <span className={`font-medium ${perBet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {perBet >= 0 ? '+' : ''}{formatCurrencyFull(Math.round(perBet))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Comparison Table */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Three-Way Comparison</h3>
          <div className="flex gap-1 bg-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('quarterly')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${viewMode === 'quarterly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
            >Quarterly</button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${viewMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
            >Monthly</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {viewMode === 'quarterly' ? (
            <FullQuarterlyComparison
              sq={statusQuoQuarterly}
              betsQ={withBetsQuarterly}
              target={targetQuarterly}
              rows={rows}
              enabledBets={enabledBets}
              startingARR={startingARR}
            />
          ) : (
            <FullMonthlyComparison
              sq={statusQuoMonthly}
              betsM={withBetsMonthly}
              target={targetMonthly}
              rows={rows}
              enabledBets={enabledBets}
              startingARR={startingARR}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Full Quarterly Comparison ───────────────────────────────

function FullQuarterlyComparison({
  sq, betsQ, target, rows, enabledBets, startingARR,
}: {
  sq: EngineQuarterlyResult[]; betsQ: EngineQuarterlyResult[]; target: EngineQuarterlyResult[] | null;
  rows: TableRow[];
  enabledBets: StrategicBet[]; startingARR: number;
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-44 sticky left-0 bg-gray-50 z-10">Metric</th>
          {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
            <th key={q} colSpan={3} className="text-center py-2 px-1 font-medium text-gray-500 border-l border-gray-200">{q}</th>
          ))}
        </tr>
        <tr className="border-b border-gray-200 bg-gray-50/50">
          <th className="py-1 px-3 sticky left-0 bg-gray-50/50 z-10"></th>
          {[0, 1, 2, 3].map((qi) => (
            <React.Fragment key={qi}>
              <th className="py-1 px-1 text-center font-normal text-[10px] text-amber-600 border-l border-gray-200">SQ</th>
              <th className="py-1 px-1 text-center font-normal text-[10px] text-blue-600">Bets</th>
              <th className="py-1 px-1 text-center font-normal text-[10px] text-gray-500">Target</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const matchingBets = getBetsForRow(row, enabledBets);
          const hasBet = matchingBets.length > 0;

          return (
            <tr key={`${row.label}-${idx}`} className={`border-b border-gray-100 ${rowBgClass(row, hasBet)}`}>
              <td className={`${cellLabelClass(row)} sticky left-0 z-10 ${hasBet ? 'bg-yellow-50' : 'bg-inherit'}`}>
                {hasBet && (
                  <span className="cursor-help mr-1" title={matchingBets.map(betTooltip).join('\n')}>&#127919;</span>
                )}
                {row.label}
              </td>
              {[0, 1, 2, 3].map((qi) => {
                const sqVal = n(row.getQuarterly(sq[qi]));
                const betsVal = n(row.getQuarterly(betsQ[qi]));
                const targetVal = target ? n(row.getQuarterly(target[qi])) : NaN;
                const betsChanged = hasBet && sqVal !== betsVal;
                return (
                  <React.Fragment key={qi}>
                    <td className="py-1 px-1 text-right text-amber-700 border-l border-gray-100">{row.fmt(sqVal)}</td>
                    <td className={`py-1 px-1 text-right text-blue-700 ${betsChanged ? 'font-semibold bg-blue-50' : hasBet ? 'font-medium' : ''}`}>{row.fmt(betsVal)}</td>
                    <td className="py-1 px-1 text-right text-gray-500">{safeDisplay(targetVal, row.fmt)}</td>
                  </React.Fragment>
                );
              })}
            </tr>
          );
        })}
        {/* Ending ARR row */}
        <tr className="border-b border-gray-100 bg-blue-50 font-semibold">
          <td className="py-1.5 px-3 text-gray-700 sticky left-0 bg-blue-50 z-10">Ending ARR</td>
          {[0, 1, 2, 3].map((qi) => (
            <React.Fragment key={qi}>
              <td className="py-1.5 px-1 text-right text-amber-700 border-l border-gray-100">{formatCurrencyFull(n(sq[qi]?.endingARR))}</td>
              <td className="py-1.5 px-1 text-right text-blue-700 font-medium">{formatCurrencyFull(n(betsQ[qi]?.endingARR))}</td>
              <td className="py-1.5 px-1 text-right text-gray-500">{target ? formatCurrencyFull(n(target[qi]?.endingARR)) : '\u2014'}</td>
            </React.Fragment>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

// ── Full Monthly Comparison ─────────────────────────────────

function FullMonthlyComparison({
  sq, betsM, target, rows, enabledBets, startingARR,
}: {
  sq: EngineMonthlyResult[]; betsM: EngineMonthlyResult[]; target: EngineMonthlyResult[] | null;
  rows: TableRow[];
  enabledBets: StrategicBet[]; startingARR: number;
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-44 sticky left-0 bg-gray-50 z-10">Metric</th>
          {MONTH_LABELS.map((m) => (
            <th key={m} colSpan={3} className="text-center py-2 px-1 font-medium text-gray-500 border-l border-gray-200 min-w-[90px]">{m}</th>
          ))}
        </tr>
        <tr className="border-b border-gray-200 bg-gray-50/50">
          <th className="py-1 px-3 sticky left-0 bg-gray-50/50 z-10"></th>
          {Array.from({ length: 12 }, (_, i) => (
            <React.Fragment key={i}>
              <th className="py-1 px-0.5 text-center font-normal text-[9px] text-amber-600 border-l border-gray-200">SQ</th>
              <th className="py-1 px-0.5 text-center font-normal text-[9px] text-blue-600">Bets</th>
              <th className="py-1 px-0.5 text-center font-normal text-[9px] text-gray-500">Tgt</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const matchingBets = getBetsForRow(row, enabledBets);
          const hasBet = matchingBets.length > 0;

          return (
            <tr key={`${row.monthlyLabel || row.label}-${idx}`} className={`border-b border-gray-100 ${rowBgClass(row, hasBet)}`}>
              <td className={`${cellLabelClass(row)} sticky left-0 z-10 ${hasBet ? 'bg-yellow-50' : 'bg-inherit'}`}>
                {hasBet && (
                  <span className="cursor-help mr-1" title={matchingBets.map(betTooltip).join('\n')}>&#127919;</span>
                )}
                {row.monthlyLabel || row.label}
              </td>
              {Array.from({ length: 12 }, (_, i) => {
                const sqVal = n(row.getMonthly(sq[i]));
                const betsVal = n(row.getMonthly(betsM[i]));
                const targetVal = target ? n(row.getMonthly(target[i])) : NaN;
                const betsChanged = hasBet && sqVal !== betsVal;
                return (
                  <React.Fragment key={i}>
                    <td className="py-1 px-0.5 text-right text-amber-700 border-l border-gray-100 text-[10px]">{row.fmt(sqVal)}</td>
                    <td className={`py-1 px-0.5 text-right text-blue-700 text-[10px] ${betsChanged ? 'font-semibold bg-blue-50' : hasBet ? 'font-medium' : ''}`}>{row.fmt(betsVal)}</td>
                    <td className="py-1 px-0.5 text-right text-gray-500 text-[10px]">{safeDisplay(targetVal, row.fmt)}</td>
                  </React.Fragment>
                );
              })}
            </tr>
          );
        })}
        {/* Cumulative ARR row */}
        <tr className="border-b border-gray-100 bg-blue-50 font-semibold">
          <td className="py-1.5 px-3 text-gray-700 sticky left-0 bg-blue-50 z-10">Ending ARR</td>
          {Array.from({ length: 12 }, (_, i) => (
            <React.Fragment key={i}>
              <td className="py-1 px-0.5 text-right text-amber-700 border-l border-gray-100 text-[10px]">{formatCurrencyFull(n(sq[i]?.cumulativeARR))}</td>
              <td className="py-1 px-0.5 text-right text-blue-700 font-medium text-[10px]">{formatCurrencyFull(n(betsM[i]?.cumulativeARR))}</td>
              <td className="py-1 px-0.5 text-right text-gray-500 text-[10px]">{target ? formatCurrencyFull(n(target[i]?.cumulativeARR)) : '\u2014'}</td>
            </React.Fragment>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
