'use client';

import React from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import MetricInput from '@/components/shared/MetricInput';
import FunnelInputs from '@/components/shared/FunnelInputs';
import SeasonalityEditor from '@/components/shared/SeasonalityEditor';
import type { ChannelConfig, Month, MonthlyActual } from '@/lib/types';

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

  // Actuals helpers
  const actuals = plan.actuals;
  const completedMonths = Array.from(
    { length: Math.max(0, actuals.currentMonth - 1) },
    (_, i) => (i + 1) as Month,
  );

  function getActual(month: Month): MonthlyActual {
    return actuals.monthlyActuals.find((a) => a.month === month) ?? { month, arr: 0, newARR: 0, churn: 0 };
  }

  function updateActual(month: Month, field: keyof Omit<MonthlyActual, 'month'>, value: number) {
    const existing = [...actuals.monthlyActuals];
    const idx = existing.findIndex((a) => a.month === month);
    const current = getActual(month);
    const updated = { ...current, [field]: value };
    if (idx >= 0) {
      existing[idx] = updated;
    } else {
      existing.push(updated);
    }
    dispatch({ type: 'SET_ACTUALS', payload: { ...actuals, monthlyActuals: existing } });
  }

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

      {/* Section 2: Existing Pipeline */}
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

      {/* Section 3: Core Business — New Logos funnel */}
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

      {/* Section 4: Expansion & Churn */}
      {(cc.hasExpansion || cc.hasChurn) && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Expansion & Churn</h3>
          <div className="grid grid-cols-2 gap-4">
            {cc.hasExpansion && (
              <MetricInput
                label="Monthly Expansion Rate"
                value={plan.targets.expansion.expansionRate}
                onChange={(v) =>
                  dispatch({ type: 'SET_TARGETS', payload: { ...plan.targets, expansion: { expansionRate: v } } })
                }
                type="percent"
                hint="% of existing ARR that expands each month"
              />
            )}
            {cc.hasChurn && (
              <MetricInput
                label="Monthly Churn Rate"
                value={plan.targets.churn.monthlyChurnRate}
                onChange={(v) =>
                  dispatch({ type: 'SET_TARGETS', payload: { ...plan.targets, churn: { monthlyChurnRate: v } } })
                }
                type="percent"
                hint="% of ARR lost each month"
              />
            )}
          </div>
        </div>
      )}

      {/* Section 5: New Product Business funnel */}
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

      {/* Section 6: Historical Channel Benchmarks */}
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

      {/* Section 7: Seasonality */}
      <SeasonalityEditor
        seasonality={plan.seasonality}
        onChange={(s) => dispatch({ type: 'SET_SEASONALITY', payload: s })}
      />

      {/* Section 8: Actuals */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Actuals</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan Start Date</label>
            <input
              type="date"
              value={actuals.planStartDate}
              onChange={(e) =>
                dispatch({ type: 'SET_ACTUALS', payload: { ...actuals, planStartDate: e.target.value } })
              }
              className="w-full rounded-md border border-gray-300 bg-white py-1.5 px-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <MetricInput
            label="Current Month (reforecasting as of)"
            value={actuals.currentMonth}
            onChange={(v) =>
              dispatch({ type: 'SET_ACTUALS', payload: { ...actuals, currentMonth: Math.max(1, Math.min(12, v)) as Month } })
            }
            type="number"
            min={1}
            max={12}
            hint="e.g. 3 = reforecasting as of March"
          />
        </div>

        {completedMonths.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Monthly Actuals (Completed Months)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase">ARR ($)</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase">New ARR ($)</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase">Churn ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {completedMonths.map((m) => {
                    const a = getActual(m);
                    return (
                      <tr key={m} className="border-b border-gray-100">
                        <td className="py-2 px-2 font-medium text-gray-700">{MONTH_LABELS[m - 1]}</td>
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            value={a.arr}
                            onChange={(e) => updateActual(m, 'arr', parseFloat(e.target.value) || 0)}
                            step={1000}
                            className="w-full text-right rounded-md border border-gray-300 bg-white py-1 px-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            value={a.newARR}
                            onChange={(e) => updateActual(m, 'newARR', parseFloat(e.target.value) || 0)}
                            step={1000}
                            className="w-full text-right rounded-md border border-gray-300 bg-white py-1 px-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            value={a.churn}
                            onChange={(e) => updateActual(m, 'churn', parseFloat(e.target.value) || 0)}
                            step={1000}
                            className="w-full text-right rounded-md border border-gray-300 bg-white py-1 px-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {completedMonths.length === 0 && (
          <p className="text-sm text-gray-400 italic mt-2">
            Set the current month above 1 to enter actuals for completed months.
          </p>
        )}
      </div>
    </div>
  );
}
