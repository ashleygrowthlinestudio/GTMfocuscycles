'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import TabNav, { type TabId } from '@/components/layout/TabNav';
import TopDownPlan from '@/components/views/TopDownPlan';
import HistoricalBenchmarks from '@/components/views/HistoricalBenchmarks';
import GapAnalysis from '@/components/views/GapAnalysis';
import StrategicBets from '@/components/views/StrategicBets';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('targets');
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'targets' && <TopDownPlan />}
        {activeTab === 'historical' && <HistoricalBenchmarks />}
        {activeTab === 'gap' && <GapAnalysis />}
        {activeTab === 'bets' && <StrategicBets />}
      </main>
    </div>
  );
}

