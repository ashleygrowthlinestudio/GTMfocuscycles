'use client';

import React, { useState, useMemo } from 'react';
import type { MonthlyResult, QuarterlyResult, RevenueBreakdown, PlanningMode, Month, MonthlyActuals } from '@/lib/types';
import type { PipelineTimingMap } from '@/lib/engine';
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
}

type ViewMode = 'quarterly' | 'monthly';

export default function RevenueTable({ monthly, quarterly, startingARR, label, targets, planningMode, currentMonth, detailedActuals, planMonthly, planQuarterly, pipelineTimingMap }: RevenueTableProps) {
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

      <div className="overflow-x-auto">
        {viewMode === 'quarterly' ? (
          <QuarterlyView quarterly={quarterly} startingARR={startingARR} targets={targets} isInYear={isInYear} currentMonth={currentMonth} detailedActuals={detailedActuals} showVariance={showVariance} planQuarterly={planQuarterly} pipelineTimingMap={pipelineTimingMap} />
        ) : (
          <MonthlyView monthly={monthly} startingARR={startingARR} targets={targets} isInYear={isInYear} currentMonth={currentMonth} detailedActuals={detailedActuals} showVariance={showVariance} planMonthly={planMonthly} pipelineTimingMap={pipelineTimingMap} />
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
};

function buildRows(targets?: RevenueBreakdown): TableRow[] {
  const rows: TableRow[] = [];

  // ── Inbound channel group (funnel order: top → bottom) ──
  // 1. HIS Volume (top of funnel)
  rows.push(
    { label: 'HIS Volume', getMonthly: (m) => m.hisRequired, getQuarterly: (q) => q.hisRequired, fmt: formatNumber },
  );
  // 2. HIS → Pipeline Rate (secondary)
  if (targets) {
    const ib = targets.newBusiness.inbound;
    rows.push(
      { label: 'HIS → Pipeline Rate', getMonthly: () => ib.hisToPipelineRate, getQuarterly: () => ib.hisToPipelineRate, fmt: formatPercent, isSecondary: true, isConstant: true },
    );
  }
  // 3. Qualified Pipeline Created $
  rows.push(
    { label: 'Inbound Qualified Pipeline $', monthlyLabel: 'IB Qualified Pipeline', getMonthly: (m) => m.inboundPipelineCreated, getQuarterly: (q) => q.inboundPipelineCreated, fmt: formatCurrencyFull },
  );
  // 4-6. Win Rate, ACV, Sales Cycle (secondary)
  if (targets) {
    const ib = targets.newBusiness.inbound;
    rows.push(
      { label: 'Win Rate', getMonthly: () => ib.winRate, getQuarterly: () => ib.winRate, fmt: formatPercent, isSecondary: true, isConstant: true },
      { label: 'ACV', getMonthly: () => ib.acv, getQuarterly: () => ib.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
      { label: 'Sales Cycle', getMonthly: () => ib.salesCycleMonths, getQuarterly: () => ib.salesCycleMonths, fmt: (v) => `${v} mo`, isSecondary: true, isConstant: true },
    );
  }
  // 7. Inbound Closed Won $
  rows.push(
    { label: 'Inbound Closed Won', getMonthly: (m) => m.inboundClosedWon, getQuarterly: (q) => q.inboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true },
  );
  // 8. Inbound New Customers
  rows.push(
    {
      label: 'Inbound New Customers',
      getMonthly: (m) => m.inboundDeals,
      getQuarterly: (q) => q.months.reduce((s, m) => s + m.inboundDeals, 0),
      fmt: formatNumber,
    },
  );

  // ── Outbound channel group (funnel order) ──
  // 1. Qualified Pipeline Created $
  rows.push(
    { label: 'Outbound Qualified Pipeline $', monthlyLabel: 'OB Qualified Pipeline', getMonthly: (m) => m.outboundPipelineCreated, getQuarterly: (q) => q.outboundPipelineCreated, fmt: formatCurrencyFull },
  );
  // 2-4. Win Rate, ACV, Sales Cycle (secondary)
  if (targets) {
    const ob = targets.newBusiness.outbound;
    rows.push(
      { label: 'Win Rate', getMonthly: () => ob.winRate, getQuarterly: () => ob.winRate, fmt: formatPercent, isSecondary: true, isConstant: true },
      { label: 'ACV', getMonthly: () => ob.acv, getQuarterly: () => ob.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
      { label: 'Sales Cycle', getMonthly: () => ob.salesCycleMonths, getQuarterly: () => ob.salesCycleMonths, fmt: (v) => `${v} mo`, isSecondary: true, isConstant: true },
    );
  }
  // 5. Outbound Closed Won $
  rows.push(
    { label: 'Outbound Closed Won', getMonthly: (m) => m.outboundClosedWon, getQuarterly: (q) => q.outboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true },
  );
  // 6. Outbound New Customers
  rows.push(
    {
      label: 'Outbound New Customers',
      getMonthly: (m) => m.outboundDeals,
      getQuarterly: (q) => q.months.reduce((s, m) => s + m.outboundDeals, 0),
      fmt: formatNumber,
    },
  );

  // ── New Product Inbound group (same order as Inbound) ──
  rows.push(
    { label: 'NP Inbound HIS Volume', monthlyLabel: 'NP IB HIS Volume', getMonthly: (m) => m.newProductHisRequired, getQuarterly: (q) => q.newProductHisRequired, fmt: formatNumber },
  );
  if (targets) {
    const npIb = targets.newProduct.inbound;
    rows.push(
      { label: 'HIS → Pipeline Rate', getMonthly: () => npIb.hisToPipelineRate, getQuarterly: () => npIb.hisToPipelineRate, fmt: formatPercent, isSecondary: true, isConstant: true },
    );
  }
  rows.push(
    { label: 'NP Inbound Qualified Pipeline $', monthlyLabel: 'NP IB Qual. Pipeline', getMonthly: (m) => m.newProductInboundPipelineCreated, getQuarterly: (q) => q.newProductInboundPipelineCreated, fmt: formatCurrencyFull },
  );
  if (targets) {
    const npIb = targets.newProduct.inbound;
    rows.push(
      { label: 'Win Rate', getMonthly: () => npIb.winRate, getQuarterly: () => npIb.winRate, fmt: formatPercent, isSecondary: true, isConstant: true },
      { label: 'ACV', getMonthly: () => npIb.acv, getQuarterly: () => npIb.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
      { label: 'Sales Cycle', getMonthly: () => npIb.salesCycleMonths, getQuarterly: () => npIb.salesCycleMonths, fmt: (v) => `${v} mo`, isSecondary: true, isConstant: true },
    );
  }
  rows.push(
    { label: 'New Product Inbound Won', monthlyLabel: 'NP Inbound Won', getMonthly: (m) => m.newProductInboundClosedWon, getQuarterly: (q) => q.newProductInboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true },
  );
  rows.push(
    {
      label: 'New Product Inbound Customers',
      monthlyLabel: 'NP Inbound Customers',
      getMonthly: (m) => m.newProductInboundDeals,
      getQuarterly: (q) => q.months.reduce((s, m) => s + m.newProductInboundDeals, 0),
      fmt: formatNumber,
    },
  );

  // ── New Product Outbound group (same order as Outbound) ──
  rows.push(
    { label: 'NP Outbound Qualified Pipeline $', monthlyLabel: 'NP OB Qual. Pipeline', getMonthly: (m) => m.newProductOutboundPipelineCreated, getQuarterly: (q) => q.newProductOutboundPipelineCreated, fmt: formatCurrencyFull },
  );
  if (targets) {
    const npOb = targets.newProduct.outbound;
    rows.push(
      { label: 'Win Rate', getMonthly: () => npOb.winRate, getQuarterly: () => npOb.winRate, fmt: formatPercent, isSecondary: true, isConstant: true },
      { label: 'ACV', getMonthly: () => npOb.acv, getQuarterly: () => npOb.acv, fmt: formatCurrencyFull, isSecondary: true, isConstant: true },
      { label: 'Sales Cycle', getMonthly: () => npOb.salesCycleMonths, getQuarterly: () => npOb.salesCycleMonths, fmt: (v) => `${v} mo`, isSecondary: true, isConstant: true },
    );
  }
  rows.push(
    { label: 'New Product Outbound Won', monthlyLabel: 'NP Outbound Won', getMonthly: (m) => m.newProductOutboundClosedWon, getQuarterly: (q) => q.newProductOutboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true },
  );
  rows.push(
    {
      label: 'New Product Outbound Customers',
      monthlyLabel: 'NP Outbound Customers',
      getMonthly: (m) => m.newProductOutboundDeals,
      getQuarterly: (q) => q.months.reduce((s, m) => s + m.newProductOutboundDeals, 0),
      fmt: formatNumber,
    },
  );

  // ── Expansion group (rate first, then revenue, then customers) ──
  if (targets) {
    rows.push(
      { label: 'Expansion Rate', getMonthly: () => targets.expansion.expansionRate, getQuarterly: () => targets.expansion.expansionRate, fmt: formatPercent, isSecondary: true, isConstant: true },
    );
  }
  rows.push(
    { label: 'Expansion Revenue', getMonthly: (m) => m.expansionRevenue, getQuarterly: (q) => q.expansionRevenue, fmt: formatCurrencyFull, isPurple: true },
  );
  rows.push(
    {
      label: 'Expansion Customers',
      getMonthly: (m) => {
        const acv = targets?.newBusiness.inbound.acv || targets?.newBusiness.outbound.acv || 50000;
        return acv > 0 ? m.expansionRevenue / acv : 0;
      },
      getQuarterly: (q) => {
        const acv = targets?.newBusiness.inbound.acv || targets?.newBusiness.outbound.acv || 50000;
        return acv > 0 ? q.expansionRevenue / acv : 0;
      },
      fmt: formatNumber,
    },
  );

  // ── Churn group (rate first, then revenue, then customers) ──
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
    { label: 'Total New ARR', monthlyLabel: 'Net New ARR', getMonthly: (m) => m.totalNewARR, getQuarterly: (q) => q.totalNewARR, fmt: formatCurrencyFull, isHighlight: true },
  );

  return rows;
}

/* ── Planning mode helpers ────────────────────────────────── */

function ActBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-green-100 text-green-700 leading-none align-middle">ACT</span>;
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

function QuarterlyView({ quarterly, startingARR, targets, isInYear, currentMonth, detailedActuals, showVariance, planQuarterly, pipelineTimingMap }: { quarterly: QuarterlyResult[]; startingARR: number; targets?: RevenueBreakdown; isInYear?: boolean; currentMonth?: Month; detailedActuals?: MonthlyActuals[]; showVariance?: boolean; planQuarterly?: QuarterlyResult[]; pipelineTimingMap?: PipelineTimingMap }) {
  const rows = useMemo(() => buildRows(targets), [targets]);
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
        <span className="text-green-700">{row.fmt(actVal)} <span className="text-[9px] font-medium text-green-600">ACT</span></span>
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
          const quarterValues: number[] = quarterly.map((q) => row.getQuarterly(q));

          const total = row.isConstant
            ? quarterValues[0]
            : quarterValues.reduce((s, v) => s + v, 0);

          // Plan values for variance
          const planQuarterValues = planQuarterly ? planQuarterly.map((q) => row.getQuarterly(q)) : null;

          return (
            <React.Fragment key={`${row.label}-${idx}`}>
              <tr
                className={`border-b border-gray-100 ${rowBgClass(row)}`}
              >
                <td className={cellLabelClass(row)}>
                  {row.label}
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

function MonthlyView({ monthly, startingARR, targets, isInYear, currentMonth, detailedActuals, showVariance, planMonthly, pipelineTimingMap }: { monthly: MonthlyResult[]; startingARR: number; targets?: RevenueBreakdown; isInYear?: boolean; currentMonth?: Month; detailedActuals?: MonthlyActuals[]; showVariance?: boolean; planMonthly?: MonthlyResult[]; pipelineTimingMap?: PipelineTimingMap }) {
  const rows = useMemo(() => {
    const base = buildRows(targets);
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
          {monthly.map((m) => (
            <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]">
              {formatMonthName(m.month)}
              {isInYear && (m.month < cm ? <ActBadge /> : <PlanBadge />)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <React.Fragment key={`${row.monthlyLabel || row.label}-${idx}`}>
            <tr
              className={`border-b border-gray-100 ${rowBgClass(row)}`}
            >
              <td className={`${cellLabelClass(row)} sticky left-0 bg-inherit`}>
                {row.monthlyLabel || row.label}
              </td>
              {monthly.map((m) => {
                const isAct = isInYear && m.month < cm;
                const val = row.getMonthly(m);
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
        ))}
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
