'use client';

import React, { useMemo } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, runModelWithActuals, capModelAtTarget, applyChannelConfig } from '@/lib/engine';
import { formatCurrency } from '@/lib/format';
import RevenueTable from '@/components/shared/RevenueTable';
import type { RampConfig } from '@/lib/types';

const DEFAULT_RAMP: RampConfig = { rampMonths: 1, startMonth: 1 };

export default function TopDownPlan() {
  const { plan } = useGTMPlan();
  const cc = plan.channelConfig;
  const isInYear = plan.planningMode === 'in-year';
  const hasActuals = (plan.detailedActuals?.length ?? 0) > 0;

  const effectiveTargets = useMemo(
    () => applyChannelConfig(plan.targets, cc, 'targets'),
    [plan.targets, cc],
  );

  // Always compute the pure plan projection (used for variance comparison)
  const planModel = useMemo(
    () => runModel(effectiveTargets, plan.seasonality, DEFAULT_RAMP, plan.startingARR, plan.existingPipeline),
    [effectiveTargets, plan.seasonality, plan.startingARR, plan.existingPipeline],
  );

  // When in-year with actuals, compute reforecasted model
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

  // Cap projections at target ARR
  const model = useMemo(
    () => capModelAtTarget(uncappedModel, plan.targetARR, plan.startingARR),
    [uncappedModel, plan.targetARR, plan.startingARR],
  );

  const projectedEnd = Math.min(model.endingARR, plan.targetARR);
  const gap = plan.targetARR - projectedEnd;
  const planAchieved = gap <= 0;

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
