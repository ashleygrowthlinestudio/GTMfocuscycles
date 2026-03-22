import type {

  GTMPlan,

  RevenueBreakdown,

  SeasonalityWeights,

  RampConfig,

  ExistingPipeline,

  Month,

} from './types';

export const DEFAULT_SEASONALITY: SeasonalityWeights = {

  monthly: {

    1: 0.85, 2: 0.90, 3: 1.05,

    4: 1.00, 5: 1.05, 6: 1.15,

    7: 0.90, 8: 0.85, 9: 1.10,

    10: 1.10, 11: 1.05, 12: 1.00,

  } as Record<Month, number>,

};

export const DEFAULT_RAMP: RampConfig = {

  rampMonths: 3,

  startMonth: 1,

};

export const DEFAULT_EXISTING_PIPELINE: ExistingPipeline = {

  inboundCore: 500_000,

  outboundCore: 300_000,

  inboundNewProduct: 0,

  outboundNewProduct: 0,

  expectedCloseMonth: 2,

  winRate: 0.30,

};

export const DEFAULT_TARGETS: RevenueBreakdown = {

  newBusiness: {

    inbound: {

      hisMonthly: 100,

      hisToPipelineRate: 0.40,

      winRate: 0.25,

      acv: 50_000,

      salesCycleMonths: 3,

    },

    outbound: {

      pipelineMonthly: 400_000,

      winRate: 0.20,

      acv: 60_000,

      salesCycleMonths: 4,

    },

  },

  expansion: {

    expansionRate: 0.005, // 0.5% of ARR per month

  },

  churn: {

    monthlyChurnRate: 0.004, // 0.4% of ARR per month

  },

  newProduct: {

    inbound: {

      hisMonthly: 20,

      hisToPipelineRate: 0.30,

      winRate: 0.20,

      acv: 30_000,

      salesCycleMonths: 2,

    },

    outbound: {

      pipelineMonthly: 100_000,

      winRate: 0.15,

      acv: 35_000,

      salesCycleMonths: 3,

    },

  },

};

export const DEFAULT_HISTORICAL: RevenueBreakdown = {

  newBusiness: {

    inbound: {

      hisMonthly: 60,

      hisToPipelineRate: 0.35,

      winRate: 0.20,

      acv: 45_000,

      salesCycleMonths: 4,

    },

    outbound: {

      pipelineMonthly: 250_000,

      winRate: 0.15,

      acv: 50_000,

      salesCycleMonths: 5,

    },

  },

  expansion: {

    expansionRate: 0.003,

  },

  churn: {

    monthlyChurnRate: 0.005,

  },

  newProduct: {

    inbound: {

      hisMonthly: 0,

      hisToPipelineRate: 0,

      winRate: 0,

      acv: 0,

      salesCycleMonths: 0,

    },

    outbound: {

      pipelineMonthly: 0,

      winRate: 0,

      acv: 0,

      salesCycleMonths: 0,

    },

  },

};

export function createDefaultPlan(): GTMPlan {

  return {

    id: crypto.randomUUID(),

    name: 'GTM Focus Cycle Plan',

    planYear: new Date().getFullYear(),

    startingARR: 2_000_000,

    targetARR: 7_000_000,

    existingPipeline: DEFAULT_EXISTING_PIPELINE,

    targets: DEFAULT_TARGETS,

    seasonality: DEFAULT_SEASONALITY,

    ramp: DEFAULT_RAMP,

    historical: DEFAULT_HISTORICAL,

    strategicBets: [],

  };

}
