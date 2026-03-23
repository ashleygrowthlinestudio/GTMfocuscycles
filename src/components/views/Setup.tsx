'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import MetricInput from '@/components/shared/MetricInput';
import HistoricalDataSheet, { isQuarterFilled, generateQuarterSlots, createEmptyQuarter } from '@/components/shared/HistoricalDataSheet';
import type { ChannelConfig, Month, MonthlyActuals, QuarterlyHistoricalData, RevenueBreakdown, SeasonalityWeights, PlanningMode, TargetAllocationMode, TargetAllocations, MarketInsight } from '@/lib/types';
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
  monthlyChurnRate: number;
  onModeChange: (mode: TargetAllocationMode) => void;
  onAllocationsChange: (alloc: TargetAllocations) => void;
}

type AllocChannel = 'inbound' | 'outbound' | 'expansion' | 'churn' | 'newProduct'
  | 'emergingInbound' | 'emergingOutbound' | 'emergingNewProduct';

// Positive (gross) channels — excludes churn
const POSITIVE_CHANNELS: { key: AllocChannel; label: string; configKey: keyof ChannelConfig }[] = [
  { key: 'inbound', label: 'Inbound', configKey: 'hasInbound' },
  { key: 'outbound', label: 'Outbound', configKey: 'hasOutbound' },
  { key: 'expansion', label: 'Expansion', configKey: 'hasExpansion' },
  { key: 'newProduct', label: 'New Product', configKey: 'hasNewProduct' },
];

const EMERGING_ALLOC_CHANNELS: { key: AllocChannel; label: string; configKey: keyof ChannelConfig }[] = [
  { key: 'emergingInbound', label: 'Inbound (Emerging)', configKey: 'hasEmergingInbound' },
  { key: 'emergingOutbound', label: 'Outbound (Emerging)', configKey: 'hasEmergingOutbound' },
  { key: 'emergingNewProduct', label: 'New Product (Emerging)', configKey: 'hasEmergingNewProduct' },
];

function computeHistoricalAllocations(
  quarters: QuarterlyHistoricalData[],
  cc: ChannelConfig,
): Record<AllocChannel, number> {
  const zero: Record<AllocChannel, number> = { inbound: 0, outbound: 0, expansion: 0, churn: 0, newProduct: 0, emergingInbound: 0, emergingOutbound: 0, emergingNewProduct: 0 };
  const filled = quarters.filter(isQuarterFilled);
  if (filled.length === 0) return zero;

  let totalIb = 0, totalOb = 0, totalExp = 0, totalChurn = 0, totalNp = 0;
  for (const q of filled) {
    totalIb += q.inboundClosedWon;
    totalOb += q.outboundClosedWon;
    totalExp += q.expansionRevenue;
    totalChurn += Math.abs(q.churnRevenue); // churn stored as negative
    totalNp += q.newProductClosedWon;
  }

  // Sum only ACTIVE channels so percentages normalize to 100%
  const activeTotal =
    (cc.hasInbound ? totalIb : 0) +
    (cc.hasOutbound ? totalOb : 0) +
    (cc.hasExpansion ? totalExp : 0) +
    (cc.hasNewProduct ? totalNp : 0);

  if (activeTotal === 0) return zero;

  // Gross total (all channels) for churn % baseline
  const grossTotal = totalIb + totalOb + totalExp + totalNp;

  return {
    inbound: cc.hasInbound ? Math.round((totalIb / activeTotal) * 10000) / 100 : 0,
    outbound: cc.hasOutbound ? Math.round((totalOb / activeTotal) * 10000) / 100 : 0,
    expansion: cc.hasExpansion ? Math.round((totalExp / activeTotal) * 10000) / 100 : 0,
    churn: cc.hasChurn && grossTotal > 0 ? Math.round((totalChurn / grossTotal) * 10000) / 100 : 0,
    newProduct: cc.hasNewProduct ? Math.round((totalNp / activeTotal) * 10000) / 100 : 0,
    emergingInbound: 0,
    emergingOutbound: 0,
    emergingNewProduct: 0,
  };
}

function TargetAllocation({
  mode, allocations, channelConfig, targetARR, startingARR, filledQuarters,
  historicalQuarters, monthlyChurnRate, onModeChange, onAllocationsChange,
}: TargetAllocationProps) {
  const newARR = targetARR - startingARR; // net ARR gap
  const activePositive = POSITIVE_CHANNELS.filter((ch) => channelConfig[ch.configKey]);
  const activeEmerging = EMERGING_ALLOC_CHANNELS.filter((ch) => channelConfig[ch.configKey]);
  const hasChurn = channelConfig.hasChurn;
  const allGrossChannels = [...activePositive, ...activeEmerging];

  const historicalAlloc = useMemo(
    () => computeHistoricalAllocations(historicalQuarters, channelConfig),
    [historicalQuarters, channelConfig],
  );

  // Gross = sum of all revenue-generating channel %s; must equal 100%
  const grossPct = useMemo(
    () => allGrossChannels.reduce((s, ch) => s + (allocations[ch.key] || 0), 0),
    [allocations, allGrossChannels],
  );
  const grossValid = Math.abs(grossPct - 100) < 0.01;

  // Expected churn — read-only, derived from churn rate × starting ARR
  const expectedAnnualChurn = hasChurn ? startingARR * monthlyChurnRate * 12 : 0;

  // Gross target = ARR gap + churn to recover (channels must produce this much)
  const grossTarget = newARR + expectedAnnualChurn;

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
              {' '}Percentages normalized to 100% across active channels.
            </p>
            <div className="space-y-2">
              {activePositive.map((ch) => {
                const pct = historicalAlloc[ch.key];
                const amt = grossTarget * (pct / 100);
                return (
                  <div key={ch.key} className="flex items-center justify-between py-1.5 px-3 rounded bg-gray-50">
                    <span className="text-sm font-medium text-gray-700">
                      {ch.label}
                      {pct === 0 && <span className="ml-2 text-xs text-gray-400 italic">No historical data</span>}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500 w-16 text-right">{pct.toFixed(1)}%</span>
                      <span className="text-sm font-semibold text-gray-900 w-28 text-right">
                        {formatCurrency(amt)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {/* Total rows — historical */}
              {(() => {
                const histGross = activePositive.reduce((s, ch) => s + historicalAlloc[ch.key], 0);
                return (
                  <>
                    {hasChurn && expectedAnnualChurn > 0 && (
                      <p className="text-xs text-gray-500 px-3 mt-2 mb-1">
                        ARR gap: {formatCurrency(newARR)} + Churn to recover: {formatCurrency(expectedAnnualChurn)} = Gross target: {formatCurrency(grossTarget)}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-200 px-3">
                      <span className="text-sm font-semibold text-gray-700">Gross Target</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-green-700 w-16 text-right">
                          {histGross.toFixed(1)}%
                        </span>
                        <span className="text-sm font-bold text-gray-900 w-28 text-right">
                          {formatCurrency(grossTarget)}
                        </span>
                      </div>
                    </div>
                    {hasChurn && expectedAnnualChurn > 0 && (
                      <div className="flex items-center justify-between px-3">
                        <span className="text-sm text-red-600">Churn to recover</span>
                        <span className="text-sm font-semibold text-red-600 w-28 text-right">
                          +{formatCurrency(expectedAnnualChurn)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3 pt-1 border-t border-dashed border-gray-300">
                      <span className="text-sm font-bold text-gray-900">Net New ARR (= your ARR gap)</span>
                      <span className="text-sm font-bold text-gray-900 w-28 text-right">
                        {formatCurrency(newARR)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )
      ) : (
        /* ── Manual mode ── */
        <div>
          <div className="space-y-2">
            {activePositive.map((ch) => {
              const pct = allocations[ch.key] || 0;
              const amt = grossTarget * (pct / 100);
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

          {/* Emerging Channels */}
          {activeEmerging.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2 px-3">Emerging Channels</p>
              <div className="space-y-2">
                {activeEmerging.map((ch) => {
                  const pct = allocations[ch.key] || 0;
                  const amt = grossTarget * (pct / 100);
                  return (
                    <div key={ch.key} className="flex items-center gap-3 py-1 px-3 rounded bg-purple-50">
                      <span className="text-sm font-medium text-purple-700 w-28">{ch.label}</span>
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
                          className="w-20 text-right rounded border border-purple-300 py-1 px-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                        <span className="text-xs text-purple-400">%</span>
                      </div>
                      <span className="text-sm text-purple-500 ml-auto w-28 text-right">
                        {formatCurrency(amt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Math breakdown */}
          {hasChurn && expectedAnnualChurn > 0 && (
            <p className="text-xs text-gray-500 px-3 mt-3 mb-1">
              ARR gap: {formatCurrency(newARR)} + Churn to recover: {formatCurrency(expectedAnnualChurn)} = Gross target: {formatCurrency(grossTarget)}
            </p>
          )}

          {/* Gross Target row */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200 px-3">
            <span className="text-sm font-semibold text-gray-700">Gross Target</span>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-semibold w-16 text-right ${
                grossValid ? 'text-green-700' : 'text-red-600'
              }`}>
                {grossPct.toFixed(1)}%
                {grossValid && <span className="ml-1">&#10003;</span>}
              </span>
              <span className={`text-sm font-bold w-28 text-right ${grossValid ? 'text-gray-900' : 'text-red-600'}`}>
                {formatCurrency(grossTarget)}
              </span>
            </div>
          </div>

          {/* Churn to recover row */}
          {hasChurn && expectedAnnualChurn > 0 && (
            <div className="flex items-center justify-between px-3">
              <span className="text-sm text-red-600">Churn to recover</span>
              <span className="text-sm font-semibold text-red-600 w-28 text-right">
                +{formatCurrency(expectedAnnualChurn)}
              </span>
            </div>
          )}

          {/* Net New ARR row */}
          <div className="flex items-center justify-between px-3 pt-1 border-t border-dashed border-gray-300">
            <span className="text-sm font-bold text-gray-900">Net New ARR (= your ARR gap)</span>
            <span className="text-sm font-bold text-gray-900 w-28 text-right">
              {formatCurrency(newARR)}
            </span>
          </div>

          {/* Validation */}
          {!grossValid && grossPct > 0 && (
            <div className="mt-3 border border-red-200 rounded-lg p-2.5 bg-red-50">
              <p className="text-xs text-red-700 font-medium">
                Allocations must total 100% (currently {grossPct.toFixed(1)}%)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Auto-calculate historical averages from quarterly data ───

function clampSalesCycle(v: number): number {
  // If value > 18, likely entered in days — convert to months; then clamp to [0, 18]
  if (v > 18) return Math.min(v / 30, 18);
  return Math.max(0, v);
}

function computeHistoricalFromQuarters(quarters: QuarterlyHistoricalData[]): RevenueBreakdown | null {
  const filled = quarters.filter(isQuarterFilled);
  if (filled.length < 4) return null;

  const avg = (field: keyof QuarterlyHistoricalData) => {
    const values = filled.map((q) => q[field] as number).filter((v) => v > 0);
    return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  };

  // churnRate from quarters is quarterly — convert to monthly (divide by 3)
  const avgQuarterlyChurnRate = avg('churnRate');
  const monthlyChurnRate = avgQuarterlyChurnRate / 3;

  return {
    newBusiness: {
      inbound: {
        hisMonthly: avg('inboundHIS') / 3,
        hisToPipelineRate: avg('inboundHISToPipelineRate'),
        winRate: avg('inboundWinRate'),
        acv: avg('inboundACV'),
        salesCycleMonths: clampSalesCycle(avg('inboundSalesCycle')),
      },
      outbound: {
        pipelineMonthly: avg('outboundQualifiedPipeline') / 3,
        winRate: avg('outboundWinRate'),
        acv: avg('outboundACV'),
        salesCycleMonths: clampSalesCycle(avg('outboundSalesCycle')),
      },
    },
    expansion: {
      pipelineMonthly: avg('expansionPipeline') / 3,
      winRate: avg('expansionWinRate'),
      acv: avg('expansionACV'),
      salesCycleMonths: clampSalesCycle(avg('expansionSalesCycle')),
    },
    churn: {
      monthlyChurnRate,
    },
    newProduct: {
      inbound: {
        hisMonthly: avg('newProductHIS') / 3,
        hisToPipelineRate: avg('newProductHISToPipelineRate'),
        winRate: avg('newProductWinRate'),
        acv: avg('newProductACV'),
        salesCycleMonths: clampSalesCycle(avg('newProductSalesCycle')),
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
      month, hisVolume: 0,
      inboundPipelineCreated: 0, outboundPipelineCreated: 0,
      inboundClosedWon: 0, outboundClosedWon: 0,
      newProductInboundClosedWon: 0,
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
                            <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">HIS Volume</th>
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
                                <td className="py-1 px-1"><input type="number" value={a.hisVolume} onChange={(e) => updateDetailedActual(m, 'hisVolume', parseInt(e.target.value) || 0)} step={1} className="w-full text-right rounded border border-gray-300 py-1 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></td>
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

        <div className="mt-6 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Emerging Channels</h4>
          <p className="text-xs text-gray-400 mb-3">Channels you&apos;re building for the first time — no historical data required</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            <div>
              <ChannelToggle
                label="Inbound"
                checked={cc.hasEmergingInbound ?? false}
                onChange={(v) => {
                  if (v && cc.hasInbound) { alert('This channel is already marked as active. Remove it from Active Channels first.'); return; }
                  dispatch({ type: 'SET_EMERGING_CHANNELS', payload: { hasEmergingInbound: v } });
                }}
              />
              {cc.hasEmergingInbound && cc.hasInbound && (
                <p className="text-[10px] text-amber-600 mt-0.5">Already active — remove from Active first</p>
              )}
            </div>
            <div>
              <ChannelToggle
                label="Outbound"
                checked={cc.hasEmergingOutbound ?? false}
                onChange={(v) => {
                  if (v && cc.hasOutbound) { alert('This channel is already marked as active. Remove it from Active Channels first.'); return; }
                  dispatch({ type: 'SET_EMERGING_CHANNELS', payload: { hasEmergingOutbound: v } });
                }}
              />
              {cc.hasEmergingOutbound && cc.hasOutbound && (
                <p className="text-[10px] text-amber-600 mt-0.5">Already active — remove from Active first</p>
              )}
            </div>
            <div>
              <ChannelToggle
                label="New Product"
                checked={cc.hasEmergingNewProduct ?? false}
                onChange={(v) => {
                  if (v && cc.hasNewProduct) { alert('This channel is already marked as active. Remove it from Active Channels first.'); return; }
                  dispatch({ type: 'SET_EMERGING_CHANNELS', payload: { hasEmergingNewProduct: v } });
                }}
              />
              {cc.hasEmergingNewProduct && cc.hasNewProduct && (
                <p className="text-[10px] text-amber-600 mt-0.5">Already active — remove from Active first</p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 italic">Emerging channels use your target inputs only. No historical comparison will be shown.</p>
        </div>
      </div>

      {/* Target Allocation */}
      <TargetAllocation
        mode={plan.targetAllocationMode ?? 'historical'}
        allocations={plan.targetAllocations ?? { inbound: 0, outbound: 0, expansion: 0, churn: 0, newProduct: 0, emergingInbound: 0, emergingOutbound: 0, emergingNewProduct: 0 }}
        channelConfig={cc}
        targetARR={plan.targetARR}
        startingARR={plan.startingARR}
        filledQuarters={filledCount}
        historicalQuarters={historicalQuarters}
        monthlyChurnRate={plan.targets.churn.monthlyChurnRate}
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

      {/* Market Insights & Known Risks */}
      <MarketInsightsSection />
    </div>
  );
}

// ── Market Insights Section ─────────────────────────────────

const INSIGHT_CHANNEL_OPTIONS: { value: MarketInsight['channel']; label: string }[] = [
  { value: 'all', label: 'All Channels' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'newProduct', label: 'New Product' },
  { value: 'expansion', label: 'Expansion' },
  { value: 'churn', label: 'Churn' },
];

const INSIGHT_METRIC_OPTIONS: { value: MarketInsight['metric']; label: string }[] = [
  { value: 'overall', label: 'Overall Revenue' },
  { value: 'pipeline', label: 'Pipeline Volume' },
  { value: 'winRate', label: 'Win Rate' },
  { value: 'churnRate', label: 'Churn Rate' },
  { value: 'hisVolume', label: 'HIS Volume' },
  { value: 'acv', label: 'ACV' },
];

const IMPACT_DESCRIPTORS = [
  { label: 'Strong Growth', emoji: '\u{1F680}', pct: 40 },
  { label: 'Moderate Growth', emoji: '\u{1F4C8}', pct: 20 },
  { label: 'Slight Growth', emoji: '\u{1F4CA}', pct: 10 },
  { label: 'Flat', emoji: '\u27A1\uFE0F', pct: 0 },
  { label: 'Slight Decline', emoji: '\u{1F4C9}', pct: -15 },
  { label: 'Significant Decline', emoji: '\u2B07\uFE0F', pct: -35 },
  { label: 'Near Zero', emoji: '\u{1F53B}', pct: -65 },
] as const;

const OFFSET_DESCRIPTORS = [
  { label: 'Slight Growth', emoji: '\u{1F4CA}', pct: 10 },
  { label: 'Moderate Growth', emoji: '\u{1F4C8}', pct: 20 },
  { label: 'Strong Growth', emoji: '\u{1F680}', pct: 40 },
  { label: 'Fully Compensates', emoji: '\u2705', pct: null as number | null }, // computed at save
] as const;

function descriptorForPct(pct: number): string {
  let bestLabel = 'Flat';
  let bestDist = Infinity;
  for (const d of IMPACT_DESCRIPTORS) {
    const dist = Math.abs(d.pct - pct);
    if (dist < bestDist) { bestDist = dist; bestLabel = d.label; }
  }
  return bestLabel;
}

function MarketInsightsSection() {
  const { plan, dispatch } = useGTMPlan();
  const insights = plan.marketInsights ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState<MarketInsight['channel']>('all');
  const [metric, setMetric] = useState<MarketInsight['metric']>('overall');
  const [impactType, setImpactType] = useState<'oneTime' | 'gradual'>('oneTime');
  const [impactMonth, setImpactMonth] = useState<number>(1);
  const [impactDurationMonths, setImpactDurationMonths] = useState(3);
  const [selectedDescriptor, setSelectedDescriptor] = useState<string>('Flat');
  const [impactPct, setImpactPct] = useState(0);

  // Offset state
  const [showOffset, setShowOffset] = useState(false);
  const [offsetChannel, setOffsetChannel] = useState<MarketInsight['channel']>('inbound');
  const [offsetDescriptor, setOffsetDescriptor] = useState<string>('Moderate Growth');

  function resetForm() {
    setLabel('');
    setDescription('');
    setChannel('all');
    setMetric('overall');
    setImpactType('oneTime');
    setImpactMonth(1);
    setImpactDurationMonths(3);
    setSelectedDescriptor('Flat');
    setImpactPct(0);
    setShowOffset(false);
    setOffsetChannel('inbound');
    setOffsetDescriptor('Moderate Growth');
    setEditingId(null);
    setShowForm(false);
  }

  function selectDescriptor(d: typeof IMPACT_DESCRIPTORS[number]) {
    setSelectedDescriptor(d.label);
    setImpactPct(d.pct);
  }

  function handleSave() {
    if (!label.trim()) return;

    const insightId = editingId ?? crypto.randomUUID();
    const insight: MarketInsight = {
      id: insightId,
      label: label.trim(),
      description: description.trim(),
      channel,
      metric,
      impactType,
      impactMonth: impactMonth as Month,
      impactDurationMonths: impactType === 'oneTime' ? 1 : impactDurationMonths,
      impactPct: impactPct / 100,
      impactDescriptor: selectedDescriptor,
      enabled: true,
    };

    if (editingId) {
      const existing = insights.find((i) => i.id === editingId);
      if (existing) insight.enabled = existing.enabled;

      // Remove old offset if it existed
      if (existing?.offsetInsightId) {
        dispatch({ type: 'REMOVE_INSIGHT', payload: existing.offsetInsightId });
      }
      dispatch({ type: 'UPDATE_INSIGHT', payload: insight });
    } else {
      dispatch({ type: 'ADD_INSIGHT', payload: insight });
    }

    // Create offset insight if enabled
    if (showOffset && offsetChannel !== channel) {
      const offsetDef = OFFSET_DESCRIPTORS.find((d) => d.label === offsetDescriptor);
      const offsetPctVal = offsetDef?.pct !== null && offsetDef?.pct !== undefined
        ? offsetDef.pct
        : Math.abs(impactPct); // Fully Compensates = inverse
      const offsetId = crypto.randomUUID();
      const offsetInsight: MarketInsight = {
        id: offsetId,
        label: `${label.trim()} (offset)`,
        description: `Offset: ${INSIGHT_CHANNEL_OPTIONS.find((o) => o.value === offsetChannel)?.label} compensates for ${INSIGHT_CHANNEL_OPTIONS.find((o) => o.value === channel)?.label}`,
        channel: offsetChannel,
        metric,
        impactType,
        impactMonth: impactMonth as Month,
        impactDurationMonths: impactType === 'oneTime' ? 1 : impactDurationMonths,
        impactPct: offsetPctVal / 100, // positive = tailwind
        impactDescriptor: offsetDescriptor,
        enabled: true,
        offsetInsightId: insightId,
      };
      dispatch({ type: 'ADD_INSIGHT', payload: offsetInsight });
      // Link primary to offset
      insight.offsetInsightId = offsetId;
      dispatch({ type: 'UPDATE_INSIGHT', payload: insight });
    }

    resetForm();
  }

  function startEdit(insight: MarketInsight) {
    setEditingId(insight.id);
    setLabel(insight.label);
    setDescription(insight.description);
    setChannel(insight.channel);
    setMetric(insight.metric);
    setImpactType(insight.impactType);
    setImpactMonth(insight.impactMonth);
    setImpactDurationMonths(insight.impactDurationMonths);
    const pctVal = Math.round(insight.impactPct * 100);
    setImpactPct(pctVal);
    setSelectedDescriptor(insight.impactDescriptor || descriptorForPct(pctVal));

    // Check for existing offset
    if (insight.offsetInsightId) {
      const offset = insights.find((i) => i.id === insight.offsetInsightId);
      if (offset) {
        setShowOffset(true);
        setOffsetChannel(offset.channel);
        setOffsetDescriptor(offset.impactDescriptor || 'Moderate Growth');
      }
    } else {
      setShowOffset(false);
      setOffsetChannel('inbound');
      setOffsetDescriptor('Moderate Growth');
    }
    setShowForm(true);
  }

  // Filter active channels for offset dropdown
  const cc = plan.channelConfig;
  const activeChannelOptions = INSIGHT_CHANNEL_OPTIONS.filter((o) => {
    if (o.value === 'all') return false;
    if (o.value === channel) return false;
    if (o.value === 'inbound' && !cc.hasInbound) return false;
    if (o.value === 'outbound' && !cc.hasOutbound) return false;
    if (o.value === 'newProduct' && !cc.hasNewProduct) return false;
    if (o.value === 'expansion' && !cc.hasExpansion) return false;
    if (o.value === 'churn' && !cc.hasChurn) return false;
    return true;
  });

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Market Insights & Known Risks</h3>
          <p className="text-xs text-gray-500 mt-1">
            What do you know that the data doesn&apos;t show yet? Add gut-feel signals, known upcoming events, or market shifts that should affect your projections.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shrink-0"
          >
            + Add Insight
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="mt-4 border border-blue-200 rounded-lg p-4 bg-blue-50/50 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Big churn month coming"
                className="w-full rounded border border-gray-300 py-1.5 px-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Company X ($150K) churning in June"
                className="w-full rounded border border-gray-300 py-1.5 px-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Affects</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as MarketInsight['channel'])}
                className="w-full rounded border border-gray-300 py-1.5 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              >
                {INSIGHT_CHANNEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Metric Impacted</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as MarketInsight['metric'])}
                className="w-full rounded border border-gray-300 py-1.5 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              >
                {INSIGHT_METRIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Starting Month</label>
              <select
                value={impactMonth}
                onChange={(e) => setImpactMonth(parseInt(e.target.value))}
                className="w-full rounded border border-gray-300 py-1.5 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              >
                {MONTH_LABELS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Impact Type</label>
              <div className="flex gap-1 bg-gray-200 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setImpactType('oneTime')}
                  className={`flex-1 px-2 py-1.5 text-xs rounded font-medium transition-colors ${
                    impactType === 'oneTime' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  One-time
                </button>
                <button
                  type="button"
                  onClick={() => setImpactType('gradual')}
                  className={`flex-1 px-2 py-1.5 text-xs rounded font-medium transition-colors ${
                    impactType === 'gradual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Gradual
                </button>
              </div>
            </div>
          </div>

          {impactType === 'gradual' && (
            <div className="max-w-xs">
              <label className="text-xs font-medium text-gray-600 block mb-1">Duration (months)</label>
              <input
                type="number"
                value={impactDurationMonths}
                onChange={(e) => setImpactDurationMonths(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                min={1}
                max={12}
                className="w-full rounded border border-gray-300 py-1.5 px-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          {/* Impact descriptor pill buttons */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Expected Impact</label>
            <div className="flex flex-wrap gap-2">
              {IMPACT_DESCRIPTORS.map((d) => {
                const isSelected = selectedDescriptor === d.label;
                const colorClass = d.pct > 0
                  ? isSelected ? 'bg-green-100 border-green-400 text-green-800 ring-2 ring-green-400' : 'bg-white border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
                  : d.pct < 0
                  ? isSelected ? 'bg-red-100 border-red-400 text-red-800 ring-2 ring-red-400' : 'bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
                  : isSelected ? 'bg-gray-200 border-gray-400 text-gray-800 ring-2 ring-gray-400' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50';
                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => selectDescriptor(d)}
                    className={`inline-flex flex-col items-center px-3 py-2 rounded-full border text-xs font-medium transition-all ${colorClass}`}
                  >
                    <span>{d.emoji} {d.label}</span>
                    <span className="text-[10px] font-normal opacity-60 mt-0.5">
                      {d.pct > 0 ? '+' : ''}{d.pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Offset channel section */}
          <div className="border-t border-blue-200 pt-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={showOffset}
                onClick={() => setShowOffset(!showOffset)}
                className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  showOffset ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition ${
                    showOffset ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-medium text-gray-600">Will another channel compensate for this?</span>
            </label>

            {showOffset && (
              <div className="mt-3 ml-9 space-y-3">
                <div className="max-w-xs">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Which channel will pick up the slack?</label>
                  <select
                    value={offsetChannel}
                    onChange={(e) => setOffsetChannel(e.target.value as MarketInsight['channel'])}
                    className="w-full rounded border border-gray-300 py-1.5 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    {activeChannelOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">How much will it compensate?</label>
                  <div className="flex flex-wrap gap-2">
                    {OFFSET_DESCRIPTORS.map((d) => {
                      const isSelected = offsetDescriptor === d.label;
                      return (
                        <button
                          key={d.label}
                          type="button"
                          onClick={() => setOffsetDescriptor(d.label)}
                          className={`inline-flex flex-col items-center px-3 py-2 rounded-full border text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-green-100 border-green-400 text-green-800 ring-2 ring-green-400'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
                          }`}
                        >
                          <span>{d.emoji} {d.label}</span>
                          <span className="text-[10px] font-normal opacity-60 mt-0.5">
                            {d.pct !== null ? `+${d.pct}%` : `+${Math.abs(impactPct)}%`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!label.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingId ? 'Update Insight' : 'Save Insight'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Saved insight cards */}
      {insights.length > 0 && (
        <div className="mt-4 space-y-2">
          {insights.map((insight) => {
            // Skip offset insights shown inline — they display with their primary
            const isPrimaryOffset = insight.offsetInsightId && insights.some((p) => p.offsetInsightId === insight.id);
            if (isPrimaryOffset) return null;

            const isNeg = insight.impactPct < 0;
            const borderColor = isNeg ? 'border-red-300' : 'border-green-300';
            const bgColor = insight.enabled
              ? isNeg ? 'bg-red-50/50' : 'bg-green-50/50'
              : 'bg-gray-50';
            const channelLabel = INSIGHT_CHANNEL_OPTIONS.find((o) => o.value === insight.channel)?.label ?? insight.channel;
            const descriptor = insight.impactDescriptor || descriptorForPct(Math.round(insight.impactPct * 100));
            const monthLabel = MONTH_LABELS[(insight.impactMonth ?? 1) - 1];
            const quarterLabel = `Q${Math.ceil((insight.impactMonth ?? 1) / 3)}`;

            // Check for linked offset
            const offsetInsight = insight.offsetInsightId ? insights.find((i) => i.id === insight.offsetInsightId) : null;
            const offsetChannelLabel = offsetInsight ? (INSIGHT_CHANNEL_OPTIONS.find((o) => o.value === offsetInsight.channel)?.label ?? offsetInsight.channel) : null;
            const offsetDesc = offsetInsight?.impactDescriptor || (offsetInsight ? descriptorForPct(Math.round(offsetInsight.impactPct * 100)) : null);

            return (
              <div key={insight.id} className={`border rounded-lg p-3 ${borderColor} ${bgColor} ${!insight.enabled ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={insight.enabled}
                      onChange={() => {
                        dispatch({ type: 'TOGGLE_INSIGHT', payload: insight.id });
                        if (offsetInsight) dispatch({ type: 'TOGGLE_INSIGHT', payload: offsetInsight.id });
                      }}
                      className={`mt-0.5 rounded ${isNeg ? 'text-red-600 focus:ring-red-500' : 'text-green-600 focus:ring-green-500'} border-gray-300`}
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-gray-800">{insight.label}</h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {channelLabel} —{' '}
                        <span className={isNeg ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                          {descriptor}
                        </span>{' '}
                        starting {quarterLabel} ({monthLabel})
                      </p>
                      {offsetInsight && offsetChannelLabel && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          Offset by {offsetChannelLabel}: <span className="font-medium">{offsetDesc}</span>
                        </p>
                      )}
                      {insight.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{insight.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(insight)}
                      className="text-xs text-gray-400 hover:text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (insight.offsetInsightId) dispatch({ type: 'REMOVE_INSIGHT', payload: insight.offsetInsightId });
                        dispatch({ type: 'REMOVE_INSIGHT', payload: insight.id });
                      }}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
