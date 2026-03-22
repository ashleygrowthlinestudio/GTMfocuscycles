'use client';

import React from 'react';
import type { StrategicBet } from '@/lib/types';
import { formatCurrencyFull, formatPercent } from '@/lib/format';

interface BetCardProps {
  bet: StrategicBet;
  onUpdate: (bet: StrategicBet) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  totalRevenue?: number; // total gross revenue for mix $ calculation
}

function isMixMetric(metric: string): boolean {
  return metric.endsWith('MixPct');
}

function isPercentMetric(metric: string): boolean {
  return ['winRate', 'hisToPipelineRate', 'expansionRate', 'monthlyChurnRate'].includes(metric);
}

function isCurrencyMetric(metric: string): boolean {
  return ['acv', 'pipelineMonthly'].includes(metric);
}

function formatValue(metric: string, value: number): string {
  if (isMixMetric(metric)) return `${(value * 100).toFixed(1)}%`;
  if (isPercentMetric(metric)) return formatPercent(value);
  if (isCurrencyMetric(metric)) return formatCurrencyFull(value);
  if (metric === 'salesCycleMonths') return `${value} mo`;
  return value.toFixed(0);
}

function getMixChannelLabel(metric: string): string {
  const map: Record<string, string> = {
    inboundMixPct: 'Inbound',
    outboundMixPct: 'Outbound',
    newProductInboundMixPct: 'NP Inbound',
    newProductOutboundMixPct: 'NP Outbound',
    expansionMixPct: 'Expansion',
    churnMixPct: 'Churn',
  };
  return map[metric] || metric;
}

export default function BetCard({ bet, onUpdate, onRemove, onToggle, totalRevenue }: BetCardProps) {
  const isMix = isMixMetric(bet.metric);
  const isPct = isPercentMetric(bet.metric);
  const isCur = isCurrencyMetric(bet.metric);
  const isMonths = bet.metric === 'salesCycleMonths';

  // Mix bets always work in 0-1 range internally, display as 0-100%
  const displayCurrent = isMix ? bet.currentValue * 100 : isPct ? bet.currentValue * 100 : bet.currentValue;
  const displayImproved = isMix ? bet.improvedValue * 100 : isPct ? bet.improvedValue * 100 : bet.improvedValue;

  function handleImprovedChange(rawValue: number) {
    const v = (isMix || isPct) ? rawValue / 100 : rawValue;
    onUpdate({ ...bet, improvedValue: v });
  }

  const diff = bet.improvedValue - bet.currentValue;
  const isChurn = bet.metric === 'monthlyChurnRate' || bet.metric === 'churnMixPct';
  const isSalesCycle = bet.metric === 'salesCycleMonths';
  const isImprovement = isChurn || isSalesCycle ? diff < 0 : diff > 0;

  // Mix-specific: implied dollar change
  const mixDollarChange = isMix && totalRevenue ? diff * totalRevenue : 0;

  if (isMix) {
    return (
      <div className={`border rounded-lg p-4 bg-white transition-colors ${
        bet.enabled ? 'border-purple-300 shadow-sm' : 'border-gray-200 opacity-60'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={bet.enabled}
              onChange={() => onToggle(bet.id)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <h4 className="text-sm font-medium text-gray-800">{bet.name}</h4>
              <span className="text-xs text-purple-500">Revenue Mix</span>
            </div>
          </div>
          <button
            onClick={() => onRemove(bet.id)}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            Remove
          </button>
        </div>

        {/* Current vs Target side by side */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Current %</label>
            <div className="text-sm font-medium text-gray-700 bg-gray-50 rounded px-2 py-1.5">
              {displayCurrent.toFixed(1)}%
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Target %</label>
            <div className="relative">
              <input
                type="number"
                value={displayImproved.toFixed(1)}
                onChange={(e) => handleImprovedChange(parseFloat(e.target.value) || 0)}
                step={0.5}
                min={0}
                max={100}
                className="w-full text-sm border border-purple-300 rounded px-2 py-1.5 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
            </div>
          </div>
        </div>

        {/* Implied $ change */}
        {totalRevenue !== undefined && totalRevenue > 0 && diff !== 0 && (
          <div className={`text-xs rounded px-2 py-1.5 mb-3 ${
            isImprovement ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
          }`}>
            {isChurn
              ? `This ${diff < 0 ? 'reduces' : 'increases'} churn by ${formatCurrencyFull(Math.abs(mixDollarChange))}`
              : `This shifts ${formatCurrencyFull(Math.abs(mixDollarChange))} ${diff > 0 ? 'to' : 'from'} ${getMixChannelLabel(bet.metric)}`
            }
          </div>
        )}

        {/* Slider 0-100% */}
        {bet.enabled && (
          <div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={displayImproved}
              onChange={(e) => handleImprovedChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard metric bet card (unchanged)
  return (
    <div className={`border rounded-lg p-4 bg-white transition-colors ${
      bet.enabled ? 'border-blue-300 shadow-sm' : 'border-gray-200 opacity-60'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={bet.enabled}
            onChange={() => onToggle(bet.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <h4 className="text-sm font-medium text-gray-800">{bet.name}</h4>
            <span className="text-xs text-gray-400">{bet.category}{bet.channel ? ` / ${bet.channel}` : ''}</span>
          </div>
        </div>
        <button
          onClick={() => onRemove(bet.id)}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Current</label>
          <div className="text-sm font-medium text-gray-700 bg-gray-50 rounded px-2 py-1.5">
            {formatValue(bet.metric, bet.currentValue)}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Improved To</label>
          <div className="relative">
            {isCur && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>}
            <input
              type="number"
              value={isPct ? displayImproved.toFixed(1) : displayImproved}
              onChange={(e) => handleImprovedChange(parseFloat(e.target.value) || 0)}
              step={isPct ? 0.5 : isMonths ? 0.5 : isCur ? 1000 : 1}
              className={`w-full text-sm border border-blue-300 rounded px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none ${isCur ? 'pl-5' : ''}`}
            />
            {isPct && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>}
            {isMonths && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">mo</span>}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Impact</label>
          <div className={`text-sm font-medium rounded px-2 py-1.5 ${
            isImprovement ? 'text-green-700 bg-green-50' : diff === 0 ? 'text-gray-500 bg-gray-50' : 'text-red-700 bg-red-50'
          }`}>
            {diff > 0 ? '+' : ''}{isPct ? (diff * 100).toFixed(1) + 'pp' : formatValue(bet.metric, diff)}
          </div>
        </div>
      </div>

      {/* Slider for quick adjustment */}
      {bet.enabled && (
        <div className="mt-3">
          <input
            type="range"
            min={isPct ? 0 : isMonths ? 0 : 0}
            max={isPct ? (isChurn ? displayCurrent * 2 : 100) : isMonths ? displayCurrent * 2 : displayCurrent * 3}
            step={isPct ? 0.5 : isMonths ? 0.5 : isCur ? 1000 : 1}
            value={displayImproved}
            onChange={(e) => handleImprovedChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      )}
    </div>
  );
}
