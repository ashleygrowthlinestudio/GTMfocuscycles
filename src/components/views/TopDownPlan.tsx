'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, runModelWithActuals, capModelAtTarget, applyChannelConfig, calculatePipelineDeadlines, buildPipelineTimingMap, applyMarketInsights, getInsightsForMonth } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatMonthName } from '@/lib/format';
import RevenueTable from '@/components/shared/RevenueTable';
import type { RampConfig, PipelineDeadline } from '@/lib/types';

const DEFAULT_RAMP: RampConfig = { rampMonths: 1, startMonth: 1 };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CHANNEL_LABELS: Record<string, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  newProductInbound: 'NP Inbound',
  newProductOutbound: 'NP Outbound',
};

function monthName(m: number): string {
  if (m < 1) return `${m - 1} mo before Jan`;
  if (m > 12) return `Month ${m}`;
  return MONTH_NAMES[m - 1];
}

function quarterOf(m: number): string {
  if (m < 1) return 'Pre-Q1';
  if (m > 12) return 'Post-Q4';
  return `Q${Math.ceil(m / 3)}`;
}

export default function TopDownPlan() {
  const { plan } = useGTMPlan();
  const cc = plan.channelConfig;
  const isInYear = plan.planningMode === 'in-year';
  const hasActuals = (plan.detailedActuals?.length ?? 0) > 0;
  const cm = plan.currentMonth ?? 1;

  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineView, setTimelineView] = useState<'quarterly' | 'monthly'>('quarterly');
  const [includeInsights, setIncludeInsights] = useState(true);

  const enabledInsights = (plan.marketInsights ?? []).filter((i) => i.enabled);
  const hasInsights = enabledInsights.length > 0;

  const effectiveTargets = useMemo(
    () => applyChannelConfig(plan.targets, cc, 'targets'),
    [plan.targets, cc],
  );

  const planModel = useMemo(
    () => runModel(effectiveTargets, plan.seasonality, DEFAULT_RAMP, plan.startingARR, plan.existingPipeline),
    [effectiveTargets, plan.seasonality, plan.startingARR, plan.existingPipeline],
  );

  const uncappedModel = useMemo(() => {
    if (isInYear && hasActuals) {
      return runModelWithActuals(
        effectiveTargets, plan.seasonality, DEFAULT_RAMP,
        plan.startingARR, plan.existingPipeline,
        plan.detailedActuals, plan.currentMonth,
      );
    }
    return planModel;
  }, [isInYear, hasActuals, effectiveTargets, plan.seasonality, plan.startingARR, plan.existingPipeline, plan.detailedActuals, plan.currentMonth, planModel]);

  const cappedModel = useMemo(
    () => capModelAtTarget(uncappedModel, plan.targetARR, plan.startingARR),
    [uncappedModel, plan.targetARR, plan.startingARR],
  );

  // Apply market insights if enabled
  const model = useMemo(() => {
    if (includeInsights && hasInsights) {
      return applyMarketInsights(cappedModel.monthly, enabledInsights, plan.startingARR);
    }
    return cappedModel;
  }, [cappedModel, includeInsights, hasInsights, enabledInsights, plan.startingARR]);

  // Pipeline deadlines
  const deadlines = useMemo(
    () => calculatePipelineDeadlines(model.monthly, effectiveTargets, cm),
    [model.monthly, effectiveTargets, cm],
  );

  const pipelineTimingMap = useMemo(
    () => buildPipelineTimingMap(effectiveTargets, cm),
    [effectiveTargets, cm],
  );

  const projectedEnd = Math.min(model.endingARR, plan.targetARR);
  const gap = plan.targetARR - projectedEnd;
  const planAchieved = gap <= 0;

  // Group deadlines by quarter for quarterly view
  const quarterlyDeadlines = useMemo(() => {
    const groups: Record<string, PipelineDeadline[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
    for (const dl of deadlines) {
      const q = quarterOf(dl.closingMonth);
      if (groups[q]) groups[q].push(dl);
    }
    return groups;
  }, [deadlines]);

  return (
    <div className="space-y-6">
      {/* Top-level summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Starting ARR" value={formatCurrency(plan.startingARR)} color="gray" />
        <SummaryCard label="Target ARR" value={formatCurrency(plan.targetARR)} color="blue" />
        <SummaryCard label="Projected ARR" value={formatCurrency(projectedEnd)} color="green" />
        <SummaryCard
          label="Gap to Target"
          value={planAchieved ? '$0' : formatCurrency(gap)}
          color={planAchieved ? 'green' : 'red'}
          suffix={planAchieved ? '✓ Plan Achieved' : 'short'}
        />
      </div>

      {/* Market Insights toggle + banner */}
      {hasInsights && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={includeInsights}
              onClick={() => setIncludeInsights(!includeInsights)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 ${
                includeInsights ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  includeInsights ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs font-medium text-gray-700">Include Market Insights</span>
          </label>
          {includeInsights && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs text-amber-700 font-medium">
                {enabledInsights.length} market insight{enabledInsights.length !== 1 ? 's' : ''} affecting these projections
              </span>
            </div>
          )}
        </div>
      )}

      {/* Revenue output table */}
      <RevenueTable
        monthly={model.monthly}
        quarterly={model.quarterly}
        startingARR={plan.startingARR}
        label="Target Revenue Projections"
        targets={effectiveTargets}
        planningMode={plan.planningMode}
        currentMonth={plan.currentMonth}
        detailedActuals={plan.detailedActuals}
        planMonthly={isInYear && hasActuals ? planModel.monthly : undefined}
        planQuarterly={isInYear && hasActuals ? planModel.quarterly : undefined}
        pipelineTimingMap={pipelineTimingMap}
        marketInsights={includeInsights ? enabledInsights : undefined}
      />

      {/* Pipeline Creation Timeline (collapsible) */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${showTimeline ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-700">Pipeline Creation Timeline</h3>
            {deadlines.some((d) => d.isUrgent) && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-100 text-red-700">
                {deadlines.filter((d) => d.isUrgent).length} urgent
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">{showTimeline ? 'Hide' : 'Show'}</span>
        </button>

        {showTimeline && (
          <div className="p-4">
            <div className="flex gap-1 bg-gray-200 rounded-md p-0.5 w-fit mb-4">
              <button
                onClick={() => setTimelineView('quarterly')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  timelineView === 'quarterly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Quarterly
              </button>
              <button
                onClick={() => setTimelineView('monthly')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  timelineView === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Monthly
              </button>
            </div>

            {timelineView === 'quarterly' ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Quarter</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Channel</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500">Closed Won Target</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Pipeline Must Be Created By</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500">Pipeline Amount Needed</th>
                  </tr>
                </thead>
                <tbody>
                  {['Q1', 'Q2', 'Q3', 'Q4'].flatMap((q) => {
                    const dls = quarterlyDeadlines[q] || [];
                    // Group by channel
                    const byChannel: Record<string, PipelineDeadline[]> = {};
                    for (const dl of dls) {
                      (byChannel[dl.channel] ??= []).push(dl);
                    }
                    return Object.entries(byChannel).map(([ch, chDls]) => {
                      const totalCW = chDls.reduce((s, d) => s + d.closedWonAmount, 0);
                      const totalPipe = chDls.reduce((s, d) => s + d.pipelineAmount, 0);
                      const earliestNeeded = Math.min(...chDls.map((d) => d.pipelineNeededBy));
                      const needQ = quarterOf(earliestNeeded);
                      const anyUrgent = chDls.some((d) => d.isUrgent);
                      const nearDeadline = earliestNeeded > cm && earliestNeeded <= cm + 3;

                      const rowBg = anyUrgent ? 'bg-red-50' : nearDeadline ? 'bg-amber-50' : '';
                      return (
                        <tr key={`${q}-${ch}`} className={`border-b border-gray-100 ${rowBg}`}>
                          <td className="py-1.5 px-3 font-medium text-gray-700">{q}</td>
                          <td className="py-1.5 px-3 text-gray-700">{CHANNEL_LABELS[ch] || ch}</td>
                          <td className="py-1.5 px-3 text-right text-gray-900">{formatCurrencyFull(totalCW)}</td>
                          <td className="py-1.5 px-3">
                            <span className={`flex items-center gap-1 ${anyUrgent ? 'text-red-700 font-medium' : nearDeadline ? 'text-amber-700' : 'text-gray-700'}`}>
                              {anyUrgent && (
                                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              {needQ} ({monthName(earliestNeeded)})
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right text-gray-900">{formatCurrencyFull(totalPipe)}</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Closes In</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Channel</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Closed Won $</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Pipeline By</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Pipeline $</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadlines.map((dl, i) => {
                      const nearDeadline = dl.pipelineNeededBy > cm && dl.pipelineNeededBy <= cm + 1;
                      const rowBg = dl.isUrgent ? 'bg-red-50' : nearDeadline ? 'bg-amber-50' : '';
                      return (
                        <tr key={i} className={`border-b border-gray-100 ${rowBg}`}>
                          <td className="py-1.5 px-3 font-medium text-gray-700">{monthName(dl.closingMonth)}</td>
                          <td className="py-1.5 px-3 text-gray-700">{CHANNEL_LABELS[dl.channel] || dl.channel}</td>
                          <td className="py-1.5 px-3 text-right text-gray-900">{formatCurrencyFull(dl.closedWonAmount)}</td>
                          <td className="py-1.5 px-3">
                            <span className={`flex items-center gap-1 ${dl.isUrgent ? 'text-red-700 font-medium' : nearDeadline ? 'text-amber-700' : 'text-gray-700'}`}>
                              {dl.isUrgent && (
                                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              {monthName(dl.pipelineNeededBy)}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right text-gray-900">{formatCurrencyFull(dl.pipelineAmount)}</td>
                          <td className="py-1.5 px-3 text-gray-500 text-[11px]">
                            To close {formatCurrencyFull(dl.closedWonAmount)} in {monthName(dl.closingMonth)}, {formatCurrencyFull(dl.pipelineAmount)} pipeline must be created by {monthName(dl.pipelineNeededBy)}
                            {dl.hisNeededBy !== undefined && dl.hisAmount !== undefined && dl.hisAmount > 0 && (
                              <span className="block text-gray-400 mt-0.5">
                                Requiring {Math.round(dl.hisAmount)} HIS by {monthName(dl.hisNeededBy)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
