'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, calculateGap } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatMonthName } from '@/lib/format';
import type { GapResult, Month } from '@/lib/types';

type ViewMode = 'quarterly' | 'monthly';

export default function GapAnalysis() {
  const { plan } = useGTMPlan();
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly');

  // Target model
  const targetModel = useMemo(
    () => runModel(plan.targets, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline),
    [plan.targets, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline],
  );

  // Historical model (flat seasonality, no ramp)
  const flatSeasonality = useMemo(() => ({
    monthly: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, 1.0]),
    ) as Record<number, number>,
  }), []);
  const noRamp = useMemo(() => ({ rampMonths: 1, startMonth: 1 as const }), []);

  const historicalModel = useMemo(
    () => runModel(plan.historical, flatSeasonality, noRamp, plan.startingARR, plan.existingPipeline),
    [plan.historical, flatSeasonality, noRamp, plan.startingARR, plan.existingPipeline],
  );

  const gaps = useMemo(
    () => calculateGap(targetModel.monthly, historicalModel.monthly),
    [targetModel.monthly, historicalModel.monthly],
  );

  const endGap = plan.targetARR - historicalModel.endingARR;
  const projectedGap = targetModel.endingARR - historicalModel.endingARR;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs font-medium text-blue-600 uppercase">Target End-of-Year ARR</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{formatCurrency(plan.targetARR)}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-xs font-medium text-amber-600 uppercase">Status Quo End-of-Year ARR</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{formatCurrency(historicalModel.endingARR)}</div>
        </div>
        <div className={`rounded-lg p-4 border ${endGap > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className={`text-xs font-medium uppercase ${endGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
            The Gap
          </div>
          <div className={`text-2xl font-bold mt-1 ${endGap > 0 ? 'text-red-800' : 'text-green-800'}`}>
            {formatCurrency(Math.abs(endGap))}
            <span className="text-sm font-normal ml-1">{endGap > 0 ? 'short' : 'above'}</span>
          </div>
        </div>
      </div>

      {/* Explanation */}
      {endGap > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            At current performance levels, your team will end the year{' '}
            <span className="font-bold">{formatCurrency(endGap)}</span> short of your{' '}
            {formatCurrency(plan.targetARR)} target. This is the gap your strategic bets need to close.
          </p>
        </div>
      )}

      {/* Gap table */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Gap Analysis Detail</h3>
          <div className="flex gap-1 bg-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('quarterly')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                viewMode === 'quarterly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Quarterly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                viewMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'quarterly' ? (
            <QuarterlyGapTable gaps={gaps} />
          ) : (
            <MonthlyGapTable gaps={gaps} />
          )}
        </div>
      </div>
    </div>
  );
}

function gapColor(value: number, invert = false): string {
  const threshold = invert ? -value : value;
  if (Math.abs(value) < 1) return 'text-gray-400';
  if (threshold > 0) return 'text-red-600 bg-red-50';
  return 'text-green-600 bg-green-50';
}

function QuarterlyGapTable({ gaps }: { gaps: GapResult[] }) {
  // Aggregate gaps by quarter
  const quarters = [
    { label: 'Q1', months: gaps.slice(0, 3) },
    { label: 'Q2', months: gaps.slice(3, 6) },
    { label: 'Q3', months: gaps.slice(6, 9) },
    { label: 'Q4', months: gaps.slice(9, 12) },
  ];

  const rows = [
    { label: 'Cumulative ARR Gap', getter: (g: GapResult) => g.gapARR, useEnd: true },
    { label: 'New ARR Gap', getter: (g: GapResult) => g.gapNewARR },
    { label: 'Inbound Closed Won Gap', getter: (g: GapResult) => g.inboundClosedWonGap },
    { label: 'Outbound Closed Won Gap', getter: (g: GapResult) => g.outboundClosedWonGap },
    { label: 'Expansion Gap', getter: (g: GapResult) => g.expansionGap },
    { label: 'Churn Gap', getter: (g: GapResult) => g.churnGap, invert: true },
    { label: 'Pipeline Gap', getter: (g: GapResult) => g.pipelineGap },
  ];

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 w-48">Metric</th>
          {quarters.map((q) => (
            <th key={q.label} className="text-right py-2 px-3 font-medium text-gray-500 w-28">{q.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-gray-100">
            <td className="py-1.5 px-3 text-gray-700 font-medium">{row.label}</td>
            {quarters.map((q) => {
              const val = row.useEnd
                ? row.getter(q.months[2]) // end of quarter
                : q.months.reduce((s, g) => s + row.getter(g), 0);
              return (
                <td key={q.label} className={`py-1.5 px-3 text-right ${gapColor(val, row.invert)}`}>
                  {val > 0 ? '+' : ''}{formatCurrencyFull(val)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonthlyGapTable({ gaps }: { gaps: GapResult[] }) {
  const rows = [
    { label: 'ARR Gap', getter: (g: GapResult) => g.gapARR },
    { label: 'New ARR Gap', getter: (g: GapResult) => g.gapNewARR },
    { label: 'Inbound Won Gap', getter: (g: GapResult) => g.inboundClosedWonGap },
    { label: 'Outbound Won Gap', getter: (g: GapResult) => g.outboundClosedWonGap },
    { label: 'Expansion Gap', getter: (g: GapResult) => g.expansionGap },
    { label: 'Churn Gap', getter: (g: GapResult) => g.churnGap, invert: true },
    { label: 'Pipeline Gap', getter: (g: GapResult) => g.pipelineGap },
  ];

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left py-2 px-3 font-medium text-gray-500 sticky left-0 bg-gray-50 w-40">Metric</th>
          {gaps.map((g) => (
            <th key={g.month} className="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]">
              {formatMonthName(g.month)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-gray-100">
            <td className="py-1.5 px-3 text-gray-700 font-medium sticky left-0 bg-white">{row.label}</td>
            {gaps.map((g) => {
              const val = row.getter(g);
              return (
                <td key={g.month} className={`py-1.5 px-2 text-right ${gapColor(val, row.invert)}`}>
                  {val > 0 ? '+' : ''}{formatCurrencyFull(val)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
