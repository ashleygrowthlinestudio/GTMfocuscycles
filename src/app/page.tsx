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

  // Allocation validation (net-based: gross channels - churn = ARR gap)
  const allocations = plan.targetAllocations ?? { inbound: 0, outbound: 0, expansion: 0, churn: 0, newProduct: 0 };
  const cc = plan.channelConfig;
  const newARR = (plan.targetARR ?? 0) - (plan.startingARR ?? 0);
  const { grossPct, churnPct, hasStartedAllocating } = useMemo(() => {
    let gross = 0;
    if (cc.hasInbound) gross += allocations.inbound || 0;
    if (cc.hasOutbound) gross += allocations.outbound || 0;
    if (cc.hasExpansion) gross += allocations.expansion || 0;
    if (cc.hasNewProduct) gross += allocations.newProduct || 0;
    if (cc.hasEmergingInbound) gross += allocations.emergingInbound || 0;
    if (cc.hasEmergingOutbound) gross += allocations.emergingOutbound || 0;
    if (cc.hasEmergingNewProduct) gross += allocations.emergingNewProduct || 0;
    const churn = cc.hasChurn ? (allocations.churn || 0) : 0;
    return { grossPct: gross, churnPct: churn, hasStartedAllocating: gross > 0 || churn > 0 };
  }, [allocations, cc]);
  const isManualMode = (plan.targetAllocationMode ?? 'historical') === 'manual';
  const netAmt = newARR * ((grossPct - churnPct) / 100);
  const allocValid = !isManualMode || Math.abs(netAmt - newARR) < 1;
  // Only incomplete if user has started but hasn't finished
  const allocIncomplete = isManualMode && hasStartedAllocating && !allocValid;
  const showAllocWarning = activeTab !== 'setup' && allocIncomplete;

  const handleTabChange = (tab: TabId) => {
    // Always allow navigation — show warnings instead of blocking
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={handleTabChange} setupIncomplete={allocIncomplete} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {showAllocWarning && (
          <div className="mb-4 border border-amber-300 rounded-lg p-3 bg-amber-50">
            <p className="text-sm text-amber-800 font-medium">
              Your target allocation in Setup is incomplete &mdash; net allocation does not match your ARR gap.
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
