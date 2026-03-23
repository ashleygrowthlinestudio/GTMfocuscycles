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
    pipelineMonthly: number;     // expansion pipeline created per month ($)
    winRate: number;             // expansion win rate
    acv: number;                 // average expansion deal value ($)
    salesCycleMonths: number;    // months from pipeline to close
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

// ── Planning mode ────────────────────────────────────────────
export type PlanningMode = 'future-year' | 'in-year';

// ── Actuals (reforecasting) ──────────────────────────────────
export interface MonthlyActual {
  month: Month;
  arr: number;
  newARR: number;
  churn: number;
}

export interface Actuals {
  planStartDate: string;        // ISO date string (YYYY-MM-DD)
  currentMonth: Month;          // reforecasting as-of month
  monthlyActuals: MonthlyActual[];
}

// ── Detailed monthly actuals (in-year reforecast) ────────────
export interface MonthlyActuals {
  month: Month;
  inboundPipelineCreated: number;
  outboundPipelineCreated: number;
  inboundClosedWon: number;
  outboundClosedWon: number;
  newProductInboundClosedWon: number;
  newProductOutboundClosedWon: number;
  expansionRevenue: number;
  churnRevenue: number;
  totalNewARR: number;
  cumulativeARR: number;
  inboundWinRate: number;
  outboundWinRate: number;
  hisToPipelineRate: number;
  inboundACV: number;
  outboundACV: number;
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
  | 'monthlyChurnRate'
  | 'inboundMixPct'
  | 'outboundMixPct'
  | 'newProductInboundMixPct'
  | 'newProductOutboundMixPct'
  | 'expansionMixPct'
  | 'churnMixPct';

export type BetCategory = 'newBusiness' | 'expansion' | 'churn' | 'newProduct' | 'revenueMix';

export interface ChannelMix {
  inbound: number;
  outbound: number;
  newProductInbound: number;
  newProductOutbound: number;
  expansion: number;
  churn: number;
}
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
  startMonth: Month;
  rampMonths: number;
}

// ── Channel configuration ────────────────────────────────────
export interface ChannelConfig {
  hasInbound: boolean;
  hasOutbound: boolean;
  hasNewProduct: boolean;
  hasExpansion: boolean;
  hasChurn: boolean;
  hasInboundHistory: boolean;
  hasOutboundHistory: boolean;
  hasNewProductHistory: boolean;
  // Emerging channels (no historical data required)
  hasEmergingInbound: boolean;
  hasEmergingOutbound: boolean;
  hasEmergingNewProduct: boolean;
}

// ── Quarterly historical data (Setup sheet) ──────────────────
export interface QuarterlyHistoricalData {
  quarterLabel: string;       // e.g. "Q1 2024"
  year: number;
  quarter: 1 | 2 | 3 | 4;
  // Inbound
  inboundHIS: number;
  inboundHISToPipelineRate: number;
  inboundQualifiedPipeline: number;
  inboundWinRate: number;
  inboundACV: number;
  inboundSalesCycle: number;
  inboundClosedWon: number;
  inboundNewCustomers: number;
  // Outbound
  outboundQualifiedPipeline: number;
  outboundWinRate: number;
  outboundACV: number;
  outboundSalesCycle: number;
  outboundClosedWon: number;
  outboundNewCustomers: number;
  // Expansion
  expansionRevenue: number;
  expansionRate: number;  // legacy — kept for backward compat
  expansionPipeline: number;
  expansionWinRate: number;
  expansionACV: number;
  expansionSalesCycle: number;
  // Churn
  churnRevenue: number;
  churnRate: number;
  // New Product
  newProductHIS: number;
  newProductHISToPipelineRate: number;
  newProductQualifiedPipeline: number;
  newProductWinRate: number;
  newProductACV: number;
  newProductSalesCycle: number;
  newProductClosedWon: number;
  newProductNewCustomers: number;
  // Source / Notes per metric
  metricNotes?: Record<string, string>;
}

// ── Target allocation ────────────────────────────────────────
export type TargetAllocationMode = 'historical' | 'manual';

export interface TargetAllocations {
  inbound: number;    // % (0-100)
  outbound: number;
  expansion: number;
  churn: number;
  newProduct: number;
  // Emerging channels
  emergingInbound: number;
  emergingOutbound: number;
  emergingNewProduct: number;
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
  historicalQuarters: QuarterlyHistoricalData[];

  channelConfig: ChannelConfig;
  strategicBets: StrategicBet[];
  marketInsights: MarketInsight[];
  actuals: Actuals;

  planningMode: PlanningMode;
  currentMonth: Month;
  detailedActuals: MonthlyActuals[];

  targetAllocationMode: TargetAllocationMode;
  targetAllocations: TargetAllocations;
}

// ── Market insight ───────────────────────────────────────────
export interface MarketInsight {
  id: string;
  label: string;
  description: string;
  channel: 'inbound' | 'outbound' | 'newProduct' | 'expansion' | 'churn' | 'all';
  metric: 'pipeline' | 'winRate' | 'churnRate' | 'hisVolume' | 'acv' | 'overall';
  impactType: 'oneTime' | 'gradual';
  impactMonth: Month;
  impactDurationMonths: number;
  impactPct: number; // negative = headwind, positive = tailwind e.g. -0.20 = 20% decline
  impactDescriptor: string; // human-readable label e.g. 'Significant Decline'
  enabled: boolean;
  offsetInsightId?: string; // links to a paired offset insight
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

// ── Pipeline deadline ────────────────────────────────────────
export type PipelineChannel = 'inbound' | 'outbound' | 'newProductInbound' | 'newProductOutbound';

export interface PipelineDeadline {
  closingMonth: number;
  channel: PipelineChannel;
  pipelineNeededBy: number; // month (can be < 1 if before plan year)
  pipelineAmount: number;
  closedWonAmount: number;
  hisNeededBy?: number; // inbound channels only
  hisAmount?: number;
  isUrgent: boolean; // pipelineNeededBy <= currentMonth
}

