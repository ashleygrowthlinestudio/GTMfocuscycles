'use client';

import React from 'react';
import type { BetMetric, BetCategory, BetChannel, StrategicBet, RevenueBreakdown, ChannelMix } from '@/lib/types';
import { formatPercent } from '@/lib/format';

interface BetOption {
  metric: BetMetric;
  category: BetCategory;
  channel?: BetChannel;
  label: string;
  description: string;
}

const METRIC_BET_OPTIONS: BetOption[] = [
  { metric: 'winRate', category: 'newBusiness', channel: 'inbound', label: 'Inbound Win Rate', description: 'Improve core inbound win rate' },
  { metric: 'winRate', category: 'newBusiness', channel: 'outbound', label: 'Outbound Win Rate', description: 'Improve core outbound win rate' },
  { metric: 'salesCycleMonths', category: 'newBusiness', channel: 'inbound', label: 'Inbound Sales Cycle', description: 'Reduce inbound sales cycle length' },
  { metric: 'salesCycleMonths', category: 'newBusiness', channel: 'outbound', label: 'Outbound Sales Cycle', description: 'Reduce outbound sales cycle length' },
  { metric: 'hisToPipelineRate', category: 'newBusiness', channel: 'inbound', label: 'HIS → Pipeline Rate', description: 'Improve conversion from HIS to pipeline' },
  { metric: 'hisMonthly', category: 'newBusiness', channel: 'inbound', label: 'Inbound Volume (HIS/mo)', description: 'Increase monthly high-intent submissions' },
  { metric: 'pipelineMonthly', category: 'newBusiness', channel: 'outbound', label: 'Outbound Pipeline/mo', description: 'Increase monthly outbound pipeline' },
  { metric: 'acv', category: 'newBusiness', channel: 'inbound', label: 'Inbound ACV', description: 'Increase average inbound deal size' },
  { metric: 'acv', category: 'newBusiness', channel: 'outbound', label: 'Outbound ACV', description: 'Increase average outbound deal size' },
  { metric: 'pipelineMonthly', category: 'expansion', label: 'Expansion Pipeline', description: 'Increase monthly expansion pipeline created' },
  { metric: 'monthlyChurnRate', category: 'churn', label: 'Churn Reduction', description: 'Reduce monthly churn rate' },
  { metric: 'winRate', category: 'newProduct', channel: 'inbound', label: 'New Product Win Rate', description: 'Improve new product win rate' },
];

const MIX_BET_OPTIONS: BetOption[] = [
  { metric: 'inboundMixPct', category: 'revenueMix', label: 'Inbound Mix %', description: 'Increase inbound share of total new ARR' },
  { metric: 'outboundMixPct', category: 'revenueMix', label: 'Outbound Mix %', description: 'Increase outbound share of total new ARR' },
  { metric: 'newProductInboundMixPct', category: 'revenueMix', label: 'New Product Inbound Mix %', description: 'Increase new product inbound share of total new ARR' },
  { metric: 'expansionMixPct', category: 'revenueMix', label: 'Expansion Mix %', description: 'Increase expansion share of total ARR' },
  { metric: 'churnMixPct', category: 'revenueMix', label: 'Churn Mix %', description: 'Reduce churn as % of total ARR' },
];

const MIX_METRIC_TO_KEY: Record<string, keyof ChannelMix> = {
  inboundMixPct: 'inbound',
  outboundMixPct: 'outbound',
  newProductInboundMixPct: 'newProductInbound',
  expansionMixPct: 'expansion',
  churnMixPct: 'churn',
};

function getCurrentValue(historical: RevenueBreakdown, option: BetOption): number {
  if (option.category === 'expansion') return historical.expansion.pipelineMonthly;
  if (option.category === 'churn') return historical.churn.monthlyChurnRate;

  if (option.category === 'newProduct') {
    return (historical.newProduct.inbound as unknown as Record<string, number>)[option.metric] ?? 0;
  }
  const cat = historical.newBusiness;
  if (option.channel === 'inbound') {
    return (cat.inbound as unknown as Record<string, number>)[option.metric] ?? 0;
  }
  return (cat.outbound as unknown as Record<string, number>)[option.metric] ?? 0;
}

interface BetSelectorProps {
  existingBets: StrategicBet[];
  historical: RevenueBreakdown;
  channelMix: ChannelMix;
  totalRevenue: number;
  onAdd: (bet: StrategicBet) => void;
}

export default function BetSelector({ existingBets, historical, channelMix, totalRevenue, onAdd }: BetSelectorProps) {
  const existingKeys = new Set(existingBets.map((b) => `${b.metric}-${b.category}-${b.channel ?? ''}`));

  const availableMetric = METRIC_BET_OPTIONS.filter(
    (o) => !existingKeys.has(`${o.metric}-${o.category}-${o.channel ?? ''}`),
  );

  const availableMix = MIX_BET_OPTIONS.filter(
    (o) => !existingKeys.has(`${o.metric}-${o.category}-${o.channel ?? ''}`),
  );

  function handleAddMetric(option: BetOption) {
    const currentValue = getCurrentValue(historical, option);
    const bet: StrategicBet = {
      id: crypto.randomUUID(),
      name: option.label,
      metric: option.metric,
      category: option.category,
      channel: option.channel,
      currentValue,
      improvedValue: currentValue,
      enabled: true,
      startMonth: 1 as import('@/lib/types').Month,
      rampMonths: 3,
    };
    onAdd(bet);
  }

  function handleAddMix(option: BetOption) {
    const key = MIX_METRIC_TO_KEY[option.metric];
    const currentValue = key ? channelMix[key] : 0;
    const bet: StrategicBet = {
      id: crypto.randomUUID(),
      name: option.label,
      metric: option.metric,
      category: option.category,
      channel: option.channel,
      currentValue,
      improvedValue: currentValue,
      enabled: true,
      startMonth: 1 as import('@/lib/types').Month,
      rampMonths: 3,
    };
    onAdd(bet);
  }

  // Calculate running total of mix bets (existing + defaults for un-added)
  const mixBetTotal = MIX_BET_OPTIONS.reduce((sum, opt) => {
    const key = MIX_METRIC_TO_KEY[opt.metric];
    const existing = existingBets.find((b) => b.metric === opt.metric && b.category === 'revenueMix');
    if (existing) {
      return sum + existing.improvedValue;
    }
    return sum + (key ? channelMix[key] : 0);
  }, 0);

  const mixTotalPct = Math.round(mixBetTotal * 1000) / 10;
  const mixIsBalanced = Math.abs(mixTotalPct - 100) < 1;

  const noOptions = availableMetric.length === 0 && availableMix.length === 0;

  if (noOptions) {
    return <p className="text-xs text-gray-400">All available metrics have been added as bets.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Revenue Mix Bets */}
      {availableMix.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Revenue Mix Bets</h3>
              <p className="text-xs text-gray-500 mt-0.5">Shift what % of total revenue comes from each channel.</p>
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded ${
              mixIsBalanced
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              Mix total: {mixTotalPct.toFixed(1)}%
              {!mixIsBalanced && ' ⚠'}
            </div>
          </div>

          {!mixIsBalanced && existingBets.some((b) => b.category === 'revenueMix') && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              Mix bets should sum to 100% across all channels. Current total: {mixTotalPct.toFixed(1)}%.
              Adjust your mix targets or add remaining channels.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {availableMix.map((option) => {
              const key = MIX_METRIC_TO_KEY[option.metric];
              const currentPct = key ? channelMix[key] * 100 : 0;
              return (
                <button
                  key={option.metric}
                  onClick={() => handleAddMix(option)}
                  className="text-left p-2 rounded-md border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors"
                >
                  <div className="text-xs font-medium text-gray-800">{option.label}</div>
                  <div className="text-xs text-gray-400">{option.description}</div>
                  <div className="text-xs text-purple-600 mt-0.5">Currently: {currentPct.toFixed(1)}%</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Metric Bets */}
      {availableMetric.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Add a Strategic Bet</h3>
          <p className="text-xs text-gray-500 mb-3">Select a metric to improve. Focus on 1-3 bets for maximum impact.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {availableMetric.map((option) => (
              <button
                key={`${option.metric}-${option.category}-${option.channel}`}
                onClick={() => handleAddMetric(option)}
                className="text-left p-2 rounded-md border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="text-xs font-medium text-gray-800">{option.label}</div>
                <div className="text-xs text-gray-400">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
