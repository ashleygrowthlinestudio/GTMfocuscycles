'use client';

import React, { useState, useMemo } from 'react';
import type { QuarterlyResult, MonthlyResult, StrategicBet, RevenueBreakdown, BetMetric } from '@/lib/types';
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
  startingARR: number;
  bets?: StrategicBet[];
  sqTargets?: RevenueBreakdown;
  betsTargets?: RevenueBreakdown;
  planTargets?: RevenueBreakdown;
}

type ViewMode = 'quarterly' | 'monthly';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Row definition (mirrors RevenueTable) ──────────────────────

type TableRow = {
  label: string;
  monthlyLabel?: string;
  getMonthly: (m: MonthlyResult) => number;
  getQuarterly: (q: QuarterlyResult) => number;
  fmt: (v: number) => string;
  isSecondary?: boolean;
  isChurn?: boolean;
  isHighlight?: boolean;
  isClosedWon?: boolean;
  isPurple?: boolean;
  isConstant?: boolean;
  // Which bet metrics affect this row (for highlighting)
  betMetrics?: { metric: BetMetric; channel?: 'inbound' | 'outbound'; category?: string }[];
};

// Safe number helper — prevents NaN from propagating to display
const n = (v: number | undefined | null): number => (v != null && isFinite(v) ? v : 0);

const fmtSalesCycle = (v: number): string => `${n(v).toFixed(1)} mo`;

function buildComparisonRows(targets?: RevenueBreakdown): TableRow[] {
  const rows: TableRow[] = [];

  // ── Inbound ──
  rows.push({
    label: 'HIS Volume', getMonthly: (m) => n(m.hisRequired), getQuarterly: (q) => n(q.hisRequired), fmt: formatNumber,
    betMetrics: [{ metric: 'hisMonthly', channel: 'inbound', category: 'newBusiness' }],
  });
  if (targets) {
    const ib = targets.newBusiness.inbound;
    rows.push({
      label: 'HIS → Pipeline Rate', getMonthly: () => n(ib.hisToPipelineRate), getQuarterly: () => n(ib.hisToPipelineRate), fmt: formatPercent, isSecondary: true, isConstant: true,
      betMetrics: [{ metric: 'hisToPipelineRate', channel: 'inbound', category: 'newBusiness' }],
    });
  }
  rows.push({
    label: 'Inbound Qualified Pipeline $', monthlyLabel: 'IB Qual. Pipeline', getMonthly: (m) => n(m.inboundPipelineCreated), getQuarterly: (q) => n(q.inboundPipelineCreated), fmt: formatCurrencyFull,
    betMetrics: [{ metric: 'hisMonthly', channel: 'inbound', category: 'newBusiness' }, { metric: 'hisToPipelineRate', channel: 'inbound', category: 'newBusiness' }],
  });
  if (targets) {
    const ib = targets.newBusiness.inbound;
    rows.push(
      { label: 'IB Win Rate', getMonthly: () => n(ib.winRate), getQuarterly: () => n(ib.winRate), fmt: formatPercent, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'winRate', channel: 'inbound', category: 'newBusiness' }] },
      { label: 'IB ACV', getMonthly: () => n(ib.acv), getQuarterly: () => n(ib.acv), fmt: formatCurrencyFull, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'acv', channel: 'inbound', category: 'newBusiness' }] },
      { label: 'IB Sales Cycle', getMonthly: () => n(ib.salesCycleMonths), getQuarterly: () => n(ib.salesCycleMonths), fmt: fmtSalesCycle, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'salesCycleMonths', channel: 'inbound', category: 'newBusiness' }] },
    );
  }
  rows.push({
    label: 'Inbound Closed Won', getMonthly: (m) => n(m.inboundClosedWon), getQuarterly: (q) => n(q.inboundClosedWon), fmt: formatCurrencyFull, isClosedWon: true,
    betMetrics: [{ metric: 'winRate', channel: 'inbound', category: 'newBusiness' }, { metric: 'acv', channel: 'inbound', category: 'newBusiness' }],
  });
  rows.push({
    label: 'Inbound New Customers', getMonthly: (m) => n(m.inboundDeals), getQuarterly: (q) => q.months.reduce((s, m) => s + n(m.inboundDeals), 0), fmt: formatNumber,
  });

  // ── Outbound ──
  rows.push({
    label: 'Outbound Qualified Pipeline $', monthlyLabel: 'OB Qual. Pipeline', getMonthly: (m) => n(m.outboundPipelineCreated), getQuarterly: (q) => n(q.outboundPipelineCreated), fmt: formatCurrencyFull,
    betMetrics: [{ metric: 'pipelineMonthly', channel: 'outbound', category: 'newBusiness' }],
  });
  if (targets) {
    const ob = targets.newBusiness.outbound;
    rows.push(
      { label: 'OB Win Rate', getMonthly: () => n(ob.winRate), getQuarterly: () => n(ob.winRate), fmt: formatPercent, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'winRate', channel: 'outbound', category: 'newBusiness' }] },
      { label: 'OB ACV', getMonthly: () => n(ob.acv), getQuarterly: () => n(ob.acv), fmt: formatCurrencyFull, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'acv', channel: 'outbound', category: 'newBusiness' }] },
      { label: 'OB Sales Cycle', getMonthly: () => n(ob.salesCycleMonths), getQuarterly: () => n(ob.salesCycleMonths), fmt: fmtSalesCycle, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'salesCycleMonths', channel: 'outbound', category: 'newBusiness' }] },
    );
  }
  rows.push({
    label: 'Outbound Closed Won', getMonthly: (m) => n(m.outboundClosedWon), getQuarterly: (q) => n(q.outboundClosedWon), fmt: formatCurrencyFull, isClosedWon: true,
    betMetrics: [{ metric: 'winRate', channel: 'outbound', category: 'newBusiness' }, { metric: 'acv', channel: 'outbound', category: 'newBusiness' }],
  });
  rows.push({
    label: 'Outbound New Customers', getMonthly: (m) => n(m.outboundDeals), getQuarterly: (q) => q.months.reduce((s, m) => s + n(m.outboundDeals), 0), fmt: formatNumber,
  });

  // ── NP Inbound ──
  rows.push({ label: 'NP Inbound HIS Volume', monthlyLabel: 'NP IB HIS', getMonthly: (m) => n(m.newProductHisRequired), getQuarterly: (q) => n(q.newProductHisRequired), fmt: formatNumber });
  if (targets) {
    const npIb = targets.newProduct.inbound;
    rows.push({ label: 'NP IB HIS → Pipeline Rate', getMonthly: () => n(npIb.hisToPipelineRate), getQuarterly: () => n(npIb.hisToPipelineRate), fmt: formatPercent, isSecondary: true, isConstant: true });
  }
  rows.push({ label: 'NP Inbound Qual. Pipeline $', monthlyLabel: 'NP IB Pipeline', getMonthly: (m) => n(m.newProductInboundPipelineCreated), getQuarterly: (q) => n(q.newProductInboundPipelineCreated), fmt: formatCurrencyFull });
  if (targets) {
    const npIb = targets.newProduct.inbound;
    rows.push(
      { label: 'NP IB Win Rate', getMonthly: () => n(npIb.winRate), getQuarterly: () => n(npIb.winRate), fmt: formatPercent, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'winRate', channel: 'inbound', category: 'newProduct' }] },
      { label: 'NP IB ACV', getMonthly: () => n(npIb.acv), getQuarterly: () => n(npIb.acv), fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
      { label: 'NP IB Sales Cycle', getMonthly: () => n(npIb.salesCycleMonths), getQuarterly: () => n(npIb.salesCycleMonths), fmt: fmtSalesCycle, isSecondary: true, isConstant: true },
    );
  }
  rows.push({ label: 'NP Inbound Won', getMonthly: (m) => n(m.newProductInboundClosedWon), getQuarterly: (q) => n(q.newProductInboundClosedWon), fmt: formatCurrencyFull, isClosedWon: true });
  rows.push({ label: 'NP Inbound Customers', getMonthly: (m) => n(m.newProductInboundDeals), getQuarterly: (q) => q.months.reduce((s, m) => s + n(m.newProductInboundDeals), 0), fmt: formatNumber });

  // ── NP Outbound ──
  rows.push({ label: 'NP Outbound Qual. Pipeline $', monthlyLabel: 'NP OB Pipeline', getMonthly: (m) => n(m.newProductOutboundPipelineCreated), getQuarterly: (q) => n(q.newProductOutboundPipelineCreated), fmt: formatCurrencyFull });
  if (targets) {
    const npOb = targets.newProduct.outbound;
    rows.push(
      { label: 'NP OB Win Rate', getMonthly: () => n(npOb.winRate), getQuarterly: () => n(npOb.winRate), fmt: formatPercent, isSecondary: true, isConstant: true, betMetrics: [{ metric: 'winRate', channel: 'outbound', category: 'newProduct' }] },
      { label: 'NP OB ACV', getMonthly: () => n(npOb.acv), getQuarterly: () => n(npOb.acv), fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
      { label: 'NP OB Sales Cycle', getMonthly: () => n(npOb.salesCycleMonths), getQuarterly: () => n(npOb.salesCycleMonths), fmt: fmtSalesCycle, isSecondary: true, isConstant: true },
    );
  }
  rows.push({ label: 'NP Outbound Won', getMonthly: (m) => n(m.newProductOutboundClosedWon), getQuarterly: (q) => n(q.newProductOutboundClosedWon), fmt: formatCurrencyFull, isClosedWon: true });
  rows.push({ label: 'NP Outbound Customers', getMonthly: (m) => n(m.newProductOutboundDeals), getQuarterly: (q) => q.months.reduce((s, m) => s + n(m.newProductOutboundDeals), 0), fmt: formatNumber });

  // ── Expansion ──
  if (targets) {
    rows.push({
      label: 'Expansion Pipeline $', getMonthly: () => n(targets.expansion?.pipelineMonthly), getQuarterly: () => n(targets.expansion?.pipelineMonthly), fmt: formatCurrencyFull, isSecondary: true, isConstant: true,
      betMetrics: [{ metric: 'pipelineMonthly', category: 'expansion' }],
    });
  }
  rows.push({ label: 'Expansion Revenue', getMonthly: (m) => n(m.expansionRevenue), getQuarterly: (q) => n(q.expansionRevenue), fmt: formatCurrencyFull, isPurple: true, betMetrics: [{ metric: 'pipelineMonthly', category: 'expansion' }] });

  // ── Churn ──
  if (targets) {
    rows.push({
      label: 'Churn Rate', getMonthly: () => n(targets.churn?.monthlyChurnRate), getQuarterly: () => n(targets.churn?.monthlyChurnRate), fmt: formatPercent, isSecondary: true, isConstant: true, isChurn: true,
      betMetrics: [{ metric: 'monthlyChurnRate', category: 'churn' }],
    });
  }
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
      // Check category match
      if (bm.category && bm.category !== bet.category) return false;
      // Check channel match
      if (bm.channel && bet.channel && bm.channel !== bet.channel) return false;
      // If bet has no channel, it applies to both
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
  return `${bet.name}: ${from} → ${to} (starting ${startLabel}, ${bet.rampMonths ?? 3} months to full impact)`;
}

// ── Row label mapping for bet pills ─────────────────────────

function getRowLabelForBet(bet: StrategicBet): string {
  const ch = bet.channel === 'inbound' ? 'IB' : bet.channel === 'outbound' ? 'OB' : '';
  const cat = bet.category === 'newProduct' ? 'NP ' : '';
  const metricLabels: Record<string, string> = {
    winRate: `${cat}${ch} Win Rate`,
    salesCycleMonths: `${cat}${ch} Sales Cycle`,
    hisToPipelineRate: 'HIS → Pipeline Rate',
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
  sqTargets,
  betsTargets,
  planTargets,
}: BetComparisonTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');

  const sqEndARR = n(statusQuoMonthly[11]?.cumulativeARR);
  const betsEndARR = n(withBetsMonthly[11]?.cumulativeARR);

  const gapClosed = betsEndARR - sqEndARR;
  const totalGap = targetARR - sqEndARR;
  const percentClosed = totalGap > 0 ? Math.min(100, Math.max(0, (gapClosed / totalGap) * 100)) : (betsEndARR >= targetARR ? 100 : 0);

  const enabledBets = (bets || []).filter((b) => b.enabled);

  // Build 3 separate row arrays so secondary rows show per-scenario rates
  const sqRows = useMemo(() => buildComparisonRows(sqTargets), [sqTargets]);
  const betsRows = useMemo(() => buildComparisonRows(betsTargets), [betsTargets]);
  const targetRows = useMemo(() => buildComparisonRows(planTargets), [planTargets]);
  // Primary rows (for labels, betMetrics matching, and non-secondary getters)
  const rows = targetRows;

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

      {/* Progress bar — amber = SQ baseline, blue = incremental bet impact on top */}
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
            const impact = gapClosed;
            const perBet = enabledBets.length > 0 ? impact / enabledBets.length : 0;
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
                      const bgColor = rampPct === 0 ? 'bg-gray-100' : rampPct >= 1 ? 'bg-blue-100' : 'bg-blue-50';
                      const textColor = rampPct === 0 ? 'text-gray-400' : rampPct >= 1 ? 'text-blue-700' : 'text-blue-600';
                      return (
                        <td key={month} className={`py-2 px-1 text-center ${bgColor} ${textColor}`} title={`${MONTH_LABELS[i]}: ${formatBetValue(bet.metric, val)} (${rampDisplay}% ramped)`}>
                          <div className="text-[10px] font-medium">{formatBetValue(bet.metric, val)}</div>
                          <div className="h-1 mt-0.5 rounded-full bg-gray-200 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${rampDisplay}%` }} />
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
              sqRows={sqRows}
              betsRows={betsRows}
              targetRows={targetRows}
              enabledBets={enabledBets}
              startingARR={startingARR}
            />
          ) : (
            <FullMonthlyComparison
              sq={statusQuoMonthly}
              betsM={withBetsMonthly}
              target={targetMonthly}
              rows={rows}
              sqRows={sqRows}
              betsRows={betsRows}
              targetRows={targetRows}
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
  sq, betsQ, target, rows, sqRows, betsRows, targetRows, enabledBets, startingARR,
}: {
  sq: QuarterlyResult[]; betsQ: QuarterlyResult[]; target: QuarterlyResult[];
  rows: TableRow[]; sqRows: TableRow[]; betsRows: TableRow[]; targetRows: TableRow[];
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
          // Use per-scenario row for secondary/constant values
          const sqRow = sqRows[idx] ?? row;
          const betsRow = betsRows[idx] ?? row;
          const tgtRow = targetRows[idx] ?? row;

          return (
            <tr key={`${row.label}-${idx}`} className={`border-b border-gray-100 ${rowBgClass(row, hasBet)}`}>
              <td className={`${cellLabelClass(row)} sticky left-0 z-10 ${hasBet ? 'bg-yellow-50' : 'bg-inherit'}`}>
                {hasBet && (
                  <span className="cursor-help mr-1" title={matchingBets.map(betTooltip).join('\n')}>&#127919;</span>
                )}
                {row.label}
              </td>
              {[0, 1, 2, 3].map((qi) => {
                const sqVal = sqRow.getQuarterly(sq[qi]);
                const betsVal = betsRow.getQuarterly(betsQ[qi]);
                const targetVal = tgtRow.getQuarterly(target[qi]);
                const betsChanged = hasBet && sqVal !== betsVal;
                return (
                  <React.Fragment key={qi}>
                    <td className="py-1 px-1 text-right text-amber-700 border-l border-gray-100">{row.fmt(sqVal)}</td>
                    <td className={`py-1 px-1 text-right text-blue-700 ${betsChanged ? 'font-semibold bg-blue-50' : hasBet ? 'font-medium' : ''}`}>{row.fmt(betsVal)}</td>
                    <td className="py-1 px-1 text-right text-gray-500">{row.fmt(targetVal)}</td>
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
              <td className="py-1.5 px-1 text-right text-amber-700 border-l border-gray-100">{formatCurrencyFull(sq[qi]?.endingARR ?? 0)}</td>
              <td className="py-1.5 px-1 text-right text-blue-700 font-medium">{formatCurrencyFull(betsQ[qi]?.endingARR ?? 0)}</td>
              <td className="py-1.5 px-1 text-right text-gray-500">{formatCurrencyFull(target[qi]?.endingARR ?? 0)}</td>
            </React.Fragment>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

// ── Full Monthly Comparison ─────────────────────────────────

function FullMonthlyComparison({
  sq, betsM, target, rows, sqRows, betsRows, targetRows, enabledBets, startingARR,
}: {
  sq: MonthlyResult[]; betsM: MonthlyResult[]; target: MonthlyResult[];
  rows: TableRow[]; sqRows: TableRow[]; betsRows: TableRow[]; targetRows: TableRow[];
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
          const sqRow = sqRows[idx] ?? row;
          const betsRow = betsRows[idx] ?? row;
          const tgtRow = targetRows[idx] ?? row;

          return (
            <tr key={`${row.monthlyLabel || row.label}-${idx}`} className={`border-b border-gray-100 ${rowBgClass(row, hasBet)}`}>
              <td className={`${cellLabelClass(row)} sticky left-0 z-10 ${hasBet ? 'bg-yellow-50' : 'bg-inherit'}`}>
                {hasBet && (
                  <span className="cursor-help mr-1" title={matchingBets.map(betTooltip).join('\n')}>&#127919;</span>
                )}
                {row.monthlyLabel || row.label}
              </td>
              {Array.from({ length: 12 }, (_, i) => {
                const sqVal = sqRow.getMonthly(sq[i]);
                const betsVal = betsRow.getMonthly(betsM[i]);
                const targetVal = tgtRow.getMonthly(target[i]);
                const betsChanged = hasBet && sqVal !== betsVal;
                return (
                  <React.Fragment key={i}>
                    <td className="py-1 px-0.5 text-right text-amber-700 border-l border-gray-100 text-[10px]">{row.fmt(sqVal)}</td>
                    <td className={`py-1 px-0.5 text-right text-blue-700 text-[10px] ${betsChanged ? 'font-semibold bg-blue-50' : hasBet ? 'font-medium' : ''}`}>{row.fmt(betsVal)}</td>
                    <td className="py-1 px-0.5 text-right text-gray-500 text-[10px]">{row.fmt(targetVal)}</td>
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
              <td className="py-1 px-0.5 text-right text-amber-700 border-l border-gray-100 text-[10px]">{formatCurrencyFull(sq[i]?.cumulativeARR ?? 0)}</td>
              <td className="py-1 px-0.5 text-right text-blue-700 font-medium text-[10px]">{formatCurrencyFull(betsM[i]?.cumulativeARR ?? 0)}</td>
              <td className="py-1 px-0.5 text-right text-gray-500 text-[10px]">{formatCurrencyFull(target[i]?.cumulativeARR ?? 0)}</td>
            </React.Fragment>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
