'use client';

import React, { useMemo } from 'react';

import { useGTMPlan } from '@/context/GTMPlanContext';

import { runModel, applyStrategicBets } from '@/lib/engine';

import BetSelector from '@/components/strategic/BetSelector';

import BetCard from '@/components/strategic/BetCard';

import BetComparisonTable from '@/components/strategic/BetComparisonTable';

export default function StrategicBets() {

  const { plan, dispatch } = useGTMPlan();

  // Target model

  const targetModel = useMemo(

    () => runModel(plan.targets, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline),

    [plan.targets, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline],

  );

  // Status quo model (flat seasonality, no ramp)

  const flatSeasonality = useMemo(() => ({

    monthly: Object.fromEntries(

      Array.from({ length: 12 }, (_, i) => [i + 1, 1.0]),

    ) as Record<number, number>,

  }), []);

  const noRamp = useMemo(() => ({ rampMonths: 1, startMonth: 1 as const }), []);

  const statusQuoModel = useMemo(

    () => runModel(plan.historical, flatSeasonality, noRamp, plan.startingARR, plan.existingPipeline),

    [plan.historical, flatSeasonality, noRamp, plan.startingARR, plan.existingPipeline],

  );

  // With bets model — apply bets to historical, then use target's seasonality/ramp

  const withBetsInputs = useMemo(

    () => applyStrategicBets(plan.historical, plan.strategicBets),

    [plan.historical, plan.strategicBets],

  );

  const withBetsModel = useMemo(

    () => runModel(withBetsInputs, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline),

    [withBetsInputs, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline],

  );

  const enabledBets = plan.strategicBets.filter((b) => b.enabled);

  return (

    <div className="space-y-6">

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

              />

            ))}

          </div>

        </div>

      )}

      {/* Add bets */}

      <BetSelector

        existingBets={plan.strategicBets}

        historical={plan.historical}

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

        />

      )}

    </div>

  );

}
