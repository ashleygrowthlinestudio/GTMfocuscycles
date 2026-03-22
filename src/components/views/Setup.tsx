'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import MetricInput from '@/components/shared/MetricInput';
import HistoricalDataSheet, { isQuarterFilled, generateQuarterSlots, createEmptyQuarter } from '@/components/shared/HistoricalDataSheet';
import type { ChannelConfig, Month, MonthlyActuals, QuarterlyHistoricalData, RevenueBreakdown, SeasonalityWeights, PlanningMode, TargetAllocationMode, TargetAllocations } from '@/lib/types';
import { DEFAULT_HISTORICAL } from '@/lib/defaults';
import { formatCurrency } from '@/lib/format';

// ── Channel toggle ───────────────────────────────────────────

function ChannelToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-xs text-gray-700">{label}</span>
    </label>
  );
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Target Allocation component ──────────────────────────────

interface TargetAllocationProps {
  mode: TargetAllocationMode;
  allocations: TargetAllocations;
  channelConfig: ChannelConfig;
  targetARR: number;
  startingARR: number;
  filledQuarters: number;
  historicalQuarters: QuarterlyHistoricalData[];
  onModeChange: (mode: TargetAllocationMode) => void;
  onAllocationsChange: (alloc: TargetAllocations) => void;
}

type AllocChannel = 'inbound' | 'outbound' | 'expansion' | 'churn' | 'newProduct';
const ALLOC_CHANNELS: { key: AllocChannel; label: string; configKey: keyof ChannelConfig }[] = [
  { key: 'inbound', label: 'Inbound', configKey: 'hasInbound' },
  { key: 'outbound', label: 'Outbound', configKey: 'hasOutbound' },
  { key: 'expansion', label: 'Expansion', configKey: 'hasExpansion' },
  { key: 'churn', label: 'Churn', configKey: 'hasChurn' },
  { key: 'newProduct', label: 'New Product', configKey: 'hasNewProduct' },
];

function computeHistoricalAllocations(
  quarters: QuarterlyHistoricalData[],
  cc: ChannelConfig,
): Record<AllocChannel, number> {
  const filled = quarters.filter(isQuarterFilled);
  if (filled.length === 0) return { inbound: 0, outbound: 0, expansion: 0, churn: 0, newProduct: 0 };

  let totalIb = 0, totalOb = 0, totalExp = 0, totalChurn = 0, totalNp = 0;
  for (const q of filled) {
    totalIb += q.inboundClosedWon;
    totalOb += q.outboundClosedWon;
    totalExp += q.expansionRevenue;
    totalChurn += q.churnRevenue;
    totalNp += q.newProductClosedWon;
  }

  const grandTotal = totalIb + totalOb + totalExp + totalChurn + totalNp;
  if (grandTotal === 0) return { inbound: 0, outbound: 0, expansion: 0, churn: 0, newProduct: 0 };

  return {
    inbound: cc.hasInbound ? Math.round((totalIb / grandTotal) * 10000) / 100 : 0,
    outbound: cc.hasOutbound ? Math.round((totalOb / grandTotal) * 10000) / 100 : 0,
    expansion: cc.hasExpansion ? Math.round((totalExp / grandTotal) * 10000) / 100 : 0,
    churn: cc.hasChurn ? Math.round((totalChurn / grandTotal) * 10000) / 100 : 0,
    newProduct: cc.hasNewProduct ? Math.round((totalNp / grandTotal) * 10000) / 100 : 0,
  };
}

function TargetAllocation({
  mode, allocations, channelConfig, targetARR, startingARR, filledQuarters,
  historicalQuarters, onModeChange, onAllocationsChange,
}: TargetAllocationProps) {
  const newARR = targetARR - startingARR;
  const activeChannels = ALLOC_CHANNELS.filter((ch) => channelConfig[ch.configKey]);

  const historicalAlloc = useMemo(
    () => computeHistoricalAllocations(historicalQuarters, channelConfig),
    [historicalQuarters, channelConfig],
  );

  const manualTotal = useMemo(
    () => activeChannels.reduce((s, ch) => s + (allocations[ch.key] || 0), 0),
    [allocations, activeChannels],
  );
  const manualValid = Math.abs(manualTotal - 100) < 0.01;

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Target Allocation</h3>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-4">
        <button
          onClick={() => onModeChange('historical')}
          className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
            mode === 'historical'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Based on Historicals
        </button>
        <button
          onClick={() => onModeChange('manual')}
          className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Set the Target
        </button>
      </div>

      {mode === 'historical' ? (
        /* ── Historical mode ── */
        filledQuarters < 4 ? (
          <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
            <p className="text-sm text-amber-800">
              Complete at least 4 quarters of historical data to use this mode.
              {filledQuarters > 0 && ` (${filledQuarters}/4 filled)`}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Allocations based on your last {filledQuarters} quarter{filledQuarters !== 1 ? 's' : ''} of historical data.
            </p>
            <div className="space-y-2">
              {activeChannels.map((ch) => {
                const pct = historicalAlloc[ch.key];
                const amt = newARR * (pct / 100);
                return (
                  <div key={ch.key} className="flex items-center justify-between py-1.5 px-3 rounded bg-gray-50">
                    <span className="text-sm font-medium text-gray-700">{ch.label}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500 w-16 text-right">{pct.toFixed(1)}%</span>
                      <span className="text-sm font-semibold text-gray-900 w-28 text-right">
                        {formatCurrency(amt)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-200 px-3">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-700 w-16 text-right">
                    {activeChannels.reduce((s, ch) => s + historicalAlloc[ch.key], 0).toFixed(1)}%
                  </span>
                  <span className="text-sm font-bold text-gray-900 w-28 text-right">
                    {formatCurrency(newARR)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        /* ── Manual mode ── */
        <div>
          <div className="space-y-2">
            {activeChannels.map((ch) => {
              const pct = allocations[ch.key] || 0;
              const amt = newARR * (pct / 100);
              return (
                <div key={ch.key} className="flex items-center gap-3 py-1 px-3 rounded bg-gray-50">
                  <span className="text-sm font-medium text-gray-700 w-28">{ch.label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={pct || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onAllocationsChange({ ...allocations, [ch.key]: Math.max(0, Math.min(100, val)) });
                      }}
                      placeholder="0"
                      step={0.1}
                      min={0}
                      max={100}
                      className="w-20 text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  <span className="text-sm text-gray-500 ml-auto w-28 text-right">
                    {formatCurrency(amt)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total row */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200 px-3">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-semibold w-16 text-right ${
                manualValid ? 'text-green-700' : 'text-red-600'
              }`}>
                {manualTotal.toFixed(1)}%
                {manualValid && <span className="ml-1">&#10003;</span>}
              </span>
              <span className="text-sm font-bold text-gray-900 w-28 text-right">
                {formatCurrency(newARR)}
              </span>
            </div>
          </div>

          {/* Validation */}
          {!manualValid && manualTotal > 0 && (
            <div className="mt-3 border border-red-200 rounded-lg p-2.5 bg-red-50">
              <p className="text-xs text-red-700 font-medium">
                Allocations must total 100% (currently {manualTotal.toFixed(1)}%)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Auto-calculate historical averages from quarterly data ───

function computeHistoricalFromQuarters(quarters: QuarterlyHistoricalData[]): RevenueBreakdown | null {
  const filled = quarters.filter(isQuarterFilled);
  if (filled.length < 4) return null;

  const avg = (field: keyof QuarterlyHistoricalData) => {
    const values = filled.map((q) => q[field] as number).filter((v) => v > 0);
    return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  };

  return {
    newBusiness: {
      inbound: {
        hisMonthly: avg('inboundHIS') / 3,
        hisToPipelineRate: avg('inboundHISToPipelineRate'),
        winRate: avg('inboundWinRate'),
        acv: avg('inboundACV'),
        salesCycleMonths: avg('inboundSalesCycle'),
      },
      outbound: {
        pipelineMonthly: avg('outboundQualifiedPipeline') / 3,
        winRate: avg('outboundWinRate'),
        acv: avg('outboundACV'),
        salesCycleMonths: avg('outboundSalesCycle'),
      },
    },
    expansion: {
      expansionRate: avg('expansionRate'),
    },
    churn: {
      monthlyChurnRate: avg('churnRate'),
    },
    newProduct: {
      inbound: {
        hisMonthly: avg('newProductHIS') / 3,
        hisToPipelineRate: avg('newProductHISToPipelineRate'),
        winRate: avg('newProductWinRate'),
        acv: avg('newProductACV'),
        salesCycleMonths: avg('newProductSalesCycle'),
      },
      outbound: {
        pipelineMonthly: avg('newProductQualifiedPipeline') / 3,
        winRate: avg('newProductWinRate'),
        acv: avg('newProductACV'),
        salesCycleMonths: avg('newProductSalesCycle'),
      },
    },
  };
}

// ── Auto-calculate seasonality from 8 quarters ───────────────

function computeSeasonalityFromQuarters(quarters: QuarterlyHistoricalData[]): SeasonalityWeights | null {
  const filled = quarters.filter(isQuarterFilled);
  if (filled.length < 8) return null;

  // Group total revenue by quarter number (1-4)
  const byQ: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const q of filled) {
    const totalRev =
      q.inboundClosedWon + q.outboundClosedWon +
      q.expansionRevenue + q.newProductClosedWon -
      q.churnRevenue;
    if (totalRev > 0) byQ[q.quarter].push(totalRev);
  }

  const qAvgs = [1, 2, 3, 4].map((qn) => {
    const vals = byQ[qn];
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  });

  const overallAvg = qAvgs.reduce((s, v) => s + v, 0) / 4;
  if (overallAvg === 0) return null;

  const weights = qAvgs.map((v) => Math.round((v / overallAvg) * 100) / 100);

  // Map quarterly weights to monthly weights
  const monthly: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const qi = Math.ceil(m / 3) - 1; // 0-indexed quarter
    monthly[m] = weights[qi];
  }

  return { monthly: monthly as Record<Month, number> };
}

// ── Flat seasonality default ─────────────────────────────────

const FLAT_SEASONALITY: SeasonalityWeights = {
  monthly: {
    1: 1.0, 2: 1.0, 3: 1.0,
    4: 1.0, 5: 1.0, 6: 1.0,
    7: 1.0, 8: 1.0, 9: 1.0,
    10: 1.0, 11: 1.0, 12: 1.0,
  } as Record<Month, number>,
};

// ── Main component ───────────────────────────────────────────

export default function Setup() {
  const { plan, dispatch } = useGTMPlan();
  const cc = plan.channelConfig;

  const updateChannel = (key: keyof ChannelConfig, value: boolean) => {
    dispatch({ type: 'SET_CHANNEL_CONFIG', payload: { ...cc, [key]: value } });
  };

  const toggleInbound = (v: boolean) => {
    dispatch({ type: 'SET_CHANNEL_CONFIG', payload: { ...cc, hasInbound: v, hasInboundHistory: v } });
  };
  const toggleOutbound = (v: boolean) => {
    dispatch({ type: 'SET_CHANNEL_CONFIG', payload: { ...cc, hasOutbound: v, hasOutboundHistory: v } });
  };
  const toggleNewProduct = (v: boolean) => {
    dispatch({ type: 'SET_CHANNEL_CONFIG', payload: { ...cc, hasNewProduct: v, hasNewProductHistory: v } });
  };

  // Planning mode
  const planningMode = plan.planningMode ?? 'future-year';
  const currentMonthTop = plan.currentMonth ?? (new Date().getMonth() + 1) as Month;
  const detailedActuals = plan.detailedActuals ?? [];

  const completedMonthsDetailed = Array.from(
    { length: Math.max(0, currentMonthTop - 1) },
    (_, i) => (i + 1) as Month,
  );

  function getDetailedActual(month: Month): MonthlyActuals {
    return detailedActuals.find((a) => a.month === month) ?? {
      month,
      inboundPipelineCreated: 0, outboundPipelineCreated: 0,
      inboundClosedWon: 0, outboundClosedWon: 0,
      newProductInboundClosedWon: 0, newProductOutboundClosedWon: 0,
      expansionRevenue: 0, churnRevenue: 0,
      totalNewARR: 0, cumulativeARR: 0,
      inboundWinRate: 0, outboundWinRate: 0, hisToPipelineRate: 0,
      inboundACV: 0, outboundACV: 0,
    };
  }

  function updateDetailedActual(month: Month, field: keyof Omit<MonthlyActuals, 'month'>, value: number) {
    const existing = [...detailedActuals];
    const idx = existing.findIndex((a) => a.month === month);
    const current = getDetailedActual(month);
    const updated = { ...current, [field]: value };
    if (idx >= 0) {
      existing[idx] = updated;
    } else {
      existing.push(updated);
    }
    dispatch({ type: 'SET_DETAILED_ACTUALS', payload: existing });
  }

  // Historical quarters
  const historicalQuarters = plan.historicalQuarters ?? [];
  const filledCount = useMemo(
    () => historicalQuarters.filter(isQuarterFilled).length,
    [historicalQuarters],
  );

  // Auto-calculate historical averages + seasonality when quarters change
  const prevQuartersRef = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify(historicalQuarters);
    if (key === prevQuartersRef.current) return;
    prevQuartersRef.current = key;

    // Auto-calculate historical averages
    const computed = computeHistoricalFromQuarters(historicalQuarters);
    if (computed) {
      dispatch({ type: 'SET_HISTORICAL', payload: computed });
    }

    // Auto-calculate seasonality only if 8 quarters filled
    const filled = historicalQuarters.filter(isQuarterFilled).length;
    if (filled >= 8) {
      const seasonality = computeSeasonalityFromQuarters(historicalQuarters);
      if (seasonality) {
        dispatch({ type: 'SET_SEASONALITY', payload: seasonality });
      }
    } else {
      // Use flat seasonality when < 8 quarters
      dispatch({ type: 'SET_SEASONALITY', payload: FLAT_SEASONALITY });
    }
  }, [historicalQuarters, dispatch]);

  const handleQuartersChange = (quarters: QuarterlyHistoricalData[]) => {
    dispatch({ type: 'SET_HISTORICAL_QUARTERS', payload: quarters });
  };

  return (
    <div className="space-y-6">
      {/* Section 0: Planning Mode */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Planning Mode</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => dispatch({ type: 'SET_PLANNING_MODE', payload: 'future-year' })}
            className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
              planningMode === 'future-year'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            Future Year Plan
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_PLANNING_MODE', payload: 'in-year' })}
            className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
              planningMode === 'in-year'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            In-Year Reforecast
          </button>
        </div>

        {planningMode === 'in-year' && (
          <div className="mt-4 space-y-4">
            {/* Current Month Selector */}
            <div className="flex flex-col gap-1 max-w-xs">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Month</label>
              <select
                value={currentMonthTop}
                onChange={(e) => dispatch({ type: 'SET_CURRENT_MONTH', payload: parseInt(e.target.value) as Month })}
                className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={i + 1} value={i + 1}>{label}</option>
                ))}
              </select>
            </div>

            {/* Monthly Actuals Input Table */}
            {completedMonthsDetailed.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Monthly Actuals (Completed Months)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase sticky left-0 bg-white">Month</th>
                        {cc.hasInbound && (
                          <>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">IB Pipeline ($)</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">IB Closed Won ($)</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">IB Win Rate</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">HIS→Pipe Rate</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">IB ACV ($)</th>
                          </>
                        )}
                        {cc.hasOutbound && (
                          <>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">OB Pipeline ($)</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">OB Closed Won ($)</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">OB Win Rate</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">OB ACV ($)</th>
                          </>
                        )}
                        {cc.hasNewProduct && (
                          <>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">NP IB Won ($)</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">NP OB Won ($)</th>
                          </>
                        )}
                        {cc.hasExpansion && (
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Expansion ($)</th>
                        )}
                        {cc.hasChurn && (
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Churn ($)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {completedMonthsDetailed.map((m) => {
                        const a = getDetailedActual(m);
                        return (
                          <tr key={m} className="border-b border-gray-100">
                            <td className="py-2 px-2 font-medium text-gray-700 sticky left-0 bg-white">{MONTH_LABELS[m - 1]}</td>
                            {cc.hasInbound && (
                              <>
                                <td className="py-1 px-1"><input type="number" value={a.inboundPipelineCreated} onChange={(e) => updateDetailedActual(m, 'inboundPipelineCreated', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                <td className="py-1 px-1"><input type="number" value={a.inboundClosedWon} onChange={(e) => updateDetailedActual(m, 'inboundClosedWon', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                <td className="py-1 px-1"><input type="number" value={a.inboundWinRate} onChange={(e) => updateDetailedActual(m, 'inboundWinRate', parseFloat(e.target.value) || 0)} step={0.01} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                <td className="py-1 px-1"><input type="number" value={a.hisToPipelineRate} onChange={(e) => updateDetailedActual(m, 'hisToPipelineRate', parseFloat(e.target.value) || 0)} step={0.01} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                <td className="py-1 px-1"><input type="number" value={a.inboundACV} onChange={(e) => updateDetailedActual(m, 'inboundACV', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                              </>
                            )}
                            {cc.hasOutbound && (
                              <>
                                <td className="py-1 px-1"><input type="number" value={a.outboundPipelineCreated} onChange={(e) => updateDetailedActual(m, 'outboundPipelineCreated', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                <td className="py-1 px-1"><input type="number" value={a.outboundClosedWon} onChange={(e) => updateDetailedActual(m, 'outboundClosedWon', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                <td className="py-1 px-1"><input type="number" value={a.outboundWinRate} onChange={(e) => updateDetailedActual(m, 'outboundWinRate', parseFloat(e.target.value) || 0)} step={0.01} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                <td className="py-1 px-1"><input type="number" value={a.outboundACV} onChange={(e) => updateDetailedActual(m, 'outboundACV', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                              </>
                            )}
                            {cc.hasNewProduct && (
                              <>
                                <td className="py-1 px-1"><input type="number" value={a.newProductInboundClosedWon} onChange={(e) => updateDetailedActual(m, 'newProductInboundClosedWon', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                <td className="py-1 px-1"><input type="number" value={a.newProductOutboundClosedWon} onChange={(e) => updateDetailedActual(m, 'newProductOutboundClosedWon', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                              </>
                            )}
                            {cc.hasExpansion && (
                              <td className="py-1 px-1"><input type="number" value={a.expansionRevenue} onChange={(e) => updateDetailedActual(m, 'expansionRevenue', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                            )}
                            {cc.hasChurn && (
                              <td className="py-1 px-1"><input type="number" value={a.churnRevenue} onChange={(e) => updateDetailedActual(m, 'churnRevenue', parseFloat(e.target.value) || 0)} step={1000} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {completedMonthsDetailed.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                Select a current month above February to enter actuals for completed months.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Section 1: Revenue Targets */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue Targets</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <MetricInput
            label="Starting ARR"
            value={plan.startingARR}
            onChange={(v) => dispatch({ type: 'SET_PLAN_META', payload: { startingARR: v } })}
            type="currency"
          />
          <MetricInput
            label="Target ARR"
            value={plan.targetARR}
            onChange={(v) => dispatch({ type: 'SET_PLAN_META', payload: { targetARR: v } })}
            type="currency"
          />
        </div>

        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Channels</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3">
          <ChannelToggle label="Inbound" checked={cc.hasInbound} onChange={toggleInbound} />
          <ChannelToggle label="Outbound" checked={cc.hasOutbound} onChange={toggleOutbound} />
          <ChannelToggle label="New Product" checked={cc.hasNewProduct} onChange={toggleNewProduct} />
          <ChannelToggle label="Expansion" checked={cc.hasExpansion} onChange={(v) => updateChannel('hasExpansion', v)} />
          <ChannelToggle label="Churn" checked={cc.hasChurn} onChange={(v) => updateChannel('hasChurn', v)} />
        </div>
      </div>

      {/* Target Allocation */}
      <TargetAllocation
        mode={plan.targetAllocationMode ?? 'historical'}
        allocations={plan.targetAllocations ?? { inbound: 0, outbound: 0, expansion: 0, churn: 0, newProduct: 0 }}
        channelConfig={cc}
        targetARR={plan.targetARR}
        startingARR={plan.startingARR}
        filledQuarters={filledCount}
        historicalQuarters={historicalQuarters}
        onModeChange={(m) => dispatch({ type: 'SET_TARGET_ALLOCATION_MODE', payload: m })}
        onAllocationsChange={(a) => dispatch({ type: 'SET_TARGET_ALLOCATIONS', payload: a })}
      />

      {/* Historical Data Sheet */}
      <HistoricalDataSheet
        historicalQuarters={historicalQuarters}
        channelConfig={cc}
        planYear={plan.planYear}
        onChange={handleQuartersChange}
      />

      {/* Seasonality status note */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Seasonality</h3>
        {filledCount >= 8 ? (
          <p className="text-sm text-green-700">
            Auto-calculated from 8 quarters of historical data. Seasonality weights have been applied to your projections.
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            Enter 8 quarters of data to enable auto-calculated seasonality. Currently using flat seasonality (all months weighted equally at 1.0).
            {filledCount > 0 && (
              <span className="text-blue-600 font-medium ml-1">
                {filledCount}/8 quarters filled.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Validation warning */}
      {filledCount < 4 && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <p className="text-sm text-red-700 font-medium">
            Complete at least 4 quarters of historical data for accurate projections.
            {filledCount > 0
              ? ` You have ${filledCount} quarter${filledCount === 1 ? '' : 's'} filled so far.`
              : ' No historical data has been entered yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
