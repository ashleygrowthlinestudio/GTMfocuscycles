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
  MarketInsight,
  Month,
  Quarter,
  InboundFunnelInputs,
  OutboundFunnelInputs,
  MonthlyActuals,
  ChannelMix,
  PipelineDeadline,
  PipelineChannel,
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
  const expansionPipeline: number[] = [];

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

    // New product: pipeline-based (same as outbound), not HIS-based
    const npIbPipeline = calcOutboundPipeline(
      { pipelineMonthly: inputs.newProduct.inbound.hisMonthly * inputs.newProduct.inbound.hisToPipelineRate * inputs.newProduct.inbound.acv || 0, winRate: inputs.newProduct.inbound.winRate, acv: inputs.newProduct.inbound.acv, salesCycleMonths: inputs.newProduct.inbound.salesCycleMonths },
      seasonWeight, rampMult,
    );
    inboundNewProdPipeline[i] = npIbPipeline;
    const npIbHis = 0; // NP no longer tracks HIS

    const npObPipeline = calcOutboundPipeline(inputs.newProduct.outbound, seasonWeight, rampMult);
    outboundNewProdPipeline[i] = npObPipeline;

    // Expansion pipeline creation (guard against legacy data missing funnel fields)
    const safeExpansion: OutboundFunnelInputs = {
      pipelineMonthly: inputs.expansion.pipelineMonthly ?? 0,
      winRate: inputs.expansion.winRate ?? 0,
      acv: inputs.expansion.acv ?? 0,
      salesCycleMonths: inputs.expansion.salesCycleMonths ?? 0,
    };
    const expPipe = calcOutboundPipeline(safeExpansion, seasonWeight, rampMult);
    expansionPipeline[i] = expPipe;

    // ── Closed Won (waterfall from pipeline created N months ago) ──
    const ibCycleIdx = i - Math.round(inputs.newBusiness.inbound.salesCycleMonths);
    const obCycleIdx = i - Math.round(inputs.newBusiness.outbound.salesCycleMonths);
    const npIbCycleIdx = i - Math.round(inputs.newProduct.inbound.salesCycleMonths);
    const npObCycleIdx = i - Math.round(inputs.newProduct.outbound.salesCycleMonths);
    const expCycleIdx = i - Math.round(safeExpansion.salesCycleMonths);

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

    // ── Expansion (pipeline waterfall) & Churn ──
    const expansionRevenue = expCycleIdx >= 0 ? expansionPipeline[expCycleIdx] * safeExpansion.winRate : 0;
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
      newProductInboundPipelineCreated: npIbPipeline,
      newProductOutboundPipelineCreated: npObPipeline,
      hisRequired: ib.his,
      newProductHisRequired: npIbHis,
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

/** Calculate the interpolated bet value for a given month based on ramp schedule */
export function getBetValueForMonth(bet: StrategicBet, month: number): number {
  const startMonth = bet.startMonth ?? 1;
  const rampMonths = bet.rampMonths ?? 3;
  if (month < startMonth) return bet.currentValue;
  if (rampMonths <= 0 || month >= startMonth + rampMonths) return bet.improvedValue;
  const progress = (month - startMonth) / rampMonths;
  return bet.currentValue + (bet.improvedValue - bet.currentValue) * progress;
}

/** Calculate the ramp percentage (0-1) for a given month */
export function getBetRampPct(bet: StrategicBet, month: number): number {
  const startMonth = bet.startMonth ?? 1;
  const rampMonths = bet.rampMonths ?? 3;
  if (month < startMonth) return 0;
  if (rampMonths <= 0 || month >= startMonth + rampMonths) return 1;
  return (month - startMonth) / rampMonths;
}

/**
 * Apply strategic bets to a baseline RevenueBreakdown for a specific month.
 * Uses linear interpolation based on each bet's startMonth and rampMonths.
 */
export function applyStrategicBetsForMonth(
  baseline: RevenueBreakdown,
  bets: StrategicBet[],
  month: number,
): RevenueBreakdown {
  const modified: RevenueBreakdown = JSON.parse(JSON.stringify(baseline));

  for (const bet of bets) {
    if (!bet.enabled) continue;

    const effectiveValue = getBetValueForMonth(bet, month);

    if (bet.category === 'revenueMix') {
      const scale = bet.currentValue > 0 ? effectiveValue / bet.currentValue : 1;
      switch (bet.metric) {
        case 'inboundMixPct':
          modified.newBusiness.inbound.hisMonthly *= scale;
          break;
        case 'outboundMixPct':
          modified.newBusiness.outbound.pipelineMonthly *= scale;
          break;
        case 'newProductInboundMixPct':
          modified.newProduct.inbound.hisMonthly *= scale;
          break;
        case 'newProductOutboundMixPct':
          modified.newProduct.outbound.pipelineMonthly *= scale;
          break;
        case 'expansionMixPct':
          modified.expansion.pipelineMonthly *= scale;
          break;
        case 'churnMixPct':
          modified.churn.monthlyChurnRate *= scale;
          break;
      }
      continue;
    }

    if (bet.category === 'expansion') {
      (modified.expansion as unknown as Record<string, number>)[bet.metric] = effectiveValue;
    } else if (bet.category === 'churn' && bet.metric === 'monthlyChurnRate') {
      modified.churn.monthlyChurnRate = effectiveValue;
    } else if (bet.category === 'newBusiness' || bet.category === 'newProduct') {
      const cat = bet.category === 'newBusiness' ? modified.newBusiness : modified.newProduct;
      if (bet.channel === 'inbound') {
        (cat.inbound as unknown as Record<string, number>)[bet.metric] = effectiveValue;
      } else if (bet.channel === 'outbound') {
        (cat.outbound as unknown as Record<string, number>)[bet.metric] = effectiveValue;
      } else {
        if (bet.metric in cat.inbound) {
          (cat.inbound as unknown as Record<string, number>)[bet.metric] = effectiveValue;
        }
        if (bet.metric in cat.outbound) {
          (cat.outbound as unknown as Record<string, number>)[bet.metric] = effectiveValue;
        }
      }
    }
  }

  return modified;
}

/**
 * Legacy flat apply — uses fully-ramped bet values for all months.
 * Kept for backward compatibility (e.g. contexts where month doesn't matter).
 */
export function applyStrategicBets(
  baseline: RevenueBreakdown,
  bets: StrategicBet[],
): RevenueBreakdown {
  // Use month 12 to get fully-ramped values (backward compat)
  return applyStrategicBetsForMonth(baseline, bets, 12);
}

/**
 * Run the model with per-month strategic bet ramping.
 * For each month, applies the interpolated bet values to the baseline,
 * then calculates pipeline/revenue for that month.
 */
export function runModelWithBets(
  baseline: RevenueBreakdown,
  bets: StrategicBet[],
  seasonality: SeasonalityWeights,
  ramp: RampConfig,
  startingARR: number,
  existingPipeline: ExistingPipeline,
): ModelRun {
  const results: MonthlyResult[] = [];

  const inboundCorePipeline: number[] = [];
  const outboundCorePipeline: number[] = [];
  const inboundNewProdPipeline: number[] = [];
  const outboundNewProdPipeline: number[] = [];
  const expansionPipelineBets: number[] = [];

  // Pre-compute per-month inputs
  const monthlyInputs: RevenueBreakdown[] = [];
  for (let i = 0; i < 12; i++) {
    monthlyInputs[i] = applyStrategicBetsForMonth(baseline, bets, i + 1);
  }

  let currentARR = startingARR;

  for (let i = 0; i < 12; i++) {
    const month = (i + 1) as Month;
    const inputs = monthlyInputs[i];
    const seasonWeight = getSeasonalityWeight(month, seasonality);
    const rampMult = getRampMultiplier(month, ramp);

    // Pipeline creation uses this month's inputs
    const ib = calcInboundPipeline(inputs.newBusiness.inbound, seasonWeight, rampMult);
    inboundCorePipeline[i] = ib.pipeline;

    const obPipeline = calcOutboundPipeline(inputs.newBusiness.outbound, seasonWeight, rampMult);
    outboundCorePipeline[i] = obPipeline;

    // New product: pipeline-based (same as outbound), not HIS-based
    const npIbPipelineBets = calcOutboundPipeline(
      { pipelineMonthly: inputs.newProduct.inbound.hisMonthly * inputs.newProduct.inbound.hisToPipelineRate * inputs.newProduct.inbound.acv || 0, winRate: inputs.newProduct.inbound.winRate, acv: inputs.newProduct.inbound.acv, salesCycleMonths: inputs.newProduct.inbound.salesCycleMonths },
      seasonWeight, rampMult,
    );
    inboundNewProdPipeline[i] = npIbPipelineBets;

    const npObPipeline = calcOutboundPipeline(inputs.newProduct.outbound, seasonWeight, rampMult);
    outboundNewProdPipeline[i] = npObPipeline;

    // Expansion pipeline (guard against legacy data)
    const safeExpBets: OutboundFunnelInputs = {
      pipelineMonthly: inputs.expansion.pipelineMonthly ?? 0,
      winRate: inputs.expansion.winRate ?? 0,
      acv: inputs.expansion.acv ?? 0,
      salesCycleMonths: inputs.expansion.salesCycleMonths ?? 0,
    };
    const expPipeBets = calcOutboundPipeline(safeExpBets, seasonWeight, rampMult);
    expansionPipelineBets[i] = expPipeBets;

    // Closed Won uses the closing month's win rate but pipeline from creation month
    const ibCycleIdx = i - Math.round(inputs.newBusiness.inbound.salesCycleMonths);
    const obCycleIdx = i - Math.round(inputs.newBusiness.outbound.salesCycleMonths);
    const npIbCycleIdx = i - Math.round(inputs.newProduct.inbound.salesCycleMonths);
    const npObCycleIdx = i - Math.round(inputs.newProduct.outbound.salesCycleMonths);
    const expCycleIdxBets = i - Math.round(safeExpBets.salesCycleMonths);

    let inboundClosedWon = 0;
    let outboundClosedWon = 0;
    let npInboundClosedWon = 0;
    let npOutboundClosedWon = 0;

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

    if (month === existingPipeline.expectedCloseMonth) {
      inboundClosedWon += existingPipeline.inboundCore * existingPipeline.winRate;
      outboundClosedWon += existingPipeline.outboundCore * existingPipeline.winRate;
      npInboundClosedWon += existingPipeline.inboundNewProduct * existingPipeline.winRate;
      npOutboundClosedWon += existingPipeline.outboundNewProduct * existingPipeline.winRate;
    }

    const ibAcv = inputs.newBusiness.inbound.acv || 1;
    const obAcv = inputs.newBusiness.outbound.acv || 1;
    const npIbAcv = inputs.newProduct.inbound.acv || 1;
    const npObAcv = inputs.newProduct.outbound.acv || 1;

    const inboundDeals = inboundClosedWon / ibAcv;
    const outboundDeals = outboundClosedWon / obAcv;
    const npInboundDeals = npInboundClosedWon / npIbAcv;
    const npOutboundDeals = npOutboundClosedWon / npObAcv;

    const expansionRevenue = expCycleIdxBets >= 0 ? expansionPipelineBets[expCycleIdxBets] * safeExpBets.winRate : 0;
    const churnRevenue = -(currentARR * inputs.churn.monthlyChurnRate);

    const totalNewARR =
      inboundClosedWon + outboundClosedWon +
      npInboundClosedWon + npOutboundClosedWon +
      expansionRevenue + churnRevenue;

    currentARR += totalNewARR;

    results.push({
      month,
      inboundPipelineCreated: ib.pipeline,
      outboundPipelineCreated: obPipeline,
      newProductInboundPipelineCreated: npIbPipelineBets,
      newProductOutboundPipelineCreated: npObPipeline,
      hisRequired: ib.his,
      newProductHisRequired: 0,
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

  const quarterly = rollUpToQuarters(results);
  return {
    monthly: results,
    quarterly,
    endingARR: results[11].cumulativeARR,
    totalNewARRAdded: results.reduce((s, m) => s + m.totalNewARR, 0),
  };
}

// ── Channel mix calculation ──────────────────────────────────

export function computeChannelMix(model: ModelRun): ChannelMix {
  const m = model.monthly;
  const ibCW = m.reduce((s, r) => s + r.inboundClosedWon, 0);
  const obCW = m.reduce((s, r) => s + r.outboundClosedWon, 0);
  const npIbCW = m.reduce((s, r) => s + r.newProductInboundClosedWon, 0);
  const npObCW = m.reduce((s, r) => s + r.newProductOutboundClosedWon, 0);
  const expRev = m.reduce((s, r) => s + r.expansionRevenue, 0);
  const churnRev = m.reduce((s, r) => s + Math.abs(r.churnRevenue), 0);

  const total = ibCW + obCW + npIbCW + npObCW + expRev + churnRev;
  if (total === 0) {
    return { inbound: 0, outbound: 0, newProductInbound: 0, newProductOutbound: 0, expansion: 0, churn: 0 };
  }

  return {
    inbound: ibCW / total,
    outbound: obCW / total,
    newProductInbound: npIbCW / total,
    newProductOutbound: npObCW / total,
    expansion: expRev / total,
    churn: churnRev / total,
  };
}

// ── Pipeline deadline calculation ─────────────────────────────

export function calculatePipelineDeadlines(
  monthly: MonthlyResult[],
  targets: RevenueBreakdown,
  currentMonth: number,
): PipelineDeadline[] {
  const deadlines: PipelineDeadline[] = [];

  const channels: {
    channel: PipelineChannel;
    salesCycle: number;
    getClosedWon: (m: MonthlyResult) => number;
    getPipeline: (m: MonthlyResult) => number;
    isInbound: boolean;
    hisRate?: number;
  }[] = [
    {
      channel: 'inbound',
      salesCycle: targets.newBusiness.inbound.salesCycleMonths,
      getClosedWon: (m) => m.inboundClosedWon,
      getPipeline: (m) => m.inboundPipelineCreated,
      isInbound: true,
      hisRate: targets.newBusiness.inbound.hisToPipelineRate,
    },
    {
      channel: 'outbound',
      salesCycle: targets.newBusiness.outbound.salesCycleMonths,
      getClosedWon: (m) => m.outboundClosedWon,
      getPipeline: (m) => m.outboundPipelineCreated,
      isInbound: false,
    },
    {
      channel: 'newProductInbound',
      salesCycle: targets.newProduct.inbound.salesCycleMonths,
      getClosedWon: (m) => m.newProductInboundClosedWon,
      getPipeline: (m) => m.newProductInboundPipelineCreated,
      isInbound: true,
      hisRate: targets.newProduct.inbound.hisToPipelineRate,
    },
    {
      channel: 'newProductOutbound',
      salesCycle: targets.newProduct.outbound.salesCycleMonths,
      getClosedWon: (m) => m.newProductOutboundClosedWon,
      getPipeline: (m) => m.newProductOutboundPipelineCreated,
      isInbound: false,
    },
  ];

  for (const ch of channels) {
    if (ch.salesCycle <= 0) continue;

    for (const m of monthly) {
      const closedWon = ch.getClosedWon(m);
      if (closedWon <= 0) continue;

      const pipelineMonth = m.month - Math.round(ch.salesCycle);
      const pipelineAmt = pipelineMonth >= 1 && pipelineMonth <= 12
        ? ch.getPipeline(monthly[pipelineMonth - 1])
        : closedWon; // estimate if outside range

      const dl: PipelineDeadline = {
        closingMonth: m.month,
        channel: ch.channel,
        pipelineNeededBy: pipelineMonth,
        pipelineAmount: pipelineAmt,
        closedWonAmount: closedWon,
        isUrgent: pipelineMonth <= currentMonth,
      };

      if (ch.isInbound && ch.hisRate && ch.hisRate > 0) {
        const hisMonth = pipelineMonth - 1; // HIS needs to happen before pipeline conversion
        dl.hisNeededBy = hisMonth;
        dl.hisAmount = ch.hisRate > 0 ? pipelineAmt / (ch.hisRate * (targets.newBusiness.inbound.acv || 1)) : 0;
      }

      deadlines.push(dl);
    }
  }

  return deadlines;
}

// ── Pipeline timing map for inline indicators ────────────────

export type PipelineTimingStatus = 'green' | 'amber' | 'red';

export interface PipelineTimingEntry {
  tooltip: string;
  status: PipelineTimingStatus;
}

// Map: pipeline row label → month → timing info
export type PipelineTimingMap = Record<string, Record<number, PipelineTimingEntry>>;

const MONTH_NAMES_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildPipelineTimingMap(
  targets: RevenueBreakdown,
  currentMonth: number,
): PipelineTimingMap {
  const map: PipelineTimingMap = {};

  const channels: {
    label: string;
    salesCycle: number;
  }[] = [
    { label: 'Inbound Qualified Pipeline $', salesCycle: targets.newBusiness.inbound.salesCycleMonths },
    { label: 'Outbound Qualified Pipeline $', salesCycle: targets.newBusiness.outbound.salesCycleMonths },
    { label: 'NP Inbound Qualified Pipeline $', salesCycle: targets.newProduct.inbound.salesCycleMonths },
    { label: 'NP Outbound Qualified Pipeline $', salesCycle: targets.newProduct.outbound.salesCycleMonths },
  ];

  for (const ch of channels) {
    if (ch.salesCycle <= 0) continue;
    const entries: Record<number, PipelineTimingEntry> = {};

    for (let m = 1; m <= 12; m++) {
      const closesIn = m + Math.round(ch.salesCycle);
      const closesName = closesIn <= 12 ? MONTH_NAMES_FULL[closesIn - 1] : `Month ${closesIn}`;

      let status: PipelineTimingStatus;
      if (m < currentMonth) {
        status = 'red'; // past deadline
      } else if (m === currentMonth) {
        status = 'amber'; // current month
      } else {
        status = 'green'; // future
      }

      const trackText = status === 'green' ? 'On track' : status === 'amber' ? 'Due now' : `${currentMonth - m} mo behind`;
      entries[m] = {
        tooltip: `Feeds closed won in ${closesName}. ${trackText}.`,
        status,
      };
    }

    map[ch.label] = entries;
  }

  return map;
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

  // Ensure newProduct exists (backfill for old plans)
  if (!modified.newProduct) {
    modified.newProduct = { inbound: { ...ZERO_INBOUND }, outbound: { ...ZERO_OUTBOUND } };
  }

  if (mode === 'targets') {
    if (!config.hasInbound && !config.hasEmergingInbound) {
      modified.newBusiness.inbound = { ...ZERO_INBOUND };
    }
    if (!config.hasOutbound && !config.hasEmergingOutbound) {
      modified.newBusiness.outbound = { ...ZERO_OUTBOUND };
    }
    if (!config.hasNewProduct && !config.hasEmergingNewProduct) {
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

  // Emerging channels: in historical mode, zero out so no baseline is used
  if (mode === 'historical') {
    if (config.hasEmergingInbound) {
      modified.newBusiness.inbound = { ...ZERO_INBOUND };
    }
    if (config.hasEmergingOutbound) {
      modified.newBusiness.outbound = { ...ZERO_OUTBOUND };
    }
    if (config.hasEmergingNewProduct) {
      modified.newProduct.inbound = { ...ZERO_INBOUND };
      modified.newProduct.outbound = { ...ZERO_OUTBOUND };
    }
  }

  // Expansion/churn toggles apply in both modes
  if (!config.hasExpansion) {
    modified.expansion = { pipelineMonthly: 0, winRate: 0, acv: 0, salesCycleMonths: 0 };
  }
  if (!config.hasChurn) {
    modified.churn.monthlyChurnRate = 0;
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

// ── Top-down model (allocation-driven) ───────────────────────

export interface ChannelDollarTargets {
  inbound: number;
  outbound: number;
  expansion: number;
  newProduct: number;
  emergingInbound: number;
  emergingOutbound: number;
  emergingNewProduct: number;
}

/**
 * Top-down model: takes ANNUAL closed-won dollar targets per channel
 * (derived from target allocation %) and back-calculates the funnel
 * metrics (pipeline, HIS, deals) needed each month using the supplied
 * conversion rates and seasonality weights.
 *
 * Unlike runModel (bottom-up), this does NOT apply a pipeline waterfall
 * delay — it shows what is NEEDED each month to hit the revenue target.
 */
export function runTopDownModel(
  channelTargets: ChannelDollarTargets,
  rates: RevenueBreakdown,
  seasonality: SeasonalityWeights,
  startingARR: number,
  existingPipeline: ExistingPipeline,
): ModelRun {
  // Combine emerging into core channels for MonthlyResult shape
  const annualIbCW = (channelTargets.inbound || 0) + (channelTargets.emergingInbound || 0);
  const annualObCW = (channelTargets.outbound || 0) + (channelTargets.emergingOutbound || 0);
  const annualExpRev = channelTargets.expansion || 0;
  const annualNpCW = (channelTargets.newProduct || 0) + (channelTargets.emergingNewProduct || 0);

  // Seasonality normalisation — each month's share of the annual total
  const weights: number[] = [];
  let totalWeight = 0;
  for (let i = 0; i < 12; i++) {
    const w = getSeasonalityWeight((i + 1) as Month, seasonality);
    weights.push(w);
    totalWeight += w;
  }
  if (totalWeight <= 0) totalWeight = 12; // fallback — flat

  // Safe rate accessors (avoid division by zero)
  const ibWR = rates.newBusiness.inbound.winRate || 0;
  const ibH2P = rates.newBusiness.inbound.hisToPipelineRate || 0;
  const ibAcv = rates.newBusiness.inbound.acv || 1;
  const obWR = rates.newBusiness.outbound.winRate || 0;
  const obAcv = rates.newBusiness.outbound.acv || 1;
  const npIbWR = rates.newProduct.inbound.winRate || 0;
  const npIbAcv = rates.newProduct.inbound.acv || 1;
  const expWR = rates.expansion.winRate || 0;
  const expAcv = rates.expansion.acv || 1;
  const churnRate = rates.churn.monthlyChurnRate || 0;

  const results: MonthlyResult[] = [];
  let currentARR = startingARR;

  for (let i = 0; i < 12; i++) {
    const month = (i + 1) as Month;
    const monthFrac = weights[i] / totalWeight;

    // ── Closed Won targets for this month ──
    let ibCW = annualIbCW * monthFrac;
    let obCW = annualObCW * monthFrac;
    const npIbCW = annualNpCW * monthFrac;
    const expRev = annualExpRev * monthFrac;

    // Existing pipeline closes in its expected month
    if (month === existingPipeline.expectedCloseMonth) {
      ibCW += (existingPipeline.inboundCore || 0) * (existingPipeline.winRate || 0);
      obCW += (existingPipeline.outboundCore || 0) * (existingPipeline.winRate || 0);
    }

    // ── Back-calculate pipeline needed ──
    const ibPipeline = ibWR > 0 ? ibCW / ibWR : 0;
    const obPipeline = obWR > 0 ? obCW / obWR : 0;
    const npIbPipeline = npIbWR > 0 ? npIbCW / npIbWR : 0;
    const expPipeline = expWR > 0 ? expRev / expWR : 0;

    // ── Back-calculate HIS needed (inbound only) ──
    const hisRequired = (ibH2P > 0 && ibAcv > 0) ? ibPipeline / (ibH2P * ibAcv) : 0;

    // ── Deals ──
    const ibDeals = ibAcv > 0 ? ibCW / ibAcv : 0;
    const obDeals = obAcv > 0 ? obCW / obAcv : 0;
    const npIbDeals = npIbAcv > 0 ? npIbCW / npIbAcv : 0;

    // ── Churn ── (rate-based, not target-allocated)
    const churnRevenue = -(currentARR * churnRate);

    // ── Totals ──
    const totalNewARR = ibCW + obCW + npIbCW + expRev + churnRevenue;
    currentARR += totalNewARR;

    results.push({
      month,
      inboundPipelineCreated: ibPipeline,
      outboundPipelineCreated: obPipeline,
      newProductInboundPipelineCreated: npIbPipeline,
      newProductOutboundPipelineCreated: 0,
      hisRequired,
      newProductHisRequired: 0,
      inboundClosedWon: ibCW,
      outboundClosedWon: obCW,
      newProductInboundClosedWon: npIbCW,
      newProductOutboundClosedWon: 0,
      expansionRevenue: expRev,
      churnRevenue,
      totalNewARR,
      cumulativeARR: currentARR,
      inboundDeals: ibDeals,
      outboundDeals: obDeals,
      newProductInboundDeals: npIbDeals,
      newProductOutboundDeals: 0,
    });
  }

  const quarterly = rollUpToQuarters(results);
  return {
    monthly: results,
    quarterly,
    endingARR: results[11]?.cumulativeARR ?? startingARR,
    totalNewARRAdded: results.reduce((s, m) => s + m.totalNewARR, 0),
  };
}

// ── Cap model at target ARR ──────────────────────────────────

export function capModelAtTarget(model: ModelRun, targetARR: number, startingARR: number): ModelRun {
  const neededNewARR = targetARR - startingARR;
  const uncappedTotal = model.monthly.reduce((s, m) => s + m.totalNewARR, 0);

  // If target is at or below starting ARR, or model undershoots, pass through as-is
  if (neededNewARR <= 0 || uncappedTotal <= 0 || uncappedTotal <= neededNewARR) {
    return model;
  }

  // Scale every month proportionally so cumulative new ARR = neededNewARR
  const scale = neededNewARR / uncappedTotal;
  const capped: MonthlyResult[] = [];
  let runningARR = startingARR;

  for (const m of model.monthly) {
    const ratio = scale;
    const scaledNewARR = m.totalNewARR * ratio;
    runningARR += scaledNewARR;

    capped.push({
      ...m,
      inboundClosedWon: m.inboundClosedWon * ratio,
      outboundClosedWon: m.outboundClosedWon * ratio,
      newProductInboundClosedWon: m.newProductInboundClosedWon * ratio,
      newProductOutboundClosedWon: m.newProductOutboundClosedWon * ratio,
      expansionRevenue: m.expansionRevenue * ratio,
      churnRevenue: m.churnRevenue * ratio,
      totalNewARR: scaledNewARR,
      cumulativeARR: runningARR,
      inboundDeals: m.inboundDeals * ratio,
      outboundDeals: m.outboundDeals * ratio,
      newProductInboundDeals: m.newProductInboundDeals * ratio,
      newProductOutboundDeals: m.newProductOutboundDeals * ratio,
    });
  }

  const quarterly = rollUpToQuarters(capped);
  return {
    monthly: capped,
    quarterly,
    endingARR: capped[11].cumulativeARR,
    totalNewARRAdded: capped.reduce((s, m) => s + m.totalNewARR, 0),
  };
}

// ── Run model with actuals for in-year reforecast ────────────

function averageActualField(actuals: MonthlyActuals[], field: keyof MonthlyActuals): number {
  const values = actuals.map((a) => a[field] as number).filter((v) => v > 0);
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function runModelWithActuals(
  inputs: RevenueBreakdown,
  seasonality: SeasonalityWeights,
  ramp: RampConfig,
  startingARR: number,
  existingPipeline: ExistingPipeline,
  actuals: MonthlyActuals[],
  currentMonth: Month,
): ModelRun {
  const actualsByMonth = new Map<number, MonthlyActuals>();
  for (const a of actuals) actualsByMonth.set(a.month, a);

  // Recalibrate rates from actuals averages (skip zeros)
  const avgIbWinRate = averageActualField(actuals, 'inboundWinRate');
  const avgObWinRate = averageActualField(actuals, 'outboundWinRate');
  const avgHisToPipe = averageActualField(actuals, 'hisToPipelineRate');
  const avgIbAcv = averageActualField(actuals, 'inboundACV');
  const avgObAcv = averageActualField(actuals, 'outboundACV');

  // Build recalibrated inputs for future months
  const recal: RevenueBreakdown = JSON.parse(JSON.stringify(inputs));
  if (avgIbWinRate > 0) recal.newBusiness.inbound.winRate = avgIbWinRate;
  if (avgObWinRate > 0) recal.newBusiness.outbound.winRate = avgObWinRate;
  if (avgHisToPipe > 0) recal.newBusiness.inbound.hisToPipelineRate = avgHisToPipe;
  if (avgIbAcv > 0) recal.newBusiness.inbound.acv = avgIbAcv;
  if (avgObAcv > 0) recal.newBusiness.outbound.acv = avgObAcv;

  // Step 1: Run the full projected model with recalibrated rates.
  // This gives us fallback values for any actual field the user left at 0.
  const projected = calculateMonthlyRevenue(recal, seasonality, ramp, startingARR, existingPipeline);

  // Step 2: Build pipeline arrays and results month-by-month.
  // For completed months with actuals: use non-zero actual values, fall back
  // to projected values for fields left at 0. This prevents $0 when the user
  // only fills in some fields (e.g. closed won but not pipeline or expansion).
  const ibCorePipe: number[] = [];
  const obCorePipe: number[] = [];
  const ibNewProdPipe: number[] = [];
  const obNewProdPipe: number[] = [];
  const expPipe: number[] = [];

  const results: MonthlyResult[] = [];
  let currentARR = startingARR;

  for (let i = 0; i < 12; i++) {
    const month = (i + 1) as Month;
    const actual = actualsByMonth.get(month);
    const p = projected[i]; // projected fallback for this month
    const isCompleted = month < currentMonth;

    if (isCompleted && actual) {
      // ── Completed month with actuals: blend actual (non-zero) with projected (fallback) ──
      // Helper: use actual value if user entered it (non-zero), else projected fallback
      const or = (act: number, proj: number) => act !== 0 ? act : proj;

      const ibPipe = or(actual.inboundPipelineCreated, p.inboundPipelineCreated);
      const obPipe = or(actual.outboundPipelineCreated, p.outboundPipelineCreated);

      // Store pipeline for waterfall into future months
      ibCorePipe[i] = ibPipe;
      obCorePipe[i] = obPipe;
      ibNewProdPipe[i] = p.newProductInboundPipelineCreated;
      obNewProdPipe[i] = p.newProductOutboundPipelineCreated;

      const ibCW = or(actual.inboundClosedWon, p.inboundClosedWon);
      const obCW = or(actual.outboundClosedWon, p.outboundClosedWon);
      const npIbCW = or(actual.newProductInboundClosedWon, p.newProductInboundClosedWon);
      const npObCW = or(actual.newProductOutboundClosedWon, p.newProductOutboundClosedWon);
      const exp = or(actual.expansionRevenue, p.expansionRevenue);
      const churn = or(actual.churnRevenue, p.churnRevenue);

      const totalNewARR = ibCW + obCW + npIbCW + npObCW + exp + churn;
      currentARR += totalNewARR;

      const ibAcv = actual.inboundACV || inputs.newBusiness.inbound.acv || 1;
      const obAcv = actual.outboundACV || inputs.newBusiness.outbound.acv || 1;
      const npIbAcv = recal.newProduct.inbound.acv || 1;
      const npObAcv = recal.newProduct.outbound.acv || 1;

      results.push({
        month,
        inboundPipelineCreated: ibPipe,
        outboundPipelineCreated: obPipe,
        newProductInboundPipelineCreated: p.newProductInboundPipelineCreated,
        newProductOutboundPipelineCreated: p.newProductOutboundPipelineCreated,
        hisRequired: actual.hisVolume > 0
          ? actual.hisVolume
          : or(
              actual.hisToPipelineRate > 0 && ibAcv > 0
                ? actual.inboundPipelineCreated / (actual.hisToPipelineRate * ibAcv)
                : 0,
              p.hisRequired,
            ),
        newProductHisRequired: p.newProductHisRequired,
        inboundClosedWon: ibCW,
        outboundClosedWon: obCW,
        newProductInboundClosedWon: npIbCW,
        newProductOutboundClosedWon: npObCW,
        expansionRevenue: exp,
        churnRevenue: churn,
        totalNewARR,
        cumulativeARR: currentARR,
        inboundDeals: ibAcv > 0 ? ibCW / ibAcv : 0,
        outboundDeals: obAcv > 0 ? obCW / obAcv : 0,
        newProductInboundDeals: npIbAcv > 0 ? npIbCW / npIbAcv : 0,
        newProductOutboundDeals: npObAcv > 0 ? npObCW / npObAcv : 0,
      });
    } else if (isCompleted) {
      // ── Completed month WITHOUT actuals entry: use projected, track ARR ──
      ibCorePipe[i] = p.inboundPipelineCreated;
      obCorePipe[i] = p.outboundPipelineCreated;
      ibNewProdPipe[i] = p.newProductInboundPipelineCreated;
      obNewProdPipe[i] = p.newProductOutboundPipelineCreated;

      currentARR += p.totalNewARR;
      results.push({ ...p, cumulativeARR: currentARR });
    } else {
      // ── Future month: compute from recalibrated rates with rebased ARR ──
      const seasonWeight = getSeasonalityWeight(month, seasonality);
      const rampMult = getRampMultiplier(month, ramp);

      // Pipeline creation
      const ib = calcInboundPipeline(recal.newBusiness.inbound, seasonWeight, rampMult);
      ibCorePipe[i] = ib.pipeline;
      const obPipeline = calcOutboundPipeline(recal.newBusiness.outbound, seasonWeight, rampMult);
      obCorePipe[i] = obPipeline;
      // New product: pipeline-based (same as outbound), not HIS-based
      const npIbPipelineActuals = calcOutboundPipeline(
        { pipelineMonthly: recal.newProduct.inbound.hisMonthly * recal.newProduct.inbound.hisToPipelineRate * recal.newProduct.inbound.acv || 0, winRate: recal.newProduct.inbound.winRate, acv: recal.newProduct.inbound.acv, salesCycleMonths: recal.newProduct.inbound.salesCycleMonths },
        seasonWeight, rampMult,
      );
      ibNewProdPipe[i] = npIbPipelineActuals;
      const npObPipeline = calcOutboundPipeline(recal.newProduct.outbound, seasonWeight, rampMult);
      obNewProdPipe[i] = npObPipeline;

      // Closed Won from waterfall (pipeline created N months ago × win rate)
      const ibCycleIdx = i - Math.round(recal.newBusiness.inbound.salesCycleMonths);
      const obCycleIdx = i - Math.round(recal.newBusiness.outbound.salesCycleMonths);
      const npIbCycleIdx = i - Math.round(recal.newProduct.inbound.salesCycleMonths);
      const npObCycleIdx = i - Math.round(recal.newProduct.outbound.salesCycleMonths);

      let inboundClosedWon = 0;
      let outboundClosedWon = 0;
      let npInboundClosedWon = 0;
      let npOutboundClosedWon = 0;

      if (ibCycleIdx >= 0) inboundClosedWon = ibCorePipe[ibCycleIdx] * recal.newBusiness.inbound.winRate;
      if (obCycleIdx >= 0) outboundClosedWon = obCorePipe[obCycleIdx] * recal.newBusiness.outbound.winRate;
      if (npIbCycleIdx >= 0) npInboundClosedWon = ibNewProdPipe[npIbCycleIdx] * recal.newProduct.inbound.winRate;
      if (npObCycleIdx >= 0) npOutboundClosedWon = obNewProdPipe[npObCycleIdx] * recal.newProduct.outbound.winRate;

      // Pre-existing pipeline closes in its expected month
      if (month === existingPipeline.expectedCloseMonth) {
        inboundClosedWon += existingPipeline.inboundCore * existingPipeline.winRate;
        outboundClosedWon += existingPipeline.outboundCore * existingPipeline.winRate;
        npInboundClosedWon += existingPipeline.inboundNewProduct * existingPipeline.winRate;
        npOutboundClosedWon += existingPipeline.outboundNewProduct * existingPipeline.winRate;
      }

      // Expansion pipeline (guard against legacy data)
      const safeExpActuals: OutboundFunnelInputs = {
        pipelineMonthly: recal.expansion.pipelineMonthly ?? 0,
        winRate: recal.expansion.winRate ?? 0,
        acv: recal.expansion.acv ?? 0,
        salesCycleMonths: recal.expansion.salesCycleMonths ?? 0,
      };
      const expPipeActuals = calcOutboundPipeline(safeExpActuals, seasonWeight, rampMult);
      expPipe[i] = expPipeActuals;
      const expCycleIdxActuals = i - Math.round(safeExpActuals.salesCycleMonths);
      const expansionRevenue = expCycleIdxActuals >= 0 ? expPipe[expCycleIdxActuals] * safeExpActuals.winRate : 0;
      const churnRevenue = -(currentARR * recal.churn.monthlyChurnRate);

      const ibAcv = recal.newBusiness.inbound.acv || 1;
      const obAcv = recal.newBusiness.outbound.acv || 1;
      const npIbAcv = recal.newProduct.inbound.acv || 1;
      const npObAcv = recal.newProduct.outbound.acv || 1;

      const totalNewARR =
        inboundClosedWon + outboundClosedWon +
        npInboundClosedWon + npOutboundClosedWon +
        expansionRevenue + churnRevenue;

      currentARR += totalNewARR;

      results.push({
        month,
        inboundPipelineCreated: ib.pipeline,
        outboundPipelineCreated: obPipeline,
        newProductInboundPipelineCreated: npIbPipelineActuals,
        newProductOutboundPipelineCreated: npObPipeline,
        hisRequired: ib.his,
        newProductHisRequired: 0,
        inboundClosedWon,
        outboundClosedWon,
        newProductInboundClosedWon: npInboundClosedWon,
        newProductOutboundClosedWon: npOutboundClosedWon,
        expansionRevenue,
        churnRevenue,
        totalNewARR,
        cumulativeARR: currentARR,
        inboundDeals: inboundClosedWon / ibAcv,
        outboundDeals: outboundClosedWon / obAcv,
        newProductInboundDeals: npInboundClosedWon / npIbAcv,
        newProductOutboundDeals: npOutboundClosedWon / npObAcv,
      });
    }
  }

  const quarterly = rollUpToQuarters(results);
  return {
    monthly: results,
    quarterly,
    endingARR: results[11].cumulativeARR,
    totalNewARRAdded: results.reduce((s, m) => s + m.totalNewARR, 0),
  };
}

// ── Market Insights ──────────────────────────────────────────

/**
 * Apply market insights to monthly results as post-processing multipliers.
 * One-time: applies impactPct as multiplier (e.g. -0.20 means metric × 0.80) in impactMonth only.
 * Gradual: linearly ramps from 0 to impactPct over impactDurationMonths starting at impactMonth.
 * Returns a new ModelRun with recalculated cumulative ARR and quarterly rollups.
 */
export function applyMarketInsights(
  monthly: MonthlyResult[],
  insights: MarketInsight[],
  startingARR: number,
  currentMonth?: number,
  planningMode?: 'future-year' | 'in-year',
): ModelRun {
  const enabled = insights.filter((i) => i.enabled);
  if (enabled.length === 0) {
    const quarterly = rollUpToQuarters(monthly);
    return { monthly, quarterly, endingARR: monthly[11].cumulativeARR, totalNewARRAdded: monthly.reduce((s, m) => s + m.totalNewARR, 0) };
  }

  const modified = monthly.map((m) => ({ ...m }));

  // Determine which month indices are locked actuals (0-based)
  const actualCutoff = (planningMode === 'in-year' && currentMonth != null) ? currentMonth : 0;

  for (const insight of enabled) {
    for (let i = 0; i < 12; i++) {
      // Skip actual months — market insights only affect projected/future months
      if (i < actualCutoff) continue;

      const month = i + 1;
      let effectPct = 0;

      if (insight.impactType === 'oneTime') {
        if (month === insight.impactMonth) {
          effectPct = insight.impactPct;
        }
      } else {
        // Gradual: linear ramp from impactMonth over impactDurationMonths
        const start = insight.impactMonth;
        const duration = Math.max(1, insight.impactDurationMonths);
        if (month >= start && month < start + duration) {
          const progress = (month - start + 1) / duration;
          effectPct = insight.impactPct * progress;
        } else if (month >= start + duration) {
          effectPct = insight.impactPct;
        }
      }

      if (effectPct === 0) continue;

      const multiplier = 1 + effectPct;
      const m = modified[i];
      const ch = insight.channel;
      const metric = insight.metric;

      if (metric === 'pipeline' || metric === 'overall') {
        if (ch === 'inbound' || ch === 'all') {
          m.inboundPipelineCreated *= multiplier;
          m.hisRequired *= multiplier;
        }
        if (ch === 'outbound' || ch === 'all') {
          m.outboundPipelineCreated *= multiplier;
        }
        if (ch === 'newProduct' || ch === 'all') {
          m.newProductInboundPipelineCreated *= multiplier;
          m.newProductOutboundPipelineCreated *= multiplier;
          m.newProductHisRequired *= multiplier;
        }
      }

      if (metric === 'winRate' || metric === 'overall') {
        if (ch === 'inbound' || ch === 'all') {
          m.inboundClosedWon *= multiplier;
          m.inboundDeals *= multiplier;
        }
        if (ch === 'outbound' || ch === 'all') {
          m.outboundClosedWon *= multiplier;
          m.outboundDeals *= multiplier;
        }
        if (ch === 'newProduct' || ch === 'all') {
          m.newProductInboundClosedWon *= multiplier;
          m.newProductOutboundClosedWon *= multiplier;
          m.newProductInboundDeals *= multiplier;
          m.newProductOutboundDeals *= multiplier;
        }
      }

      if (metric === 'churnRate' || (metric === 'overall' && (ch === 'churn' || ch === 'all'))) {
        m.churnRevenue *= multiplier;
      }

      if (metric === 'hisVolume') {
        if (ch === 'inbound' || ch === 'all') {
          m.hisRequired *= multiplier;
          m.inboundPipelineCreated *= multiplier;
        }
        if (ch === 'newProduct' || ch === 'all') {
          m.newProductHisRequired *= multiplier;
          m.newProductInboundPipelineCreated *= multiplier;
        }
      }

      if (metric === 'acv') {
        if (ch === 'inbound' || ch === 'all') {
          m.inboundClosedWon *= multiplier;
        }
        if (ch === 'outbound' || ch === 'all') {
          m.outboundClosedWon *= multiplier;
        }
        if (ch === 'newProduct' || ch === 'all') {
          m.newProductInboundClosedWon *= multiplier;
          m.newProductOutboundClosedWon *= multiplier;
        }
      }

      if (metric === 'overall' && (ch === 'expansion' || ch === 'all')) {
        m.expansionRevenue *= multiplier;
      }
    }
  }

  // Recalculate totalNewARR and cumulativeARR
  let currentARR = startingARR;
  for (let i = 0; i < 12; i++) {
    const m = modified[i];
    m.totalNewARR =
      m.inboundClosedWon + m.outboundClosedWon +
      m.newProductInboundClosedWon + m.newProductOutboundClosedWon +
      m.expansionRevenue + m.churnRevenue;
    currentARR += m.totalNewARR;
    m.cumulativeARR = currentARR;
  }

  const quarterly = rollUpToQuarters(modified);
  return {
    monthly: modified,
    quarterly,
    endingARR: modified[11].cumulativeARR,
    totalNewARRAdded: modified.reduce((s, m) => s + m.totalNewARR, 0),
  };
}

/**
 * Apply market insights then normalize so total new ARR equals targetARR - startingARR.
 * Used by Revenue Targets tab to redistribute without changing the total.
 */
export function applyMarketInsightsNormalized(
  monthly: MonthlyResult[],
  insights: MarketInsight[],
  startingARR: number,
  targetARR: number,
  currentMonth?: number,
  planningMode?: 'future-year' | 'in-year',
): ModelRun {
  const raw = applyMarketInsights(monthly, insights, startingARR, currentMonth, planningMode);
  const desiredNewARR = targetARR - startingARR;
  const actualNewARR = raw.totalNewARRAdded;

  // If no meaningful new ARR was produced, return as-is (can't normalize zero)
  if (Math.abs(actualNewARR) < 0.01) return raw;

  const scale = desiredNewARR / actualNewARR;
  if (Math.abs(scale - 1) < 0.0001) return raw; // already matches

  // Determine which month indices are locked actuals (0-based)
  const actCutoff = (planningMode === 'in-year' && currentMonth != null) ? currentMonth : 0;

  const normalized = raw.monthly.map((m) => ({ ...m }));
  let curARR = startingARR;
  for (let i = 0; i < normalized.length; i++) {
    const m = normalized[i];
    // Skip actual months — don't rescale locked actuals
    if (i < actCutoff) {
      curARR += m.totalNewARR;
      m.cumulativeARR = curARR;
      continue;
    }
    m.inboundClosedWon *= scale;
    m.outboundClosedWon *= scale;
    m.newProductInboundClosedWon *= scale;
    m.newProductOutboundClosedWon *= scale;
    m.expansionRevenue *= scale;
    m.churnRevenue *= scale;
    m.inboundDeals *= scale;
    m.outboundDeals *= scale;
    m.newProductInboundDeals *= scale;
    m.newProductOutboundDeals *= scale;
    m.inboundPipelineCreated *= scale;
    m.outboundPipelineCreated *= scale;
    m.newProductInboundPipelineCreated *= scale;
    m.newProductOutboundPipelineCreated *= scale;
    m.hisRequired *= scale;
    m.newProductHisRequired *= scale;
    m.totalNewARR =
      m.inboundClosedWon + m.outboundClosedWon +
      m.newProductInboundClosedWon + m.newProductOutboundClosedWon +
      m.expansionRevenue + m.churnRevenue;
    curARR += m.totalNewARR;
    m.cumulativeARR = curARR;
  }

  const quarterly = rollUpToQuarters(normalized);
  return {
    monthly: normalized,
    quarterly,
    endingARR: normalized[11].cumulativeARR,
    totalNewARRAdded: normalized.reduce((s, m) => s + m.totalNewARR, 0),
  };
}

/**
 * Get the list of enabled insights that affect a given month.
 */
export function getInsightsForMonth(insights: MarketInsight[], month: number): MarketInsight[] {
  return insights.filter((i) => {
    if (!i.enabled) return false;
    if (i.impactType === 'oneTime') return month === i.impactMonth;
    const start = i.impactMonth;
    const end = start + Math.max(1, i.impactDurationMonths) - 1;
    return month >= start && month <= end;
  });
}

