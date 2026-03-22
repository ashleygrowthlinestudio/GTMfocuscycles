'use client';

import React, { useState, useMemo } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, applyChannelConfig } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatPercent, formatNumber, formatMonthName } from '@/lib/format';
import { isQuarterFilled } from '@/components/shared/HistoricalDataSheet';
import type { QuarterlyHistoricalData, SeasonalityWeights, RampConfig, RevenueBreakdown, MonthlyResult, QuarterlyResult, Month } from '@/lib/types';

// ── Build RevenueBreakdown from averaged historical quarters ──

function buildHistoricalBreakdown(quarters: QuarterlyHistoricalData[]): RevenueBreakdown {
  const filled = quarters.filter(isQuarterFilled);
  const n = filled.length || 1;

  const avg = (getter: (q: QuarterlyHistoricalData) => number) => {
    const vals = filled.map(getter).filter((v) => v > 0);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  // Quarterly values → monthly: divide volumes/pipeline/closed-won by 3
  const ibHISMonthly = avg((q) => q.inboundHIS) / 3;
  const ibHISToPipe = avg((q) => q.inboundHISToPipelineRate);
  const ibWinRate = avg((q) => q.inboundWinRate);
  const ibACV = avg((q) => q.inboundACV);
  const ibSalesCycle = avg((q) => q.inboundSalesCycle);

  const obPipeMonthly = avg((q) => q.outboundQualifiedPipeline) / 3;
  const obWinRate = avg((q) => q.outboundWinRate);
  const obACV = avg((q) => q.outboundACV);
  const obSalesCycle = avg((q) => q.outboundSalesCycle);

  const npHISMonthly = avg((q) => q.newProductHIS) / 3;
  const npHISToPipe = avg((q) => q.newProductHISToPipelineRate);
  const npWinRate = avg((q) => q.newProductWinRate);
  const npACV = avg((q) => q.newProductACV);
  const npSalesCycle = avg((q) => q.newProductSalesCycle);

  // Expansion/churn: quarterly rate → estimate monthly rate
  // expansionRate from historicals is quarterly; we need monthly
  const avgExpRate = avg((q) => q.expansionRate);
  const avgChurnRate = avg((q) => q.churnRate);

  return {
    newBusiness: {
      inbound: {
        hisMonthly: ibHISMonthly,
        hisToPipelineRate: ibHISToPipe,
        winRate: ibWinRate,
        acv: ibACV,
        salesCycleMonths: ibSalesCycle,
      },
      outbound: {
        pipelineMonthly: obPipeMonthly,
        winRate: obWinRate,
        acv: obACV,
        salesCycleMonths: obSalesCycle,
      },
    },
    newProduct: {
      inbound: {
        hisMonthly: npHISMonthly,
        hisToPipelineRate: npHISToPipe,
        winRate: npWinRate,
        acv: npACV,
        salesCycleMonths: npSalesCycle,
      },
      outbound: {
        pipelineMonthly: 0,
        winRate: 0,
        acv: 0,
        salesCycleMonths: 0,
      },
    },
    expansion: { expansionRate: avgExpRate },
    churn: { monthlyChurnRate: avgChurnRate },
  };
}

// ── Seasonality from 8+ quarters ──

function computeSeasonality(quarters: QuarterlyHistoricalData[]): SeasonalityWeights {
  const filled = quarters.filter(isQuarterFilled);
  if (filled.length < 8) {
    // Flat seasonality
    const monthly: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) monthly[m] = 1.0;
    return { monthly };
  }

  const byQ: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const q of filled) {
    const totalRev = q.inboundClosedWon + q.outboundClosedWon + q.expansionRevenue + q.newProductClosedWon - q.churnRevenue;
    if (totalRev > 0) byQ[q.quarter].push(totalRev);
  }
  const qAvgs = [1, 2, 3, 4].map((qn) => {
    const vals = byQ[qn];
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  });
  const overallAvg = qAvgs.reduce((s, v) => s + v, 0) / 4;
  if (overallAvg === 0) {
    const monthly: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) monthly[m] = 1.0;
    return { monthly };
  }
  const weights = qAvgs.map((v) => Math.round((v / overallAvg) * 100) / 100);
  const monthly: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const qi = Math.ceil(m / 3) - 1;
    monthly[m] = weights[qi];
  }
  return { monthly };
}

// ── QoQ trend calculation ──

interface TrendInfo {
  avgPctChange: number;
  direction: 'up' | 'down' | 'flat';
  label: string;
  color: string;
}

function computeQoQTrend(quarters: QuarterlyHistoricalData[], getter: (q: QuarterlyHistoricalData) => number): TrendInfo {
  const filled = quarters.filter(isQuarterFilled);
  // Sort by year then quarter
  const sorted = [...filled].sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter);

  const changes: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = getter(sorted[i - 1]);
    const curr = getter(sorted[i]);
    if (prev > 0) {
      changes.push((curr - prev) / prev);
    }
  }

  if (changes.length === 0) {
    return { avgPctChange: 0, direction: 'flat', label: '→ Flat', color: 'text-gray-400' };
  }

  const avg = changes.reduce((s, v) => s + v, 0) / changes.length;
  const pct = Math.round(avg * 1000) / 10; // one decimal

  if (Math.abs(pct) < 1) {
    return { avgPctChange: pct, direction: 'flat', label: '→ Flat', color: 'text-gray-400' };
  }
  if (pct > 0) {
    return { avgPctChange: pct, direction: 'up', label: `↑ +${pct.toFixed(1)}% QoQ avg`, color: 'text-green-600' };
  }
  return { avgPctChange: pct, direction: 'down', label: `↓ ${pct.toFixed(1)}% QoQ avg`, color: 'text-red-500' };
}

// ── Row definitions (match TopDownPlan/RevenueTable exactly) ──

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
  trendGetter?: (q: QuarterlyHistoricalData) => number;
};

function buildRows(breakdown: RevenueBreakdown, cc: { hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean }): TableRow[] {
  const rows: TableRow[] = [];
  const ib = breakdown.newBusiness.inbound;
  const ob = breakdown.newBusiness.outbound;
  const npIb = breakdown.newProduct.inbound;

  if (cc.hasInbound) {
    rows.push({ label: 'HIS Volume', getMonthly: (m) => m.hisRequired, getQuarterly: (q) => q.hisRequired, fmt: formatNumber, trendGetter: (q) => q.inboundHIS });
    rows.push({ label: 'HIS → Pipeline Rate', getMonthly: () => ib.hisToPipelineRate, getQuarterly: () => ib.hisToPipelineRate, fmt: formatPercent, isSecondary: true, isConstant: true, trendGetter: (q) => q.inboundHISToPipelineRate });
    rows.push({ label: 'Inbound Qualified Pipeline $', monthlyLabel: 'IB Qualified Pipeline', getMonthly: (m) => m.inboundPipelineCreated, getQuarterly: (q) => q.inboundPipelineCreated, fmt: formatCurrencyFull, trendGetter: (q) => q.inboundQualifiedPipeline });
    rows.push({ label: 'Win Rate', getMonthly: () => ib.winRate, getQuarterly: () => ib.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, trendGetter: (q) => q.inboundWinRate });
    rows.push({ label: 'ACV', getMonthly: () => ib.acv, getQuarterly: () => ib.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, trendGetter: (q) => q.inboundACV });
    rows.push({ label: 'Sales Cycle', getMonthly: () => ib.salesCycleMonths, getQuarterly: () => ib.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, isSecondary: true, isConstant: true, trendGetter: (q) => q.inboundSalesCycle });
    rows.push({ label: 'Inbound Closed Won', getMonthly: (m) => m.inboundClosedWon, getQuarterly: (q) => q.inboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true, trendGetter: (q) => q.inboundClosedWon });
    rows.push({ label: 'Inbound New Customers', getMonthly: (m) => m.inboundDeals, getQuarterly: (q) => q.months.reduce((s, m2) => s + m2.inboundDeals, 0), fmt: formatNumber, trendGetter: (q) => q.inboundNewCustomers });
  }

  if (cc.hasOutbound) {
    rows.push({ label: 'Outbound Qualified Pipeline $', monthlyLabel: 'OB Qualified Pipeline', getMonthly: (m) => m.outboundPipelineCreated, getQuarterly: (q) => q.outboundPipelineCreated, fmt: formatCurrencyFull, trendGetter: (q) => q.outboundQualifiedPipeline });
    rows.push({ label: 'Win Rate', getMonthly: () => ob.winRate, getQuarterly: () => ob.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, trendGetter: (q) => q.outboundWinRate });
    rows.push({ label: 'ACV', getMonthly: () => ob.acv, getQuarterly: () => ob.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, trendGetter: (q) => q.outboundACV });
    rows.push({ label: 'Sales Cycle', getMonthly: () => ob.salesCycleMonths, getQuarterly: () => ob.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, isSecondary: true, isConstant: true, trendGetter: (q) => q.outboundSalesCycle });
    rows.push({ label: 'Outbound Closed Won', getMonthly: (m) => m.outboundClosedWon, getQuarterly: (q) => q.outboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true, trendGetter: (q) => q.outboundClosedWon });
    rows.push({ label: 'Outbound New Customers', getMonthly: (m) => m.outboundDeals, getQuarterly: (q) => q.months.reduce((s, m2) => s + m2.outboundDeals, 0), fmt: formatNumber, trendGetter: (q) => q.outboundNewCustomers });
  }

  if (cc.hasNewProduct) {
    rows.push({ label: 'NP Inbound HIS Volume', monthlyLabel: 'NP IB HIS Volume', getMonthly: (m) => m.newProductHisRequired, getQuarterly: (q) => q.newProductHisRequired, fmt: formatNumber, trendGetter: (q) => q.newProductHIS });
    rows.push({ label: 'HIS → Pipeline Rate', getMonthly: () => npIb.hisToPipelineRate, getQuarterly: () => npIb.hisToPipelineRate, fmt: formatPercent, isSecondary: true, isConstant: true, trendGetter: (q) => q.newProductHISToPipelineRate });
    rows.push({ label: 'NP Inbound Qualified Pipeline $', monthlyLabel: 'NP IB Qual. Pipeline', getMonthly: (m) => m.newProductInboundPipelineCreated, getQuarterly: (q) => q.newProductInboundPipelineCreated, fmt: formatCurrencyFull, trendGetter: (q) => q.newProductQualifiedPipeline });
    rows.push({ label: 'Win Rate', getMonthly: () => npIb.winRate, getQuarterly: () => npIb.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, trendGetter: (q) => q.newProductWinRate });
    rows.push({ label: 'ACV', getMonthly: () => npIb.acv, getQuarterly: () => npIb.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, trendGetter: (q) => q.newProductACV });
    rows.push({ label: 'Sales Cycle', getMonthly: () => npIb.salesCycleMonths, getQuarterly: () => npIb.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, isSecondary: true, isConstant: true, trendGetter: (q) => q.newProductSalesCycle });
    rows.push({ label: 'New Product Inbound Won', monthlyLabel: 'NP Inbound Won', getMonthly: (m) => m.newProductInboundClosedWon, getQuarterly: (q) => q.newProductInboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true, trendGetter: (q) => q.newProductClosedWon });
    rows.push({ label: 'New Product Inbound Customers', monthlyLabel: 'NP Inbound Customers', getMonthly: (m) => m.newProductInboundDeals, getQuarterly: (q) => q.months.reduce((s, m2) => s + m2.newProductInboundDeals, 0), fmt: formatNumber, trendGetter: (q) => q.newProductNewCustomers });
  }

  if (cc.hasExpansion) {
    rows.push({ label: 'Expansion Rate', getMonthly: () => breakdown.expansion.expansionRate, getQuarterly: () => breakdown.expansion.expansionRate, fmt: formatPercent, isSecondary: true, isConstant: true, trendGetter: (q) => q.expansionRate });
    rows.push({ label: 'Expansion Revenue', getMonthly: (m) => m.expansionRevenue, getQuarterly: (q) => q.expansionRevenue, fmt: formatCurrencyFull, isPurple: true, trendGetter: (q) => q.expansionRevenue });
  }

  if (cc.hasChurn) {
    rows.push({ label: 'Churn Rate', getMonthly: () => breakdown.churn.monthlyChurnRate, getQuarterly: () => breakdown.churn.monthlyChurnRate, fmt: formatPercent, isSecondary: true, isConstant: true, isChurn: true, trendGetter: (q) => q.churnRate });
    rows.push({ label: 'Churn Revenue', getMonthly: (m) => m.churnRevenue, getQuarterly: (q) => q.churnRevenue, fmt: formatCurrencyFull, isChurn: true, isPurple: true, trendGetter: (q) => q.churnRevenue });
  }

  rows.push({ label: 'Total New ARR', monthlyLabel: 'Net New ARR', getMonthly: (m) => m.totalNewARR, getQuarterly: (q) => q.totalNewARR, fmt: formatCurrencyFull, isHighlight: true });

  return rows;
}

// ── Styling helpers (match RevenueTable exactly) ──

function rowBgClass(row: TableRow): string {
  if (row.isHighlight) return 'bg-blue-50 font-semibold';
  if (row.isClosedWon || row.isPurple) return 'bg-purple-50 font-semibold';
  return '';
}

function cellLabelClass(row: TableRow): string {
  if (row.isSecondary) return 'py-1 px-3 pl-6 text-gray-400 italic text-[11px]';
  if (row.isHighlight) return 'py-1.5 px-3 text-gray-700';
  if (row.isClosedWon || row.isPurple) return 'py-1.5 px-3 text-purple-900';
  if (row.isChurn) return 'py-1.5 px-3 text-red-700';
  return 'py-1.5 px-3 text-gray-700';
}

function cellValueClass(row: TableRow, isMonthly = false): string {
  const px = isMonthly ? 'px-2' : 'px-3';
  if (row.isSecondary) return `py-1 ${px} text-right text-gray-400 italic text-[11px]`;
  if (row.isClosedWon || row.isPurple) return `py-1.5 ${px} text-right text-purple-900`;
  if (row.isChurn) return `py-1.5 ${px} text-right text-red-600`;
  return `py-1.5 ${px} text-right text-gray-900`;
}

// ── ACT/PROJ badges ──

function ActBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-green-100 text-green-700 leading-none align-middle">ACT</span>;
}

function ProjBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 leading-none align-middle">PROJ</span>;
}

// ── Main component ──

export default function HistoricalBenchmarks() {
  const { plan } = useGTMPlan();
  const [viewMode, setViewMode] = useState<'quarterly' | 'monthly'>('quarterly');
  const cc = plan.channelConfig;
  const historicalQuarters = plan.historicalQuarters ?? [];
  const filledCount = useMemo(() => historicalQuarters.filter(isQuarterFilled).length, [historicalQuarters]);
  const isInYear = plan.planningMode === 'in-year';
  const currentMonth = plan.currentMonth ?? 1;

  // Build averaged breakdown from historical data
  const breakdown = useMemo(() => buildHistoricalBreakdown(historicalQuarters), [historicalQuarters]);

  // Apply channel config
  const effectiveBreakdown = useMemo(
    () => applyChannelConfig(breakdown, cc, 'historical'),
    [breakdown, cc],
  );

  // Seasonality: flat unless 8+ quarters
  const seasonality = useMemo(() => computeSeasonality(historicalQuarters), [historicalQuarters]);

  // No ramp
  const noRamp: RampConfig = useMemo(() => ({ rampMonths: 1, startMonth: 1 as const }), []);

  // Run model
  const model = useMemo(
    () => runModel(effectiveBreakdown, seasonality, noRamp, plan.startingARR, plan.existingPipeline),
    [effectiveBreakdown, seasonality, noRamp, plan.startingARR, plan.existingPipeline],
  );

  const projectedEndARR = model.endingARR;
  const gapToTarget = plan.targetARR - projectedEndARR;

  // Build table rows
  const rows = useMemo(() => buildRows(effectiveBreakdown, {
    hasInbound: cc.hasInbound || cc.hasInboundHistory,
    hasOutbound: cc.hasOutbound || cc.hasOutboundHistory,
    hasExpansion: cc.hasExpansion,
    hasChurn: cc.hasChurn,
    hasNewProduct: cc.hasNewProduct || cc.hasNewProductHistory,
  }), [effectiveBreakdown, cc]);

  // Precompute trends
  const trends = useMemo(() => {
    const map = new Map<number, TrendInfo>();
    rows.forEach((row, idx) => {
      if (row.trendGetter && filledCount >= 2) {
        map.set(idx, computeQoQTrend(historicalQuarters, row.trendGetter));
      }
    });
    return map;
  }, [rows, historicalQuarters, filledCount]);

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div className={`rounded-lg border p-4 ${gapToTarget > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: gapToTarget > 0 ? '#92400e' : '#166534' }}>
          Status Quo Projection
        </h2>
        <p className="text-sm" style={{ color: gapToTarget > 0 ? '#92400e' : '#166534' }}>
          If nothing changes from current performance, you will end the year at{' '}
          <span className="font-bold">{formatCurrency(projectedEndARR)}</span> ARR.
        </p>
        <p className="text-sm mt-1" style={{ color: gapToTarget > 0 ? '#b45309' : '#15803d' }}>
          That is{' '}
          <span className="font-bold">{formatCurrency(Math.abs(gapToTarget))}</span>{' '}
          {gapToTarget > 0 ? 'short of' : 'above'} your{' '}
          <span className="font-bold">{formatCurrency(plan.targetARR)}</span> target.
        </p>
      </div>

      {/* Warning if < 4 quarters */}
      {filledCount < 4 && (
        <div className="border border-amber-300 rounded-lg p-3 bg-amber-50">
          <p className="text-sm text-amber-800 font-medium">
            Add at least 4 quarters of historical data in Setup for accurate status quo projections.
            Currently showing estimates based on available data.
            {filledCount > 0 && ` (${filledCount}/4 quarters filled)`}
          </p>
        </div>
      )}

      {/* Projection Table */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        {/* Header bar matching RevenueTable */}
        <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Status Quo Projections (If Nothing Changes)</h3>
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
            <QuarterlyView
              quarterly={model.quarterly}
              startingARR={plan.startingARR}
              rows={rows}
              trends={trends}
              isInYear={isInYear}
              currentMonth={currentMonth}
            />
          ) : (
            <MonthlyView
              monthly={model.monthly}
              startingARR={plan.startingARR}
              rows={rows}
              trends={trends}
              isInYear={isInYear}
              currentMonth={currentMonth}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Quarterly View ──

function QuarterlyView({ quarterly, startingARR, rows, trends, isInYear, currentMonth }: {
  quarterly: QuarterlyResult[];
  startingARR: number;
  rows: TableRow[];
  trends: Map<number, TrendInfo>;
  isInYear?: boolean;
  currentMonth: number;
}) {
  const cm = currentMonth;
  const quarterMonths: Record<string, number[]> = { Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12] };

  function quarterBadges(q: QuarterlyResult) {
    if (!isInYear) return null;
    const months = quarterMonths[q.quarter] || [];
    const actualCount = months.filter((m) => m < cm).length;
    if (actualCount === 3) return <ActBadge />;
    if (actualCount === 0) return <ProjBadge />;
    return <><ActBadge /><ProjBadge /></>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-24">Start</th>
          {quarterly.map((q) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500 w-28">
              {q.quarter}{quarterBadges(q)}
            </th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-28">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const quarterValues = quarterly.map((q) => row.getQuarterly(q));
          const total = row.isConstant ? quarterValues[0] : quarterValues.reduce((s, v) => s + v, 0);
          const trend = trends.get(idx);

          return (
            <React.Fragment key={`${row.label}-${idx}`}>
              <tr className={`border-b border-gray-100 ${rowBgClass(row)}`}>
                <td className={cellLabelClass(row)}>{row.label}</td>
                <td className="py-1.5 px-3 text-right text-gray-400">{row.isSecondary ? '' : '—'}</td>
                {quarterValues.map((val, qi) => (
                  <td key={quarterly[qi].quarter} className={cellValueClass(row)}>
                    {row.fmt(val)}
                  </td>
                ))}
                <td className={`${cellValueClass(row)} font-medium`}>{row.fmt(total)}</td>
              </tr>
              {/* QoQ Trend row */}
              {trend && (
                <tr className="border-b border-gray-50">
                  <td className="py-0.5 px-3 pl-6 italic text-[10px] text-gray-400">Historical trend</td>
                  <td className="py-0.5 px-3"></td>
                  <td colSpan={4} className="py-0.5 px-3"></td>
                  <td className={`py-0.5 px-3 text-right italic text-[10px] ${trend.color}`}>{trend.label}</td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
        {/* Ending ARR */}
        <tr className="border-b border-gray-100 bg-blue-50 font-semibold">
          <td className="py-1.5 px-3 text-gray-700">Ending ARR</td>
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

// ── Monthly View ──

function MonthlyView({ monthly, startingARR, rows, trends, isInYear, currentMonth }: {
  monthly: MonthlyResult[];
  startingARR: number;
  rows: TableRow[];
  trends: Map<number, TrendInfo>;
  isInYear?: boolean;
  currentMonth: number;
}) {
  const cm = currentMonth;

  // Add Cumulative ARR at end
  const allRows = useMemo(() => [
    ...rows,
    { label: 'Cumulative ARR', getMonthly: (m: MonthlyResult) => m.cumulativeARR, getQuarterly: () => 0, fmt: formatCurrencyFull, isHighlight: true } as TableRow,
  ], [rows]);

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-48">Metric</th>
          {monthly.map((m) => (
            <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]">
              {formatMonthName(m.month)}
              {isInYear && (m.month < cm ? <ActBadge /> : <ProjBadge />)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {allRows.map((row, idx) => {
          const trend = trends.get(idx);
          return (
            <React.Fragment key={`${row.monthlyLabel || row.label}-${idx}`}>
              <tr className={`border-b border-gray-100 ${rowBgClass(row)}`}>
                <td className={`${cellLabelClass(row)} sticky left-0 bg-inherit`}>
                  {row.monthlyLabel || row.label}
                </td>
                {monthly.map((m) => (
                  <td key={m.month} className={cellValueClass(row, true)}>
                    {row.fmt(row.getMonthly(m))}
                  </td>
                ))}
              </tr>
              {/* QoQ Trend row */}
              {trend && (
                <tr className="border-b border-gray-50">
                  <td className="py-0.5 px-3 pl-6 italic text-[10px] text-gray-400 sticky left-0 bg-white">Historical trend</td>
                  {monthly.slice(0, -1).map((m) => (
                    <td key={`trend-${m.month}`} className="py-0.5 px-2"></td>
                  ))}
                  <td className={`py-0.5 px-2 text-right italic text-[10px] ${trend.color}`}>{trend.label}</td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
