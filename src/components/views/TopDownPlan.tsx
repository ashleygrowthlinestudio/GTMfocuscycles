'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, applyChannelConfig } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatPercent, formatNumber, formatMonthName } from '@/lib/format';
import RevenueTable from '@/components/shared/RevenueTable';
import type { RampConfig, MonthlyResult, QuarterlyResult, RevenueBreakdown, ChannelConfig } from '@/lib/types';

const DEFAULT_RAMP: RampConfig = { rampMonths: 1, startMonth: 1 };

export default function TopDownPlan() {
  const { plan } = useGTMPlan();
  const cc = plan.channelConfig;

  const effectiveTargets = useMemo(
    () => applyChannelConfig(plan.targets, cc, 'targets'),
    [plan.targets, cc],
  );

  const model = useMemo(
    () => runModel(effectiveTargets, plan.seasonality, DEFAULT_RAMP, plan.startingARR, plan.existingPipeline),
    [effectiveTargets, plan.seasonality, plan.startingARR, plan.existingPipeline],
  );

  const projectedEnd = model.endingARR;
  const gap = plan.targetARR - projectedEnd;

  const averageACV = useMemo(() => {
    const acvs: number[] = [];
    if (cc.hasInbound && plan.targets.newBusiness.inbound.acv > 0) acvs.push(plan.targets.newBusiness.inbound.acv);
    if (cc.hasOutbound && plan.targets.newBusiness.outbound.acv > 0) acvs.push(plan.targets.newBusiness.outbound.acv);
    if (cc.hasNewProduct) {
      if (plan.targets.newProduct.inbound.acv > 0) acvs.push(plan.targets.newProduct.inbound.acv);
      if (plan.targets.newProduct.outbound.acv > 0) acvs.push(plan.targets.newProduct.outbound.acv);
    }
    return acvs.length > 0 ? acvs.reduce((a, b) => a + b, 0) / acvs.length : 50_000;
  }, [plan.targets, cc]);

  return (
    <div className="space-y-6">
      {/* Top-level summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Starting ARR" value={formatCurrency(plan.startingARR)} color="gray" />
        <SummaryCard label="Target ARR" value={formatCurrency(plan.targetARR)} color="blue" />
        <SummaryCard label="Projected ARR" value={formatCurrency(projectedEnd)} color="green" />
        <SummaryCard
          label="Gap to Target"
          value={formatCurrency(Math.abs(gap))}
          color={gap > 0 ? 'red' : 'green'}
          suffix={gap > 0 ? 'short' : 'above'}
        />
      </div>

      {/* Revenue output table */}
      <RevenueTable
        monthly={model.monthly}
        quarterly={model.quarterly}
        startingARR={plan.startingARR}
        label="Target Revenue Projections"
        averageACV={averageACV}
      />

      {/* Walk the Math — spreadsheet view */}
      <WalkTheMathSheet
        monthly={model.monthly}
        quarterly={model.quarterly}
        targets={effectiveTargets}
        cc={cc}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Walk the Math — Spreadsheet-style expandable section
   ═══════════════════════════════════════════════════════════════ */

type SheetRow = {
  label: string;
  getMonthly: (m: MonthlyResult, idx: number) => number;
  getQuarterly: (q: QuarterlyResult) => number;
  fmt: (v: number) => string;
  isChurn?: boolean;
  isPositive?: boolean;
};

type SheetSection = {
  title: string;
  rows: SheetRow[];
  isChurnSection?: boolean;
};

function buildSections(targets: RevenueBreakdown, cc: ChannelConfig): SheetSection[] {
  const sections: SheetSection[] = [];

  // ── Inbound Core ──
  if (cc.hasInbound) {
    const ib = targets.newBusiness.inbound;
    sections.push({
      title: 'Inbound — Core Business',
      rows: [
        {
          label: 'Closed Won $',
          getMonthly: (m) => m.inboundClosedWon,
          getQuarterly: (q) => q.inboundClosedWon,
          fmt: formatCurrencyFull,
          isPositive: true,
        },
        {
          label: 'Closed Won #',
          getMonthly: (m) => m.inboundDeals,
          getQuarterly: (q) => q.months.reduce((s, m) => s + m.inboundDeals, 0),
          fmt: formatNumber,
        },
        {
          label: 'ACV',
          getMonthly: () => ib.acv,
          getQuarterly: () => ib.acv,
          fmt: formatCurrencyFull,
        },
        {
          label: 'Win Rate',
          getMonthly: () => ib.winRate,
          getQuarterly: () => ib.winRate,
          fmt: formatPercent,
        },
        {
          label: 'Sales Cycle',
          getMonthly: () => ib.salesCycleMonths,
          getQuarterly: () => ib.salesCycleMonths,
          fmt: (v) => `${v} mo`,
        },
        {
          label: 'Pipeline Created $',
          getMonthly: (m) => m.inboundPipelineCreated,
          getQuarterly: (q) => q.inboundPipelineCreated,
          fmt: formatCurrencyFull,
        },
        {
          label: 'HIS Volume',
          getMonthly: (m) => m.hisRequired,
          getQuarterly: (q) => q.hisRequired,
          fmt: formatNumber,
        },
        {
          label: 'HIS → Pipeline Rate',
          getMonthly: () => ib.hisToPipelineRate,
          getQuarterly: () => ib.hisToPipelineRate,
          fmt: formatPercent,
        },
        {
          label: 'Pipeline → Closed Won Rate',
          getMonthly: () => ib.winRate,
          getQuarterly: () => ib.winRate,
          fmt: formatPercent,
        },
        {
          label: 'Est. CAC / Spend *',
          getMonthly: (m) => m.inboundPipelineCreated * 0.15,
          getQuarterly: (q) => q.inboundPipelineCreated * 0.15,
          fmt: formatCurrencyFull,
        },
      ],
    });
  }

  // ── Outbound Core ──
  if (cc.hasOutbound) {
    const ob = targets.newBusiness.outbound;
    sections.push({
      title: 'Outbound — Core Business',
      rows: [
        {
          label: 'Closed Won $',
          getMonthly: (m) => m.outboundClosedWon,
          getQuarterly: (q) => q.outboundClosedWon,
          fmt: formatCurrencyFull,
          isPositive: true,
        },
        {
          label: 'Closed Won #',
          getMonthly: (m) => m.outboundDeals,
          getQuarterly: (q) => q.months.reduce((s, m) => s + m.outboundDeals, 0),
          fmt: formatNumber,
        },
        {
          label: 'ACV',
          getMonthly: () => ob.acv,
          getQuarterly: () => ob.acv,
          fmt: formatCurrencyFull,
        },
        {
          label: 'Win Rate',
          getMonthly: () => ob.winRate,
          getQuarterly: () => ob.winRate,
          fmt: formatPercent,
        },
        {
          label: 'Sales Cycle',
          getMonthly: () => ob.salesCycleMonths,
          getQuarterly: () => ob.salesCycleMonths,
          fmt: (v) => `${v} mo`,
        },
        {
          label: 'Pipeline Created $',
          getMonthly: (m) => m.outboundPipelineCreated,
          getQuarterly: (q) => q.outboundPipelineCreated,
          fmt: formatCurrencyFull,
        },
        {
          label: 'Pipeline → Closed Won Rate',
          getMonthly: () => ob.winRate,
          getQuarterly: () => ob.winRate,
          fmt: formatPercent,
        },
        {
          label: 'Est. CAC / Spend *',
          getMonthly: (m) => m.outboundPipelineCreated * 0.15,
          getQuarterly: (q) => q.outboundPipelineCreated * 0.15,
          fmt: formatCurrencyFull,
        },
      ],
    });
  }

  // ── New Product Inbound ──
  if (cc.hasNewProduct) {
    const npIb = targets.newProduct.inbound;
    if (npIb.hisMonthly > 0 || npIb.acv > 0) {
      sections.push({
        title: 'Inbound — New Product',
        rows: [
          {
            label: 'Closed Won $',
            getMonthly: (m) => m.newProductInboundClosedWon,
            getQuarterly: (q) => q.newProductInboundClosedWon,
            fmt: formatCurrencyFull,
            isPositive: true,
          },
          {
            label: 'Closed Won #',
            getMonthly: (m) => m.newProductInboundDeals,
            getQuarterly: (q) => q.months.reduce((s, m) => s + m.newProductInboundDeals, 0),
            fmt: formatNumber,
          },
          {
            label: 'ACV',
            getMonthly: () => npIb.acv,
            getQuarterly: () => npIb.acv,
            fmt: formatCurrencyFull,
          },
          {
            label: 'Win Rate',
            getMonthly: () => npIb.winRate,
            getQuarterly: () => npIb.winRate,
            fmt: formatPercent,
          },
          {
            label: 'Sales Cycle',
            getMonthly: () => npIb.salesCycleMonths,
            getQuarterly: () => npIb.salesCycleMonths,
            fmt: (v) => `${v} mo`,
          },
          {
            label: 'Pipeline Created $',
            getMonthly: (m) => m.newProductInboundPipelineCreated,
            getQuarterly: (q) => q.newProductInboundPipelineCreated,
            fmt: formatCurrencyFull,
          },
          {
            label: 'HIS Volume',
            getMonthly: (m) => m.newProductHisRequired,
            getQuarterly: (q) => q.newProductHisRequired,
            fmt: formatNumber,
          },
          {
            label: 'HIS → Pipeline Rate',
            getMonthly: () => npIb.hisToPipelineRate,
            getQuarterly: () => npIb.hisToPipelineRate,
            fmt: formatPercent,
          },
          {
            label: 'Pipeline → Closed Won Rate',
            getMonthly: () => npIb.winRate,
            getQuarterly: () => npIb.winRate,
            fmt: formatPercent,
          },
          {
            label: 'Est. CAC / Spend *',
            getMonthly: (m) => m.newProductInboundPipelineCreated * 0.15,
            getQuarterly: (q) => q.newProductInboundPipelineCreated * 0.15,
            fmt: formatCurrencyFull,
          },
        ],
      });
    }

    // ── New Product Outbound ──
    const npOb = targets.newProduct.outbound;
    if (npOb.pipelineMonthly > 0 || npOb.acv > 0) {
      sections.push({
        title: 'Outbound — New Product',
        rows: [
          {
            label: 'Closed Won $',
            getMonthly: (m) => m.newProductOutboundClosedWon,
            getQuarterly: (q) => q.newProductOutboundClosedWon,
            fmt: formatCurrencyFull,
            isPositive: true,
          },
          {
            label: 'Closed Won #',
            getMonthly: (m) => m.newProductOutboundDeals,
            getQuarterly: (q) => q.months.reduce((s, m) => s + m.newProductOutboundDeals, 0),
            fmt: formatNumber,
          },
          {
            label: 'ACV',
            getMonthly: () => npOb.acv,
            getQuarterly: () => npOb.acv,
            fmt: formatCurrencyFull,
          },
          {
            label: 'Win Rate',
            getMonthly: () => npOb.winRate,
            getQuarterly: () => npOb.winRate,
            fmt: formatPercent,
          },
          {
            label: 'Sales Cycle',
            getMonthly: () => npOb.salesCycleMonths,
            getQuarterly: () => npOb.salesCycleMonths,
            fmt: (v) => `${v} mo`,
          },
          {
            label: 'Pipeline Created $',
            getMonthly: (m) => m.newProductOutboundPipelineCreated,
            getQuarterly: (q) => q.newProductOutboundPipelineCreated,
            fmt: formatCurrencyFull,
          },
          {
            label: 'Pipeline → Closed Won Rate',
            getMonthly: () => npOb.winRate,
            getQuarterly: () => npOb.winRate,
            fmt: formatPercent,
          },
          {
            label: 'Est. CAC / Spend *',
            getMonthly: (m) => m.newProductOutboundPipelineCreated * 0.15,
            getQuarterly: (q) => q.newProductOutboundPipelineCreated * 0.15,
            fmt: formatCurrencyFull,
          },
        ],
      });
    }
  }

  // ── Expansion ──
  if (cc.hasExpansion) {
    sections.push({
      title: 'Expansion',
      rows: [
        {
          label: 'Expansion Revenue $',
          getMonthly: (m) => m.expansionRevenue,
          getQuarterly: (q) => q.expansionRevenue,
          fmt: formatCurrencyFull,
          isPositive: true,
        },
        {
          label: 'Monthly Rate',
          getMonthly: () => targets.expansion.expansionRate,
          getQuarterly: () => targets.expansion.expansionRate,
          fmt: formatPercent,
        },
      ],
    });
  }

  // ── Churn ──
  if (cc.hasChurn) {
    sections.push({
      title: 'Churn',
      isChurnSection: true,
      rows: [
        {
          label: 'Churn Revenue $',
          getMonthly: (m) => m.churnRevenue,
          getQuarterly: (q) => q.churnRevenue,
          fmt: formatCurrencyFull,
          isChurn: true,
        },
        {
          label: 'Monthly Rate',
          getMonthly: () => targets.churn.monthlyChurnRate,
          getQuarterly: () => targets.churn.monthlyChurnRate,
          fmt: formatPercent,
          isChurn: true,
        },
      ],
    });
  }

  return sections;
}

function WalkTheMathSheet({
  monthly,
  quarterly,
  targets,
  cc,
}: {
  monthly: MonthlyResult[];
  quarterly: QuarterlyResult[];
  targets: RevenueBreakdown;
  cc: ChannelConfig;
}) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'quarterly' | 'monthly'>('quarterly');

  const sections = useMemo(() => buildSections(targets, cc), [targets, cc]);

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700">Show how we get there</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* View toggle */}
          <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Channel-by-channel breakdown</span>
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

          {/* Spreadsheet */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                    Metric
                  </th>
                  {viewMode === 'quarterly' ? (
                    <>
                      {quarterly.map((q) => (
                        <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500 min-w-[100px]">
                          {q.quarter}
                        </th>
                      ))}
                      <th className="text-right py-2 px-3 font-medium text-gray-500 min-w-[110px]">Annual</th>
                    </>
                  ) : (
                    monthly.map((m) => (
                      <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]">
                        {formatMonthName(m.month)}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <React.Fragment key={section.title}>
                    {/* Section header */}
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <td
                        colSpan={viewMode === 'quarterly' ? 6 : 13}
                        className="py-2 px-3 font-bold text-gray-700 text-xs uppercase tracking-wide sticky left-0 bg-gray-100 z-10"
                      >
                        {section.title}
                      </td>
                    </tr>
                    {/* Data rows */}
                    {section.rows.map((row, rowIdx) => {
                      const isEven = rowIdx % 2 === 0;
                      return (
                        <tr
                          key={`${section.title}-${row.label}`}
                          className={`border-b border-gray-100 ${isEven ? 'bg-white' : 'bg-gray-50/60'}`}
                        >
                          <td className={`py-1.5 px-3 sticky left-0 z-10 ${isEven ? 'bg-white' : 'bg-gray-50'} ${row.isChurn ? 'text-red-700' : row.isPositive ? 'text-green-800 font-medium' : 'text-gray-700'}`}>
                            {row.label}
                          </td>
                          {viewMode === 'quarterly' ? (
                            <>
                              {quarterly.map((q) => (
                                <td
                                  key={q.quarter}
                                  className={`py-1.5 px-3 text-right tabular-nums ${row.isChurn ? 'text-red-600' : row.isPositive ? 'text-green-700' : 'text-gray-900'}`}
                                >
                                  {row.fmt(row.getQuarterly(q))}
                                </td>
                              ))}
                              <td className={`py-1.5 px-3 text-right font-semibold tabular-nums ${row.isChurn ? 'text-red-600' : row.isPositive ? 'text-green-700' : 'text-gray-900'}`}>
                                {row.fmt(annualTotal(row, quarterly))}
                              </td>
                            </>
                          ) : (
                            monthly.map((m, i) => (
                              <td
                                key={m.month}
                                className={`py-1.5 px-2 text-right tabular-nums ${row.isChurn ? 'text-red-600' : row.isPositive ? 'text-green-700' : 'text-gray-900'}`}
                              >
                                {row.fmt(row.getMonthly(m, i))}
                              </td>
                            ))
                          )}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footnote */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">
              * Est. CAC / Spend = Pipeline Created × 15% — rough placeholder estimate.
              Constant metrics (ACV, rates, cycle) reflect target plan inputs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Sum a row across all quarters for the annual total column */
function annualTotal(row: SheetRow, quarterly: QuarterlyResult[]): number {
  // For rate/constant rows, don't sum — return the value itself
  const v0 = row.getQuarterly(quarterly[0]);
  const v1 = row.getQuarterly(quarterly[1]);
  if (v0 === v1 && row.label !== 'Closed Won $' && row.label !== 'Closed Won #' &&
      row.label !== 'Pipeline Created $' && row.label !== 'HIS Volume' &&
      row.label !== 'Est. CAC / Spend *' && row.label !== 'Expansion Revenue $' &&
      row.label !== 'Churn Revenue $') {
    return v0; // constant — show as-is, don't sum
  }
  return quarterly.reduce((s, q) => s + row.getQuarterly(q), 0);
}

/* ── Summary Card ────────────────────────────────────────── */

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
