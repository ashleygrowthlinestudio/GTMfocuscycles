'use client';

import React from 'react';
import type { BetMetric, BetCategory, BetChannel, StrategicBet, RevenueBreakdown } from '@/lib/types';

interface BetOption {
  metric: BetMetric;
  category: BetCategory;
  channel?: BetChannel;
  label: string;
  description: string;
}

const BET_OPTIONS: BetOption[] = [
  { metric: 'winRate', category: 'newBusiness', channel: 'inbound', label: 'Inbound Win Rate', description: 'Improve core inbound win rate' },
  { metric: 'winRate', category: 'newBusiness', channel: 'outbound', label: 'Outbound Win Rate', description: 'Improve core outbound win rate' },
  { metric: 'salesCycleMonths', category: 'newBusiness', channel: 'inbound', label: 'Inbound Sales Cycle', description: 'Reduce inbound sales cycle length' },
  { metric: 'salesCycleMonths', category: 'newBusiness', channel: 'outbound', label: 'Outbound Sales Cycle', description: 'Reduce outbound sales cycle length' },
  { metric: 'hisToPipelineRate', category: 'newBusiness', channel: 'inbound', label: 'HIS → Pipeline Rate', description: 'Improve conversion from HIS to pipeline' },
  { metric: 'hisMonthly', category: 'newBusiness', channel: 'inbound', label: 'Inbound Volume (HIS/mo)', description: 'Increase monthly high-intent submissions' },
  { metric: 'pipelineMonthly', category: 'newBusiness', channel: 'outbound', label: 'Outbound Pipeline/mo', description: 'Increase monthly outbound pipeline' },
  { metric: 'acv', category: 'newBusiness', channel: 'inbound', label: 'Inbound ACV', description: 'Increase average inbound deal size' },
  { metric: 'acv', category: 'newBusiness', channel: 'outbound', label: 'Outbound ACV', description: 'Increase average outbound deal size' },
  { metric: 'expansionRate', category: 'expansion', label: 'Expansion Rate', description: 'Increase monthly net expansion rate' },
  { metric: 'monthlyChurnRate', category: 'churn', label: 'Churn Reduction', description: 'Reduce monthly churn rate' },
  { metric: 'winRate', category: 'newProduct', channel: 'inbound', label: 'New Product Win Rate', description: 'Improve new product win rate' },
  { metric: 'pipelineMonthly', category: 'newProduct', channel: 'outbound', label: 'New Product Pipeline', description: 'Increase new product outbound pipeline' },
];

function getCurrentValue(historical: RevenueBreakdown, option: BetOption): number {
  if (option.category === 'expansion') return historical.expansion.expansionRate;
  if (option.category === 'churn') return historical.churn.monthlyChurnRate;

  const cat = option.category === 'newBusiness' ? historical.newBusiness : historical.newProduct;
  if (option.channel === 'inbound') {
    return (cat.inbound as unknown as Record<string, number>)[option.metric] ?? 0;
  }
  return (cat.outbound as unknown as Record<string, number>)[option.metric] ?? 0;
}

interface BetSelectorProps {
  existingBets: StrategicBet[];
  historical: RevenueBreakdown;
  onAdd: (bet: StrategicBet) => void;
}

export default function BetSelector({ existingBets, historical, onAdd }: BetSelectorProps) {
  const existingKeys = new Set(existingBets.map((b) => `${b.metric}-${b.category}-${b.channel ?? ''}`));

  const available = BET_OPTIONS.filter(
    (o) => !existingKeys.has(`${o.metric}-${o.category}-${o.channel ?? ''}`),
  );

  function handleAdd(option: BetOption) {
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
    };
    onAdd(bet);
  }

  if (available.length === 0) {
    return <p className="text-xs text-gray-400">All available metrics have been added as bets.</p>;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Add a Strategic Bet</h3>
      <p className="text-xs text-gray-500 mb-3">Select a metric to improve. Focus on 1-3 bets for maximum impact.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {available.map((option) => (
          <button
            key={`${option.metric}-${option.category}-${option.channel}`}
            onClick={() => handleAdd(option)}
            className="text-left p-2 rounded-md border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <div className="text-xs font-medium text-gray-800">{option.label}</div>
            <div className="text-xs text-gray-400">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
