'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, applyChannelConfig } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatPercent, formatNumber, formatMonthName } from '@/lib/format';
import type { RevenueBreakdown, MonthlyResult, QuarterlyResult, Month } from '@/lib/types';

type ViewMode = 'quarterly' | 'monthly';
type MetricType = 'currency' | 'percent' | 'count';

// ── Row type definitions ──────────────────────────────────────

type TableRow = {
  label: string;
  monthlyLabel?: string;
  getMonthly: (m: MonthlyResult) => number;
  getQuarterly: (q: QuarterlyResult) => number;
  fmt: (v: number) => string;
  metricType: MetricType;
  isSecondary?: boolean;
  isChurn?: boolean;
  isHighlight?: boolean;
  isClosedWon?: boolean;
  isPurple?: boolean;
  isConstant?: boolean;
};

function buildRows(
  breakdown: RevenueBreakdown,
  cc: { hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean },
): TableRow[] {
  const rows: TableRow[] = [];
  const ib = breakdown.newBusiness.inbound;
  const ob = breakdown.newBusiness.outbound;
  const npIb = breakdown.newProduct.inbound;

  if (cc.hasInbound) {
    rows.push({ label: 'HIS Volume', getMonthly: (m) => m.hisRequired, getQuarterly: (q) => q.hisRequired, fmt: formatNumber, metricType: 'count' });
    rows.push({ label: 'HIS → Pipeline Rate', getMonthly: () => ib.hisToPipelineRate, getQuarterly: () => ib.hisToPipelineRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'Inbound Qualified Pipeline $', monthlyLabel: 'IB Qualified Pipeline', getMonthly: (m) => m.inboundPipelineCreated, getQuarterly: (q) => q.inboundPipelineCreated, fmt: formatCurrencyFull, metricType: 'currency' });
    rows.push({ label: 'Win Rate', getMonthly: () => ib.winRate, getQuarterly: () => ib.winRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'ACV', getMonthly: () => ib.acv, getQuarterly: () => ib.acv, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Sales Cycle', getMonthly: () => ib.salesCycleMonths, getQuarterly: () => ib.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, metricType: 'count', isSecondary: true, isConstant: true });
    rows.push({ label: 'Inbound Closed Won', getMonthly: (m) => m.inboundClosedWon, getQuarterly: (q) => q.inboundClosedWon, fmt: formatCurrencyFull, metricType: 'currency', isClosedWon: true });
    rows.push({ label: 'Inbound New Customers', getMonthly: (m) => m.inboundDeals, getQuarterly: (q) => q.months.reduce((s, m2) => s + m2.inboundDeals, 0), fmt: formatNumber, metricType: 'count' });
  }

  if (cc.hasOutbound) {
    rows.push({ label: 'Outbound Qualified Pipeline $', monthlyLabel: 'OB Qualified Pipeline', getMonthly: (m) => m.outboundPipelineCreated, getQuarterly: (q) => q.outboundPipelineCreated, fmt: formatCurrencyFull, metricType: 'currency' });
    rows.push({ label: 'Win Rate', getMonthly: () => ob.winRate, getQuarterly: () => ob.winRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'ACV', getMonthly: () => ob.acv, getQuarterly: () => ob.acv, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Sales Cycle', getMonthly: () => ob.salesCycleMonths, getQuarterly: () => ob.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, metricType: 'count', isSecondary: true, isConstant: true });
    rows.push({ label: 'Outbound Closed Won', getMonthly: (m) => m.outboundClosedWon, getQuarterly: (q) => q.outboundClosedWon, fmt: formatCurrencyFull, metricType: 'currency', isClosedWon: true });
    rows.push({ label: 'Outbound New Customers', getMonthly: (m) => m.outboundDeals, getQuarterly: (q) => q.months.reduce((s, m2) => s + m2.outboundDeals, 0), fmt: formatNumber, metricType: 'count' });
  }

  if (cc.hasNewProduct) {
    rows.push({ label: 'NP Inbound Qualified Pipeline $', monthlyLabel: 'NP IB Qual. Pipeline', getMonthly: (m) => m.newProductInboundPipelineCreated, getQuarterly: (q) => q.newProductInboundPipelineCreated, fmt: formatCurrencyFull, metricType: 'currency' });
    rows.push({ label: 'Win Rate', getMonthly: () => npIb.winRate, getQuarterly: () => npIb.winRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'ACV', getMonthly: () => npIb.acv, getQuarterly: () => npIb.acv, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Sales Cycle', getMonthly: () => npIb.salesCycleMonths, getQuarterly: () => npIb.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, metricType: 'count', isSecondary: true, isConstant: true });
    rows.push({ label: 'New Product Inbound Won', monthlyLabel: 'NP Inbound Won', getMonthly: (m) => m.newProductInboundClosedWon, getQuarterly: (q) => q.newProductInboundClosedWon, fmt: formatCurrencyFull, metricType: 'currency', isClosedWon: true });
    rows.push({ label: 'New Product Inbound Customers', monthlyLabel: 'NP Inbound Customers', getMonthly: (m) => m.newProductInboundDeals, getQuarterly: (q) => q.months.reduce((s, m2) => s + m2.newProductInboundDeals, 0), fmt: formatNumber, metricType: 'count' });
  }

  if (cc.hasExpansion) {
    rows.push({ label: 'Expansion Pipeline $', getMonthly: () => breakdown.expansion.pipelineMonthly, getQuarterly: () => breakdown.expansion.pipelineMonthly, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Expansion Win Rate', getMonthly: () => breakdown.expansion.winRate, getQuarterly: () => breakdown.expansion.winRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'Expansion ACV', getMonthly: () => breakdown.expansion.acv, getQuarterly: () => breakdown.expansion.acv, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Expansion Sales Cycle', getMonthly: () => breakdown.expansion.salesCycleMonths, getQuarterly: () => breakdown.expansion.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, metricType: 'count', isSecondary: true, isConstant: true });
    rows.push({ label: 'Expansion Revenue', getMonthly: (m) => m.expansionRevenue, getQuarterly: (q) => q.expansionRevenue, fmt: formatCurrencyFull, metricType: 'currency', isPurple: true });
  }

  if (cc.hasChurn) {
    rows.push({ label: 'Churn Rate', getMonthly: () => breakdown.churn.monthlyChurnRate, getQuarterly: () => breakdown.churn.monthlyChurnRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true, isChurn: true });
    rows.push({ label: 'Churn Revenue', getMonthly: (m) => m.churnRevenue, getQuarterly: (q) => q.churnRevenue, fmt: formatCurrencyFull, metricType: 'currency', isChurn: true, isPurple: true });
  }

  rows.push({ label: 'Total New ARR', monthlyLabel: 'Net New ARR', getMonthly: (m) => m.totalNewARR, getQuarterly: (q) => q.totalNewARR, fmt: formatCurrencyFull, metricType: 'currency', isHighlight: true });

  return rows;
}

// ── Delta formatting ──────────────────────────────────────────

function formatDelta(planVal: number, sqVal: number, fmt: (v: number) => string, metricType: MetricType): { text: string; color: string } {
  const delta = planVal - sqVal;
  const absDelta = Math.abs(delta);
  const base = Math.abs(sqVal);

  // Within 5% of status quo value (or both zero)
  if ((base > 0 && absDelta / base < 0.05) || (base === 0 && absDelta === 0)) {
    return { text: '≈ On Par', color: 'text-green-600' };
  }

  const sign = delta > 0 ? '+' : '-';
  const arrow = delta > 0 ? ' ↑' : ' ↓';
  const color = delta > 0 ? 'text-green-600' : 'text-red-500';

  let formatted: string;
  if (metricType === 'percent') {
    // Show delta as percentage points
    const pts = Math.abs(delta * 100);
    formatted = `${sign}${pts.toFixed(1)}%`;
  } else {
    formatted = `${sign}${fmt(absDelta)}`;
  }

  return { text: `${formatted}${arrow}`, color };
}

// ── Styling helpers (match RevenueTable exactly) ─────────────

function rowBgClass(row: TableRow): string {
  if (row.isHighlight) return 'bg-blue-50';
  if (row.isClosedWon || row.isPurple) return 'bg-purple-50';
  return '';
}

function cellLabelClass(row: TableRow): string {
  if (row.isSecondary) return 'py-1 px-3 pl-6 text-gray-400 italic text-[11px]';
  if (row.isHighlight) return 'py-1.5 px-3 text-gray-700 font-semibold';
  if (row.isClosedWon || row.isPurple) return 'py-1.5 px-3 text-purple-900 font-semibold';
  if (row.isChurn) return 'py-1.5 px-3 text-red-700';
  return 'py-1.5 px-3 text-gray-700';
}

// ── ACT/PLAN badges ──────────────────────────────────────────

function ActBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-green-100 text-green-700 leading-none align-middle">ACT</span>;
}

function PlanBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 leading-none align-middle">PLAN</span>;
}

// ── Quarter status helpers ──────────────────────────────────

type QuarterStatus = 'all-actual' | 'mixed' | 'all-projected';

function getQuarterStatus(quarter: string, cm: number): QuarterStatus {
  const quarterMonths: Record<string, number[]> = {
    Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12],
  };
  const months = quarterMonths[quarter] || [];
  const actualCount = months.filter((m) => m < cm).length;
  if (actualCount === 3) return 'all-actual';
  if (actualCount === 0) return 'all-projected';
  return 'mixed';
}

// ── Main component ───────────────────────────────────────────

export default function GapAnalysis() {
  const { plan } = useGTMPlan();
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');
  const cc = plan.channelConfig;
  const isInYear = plan.planningMode === 'in-year';
  const cm = plan.currentMonth ?? 1;

  // Plan model (target projections)
  const effectiveTargets = useMemo(
    () => applyChannelConfig(plan.targets, cc, 'targets'),
    [plan.targets, cc],
  );
  const planModel = useMemo(
    () => runModel(effectiveTargets, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline),
    [effectiveTargets, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline],
  );

  // Status Quo model (historical trend projection)
  const flatSeasonality = useMemo(() => ({
    monthly: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, 1.0]),
    ) as Record<number, number>,
  }), []);
  const noRamp = useMemo(() => ({ rampMonths: 1, startMonth: 1 as const }), []);

  const effectiveHistorical = useMemo(
    () => applyChannelConfig(plan.historical, cc, 'historical'),
    [plan.historical, cc],
  );
  const sqModel = useMemo(
    () => runModel(effectiveHistorical, flatSeasonality, noRamp, plan.startingARR, plan.existingPipeline),
    [effectiveHistorical, flatSeasonality, noRamp, plan.startingARR, plan.existingPipeline],
  );

  // Build rows for Plan and Status Quo (separate closures for secondary/constant rows)
  const channelFlags = useMemo(() => ({
    hasInbound: cc.hasInbound || cc.hasInboundHistory,
    hasOutbound: cc.hasOutbound || cc.hasOutboundHistory,
    hasExpansion: cc.hasExpansion,
    hasChurn: cc.hasChurn,
    hasNewProduct: cc.hasNewProduct || cc.hasNewProductHistory,
  }), [cc]);

  const planRows = useMemo(() => buildRows(effectiveTargets, channelFlags), [effectiveTargets, channelFlags]);
  const sqRows = useMemo(() => buildRows(effectiveHistorical, channelFlags), [effectiveHistorical, channelFlags]);

  const planARR = planModel.endingARR;
  const sqARR = sqModel.endingARR;
  const gapToClose = planARR - sqARR;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Plan ARR</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{formatCurrency(planARR)}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Status Quo ARR</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{formatCurrency(sqARR)}</div>
        </div>
        <div className={`rounded-lg p-4 border ${gapToClose > 0 ? 'bg-green-50 border-green-200' : gapToClose < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`text-xs font-medium uppercase tracking-wide ${gapToClose > 0 ? 'text-green-600' : gapToClose < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            Gap to Close
          </div>
          <div className={`text-2xl font-bold mt-1 ${gapToClose > 0 ? 'text-green-800' : gapToClose < 0 ? 'text-red-800' : 'text-gray-800'}`}>
            {gapToClose > 0 ? '+' : ''}{formatCurrency(gapToClose)}
            <span className="text-sm font-normal ml-1">
              {gapToClose > 0 ? 'plan above SQ' : gapToClose < 0 ? 'plan below SQ' : 'on par'}
            </span>
          </div>
        </div>
      </div>

      {/* Emerging channels note */}
      {(cc.hasEmergingInbound || cc.hasEmergingOutbound || cc.hasEmergingNewProduct) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-amber-600 text-xs">✦</span>
          <span className="text-xs text-amber-700">
            Emerging channels have no historical baseline — Status Quo shows $0 for these channels. Gap analysis reflects targets only.
          </span>
        </div>
      )}

      {/* Gap spreadsheet */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-700">Gap Analysis — Plan vs Status Quo</h3>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Plan</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Status Quo</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span> Delta</span>
            </div>
          </div>
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
            <QuarterlyGapView
              planQuarterly={planModel.quarterly}
              sqQuarterly={sqModel.quarterly}
              planRows={planRows}
              sqRows={sqRows}
              startingARR={plan.startingARR}
              isInYear={isInYear}
              cm={cm}
            />
          ) : (
            <MonthlyGapView
              planMonthly={planModel.monthly}
              sqMonthly={sqModel.monthly}
              planRows={planRows}
              sqRows={sqRows}
              startingARR={plan.startingARR}
              isInYear={isInYear}
              cm={cm}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Quarterly Gap View ───────────────────────────────────────

function QuarterlyGapView({ planQuarterly, sqQuarterly, planRows, sqRows, startingARR, isInYear, cm }: {
  planQuarterly: QuarterlyResult[];
  sqQuarterly: QuarterlyResult[];
  planRows: TableRow[];
  sqRows: TableRow[];
  startingARR: number;
  isInYear?: boolean;
  cm: number;
}) {
  const quarterStatuses = useMemo(
    () => planQuarterly.map((q) => getQuarterStatus(q.quarter, cm)),
    [planQuarterly, cm],
  );

  function quarterBadges(qi: number) {
    if (!isInYear) return null;
    const status = quarterStatuses[qi];
    return (
      <span>
        {status !== 'all-projected' && <ActBadge />}
        {status !== 'all-actual' && <PlanBadge />}
      </span>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-24">Start</th>
          {planQuarterly.map((q, qi) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500 w-28">
              {q.quarter}{quarterBadges(qi)}
            </th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-28">Total</th>
        </tr>
      </thead>
      <tbody>
        {planRows.map((row, idx) => {
          const sqRow = sqRows[idx];
          const planVals = planQuarterly.map((q) => row.getQuarterly(q));
          const sqVals = sqQuarterly.map((q) => sqRow.getQuarterly(q));
          const planTotal = row.isConstant ? planVals[0] : planVals.reduce((s, v) => s + v, 0);
          const sqTotal = row.isConstant ? sqVals[0] : sqVals.reduce((s, v) => s + v, 0);

          return (
            <React.Fragment key={`${row.label}-${idx}`}>
              {/* Metric label row */}
              <tr className={`border-b border-gray-100 ${rowBgClass(row)}`}>
                <td className={cellLabelClass(row)} rowSpan={3}>{row.label}</td>
                {/* Plan sub-row */}
                <td className="py-1 px-3 text-right text-gray-400 text-[10px]">
                  <span className="text-blue-500 font-medium">Plan</span>
                </td>
                {planVals.map((val, qi) => (
                  <td key={`plan-${qi}`} className="py-1 px-3 text-right text-blue-700">
                    {row.fmt(val)}
                  </td>
                ))}
                <td className="py-1 px-3 text-right text-blue-700 font-medium">
                  {row.fmt(planTotal)}
                </td>
              </tr>
              {/* Status Quo sub-row */}
              <tr className={`border-b border-gray-50 ${rowBgClass(row)}`}>
                <td className="py-1 px-3 text-right text-[10px]">
                  <span className="text-amber-600 font-medium">SQ</span>
                </td>
                {sqVals.map((val, qi) => (
                  <td key={`sq-${qi}`} className="py-1 px-3 text-right text-amber-700">
                    {sqRow.fmt(val)}
                  </td>
                ))}
                <td className="py-1 px-3 text-right text-amber-700 font-medium">
                  {sqRow.fmt(sqTotal)}
                </td>
              </tr>
              {/* Delta sub-row */}
              <tr className={`border-b border-gray-200 ${rowBgClass(row)}`}>
                <td className="py-1 px-3 text-right text-[10px]">
                  <span className="text-gray-400 font-medium">Δ</span>
                </td>
                {planVals.map((pVal, qi) => {
                  const d = formatDelta(pVal, sqVals[qi], row.fmt, row.metricType);
                  return (
                    <td key={`delta-${qi}`} className={`py-1 px-3 text-right text-[11px] font-medium ${d.color}`}>
                      {d.text}
                    </td>
                  );
                })}
                {(() => {
                  const d = formatDelta(planTotal, sqTotal, row.fmt, row.metricType);
                  return (
                    <td className={`py-1 px-3 text-right text-[11px] font-medium ${d.color}`}>
                      {d.text}
                    </td>
                  );
                })()}
              </tr>
            </React.Fragment>
          );
        })}
        {/* Ending ARR row group */}
        <React.Fragment>
          <tr className="border-b border-gray-100 bg-blue-50 font-semibold">
            <td className="py-1.5 px-3 text-gray-700" rowSpan={3}>Ending ARR</td>
            <td className="py-1 px-3 text-right text-[10px]">
              <span className="text-blue-500 font-medium">Plan</span>
            </td>
            {planQuarterly.map((q) => (
              <td key={`arr-plan-${q.quarter}`} className="py-1 px-3 text-right text-blue-700">
                {formatCurrencyFull(q.endingARR)}
              </td>
            ))}
            <td className="py-1 px-3 text-right text-blue-700 font-medium">
              {formatCurrencyFull(planQuarterly[3]?.endingARR ?? startingARR)}
            </td>
          </tr>
          <tr className="border-b border-gray-50 bg-blue-50">
            <td className="py-1 px-3 text-right text-[10px]">
              <span className="text-amber-600 font-medium">SQ</span>
            </td>
            {sqQuarterly.map((q) => (
              <td key={`arr-sq-${q.quarter}`} className="py-1 px-3 text-right text-amber-700">
                {formatCurrencyFull(q.endingARR)}
              </td>
            ))}
            <td className="py-1 px-3 text-right text-amber-700 font-medium">
              {formatCurrencyFull(sqQuarterly[3]?.endingARR ?? startingARR)}
            </td>
          </tr>
          <tr className="border-b border-gray-200 bg-blue-50">
            <td className="py-1 px-3 text-right text-[10px]">
              <span className="text-gray-400 font-medium">Δ</span>
            </td>
            {planQuarterly.map((q, qi) => {
              const d = formatDelta(q.endingARR, sqQuarterly[qi].endingARR, formatCurrencyFull, 'currency');
              return (
                <td key={`arr-delta-${q.quarter}`} className={`py-1 px-3 text-right text-[11px] font-medium ${d.color}`}>
                  {d.text}
                </td>
              );
            })}
            {(() => {
              const planEnd = planQuarterly[3]?.endingARR ?? startingARR;
              const sqEnd = sqQuarterly[3]?.endingARR ?? startingARR;
              const d = formatDelta(planEnd, sqEnd, formatCurrencyFull, 'currency');
              return (
                <td className={`py-1 px-3 text-right text-[11px] font-medium ${d.color}`}>
                  {d.text}
                </td>
              );
            })()}
          </tr>
        </React.Fragment>
      </tbody>
    </table>
  );
}

// ── Monthly Gap View ─────────────────────────────────────────

function MonthlyGapView({ planMonthly, sqMonthly, planRows, sqRows, startingARR, isInYear, cm }: {
  planMonthly: MonthlyResult[];
  sqMonthly: MonthlyResult[];
  planRows: TableRow[];
  sqRows: TableRow[];
  startingARR: number;
  isInYear?: boolean;
  cm: number;
}) {
  // Add Cumulative ARR at end
  const allPlanRows = useMemo(() => [
    ...planRows,
    { label: 'Cumulative ARR', getMonthly: (m: MonthlyResult) => m.cumulativeARR, getQuarterly: () => 0, fmt: formatCurrencyFull, metricType: 'currency' as MetricType, isHighlight: true } as TableRow,
  ], [planRows]);

  const allSqRows = useMemo(() => [
    ...sqRows,
    { label: 'Cumulative ARR', getMonthly: (m: MonthlyResult) => m.cumulativeARR, getQuarterly: () => 0, fmt: formatCurrencyFull, metricType: 'currency' as MetricType, isHighlight: true } as TableRow,
  ], [sqRows]);

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-48">Metric</th>
          {planMonthly.map((m) => (
            <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]">
              {formatMonthName(m.month)}
              {isInYear && (m.month < cm ? <ActBadge /> : <PlanBadge />)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {allPlanRows.map((row, idx) => {
          const sqRow = allSqRows[idx];

          return (
            <React.Fragment key={`${row.monthlyLabel || row.label}-${idx}`}>
              {/* Metric label + Plan sub-row */}
              <tr className={`border-b border-gray-100 ${rowBgClass(row)}`}>
                <td className={`${cellLabelClass(row)} sticky left-0 bg-inherit`} rowSpan={3}>
                  {row.monthlyLabel || row.label}
                </td>
                {planMonthly.map((m) => (
                  <td key={`plan-${m.month}`} className="py-1 px-2 text-right text-blue-700">
                    {row.fmt(row.getMonthly(m))}
                  </td>
                ))}
              </tr>
              {/* Status Quo sub-row */}
              <tr className={`border-b border-gray-50 ${rowBgClass(row)}`}>
                {sqMonthly.map((m) => (
                  <td key={`sq-${m.month}`} className="py-1 px-2 text-right text-amber-700">
                    {sqRow.fmt(sqRow.getMonthly(m))}
                  </td>
                ))}
              </tr>
              {/* Delta sub-row */}
              <tr className={`border-b border-gray-200 ${rowBgClass(row)}`}>
                {planMonthly.map((m, mi) => {
                  const pVal = row.getMonthly(m);
                  const sVal = sqRow.getMonthly(sqMonthly[mi]);
                  const d = formatDelta(pVal, sVal, row.fmt, row.metricType);
                  return (
                    <td key={`delta-${m.month}`} className={`py-1 px-2 text-right text-[11px] font-medium ${d.color}`}>
                      {d.text}
                    </td>
                  );
                })}
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
