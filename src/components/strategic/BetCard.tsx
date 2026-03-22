'use client';

import React from 'react';
import type { StrategicBet } from '@/lib/types';
import { formatCurrencyFull, formatPercent } from '@/lib/format';

interface BetCardProps {
  bet: StrategicBet;
  onUpdate: (bet: StrategicBet) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

function isPercentMetric(metric: string): boolean {
  return ['winRate', 'hisToPipelineRate', 'expansionRate', 'monthlyChurnRate'].includes(metric);
}

function isCurrencyMetric(metric: string): boolean {
  return ['acv', 'pipelineMonthly'].includes(metric);
}

function formatValue(metric: string, value: number): string {
  if (isPercentMetric(metric)) return formatPercent(value);
  if (isCurrencyMetric(metric)) return formatCurrencyFull(value);
  if (metric === 'salesCycleMonths') return `${value} mo`;
  return value.toFixed(0);
}

export default function BetCard({ bet, onUpdate, onRemove, onToggle }: BetCardProps) {
  const isPct = isPercentMetric(bet.metric);
  const isCur = isCurrencyMetric(bet.metric);
  const isMonths = bet.metric === 'salesCycleMonths';

  const displayCurrent = isPct ? bet.currentValue * 100 : bet.currentValue;
  const displayImproved = isPct ? bet.improvedValue * 100 : bet.improvedValue;

  function handleImprovedChange(rawValue: number) {
    const v = isPct ? rawValue / 100 : rawValue;
    onUpdate({ ...bet, improvedValue: v });
  }

  // Determine the improvement direction text
  const diff = bet.improvedValue - bet.currentValue;
  const isChurn = bet.metric === 'monthlyChurnRate';
  const isSalesCycle = bet.metric === 'salesCycleMonths';
  const isImprovement = isChurn || isSalesCycle ? diff < 0 : diff > 0;

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
