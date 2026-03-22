'use client';

import React, { useState, useMemo } from 'react';
import type { MonthlyResult, QuarterlyResult, RevenueBreakdown, PlanningMode, Month, MonthlyActuals } from '@/lib/types';
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
}

type ViewMode = 'quarterly' | 'monthly';

export default function RevenueTable({ monthly, quarterly, startingARR, label, targets, planningMode, currentMonth, detailedActuals }: RevenueTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');
  const isInYear = planningMode === 'in-year';

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{label || 'Revenue Projections'}</h3>
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
          <QuarterlyView quarterly={quarterly} startingARR={startingARR} targets={targets} isInYear={isInYear} currentMonth={currentMonth} detailedActuals={detailedActuals} />
        ) : (
          <MonthlyView monthly={monthly} startingARR={startingARR} targets={targets} isInYear={isInYear} currentMonth={currentMonth} detailedActuals={detailedActuals} />
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
    { label: 'Expansion Revenue', getMonthly: (m) => m.expansionRevenue, getQuarterly: (q) => q.expansionRevenue, fmt: formatCurrencyFull },
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
    { label: 'Churn Revenue', getMonthly: (m) => m.churnRevenue, getQuarterly: (q) => q.churnRevenue, fmt: formatCurrencyFull, isChurn: true },
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

function ProjBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 leading-none align-middle">PROJ</span>;
}

function getActualForMonth(month: Month, detailedActuals?: MonthlyActuals[]): MonthlyActuals | undefined {
  return detailedActuals?.find((a) => a.month === month);
}

/** Map a TableRow getter key to the corresponding MonthlyActuals field */
function getActualValue(row: TableRow, actual: MonthlyActuals): number | undefined {
  const map: Record<string, keyof MonthlyActuals> = {
    'Inbound Closed Won': 'inboundClosedWon',
    'Outbound Closed Won': 'outboundClosedWon',
    'New Product Inbound Won': 'newProductInboundClosedWon',
    'New Product Outbound Won': 'newProductOutboundClosedWon',
    'Inbound Qualified Pipeline $': 'inboundPipelineCreated',
    'Outbound Qualified Pipeline $': 'outboundPipelineCreated',
    'Expansion Revenue': 'expansionRevenue',
    'Churn Revenue': 'churnRevenue',
    'Total New ARR': 'totalNewARR',
    'Cumulative ARR': 'cumulativeARR',
  };
  const field = map[row.label];
  if (field) return actual[field] as number;
  return undefined;
}

/* ── Quarterly View ───────────────────────────────────────── */

function QuarterlyView({ quarterly, startingARR, targets, isInYear, currentMonth, detailedActuals }: { quarterly: QuarterlyResult[]; startingARR: number; targets?: RevenueBreakdown; isInYear?: boolean; currentMonth?: Month; detailedActuals?: MonthlyActuals[] }) {
  const rows = useMemo(() => buildRows(targets), [targets]);
  const cm = currentMonth ?? 1;

  // Determine quarter status for badges
  const quarterMonths: Record<string, Month[]> = {
    Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12],
  };

  function quarterBadges(quarter: string) {
    if (!isInYear) return null;
    const months = quarterMonths[quarter] || [];
    const hasActual = months.some((m) => m < cm);
    const hasProjected = months.some((m) => m >= cm);
    return (
      <span>
        {hasActual && <ActBadge />}
        {hasProjected && <ProjBadge />}
      </span>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-24">Start</th>
          {quarterly.map((q) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500 w-28">
              {q.quarter}{quarterBadges(q.quarter)}
            </th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500 w-28">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          // For in-year mode, blend actuals into quarterly values
          let quarterValues: number[] = quarterly.map((q) => row.getQuarterly(q));

          if (isInYear && !row.isSecondary && !row.isConstant) {
            quarterValues = quarterly.map((q) => {
              const months = q.months;
              return months.reduce((sum, m) => {
                if (m.month < cm) {
                  const actual = getActualForMonth(m.month as Month, detailedActuals);
                  if (actual) {
                    const av = getActualValue(row, actual);
                    if (av !== undefined) return sum + av;
                  }
                }
                return sum + row.getMonthly(m);
              }, 0);
            });
          }

          const total = row.isConstant
            ? quarterValues[0]
            : quarterValues.reduce((s, v) => s + v, 0);

          return (
            <tr
              key={`${row.label}-${idx}`}
              className={`border-b border-gray-100 ${row.isHighlight ? 'bg-blue-50 font-semibold' : row.isClosedWon ? 'bg-purple-50 font-semibold' : ''}`}
            >
              <td className={cellLabelClass(row)}>{row.label}</td>
              <td className="py-1.5 px-3 text-right text-gray-400">
                {row.isSecondary ? '' : '—'}
              </td>
              {quarterValues.map((val, qi) => (
                <td key={quarterly[qi].quarter} className={cellValueClass(row)}>
                  {row.fmt(val)}
                </td>
              ))}
              <td className={`${cellValueClass(row)} font-medium`}>
                {row.fmt(total)}
              </td>
            </tr>
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

function MonthlyView({ monthly, startingARR, targets, isInYear, currentMonth, detailedActuals }: { monthly: MonthlyResult[]; startingARR: number; targets?: RevenueBreakdown; isInYear?: boolean; currentMonth?: Month; detailedActuals?: MonthlyActuals[] }) {
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
              {isInYear && (m.month < cm ? <ActBadge /> : <ProjBadge />)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={`${row.monthlyLabel || row.label}-${idx}`}
            className={`border-b border-gray-100 ${row.isHighlight ? 'bg-blue-50 font-semibold' : row.isClosedWon ? 'bg-purple-50 font-semibold' : ''}`}
          >
            <td className={`${cellLabelClass(row)} sticky left-0 bg-inherit`}>
              {row.monthlyLabel || row.label}
            </td>
            {monthly.map((m) => {
              let value = row.getMonthly(m);
              if (isInYear && m.month < cm && !row.isSecondary && !row.isConstant) {
                const actual = getActualForMonth(m.month as Month, detailedActuals);
                if (actual) {
                  const av = getActualValue(row, actual);
                  if (av !== undefined) value = av;
                }
              }
              return (
                <td key={m.month} className={cellValueClass(row, true)}>
                  {row.fmt(value)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Styling helpers ──────────────────────────────────────── */

function cellLabelClass(row: TableRow): string {
  if (row.isSecondary) return 'py-1 px-3 pl-6 text-gray-400 italic text-[11px]';
  if (row.isHighlight) return 'py-1.5 px-3 text-gray-700';
  if (row.isClosedWon) return 'py-1.5 px-3 text-purple-900';
  if (row.isChurn) return 'py-1.5 px-3 text-red-700';
  return 'py-1.5 px-3 text-gray-700';
}

function cellValueClass(row: TableRow, isMonthly = false): string {
  const px = isMonthly ? 'px-2' : 'px-3';
  if (row.isSecondary) return `py-1 ${px} text-right text-gray-400 italic text-[11px]`;
  if (row.isClosedWon) return `py-1.5 ${px} text-right text-purple-900`;
  if (row.isChurn) return `py-1.5 ${px} text-right text-red-600`;
  return `py-1.5 ${px} text-right text-gray-900`;
}
