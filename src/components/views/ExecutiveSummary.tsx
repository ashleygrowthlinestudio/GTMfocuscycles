'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, runModelWithBets, applyChannelConfig } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatMonthName, formatPercent } from '@/lib/format';
import type { MonthlyResult, QuarterlyResult, RevenueBreakdown } from '@/lib/types';

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

  // NRR calculation from plan model
  const totalAnnualExpansion = planModel.monthly.reduce((s, m) => s + m.expansionRevenue, 0);
  const totalAnnualChurn = planModel.monthly.reduce((s, m) => s + Math.abs(m.churnRevenue), 0);
  const nrr = plan.startingARR > 0
    ? ((plan.startingARR + totalAnnualExpansion - totalAnnualChurn) / plan.startingARR) * 100
    : 100;

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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
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
            <div className={`text-center p-6 rounded-xl border ${
              nrr > 100 ? 'bg-green-50 border-green-200' : nrr < 100 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className={`text-xs font-medium uppercase tracking-wide ${
                nrr > 100 ? 'text-green-600' : nrr < 100 ? 'text-red-600' : 'text-gray-500'
              }`}>
                Implied NRR
              </div>
              <div className={`text-3xl font-bold mt-2 ${
                nrr > 100 ? 'text-green-900' : nrr < 100 ? 'text-red-900' : 'text-gray-900'
              }`}>
                {Math.round(nrr)}%
              </div>
              <div className={`text-xs mt-1 ${
                nrr > 100 ? 'text-green-600' : nrr < 100 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {nrr > 100 ? 'Existing base is expanding' : nrr < 100 ? 'Existing base is contracting' : 'Existing base is stable'}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Net Revenue Retention — what existing ARR does without new logos
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
              <GoalsTableQuarterly quarterly={planModel.quarterly} cc={cc} isInYear={isInYear} cm={cm} targets={effectiveTargets} />
            ) : (
              <GoalsTableMonthly monthly={planModel.monthly} cc={cc} isInYear={isInYear} cm={cm} targets={effectiveTargets} />
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

          {/* Full Status Quo metric table — quarterly, Plan vs SQ with deltas */}
          <div className="mt-4 overflow-x-auto">
            <StatusQuoDeltaTable planQ={planModel.quarterly} sqQ={sqModel.quarterly} cc={cc} planTargets={effectiveTargets} sqTargets={effectiveHistorical} />
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

                  // Metric label
                  const channelLabel = bet.channel === 'inbound' ? 'Inbound' : bet.channel === 'outbound' ? 'Outbound' : '';
                  const catLabel = bet.category === 'newProduct' ? 'New Product ' : '';
                  const metricLabels: Record<string, string> = {
                    winRate: 'Win Rate', salesCycleMonths: 'Sales Cycle', hisToPipelineRate: 'HIS→Pipeline Rate',
                    hisMonthly: 'HIS Volume', pipelineMonthly: 'Pipeline/mo', acv: 'ACV',
                    expansionRate: 'Expansion Rate', monthlyChurnRate: 'Churn Rate',
                  };
                  const metricLabel = `${catLabel}${channelLabel}${channelLabel ? ' ' : ''}${metricLabels[bet.metric] || bet.metric}`;
                  const diffVal = bet.improvedValue - bet.currentValue;
                  const diffDisplay = isPct ? `${(Math.abs(diffVal) * 100).toFixed(1)}pp` : fmtVal(Math.abs(diffVal));

                  // Downstream impact: compare withBets vs SQ for relevant channel
                  const sumM = (arr: MonthlyResult[], fn: (m: MonthlyResult) => number) => arr.reduce((s, m) => s + fn(m), 0);
                  const bm = withBetsModel.monthly;
                  const sm = sqModel.monthly;
                  let closedWonDelta = 0;
                  let customerDelta = 0;
                  let impactDesc = '';

                  if ((bet.category === 'newBusiness' || bet.category === 'newProduct') && (bet.channel === 'inbound' || !bet.channel)) {
                    const cwGetter = bet.category === 'newProduct' ? (m: MonthlyResult) => m.newProductInboundClosedWon : (m: MonthlyResult) => m.inboundClosedWon;
                    const dealGetter = bet.category === 'newProduct' ? (m: MonthlyResult) => m.newProductInboundDeals : (m: MonthlyResult) => m.inboundDeals;
                    closedWonDelta += sumM(bm, cwGetter) - sumM(sm, cwGetter);
                    customerDelta += sumM(bm, dealGetter) - sumM(sm, dealGetter);
                  }
                  if ((bet.category === 'newBusiness' || bet.category === 'newProduct') && (bet.channel === 'outbound' || !bet.channel)) {
                    const cwGetter = bet.category === 'newProduct' ? (m: MonthlyResult) => m.newProductOutboundClosedWon : (m: MonthlyResult) => m.outboundClosedWon;
                    const dealGetter = bet.category === 'newProduct' ? (m: MonthlyResult) => m.newProductOutboundDeals : (m: MonthlyResult) => m.outboundDeals;
                    closedWonDelta += sumM(bm, cwGetter) - sumM(sm, cwGetter);
                    customerDelta += sumM(bm, dealGetter) - sumM(sm, dealGetter);
                  }
                  if (bet.category === 'expansion') {
                    const d = sumM(bm, (m) => m.expansionRevenue) - sumM(sm, (m) => m.expansionRevenue);
                    impactDesc = `Improving expansion rate adds ~${formatCurrency(Math.abs(d))} in expansion revenue by year end`;
                  } else if (bet.category === 'churn') {
                    const d = sumM(bm, (m) => m.churnRevenue) - sumM(sm, (m) => m.churnRevenue);
                    impactDesc = `Reducing churn saves ~${formatCurrency(Math.abs(d))} in retained ARR by year end`;
                  } else if (closedWonDelta !== 0 || customerDelta !== 0) {
                    impactDesc = `Improving ${metricLabels[bet.metric] || bet.metric} by ${diffDisplay} adds ~${formatCurrency(Math.max(0, closedWonDelta))} in closed won and ~${Math.round(Math.max(0, customerDelta))} new customers by year end`;
                  }

                  return (
                    <div key={bet.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <h4 className="text-sm font-semibold text-gray-800">{bet.name}</h4>
                      <div className="mt-1.5 text-xs text-gray-500">
                        {metricLabel}: <span className="text-gray-700">{fmtVal(bet.currentValue)}</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="font-medium text-blue-700">{fmtVal(bet.improvedValue)}</span>
                      </div>
                      {impactDesc && (
                        <p className="text-xs text-green-700 mt-2 leading-relaxed bg-green-50 rounded px-2 py-1.5">
                          {impactDesc}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Net ARR impact: <span className="font-medium text-gray-700">{formatCurrency(Math.max(0, perBetImpact))}</span>
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

        {/* ── Section 5: Key Pipeline Milestones ──────────────── */}
        {(() => {
          type Milestone = { quarter: string; channel: string; closedWon: number; pipeline: number; createByMonth: number; isPast: boolean };
          const milestones: Milestone[] = [];
          const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
          const quarterEndMonths = [3, 6, 9, 12];

          if (cc.hasInbound) {
            const sc = effectiveTargets.newBusiness.inbound.salesCycleMonths;
            planModel.quarterly.forEach((q, qi) => {
              if (q.inboundClosedWon > 0) {
                const createBy = quarterEndMonths[qi] - Math.round(sc);
                milestones.push({ quarter: quarters[qi], channel: 'Inbound', closedWon: q.inboundClosedWon, pipeline: q.inboundPipelineCreated, createByMonth: createBy, isPast: isInYear && createBy < cm });
              }
            });
          }
          if (cc.hasOutbound) {
            const sc = effectiveTargets.newBusiness.outbound.salesCycleMonths;
            planModel.quarterly.forEach((q, qi) => {
              if (q.outboundClosedWon > 0) {
                const createBy = quarterEndMonths[qi] - Math.round(sc);
                milestones.push({ quarter: quarters[qi], channel: 'Outbound', closedWon: q.outboundClosedWon, pipeline: q.outboundPipelineCreated, createByMonth: createBy, isPast: isInYear && createBy < cm });
              }
            });
          }
          if (cc.hasNewProduct) {
            const scIb = effectiveTargets.newProduct.inbound.salesCycleMonths;
            const scOb = effectiveTargets.newProduct.outbound.salesCycleMonths;
            planModel.quarterly.forEach((q, qi) => {
              const npCW = q.newProductInboundClosedWon + q.newProductOutboundClosedWon;
              const npPipe = q.newProductInboundPipelineCreated + q.newProductOutboundPipelineCreated;
              if (npCW > 0) {
                const sc = Math.max(scIb, scOb);
                const createBy = quarterEndMonths[qi] - Math.round(sc);
                milestones.push({ quarter: quarters[qi], channel: 'New Product', closedWon: npCW, pipeline: npPipe, createByMonth: createBy, isPast: isInYear && createBy < cm });
              }
            });
          }

          if (milestones.length === 0) return null;

          const monthLabel = (m: number) => {
            if (m < 1) return `${m} mo before Jan`;
            if (m > 12) return `Month ${m}`;
            return MONTH_NAMES[m - 1];
          };

          return (
            <>
              <section className="print-break">
                <h2 className="text-lg font-bold text-gray-900">Key Pipeline Milestones</h2>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  Based on sales cycle lengths, here is when pipeline must be created to hit quarterly closed-won targets.
                </p>
                <div className="mt-4 space-y-2">
                  {milestones.map((ms, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        ms.isPast ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {ms.isPast && (
                        <span className="flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </span>
                      )}
                      <p className={`text-sm ${ms.isPast ? 'text-red-800' : 'text-gray-700'}`}>
                        To hit <span className="font-semibold">{ms.quarter}</span>{' '}
                        <span className="font-medium">{ms.channel.toLowerCase()}</span> closed won of{' '}
                        <span className="font-semibold">{formatCurrency(ms.closedWon)}</span>, pipeline of{' '}
                        <span className="font-semibold">{formatCurrency(ms.pipeline)}</span> must be created by{' '}
                        <span className={`font-semibold ${ms.isPast ? 'text-red-700 underline' : 'text-blue-700'}`}>
                          {monthLabel(ms.createByMonth)}
                        </span>
                        {ms.isPast && <span className="text-red-600 font-medium ml-1">(deadline passed)</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <hr className="border-gray-200" />
            </>
          );
        })()}

        {/* ── Section 6: Key Actions Needed ──────────────────── */}
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

        <hr className="border-gray-200" />

        {/* ── Section 7: Conversion Rate Targets ─────────────── */}
        {(() => {
          const hq = plan.historicalQuarters;
          const avg = (vals: number[]) => vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

          // Color: green if plan is "better", red if "worse", gray if within 2pp/2%
          const deltaColor = (plan: number, hist: number, higherIsBetter: boolean, isPct: boolean) => {
            const diff = plan - hist;
            const threshold = isPct ? 0.02 : hist * 0.02;
            if (Math.abs(diff) <= threshold) return 'text-gray-500';
            const isBetter = higherIsBetter ? diff > 0 : diff < 0;
            return isBetter ? 'text-green-700' : 'text-red-600';
          };

          type Row = { metric: string; histVal: number; planVal: number; isPct: boolean; higherIsBetter: boolean };
          type ChannelTable = { name: string; rows: Row[] };
          const tables: ChannelTable[] = [];

          const fmtR = (v: number, isPct: boolean) => isPct ? `${(v * 100).toFixed(1)}%` : formatCurrencyFull(v);
          const fmtDelta = (plan: number, hist: number, isPct: boolean) => {
            const d = plan - hist;
            const sign = d >= 0 ? '+' : '';
            return isPct ? `${sign}${(d * 100).toFixed(1)}pp` : `${sign}${formatCurrencyFull(d)}`;
          };

          if (cc.hasInbound && hq.length > 0) {
            const h = effectiveHistorical.newBusiness.inbound;
            const t = effectiveTargets.newBusiness.inbound;
            const histWR = avg(hq.map((q) => q.inboundWinRate));
            const histACV = avg(hq.map((q) => q.inboundACV));
            const histHTP = avg(hq.map((q) => q.inboundHISToPipelineRate));
            const histSC = avg(hq.map((q) => q.inboundSalesCycle));
            tables.push({
              name: 'Inbound',
              rows: [
                { metric: 'Win Rate', histVal: histWR, planVal: t.winRate, isPct: true, higherIsBetter: true },
                { metric: 'ACV', histVal: histACV, planVal: t.acv, isPct: false, higherIsBetter: true },
                { metric: 'HIS→Pipeline Rate', histVal: histHTP, planVal: t.hisToPipelineRate, isPct: true, higherIsBetter: true },
                { metric: 'Sales Cycle', histVal: histSC, planVal: t.salesCycleMonths, isPct: false, higherIsBetter: false },
              ],
            });
          }

          if (cc.hasOutbound && hq.length > 0) {
            const t = effectiveTargets.newBusiness.outbound;
            const histWR = avg(hq.map((q) => q.outboundWinRate));
            const histACV = avg(hq.map((q) => q.outboundACV));
            const histSC = avg(hq.map((q) => q.outboundSalesCycle));
            tables.push({
              name: 'Outbound',
              rows: [
                { metric: 'Win Rate', histVal: histWR, planVal: t.winRate, isPct: true, higherIsBetter: true },
                { metric: 'ACV', histVal: histACV, planVal: t.acv, isPct: false, higherIsBetter: true },
                { metric: 'Sales Cycle', histVal: histSC, planVal: t.salesCycleMonths, isPct: false, higherIsBetter: false },
              ],
            });
          }

          if (cc.hasNewProduct && hq.length > 0) {
            const t = effectiveTargets.newProduct.inbound;
            const histWR = avg(hq.map((q) => q.newProductWinRate));
            const histACV = avg(hq.map((q) => q.newProductACV));
            const histSC = avg(hq.map((q) => q.newProductSalesCycle));
            const histHTP = avg(hq.map((q) => q.newProductHISToPipelineRate));
            tables.push({
              name: 'New Product',
              rows: [
                { metric: 'Win Rate', histVal: histWR, planVal: t.winRate, isPct: true, higherIsBetter: true },
                { metric: 'ACV', histVal: histACV, planVal: t.acv, isPct: false, higherIsBetter: true },
                { metric: 'HIS→Pipeline Rate', histVal: histHTP, planVal: t.hisToPipelineRate, isPct: true, higherIsBetter: true },
                { metric: 'Sales Cycle', histVal: histSC, planVal: t.salesCycleMonths, isPct: false, higherIsBetter: false },
              ],
            });
          }

          // Expansion row
          if (hq.length > 0) {
            const histExp = avg(hq.map((q) => q.expansionRate));
            const planExp = effectiveTargets.expansion.expansionRate;
            if (histExp > 0 || planExp > 0) {
              tables.push({
                name: 'Expansion & Churn',
                rows: [
                  { metric: 'Expansion Rate', histVal: histExp, planVal: planExp, isPct: true, higherIsBetter: true },
                  { metric: 'Churn Rate', histVal: avg(hq.map((q) => q.churnRate)), planVal: effectiveTargets.churn.monthlyChurnRate, isPct: true, higherIsBetter: false },
                ],
              });
            }
          }

          if (tables.length === 0) return null;

          return (
            <section className="print-break">
              <h2 className="text-lg font-bold text-gray-900">Conversion Rate Targets</h2>
              <p className="text-sm text-gray-500 mt-1">Plan targets vs. historical averages across {hq.length} quarters.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {tables.map((tbl) => (
                  <div key={tbl.name} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-800">{tbl.name}</h4>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-500">
                          <th className="text-left px-3 py-1.5 font-medium">Metric</th>
                          <th className="text-right px-3 py-1.5 font-medium">Historical Avg</th>
                          <th className="text-right px-3 py-1.5 font-medium">Plan Target</th>
                          <th className="text-right px-3 py-1.5 font-medium">Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tbl.rows.map((r) => {
                          const color = deltaColor(r.planVal, r.histVal, r.higherIsBetter, r.isPct);
                          const fmtSC = (v: number) => `${v.toFixed(1)} mo`;
                          const fmt = r.metric === 'Sales Cycle' ? fmtSC : (v: number) => fmtR(v, r.isPct);
                          const fmtD = r.metric === 'Sales Cycle'
                            ? () => { const d = r.planVal - r.histVal; return `${d >= 0 ? '+' : ''}${d.toFixed(1)} mo`; }
                            : () => fmtDelta(r.planVal, r.histVal, r.isPct);
                          return (
                            <tr key={r.metric} className="border-b border-gray-50 last:border-b-0">
                              <td className="px-3 py-1.5 text-gray-700">{r.metric}</td>
                              <td className="px-3 py-1.5 text-right text-gray-500">{fmt(r.histVal)}</td>
                              <td className="px-3 py-1.5 text-right font-medium text-gray-800">{fmt(r.planVal)}</td>
                              <td className={`px-3 py-1.5 text-right font-medium ${color}`}>{fmtD()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}
      </div>
    </>
  );
}

// ── Goals Table (Quarterly) ──────────────────────────────────

type GoalsRow = {
  label: string;
  values: (string | number)[];
  total: string | number;
  isSecondary?: boolean;
  isHighlight?: boolean;
  isClosedWon?: boolean;
  isChurn?: boolean;
};

function pipelineDeadlineMonth(closeQuarterIdx: number, salesCycle: number): string {
  // Quarter end months: Q1=3, Q2=6, Q3=9, Q4=12
  const closeMonth = (closeQuarterIdx + 1) * 3;
  const createBy = closeMonth - Math.round(salesCycle);
  if (createBy < 1) return `${createBy} mo before Jan`;
  return MONTH_NAMES[createBy - 1]?.slice(0, 3) ?? `M${createBy}`;
}

function GoalsTableQuarterly({ quarterly, cc, isInYear, cm, targets }: {
  quarterly: QuarterlyResult[];
  cc: { hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean };
  isInYear: boolean;
  cm: number;
  targets: RevenueBreakdown;
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

  const rows: GoalsRow[] = [];

  const addCurrency = (label: string, getter: (q: QuarterlyResult) => number, opts?: Partial<GoalsRow>) => {
    const values = quarterly.map(getter);
    rows.push({ label, values: values.map(formatCurrencyFull), total: formatCurrencyFull(values.reduce((s, v) => s + v, 0)), ...opts });
  };
  const addNumber = (label: string, getter: (q: QuarterlyResult) => number, opts?: Partial<GoalsRow>) => {
    const values = quarterly.map(getter);
    rows.push({ label, values: values.map((v) => Math.round(v).toLocaleString()), total: Math.round(values.reduce((s, v) => s + v, 0)).toLocaleString(), ...opts });
  };
  const addConstant = (label: string, value: string, opts?: Partial<GoalsRow>) => {
    rows.push({ label, values: [value, value, value, value], total: value, isSecondary: true, ...opts });
  };

  // Total New ARR
  addCurrency('Total New ARR', (q) => q.totalNewARR, { isHighlight: true });

  // Inbound channel
  if (cc.hasInbound) {
    const ib = targets.newBusiness.inbound;
    addCurrency('IB Qualified Pipeline $', (q) => q.inboundPipelineCreated);
    // Pipeline deadline note per quarter
    const deadlineNote = quarterly.map((_, qi) => `Create by ${pipelineDeadlineMonth(qi, ib.salesCycleMonths)}`).join(' | ');
    rows[rows.length - 1].label = `IB Qualified Pipeline $`;
    addNumber('IB HIS Volume', (q) => q.hisRequired);
    addConstant('IB Win Rate', formatPercent(ib.winRate));
    addConstant('IB ACV', formatCurrencyFull(ib.acv));
    addConstant('IB Sales Cycle', `${ib.salesCycleMonths} mo`);
    addCurrency('Inbound Closed Won', (q) => q.inboundClosedWon, { isClosedWon: true });
    addNumber('IB New Customers', (q) => q.months.reduce((s, m) => s + m.inboundDeals, 0));
  }

  // Outbound channel
  if (cc.hasOutbound) {
    const ob = targets.newBusiness.outbound;
    addCurrency('OB Qualified Pipeline $', (q) => q.outboundPipelineCreated);
    addConstant('OB Win Rate', formatPercent(ob.winRate));
    addConstant('OB ACV', formatCurrencyFull(ob.acv));
    addConstant('OB Sales Cycle', `${ob.salesCycleMonths} mo`);
    addCurrency('Outbound Closed Won', (q) => q.outboundClosedWon, { isClosedWon: true });
    addNumber('OB New Customers', (q) => q.months.reduce((s, m) => s + m.outboundDeals, 0));
  }

  // New Product
  if (cc.hasNewProduct) {
    addCurrency('New Product Won', (q) => q.newProductInboundClosedWon + q.newProductOutboundClosedWon, { isClosedWon: true });
    addNumber('NP New Customers', (q) => q.months.reduce((s, m) => s + m.newProductInboundDeals + m.newProductOutboundDeals, 0));
  }

  // Expansion
  if (cc.hasExpansion) {
    addConstant('Expansion Rate', formatPercent(targets.expansion.expansionRate));
    addCurrency('Expansion Revenue', (q) => q.expansionRevenue);
  }

  // Churn
  if (cc.hasChurn) {
    addConstant('Churn Rate', formatPercent(targets.churn.monthlyChurnRate), { isChurn: true });
    addCurrency('Churn Revenue', (q) => q.churnRevenue, { isChurn: true });
  }

  return (
    <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          {quarterly.map((q) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500">
              {q.quarter}{badges(q)}
            </th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const bgClass = row.isHighlight ? 'bg-blue-50 font-semibold' : row.isClosedWon ? 'bg-purple-50/50' : '';
          const labelClass = row.isSecondary ? 'py-1 px-3 pl-6 text-gray-400 italic text-[11px]'
            : row.isHighlight ? 'py-1.5 px-3 text-gray-800 font-semibold'
            : row.isClosedWon ? 'py-1.5 px-3 text-purple-900 font-medium'
            : row.isChurn ? 'py-1.5 px-3 text-red-700'
            : 'py-1.5 px-3 text-gray-700';
          const valClass = row.isSecondary ? 'py-1 px-3 text-right text-gray-400 italic text-[11px]'
            : row.isChurn ? 'py-1.5 px-3 text-right text-red-600'
            : 'py-1.5 px-3 text-right text-gray-900';

          return (
            <tr key={`${row.label}-${i}`} className={`border-b border-gray-100 ${bgClass}`}>
              <td className={labelClass}>{row.label}</td>
              {row.values.map((v, qi) => (
                <td key={qi} className={valClass}>{v}</td>
              ))}
              <td className={`${valClass} font-medium`}>{row.total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Goals Table (Monthly) ────────────────────────────────────

type MonthlyGoalsRow = {
  label: string;
  values: string[];
  isSecondary?: boolean;
  isHighlight?: boolean;
  isClosedWon?: boolean;
  isChurn?: boolean;
};

function GoalsTableMonthly({ monthly, cc, isInYear, cm, targets }: {
  monthly: MonthlyResult[];
  cc: { hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean };
  isInYear: boolean;
  cm: number;
  targets: RevenueBreakdown;
}) {
  const rows: MonthlyGoalsRow[] = [];

  const addCurrency = (label: string, getter: (m: MonthlyResult) => number, opts?: Partial<MonthlyGoalsRow>) => {
    rows.push({ label, values: monthly.map((m) => formatCurrencyFull(getter(m))), ...opts });
  };
  const addNumber = (label: string, getter: (m: MonthlyResult) => number, opts?: Partial<MonthlyGoalsRow>) => {
    rows.push({ label, values: monthly.map((m) => Math.round(getter(m)).toLocaleString()), ...opts });
  };
  const addConstant = (label: string, value: string, opts?: Partial<MonthlyGoalsRow>) => {
    rows.push({ label, values: monthly.map(() => value), isSecondary: true, ...opts });
  };

  addCurrency('Total New ARR', (m) => m.totalNewARR, { isHighlight: true });

  if (cc.hasInbound) {
    const ib = targets.newBusiness.inbound;
    addCurrency('IB Qualified Pipeline $', (m) => m.inboundPipelineCreated);
    addNumber('IB HIS Volume', (m) => m.hisRequired);
    addConstant('IB Win Rate', formatPercent(ib.winRate));
    addConstant('IB ACV', formatCurrencyFull(ib.acv));
    addConstant('IB Sales Cycle', `${ib.salesCycleMonths} mo`);
    addCurrency('Inbound Closed Won', (m) => m.inboundClosedWon, { isClosedWon: true });
    addNumber('IB New Customers', (m) => m.inboundDeals);
  }

  if (cc.hasOutbound) {
    const ob = targets.newBusiness.outbound;
    addCurrency('OB Qualified Pipeline $', (m) => m.outboundPipelineCreated);
    addConstant('OB Win Rate', formatPercent(ob.winRate));
    addConstant('OB ACV', formatCurrencyFull(ob.acv));
    addConstant('OB Sales Cycle', `${ob.salesCycleMonths} mo`);
    addCurrency('Outbound Closed Won', (m) => m.outboundClosedWon, { isClosedWon: true });
    addNumber('OB New Customers', (m) => m.outboundDeals);
  }

  if (cc.hasNewProduct) {
    addCurrency('New Product Won', (m) => m.newProductInboundClosedWon + m.newProductOutboundClosedWon, { isClosedWon: true });
    addNumber('NP New Customers', (m) => m.newProductInboundDeals + m.newProductOutboundDeals);
  }

  if (cc.hasExpansion) {
    addConstant('Expansion Rate', formatPercent(targets.expansion.expansionRate));
    addCurrency('Expansion Revenue', (m) => m.expansionRevenue);
  }

  if (cc.hasChurn) {
    addConstant('Churn Rate', formatPercent(targets.churn.monthlyChurnRate), { isChurn: true });
    addCurrency('Churn Revenue', (m) => m.churnRevenue, { isChurn: true });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-48">Metric</th>
            {monthly.map((m) => (
              <th key={m.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[72px]">
                {formatMonthName(m.month)}
                {isInYear && (m.month < cm ? <ActBadge /> : <PlanBadge />)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const bgClass = row.isHighlight ? 'bg-blue-50 font-semibold' : row.isClosedWon ? 'bg-purple-50/50' : '';
            const labelClass = row.isSecondary ? 'py-1 px-3 pl-6 text-gray-400 italic text-[11px] sticky left-0 bg-inherit'
              : row.isHighlight ? 'py-1.5 px-3 text-gray-800 font-semibold sticky left-0 bg-inherit'
              : row.isClosedWon ? 'py-1.5 px-3 text-purple-900 font-medium sticky left-0 bg-inherit'
              : row.isChurn ? 'py-1.5 px-3 text-red-700 sticky left-0 bg-inherit'
              : 'py-1.5 px-3 text-gray-700 sticky left-0 bg-inherit';
            const valClass = row.isSecondary ? 'py-1 px-2 text-right text-gray-400 italic text-[11px]'
              : row.isChurn ? 'py-1.5 px-2 text-right text-red-600'
              : 'py-1.5 px-2 text-right text-gray-900';

            return (
              <tr key={`${row.label}-${i}`} className={`border-b border-gray-100 ${bgClass}`}>
                <td className={labelClass}>{row.label}</td>
                {row.values.map((v, mi) => (
                  <td key={mi} className={valClass}>{v}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Status Quo Delta Table (full metric set, quarterly) ──────

function StatusQuoDeltaTable({ planQ, sqQ, cc, planTargets, sqTargets }: {
  planQ: QuarterlyResult[];
  sqQ: QuarterlyResult[];
  cc: { hasInbound: boolean; hasOutbound: boolean; hasExpansion: boolean; hasChurn: boolean; hasNewProduct: boolean };
  planTargets: RevenueBreakdown;
  sqTargets: RevenueBreakdown;
}) {
  type DeltaRow = {
    label: string;
    getPlan: (q: QuarterlyResult) => number;
    getSq: (q: QuarterlyResult) => number;
    fmt: (v: number) => string;
    isSecondary?: boolean;
    isClosedWon?: boolean;
    isChurn?: boolean;
    isHighlight?: boolean;
    // For constant-rate rows, show these values directly
    planConst?: string;
    sqConst?: string;
  };
  const metrics: DeltaRow[] = [];

  // Total New ARR
  metrics.push({ label: 'Total New ARR', getPlan: (q) => q.totalNewARR, getSq: (q) => q.totalNewARR, fmt: formatCurrencyFull, isHighlight: true });

  // Inbound
  if (cc.hasInbound) {
    const pIb = planTargets.newBusiness.inbound;
    const sIb = sqTargets.newBusiness.inbound;
    metrics.push({ label: 'IB Qualified Pipeline $', getPlan: (q) => q.inboundPipelineCreated, getSq: (q) => q.inboundPipelineCreated, fmt: formatCurrencyFull });
    metrics.push({ label: 'IB HIS Volume', getPlan: (q) => q.hisRequired, getSq: (q) => q.hisRequired, fmt: (v) => Math.round(v).toLocaleString() });
    metrics.push({ label: 'IB Win Rate', getPlan: () => 0, getSq: () => 0, fmt: formatPercent, isSecondary: true, planConst: formatPercent(pIb.winRate), sqConst: formatPercent(sIb.winRate) });
    metrics.push({ label: 'IB ACV', getPlan: () => 0, getSq: () => 0, fmt: formatCurrencyFull, isSecondary: true, planConst: formatCurrencyFull(pIb.acv), sqConst: formatCurrencyFull(sIb.acv) });
    metrics.push({ label: 'IB Sales Cycle', getPlan: () => 0, getSq: () => 0, fmt: (v) => `${v} mo`, isSecondary: true, planConst: `${pIb.salesCycleMonths} mo`, sqConst: `${sIb.salesCycleMonths} mo` });
    metrics.push({ label: 'Inbound Closed Won', getPlan: (q) => q.inboundClosedWon, getSq: (q) => q.inboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true });
    metrics.push({ label: 'IB New Customers', getPlan: (q) => q.months.reduce((s, m) => s + m.inboundDeals, 0), getSq: (q) => q.months.reduce((s, m) => s + m.inboundDeals, 0), fmt: (v) => Math.round(v).toLocaleString() });
  }

  // Outbound
  if (cc.hasOutbound) {
    const pOb = planTargets.newBusiness.outbound;
    const sOb = sqTargets.newBusiness.outbound;
    metrics.push({ label: 'OB Qualified Pipeline $', getPlan: (q) => q.outboundPipelineCreated, getSq: (q) => q.outboundPipelineCreated, fmt: formatCurrencyFull });
    metrics.push({ label: 'OB Win Rate', getPlan: () => 0, getSq: () => 0, fmt: formatPercent, isSecondary: true, planConst: formatPercent(pOb.winRate), sqConst: formatPercent(sOb.winRate) });
    metrics.push({ label: 'OB ACV', getPlan: () => 0, getSq: () => 0, fmt: formatCurrencyFull, isSecondary: true, planConst: formatCurrencyFull(pOb.acv), sqConst: formatCurrencyFull(sOb.acv) });
    metrics.push({ label: 'OB Sales Cycle', getPlan: () => 0, getSq: () => 0, fmt: (v) => `${v} mo`, isSecondary: true, planConst: `${pOb.salesCycleMonths} mo`, sqConst: `${sOb.salesCycleMonths} mo` });
    metrics.push({ label: 'Outbound Closed Won', getPlan: (q) => q.outboundClosedWon, getSq: (q) => q.outboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true });
    metrics.push({ label: 'OB New Customers', getPlan: (q) => q.months.reduce((s, m) => s + m.outboundDeals, 0), getSq: (q) => q.months.reduce((s, m) => s + m.outboundDeals, 0), fmt: (v) => Math.round(v).toLocaleString() });
  }

  // New Product
  if (cc.hasNewProduct) {
    metrics.push({ label: 'New Product Won', getPlan: (q) => q.newProductInboundClosedWon + q.newProductOutboundClosedWon, getSq: (q) => q.newProductInboundClosedWon + q.newProductOutboundClosedWon, fmt: formatCurrencyFull, isClosedWon: true });
    metrics.push({ label: 'NP New Customers', getPlan: (q) => q.months.reduce((s, m) => s + m.newProductInboundDeals + m.newProductOutboundDeals, 0), getSq: (q) => q.months.reduce((s, m) => s + m.newProductInboundDeals + m.newProductOutboundDeals, 0), fmt: (v) => Math.round(v).toLocaleString() });
  }

  // Expansion
  if (cc.hasExpansion) {
    metrics.push({ label: 'Expansion Rate', getPlan: () => 0, getSq: () => 0, fmt: formatPercent, isSecondary: true, planConst: formatPercent(planTargets.expansion.expansionRate), sqConst: formatPercent(sqTargets.expansion.expansionRate) });
    metrics.push({ label: 'Expansion Revenue', getPlan: (q) => q.expansionRevenue, getSq: (q) => q.expansionRevenue, fmt: formatCurrencyFull });
  }

  // Churn
  if (cc.hasChurn) {
    metrics.push({ label: 'Churn Rate', getPlan: () => 0, getSq: () => 0, fmt: formatPercent, isSecondary: true, isChurn: true, planConst: formatPercent(planTargets.churn.monthlyChurnRate), sqConst: formatPercent(sqTargets.churn.monthlyChurnRate) });
    metrics.push({ label: 'Churn Revenue', getPlan: (q) => q.churnRevenue, getSq: (q) => q.churnRevenue, fmt: formatCurrencyFull, isChurn: true });
  }

  return (
    <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          <th className="text-left py-2 px-2 font-medium text-gray-500 w-14"></th>
          {planQ.map((q) => (
            <th key={q.quarter} className="text-right py-2 px-3 font-medium text-gray-500">{q.quarter}</th>
          ))}
          <th className="text-right py-2 px-3 font-medium text-gray-500">Total</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((metric, idx) => {
          // Constant-rate rows: show Plan vs SQ as a single compact row
          if (metric.isSecondary && metric.planConst !== undefined) {
            const same = metric.planConst === metric.sqConst;
            return (
              <tr key={`${metric.label}-${idx}`} className="border-b border-gray-100">
                <td className="py-1 px-3 pl-6 text-gray-400 italic text-[11px]">{metric.label}</td>
                <td className="py-1 px-2 text-[10px] text-gray-400"></td>
                <td colSpan={4} className="py-1 px-3 text-right text-[11px]">
                  <span className="text-blue-600">Plan: {metric.planConst}</span>
                  <span className="text-gray-300 mx-1.5">|</span>
                  <span className="text-amber-600">SQ: {metric.sqConst}</span>
                  {!same && (
                    <span className={`ml-1.5 font-medium ${metric.isChurn ? 'text-red-500' : 'text-green-600'}`}>
                      (different)
                    </span>
                  )}
                </td>
                <td></td>
              </tr>
            );
          }

          // Dynamic rows: Plan / SQ / Delta
          const planVals = planQ.map((q) => metric.getPlan(q));
          const sqVals = sqQ.map((q) => metric.getSq(q));
          const planTotal = planVals.reduce((s, v) => s + v, 0);
          const sqTotal = sqVals.reduce((s, v) => s + v, 0);

          const bgClass = metric.isHighlight ? 'bg-blue-50' : metric.isClosedWon ? 'bg-purple-50/30' : '';
          const labelClass = metric.isHighlight ? 'text-gray-800 font-semibold'
            : metric.isClosedWon ? 'text-purple-900 font-medium'
            : metric.isChurn ? 'text-red-700'
            : 'text-gray-700 font-medium';

          return (
            <React.Fragment key={`${metric.label}-${idx}`}>
              {/* Plan row */}
              <tr className={`border-b border-gray-50 ${bgClass}`}>
                <td className={`py-1 px-3 ${labelClass}`} rowSpan={3}>{metric.label}</td>
                <td className="py-1 px-2 text-[10px] text-blue-600 font-medium">Plan</td>
                {planVals.map((v, i) => (
                  <td key={i} className="py-1 px-3 text-right text-blue-700">{metric.fmt(v)}</td>
                ))}
                <td className="py-1 px-3 text-right text-blue-700 font-medium">{metric.fmt(planTotal)}</td>
              </tr>
              {/* SQ row */}
              <tr className={`border-b border-gray-50 ${bgClass}`}>
                <td className="py-1 px-2 text-[10px] text-amber-600 font-medium">SQ</td>
                {sqVals.map((v, i) => (
                  <td key={i} className="py-1 px-3 text-right text-amber-700">{metric.fmt(v)}</td>
                ))}
                <td className="py-1 px-3 text-right text-amber-700 font-medium">{metric.fmt(sqTotal)}</td>
              </tr>
              {/* Delta row */}
              <tr className="border-b border-gray-200">
                <td className="py-1 px-2 text-[10px] text-gray-400 font-medium">Δ</td>
                {planVals.map((pv, i) => {
                  const d = pv - sqVals[i];
                  const color = d > 0 ? 'text-green-600' : d < 0 ? 'text-red-500' : 'text-gray-400';
                  return (
                    <td key={i} className={`py-1 px-3 text-right text-[11px] font-medium ${color}`}>
                      {d > 0 ? '+' : ''}{metric.fmt(d)}
                    </td>
                  );
                })}
                {(() => {
                  const d = planTotal - sqTotal;
                  const color = d > 0 ? 'text-green-600' : d < 0 ? 'text-red-500' : 'text-gray-400';
                  return (
                    <td className={`py-1 px-3 text-right text-[11px] font-medium ${color}`}>
                      {d > 0 ? '+' : ''}{metric.fmt(d)}
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
