// ── Time periods ──────────────────────────────────────────────
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

// ── Funnel inputs per channel ─────────────────────────────────
export interface InboundFunnelInputs {
  hisMonthly: number;            // high-intent submissions per month
  hisToPipelineRate: number;     // HIS → Pipeline conversion (e.g. 0.40)
  winRate: number;               // Pipeline → Closed Won (e.g. 0.25)
  acv: number;                   // average contract value ($)
  salesCycleMonths: number;      // months from pipeline creation to close
}

export interface OutboundFunnelInputs {
  pipelineMonthly: number;       // pipeline created per month ($)
  winRate: number;
  acv: number;
  salesCycleMonths: number;
}

// ── Revenue categories ────────────────────────────────────────
export interface RevenueBreakdown {
  newBusiness: {
    inbound: InboundFunnelInputs;
    outbound: OutboundFunnelInputs;
  };
  expansion: {
    expansionRate: number;       // % of existing ARR that expands per month
  };
  churn: {
    monthlyChurnRate: number;    // % of ARR lost per month
  };
  newProduct: {
    inbound: InboundFunnelInputs;
    outbound: OutboundFunnelInputs;
  };
}

// ── Seasonality ───────────────────────────────────────────────
export interface SeasonalityWeights {
  monthly: Record<Month, number>; // 12 weights, 1.0 = average month
}

// ── Ramp config ───────────────────────────────────────────────
export interface RampConfig {
  rampMonths: number;            // months to reach full new capacity
  startMonth: Month;             // when improvements begin taking effect
}

// ── Pre-existing pipeline ─────────────────────────────────────
export interface ExistingPipeline {
  inboundCore: number;           // $ value of inbound pipeline already in flight
  outboundCore: number;
  inboundNewProduct: number;
  outboundNewProduct: number;
  expectedCloseMonth: Month;     // when this pipeline is expected to close
  winRate: number;               // expected win rate on existing pipeline
}

// ── Monthly result row ────────────────────────────────────────
export interface MonthlyResult {
  month: Month;
  // Pipeline created
  inboundPipelineCreated: number;
  outboundPipelineCreated: number;
  newProductInboundPipelineCreated: number;
  newProductOutboundPipelineCreated: number;
  // High-intent submissions
  hisRequired: number;
  newProductHisRequired: number;
  // Closed won revenue (new ARR added)
  inboundClosedWon: number;
  outboundClosedWon: number;
  newProductInboundClosedWon: number;
  newProductOutboundClosedWon: number;
  // Expansion & churn
  expansionRevenue: number;
  churnRevenue: number;          // negative
  // Totals
  totalNewARR: number;           // all closed won + expansion - churn
  cumulativeARR: number;         // running ARR balance
  // Deals
  inboundDeals: number;
  outboundDeals: number;
  newProductInboundDeals: number;
  newProductOutboundDeals: number;
}

// ── Quarterly rollup ──────────────────────────────────────────
export interface QuarterlyResult {
  quarter: Quarter;
  months: [MonthlyResult, MonthlyResult, MonthlyResult];
  // Summed totals
  inboundPipelineCreated: number;
  outboundPipelineCreated: number;
  newProductInboundPipelineCreated: number;
  newProductOutboundPipelineCreated: number;
  hisRequired: number;
  newProductHisRequired: number;
  inboundClosedWon: number;
  outboundClosedWon: number;
  newProductInboundClosedWon: number;
  newProductOutboundClosedWon: number;
  expansionRevenue: number;
  churnRevenue: number;
  totalNewARR: number;
  endingARR: number;
}

// ── Strategic bet ─────────────────────────────────────────────
export type BetMetric =
  | 'winRate'
  | 'salesCycleMonths'
  | 'hisToPipelineRate'
  | 'hisMonthly'
  | 'pipelineMonthly'
  | 'acv'
  | 'expansionRate'
  | 'monthlyChurnRate';

export type BetCategory = 'newBusiness' | 'expansion' | 'churn' | 'newProduct';
export type BetChannel = 'inbound' | 'outbound';

export interface StrategicBet {
  id: string;
  name: string;
  metric: BetMetric;
  category: BetCategory;
  channel?: BetChannel;
  currentValue: number;
  improvedValue: number;
  enabled: boolean;
}

// ── Top-level plan ────────────────────────────────────────────
export interface GTMPlan {
  id: string;
  name: string;
  planYear: number;
  startingARR: number;
  targetARR: number;
  existingPipeline: ExistingPipeline;

  targets: RevenueBreakdown;
  seasonality: SeasonalityWeights;
  ramp: RampConfig;

  historical: RevenueBreakdown;

  strategicBets: StrategicBet[];
}

// ── Gap result ────────────────────────────────────────────────
export interface GapResult {
  month: Month;
  targetARR: number;
  historicalARR: number;
  gapARR: number;
  targetNewARR: number;
  historicalNewARR: number;
  gapNewARR: number;
  // Per-category gaps
  inboundClosedWonGap: number;
  outboundClosedWonGap: number;
  expansionGap: number;
  churnGap: number;
  pipelineGap: number;
}

