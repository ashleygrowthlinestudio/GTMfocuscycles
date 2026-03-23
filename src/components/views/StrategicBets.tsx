'use client';

import React, { useMemo } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import {
  runModel,
  runModelWithActuals,
  runModelWithBets,
  capModelAtTarget,
  applyChannelConfig,
  computeChannelMix,
  applyStrategicBets,
} from '@/lib/engine';
import { formatCurrencyFull, formatPercent } from '@/lib/format';
import BetSelector from '@/components/strategic/BetSelector';
import BetCard from '@/components/strategic/BetCard';
import BetComparisonTable from '@/components/strategic/BetComparisonTable';
import type { RampConfig } from '@/lib/types';

const DEFAULT_RAMP: RampConfig = { rampMonths: 1, startMonth: 1 };

export default function StrategicBets() {
  const { plan, dispatch } = useGTMPlan();

  const isInYear = plan.planningMode === 'in-year';
  const hasActuals = (plan.detailedActuals?.length ?? 0) > 0;
  const cm = plan.currentMonth ?? 1;

  // ── Channel-config-applied inputs ──
  const effectiveTargets = useMemo(
    () => applyChannelConfig(plan.targets, plan.channelConfig, 'targets'),
    [plan.targets, plan.channelConfig],
  );

  const effectiveHistorical = useMemo(
    () => applyChannelConfig(plan.historical, plan.channelConfig, 'historical'),
    [plan.historical, plan.channelConfig],
  );

  // ── Target model — matches TopDownPlan exactly (with cap) ──
  const uncappedTargetModel = useMemo(() => {
    if (isInYear && hasActuals) {
      return runModelWithActuals(
        effectiveTargets, plan.seasonality, DEFAULT_RAMP,
        plan.startingARR, plan.existingPipeline,
        plan.detailedActuals!, cm,
      );
    }
    return runModel(effectiveTargets, plan.seasonality, DEFAULT_RAMP, plan.startingARR, plan.existingPipeline);
  }, [isInYear, hasActuals, effectiveTargets, plan.seasonality, plan.startingARR, plan.existingPipeline, plan.detailedActuals, cm]);

  const targetModel = useMemo(
    () => capModelAtTarget(uncappedTargetModel, plan.targetARR, plan.startingARR),
    [uncappedTargetModel, plan.targetARR, plan.startingARR],
  );

  // ── Status quo model — historical inputs, flat seasonality, no ramp ──
  const flatSeasonality = useMemo(() => ({
    monthly: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, 1.0]),
    ) as Record<number, number>,
  }), []);

  const statusQuoModel = useMemo(() => {
    if (isInYear && hasActuals) {
      return runModelWithActuals(
        effectiveHistorical, flatSeasonality, DEFAULT_RAMP,
        plan.startingARR, plan.existingPipeline,
        plan.detailedActuals!, cm,
      );
    }
    return runModel(effectiveHistorical, flatSeasonality, DEFAULT_RAMP, plan.startingARR, plan.existingPipeline);
  }, [isInYear, hasActuals, effectiveHistorical, flatSeasonality, plan.startingARR, plan.existingPipeline, plan.detailedActuals, cm]);

  // ── Channel mix from status quo ──
  const channelMix = useMemo(
    () => computeChannelMix(statusQuoModel),
    [statusQuoModel],
  );

  const totalRevenue = useMemo(() => {
    const m = statusQuoModel.monthly;
    return m.reduce((s, r) =>
      s + r.inboundClosedWon + r.outboundClosedWon +
      r.newProductInboundClosedWon + r.newProductOutboundClosedWon +
      r.expansionRevenue + Math.abs(r.churnRevenue), 0);
  }, [statusQuoModel]);

  // ── With-bets model — same baseline as SQ, but with bets applied per-month ──
  const withBetsModel = useMemo(
    () => runModelWithBets(effectiveHistorical, plan.strategicBets, flatSeasonality, DEFAULT_RAMP, plan.startingARR, plan.existingPipeline),
    [effectiveHistorical, plan.strategicBets, flatSeasonality, plan.startingARR, plan.existingPipeline],
  );

  // Compute bet-modified targets for secondary row display (fully ramped)
  const betsTargets = useMemo(
    () => applyStrategicBets(effectiveHistorical, plan.strategicBets),
    [effectiveHistorical, plan.strategicBets],
  );

  const enabledBets = plan.strategicBets.filter((b) => b.enabled);

  // ── Target allocation context ──
  const alloc = plan.targetAllocations;
  const neededNewARR = plan.targetARR - plan.startingARR;
  const showAllocContext = (plan.targetAllocationMode === 'manual' || plan.targetAllocationMode === 'historical') && neededNewARR > 0;

  return (
    <div className="space-y-6">
      {/* Target allocation context */}
      {showAllocContext && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-blue-800">Your Revenue Targets Require</h2>
          <p className="text-xs text-blue-600 mt-1 mb-2">
            Select bets that help close the gap between status quo and these targets.
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            {alloc.inbound > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-blue-800">
                Inbound {formatCurrencyFull(Math.round(neededNewARR * alloc.inbound / 100))} ({alloc.inbound.toFixed(0)}%)
              </span>
            )}
            {alloc.outbound > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-blue-800">
                Outbound {formatCurrencyFull(Math.round(neededNewARR * alloc.outbound / 100))} ({alloc.outbound.toFixed(0)}%)
              </span>
            )}
            {alloc.expansion > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-purple-800">
                Expansion {formatCurrencyFull(Math.round(neededNewARR * alloc.expansion / 100))} ({alloc.expansion.toFixed(0)}%)
              </span>
            )}
            {alloc.churn > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-red-800">
                Churn Budget {formatCurrencyFull(Math.round(neededNewARR * alloc.churn / 100))} ({alloc.churn.toFixed(0)}%)
              </span>
            )}
            {alloc.newProduct > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-green-800">
                New Product {formatCurrencyFull(Math.round(neededNewARR * alloc.newProduct / 100))} ({alloc.newProduct.toFixed(0)}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Intro */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-purple-800">Strategic Bets Calculator</h2>
        <p className="text-xs text-purple-700 mt-1">
          Select 1-3 metrics to improve and model the impact. The goal is to identify the highest-leverage
          changes that will close the gap between your status quo and your target. Your team should leave
          this exercise with a focused set of strategic bets to row in the same direction.
        </p>
      </div>

      {/* Active bets */}
      {plan.strategicBets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Your Strategic Bets ({enabledBets.length} active)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {plan.strategicBets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                onUpdate={(b) => dispatch({ type: 'UPDATE_BET', payload: b })}
                onRemove={(id) => dispatch({ type: 'REMOVE_BET', payload: id })}
                onToggle={(id) => dispatch({ type: 'TOGGLE_BET', payload: id })}
                totalRevenue={totalRevenue}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add bets */}
      <BetSelector
        existingBets={plan.strategicBets}
        historical={plan.historical}
        channelMix={channelMix}
        totalRevenue={totalRevenue}
        onAdd={(bet) => dispatch({ type: 'ADD_BET', payload: bet })}
      />

      {/* Comparison */}
      {plan.strategicBets.length > 0 && (
        <BetComparisonTable
          statusQuoQuarterly={statusQuoModel.quarterly}
          withBetsQuarterly={withBetsModel.quarterly}
          targetQuarterly={targetModel.quarterly}
          statusQuoMonthly={statusQuoModel.monthly}
          withBetsMonthly={withBetsModel.monthly}
          targetMonthly={targetModel.monthly}
          targetARR={plan.targetARR}
          startingARR={plan.startingARR}
          bets={plan.strategicBets}
          sqTargets={effectiveHistorical}
          betsTargets={betsTargets}
          planTargets={effectiveTargets}
        />
      )}
    </div>
  );
}
