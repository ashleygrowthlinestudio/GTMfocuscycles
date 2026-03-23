'use client';

import React, { useMemo } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import {
  runTopDownModel,
  calcHistoricalAverages,
  runStatusQuoModel,
} from '@/lib/engine';
import type { ActualMonth } from '@/lib/engine';
import { formatCurrencyFull, formatPercent } from '@/lib/format';
import BetSelector from '@/components/strategic/BetSelector';
import BetCard from '@/components/strategic/BetCard';
import BetComparisonTable from '@/components/strategic/BetComparisonTable';
import type { MonthlyActuals } from '@/lib/types';

function toActualMonth(a: MonthlyActuals): ActualMonth {
  return {
    month: a.month,
    inboundClosedWon: a.inboundClosedWon,
    outboundClosedWon: a.outboundClosedWon,
    expansionRevenue: a.expansionRevenue,
    newProductClosedWon: a.newProductInboundClosedWon,
    churnRevenue: a.churnRevenue,
    totalNewARR: a.totalNewARR,
    cumulativeARR: a.cumulativeARR,
    inboundPipelineCreated: a.inboundPipelineCreated,
    outboundPipelineCreated: a.outboundPipelineCreated,
    expansionPipelineCreated: 0,
    newProductPipelineCreated: 0,
    inboundHIS: a.hisVolume,
    inboundDeals: 0,
    outboundDeals: 0,
    expansionDeals: 0,
    newProductDeals: 0,
  };
}

export default function StrategicBets() {
  const { plan, dispatch } = useGTMPlan();

  const cc = plan.channelConfig;
  const cm = plan.currentMonth ?? 1;

  // ── Target model (same as TopDownPlan.tsx) ──────────────────
  const alloc = plan.targetAllocations;
  const churnAnnual = plan.startingARR * (plan.targets.churn.monthlyChurnRate || 0) * 12;
  const grossTarget = (plan.targetARR - plan.startingARR) + churnAnnual;

  const inboundAnnual = ((alloc?.inbound || 0) / 100) * grossTarget;
  const outboundAnnual = ((alloc?.outbound || 0) / 100) * grossTarget;
  const expansionAnnual = ((alloc?.expansion || 0) / 100) * grossTarget;
  const newProductAnnual = ((alloc?.newProduct || 0) / 100) * grossTarget;

  const hasAllocations = (inboundAnnual + outboundAnnual + expansionAnnual + newProductAnnual) > 0;

  const targets = plan.targets;

  const targetModel = useMemo(() => {
    if (!hasAllocations) return null;
    return runTopDownModel({
      inboundAnnual,
      outboundAnnual,
      expansionAnnual,
      newProductAnnual,
      churnAnnual,
      rates: {
        inboundWinRate: targets.newBusiness.inbound.winRate,
        inboundACV: targets.newBusiness.inbound.acv,
        inboundSalesCycle: targets.newBusiness.inbound.salesCycleMonths,
        inboundHisToPipelineRate: targets.newBusiness.inbound.hisToPipelineRate,
        outboundWinRate: targets.newBusiness.outbound.winRate,
        outboundACV: targets.newBusiness.outbound.acv,
        outboundSalesCycle: targets.newBusiness.outbound.salesCycleMonths,
        expansionWinRate: targets.expansion.winRate,
        expansionACV: targets.expansion.acv,
        expansionSalesCycle: targets.expansion.salesCycleMonths,
        newProductWinRate: targets.newProduct.inbound.winRate,
        newProductACV: targets.newProduct.inbound.acv,
        newProductSalesCycle: targets.newProduct.inbound.salesCycleMonths,
      },
      startingARR: plan.startingARR,
    });
  }, [
    hasAllocations, inboundAnnual, outboundAnnual, expansionAnnual, newProductAnnual,
    churnAnnual, targets, plan.startingARR,
  ]);

  // ── Status quo model (same as HistoricalBenchmarks.tsx) ─────
  const historicalQuarters = plan.historicalQuarters ?? [];

  const avgs = useMemo(
    () => calcHistoricalAverages(historicalQuarters),
    [historicalQuarters],
  );

  const actuals = useMemo(
    () => (plan.detailedActuals || []).map(toActualMonth),
    [plan.detailedActuals],
  );

  const statusQuoModel = useMemo(
    () => runStatusQuoModel({
      ...avgs,
      monthlyChurnRate: avgs.monthlyChurnRate || plan.targets.churn.monthlyChurnRate,
      startingARR: plan.startingARR,
      actuals,
      currentMonth: cm,
      channelConfig: cc,
    }),
    [avgs, plan.startingARR, actuals, cm, cc, plan.targets.churn.monthlyChurnRate],
  );

  // ── With-bets model — SQ with per-month bet ramp applied inside the model ──
  const withBetsModel = useMemo(
    () => runStatusQuoModel({
      ...avgs,
      monthlyChurnRate: avgs.monthlyChurnRate || plan.targets.churn.monthlyChurnRate,
      startingARR: plan.startingARR,
      actuals,
      currentMonth: cm,
      channelConfig: cc,
      bets: plan.strategicBets,
    }),
    [avgs, plan.strategicBets, cm, plan.startingARR, actuals, cc, plan.targets.churn.monthlyChurnRate],
  );

  // ── Gap closed % ──────────────────────────────────────────
  const sqEndARR = statusQuoModel.endingARR;
  const betsEndARR = withBetsModel.endingARR;
  const targetEndARR = targetModel?.endingARR ?? plan.targetARR;

  const gapClosed = sqEndARR === targetEndARR
    ? 100
    : Math.min(100, Math.max(0,
        (betsEndARR - sqEndARR) / (targetEndARR - sqEndARR) * 100,
      ));

  // ── Channel mix from status quo ──
  const totalRevenue = useMemo(() => {
    const m = statusQuoModel.monthly;
    return m.reduce((s, r) =>
      s + r.inboundClosedWon + r.outboundClosedWon +
      r.newProductClosedWon +
      r.expansionRevenue + Math.abs(r.churnRevenue), 0);
  }, [statusQuoModel]);

  const enabledBets = plan.strategicBets.filter((b) => b.enabled);

  // ── Target allocation context ──
  const newARR = plan.targetARR - plan.startingARR;
  const showAllocContext = (plan.targetAllocationMode === 'manual' || plan.targetAllocationMode === 'historical') && newARR > 0;

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
                Inbound {formatCurrencyFull(Math.round(grossTarget * alloc.inbound / 100))} ({alloc.inbound.toFixed(0)}%)
              </span>
            )}
            {alloc.outbound > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-blue-800">
                Outbound {formatCurrencyFull(Math.round(grossTarget * alloc.outbound / 100))} ({alloc.outbound.toFixed(0)}%)
              </span>
            )}
            {alloc.expansion > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-purple-800">
                Expansion {formatCurrencyFull(Math.round(grossTarget * alloc.expansion / 100))} ({alloc.expansion.toFixed(0)}%)
              </span>
            )}
            {alloc.churn > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-red-800">
                Churn Budget {formatCurrencyFull(Math.round(grossTarget * alloc.churn / 100))} ({alloc.churn.toFixed(0)}%)
              </span>
            )}
            {alloc.newProduct > 0 && (
              <span className="bg-white border border-blue-200 rounded px-2 py-1 text-green-800">
                New Product {formatCurrencyFull(Math.round(grossTarget * alloc.newProduct / 100))} ({alloc.newProduct.toFixed(0)}%)
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
        channelMix={{
          inbound: 0, outbound: 0, newProductInbound: 0, expansion: 0, churn: 0,
        }}
        totalRevenue={totalRevenue}
        onAdd={(bet) => dispatch({ type: 'ADD_BET', payload: bet })}
      />

      {/* Comparison */}
      {plan.strategicBets.length > 0 && (
        <BetComparisonTable
          statusQuoQuarterly={statusQuoModel.quarterly}
          withBetsQuarterly={withBetsModel.quarterly}
          targetQuarterly={targetModel?.quarterly ?? null}
          statusQuoMonthly={statusQuoModel.monthly}
          withBetsMonthly={withBetsModel.monthly}
          targetMonthly={targetModel?.monthly ?? null}
          targetARR={plan.targetARR}
          startingARR={plan.startingARR}
          bets={plan.strategicBets}
          gapClosedPct={gapClosed}
        />
      )}
    </div>
  );
}
