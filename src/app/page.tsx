'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import TabNav, { type TabId } from '@/components/layout/TabNav';
import Setup from '@/components/views/Setup';
import TopDownPlan from '@/components/views/TopDownPlan';
import HistoricalBenchmarks from '@/components/views/HistoricalBenchmarks';
import GapAnalysis from '@/components/views/GapAnalysis';
import StrategicBets from '@/components/views/StrategicBets';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { isQuarterFilled } from '@/components/shared/HistoricalDataSheet';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('setup');
  const { plan } = useGTMPlan();
  const filledQuarters = (plan.historicalQuarters ?? []).filter(isQuarterFilled).length;
  const showWarning = activeTab !== 'setup' && filledQuarters < 4;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {showWarning && (
          <div className="mb-4 border border-amber-300 rounded-lg p-3 bg-amber-50">
            <p className="text-sm text-amber-800 font-medium">
              Complete at least 4 quarters of historical data in Setup for accurate projections.
              {filledQuarters > 0 && ` (${filledQuarters}/4 filled)`}
            </p>
          </div>
        )}
        {activeTab === 'setup' && <Setup />}
        {activeTab === 'targets' && <TopDownPlan />}
        {activeTab === 'historical' && <HistoricalBenchmarks />}
        {activeTab === 'gap' && <GapAnalysis />}
        {activeTab === 'bets' && <StrategicBets />}
      </main>
    </div>
  );
}
