'use client';

import React, { useMemo } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, applyChannelConfig } from '@/lib/engine';
import { formatCurrency } from '@/lib/format';
import MetricInput from '@/components/shared/MetricInput';
import FunnelInputs from '@/components/shared/FunnelInputs';
import RevenueTable from '@/components/shared/RevenueTable';
import SeasonalityEditor from '@/components/shared/SeasonalityEditor';
import type { Month, ChannelConfig } from '@/lib/types';

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

export default function TopDownPlan() {
  const { plan, dispatch } = useGTMPlan();
  const cc = plan.channelConfig;

  const effectiveTargets = useMemo(
    () => applyChannelConfig(plan.targets, cc, 'targets'),
    [plan.targets, cc],
  );

  const model = useMemo(
    () => runModel(effectiveTargets, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline),
    [effectiveTargets, plan.seasonality, plan.ramp, plan.startingARR, plan.existingPipeline],
  );

  const projectedEnd = model.endingARR;
  const gap = plan.targetARR - projectedEnd;

  const updateChannel = (key: keyof ChannelConfig, value: boolean) => {
    dispatch({ type: 'SET_CHANNEL_CONFIG', payload: { ...cc, [key]: value } });
  };

  return (
    <div className="space-y-6">
      {/* Top-level summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Starting ARR" value={formatCurrency(plan.startingARR)} color="gray" />
        <SummaryCard label="Target ARR" value={formatCurrency(plan.targetARR)} color="blue" />
        <SummaryCard label="Projected ARR" value={formatCurrency(projectedEnd)} color="green" />
        <SummaryCard
          label="Gap to Target"
          value={formatCurrency(Math.abs(gap))}
          color={gap > 0 ? 'red' : 'green'}
          suffix={gap > 0 ? 'short' : 'above'}
        />
      </div>

      {/* Plan meta inputs */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Plan Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <MetricInput
            label="Ramp Months"
            value={plan.ramp.rampMonths}
            onChange={(v) =>
              dispatch({ type: 'SET_RAMP', payload: { ...plan.ramp, rampMonths: Math.max(1, v) } })
            }
            type="number"
            min={1}
            max={12}
            hint="Months to reach full capacity"
          />
          <MetricInput
            label="Ramp Start Month"
            value={plan.ramp.startMonth}
            onChange={(v) =>
              dispatch({ type: 'SET_RAMP', payload: { ...plan.ramp, startMonth: Math.max(1, Math.min(12, v)) as Month } })
            }
            type="number"
            min={1}
            max={12}
          />
        </div>
      </div>

      {/* Channel Configuration */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Channel Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Target Channels</div>
            <div className="space-y-2">
              <ChannelToggle label="Inbound" checked={cc.hasInbound} onChange={(v) => updateChannel('hasInbound', v)} />
              <ChannelToggle label="Outbound" checked={cc.hasOutbound} onChange={(v) => updateChannel('hasOutbound', v)} />
              <ChannelToggle label="New Product" checked={cc.hasNewProduct} onChange={(v) => updateChannel('hasNewProduct', v)} />
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historical Channels</div>
            <div className="space-y-2">
              <ChannelToggle label="Inbound History" checked={cc.hasInboundHistory} onChange={(v) => updateChannel('hasInboundHistory', v)} />
              <ChannelToggle label="Outbound History" checked={cc.hasOutboundHistory} onChange={(v) => updateChannel('hasOutboundHistory', v)} />
              <ChannelToggle label="New Product History" checked={cc.hasNewProductHistory} onChange={(v) => updateChannel('hasNewProductHistory', v)} />
            </div>
          </div>
        </div>
      </div>

      {/* Existing pipeline */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Existing Pipeline (In-Flight at Year Start)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {cc.hasInbound && (
            <MetricInput
              label="Inbound Core ($)"
              value={plan.existingPipeline.inboundCore}
              onChange={(v) => dispatch({ type: 'SET_EXISTING_PIPELINE', payload: { ...plan.existingPipeline, inboundCore: v } })}
              type="currency"
            />
          )}
          {cc.hasOutbound && (
            <MetricInput
              label="Outbound Core ($)"
              value={plan.existingPipeline.outboundCore}
              onChange={(v) => dispatch({ type: 'SET_EXISTING_PIPELINE', payload: { ...plan.existingPipeline, outboundCore: v } })}
              type="currency"
            />
          )}
          {cc.hasNewProduct && (
            <>
              <MetricInput
                label="Inbound New Product ($)"
                value={plan.existingPipeline.inboundNewProduct}
                onChange={(v) => dispatch({ type: 'SET_EXISTING_PIPELINE', payload: { ...plan.existingPipeline, inboundNewProduct: v } })}
                type="currency"
              />
              <MetricInput
                label="Outbound New Product ($)"
                value={plan.existingPipeline.outboundNewProduct}
                onChange={(v) => dispatch({ type: 'SET_EXISTING_PIPELINE', payload: { ...plan.existingPipeline, outboundNewProduct: v } })}
                type="currency"
              />
            </>
          )}
          <MetricInput
            label="Expected Close Month"
            value={plan.existingPipeline.expectedCloseMonth}
            onChange={(v) => dispatch({ type: 'SET_EXISTING_PIPELINE', payload: { ...plan.existingPipeline, expectedCloseMonth: Math.max(1, Math.min(12, v)) as Month } })}
            type="number"
            min={1}
            max={12}
          />
          <MetricInput
            label="Win Rate"
            value={plan.existingPipeline.winRate}
            onChange={(v) => dispatch({ type: 'SET_EXISTING_PIPELINE', payload: { ...plan.existingPipeline, winRate: v } })}
            type="percent"
          />
        </div>
      </div>

      {/* Core Business funnel — show inbound/outbound based on config */}
      {(cc.hasInbound || cc.hasOutbound) && (
        <FunnelInputs
          title="Core Business — New Logos"
          inbound={plan.targets.newBusiness.inbound}
          outbound={plan.targets.newBusiness.outbound}
          onInboundChange={(ib) =>
            dispatch({ type: 'SET_TARGETS', payload: { ...plan.targets, newBusiness: { ...plan.targets.newBusiness, inbound: ib } } })
          }
          onOutboundChange={(ob) =>
            dispatch({ type: 'SET_TARGETS', payload: { ...plan.targets, newBusiness: { ...plan.targets.newBusiness, outbound: ob } } })
          }
          hideInbound={!cc.hasInbound}
          hideOutbound={!cc.hasOutbound}
        />
      )}

      {/* Expansion & Churn */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Expansion & Churn</h3>
        <div className="grid grid-cols-2 gap-4">
          <MetricInput
            label="Monthly Expansion Rate"
            value={plan.targets.expansion.expansionRate}
            onChange={(v) =>
              dispatch({ type: 'SET_TARGETS', payload: { ...plan.targets, expansion: { expansionRate: v } } })
            }
            type="percent"
            hint="% of existing ARR that expands each month"
          />
          <MetricInput
            label="Monthly Churn Rate"
            value={plan.targets.churn.monthlyChurnRate}
            onChange={(v) =>
              dispatch({ type: 'SET_TARGETS', payload: { ...plan.targets, churn: { monthlyChurnRate: v } } })
            }
            type="percent"
            hint="% of ARR lost each month"
          />
        </div>
      </div>

      {/* New Product Business funnel */}
      {cc.hasNewProduct && (
        <FunnelInputs
          title="New Product Business — Additional Bet"
          inbound={plan.targets.newProduct.inbound}
          outbound={plan.targets.newProduct.outbound}
          onInboundChange={(ib) =>
            dispatch({ type: 'SET_TARGETS', payload: { ...plan.targets, newProduct: { ...plan.targets.newProduct, inbound: ib } } })
          }
          onOutboundChange={(ob) =>
            dispatch({ type: 'SET_TARGETS', payload: { ...plan.targets, newProduct: { ...plan.targets.newProduct, outbound: ob } } })
          }
        />
      )}

      {/* Seasonality */}
      <SeasonalityEditor
        seasonality={plan.seasonality}
        onChange={(s) => dispatch({ type: 'SET_SEASONALITY', payload: s })}
      />

      {/* Revenue output table */}
      <RevenueTable
        monthly={model.monthly}
        quarterly={model.quarterly}
        startingARR={plan.startingARR}
        label="Target Revenue Projections"
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
