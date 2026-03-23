'use client';

import React, { useState, useMemo } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, applyChannelConfig, buildPipelineTimingMap } from '@/lib/engine';
import type { PipelineTimingMap } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatPercent, formatNumber, formatMonthName } from '@/lib/format';
import { isQuarterFilled } from '@/components/shared/HistoricalDataSheet';
import type { QuarterlyHistoricalData, SeasonalityWeights, RampConfig, RevenueBreakdown, MonthlyResult, QuarterlyResult, Month } from '@/lib/types';

// ── Build RevenueBreakdown from averaged historical quarters ──

function clampSalesCycle(v: number): number {
  // If value > 18, likely entered in days — convert to months; then clamp to [0, 18]
  if (v > 18) return Math.min(v / 30, 18);
  return Math.max(0, v);
}

function buildHistoricalBreakdown(quarters: QuarterlyHistoricalData[]): RevenueBreakdown {
  const filled = quarters.filter(isQuarterFilled);

  const avg = (getter: (q: QuarterlyHistoricalData) => number) => {
    const vals = filled.map(getter).filter((v) => v > 0);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  // Quarterly values → monthly: divide volumes/pipeline by 3
  const ibHISMonthly = avg((q) => q.inboundHIS) / 3;
  const ibHISToPipe = avg((q) => q.inboundHISToPipelineRate);
  const ibWinRate = avg((q) => q.inboundWinRate);
  const ibACV = avg((q) => q.inboundACV);
  const ibSalesCycle = clampSalesCycle(avg((q) => q.inboundSalesCycle));

  const obPipeMonthly = avg((q) => q.outboundQualifiedPipeline) / 3;
  const obWinRate = avg((q) => q.outboundWinRate);
  const obACV = avg((q) => q.outboundACV);
  const obSalesCycle = clampSalesCycle(avg((q) => q.outboundSalesCycle));

  const npHISMonthly = avg((q) => q.newProductHIS) / 3;
  const npHISToPipe = avg((q) => q.newProductHISToPipelineRate);
  const npWinRate = avg((q) => q.newProductWinRate);
  const npACV = avg((q) => q.newProductACV);
  const npSalesCycle = clampSalesCycle(avg((q) => q.newProductSalesCycle));

  // churnRate from quarters is quarterly — convert to monthly (divide by 3)
  const avgQuarterlyChurnRate = avg((q) => q.churnRate);
  const monthlyChurnRate = avgQuarterlyChurnRate / 3;

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
    },
    expansion: {
      pipelineMonthly: avg((q) => q.expansionPipeline) / 3,
      winRate: avg((q) => q.expansionWinRate),
      acv: avg((q) => q.expansionACV),
      salesCycleMonths: clampSalesCycle(avg((q) => q.expansionSalesCycle)),
    },
    churn: { monthlyChurnRate },
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
    // Guard: skip if previous value is < $100 or 0 to avoid divide-by-near-zero
    if (prev >= 100) {
      changes.push((curr - prev) / prev);
    }
  }

  if (changes.length === 0) {
    return { avgPctChange: 0, direction: 'flat', label: '— (insufficient data)', color: 'text-gray-400' };
  }

  const avg = changes.reduce((s, v) => s + v, 0) / changes.length;
  const pct = Math.round(avg * 1000) / 10; // one decimal

  // Guard: if resulting % is unrealistically large (>500%), show insufficient data
  if (Math.abs(pct) > 500) {
    return { avgPctChange: pct, direction: 'flat', label: '— (insufficient data)', color: 'text-gray-400' };
  }

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
    rows.push({ label: 'NP Inbound Qualified Pipeline $', monthlyLabel: 'NP IB Qual. Pipeline', getMonthly: (m) => m.newProductInboundPipelineCreated, getQuarterly: (q) => q.newProductInboundPipelineCreated, fmt: formatCurrencyFull, trendGetter: (q) => q.newProductQualifiedPipeline });
    rows.push({ label: 'Win Rate', getMonthly: () => npIb.winRate, getQuarterly: () => npIb.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, trendGetter: (q) => q.newProductWinRate });
    rows.push({ label: 'ACV', getMonthly: () => npIb.acv, getQuarterly: () => npIb.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, trendGetter: (q) => q.newProductACV });
    rows.push({ label: 'Sales Cycle', getMonthly: () => npIb.salesCycleMonths, getQuarterly: () => npIb.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, isSecondary: true, isConstant: true, trendGetter: (q) => q.newProductSalesCycle });
    rows.push({ label: 'New Product Inbound Won', monthlyLabel: 'NP Inbound Won', getMonthly: (m) => m.newProductInboundClosedWon, getQuarterly: (q) => q.newProductInboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true, trendGetter: (q) => q.newProductClosedWon });
    rows.push({ label: 'New Product Inbound Customers', monthlyLabel: 'NP Inbound Customers', getMonthly: (m) => m.newProductInboundDeals, getQuarterly: (q) => q.months.reduce((s, m2) => s + m2.newProductInboundDeals, 0), fmt: formatNumber, trendGetter: (q) => q.newProductNewCustomers });
  }

  if (cc.hasExpansion) {
    rows.push({ label: 'Expansion Pipeline $', getMonthly: () => breakdown.expansion.pipelineMonthly, getQuarterly: () => breakdown.expansion.pipelineMonthly, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, trendGetter: (q) => q.expansionPipeline });
    rows.push({ label: 'Expansion Win Rate', getMonthly: () => breakdown.expansion.winRate, getQuarterly: () => breakdown.expansion.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, trendGetter: (q) => q.expansionWinRate });
    rows.push({ label: 'Expansion ACV', getMonthly: () => breakdown.expansion.acv, getQuarterly: () => breakdown.expansion.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, trendGetter: (q) => q.expansionACV });
    rows.push({ label: 'Expansion Sales Cycle', getMonthly: () => breakdown.expansion.salesCycleMonths, getQuarterly: () => breakdown.expansion.salesCycleMonths, fmt: (v) => `${v.toFixed(1)} mo`, isSecondary: true, isConstant: true, trendGetter: (q) => q.expansionSalesCycle });
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
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 leading-none align-middle">PLAN</span>;
}

function HBClockIcon({ status, tooltip }: { status: 'green' | 'amber' | 'red'; tooltip: string }) {
  const colorMap = { green: 'text-green-500', amber: 'text-amber-500', red: 'text-red-500' };
  return (
    <span className={`inline-block ml-1 cursor-help ${colorMap[status]}`} title={tooltip}>
      <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  );
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

  // Pipeline timing
  const pipelineTimingMap = useMemo(
    () => buildPipelineTimingMap(effectiveBreakdown, currentMonth),
    [effectiveBreakdown, currentMonth],
  );

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

  const planAchieved = gapToTarget <= 0;

  return (
    <div className="space-y-6">
      {/* Summary cards (same layout as Revenue Targets tab) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Starting ARR" value={formatCurrency(plan.startingARR)} color="gray" />
        <SummaryCard label="Target ARR" value={formatCurrency(plan.targetARR)} color="blue" />
        <SummaryCard label="Projected ARR" value={formatCurrency(projectedEndARR)} color="green" />
        <SummaryCard
          label="Gap to Target"
          value={planAchieved ? '$0' : formatCurrency(gapToTarget)}
          color={planAchieved ? 'green' : 'red'}
          suffix={planAchieved ? '✓ Plan Achieved' : 'short'}
        />
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

      {/* Emerging channels note */}
      {(cc.hasEmergingInbound || cc.hasEmergingOutbound || cc.hasEmergingNewProduct) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-amber-600 text-xs">✦</span>
          <span className="text-xs text-amber-700">
            Emerging channels show &quot;No historical data&quot; — projections for these channels are based on targets only.
          </span>
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
              pipelineTimingMap={pipelineTimingMap}
            />
          ) : (
            <MonthlyView
              monthly={model.monthly}
              startingARR={plan.startingARR}
              rows={rows}
              trends={trends}
              isInYear={isInYear}
              currentMonth={currentMonth}
              pipelineTimingMap={pipelineTimingMap}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Quarterly View ──

function QuarterlyView({ quarterly, startingARR, rows, trends, isInYear, currentMonth, pipelineTimingMap }: {
  quarterly: QuarterlyResult[];
  startingARR: number;
  rows: TableRow[];
  trends: Map<number, TrendInfo>;
  isInYear?: boolean;
  currentMonth: number;
  pipelineTimingMap?: PipelineTimingMap;
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
                <td className={cellLabelClass(row)}>
                  {row.label}
                  {pipelineTimingMap?.[row.label] && (() => {
                    const entries = Object.values(pipelineTimingMap[row.label]);
                    const worst = entries.find((e) => e.status === 'red') || entries.find((e) => e.status === 'amber') || entries[0];
                    return worst ? <HBClockIcon status={worst.status} tooltip={worst.tooltip} /> : null;
                  })()}
                </td>
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

function MonthlyView({ monthly, startingARR, rows, trends, isInYear, currentMonth, pipelineTimingMap }: {
  monthly: MonthlyResult[];
  startingARR: number;
  rows: TableRow[];
  trends: Map<number, TrendInfo>;
  isInYear?: boolean;
  pipelineTimingMap?: PipelineTimingMap;
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
                {monthly.map((m) => {
                  const timing = pipelineTimingMap?.[row.label]?.[m.month];
                  return (
                    <td key={m.month} className={cellValueClass(row, true)}>
                      {row.fmt(row.getMonthly(m))}
                      {timing && <HBClockIcon status={timing.status} tooltip={timing.tooltip} />}
                    </td>
                  );
                })}
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

// ── Summary Card (matches TopDownPlan exactly) ──

function SummaryCard({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: string;
  color: string;
  suffix?: string;
}) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-xs font-medium opacity-75 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mt-1">
        {value}
        {suffix && <span className="text-xs font-normal ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
