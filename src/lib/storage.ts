import type { GTMPlan } from './types';

const STORAGE_KEY = 'gtm-focus-cycle-plan';

export function savePlan(plan: GTMPlan): void {

  try {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));

  } catch {

    console.error('Failed to save plan to localStorage');

  }

}

export function loadPlan(): GTMPlan | null {

  try {

    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const plan = JSON.parse(raw) as GTMPlan;

    // Backfill new channelConfig fields for saved plans that predate them
    if (plan.channelConfig) {
      if (plan.channelConfig.hasExpansion === undefined) plan.channelConfig.hasExpansion = true;
      if (plan.channelConfig.hasChurn === undefined) plan.channelConfig.hasChurn = true;
      if (plan.channelConfig.hasEmergingInbound === undefined) plan.channelConfig.hasEmergingInbound = false;
      if (plan.channelConfig.hasEmergingOutbound === undefined) plan.channelConfig.hasEmergingOutbound = false;
      if (plan.channelConfig.hasEmergingNewProduct === undefined) plan.channelConfig.hasEmergingNewProduct = false;
    }

    // Backfill planning mode fields
    if (!plan.planningMode) plan.planningMode = 'future-year';
    if (!plan.currentMonth) plan.currentMonth = (new Date().getMonth() + 1) as import('./types').Month;
    if (!plan.detailedActuals) plan.detailedActuals = [];
    if (!plan.historicalQuarters) plan.historicalQuarters = [];
    if (!plan.targetAllocationMode) plan.targetAllocationMode = 'historical';
    if (!plan.targetAllocations) plan.targetAllocations = { inbound: 0, outbound: 0, expansion: 0, churn: 0, newProduct: 0, emergingInbound: 0, emergingOutbound: 0, emergingNewProduct: 0 };
    // Backfill emerging allocation fields for older plans
    if (plan.targetAllocations && plan.targetAllocations.emergingOutbound === undefined) {
      plan.targetAllocations = { ...plan.targetAllocations, emergingInbound: 0, emergingOutbound: 0, emergingNewProduct: 0 };
    }

    // Backfill expansion funnel fields for plans that used old expansionRate
    if (plan.targets?.expansion) {
      const exp = plan.targets.expansion as Record<string, unknown>;
      if (exp.pipelineMonthly === undefined) exp.pipelineMonthly = 0;
      if (exp.winRate === undefined) exp.winRate = 0;
      if (exp.acv === undefined) exp.acv = 0;
      if (exp.salesCycleMonths === undefined) exp.salesCycleMonths = 0;
    }
    if (plan.historical?.expansion) {
      const exp = plan.historical.expansion as Record<string, unknown>;
      if (exp.pipelineMonthly === undefined) exp.pipelineMonthly = 0;
      if (exp.winRate === undefined) exp.winRate = 0;
      if (exp.acv === undefined) exp.acv = 0;
      if (exp.salesCycleMonths === undefined) exp.salesCycleMonths = 0;
    }

    // Backfill newProduct for plans that predate the new product channel
    const ZERO_NP = { inbound: { hisMonthly: 0, hisToPipelineRate: 0, winRate: 0, acv: 0, salesCycleMonths: 0 } };
    if (plan.targets && !plan.targets.newProduct) {
      (plan.targets as any).newProduct = ZERO_NP;
    }
    if (plan.historical && !plan.historical.newProduct) {
      (plan.historical as any).newProduct = ZERO_NP;
    }

    // Strip legacy newProduct.outbound from saved plans
    if (plan.targets?.newProduct && (plan.targets.newProduct as any).outbound) {
      delete (plan.targets.newProduct as any).outbound;
    }
    if (plan.historical?.newProduct && (plan.historical.newProduct as any).outbound) {
      delete (plan.historical.newProduct as any).outbound;
    }
    // Strip legacy existingPipeline.outboundNewProduct
    if (plan.existingPipeline && (plan.existingPipeline as any).outboundNewProduct !== undefined) {
      delete (plan.existingPipeline as any).outboundNewProduct;
    }

    // Backfill market insights
    if (!plan.marketInsights) (plan as any).marketInsights = [];

    // Backfill strategic bet ramp fields
    if (plan.strategicBets) {
      for (const bet of plan.strategicBets) {
        if (bet.startMonth === undefined) bet.startMonth = 1 as import('./types').Month;
        if (bet.rampMonths === undefined) bet.rampMonths = 3;
      }
    }

    return plan;

  } catch {

    console.error('Failed to load plan from localStorage');

    return null;

  }

}

export function exportPlanJSON(plan: GTMPlan): void {

  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download = `${plan.name.replace(/\s+/g, '-').toLowerCase()}-${plan.planYear}.json`;

  a.click();

  URL.revokeObjectURL(url);

}

export function importPlanJSON(file: File): Promise<GTMPlan> {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {

      try {

        const plan = JSON.parse(reader.result as string) as GTMPlan;

        if (!plan.id || !plan.targets || !plan.historical) {

          reject(new Error('Invalid plan file'));

          return;

        }

        resolve(plan);

      } catch {

        reject(new Error('Failed to parse JSON file'));

      }

    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.readAsText(file);

  });

}
