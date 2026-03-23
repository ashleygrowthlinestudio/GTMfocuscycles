'use client';

import React, { useState, useMemo } from 'react';
import type { MonthlyResult, QuarterlyResult, RevenueBreakdown, PlanningMode, Month, MonthlyActuals, StrategicBet, MarketInsight, ChannelConfig } from '@/lib/types';
import type { PipelineTimingMap } from '@/lib/engine';
import { getBetRampPct, getInsightsForMonth } from '@/lib/engine';
import { formatCurrencyFull, formatPercent, formatNumber, formatMonthName } from '@/lib/format';

interface RevenueTableProps {
  monthly: MonthlyResult[];
  quarterly: QuarterlyResult[];
  startingARR: number;
  label?: string;
  targets?: RevenueBreakdown;
  planningMode?: PlanningMode;
  currentMonth?: Month;
  detailedActuals?: MonthlyActuals[];
  planMonthly?: MonthlyResult[];
  planQuarterly?: QuarterlyResult[];
  pipelineTimingMap?: PipelineTimingMap;
  bets?: StrategicBet[];
  marketInsights?: MarketInsight[];
  channelConfig?: ChannelConfig;
}

type ViewMode = 'quarterly' | 'monthly';

export default function RevenueTable({ monthly, quarterly, startingARR, label, targets, planningMode, currentMonth, detailedActuals, planMonthly, planQuarterly, pipelineTimingMap, bets, marketInsights, channelConfig }: RevenueTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');
  const [showVariance, setShowVariance] = useState(false);
  const isInYear = planningMode === 'in-year';
  const hasVarianceData = !!(planMonthly && planQuarterly);

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{label || 'Revenue Projections'}</h3>
        <div className="flex items-center gap-3">
          {hasVarianceData && (
            <button
              onClick={() => setShowVariance(!showVariance)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                showVariance ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {showVariance ? 'Hide Variance' : 'Show Variance'}
            </button>
          )}
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
      </div>

      {channelConfig && (channelConfig.hasEmergingInbound || channelConfig.hasEmergingOutbound || channelConfig.hasEmergingNewProduct) && (
        <div className="mx-3 my-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-amber-600 text-xs">✦</span>
          <span className="text-xs text-amber-700">
            Emerging channel{(Number(channelConfig.hasEmergingInbound) + Number(channelConfig.hasEmergingOutbound) + Number(channelConfig.hasEmergingNewProduct)) > 1 ? 's' : ''} active — no historical data, projections based on targets only
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        {viewMode === 'quarterly' ? (
          <QuarterlyView quarterly={quarterly} startingARR={startingARR} targets={targets} isInYear={isInYear} currentMonth={currentMonth} detailedActuals={detailedActuals} showVariance={showVariance} planQuarterly={planQuarterly} pipelineTimingMap={pipelineTimingMap} channelConfig={channelConfig} />
        ) : (
          <MonthlyView monthly={monthly} startingARR={startingARR} targets={targets} isInYear={isInYear} currentMonth={currentMonth} detailedActuals={detailedActuals} showVariance={showVariance} planMonthly={planMonthly} pipelineTimingMap={pipelineTimingMap} bets={bets} marketInsights={marketInsights} channelConfig={channelConfig} />
        )}
      </div>
    </div>
  );
}

/* ── Row type definitions ─────────────────────────────────── */

type TableRow = {
  label: string;
  monthlyLabel?: string; // shorter label for monthly view
  getMonthly: (m: MonthlyResult) => number;
  getQuarterly: (q: QuarterlyResult) => number;
  fmt: (v: number) => string;
  isSecondary?: boolean; // italic, muted gray, constant rate
  isChurn?: boolean;
  isHighlight?: boolean;
  isClosedWon?: boolean; // purple highlight for closed-won rows
  isPurple?: boolean;    // purple highlight for expansion/churn revenue
  isConstant?: boolean;  // don't sum for total/annual column
  isEmerging?: boolean;  // emerging channel — show badge
  showGrowth?: boolean;  // show QoQ/MoM growth sub-row
  isEmergingHeader?: boolean; // amber section header for emerging channel
  isEmergingNote?: boolean;   // amber italic note row
  isWalkToMath?: boolean;     // walk-to-math read-only row
  walkToText?: string;        // text for walk-to-math row
};

function buildRows(targets?: RevenueBreakdown, cc?: ChannelConfig): TableRow[] {
  const rows: TableRow[] = [];
  const isEmergingIB = cc?.hasEmergingInbound ?? false;
  const isEmergingOB = cc?.hasEmergingOutbound ?? false;
  const isEmergingNP = cc?.hasEmergingNewProduct ?? false;

  // Helper: build walk-to-math text for a funnel
  function walkTo(pipeline: number, winRate: number): string {
    return `${formatCurrencyFull(pipeline)} pipeline x ${formatPercent(winRate)} win rate = ${formatCurrencyFull(pipeline * winRate)} closed won (est.)`;
  }
  // Dummy row for headers/notes — values are always 0
  const ZERO = () => 0;

  // ── Inbound channel group (funnel order: top → bottom) ──
  if (isEmergingIB) {
    rows.push({ label: '✦ Inbound — Emerging (Target Assumptions)', getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isEmergingHeader: true, isConstant: true });
  }
  rows.push(
    { label: 'HIS Volume', getMonthly: (m) => m.hisRequired, getQuarterly: (q) => q.hisRequired, fmt: formatNumber, isEmerging: isEmergingIB },
  );
  if (targets) {
    const ib = targets.newBusiness.inbound;
    rows.push(
      { label: 'HIS → Pipeline Rate', getMonthly: () => ib.hisToPipelineRate, getQuarterly: () => ib.hisToPipelineRate, fmt: formatPercent, isSecondary: true, isConstant: true, isEmerging: isEmergingIB },
    );
  }
  rows.push(
    { label: 'Inbound Qualified Pipeline $', monthlyLabel: 'IB Qualified Pipeline', getMonthly: (m) => m.inboundPipelineCreated, getQuarterly: (q) => q.inboundPipelineCreated, fmt: formatCurrencyFull, showGrowth: true, isEmerging: isEmergingIB },
  );
  if (targets) {
    const ib = targets.newBusiness.inbound;
    rows.push(
      { label: 'Win Rate', getMonthly: () => ib.winRate, getQuarterly: () => ib.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, isEmerging: isEmergingIB },
      { label: 'ACV', getMonthly: () => ib.acv, getQuarterly: () => ib.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, isEmerging: isEmergingIB },
      { label: 'Sales Cycle', getMonthly: () => ib.salesCycleMonths, getQuarterly: () => ib.salesCycleMonths, fmt: (v) => `${v} mo`, isSecondary: true, isConstant: true, isEmerging: isEmergingIB },
    );
    if (isEmergingIB) {
      rows.push({ label: '~ Target assumptions — no historical baseline', getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isEmergingNote: true, isConstant: true });
      rows.push({ label: 'Walk-to Math', walkToText: walkTo(ib.hisMonthly * ib.hisToPipelineRate * ib.acv, ib.winRate), getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isWalkToMath: true, isConstant: true });
    }
  }
  rows.push(
    { label: 'Inbound Closed Won', getMonthly: (m) => m.inboundClosedWon, getQuarterly: (q) => q.inboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true, showGrowth: true, isEmerging: isEmergingIB },
  );
  rows.push(
    { label: 'Inbound New Customers', getMonthly: (m) => m.inboundDeals, getQuarterly: (q) => q.months.reduce((s, m) => s + m.inboundDeals, 0), fmt: formatNumber, showGrowth: true, isEmerging: isEmergingIB },
  );

  // ── Outbound channel group ──
  if (isEmergingOB) {
    rows.push({ label: '✦ Outbound — Emerging (Target Assumptions)', getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isEmergingHeader: true, isConstant: true });
  }
  rows.push(
    { label: 'Outbound Qualified Pipeline $', monthlyLabel: 'OB Qualified Pipeline', getMonthly: (m) => m.outboundPipelineCreated, getQuarterly: (q) => q.outboundPipelineCreated, fmt: formatCurrencyFull, showGrowth: true, isEmerging: isEmergingOB },
  );
  if (targets) {
    const ob = targets.newBusiness.outbound;
    rows.push(
      { label: 'Win Rate', getMonthly: () => ob.winRate, getQuarterly: () => ob.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, isEmerging: isEmergingOB },
      { label: 'ACV', getMonthly: () => ob.acv, getQuarterly: () => ob.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, isEmerging: isEmergingOB },
      { label: 'Sales Cycle', getMonthly: () => ob.salesCycleMonths, getQuarterly: () => ob.salesCycleMonths, fmt: (v) => `${v} mo`, isSecondary: true, isConstant: true, isEmerging: isEmergingOB },
    );
    if (isEmergingOB) {
      rows.push({ label: '~ Target assumptions — no historical baseline', getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isEmergingNote: true, isConstant: true });
      rows.push({ label: 'Walk-to Math', walkToText: walkTo(ob.pipelineMonthly, ob.winRate), getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isWalkToMath: true, isConstant: true });
    }
  }
  rows.push(
    { label: 'Outbound Closed Won', getMonthly: (m) => m.outboundClosedWon, getQuarterly: (q) => q.outboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true, showGrowth: true, isEmerging: isEmergingOB },
  );
  rows.push(
    { label: 'Outbound New Customers', getMonthly: (m) => m.outboundDeals, getQuarterly: (q) => q.months.reduce((s, m) => s + m.outboundDeals, 0), fmt: formatNumber, showGrowth: true, isEmerging: isEmergingOB },
  );

  // ── New Product Inbound group ──
  if (isEmergingNP) {
    rows.push({ label: '✦ New Product — Emerging (Target Assumptions)', getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isEmergingHeader: true, isConstant: true });
  }
  rows.push(
    { label: 'NP Inbound Qualified Pipeline $', monthlyLabel: 'NP IB Qual. Pipeline', getMonthly: (m) => m.newProductInboundPipelineCreated, getQuarterly: (q) => q.newProductInboundPipelineCreated, fmt: formatCurrencyFull, showGrowth: true, isEmerging: isEmergingNP },
  );
  if (targets) {
    const npIb = targets.newProduct.inbound;
    rows.push(
      { label: 'Win Rate', getMonthly: () => npIb.winRate, getQuarterly: () => npIb.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, isEmerging: isEmergingNP },
      { label: 'ACV', getMonthly: () => npIb.acv, getQuarterly: () => npIb.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, isEmerging: isEmergingNP },
      { label: 'Sales Cycle', getMonthly: () => npIb.salesCycleMonths, getQuarterly: () => npIb.salesCycleMonths, fmt: (v) => `${v} mo`, isSecondary: true, isConstant: true, isEmerging: isEmergingNP },
    );
    if (isEmergingNP) {
      rows.push({ label: '~ Target assumptions — no historical baseline', getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isEmergingNote: true, isConstant: true });
      rows.push({ label: 'Walk-to Math', walkToText: walkTo(npIb.hisMonthly * npIb.hisToPipelineRate * npIb.acv, npIb.winRate), getMonthly: ZERO, getQuarterly: ZERO, fmt: () => '', isWalkToMath: true, isConstant: true });
    }
  }
  rows.push(
    { label: 'New Product Inbound Won', monthlyLabel: 'NP Inbound Won', getMonthly: (m) => m.newProductInboundClosedWon, getQuarterly: (q) => q.newProductInboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true, showGrowth: true, isEmerging: isEmergingNP },
  );
  rows.push(
    { label: 'New Product Inbound Customers', monthlyLabel: 'NP Inbound Customers', getMonthly: (m) => m.newProductInboundDeals, getQuarterly: (q) => q.months.reduce((s, m) => s + m.newProductInboundDeals, 0), fmt: formatNumber, showGrowth: true, isEmerging: isEmergingNP },
  );

  // ── New Product Outbound group ──
  rows.push(
    { label: 'NP Outbound Qualified Pipeline $', monthlyLabel: 'NP OB Qual. Pipeline', getMonthly: (m) => m.newProductOutboundPipelineCreated, getQuarterly: (q) => q.newProductOutboundPipelineCreated, fmt: formatCurrencyFull, showGrowth: true, isEmerging: isEmergingNP },
  );
  if (targets) {
    const npOb = targets.newProduct.outbound;
    rows.push(
      { label: 'Win Rate', getMonthly: () => npOb.winRate, getQuarterly: () => npOb.winRate, fmt: formatPercent, isSecondary: true, isConstant: true, isEmerging: isEmergingNP },
      { label: 'ACV', getMonthly: () => npOb.acv, getQuarterly: () => npOb.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true, isEmerging: isEmergingNP },
      { label: 'Sales Cycle', getMonthly: () => npOb.salesCycleMonths, getQuarterly: () => npOb.salesCycleMonths, fmt: (v) => `${v} mo`, isSecondary: true, isConstant: true, isEmerging: isEmergingNP },
    );
  }
  rows.push(
    { label: 'New Product Outbound Won', monthlyLabel: 'NP Outbound Won', getMonthly: (m) => m.newProductOutboundClosedWon, getQuarterly: (q) => q.newProductOutboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true, showGrowth: true, isEmerging: isEmergingNP },
  );
  rows.push(
    { label: 'New Product Outbound Customers', monthlyLabel: 'NP Outbound Customers', getMonthly: (m) => m.newProductOutboundDeals, getQuarterly: (q) => q.months.reduce((s, m) => s + m.newProductOutboundDeals, 0), fmt: formatNumber, showGrowth: true, isEmerging: isEmergingNP },
  );

  // ── Expansion group ──
  if (targets) {
    rows.push(
      { label: 'Expansion Pipeline $', getMonthly: () => targets.expansion.pipelineMonthly ?? 0, getQuarterly: () => targets.expansion.pipelineMonthly ?? 0, fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
      { label: 'Expansion Win Rate', getMonthly: () => targets.expansion.winRate ?? 0, getQuarterly: () => targets.expansion.winRate ?? 0, fmt: formatPercent, isSecondary: true, isConstant: true },
      { label: 'Expansion ACV', getMonthly: () => targets.expansion.acv ?? 0, getQuarterly: () => targets.expansion.acv ?? 0, fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
      { label: 'Expansion Sales Cycle', getMonthly: () => targets.expansion.salesCycleMonths ?? 0, getQuarterly: () => targets.expansion.salesCycleMonths ?? 0, fmt: (v) => `${v ?? 0} mo`, isSecondary: true, isConstant: true },
    );
  }
  rows.push(
    { label: 'Expansion Revenue', getMonthly: (m) => m.expansionRevenue, getQuarterly: (q) => q.expansionRevenue, fmt: formatCurrencyFull, isPurple: true, showGrowth: true },
  );
  rows.push(
    {
      label: 'Expansion Customers',
      getMonthly: (m) => {
        const acv = targets?.expansion?.acv || targets?.newBusiness.inbound.acv || targets?.newBusiness.outbound.acv || 50000;
        return acv > 0 ? m.expansionRevenue / acv : 0;
      },
      getQuarterly: (q) => {
        const acv = targets?.expansion?.acv || targets?.newBusiness.inbound.acv || targets?.newBusiness.outbound.acv || 50000;
        return acv > 0 ? q.expansionRevenue / acv : 0;
      },
      fmt: formatNumber,
    },
  );

  // ── Churn group ──
  if (targets) {
    rows.push(
      { label: 'Churn Rate', getMonthly: () => targets.churn.monthlyChurnRate, getQuarterly: () => targets.churn.monthlyChurnRate, fmt: formatPercent, isSecondary: true, isConstant: true, isChurn: true },
    );
  }
  rows.push(
    { label: 'Churn Revenue', getMonthly: (m) => m.churnRevenue, getQuarterly: (q) => q.churnRevenue, fmt: formatCurrencyFull, isChurn: true, isPurple: true },
  );
  rows.push(
    {
      label: 'Churned Customers',
      getMonthly: (m) => {
        const acv = targets?.newBusiness.inbound.acv || targets?.newBusiness.outbound.acv || 50000;
        return acv > 0 ? m.churnRevenue / acv : 0;
      },
      getQuarterly: (q) => {
        const acv = targets?.newBusiness.inbound.acv || targets?.newBusiness.outbound.acv || 50000;
        return acv > 0 ? q.churnRevenue / acv : 0;
      },
      fmt: formatNumber,
      isChurn: true,
    },
  );

  // ── Totals ──
  rows.push(
    { label: 'Total New ARR', monthlyLabel: 'Net New ARR', getMonthly: (m) => m.totalNewARR, getQuarterly: (q) => q.totalNewARR, fmt: formatCurrencyFull, isHighlight: true, showGrowth: true },
  );

  return rows;
}

/* ── Growth formatting (QoQ / MoM) ───────────────────────── */

function formatGrowth(current: number, previous: number, fmt: (v: number) => string): { text: string; color: string } {
  const delta = current - previous;
  if (previous === 0 && current === 0) return { text: '—', color: 'text-gray-300' };
  const sign = delta >= 0 ? '+' : '-';
  const arrow = delta >= 0 ? '↑' : '↓';
  const pctChange = previous !== 0 ? Math.abs(delta / previous) * 100 : 0;
  const pctStr = previous !== 0 ? ` (${sign}${pctChange.toFixed(0)}%)` : '';
  return {
    text: `${arrow} ${sign}${fmt(Math.abs(delta))}${pctStr}`,
    color: delta >= 0 ? 'text-green-600' : 'text-red-500',
  };
}

/* ── Planning mode helpers ────────────────────────────────── */

function ActBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-green-100 text-green-700 leading-none align-middle">ACT 🔒</span>;
}

function PlanBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 leading-none align-middle">PLAN</span>;
}

/* ── Variance formatting ─────────────────────────────────── */

function formatVariance(diff: number, fmt: (v: number) => string): { text: string; color: string } {
  if (diff === 0) return { text: 'vs Plan: $0', color: 'text-gray-400' };
  const sign = diff > 0 ? '+' : '-';
  const formatted = fmt(Math.abs(diff));
  return {
    text: `vs Plan: ${sign}${formatted}`,
    color: diff > 0 ? 'text-green-600' : 'text-red-500',
  };
}

/* ── Quarter status helpers ───────────────────────────────── */

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

/** Sum only the actual (completed) months within a quarter for a given row */
function sumActualMonths(q: QuarterlyResult, cm: number, getMonthly: (m: MonthlyResult) => number): number {
  return q.months.filter((m) => m.month < cm).reduce((s, m) => s + getMonthly(m), 0);
}

/** Sum only the projected (future) months within a quarter for a given row */
function sumProjectedMonths(q: QuarterlyResult, cm: number, getMonthly: (m: MonthlyResult) => number): number {
  return q.months.filter((m) => m.month >= cm).reduce((s, m) => s + getMonthly(m), 0);
}

/* ── Pipeline timing clock icon ──────────────────────────────── */

function PipelineClockIcon({ status, tooltip }: { status: 'green' | 'amber' | 'red'; tooltip: string }) {
  const colorMap = { green: 'text-green-500', amber: 'text-amber-500', red: 'text-red-500' };
  return (
    <span className={`inline-block ml-1 cursor-help ${colorMap[status]}`} title={tooltip}>
      <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  );
}

/* ── Quarterly View ───────────────────────────────────────── */

function QuarterlyView({ quarterly, startingARR, targets, isInYear, currentMonth, detailedActuals, showVariance, planQuarterly, pipelineTimingMap, channelConfig }: { quarterly: QuarterlyResult[]; startingARR: number; targets?: RevenueBreakdown; isInYear?: boolean; currentMonth?: Month; detailedActuals?: MonthlyActuals[]; showVariance?: boolean; planQuarterly?: QuarterlyResult[]; pipelineTimingMap?: PipelineTimingMap; channelConfig?: ChannelConfig }) {
  const rows = useMemo(() => buildRows(targets, channelConfig), [targets, channelConfig]);
  const cm = currentMonth ?? 1;

  const quarterStatuses = useMemo(
    () => quarterly.map((q) => getQuarterStatus(q.quarter, cm)),
    [quarterly, cm],
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

  // Check if a quarter has any completed months
  function quarterHasActual(qi: number): boolean {
    return quarterStatuses[qi] !== 'all-projected';
  }

  /** Render the cell content for a quarterly value */
  function renderQuarterCell(row: TableRow, qi: number, val: number) {
    const status = quarterStatuses[qi];

    // Not in-year mode or constant rows: just show the value
    if (!isInYear || row.isSecondary || row.isConstant) {
      return row.fmt(val);
    }

    // All actual: show total with green tint
    if (status === 'all-actual') {
      return <span className="text-green-700">{row.fmt(val)}</span>;
    }

    // All projected: show total as-is
    if (status === 'all-projected') {
      return row.fmt(val);
    }

    // Mixed quarter: show ACT / PROJ split
    const q = quarterly[qi];
    const actVal = sumActualMonths(q, cm, row.getMonthly);
    const projVal = sumProjectedMonths(q, cm, row.getMonthly);
    return (
      <span className="flex flex-col items-end gap-0.5 leading-tight">
        <span className="text-green-700">{row.fmt(actVal)} <span className="text-[9px] font-medium text-green-600">ACT 🔒</span></span>
        <span className="text-blue-700">{row.fmt(projVal)} <span className="text-[9px] font-medium text-blue-600">PLAN</span></span>
      </span>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-24">Start</th>
          {quarterly.map((q, qi) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500 w-28">
              {q.quarter}{quarterBadges(qi)}
            </th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-28">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          // ── Special rows: emerging header, note, walk-to-math ──
          if (row.isEmergingHeader) {
            return (
              <tr key={`${row.label}-${idx}`} className="border-b border-amber-200 bg-amber-50">
                <td colSpan={quarterly.length + 3} className="py-1.5 px-3 text-xs font-semibold text-amber-800 border-l-2 border-amber-400">
                  {row.label}
                </td>
              </tr>
            );
          }
          if (row.isEmergingNote) {
            return (
              <tr key={`${row.label}-${idx}`} className="border-b border-amber-100 bg-amber-50/50">
                <td colSpan={quarterly.length + 3} className="py-1 px-3 pl-6 text-[10px] italic text-amber-600 border-l-2 border-amber-300">
                  {row.label}
                </td>
              </tr>
            );
          }
          if (row.isWalkToMath) {
            return (
              <tr key={`${row.label}-${idx}`} className="border-b border-amber-100 bg-amber-50/30">
                <td colSpan={quarterly.length + 3} className="py-1 px-3 pl-6 text-[10px] font-mono text-amber-700 border-l-2 border-amber-300">
                  {row.walkToText}
                </td>
              </tr>
            );
          }

          const quarterValues: number[] = quarterly.map((q) => row.getQuarterly(q));

          const total = row.isConstant
            ? quarterValues[0]
            : quarterValues.reduce((s, v) => s + v, 0);

          // Plan values for variance
          const planQuarterValues = planQuarterly ? planQuarterly.map((q) => row.getQuarterly(q)) : null;
          const emergingBorder = row.isEmerging ? ' border-l-2 border-amber-300' : '';

          return (
            <React.Fragment key={`${row.label}-${idx}`}>
              <tr
                className={`border-b border-gray-100 ${rowBgClass(row)}${emergingBorder}`}
              >
                <td className={cellLabelClass(row)}>
                  {row.label}
                  {row.isEmerging && !row.isSecondary && <span className="ml-1 text-[9px] text-amber-600">✦</span>}
                  {pipelineTimingMap?.[row.label] && (() => {
                    const entries = Object.values(pipelineTimingMap[row.label]);
                    const worst = entries.find((e) => e.status === 'red') || entries.find((e) => e.status === 'amber') || entries[0];
                    return worst ? <PipelineClockIcon status={worst.status} tooltip={worst.tooltip} /> : null;
                  })()}
                </td>
                <td className="py-1.5 px-3 text-right text-gray-400">
                  {row.isSecondary ? '' : '—'}
                </td>
                {quarterValues.map((val, qi) => (
                  <td key={quarterly[qi].quarter} className={cellValueClass(row)}>
                    {renderQuarterCell(row, qi, val)}
                  </td>
                ))}
                <td className={`${cellValueClass(row)} font-medium`}>
                  {row.fmt(total)}
                </td>
              </tr>
              {/* QoQ growth sub-row */}
              {row.showGrowth && !row.isConstant && (
                <tr className={`border-b border-gray-50${emergingBorder}`}>
                  <td className="py-0.5 px-3 pl-6 text-gray-400 italic text-[10px]">QoQ</td>
                  <td className="py-0.5 px-3"></td>
                  {quarterValues.map((val, qi) => {
                    if (qi === 0) return <td key={`qoq-${qi}`} className="py-0.5 px-3 text-right text-gray-300 italic text-[10px]">—</td>;
                    const g = formatGrowth(val, quarterValues[qi - 1], row.fmt);
                    return <td key={`qoq-${qi}`} className={`py-0.5 px-3 text-right italic text-[10px] ${g.color}`}>{g.text}</td>;
                  })}
                  <td className="py-0.5 px-3 text-right text-gray-300 italic text-[10px]">—</td>
                </tr>
              )}
              {showVariance && planQuarterValues && !row.isSecondary && !row.isConstant && (
                <tr className="border-b border-gray-50">
                  <td className="py-0.5 px-3 pl-6 text-gray-400 italic text-[10px]">vs Plan</td>
                  <td className="py-0.5 px-3"></td>
                  {quarterValues.map((val, qi) => {
                    if (!quarterHasActual(qi)) {
                      return <td key={`var-${qi}`} className="py-0.5 px-3 text-right text-gray-300 italic text-[10px]">—</td>;
                    }
                    const diff = val - planQuarterValues[qi];
                    const v = formatVariance(diff, row.fmt);
                    return <td key={`var-${qi}`} className={`py-0.5 px-3 text-right italic text-[10px] ${v.color}`}>{v.text}</td>;
                  })}
                  <td className="py-0.5 px-3 text-right text-gray-300 italic text-[10px]">—</td>
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

/* ── Monthly View ─────────────────────────────────────────── */

function MonthlyView({ monthly, startingARR, targets, isInYear, currentMonth, detailedActuals, showVariance, planMonthly, pipelineTimingMap, bets, marketInsights, channelConfig }: { monthly: MonthlyResult[]; startingARR: number; targets?: RevenueBreakdown; isInYear?: boolean; currentMonth?: Month; detailedActuals?: MonthlyActuals[]; showVariance?: boolean; planMonthly?: MonthlyResult[]; pipelineTimingMap?: PipelineTimingMap; bets?: StrategicBet[]; marketInsights?: MarketInsight[]; channelConfig?: ChannelConfig }) {
  const rows = useMemo(() => {
    const base = buildRows(targets, channelConfig);
    // Add Cumulative ARR at end
    return [
      ...base,
      { label: 'Cumulative ARR', getMonthly: (m: MonthlyResult) => m.cumulativeARR, getQuarterly: () => 0, fmt: formatCurrencyFull, isHighlight: true } as TableRow,
    ];
  }, [targets]);

  const cm = currentMonth ?? 1;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-48">Metric</th>
          {monthly.map((m) => {
            const monthInsights = marketInsights ? getInsightsForMonth(marketInsights, m.month) : [];
            return (
              <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]">
                {formatMonthName(m.month)}
                {isInYear && (m.month < cm ? <ActBadge /> : <PlanBadge />)}
                {monthInsights.length > 0 && (
                  <span
                    className="inline-block ml-0.5 cursor-help text-amber-500"
                    title={monthInsights.map((i) => `${i.label}: ${Math.round(i.impactPct * 100)}%`).join('\n')}
                  >
                    <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                )}
              </th>
            );
          })}
        </tr>
        {/* Ramp indicator row for active bets */}
        {bets && bets.some((b) => b.enabled && (b.rampMonths ?? 3) > 1) && (
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="text-left py-0.5 px-3 text-[9px] text-gray-400 sticky left-0 bg-gray-50/50">Bet Ramp</th>
            {monthly.map((m) => {
              const rampingBets = (bets || []).filter((b) => {
                if (!b.enabled) return false;
                const pct = getBetRampPct(b, m.month);
                return pct > 0 && pct < 1;
              });
              if (rampingBets.length === 0) return <th key={m.month} className="py-0.5 px-2" />;
              const avgRamp = rampingBets.reduce((s, b) => s + getBetRampPct(b, m.month), 0) / rampingBets.length;
              const tooltip = rampingBets.map((b) => `${b.name}: ${Math.round(getBetRampPct(b, m.month) * 100)}% ramped`).join('\n');
              return (
                <th key={m.month} className="py-0.5 px-2" title={tooltip}>
                  <div className="h-1 rounded-full bg-gray-200 overflow-hidden cursor-help">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.round(avgRamp * 100)}%` }} />
                  </div>
                </th>
              );
            })}
          </tr>
        )}
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          // ── Special rows: emerging header, note, walk-to-math ──
          if (row.isEmergingHeader) {
            return (
              <tr key={`${row.label}-${idx}`} className="border-b border-amber-200 bg-amber-50">
                <td colSpan={monthly.length + 1} className="py-1.5 px-3 text-xs font-semibold text-amber-800 border-l-2 border-amber-400 sticky left-0">
                  {row.label}
                </td>
              </tr>
            );
          }
          if (row.isEmergingNote) {
            return (
              <tr key={`${row.label}-${idx}`} className="border-b border-amber-100 bg-amber-50/50">
                <td colSpan={monthly.length + 1} className="py-1 px-3 pl-6 text-[10px] italic text-amber-600 border-l-2 border-amber-300 sticky left-0">
                  {row.label}
                </td>
              </tr>
            );
          }
          if (row.isWalkToMath) {
            return (
              <tr key={`${row.label}-${idx}`} className="border-b border-amber-100 bg-amber-50/30">
                <td colSpan={monthly.length + 1} className="py-1 px-3 pl-6 text-[10px] font-mono text-amber-700 border-l-2 border-amber-300 sticky left-0">
                  {row.walkToText}
                </td>
              </tr>
            );
          }

          const emergingBorder = row.isEmerging ? ' border-l-2 border-amber-300' : '';
          const monthlyValues = monthly.map((m) => row.getMonthly(m));

          return (
            <React.Fragment key={`${row.monthlyLabel || row.label}-${idx}`}>
              <tr
                className={`border-b border-gray-100 ${rowBgClass(row)}${emergingBorder}`}
              >
                <td className={`${cellLabelClass(row)} sticky left-0 bg-inherit`}>
                  {row.monthlyLabel || row.label}
                  {row.isEmerging && !row.isSecondary && <span className="ml-1 text-[9px] text-amber-600">✦</span>}
                </td>
                {monthly.map((m, mi) => {
                  const isAct = isInYear && m.month < cm;
                  const val = monthlyValues[mi];
                  const timing = pipelineTimingMap?.[row.label]?.[m.month];
                  return (
                    <td key={m.month} className={`${cellValueClass(row, true)}${isAct && !row.isSecondary && !row.isConstant ? ' bg-green-50/50' : ''}`}>
                      {isAct && !row.isSecondary && !row.isConstant
                        ? <span className="text-green-700">{row.fmt(val)}</span>
                        : row.fmt(val)
                      }
                      {timing && <PipelineClockIcon status={timing.status} tooltip={timing.tooltip} />}
                    </td>
                  );
                })}
              </tr>
              {/* MoM growth sub-row */}
              {row.showGrowth && !row.isConstant && (
                <tr className={`border-b border-gray-50${emergingBorder}`}>
                  <td className="py-0.5 px-3 pl-6 text-gray-400 italic text-[10px] sticky left-0 bg-white">MoM</td>
                  {monthlyValues.map((val, mi) => {
                    if (mi === 0) return <td key={`mom-${mi}`} className="py-0.5 px-2 text-right text-gray-300 italic text-[10px]">—</td>;
                    const g = formatGrowth(val, monthlyValues[mi - 1], row.fmt);
                    return <td key={`mom-${mi}`} className={`py-0.5 px-2 text-right italic text-[10px] ${g.color}`}>{g.text}</td>;
                  })}
                </tr>
              )}
              {showVariance && planMonthly && !row.isSecondary && !row.isConstant && (
                <tr className="border-b border-gray-50">
                  <td className="py-0.5 px-3 pl-6 text-gray-400 italic text-[10px] sticky left-0 bg-white">vs Plan</td>
                  {monthly.map((m, mi) => {
                    if (m.month >= cm) {
                      return <td key={`var-${mi}`} className="py-0.5 px-2 text-right text-gray-300 italic text-[10px]">—</td>;
                    }
                    const actual = row.getMonthly(m);
                    const plan = planMonthly[mi] ? row.getMonthly(planMonthly[mi]) : 0;
                    const diff = actual - plan;
                    const v = formatVariance(diff, row.fmt);
                    return <td key={`var-${mi}`} className={`py-0.5 px-2 text-right italic text-[10px] ${v.color}`}>{v.text}</td>;
                  })}
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/* ── Styling helpers ──────────────────────────────────────── */

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
