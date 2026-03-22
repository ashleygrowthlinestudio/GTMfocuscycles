'use client';

import React from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import MetricInput from '@/components/shared/MetricInput';
import FunnelInputs from '@/components/shared/FunnelInputs';
import type { ChannelConfig } from '@/lib/types';

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

export default function Setup() {
  const { plan, dispatch } = useGTMPlan();
  const cc = plan.channelConfig;

  const updateChannel = (key: keyof ChannelConfig, value: boolean) => {
    dispatch({ type: 'SET_CHANNEL_CONFIG', payload: { ...cc, [key]: value } });
  };

  // Unified toggle: sets both target and historical flags together
  const toggleInbound = (v: boolean) => {
    dispatch({
      type: 'SET_CHANNEL_CONFIG',
      payload: { ...cc, hasInbound: v, hasInboundHistory: v },
    });
  };
  const toggleOutbound = (v: boolean) => {
    dispatch({
      type: 'SET_CHANNEL_CONFIG',
      payload: { ...cc, hasOutbound: v, hasOutboundHistory: v },
    });
  };
  const toggleNewProduct = (v: boolean) => {
    dispatch({
      type: 'SET_CHANNEL_CONFIG',
      payload: { ...cc, hasNewProduct: v, hasNewProductHistory: v },
    });
  };

  return (
    <div className="space-y-6">
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

      {/* Section 2: Historical Channels */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Historical Channel Benchmarks</h3>

        {/* Inbound */}
        {cc.hasInbound && (
          <FunnelInputs
            title="Inbound — Historical Benchmarks"
            inbound={plan.historical.newBusiness.inbound}
            outbound={plan.historical.newBusiness.outbound}
            onInboundChange={(ib) =>
              dispatch({
                type: 'SET_HISTORICAL',
                payload: { ...plan.historical, newBusiness: { ...plan.historical.newBusiness, inbound: ib } },
              })
            }
            onOutboundChange={() => {}}
            hideOutbound
          />
        )}

        {/* Outbound */}
        {cc.hasOutbound && (
          <div className="mt-4">
            <FunnelInputs
              title="Outbound — Historical Benchmarks"
              inbound={plan.historical.newBusiness.inbound}
              outbound={plan.historical.newBusiness.outbound}
              onInboundChange={() => {}}
              onOutboundChange={(ob) =>
                dispatch({
                  type: 'SET_HISTORICAL',
                  payload: { ...plan.historical, newBusiness: { ...plan.historical.newBusiness, outbound: ob } },
                })
              }
              hideInbound
            />
          </div>
        )}

        {/* Expansion */}
        {cc.hasExpansion && (
          <div className="border border-gray-200 rounded-lg p-4 bg-white mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Expansion — Historical Benchmarks</h3>
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
              hint="% of existing ARR that expands each month"
            />
          </div>
        )}

        {/* Churn */}
        {cc.hasChurn && (
          <div className="border border-gray-200 rounded-lg p-4 bg-white mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Churn — Historical Benchmarks</h3>
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
              hint="% of ARR lost each month"
            />
          </div>
        )}

        {/* New Product */}
        {cc.hasNewProduct && (
          <div className="mt-4">
            <FunnelInputs
              title="New Product — Historical Benchmarks"
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
          </div>
        )}

        {/* Nothing active */}
        {!cc.hasInbound && !cc.hasOutbound && !cc.hasNewProduct && !cc.hasExpansion && !cc.hasChurn && (
          <p className="text-sm text-gray-400 italic">No channels are active. Toggle channels above to configure historical benchmarks.</p>
        )}
      </div>
    </div>
  );
}
