'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, runModelWithBets, applyChannelConfig } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatMonthName } from '@/lib/format';
import type { MonthlyResult, QuarterlyResult } from '@/lib/types';

type ViewMode = 'quarterly' | 'monthly';

// ── Month name helper ────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ── ACT/PLAN badges ──────────────────────────────────────────

function ActBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-green-100 text-green-700 leading-none align-middle print:bg-transparent print:border print:border-green-700">ACT</span>;
}

function PlanBadge() {
  return <span className="inline-block ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 leading-none align-middle print:bg-transparent print:border print:border-blue-700">PLAN</span>;
}

// ── Main Component ───────────────────────────────────────────

export default function ExecutiveSummary() {
  const { plan } = useGTMPlan();
  const cc = plan.channelConfig;
  const isInYear = plan.planningMode === 'in-year';
  const cm = plan.currentMonth ?? 1;
  const [goalsView, setGoalsView] = useState<ViewMode>('quarterly');

  // Plan model (Revenue Targets)
  const effectiveTargets = useMemo(
    () => applyChannelConfig(plan.targets, cc, 'targets'),
    [plan.targets, cc],
  );
  const planModel = useMemo(
    () => runModel(effectiveTargets, plan.seasonality, { rampMonths: 1, startMonth: 1 }, plan.startingARR, plan.existingPipeline),
    [effectiveTargets, plan.seasonality, plan.startingARR, plan.existingPipeline],
  );

  // Status Quo model (historical trend)
  const flatSeasonality = useMemo(() => ({
    monthly: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 1.0])) as Record<number, number>,
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

  // With Bets model (per-month ramped bets)
  const enabledBets = plan.strategicBets.filter((b) => b.enabled);
  const withBetsModel = useMemo(
    () => runModelWithBets(effectiveHistorical, plan.strategicBets, plan.seasonality, { rampMonths: 1, startMonth: 1 }, plan.startingARR, plan.existingPipeline),
    [effectiveHistorical, plan.strategicBets, plan.seasonality, plan.startingARR, plan.existingPipeline],
  );

  // Key numbers
  const sqARR = sqModel.endingARR;
  const planARR = planModel.endingARR;
  const withBetsARR = withBetsModel.endingARR;
  const gapToClose = plan.targetARR - sqARR;
  const totalNewARRNeeded = plan.targetARR - plan.startingARR;
  const growthPct = plan.startingARR > 0 ? ((totalNewARRNeeded / plan.startingARR) * 100).toFixed(0) : '0';

  // Gap between SQ and target closed by bets
  const betsImpact = withBetsARR - sqARR;
  const gapClosedPct = gapToClose > 0 ? Math.min(100, Math.round((betsImpact / gapToClose) * 100)) : 100;

  // Progress bar percentages
  const range = Math.max(plan.targetARR, withBetsARR, sqARR) - plan.startingARR;
  const sqPct = range > 0 ? ((sqARR - plan.startingARR) / range) * 100 : 0;
  const betsPct = range > 0 ? ((withBetsARR - plan.startingARR) / range) * 100 : 0;
  const targetPct = range > 0 ? ((plan.targetARR - plan.startingARR) / range) * 100 : 100;

  // Key actions: find top 3 gaps between plan and status quo
  const keyActions = useMemo(() => {
    const gaps: { label: string; current: number; target: number; delta: number; fmt: (v: number) => string }[] = [];
    const pm = planModel.monthly;
    const sm = sqModel.monthly;

    const sumM = (arr: MonthlyResult[], fn: (m: MonthlyResult) => number) => arr.reduce((s, m) => s + fn(m), 0);

    if (cc.hasInbound) {
      const planVal = sumM(pm, (m) => m.inboundPipelineCreated);
      const sqVal = sumM(sm, (m) => m.inboundPipelineCreated);
      gaps.push({ label: 'inbound qualified pipeline', current: sqVal, target: planVal, delta: planVal - sqVal, fmt: formatCurrency });
    }
    if (cc.hasOutbound) {
      const planVal = sumM(pm, (m) => m.outboundPipelineCreated);
      const sqVal = sumM(sm, (m) => m.outboundPipelineCreated);
      gaps.push({ label: 'outbound qualified pipeline', current: sqVal, target: planVal, delta: planVal - sqVal, fmt: formatCurrency });
    }
    if (cc.hasInbound) {
      const planVal = sumM(pm, (m) => m.inboundClosedWon);
      const sqVal = sumM(sm, (m) => m.inboundClosedWon);
      gaps.push({ label: 'inbound closed-won revenue', current: sqVal, target: planVal, delta: planVal - sqVal, fmt: formatCurrency });
    }
    if (cc.hasOutbound) {
      const planVal = sumM(pm, (m) => m.outboundClosedWon);
      const sqVal = sumM(sm, (m) => m.outboundClosedWon);
      gaps.push({ label: 'outbound closed-won revenue', current: sqVal, target: planVal, delta: planVal - sqVal, fmt: formatCurrency });
    }
    if (cc.hasNewProduct) {
      const planVal = sumM(pm, (m) => m.newProductInboundClosedWon + m.newProductOutboundClosedWon);
      const sqVal = sumM(sm, (m) => m.newProductInboundClosedWon + m.newProductOutboundClosedWon);
      gaps.push({ label: 'new product revenue', current: sqVal, target: planVal, delta: planVal - sqVal, fmt: formatCurrency });
    }
    if (cc.hasExpansion) {
      const planVal = sumM(pm, (m) => m.expansionRevenue);
      const sqVal = sumM(sm, (m) => m.expansionRevenue);
      gaps.push({ label: 'expansion revenue', current: sqVal, target: planVal, delta: planVal - sqVal, fmt: formatCurrency });
    }
    if (cc.hasInbound) {
      const planVal = sumM(pm, (m) => m.hisRequired);
      const sqVal = sumM(sm, (m) => m.hisRequired);
      gaps.push({ label: 'high-intent submissions volume', current: sqVal, target: planVal, delta: planVal - sqVal, fmt: (v: number) => Math.round(v).toLocaleString() });
    }

    return gaps
      .filter((g) => g.delta > 0 && g.current > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);
  }, [planModel, sqModel, cc]);

  // Planning mode subtitle
  const modeText = isInYear
    ? `In-Year Reforecast as of ${MONTH_NAMES[(cm ?? 1) - 1]}`
    : 'Future Year';

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          header, nav, [data-tab-nav], [data-header], .no-print { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-break { page-break-before: always; }
          .print-container { padding: 2rem; }
        }
      `}</style>

      <div className="print-container space-y-10">
        {/* Export button */}
        <div className="flex justify-end no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Export to PDF
          </button>
        </div>

        {/* ── Section 1: Plan Overview ───────────────────────── */}
        <section>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {plan.name || 'GTM'} Focus Cycle — {plan.planYear}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Plan period: {plan.planYear} — {modeText}
          </p>

          <div className="grid grid-cols-3 gap-6 mt-6">
            <div className="text-center p-6 rounded-xl bg-gray-50 border border-gray-200">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Starting ARR</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(plan.startingARR)}</div>
            </div>
            <div className="text-center p-6 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Target ARR</div>
              <div className="text-3xl font-bold text-blue-900 mt-2">{formatCurrency(plan.targetARR)}</div>
            </div>
            <div className={`text-center p-6 rounded-xl border ${gapToClose > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className={`text-xs font-medium uppercase tracking-wide ${gapToClose > 0 ? 'text-red-600' : 'text-green-600'}`}>
                Gap to Close
              </div>
              <div className={`text-3xl font-bold mt-2 ${gapToClose > 0 ? 'text-red-900' : 'text-green-900'}`}>
                {formatCurrency(Math.abs(gapToClose))}
              </div>
              <div className={`text-xs mt-1 ${gapToClose > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {gapToClose > 0 ? 'short of target' : 'above target'}
              </div>
            </div>
          </div>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 2: The Goal ────────────────────────────── */}
        <section className="print-break">
          <h2 className="text-lg font-bold text-gray-900">The Goal</h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            To reach <span className="font-semibold text-gray-900">{formatCurrency(plan.targetARR)}</span> by
            end of {plan.planYear}, we need to add{' '}
            <span className="font-semibold text-gray-900">{formatCurrency(totalNewARRNeeded)}</span> in net
            new ARR — <span className="font-semibold text-gray-900">{growthPct}%</span> growth from our
            starting point of <span className="font-semibold text-gray-900">{formatCurrency(plan.startingARR)}</span>.
          </p>

          {/* QoQ Goals Table */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Revenue Goals</h3>
              <div className="flex gap-1 bg-gray-200 rounded-md p-0.5 no-print">
                <button
                  onClick={() => setGoalsView('quarterly')}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                    goalsView === 'quarterly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Quarterly
                </button>
                <button
                  onClick={() => setGoalsView('monthly')}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                    goalsView === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            {goalsView === 'quarterly' ? (
              <GoalsTableQuarterly quarterly={planModel.quarterly} cc={cc} isInYear={isInYear} cm={cm} />
            ) : (
              <GoalsTableMonthly monthly={planModel.monthly} cc={cc} isInYear={isInYear} cm={cm} />
            )}
          </div>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 3: Where We Are Today ──────────────────── */}
        <section className="print-break">
          <h2 className="text-lg font-bold text-gray-900">Where We Are Today</h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            At current performance levels, we project{' '}
            <span className="font-semibold text-gray-900">{formatCurrency(sqARR)}</span> by year end —{' '}
            <span className={`font-semibold ${gapToClose > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {formatCurrency(Math.abs(gapToClose))}
            </span>{' '}
            {gapToClose > 0 ? 'short of' : 'above'} target.
          </p>

          {/* Condensed Plan vs SQ delta table — quarterly, top metrics only */}
          <div className="mt-4 overflow-x-auto">
            <StatusQuoDeltaTable planQ={planModel.quarterly} sqQ={sqModel.quarterly} cc={cc} />
          </div>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 4: Strategic Bets ──────────────────────── */}
        {enabledBets.length > 0 && (
          <>
            <section className="print-break">
              <h2 className="text-lg font-bold text-gray-900">
                Our {enabledBets.length} Strategic Bet{enabledBets.length !== 1 ? 's' : ''}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {enabledBets.map((bet) => {
                  const perBetImpact = enabledBets.length > 0 ? betsImpact / enabledBets.length : 0;
                  const isPct = ['winRate', 'hisToPipelineRate', 'expansionRate', 'monthlyChurnRate'].includes(bet.metric);
                  const isMix = bet.metric.endsWith('MixPct');
                  const fmtVal = (v: number) => {
                    if (isPct || isMix) return `${(v * 100).toFixed(1)}%`;
                    if (['acv', 'pipelineMonthly'].includes(bet.metric)) return formatCurrencyFull(v);
                    if (bet.metric === 'salesCycleMonths') return `${v} mo`;
                    return v.toFixed(0);
                  };

                  return (
                    <div key={bet.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <h4 className="text-sm font-semibold text-gray-800">{bet.name}</h4>
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <span className="text-gray-500">{fmtVal(bet.currentValue)}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-blue-700">{fmtVal(bet.improvedValue)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        This bet adds an estimated{' '}
                        <span className="font-medium text-green-700">{formatCurrency(Math.max(0, perBetImpact))}</span> in
                        ARR by year end
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Combined impact */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">
                  Combined, these bets close{' '}
                  <span className="font-bold text-gray-900">{gapClosedPct}%</span> of the gap between
                  status quo and target.
                </p>

                {/* Progress bar: SQ → With Bets → Target */}
                <div className="mt-3 relative h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-400 rounded-l-full"
                    style={{ width: `${Math.min(100, sqPct)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-green-500"
                    style={{ width: `${Math.min(100, betsPct)}%` }}
                  />
                  {targetPct <= 100 && (
                    <div
                      className="absolute inset-y-0 w-0.5 bg-blue-700"
                      style={{ left: `${targetPct}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Status Quo: {formatCurrency(sqARR)}</span>
                  <span className="text-green-700 font-medium">With Bets: {formatCurrency(withBetsARR)}</span>
                  <span className="text-blue-700 font-medium">Target: {formatCurrency(plan.targetARR)}</span>
                </div>
              </div>
            </section>

            <hr className="border-gray-200" />
          </>
        )}

        {/* ── Section 5: Key Actions Needed ──────────────────── */}
        {keyActions.length > 0 && (
          <section className="print-break">
            <h2 className="text-lg font-bold text-gray-900">Key Actions Needed</h2>
            <p className="text-sm text-gray-500 mt-1">To achieve plan, focus on:</p>

            <ul className="mt-4 space-y-3">
              {keyActions.map((action, i) => {
                const pctIncrease = action.current > 0 ? Math.round(((action.target - action.current) / action.current) * 100) : 0;
                return (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-700">
                      Grow <span className="font-medium text-gray-900">{action.label}</span> from{' '}
                      <span className="font-medium">{action.fmt(action.current)}</span> (current) to{' '}
                      <span className="font-medium text-blue-700">{action.fmt(action.target)}</span> (plan)
                      {pctIncrease > 0 && (
                        <span className="text-gray-500"> — a {pctIncrease}% increase</span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

// ── Goals Table (Quarterly) ──────────────────────────────────

function GoalsTableQuarterly({ quarterly, cc, isInYear, cm }: {
  quarterly: QuarterlyResult[];
  cc: { hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean };
  isInYear: boolean;
  cm: number;
}) {
  const quarterMonths: Record<string, number[]> = { Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12] };

  function badges(q: QuarterlyResult) {
    if (!isInYear) return null;
    const months = quarterMonths[q.quarter] || [];
    const actualCount = months.filter((m) => m < cm).length;
    if (actualCount === 3) return <ActBadge />;
    if (actualCount === 0) return <PlanBadge />;
    return <><ActBadge /><PlanBadge /></>;
  }

  type Row = { label: string; values: number[]; total: number };
  const rows: Row[] = [];

  const add = (label: string, getter: (q: QuarterlyResult) => number) => {
    const values = quarterly.map(getter);
    rows.push({ label, values, total: values.reduce((s, v) => s + v, 0) });
  };

  add('Total New ARR', (q) => q.totalNewARR);
  if (cc.hasInbound) add('Inbound Closed Won', (q) => q.inboundClosedWon);
  if (cc.hasOutbound) add('Outbound Closed Won', (q) => q.outboundClosedWon);
  if (cc.hasNewProduct) add('New Product', (q) => q.newProductInboundClosedWon + q.newProductOutboundClosedWon);
  if (cc.hasExpansion) add('Expansion', (q) => q.expansionRevenue);
  if (cc.hasChurn) add('Churn', (q) => q.churnRevenue);

  return (
    <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-44">Metric</th>
          {quarterly.map((q) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500">
              {q.quarter}{badges(q)}
            </th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.label} className={`border-b border-gray-100 ${i === 0 ? 'bg-blue-50 font-semibold' : ''}`}>
            <td className={`py-1.5 px-3 ${i === 0 ? 'text-gray-800' : 'text-gray-700'}`}>{row.label}</td>
            {row.values.map((v, qi) => (
              <td key={qi} className="py-1.5 px-3 text-right text-gray-900">{formatCurrencyFull(v)}</td>
            ))}
            <td className="py-1.5 px-3 text-right font-medium text-gray-900">{formatCurrencyFull(row.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Goals Table (Monthly) ────────────────────────────────────

function GoalsTableMonthly({ monthly, cc, isInYear, cm }: {
  monthly: MonthlyResult[];
  cc: { hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean };
  isInYear: boolean;
  cm: number;
}) {
  type Row = { label: string; values: number[] };
  const rows: Row[] = [];

  const add = (label: string, getter: (m: MonthlyResult) => number) => {
    rows.push({ label, values: monthly.map(getter) });
  };

  add('Total New ARR', (m) => m.totalNewARR);
  if (cc.hasInbound) add('Inbound Closed Won', (m) => m.inboundClosedWon);
  if (cc.hasOutbound) add('Outbound Closed Won', (m) => m.outboundClosedWon);
  if (cc.hasNewProduct) add('New Product', (m) => m.newProductInboundClosedWon + m.newProductOutboundClosedWon);
  if (cc.hasExpansion) add('Expansion', (m) => m.expansionRevenue);
  if (cc.hasChurn) add('Churn', (m) => m.churnRevenue);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-44">Metric</th>
            {monthly.map((m) => (
              <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[72px]">
                {formatMonthName(m.month)}
                {isInYear && (m.month < cm ? <ActBadge /> : <PlanBadge />)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={`border-b border-gray-100 ${i === 0 ? 'bg-blue-50 font-semibold' : ''}`}>
              <td className={`py-1.5 px-3 sticky left-0 bg-inherit ${i === 0 ? 'text-gray-800' : 'text-gray-700'}`}>{row.label}</td>
              {row.values.map((v, mi) => (
                <td key={mi} className="py-1.5 px-2 text-right text-gray-900">{formatCurrencyFull(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Status Quo Delta Table (condensed quarterly) ─────────────

function StatusQuoDeltaTable({ planQ, sqQ, cc }: {
  planQ: QuarterlyResult[];
  sqQ: QuarterlyResult[];
  cc: { hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean };
}) {
  type Metric = { label: string; getPlan: (q: QuarterlyResult) => number; getSq: (q: QuarterlyResult) => number };
  const metrics: Metric[] = [];

  if (cc.hasInbound) {
    metrics.push({ label: 'Inbound Closed Won', getPlan: (q) => q.inboundClosedWon, getSq: (q) => q.inboundClosedWon });
    metrics.push({ label: 'Inbound Customers', getPlan: (q) => q.months.reduce((s, m) => s + m.inboundDeals, 0), getSq: (q) => q.months.reduce((s, m) => s + m.inboundDeals, 0) });
  }
  if (cc.hasOutbound) {
    metrics.push({ label: 'Outbound Closed Won', getPlan: (q) => q.outboundClosedWon, getSq: (q) => q.outboundClosedWon });
    metrics.push({ label: 'Outbound Customers', getPlan: (q) => q.months.reduce((s, m) => s + m.outboundDeals, 0), getSq: (q) => q.months.reduce((s, m) => s + m.outboundDeals, 0) });
  }
  if (cc.hasNewProduct) {
    metrics.push({ label: 'New Product Won', getPlan: (q) => q.newProductInboundClosedWon + q.newProductOutboundClosedWon, getSq: (q) => q.newProductInboundClosedWon + q.newProductOutboundClosedWon });
  }
  if (cc.hasExpansion) {
    metrics.push({ label: 'Expansion Revenue', getPlan: (q) => q.expansionRevenue, getSq: (q) => q.expansionRevenue });
  }
  if (cc.hasChurn) {
    metrics.push({ label: 'Churn Revenue', getPlan: (q) => q.churnRevenue, getSq: (q) => q.churnRevenue });
  }

  const isCurrencyRow = (label: string) => label.includes('Won') || label.includes('Revenue');
  const fmtCell = (label: string, v: number) => isCurrencyRow(label) ? formatCurrencyFull(v) : Math.round(v).toLocaleString();

  return (
    <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-44">Metric</th>
          <th className="text-left py-2 px-2 font-medium text-gray-500 w-14"></th>
          {planQ.map((q) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500">{q.quarter}</th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500">Total</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((metric) => {
          const planVals = planQ.map((q) => metric.getPlan(q));
          const sqVals = sqQ.map((q) => metric.getSq(q));
          const planTotal = planVals.reduce((s, v) => s + v, 0);
          const sqTotal = sqVals.reduce((s, v) => s + v, 0);

          return (
            <React.Fragment key={metric.label}>
              {/* Plan row */}
              <tr className="border-b border-gray-50">
                <td className="py-1 px-3 text-gray-700 font-medium" rowSpan={3}>{metric.label}</td>
                <td className="py-1 px-2 text-[10px] text-blue-600 font-medium">Plan</td>
                {planVals.map((v, i) => (
                  <td key={i} className="py-1 px-3 text-right text-blue-700">{fmtCell(metric.label, v)}</td>
                ))}
                <td className="py-1 px-3 text-right text-blue-700 font-medium">{fmtCell(metric.label, planTotal)}</td>
              </tr>
              {/* SQ row */}
              <tr className="border-b border-gray-50">
                <td className="py-1 px-2 text-[10px] text-amber-600 font-medium">SQ</td>
                {sqVals.map((v, i) => (
                  <td key={i} className="py-1 px-3 text-right text-amber-700">{fmtCell(metric.label, v)}</td>
                ))}
                <td className="py-1 px-3 text-right text-amber-700 font-medium">{fmtCell(metric.label, sqTotal)}</td>
              </tr>
              {/* Delta row */}
              <tr className="border-b border-gray-200">
                <td className="py-1 px-2 text-[10px] text-gray-400 font-medium">Δ</td>
                {planVals.map((pv, i) => {
                  const d = pv - sqVals[i];
                  const color = d > 0 ? 'text-green-600' : d < 0 ? 'text-red-500' : 'text-gray-400';
                  return (
                    <td key={i} className={`py-1 px-3 text-right text-[11px] font-medium ${color}`}>
                      {d > 0 ? '+' : ''}{fmtCell(metric.label, d)}
                    </td>
                  );
                })}
                {(() => {
                  const d = planTotal - sqTotal;
                  const color = d > 0 ? 'text-green-600' : d < 0 ? 'text-red-500' : 'text-gray-400';
                  return (
                    <td className={`py-1 px-3 text-right text-[11px] font-medium ${color}`}>
                      {d > 0 ? '+' : ''}{fmtCell(metric.label, d)}
                    </td>
                  );
                })()}
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
