'use client';

import React, { useMemo } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { calcHistoricalAverages, runStatusQuoModel } from '@/lib/engine';
import type { EngineMonthlyResult, EngineQuarterlyResult, ActualMonth } from '@/lib/engine';
import { formatCurrency } from '@/lib/format';
import RevenueTable from '@/components/shared/RevenueTable';
import { isQuarterFilled } from '@/components/shared/HistoricalDataSheet';
import type { MonthlyResult, QuarterlyResult, MonthlyActuals } from '@/lib/types';

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

/** Map MonthlyActuals → ActualMonth for runStatusQuoModel */
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

export default function HistoricalBenchmarks() {
  const { plan } = useGTMPlan();
  const cc = plan.channelConfig;
  const historicalQuarters = plan.historicalQuarters ?? [];
  const filledCount = useMemo(() => historicalQuarters.filter(isQuarterFilled).length, [historicalQuarters]);

  // Step 1: Calculate averages from historical quarters
  const avgs = useMemo(
    () => calcHistoricalAverages(historicalQuarters),
    [historicalQuarters],
  );

  // Step 2: Run status quo model
  const model = useMemo(
    () => runStatusQuoModel({
      avgMonthlyInboundPipeline: avgs.avgMonthlyInboundPipeline,
      avgInboundWinRate: avgs.avgInboundWinRate,
      avgInboundACV: avgs.avgInboundACV,
      avgInboundSalesCycle: avgs.avgInboundSalesCycle,
      avgMonthlyHIS: avgs.avgMonthlyHIS,
      avgInboundHisToPipelineRate: avgs.avgInboundHisToPipelineRate,
      avgMonthlyOutboundPipeline: avgs.avgMonthlyOutboundPipeline,
      avgOutboundWinRate: avgs.avgOutboundWinRate,
      avgOutboundACV: avgs.avgOutboundACV,
      avgOutboundSalesCycle: avgs.avgOutboundSalesCycle,
      avgExpansionPipeline: avgs.avgExpansionPipeline,
      avgExpansionWinRate: avgs.avgExpansionWinRate,
      avgExpansionACV: avgs.avgExpansionACV,
      avgExpansionSalesCycle: avgs.avgExpansionSalesCycle,
      avgNewProductPipeline: avgs.avgNewProductPipeline,
      avgNewProductWinRate: avgs.avgNewProductWinRate,
      avgNewProductACV: avgs.avgNewProductACV,
      avgNewProductSalesCycle: avgs.avgNewProductSalesCycle,
      monthlyChurnRate: avgs.monthlyChurnRate || plan.targets.churn.monthlyChurnRate,
      startingARR: plan.startingARR,
      actuals: (plan.detailedActuals || []).map(toActualMonth),
      currentMonth: plan.currentMonth,
      channelConfig: cc,
    }),
    [avgs, plan.startingARR, plan.detailedActuals, plan.currentMonth, cc, plan.targets.churn.monthlyChurnRate],
  );

  // Map engine results to types.ts shapes for RevenueTable
  const mappedMonthly: MonthlyResult[] = useMemo(
    () => model.monthly.map(toMonthlyResult),
    [model],
  );
  const mappedQuarterly: QuarterlyResult[] = useMemo(
    () => model.quarterly.map(toQuarterlyResult),
    [model],
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Starting ARR" value={formatCurrency(plan.startingARR)} color="gray" />
        <SummaryCard
          label="Projected End-of-Year ARR"
          value={formatCurrency(model.endingARR)}
          color="green"
        />
      </div>

      {/* Status quo banner */}
      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
        <p className="text-sm font-medium text-blue-800">
          At current performance levels, you will end the year at {formatCurrency(model.endingARR)}
        </p>
      </div>

      {/* Warning if < 4 quarters */}
      {filledCount < 4 && (
        <div className="border border-amber-300 rounded-lg p-3 bg-amber-50">
          <p className="text-sm text-amber-800 font-medium">
            Add at least 4 quarters of historical data in Setup for accurate status quo projections
            {filledCount > 0 && ` (${filledCount}/4 quarters filled)`}
          </p>
        </div>
      )}

      {/* Revenue output table */}
      <RevenueTable
        monthly={mappedMonthly}
        quarterly={mappedQuarterly}
        startingARR={plan.startingARR}
        label="Status Quo Projections (If Nothing Changes)"
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
