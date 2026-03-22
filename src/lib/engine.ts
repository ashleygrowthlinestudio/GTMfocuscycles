import type {
  RevenueBreakdown,
  SeasonalityWeights,
  RampConfig,
  ExistingPipeline,
  ChannelConfig,
  MonthlyResult,
  QuarterlyResult,
  GapResult,
  StrategicBet,
  Month,
  Quarter,
  InboundFunnelInputs,
  OutboundFunnelInputs,
} from './types';

// ── Helpers ───────────────────────────────────────────────────

function getRampMultiplier(month: Month, ramp: RampConfig): number {
  const monthsIntoRamp = month - ramp.startMonth + 1;
  if (monthsIntoRamp <= 0) return 0;
  if (monthsIntoRamp >= ramp.rampMonths) return 1;
  return monthsIntoRamp / ramp.rampMonths;
}

function getSeasonalityWeight(month: Month, seasonality: SeasonalityWeights): number {
  return seasonality.monthly[month] ?? 1.0;
}

/** Calculate pipeline created for an inbound channel in a given month */
function calcInboundPipeline(
  inputs: InboundFunnelInputs,
  seasonWeight: number,
  rampMult: number,
): { pipeline: number; his: number } {
  const his = inputs.hisMonthly * seasonWeight * rampMult;
  const pipeline = his * inputs.hisToPipelineRate * inputs.acv;
  return { pipeline, his };
}

/** Calculate pipeline created for an outbound channel in a given month */
function calcOutboundPipeline(
  inputs: OutboundFunnelInputs,
  seasonWeight: number,
  rampMult: number,
): number {
  return inputs.pipelineMonthly * seasonWeight * rampMult;
}

// ── Main calculation ──────────────────────────────────────────

export function calculateMonthlyRevenue(
  inputs: RevenueBreakdown,
  seasonality: SeasonalityWeights,
  ramp: RampConfig,
  startingARR: number,
  existingPipeline: ExistingPipeline,
): MonthlyResult[] {
  const results: MonthlyResult[] = [];

  // Track pipeline created each month so we can apply waterfall
  const inboundCorePipeline: number[] = [];   // indexed 0-11 for months 1-12
  const outboundCorePipeline: number[] = [];
  const inboundNewProdPipeline: number[] = [];
  const outboundNewProdPipeline: number[] = [];

  let currentARR = startingARR;

  for (let i = 0; i < 12; i++) {
    const month = (i + 1) as Month;
    const seasonWeight = getSeasonalityWeight(month, seasonality);
    const rampMult = getRampMultiplier(month, ramp);

    // ── Pipeline creation ──
    const ib = calcInboundPipeline(inputs.newBusiness.inbound, seasonWeight, rampMult);
    inboundCorePipeline[i] = ib.pipeline;

    const obPipeline = calcOutboundPipeline(inputs.newBusiness.outbound, seasonWeight, rampMult);
    outboundCorePipeline[i] = obPipeline;

    const npIb = calcInboundPipeline(inputs.newProduct.inbound, seasonWeight, rampMult);
    inboundNewProdPipeline[i] = npIb.pipeline;

    const npObPipeline = calcOutboundPipeline(inputs.newProduct.outbound, seasonWeight, rampMult);
    outboundNewProdPipeline[i] = npObPipeline;

    // ── Closed Won (waterfall from pipeline created N months ago) ──
    const ibCycleIdx = i - Math.round(inputs.newBusiness.inbound.salesCycleMonths);
    const obCycleIdx = i - Math.round(inputs.newBusiness.outbound.salesCycleMonths);
    const npIbCycleIdx = i - Math.round(inputs.newProduct.inbound.salesCycleMonths);
    const npObCycleIdx = i - Math.round(inputs.newProduct.outbound.salesCycleMonths);

    let inboundClosedWon = 0;
    let outboundClosedWon = 0;
    let npInboundClosedWon = 0;
    let npOutboundClosedWon = 0;

    // New pipeline waterfall
    if (ibCycleIdx >= 0) {
      inboundClosedWon = inboundCorePipeline[ibCycleIdx] * inputs.newBusiness.inbound.winRate;
    }
    if (obCycleIdx >= 0) {
      outboundClosedWon = outboundCorePipeline[obCycleIdx] * inputs.newBusiness.outbound.winRate;
    }
    if (npIbCycleIdx >= 0) {
      npInboundClosedWon = inboundNewProdPipeline[npIbCycleIdx] * inputs.newProduct.inbound.winRate;
    }
    if (npObCycleIdx >= 0) {
      npOutboundClosedWon = outboundNewProdPipeline[npObCycleIdx] * inputs.newProduct.outbound.winRate;
    }

    // Pre-existing pipeline closes in its expected month
    if (month === existingPipeline.expectedCloseMonth) {
      inboundClosedWon += existingPipeline.inboundCore * existingPipeline.winRate;
      outboundClosedWon += existingPipeline.outboundCore * existingPipeline.winRate;
      npInboundClosedWon += existingPipeline.inboundNewProduct * existingPipeline.winRate;
      npOutboundClosedWon += existingPipeline.outboundNewProduct * existingPipeline.winRate;
    }

    // ── Deals ──
    const ibAcv = inputs.newBusiness.inbound.acv || 1;
    const obAcv = inputs.newBusiness.outbound.acv || 1;
    const npIbAcv = inputs.newProduct.inbound.acv || 1;
    const npObAcv = inputs.newProduct.outbound.acv || 1;

    const inboundDeals = inboundClosedWon / ibAcv;
    const outboundDeals = outboundClosedWon / obAcv;
    const npInboundDeals = npInboundClosedWon / npIbAcv;
    const npOutboundDeals = npOutboundClosedWon / npObAcv;

    // ── Expansion & Churn ──
    const expansionRevenue = currentARR * inputs.expansion.expansionRate;
    const churnRevenue = -(currentARR * inputs.churn.monthlyChurnRate);

    // ── Total new ARR this month ──
    const totalNewARR =
      inboundClosedWon + outboundClosedWon +
      npInboundClosedWon + npOutboundClosedWon +
      expansionRevenue + churnRevenue;

    currentARR += totalNewARR;

    results.push({
      month,
      inboundPipelineCreated: ib.pipeline,
      outboundPipelineCreated: obPipeline,
      newProductInboundPipelineCreated: npIb.pipeline,
      newProductOutboundPipelineCreated: npObPipeline,
      hisRequired: ib.his,
      newProductHisRequired: npIb.his,
      inboundClosedWon,
      outboundClosedWon,
      newProductInboundClosedWon: npInboundClosedWon,
      newProductOutboundClosedWon: npOutboundClosedWon,
      expansionRevenue,
      churnRevenue,
      totalNewARR,
      cumulativeARR: currentARR,
      inboundDeals,
      outboundDeals,
      newProductInboundDeals: npInboundDeals,
      newProductOutboundDeals: npOutboundDeals,
    });
  }

  return results;
}

// ── Quarterly rollup ──────────────────────────────────────────

export function rollUpToQuarters(monthly: MonthlyResult[]): QuarterlyResult[] {
  const quarters: QuarterlyResult[] = [];
  const quarterNames: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

  for (let q = 0; q < 4; q++) {
    const m = monthly.slice(q * 3, q * 3 + 3) as [MonthlyResult, MonthlyResult, MonthlyResult];
    quarters.push({
      quarter: quarterNames[q],
      months: m,
      inboundPipelineCreated: m.reduce((s, r) => s + r.inboundPipelineCreated, 0),
      outboundPipelineCreated: m.reduce((s, r) => s + r.outboundPipelineCreated, 0),
      newProductInboundPipelineCreated: m.reduce((s, r) => s + r.newProductInboundPipelineCreated, 0),
      newProductOutboundPipelineCreated: m.reduce((s, r) => s + r.newProductOutboundPipelineCreated, 0),
      hisRequired: m.reduce((s, r) => s + r.hisRequired, 0),
      newProductHisRequired: m.reduce((s, r) => s + r.newProductHisRequired, 0),
      inboundClosedWon: m.reduce((s, r) => s + r.inboundClosedWon, 0),
      outboundClosedWon: m.reduce((s, r) => s + r.outboundClosedWon, 0),
      newProductInboundClosedWon: m.reduce((s, r) => s + r.newProductInboundClosedWon, 0),
      newProductOutboundClosedWon: m.reduce((s, r) => s + r.newProductOutboundClosedWon, 0),
      expansionRevenue: m.reduce((s, r) => s + r.expansionRevenue, 0),
      churnRevenue: m.reduce((s, r) => s + r.churnRevenue, 0),
      totalNewARR: m.reduce((s, r) => s + r.totalNewARR, 0),
      endingARR: m[2].cumulativeARR,
    });
  }

  return quarters;
}

// ── Gap analysis ──────────────────────────────────────────────

export function calculateGap(
  targets: MonthlyResult[],
  historical: MonthlyResult[],
): GapResult[] {
  return targets.map((t, i) => {
    const h = historical[i];
    return {
      month: t.month,
      targetARR: t.cumulativeARR,
      historicalARR: h.cumulativeARR,
      gapARR: t.cumulativeARR - h.cumulativeARR,
      targetNewARR: t.totalNewARR,
      historicalNewARR: h.totalNewARR,
      gapNewARR: t.totalNewARR - h.totalNewARR,
      inboundClosedWonGap: (t.inboundClosedWon + t.newProductInboundClosedWon) -
        (h.inboundClosedWon + h.newProductInboundClosedWon),
      outboundClosedWonGap: (t.outboundClosedWon + t.newProductOutboundClosedWon) -
        (h.outboundClosedWon + h.newProductOutboundClosedWon),
      expansionGap: t.expansionRevenue - h.expansionRevenue,
      churnGap: t.churnRevenue - h.churnRevenue,
      pipelineGap:
        (t.inboundPipelineCreated + t.outboundPipelineCreated +
          t.newProductInboundPipelineCreated + t.newProductOutboundPipelineCreated) -
        (h.inboundPipelineCreated + h.outboundPipelineCreated +
          h.newProductInboundPipelineCreated + h.newProductOutboundPipelineCreated),
    };
  });
}

// ── Strategic bets ────────────────────────────────────────────

export function applyStrategicBets(
  baseline: RevenueBreakdown,
  bets: StrategicBet[],
): RevenueBreakdown {
  // Deep clone
  const modified: RevenueBreakdown = JSON.parse(JSON.stringify(baseline));

  for (const bet of bets) {
    if (!bet.enabled) continue;

    if (bet.category === 'expansion' && bet.metric === 'expansionRate') {
      modified.expansion.expansionRate = bet.improvedValue;
    } else if (bet.category === 'churn' && bet.metric === 'monthlyChurnRate') {
      modified.churn.monthlyChurnRate = bet.improvedValue;
    } else if (bet.category === 'newBusiness' || bet.category === 'newProduct') {
      const cat = bet.category === 'newBusiness' ? modified.newBusiness : modified.newProduct;
      if (bet.channel === 'inbound') {
        (cat.inbound as unknown as Record<string, number>)[bet.metric] = bet.improvedValue;
      } else if (bet.channel === 'outbound') {
        (cat.outbound as unknown as Record<string, number>)[bet.metric] = bet.improvedValue;
      } else {
        // Apply to both channels if no specific channel
        if (bet.metric in cat.inbound) {
          (cat.inbound as unknown as Record<string, number>)[bet.metric] = bet.improvedValue;
        }
        if (bet.metric in cat.outbound) {
          (cat.outbound as unknown as Record<string, number>)[bet.metric] = bet.improvedValue;
        }
      }
    }
  }

  return modified;
}

// ── Channel config application ───────────────────────────────

const ZERO_INBOUND: InboundFunnelInputs = { hisMonthly: 0, hisToPipelineRate: 0, winRate: 0, acv: 0, salesCycleMonths: 0 };
const ZERO_OUTBOUND: OutboundFunnelInputs = { pipelineMonthly: 0, winRate: 0, acv: 0, salesCycleMonths: 0 };

export function applyChannelConfig(
  inputs: RevenueBreakdown,
  config: ChannelConfig,
  mode: 'targets' | 'historical',
): RevenueBreakdown {
  const modified: RevenueBreakdown = JSON.parse(JSON.stringify(inputs));

  if (mode === 'targets') {
    if (!config.hasInbound) {
      modified.newBusiness.inbound = { ...ZERO_INBOUND };
    }
    if (!config.hasOutbound) {
      modified.newBusiness.outbound = { ...ZERO_OUTBOUND };
    }
    if (!config.hasNewProduct) {
      modified.newProduct.inbound = { ...ZERO_INBOUND };
      modified.newProduct.outbound = { ...ZERO_OUTBOUND };
    }
  } else {
    // historical mode: zero out based on history toggles
    if (!config.hasInboundHistory) {
      modified.newBusiness.inbound = { ...ZERO_INBOUND };
    }
    if (!config.hasOutboundHistory) {
      modified.newBusiness.outbound = { ...ZERO_OUTBOUND };
    }
    if (!config.hasNewProductHistory) {
      modified.newProduct.inbound = { ...ZERO_INBOUND };
      modified.newProduct.outbound = { ...ZERO_OUTBOUND };
    }
  }

  return modified;
}

// ── Convenience: full model run ───────────────────────────────

export interface ModelRun {
  monthly: MonthlyResult[];
  quarterly: QuarterlyResult[];
  endingARR: number;
  totalNewARRAdded: number;
}

export function runModel(
  inputs: RevenueBreakdown,
  seasonality: SeasonalityWeights,
  ramp: RampConfig,
  startingARR: number,
  existingPipeline: ExistingPipeline,
): ModelRun {
  const monthly = calculateMonthlyRevenue(inputs, seasonality, ramp, startingARR, existingPipeline);
  const quarterly = rollUpToQuarters(monthly);
  return {
    monthly,
    quarterly,
    endingARR: monthly[11].cumulativeARR,
    totalNewARRAdded: monthly.reduce((s, m) => s + m.totalNewARR, 0),
  };
}

