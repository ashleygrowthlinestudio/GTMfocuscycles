'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runTopDownModel, calcHistoricalAverages, runStatusQuoModel } from '@/lib/engine';
import type { EngineMonthlyResult, EngineQuarterlyResult, ActualMonth } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatPercent, formatNumber, formatMonthName } from '@/lib/format';
import type { MonthlyActuals } from '@/lib/types';

type ViewMode = 'quarterly' | 'monthly';
type MetricType = 'currency' | 'percent' | 'count';

// ── Row type definitions ──────────────────────────────────────

type GapRow = {
  label: string;
  monthlyLabel?: string;
  getMonthly: (m: EngineMonthlyResult) => number;
  getQuarterly: (q: EngineQuarterlyResult) => number;
  fmt: (v: number) => string;
  metricType: MetricType;
  isSecondary?: boolean;
  isChurn?: boolean;
  isHighlight?: boolean;
  isClosedWon?: boolean;
  isPurple?: boolean;
  isConstant?: boolean;
};

function buildGapRows(cc: {
  hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean;
}): GapRow[] {
  const rows: GapRow[] = [];

  if (cc.hasInbound) {
    rows.push({ label: 'HIS Volume', getMonthly: (m) => m.inboundHIS, getQuarterly: (q) => q.inboundHIS, fmt: formatNumber, metricType: 'count' });
    rows.push({ label: 'HIS → Pipeline Rate', getMonthly: (m) => m.inboundHisToPipelineRate, getQuarterly: (q) => q.months[0].inboundHisToPipelineRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'Inbound Qualified Pipeline $', monthlyLabel: 'IB Qualified Pipeline', getMonthly: (m) => m.inboundPipelineCreated, getQuarterly: (q) => q.inboundPipelineCreated, fmt: formatCurrencyFull, metricType: 'currency' });
    rows.push({ label: 'Win Rate', getMonthly: (m) => m.inboundWinRate, getQuarterly: (q) => q.months[0].inboundWinRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'ACV', getMonthly: (m) => m.inboundACV, getQuarterly: (q) => q.months[0].inboundACV, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Sales Cycle', getMonthly: (m) => m.inboundSalesCycle, getQuarterly: (q) => q.months[0].inboundSalesCycle, fmt: (v) => `${(v ?? 0).toFixed(1)} mo`, metricType: 'count', isSecondary: true, isConstant: true });
    rows.push({ label: 'Inbound Closed Won', getMonthly: (m) => m.inboundClosedWon, getQuarterly: (q) => q.inboundClosedWon, fmt: formatCurrencyFull, metricType: 'currency', isClosedWon: true });
    rows.push({ label: 'Inbound New Customers', getMonthly: (m) => m.inboundDeals, getQuarterly: (q) => q.inboundDeals, fmt: formatNumber, metricType: 'count' });
  }

  if (cc.hasOutbound) {
    rows.push({ label: 'Outbound Qualified Pipeline $', monthlyLabel: 'OB Qualified Pipeline', getMonthly: (m) => m.outboundPipelineCreated, getQuarterly: (q) => q.outboundPipelineCreated, fmt: formatCurrencyFull, metricType: 'currency' });
    rows.push({ label: 'Win Rate', getMonthly: (m) => m.outboundWinRate, getQuarterly: (q) => q.months[0].outboundWinRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'ACV', getMonthly: (m) => m.outboundACV, getQuarterly: (q) => q.months[0].outboundACV, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Sales Cycle', getMonthly: (m) => m.outboundSalesCycle, getQuarterly: (q) => q.months[0].outboundSalesCycle, fmt: (v) => `${(v ?? 0).toFixed(1)} mo`, metricType: 'count', isSecondary: true, isConstant: true });
    rows.push({ label: 'Outbound Closed Won', getMonthly: (m) => m.outboundClosedWon, getQuarterly: (q) => q.outboundClosedWon, fmt: formatCurrencyFull, metricType: 'currency', isClosedWon: true });
    rows.push({ label: 'Outbound New Customers', getMonthly: (m) => m.outboundDeals, getQuarterly: (q) => q.outboundDeals, fmt: formatNumber, metricType: 'count' });
  }

  if (cc.hasNewProduct) {
    rows.push({ label: 'NP Inbound Qualified Pipeline $', monthlyLabel: 'NP IB Qual. Pipeline', getMonthly: (m) => m.newProductPipelineCreated, getQuarterly: (q) => q.newProductPipelineCreated, fmt: formatCurrencyFull, metricType: 'currency' });
    rows.push({ label: 'Win Rate', getMonthly: (m) => m.newProductWinRate, getQuarterly: (q) => q.months[0].newProductWinRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'ACV', getMonthly: (m) => m.newProductACV, getQuarterly: (q) => q.months[0].newProductACV, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Sales Cycle', getMonthly: (m) => m.newProductSalesCycle, getQuarterly: (q) => q.months[0].newProductSalesCycle, fmt: (v) => `${(v ?? 0).toFixed(1)} mo`, metricType: 'count', isSecondary: true, isConstant: true });
    rows.push({ label: 'New Product Inbound Won', monthlyLabel: 'NP Inbound Won', getMonthly: (m) => m.newProductClosedWon, getQuarterly: (q) => q.newProductClosedWon, fmt: formatCurrencyFull, metricType: 'currency', isClosedWon: true });
    rows.push({ label: 'New Product Inbound Customers', monthlyLabel: 'NP Inbound Customers', getMonthly: (m) => m.newProductDeals, getQuarterly: (q) => q.newProductDeals, fmt: formatNumber, metricType: 'count' });
  }

  if (cc.hasExpansion) {
    rows.push({ label: 'Expansion Pipeline $', getMonthly: (m) => m.expansionPipelineCreated, getQuarterly: (q) => q.expansionPipelineCreated, fmt: formatCurrencyFull, metricType: 'currency' });
    rows.push({ label: 'Expansion Win Rate', getMonthly: (m) => m.expansionWinRate, getQuarterly: (q) => q.months[0].expansionWinRate, fmt: formatPercent, metricType: 'percent', isSecondary: true, isConstant: true });
    rows.push({ label: 'Expansion ACV', getMonthly: (m) => m.expansionACV, getQuarterly: (q) => q.months[0].expansionACV, fmt: formatCurrencyFull, metricType: 'currency', isSecondary: true, isConstant: true });
    rows.push({ label: 'Expansion Sales Cycle', getMonthly: (m) => m.expansionSalesCycle, getQuarterly: (q) => q.months[0].expansionSalesCycle, fmt: (v) => `${(v ?? 0).toFixed(1)} mo`, metricType: 'count', isSecondary: true, isConstant: true });
    rows.push({ label: 'Expansion Revenue', getMonthly: (m) => m.expansionRevenue, getQuarterly: (q) => q.expansionRevenue, fmt: formatCurrencyFull, metricType: 'currency', isPurple: true });
  }

  if (cc.hasChurn) {
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
    return { text: '\u2248 On Par', color: 'text-gray-500' };
  }

  const sign = delta > 0 ? '+' : '-';
  const arrow = delta > 0 ? ' \u2191' : ' \u2193';
  const color = delta > 0 ? 'text-green-600' : 'text-red-500';

  let formatted: string;
  if (metricType === 'percent') {
    const pts = Math.abs(delta * 100);
    formatted = `${sign}${pts.toFixed(1)}%`;
  } else {
    formatted = `${sign}${fmt(absDelta)}`;
  }

  return { text: `${formatted}${arrow}`, color };
}

// ── Styling helpers ─────────────────────────────────────────

function rowBgClass(row: GapRow): string {
  if (row.isHighlight) return 'bg-blue-50';
  if (row.isClosedWon || row.isPurple) return 'bg-purple-50';
  return '';
}

function cellLabelClass(row: GapRow): string {
  if (row.isSecondary) return 'py-1 px-3 pl-6 text-gray-400 italic text-[11px]';
  if (row.isHighlight) return 'py-1.5 px-3 text-gray-700 font-semibold';
  if (row.isClosedWon || row.isPurple) return 'py-1.5 px-3 text-purple-900 font-semibold';
  if (row.isChurn) return 'py-1.5 px-3 text-red-700';
  return 'py-1.5 px-3 text-gray-700';
}

// ── Actuals mapper ──────────────────────────────────────────

function toActualMonth(a: MonthlyActuals): ActualMonth {
  return {
    month: a.month,
    inboundClosedWon: a.inboundClosedWon,
    outboundClosedWon: a.outboundClosedWon,
    expansionRevenue: a.expansionRevenue,
    newProductClosedWon: a.newProductInboundClosedWon,
    churnRevenue: a.churnRevenue,
    totalNewARR: a.totalNewARR,
    cumulativeARR: a.cumulativeARR,
    inboundPipelineCreated: a.inboundPipelineCreated,
    outboundPipelineCreated: a.outboundPipelineCreated,
    expansionPipelineCreated: 0,
    newProductPipelineCreated: 0,
    inboundHIS: a.hisVolume,
    inboundDeals: 0,
    outboundDeals: 0,
    expansionDeals: 0,
    newProductDeals: 0,
  };
}

// ── Error boundary ───────────────────────────────────────────

class GapAnalysisErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Gap Analysis encountered an error</h3>
          <p className="text-sm text-red-600 mb-3">{this.state.error?.message || 'Unknown error'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main component ───────────────────────────────────────────

export default function GapAnalysis() {
  return (
    <GapAnalysisErrorBoundary>
      <GapAnalysisInner />
    </GapAnalysisErrorBoundary>
  );
}

function GapAnalysisInner() {
  const { plan } = useGTMPlan();
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');
  const cc = plan.channelConfig;

  // ── Target model (same as TopDownPlan.tsx) ──────────────────
  const alloc = plan.targetAllocations;
  const churnAnnual = plan.startingARR * (plan.targets.churn.monthlyChurnRate || 0) * 12;
  const grossTarget = (plan.targetARR - plan.startingARR) + churnAnnual;

  const inboundAnnual = ((alloc?.inbound || 0) / 100) * grossTarget;
  const outboundAnnual = ((alloc?.outbound || 0) / 100) * grossTarget;
  const expansionAnnual = ((alloc?.expansion || 0) / 100) * grossTarget;
  const newProductAnnual = ((alloc?.newProduct || 0) / 100) * grossTarget;

  const hasAllocations = (inboundAnnual + outboundAnnual + expansionAnnual + newProductAnnual) > 0;

  const targets = plan.targets;

  const targetModel = useMemo(() => {
    if (!hasAllocations) return null;
    return runTopDownModel({
      inboundAnnual,
      outboundAnnual,
      expansionAnnual,
      newProductAnnual,
      churnAnnual,
      rates: {
        inboundWinRate: targets.newBusiness.inbound.winRate,
        inboundACV: targets.newBusiness.inbound.acv,
        inboundSalesCycle: targets.newBusiness.inbound.salesCycleMonths,
        inboundHisToPipelineRate: targets.newBusiness.inbound.hisToPipelineRate,
        outboundWinRate: targets.newBusiness.outbound.winRate,
        outboundACV: targets.newBusiness.outbound.acv,
        outboundSalesCycle: targets.newBusiness.outbound.salesCycleMonths,
        expansionWinRate: targets.expansion.winRate,
        expansionACV: targets.expansion.acv,
        expansionSalesCycle: targets.expansion.salesCycleMonths,
        newProductWinRate: targets.newProduct.inbound.winRate,
        newProductACV: targets.newProduct.inbound.acv,
        newProductSalesCycle: targets.newProduct.inbound.salesCycleMonths,
      },
      startingARR: plan.startingARR,
    });
  }, [
    hasAllocations, inboundAnnual, outboundAnnual, expansionAnnual, newProductAnnual,
    churnAnnual, targets, plan.startingARR,
  ]);

  // ── Status quo model (same as HistoricalBenchmarks.tsx) ─────
  const historicalQuarters = plan.historicalQuarters ?? [];

  const avgs = useMemo(
    () => calcHistoricalAverages(historicalQuarters),
    [historicalQuarters],
  );

  const sqModel = useMemo(
    () => runStatusQuoModel({
      avgMonthlyInboundPipeline: avgs.avgMonthlyInboundPipeline,
      avgInboundWinRate: avgs.avgInboundWinRate,
      avgInboundACV: avgs.avgInboundACV,
      avgInboundSalesCycle: avgs.avgInboundSalesCycle,
      avgMonthlyHIS: avgs.avgMonthlyHIS,
      avgInboundHisToPipelineRate: avgs.avgInboundHisToPipelineRate,
      avgMonthlyOutboundPipeline: avgs.avgMonthlyOutboundPipeline,
      avgOutboundWinRate: avgs.avgOutboundWinRate,
      avgOutboundACV: avgs.avgOutboundACV,
      avgOutboundSalesCycle: avgs.avgOutboundSalesCycle,
      avgExpansionPipeline: avgs.avgExpansionPipeline,
      avgExpansionWinRate: avgs.avgExpansionWinRate,
      avgExpansionACV: avgs.avgExpansionACV,
      avgExpansionSalesCycle: avgs.avgExpansionSalesCycle,
      avgNewProductPipeline: avgs.avgNewProductPipeline,
      avgNewProductWinRate: avgs.avgNewProductWinRate,
      avgNewProductACV: avgs.avgNewProductACV,
      avgNewProductSalesCycle: avgs.avgNewProductSalesCycle,
      monthlyChurnRate: avgs.monthlyChurnRate || plan.targets.churn.monthlyChurnRate,
      startingARR: plan.startingARR,
      actuals: (plan.detailedActuals || []).map(toActualMonth),
      currentMonth: plan.currentMonth,
      channelConfig: cc,
    }),
    [avgs, plan.startingARR, plan.detailedActuals, plan.currentMonth, cc, plan.targets.churn.monthlyChurnRate],
  );

  // ── Gap rows ───────────────────────────────────────────────
  const channelFlags = useMemo(() => ({
    hasInbound: cc.hasInbound || cc.hasInboundHistory,
    hasOutbound: cc.hasOutbound || cc.hasOutboundHistory,
    hasExpansion: cc.hasExpansion,
    hasChurn: cc.hasChurn,
    hasNewProduct: cc.hasNewProduct || cc.hasNewProductHistory,
  }), [cc]);

  const rows = useMemo(() => buildGapRows(channelFlags), [channelFlags]);

  // ── Summary values ─────────────────────────────────────────
  const targetARR = plan.targetARR;
  const sqARR = sqModel.endingARR;
  const gapToClose = targetARR - sqARR;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Target ARR</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{formatCurrency(targetARR)}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Status Quo ARR</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{formatCurrency(sqARR)}</div>
        </div>
        <div className={`rounded-lg p-4 border ${gapToClose > 0 ? 'bg-red-50 border-red-200' : gapToClose < 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`text-xs font-medium uppercase tracking-wide ${gapToClose > 0 ? 'text-red-600' : gapToClose < 0 ? 'text-green-600' : 'text-gray-600'}`}>
            Gap to Close
          </div>
          <div className={`text-2xl font-bold mt-1 ${gapToClose > 0 ? 'text-red-800' : gapToClose < 0 ? 'text-green-800' : 'text-gray-800'}`}>
            {formatCurrency(Math.abs(gapToClose))}
            <span className="text-sm font-normal ml-1">
              {gapToClose > 0 ? 'short of target' : gapToClose < 0 ? 'above target' : 'on target'}
            </span>
          </div>
        </div>
      </div>

      {/* Gap spreadsheet */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-700">Gap Analysis &mdash; Target vs Status Quo</h3>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Target</span>
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
              targetQuarterly={targetModel?.quarterly ?? null}
              sqQuarterly={sqModel.quarterly}
              rows={rows}
              startingARR={plan.startingARR}
            />
          ) : (
            <MonthlyGapView
              targetMonthly={targetModel?.monthly ?? null}
              sqMonthly={sqModel.monthly}
              rows={rows}
              startingARR={plan.startingARR}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Null-safe value helper ────────────────────────────────────

function safeVal(v: number | undefined | null): number {
  if (v === undefined || v === null || isNaN(v)) return 0;
  return v;
}

// ── Quarterly Gap View ───────────────────────────────────────

function QuarterlyGapView({ targetQuarterly, sqQuarterly, rows, startingARR }: {
  targetQuarterly: EngineQuarterlyResult[] | null;
  sqQuarterly: EngineQuarterlyResult[];
  rows: GapRow[];
  startingARR: number;
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-20"></th>
          {sqQuarterly.map((q) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500 w-28">
              {q.quarter}
            </th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-28">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const planVals = targetQuarterly ? targetQuarterly.map((q) => safeVal(row.getQuarterly(q))) : [0, 0, 0, 0];
          const sqVals = sqQuarterly.map((q) => safeVal(row.getQuarterly(q)));
          const planTotal = row.isConstant ? planVals[0] : planVals.reduce((s, v) => s + v, 0);
          const sqTotal = row.isConstant ? sqVals[0] : sqVals.reduce((s, v) => s + v, 0);

          return (
            <React.Fragment key={`${row.label}-${idx}`}>
              {/* Target row (blue) */}
              <tr className={`border-b border-gray-100 ${rowBgClass(row)}`}>
                <td className={cellLabelClass(row)} rowSpan={3}>{row.label}</td>
                <td className="py-1 px-3 text-right text-[10px]">
                  <span className="text-blue-500 font-medium">Target</span>
                </td>
                {planVals.map((val, qi) => (
                  <td key={`plan-${qi}`} className="py-1 px-3 text-right text-blue-700">
                    {targetQuarterly ? row.fmt(val) : '\u2014'}
                  </td>
                ))}
                <td className="py-1 px-3 text-right text-blue-700 font-medium">
                  {targetQuarterly ? row.fmt(planTotal) : '\u2014'}
                </td>
              </tr>
              {/* Status Quo row (amber) */}
              <tr className={`border-b border-gray-50 ${rowBgClass(row)}`}>
                <td className="py-1 px-3 text-right text-[10px]">
                  <span className="text-amber-600 font-medium">SQ</span>
                </td>
                {sqVals.map((val, qi) => (
                  <td key={`sq-${qi}`} className="py-1 px-3 text-right text-amber-700">
                    {row.fmt(val)}
                  </td>
                ))}
                <td className="py-1 px-3 text-right text-amber-700 font-medium">
                  {row.fmt(sqTotal)}
                </td>
              </tr>
              {/* Delta row */}
              <tr className={`border-b border-gray-200 ${rowBgClass(row)}`}>
                <td className="py-1 px-3 text-right text-[10px]">
                  <span className="text-gray-400 font-medium">&Delta;</span>
                </td>
                {planVals.map((pVal, qi) => {
                  if (!targetQuarterly) return <td key={`delta-${qi}`} className="py-1 px-3 text-right text-gray-400">&mdash;</td>;
                  const d = formatDelta(pVal, sqVals[qi], row.fmt, row.metricType);
                  return (
                    <td key={`delta-${qi}`} className={`py-1 px-3 text-right text-[11px] font-medium ${d.color}`}>
                      {d.text}
                    </td>
                  );
                })}
                {(() => {
                  if (!targetQuarterly) return <td className="py-1 px-3 text-right text-gray-400">&mdash;</td>;
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
              <span className="text-blue-500 font-medium">Target</span>
            </td>
            {(targetQuarterly ?? sqQuarterly).map((q, qi) => (
              <td key={`arr-plan-${q.quarter}`} className="py-1 px-3 text-right text-blue-700">
                {targetQuarterly ? formatCurrencyFull(targetQuarterly[qi].endingARR) : '\u2014'}
              </td>
            ))}
            <td className="py-1 px-3 text-right text-blue-700 font-medium">
              {targetQuarterly ? formatCurrencyFull(targetQuarterly[3]?.endingARR ?? startingARR) : '\u2014'}
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
              <span className="text-gray-400 font-medium">&Delta;</span>
            </td>
            {sqQuarterly.map((q, qi) => {
              if (!targetQuarterly) return <td key={`arr-delta-${q.quarter}`} className="py-1 px-3 text-right text-gray-400">&mdash;</td>;
              const d = formatDelta(targetQuarterly[qi].endingARR, q.endingARR, formatCurrencyFull, 'currency');
              return (
                <td key={`arr-delta-${q.quarter}`} className={`py-1 px-3 text-right text-[11px] font-medium ${d.color}`}>
                  {d.text}
                </td>
              );
            })}
            {(() => {
              if (!targetQuarterly) return <td className="py-1 px-3 text-right text-gray-400">&mdash;</td>;
              const planEnd = targetQuarterly[3]?.endingARR ?? startingARR;
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

function MonthlyGapView({ targetMonthly, sqMonthly, rows, startingARR }: {
  targetMonthly: EngineMonthlyResult[] | null;
  sqMonthly: EngineMonthlyResult[];
  rows: GapRow[];
  startingARR: number;
}) {
  // Add Cumulative ARR at end
  const allRows = useMemo(() => [
    ...rows,
    {
      label: 'Cumulative ARR',
      getMonthly: (m: EngineMonthlyResult) => m.cumulativeARR,
      getQuarterly: () => 0,
      fmt: formatCurrencyFull,
      metricType: 'currency' as MetricType,
      isHighlight: true,
    } as GapRow,
  ], [rows]);

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-48">Metric</th>
          {sqMonthly.map((m) => (
            <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]">
              {formatMonthName(m.month)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {allRows.map((row, idx) => (
          <React.Fragment key={`${row.monthlyLabel || row.label}-${idx}`}>
            {/* Target row (blue) */}
            <tr className={`border-b border-gray-100 ${rowBgClass(row)}`}>
              <td className={`${cellLabelClass(row)} sticky left-0 bg-inherit`} rowSpan={3}>
                {row.monthlyLabel || row.label}
              </td>
              {sqMonthly.map((_, mi) => {
                const tMonth = targetMonthly?.[mi];
                return (
                  <td key={`plan-${mi}`} className="py-1 px-2 text-right text-blue-700">
                    {tMonth ? row.fmt(safeVal(row.getMonthly(tMonth))) : '\u2014'}
                  </td>
                );
              })}
            </tr>
            {/* Status Quo row (amber) */}
            <tr className={`border-b border-gray-50 ${rowBgClass(row)}`}>
              {sqMonthly.map((m, mi) => (
                <td key={`sq-${mi}`} className="py-1 px-2 text-right text-amber-700">
                  {row.fmt(safeVal(row.getMonthly(m)))}
                </td>
              ))}
            </tr>
            {/* Delta row */}
            <tr className={`border-b border-gray-200 ${rowBgClass(row)}`}>
              {sqMonthly.map((m, mi) => {
                const tMonth = targetMonthly?.[mi];
                if (!tMonth) return <td key={`delta-${mi}`} className="py-1 px-2 text-right text-gray-400">&mdash;</td>;
                const pVal = safeVal(row.getMonthly(tMonth));
                const sVal = safeVal(row.getMonthly(m));
                const d = formatDelta(pVal, sVal, row.fmt, row.metricType);
                return (
                  <td key={`delta-${mi}`} className={`py-1 px-2 text-right text-[11px] font-medium ${d.color}`}>
                    {d.text}
                  </td>
                );
              })}
            </tr>
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}
