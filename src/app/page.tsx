'use client';

import React, { useState, useMemo } from 'react';
import Header from '@/components/layout/Header';
import TabNav, { type TabId } from '@/components/layout/TabNav';
import Setup from '@/components/views/Setup';
import TopDownPlan from '@/components/views/TopDownPlan';
import HistoricalBenchmarks from '@/components/views/HistoricalBenchmarks';
import GapAnalysis from '@/components/views/GapAnalysis';
import StrategicBets from '@/components/views/StrategicBets';
import ExecutiveSummary from '@/components/views/ExecutiveSummary';
import Methodology from '@/components/views/Methodology';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { isQuarterFilled } from '@/components/shared/HistoricalDataSheet';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('setup');
  const { plan } = useGTMPlan();
  const filledQuarters = (plan.historicalQuarters ?? []).filter(isQuarterFilled).length;
  const showHistoricalWarning = activeTab !== 'setup' && filledQuarters < 4;

  // Allocation validation: block other tabs if manual mode and total != 100%
  const allocations = plan.targetAllocations ?? { inbound: 0, outbound: 0, expansion: 0, churn: 0, newProduct: 0 };
  const cc = plan.channelConfig;
  const allocTotal = useMemo(() => {
    let total = 0;
    if (cc.hasInbound) total += allocations.inbound || 0;
    if (cc.hasOutbound) total += allocations.outbound || 0;
    if (cc.hasExpansion) total += allocations.expansion || 0;
    if (cc.hasChurn) total += allocations.churn || 0;
    if (cc.hasNewProduct) total += allocations.newProduct || 0;
    return total;
  }, [allocations, cc]);
  const isManualMode = (plan.targetAllocationMode ?? 'historical') === 'manual';
  const allocValid = !isManualMode || Math.abs(allocTotal - 100) < 0.01;
  const showAllocWarning = activeTab !== 'setup' && !allocValid;

  const handleTabChange = (tab: TabId) => {
    // Block navigation if allocation is invalid
    if (tab !== 'setup' && !allocValid) return;
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {showAllocWarning && (
          <div className="mb-4 border border-red-300 rounded-lg p-3 bg-red-50">
            <p className="text-sm text-red-800 font-medium">
              Complete your target allocation in Setup to proceed. Allocations must total 100%.
            </p>
          </div>
        )}
        {showHistoricalWarning && (
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
        {activeTab === 'summary' && <ExecutiveSummary />}
        {activeTab === 'methodology' && <Methodology />}
      </main>
    </div>
  );
}
