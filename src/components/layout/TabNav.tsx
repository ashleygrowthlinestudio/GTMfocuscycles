'use client';

import React from 'react';

export type TabId = 'setup' | 'targets' | 'historical' | 'gap' | 'bets';

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; description: string }[] = [
  { id: 'setup', label: '0. Setup', description: 'Configure your plan' },
  { id: 'targets', label: '1. Revenue Targets', description: 'Top-down plan' },
  { id: 'historical', label: '2. Current Performance', description: 'Historical benchmarks' },
  { id: 'gap', label: '3. The Gap', description: 'Target vs. status quo' },
  { id: 'bets', label: '4. Strategic Bets', description: 'Focus cycle calculator' },
];

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-shrink-0 px-4 py-3 text-left border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-transparent hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  activeTab === tab.id ? 'text-blue-700' : 'text-gray-700'
                }`}
              >
                {tab.label}
              </span>
              <span className="block text-xs text-gray-400 mt-0.5">{tab.description}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
