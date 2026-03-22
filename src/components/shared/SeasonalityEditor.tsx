'use client';
import React from 'react';
import type { SeasonalityWeights, Month } from '@/lib/types';
import { formatMonthName } from '@/lib/format';
interface SeasonalityEditorProps {
  seasonality: SeasonalityWeights;
  onChange: (seasonality: SeasonalityWeights) => void;
}
export default function SeasonalityEditor({ seasonality, onChange }: SeasonalityEditorProps) {
  const months = Array.from({ length: 12 }, (_, i) => (i + 1) as Month);
  function handleMonthChange(month: Month, value: number) {
    onChange({
      monthly: { ...seasonality.monthly, [month]: value },
    });
  }
  function resetToFlat() {
    const flat: Record<number, number> = {};
    months.forEach((m) => (flat[m] = 1.0));
    onChange({ monthly: flat as Record<Month, number> });
  }
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Seasonality Weights</h3>
        <button
          onClick={resetToFlat}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Reset to flat
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        1.0 = average month. Values {'>'} 1.0 mean stronger months, {'<'} 1.0 mean weaker.
      </p>
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
        {months.map((month) => (
          <div key={month} className="text-center">
            <label className="text-xs text-gray-500 block mb-1">{formatMonthName(month)}</label>
            <input
              type="number"
              value={seasonality.monthly[month].toFixed(2)}
              onChange={(e) => handleMonthChange(month, parseFloat(e.target.value) || 1)}
              step={0.05}
              min={0}
              max={3}
              className="w-full text-center text-xs border border-gray-300 rounded py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
