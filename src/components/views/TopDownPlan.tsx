'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runTopDownModel } from '@/lib/engine';
import type { EngineMonthlyResult, EngineQuarterlyResult } from '@/lib/engine';
import { formatCurrency } from '@/lib/format';
import RevenueTable from '@/components/shared/RevenueTable';
import type { MonthlyResult, QuarterlyResult, Month, Quarter } from '@/lib/types';

/** Map EngineMonthlyResult → MonthlyResult (types.ts shape) for RevenueTable */
function toMonthlyResult(e: EngineMonthlyResult): MonthlyResult {
  return {
    month: e.month,
    inboundPipelineCreated: e.inboundPipelineCreated,
    outboundPipelineCreated: e.outboundPipelineCreated,
    newProductInboundPipelineCreated: e.newProductPipelineCreated,
    hisRequired: e.inboundHIS,
    newProductHisRequired: 0,
    inboundClosedWon: e.inboundClosedWon,
    outboundClosedWon: e.outboundClosedWon,
    newProductInboundClosedWon: e.newProductClosedWon,
    expansionRevenue: e.expansionRevenue,
    churnRevenue: e.churnRevenue,
    totalNewARR: e.totalNewARR,
    cumulativeARR: e.cumulativeARR,
    inboundDeals: e.inboundDeals,
    outboundDeals: e.outboundDeals,
    newProductInboundDeals: e.newProductDeals,
  };
}

function toQuarterlyResult(eq: EngineQuarterlyResult): QuarterlyResult {
  const ms = eq.months.map(toMonthlyResult) as [MonthlyResult, MonthlyResult, MonthlyResult];
  return {
    quarter: eq.quarter,
    months: ms,
    inboundPipelineCreated: eq.inboundPipelineCreated,
    outboundPipelineCreated: eq.outboundPipelineCreated,
    newProductInboundPipelineCreated: eq.newProductPipelineCreated,
    hisRequired: eq.inboundHIS,
    newProductHisRequired: 0,
    inboundClosedWon: eq.inboundClosedWon,
    outboundClosedWon: eq.outboundClosedWon,
    newProductInboundClosedWon: eq.newProductClosedWon,
    expansionRevenue: eq.expansionRevenue,
    churnRevenue: eq.churnRevenue,
    totalNewARR: eq.totalNewARR,
    endingARR: eq.endingARR,
  };
}

export default function TopDownPlan() {
  const { plan } = useGTMPlan();
  const cc = plan.channelConfig;

  // Compute channel dollar targets from allocation % × grossTarget
  const alloc = plan.targetAllocations;
  const churnAnnual = plan.startingARR * (plan.targets.churn.monthlyChurnRate || 0) * 12;
  const grossTarget = (plan.targetARR - plan.startingARR) + churnAnnual;

  const inboundAnnual = ((alloc?.inbound || 0) / 100) * grossTarget;
  const outboundAnnual = ((alloc?.outbound || 0) / 100) * grossTarget;
  const expansionAnnual = ((alloc?.expansion || 0) / 100) * grossTarget;
  const newProductAnnual = ((alloc?.newProduct || 0) / 100) * grossTarget;

  const hasAllocations = useMemo(
    () => (inboundAnnual + outboundAnnual + expansionAnnual + newProductAnnual) > 0,
    [inboundAnnual, outboundAnnual, expansionAnnual, newProductAnnual],
  );

  const targets = plan.targets;

  // Build rates from plan.targets
  const model = useMemo(() => {
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

  // Map engine results to types.ts shapes for RevenueTable
  const mappedMonthly: MonthlyResult[] | null = useMemo(
    () => model ? model.monthly.map(toMonthlyResult) : null,
    [model],
  );
  const mappedQuarterly: QuarterlyResult[] | null = useMemo(
    () => model ? model.quarterly.map(toQuarterlyResult) : null,
    [model],
  );

  // If no allocations set, show amber banner
  if (!model || !mappedMonthly || !mappedQuarterly) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <SummaryCard label="Starting ARR" value={formatCurrency(plan.startingARR)} color="gray" />
          <SummaryCard label="Target ARR" value={formatCurrency(plan.targetARR)} color="blue" />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-sm font-medium text-amber-800">Set your target allocation in Setup to see projections</p>
          <p className="text-xs text-amber-600 mt-1">Go to the Setup tab and configure your channel allocation percentages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top-level summary */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Starting ARR" value={formatCurrency(plan.startingARR)} color="gray" />
        <SummaryCard label="Target ARR" value={formatCurrency(plan.targetARR)} color="blue" />
      </div>

      {/* Revenue output table */}
      <RevenueTable
        monthly={mappedMonthly}
        quarterly={mappedQuarterly}
        startingARR={plan.startingARR}
        label="Target Revenue Projections"
        channelConfig={cc}
      />
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
