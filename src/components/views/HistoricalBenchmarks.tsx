'use client';

import React, { useMemo } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, applyChannelConfig } from '@/lib/engine';
import { formatCurrency } from '@/lib/format';
import MetricInput from '@/components/shared/MetricInput';
import FunnelInputs from '@/components/shared/FunnelInputs';
import RevenueTable from '@/components/shared/RevenueTable';

export default function HistoricalBenchmarks() {
  const { plan, dispatch } = useGTMPlan();

  // Historical uses flat seasonality and no ramp (current steady state)
  const flatSeasonality = useMemo(() => ({
    monthly: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, 1.0]),
    ) as Record<number, number>,
  }), []);

  const noRamp = useMemo(() => ({ rampMonths: 1, startMonth: 1 as const }), []);

  const effectiveHistorical = useMemo(
    () => applyChannelConfig(plan.historical, plan.channelConfig, 'historical'),
    [plan.historical, plan.channelConfig],
  );

  const model = useMemo(
    () => runModel(effectiveHistorical, flatSeasonality, noRamp, plan.startingARR, plan.existingPipeline),
    [effectiveHistorical, flatSeasonality, noRamp, plan.startingARR, plan.existingPipeline],
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-amber-800">Status Quo Projection</h2>
        <p className="text-xs text-amber-700 mt-1">
          If nothing changes and your team continues at current performance, you would end the year at{' '}
          <span className="font-bold">{formatCurrency(model.endingARR)}</span> ARR.
        </p>
      </div>

      {/* Core Business */}
      {(plan.channelConfig.hasInboundHistory || plan.channelConfig.hasOutboundHistory) && (
        <FunnelInputs
          title="Current Core Business Performance"
          inbound={plan.historical.newBusiness.inbound}
          outbound={plan.historical.newBusiness.outbound}
          onInboundChange={(ib) =>
            dispatch({
              type: 'SET_HISTORICAL',
              payload: { ...plan.historical, newBusiness: { ...plan.historical.newBusiness, inbound: ib } },
            })
          }
          onOutboundChange={(ob) =>
            dispatch({
              type: 'SET_HISTORICAL',
              payload: { ...plan.historical, newBusiness: { ...plan.historical.newBusiness, outbound: ob } },
            })
          }
          hideInbound={!plan.channelConfig.hasInboundHistory}
          hideOutbound={!plan.channelConfig.hasOutboundHistory}
        />
      )}

      {/* Expansion & Churn — respect channel toggles */}
      {(plan.channelConfig.hasExpansion || plan.channelConfig.hasChurn) && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Expansion & Churn</h3>
          <div className="grid grid-cols-2 gap-4">
            {plan.channelConfig.hasExpansion && (
              <MetricInput
                label="Monthly Expansion Rate"
                value={plan.historical.expansion.expansionRate}
                onChange={(v) =>
                  dispatch({
                    type: 'SET_HISTORICAL',
                    payload: { ...plan.historical, expansion: { expansionRate: v } },
                  })
                }
                type="percent"
                hint="Current monthly expansion as % of ARR"
              />
            )}
            {plan.channelConfig.hasChurn && (
              <MetricInput
                label="Monthly Churn Rate"
                value={plan.historical.churn.monthlyChurnRate}
                onChange={(v) =>
                  dispatch({
                    type: 'SET_HISTORICAL',
                    payload: { ...plan.historical, churn: { monthlyChurnRate: v } },
                  })
                }
                type="percent"
                hint="Current monthly churn as % of ARR"
              />
            )}
          </div>
        </div>
      )}

      {/* New Product (may be zero if not yet launched) */}
      {plan.channelConfig.hasNewProductHistory && (
        <FunnelInputs
          title="Current New Product Performance (if any)"
          inbound={plan.historical.newProduct.inbound}
          outbound={plan.historical.newProduct.outbound}
          onInboundChange={(ib) =>
            dispatch({
              type: 'SET_HISTORICAL',
              payload: { ...plan.historical, newProduct: { ...plan.historical.newProduct, inbound: ib } },
            })
          }
          onOutboundChange={(ob) =>
            dispatch({
              type: 'SET_HISTORICAL',
              payload: { ...plan.historical, newProduct: { ...plan.historical.newProduct, outbound: ob } },
            })
          }
        />
      )}

      {/* Historical projections table */}
      <RevenueTable
        monthly={model.monthly}
        quarterly={model.quarterly}
        startingARR={plan.startingARR}
        label="Status Quo Projections (If Nothing Changes)"
      />
    </div>
  );
}
