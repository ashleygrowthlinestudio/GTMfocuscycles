import type {
  Month,
  Quarter,
  ChannelConfig,
  MonthlyActuals,
  StrategicBet,
  QuarterlyHistoricalData,
} from './types';

// ── Engine-local types ──────────────────────────────────────────

export interface EngineMonthlyResult {
  month: Month;
  inboundClosedWon: number;
  outboundClosedWon: number;
  expansionRevenue: number;
  newProductClosedWon: number;
  churnRevenue: number;
  totalNewARR: number;
  cumulativeARR: number;
  inboundPipelineCreated: number;
  outboundPipelineCreated: number;
  expansionPipelineCreated: number;
  newProductPipelineCreated: number;
  inboundHIS: number;
  inboundDeals: number;
  outboundDeals: number;
  expansionDeals: number;
  newProductDeals: number;
  inboundWinRate: number;
  outboundWinRate: number;
  expansionWinRate: number;
  newProductWinRate: number;
  inboundACV: number;
  outboundACV: number;
  expansionACV: number;
  newProductACV: number;
  inboundSalesCycle: number;
  outboundSalesCycle: number;
  expansionSalesCycle: number;
  newProductSalesCycle: number;
  inboundHisToPipelineRate: number;
}

export interface EngineQuarterlyResult {
  quarter: Quarter;
  months: [EngineMonthlyResult, EngineMonthlyResult, EngineMonthlyResult];
  inboundClosedWon: number;
  outboundClosedWon: number;
  expansionRevenue: number;
  newProductClosedWon: number;
  churnRevenue: number;
  totalNewARR: number;
  endingARR: number;
  inboundPipelineCreated: number;
  outboundPipelineCreated: number;
  expansionPipelineCreated: number;
  newProductPipelineCreated: number;
  inboundHIS: number;
  inboundDeals: number;
  outboundDeals: number;
  expansionDeals: number;
  newProductDeals: number;
}

export interface EngineModelRun {
  monthly: EngineMonthlyResult[];
  quarterly: EngineQuarterlyResult[];
  endingARR: number;
  totalNewARR: number;
}

export interface ActualMonth {
  month: Month;
  inboundClosedWon: number;
  outboundClosedWon: number;
  expansionRevenue: number;
  newProductClosedWon: number;
  churnRevenue: number;
  totalNewARR: number;
  cumulativeARR: number;
  inboundPipelineCreated: number;
  outboundPipelineCreated: number;
  expansionPipelineCreated: number;
  newProductPipelineCreated: number;
  inboundHIS: number;
  inboundDeals: number;
  outboundDeals: number;
  expansionDeals: number;
  newProductDeals: number;
}

export interface TopDownRates {
  inboundWinRate: number;
  inboundACV: number;
  inboundSalesCycle: number;
  inboundHisToPipelineRate: number;
  outboundWinRate: number;
  outboundACV: number;
  outboundSalesCycle: number;
  expansionWinRate: number;
  expansionACV: number;
  expansionSalesCycle: number;
  newProductWinRate: number;
  newProductACV: number;
  newProductSalesCycle: number;
}

// ── Helpers ─────────────────────────────────────────────────────

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0 || isNaN(denominator)) return 0;
  return numerator / denominator;
}

const QUARTER_LABELS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_WEIGHTS = [0.20, 0.23, 0.26, 0.31];

function rollUpToQuarters(monthly: EngineMonthlyResult[]): EngineQuarterlyResult[] {
  const quarters: EngineQuarterlyResult[] = [];
  for (let q = 0; q < 4; q++) {
    const m0 = monthly[q * 3];
    const m1 = monthly[q * 3 + 1];
    const m2 = monthly[q * 3 + 2];
    const ms: [EngineMonthlyResult, EngineMonthlyResult, EngineMonthlyResult] = [m0, m1, m2];
    quarters.push({
      quarter: QUARTER_LABELS[q],
      months: ms,
      inboundClosedWon: m0.inboundClosedWon + m1.inboundClosedWon + m2.inboundClosedWon,
      outboundClosedWon: m0.outboundClosedWon + m1.outboundClosedWon + m2.outboundClosedWon,
      expansionRevenue: m0.expansionRevenue + m1.expansionRevenue + m2.expansionRevenue,
      newProductClosedWon: m0.newProductClosedWon + m1.newProductClosedWon + m2.newProductClosedWon,
      churnRevenue: m0.churnRevenue + m1.churnRevenue + m2.churnRevenue,
      totalNewARR: m0.totalNewARR + m1.totalNewARR + m2.totalNewARR,
      endingARR: m2.cumulativeARR,
      inboundPipelineCreated: m0.inboundPipelineCreated + m1.inboundPipelineCreated + m2.inboundPipelineCreated,
      outboundPipelineCreated: m0.outboundPipelineCreated + m1.outboundPipelineCreated + m2.outboundPipelineCreated,
      expansionPipelineCreated: m0.expansionPipelineCreated + m1.expansionPipelineCreated + m2.expansionPipelineCreated,
      newProductPipelineCreated: m0.newProductPipelineCreated + m1.newProductPipelineCreated + m2.newProductPipelineCreated,
      inboundHIS: m0.inboundHIS + m1.inboundHIS + m2.inboundHIS,
      inboundDeals: m0.inboundDeals + m1.inboundDeals + m2.inboundDeals,
      outboundDeals: m0.outboundDeals + m1.outboundDeals + m2.outboundDeals,
      expansionDeals: m0.expansionDeals + m1.expansionDeals + m2.expansionDeals,
      newProductDeals: m0.newProductDeals + m1.newProductDeals + m2.newProductDeals,
    });
  }
  return quarters;
}

function makeEmptyMonth(month: Month): EngineMonthlyResult {
  return {
    month,
    inboundClosedWon: 0,
    outboundClosedWon: 0,
    expansionRevenue: 0,
    newProductClosedWon: 0,
    churnRevenue: 0,
    totalNewARR: 0,
    cumulativeARR: 0,
    inboundPipelineCreated: 0,
    outboundPipelineCreated: 0,
    expansionPipelineCreated: 0,
    newProductPipelineCreated: 0,
    inboundHIS: 0,
    inboundDeals: 0,
    outboundDeals: 0,
    expansionDeals: 0,
    newProductDeals: 0,
    inboundWinRate: 0,
    outboundWinRate: 0,
    expansionWinRate: 0,
    newProductWinRate: 0,
    inboundACV: 0,
    outboundACV: 0,
    expansionACV: 0,
    newProductACV: 0,
    inboundSalesCycle: 0,
    outboundSalesCycle: 0,
    expansionSalesCycle: 0,
    newProductSalesCycle: 0,
    inboundHisToPipelineRate: 0,
  };
}

// ── Function 1: runTopDownModel ─────────────────────────────────

export function runTopDownModel(inputs: {
  inboundAnnual: number;
  outboundAnnual: number;
  expansionAnnual: number;
  newProductAnnual: number;
  churnAnnual: number;
  rates: TopDownRates;
  startingARR: number;
}): EngineModelRun {
  const {
    inboundAnnual,
    outboundAnnual,
    expansionAnnual,
    newProductAnnual,
    churnAnnual,
    rates,
    startingARR,
  } = inputs;

  const monthly: EngineMonthlyResult[] = [];
  let cumulativeARR = startingARR;

  for (let q = 0; q < 4; q++) {
    const weight = QUARTER_WEIGHTS[q];
    const inboundQuarterly = inboundAnnual * weight;
    const outboundQuarterly = outboundAnnual * weight;
    const expansionQuarterly = expansionAnnual * weight;
    const newProductQuarterly = newProductAnnual * weight;

    for (let m = 0; m < 3; m++) {
      const monthIdx = q * 3 + m;
      const monthNum = (monthIdx + 1) as Month;
      const row = makeEmptyMonth(monthNum);

      // Closed won = quarterly target / 3
      row.inboundClosedWon = inboundQuarterly / 3;
      row.outboundClosedWon = outboundQuarterly / 3;
      row.expansionRevenue = expansionQuarterly / 3;
      row.newProductClosedWon = newProductQuarterly / 3;
      row.churnRevenue = -(churnAnnual / 12);

      // Back-calculate pipeline
      row.inboundPipelineCreated = safeDivide(row.inboundClosedWon, rates.inboundWinRate);
      row.outboundPipelineCreated = safeDivide(row.outboundClosedWon, rates.outboundWinRate);
      row.expansionPipelineCreated = safeDivide(row.expansionRevenue, rates.expansionWinRate);
      row.newProductPipelineCreated = safeDivide(row.newProductClosedWon, rates.newProductWinRate);

      // Back-calculate HIS
      row.inboundHIS = safeDivide(
        row.inboundPipelineCreated,
        rates.inboundHisToPipelineRate * rates.inboundACV
      );

      // Back-calculate deals
      row.inboundDeals = safeDivide(row.inboundClosedWon, rates.inboundACV);
      row.outboundDeals = safeDivide(row.outboundClosedWon, rates.outboundACV);
      row.expansionDeals = safeDivide(row.expansionRevenue, rates.expansionACV);
      row.newProductDeals = safeDivide(row.newProductClosedWon, rates.newProductACV);

      // Store rates
      row.inboundWinRate = rates.inboundWinRate;
      row.outboundWinRate = rates.outboundWinRate;
      row.expansionWinRate = rates.expansionWinRate;
      row.newProductWinRate = rates.newProductWinRate;
      row.inboundACV = rates.inboundACV;
      row.outboundACV = rates.outboundACV;
      row.expansionACV = rates.expansionACV;
      row.newProductACV = rates.newProductACV;
      row.inboundSalesCycle = rates.inboundSalesCycle;
      row.outboundSalesCycle = rates.outboundSalesCycle;
      row.expansionSalesCycle = rates.expansionSalesCycle;
      row.newProductSalesCycle = rates.newProductSalesCycle;
      row.inboundHisToPipelineRate = rates.inboundHisToPipelineRate;

      // Totals
      row.totalNewARR =
        row.inboundClosedWon +
        row.outboundClosedWon +
        row.expansionRevenue +
        row.newProductClosedWon +
        row.churnRevenue;

      cumulativeARR += row.totalNewARR;
      row.cumulativeARR = cumulativeARR;

      monthly.push(row);
    }
  }

  const quarterly = rollUpToQuarters(monthly);
  const totalNewARR = monthly.reduce((sum, m) => sum + m.totalNewARR, 0);

  return {
    monthly,
    quarterly,
    endingARR: cumulativeARR,
    totalNewARR,
  };
}

// ── Function 2: runStatusQuoModel ───────────────────────────────

export function runStatusQuoModel(inputs: {
  avgMonthlyInboundPipeline: number;
  avgInboundWinRate: number;
  avgInboundACV: number;
  avgInboundSalesCycle: number;
  avgMonthlyHIS: number;
  avgInboundHisToPipelineRate: number;
  avgMonthlyOutboundPipeline: number;
  avgOutboundWinRate: number;
  avgOutboundACV: number;
  avgOutboundSalesCycle: number;
  avgExpansionPipeline: number;
  avgExpansionWinRate: number;
  avgExpansionACV: number;
  avgExpansionSalesCycle: number;
  avgNewProductPipeline: number;
  avgNewProductWinRate: number;
  avgNewProductACV: number;
  avgNewProductSalesCycle: number;
  monthlyChurnRate: number;
  startingARR: number;
  actuals?: ActualMonth[];
  currentMonth?: number;
  channelConfig: ChannelConfig;
}): EngineModelRun {
  const {
    avgMonthlyInboundPipeline,
    avgInboundWinRate,
    avgInboundACV,
    avgInboundSalesCycle,
    avgMonthlyHIS,
    avgInboundHisToPipelineRate,
    avgMonthlyOutboundPipeline,
    avgOutboundWinRate,
    avgOutboundACV,
    avgOutboundSalesCycle,
    avgExpansionPipeline,
    avgExpansionWinRate,
    avgExpansionACV,
    avgExpansionSalesCycle,
    avgNewProductPipeline,
    avgNewProductWinRate,
    avgNewProductACV,
    avgNewProductSalesCycle,
    monthlyChurnRate,
    startingARR,
    actuals,
    currentMonth,
  } = inputs;

  const monthly: EngineMonthlyResult[] = [];
  let currentARR = startingARR;

  // Pipeline tracking arrays
  const inboundPipelineByMonth: number[] = new Array(12).fill(0);
  const outboundPipelineByMonth: number[] = new Array(12).fill(0);
  const expansionPipelineByMonth: number[] = new Array(12).fill(0);
  const newProductPipelineByMonth: number[] = new Array(12).fill(0);

  for (let i = 0; i < 12; i++) {
    const monthNum = (i + 1) as Month;

    // Check if we should use actuals for this month
    const actualForMonth = actuals?.find((a) => a.month === monthNum);
    const useActual =
      actualForMonth !== undefined &&
      currentMonth !== undefined &&
      monthNum < currentMonth;

    if (useActual) {
      // Use actual values directly
      const row = makeEmptyMonth(monthNum);
      row.inboundClosedWon = actualForMonth.inboundClosedWon;
      row.outboundClosedWon = actualForMonth.outboundClosedWon;
      row.expansionRevenue = actualForMonth.expansionRevenue;
      row.newProductClosedWon = actualForMonth.newProductClosedWon;
      row.churnRevenue = actualForMonth.churnRevenue;
      row.totalNewARR = actualForMonth.totalNewARR;
      row.inboundPipelineCreated = actualForMonth.inboundPipelineCreated;
      row.outboundPipelineCreated = actualForMonth.outboundPipelineCreated;
      row.expansionPipelineCreated = actualForMonth.expansionPipelineCreated;
      row.newProductPipelineCreated = actualForMonth.newProductPipelineCreated;
      row.inboundHIS = actualForMonth.inboundHIS;
      row.inboundDeals = actualForMonth.inboundDeals;
      row.outboundDeals = actualForMonth.outboundDeals;
      row.expansionDeals = actualForMonth.expansionDeals;
      row.newProductDeals = actualForMonth.newProductDeals;

      // Store rates
      row.inboundWinRate = avgInboundWinRate;
      row.outboundWinRate = avgOutboundWinRate;
      row.expansionWinRate = avgExpansionWinRate;
      row.newProductWinRate = avgNewProductWinRate;
      row.inboundACV = avgInboundACV;
      row.outboundACV = avgOutboundACV;
      row.expansionACV = avgExpansionACV;
      row.newProductACV = avgNewProductACV;
      row.inboundSalesCycle = avgInboundSalesCycle;
      row.outboundSalesCycle = avgOutboundSalesCycle;
      row.expansionSalesCycle = avgExpansionSalesCycle;
      row.newProductSalesCycle = avgNewProductSalesCycle;
      row.inboundHisToPipelineRate = avgInboundHisToPipelineRate;

      currentARR += row.totalNewARR;
      row.cumulativeARR = currentARR;

      // Record actual pipeline for waterfall lookback
      inboundPipelineByMonth[i] = row.inboundPipelineCreated;
      outboundPipelineByMonth[i] = row.outboundPipelineCreated;
      expansionPipelineByMonth[i] = row.expansionPipelineCreated;
      newProductPipelineByMonth[i] = row.newProductPipelineCreated;

      monthly.push(row);
      continue;
    }

    // Projected month
    const row = makeEmptyMonth(monthNum);

    // Pipeline creation
    inboundPipelineByMonth[i] = avgMonthlyInboundPipeline;
    outboundPipelineByMonth[i] = avgMonthlyOutboundPipeline;
    expansionPipelineByMonth[i] = avgExpansionPipeline;
    newProductPipelineByMonth[i] = avgNewProductPipeline;

    row.inboundPipelineCreated = avgMonthlyInboundPipeline;
    row.outboundPipelineCreated = avgMonthlyOutboundPipeline;
    row.expansionPipelineCreated = avgExpansionPipeline;
    row.newProductPipelineCreated = avgNewProductPipeline;

    // Pipeline waterfall — closed won from pipeline created N months ago
    const inboundCloseIdx = i - Math.round(avgInboundSalesCycle);
    row.inboundClosedWon =
      inboundCloseIdx >= 0
        ? inboundPipelineByMonth[inboundCloseIdx] * avgInboundWinRate
        : 0;

    const outboundCloseIdx = i - Math.round(avgOutboundSalesCycle);
    row.outboundClosedWon =
      outboundCloseIdx >= 0
        ? outboundPipelineByMonth[outboundCloseIdx] * avgOutboundWinRate
        : 0;

    const expansionCloseIdx = i - Math.round(avgExpansionSalesCycle);
    row.expansionRevenue =
      expansionCloseIdx >= 0
        ? expansionPipelineByMonth[expansionCloseIdx] * avgExpansionWinRate
        : 0;

    const newProductCloseIdx = i - Math.round(avgNewProductSalesCycle);
    row.newProductClosedWon =
      newProductCloseIdx >= 0
        ? newProductPipelineByMonth[newProductCloseIdx] * avgNewProductWinRate
        : 0;

    // Churn
    row.churnRevenue = -(currentARR * monthlyChurnRate);

    // Total
    row.totalNewARR =
      row.inboundClosedWon +
      row.outboundClosedWon +
      row.expansionRevenue +
      row.newProductClosedWon +
      row.churnRevenue;

    currentARR += row.totalNewARR;
    row.cumulativeARR = currentARR;

    // Back-calculate
    row.inboundHIS = avgMonthlyHIS;
    row.inboundDeals = safeDivide(row.inboundClosedWon, avgInboundACV);
    row.outboundDeals = safeDivide(row.outboundClosedWon, avgOutboundACV);
    row.expansionDeals = safeDivide(row.expansionRevenue, avgExpansionACV);
    row.newProductDeals = safeDivide(row.newProductClosedWon, avgNewProductACV);

    // Store rates
    row.inboundWinRate = avgInboundWinRate;
    row.outboundWinRate = avgOutboundWinRate;
    row.expansionWinRate = avgExpansionWinRate;
    row.newProductWinRate = avgNewProductWinRate;
    row.inboundACV = avgInboundACV;
    row.outboundACV = avgOutboundACV;
    row.expansionACV = avgExpansionACV;
    row.newProductACV = avgNewProductACV;
    row.inboundSalesCycle = avgInboundSalesCycle;
    row.outboundSalesCycle = avgOutboundSalesCycle;
    row.expansionSalesCycle = avgExpansionSalesCycle;
    row.newProductSalesCycle = avgNewProductSalesCycle;
    row.inboundHisToPipelineRate = avgInboundHisToPipelineRate;

    monthly.push(row);
  }

  const quarterly = rollUpToQuarters(monthly);
  const totalNewARR = monthly.reduce((sum, m) => sum + m.totalNewARR, 0);

  return {
    monthly,
    quarterly,
    endingARR: currentARR,
    totalNewARR,
  };
}

// ── Function 3: calcHistoricalAverages ──────────────────────────

export function calcHistoricalAverages(
  historicalQuarters: QuarterlyHistoricalData[]
): {
  avgMonthlyInboundPipeline: number;
  avgInboundWinRate: number;
  avgInboundACV: number;
  avgInboundSalesCycle: number;
  avgMonthlyHIS: number;
  avgInboundHisToPipelineRate: number;
  avgMonthlyOutboundPipeline: number;
  avgOutboundWinRate: number;
  avgOutboundACV: number;
  avgOutboundSalesCycle: number;
  avgExpansionPipeline: number;
  avgExpansionWinRate: number;
  avgExpansionACV: number;
  avgExpansionSalesCycle: number;
  avgNewProductPipeline: number;
  avgNewProductWinRate: number;
  avgNewProductACV: number;
  avgNewProductSalesCycle: number;
  monthlyChurnRate: number;
} {
  function meanNonZero(values: number[]): number {
    const nonZero = values.filter((v) => v !== 0 && !isNaN(v));
    if (nonZero.length === 0) return 0;
    return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  }

  // Collect values from each quarter
  const inboundPipeline = historicalQuarters.map((q) => q.inboundQualifiedPipeline / 3);
  const inboundWinRate = historicalQuarters.map((q) => q.inboundWinRate);
  const inboundACV = historicalQuarters.map((q) => q.inboundACV);
  const inboundSalesCycle = historicalQuarters.map((q) => q.inboundSalesCycle);
  const inboundHIS = historicalQuarters.map((q) => q.inboundHIS / 3);
  const inboundHisToPipelineRate = historicalQuarters.map((q) => q.inboundHISToPipelineRate);

  const outboundPipeline = historicalQuarters.map((q) => q.outboundQualifiedPipeline / 3);
  const outboundWinRate = historicalQuarters.map((q) => q.outboundWinRate);
  const outboundACV = historicalQuarters.map((q) => q.outboundACV);
  const outboundSalesCycle = historicalQuarters.map((q) => q.outboundSalesCycle);

  const expansionPipeline = historicalQuarters.map((q) => q.expansionPipeline / 3);
  const expansionWinRate = historicalQuarters.map((q) => q.expansionWinRate);
  const expansionACV = historicalQuarters.map((q) => q.expansionACV);
  const expansionSalesCycle = historicalQuarters.map((q) => q.expansionSalesCycle);

  const newProductPipeline = historicalQuarters.map((q) => q.newProductQualifiedPipeline / 3);
  const newProductWinRate = historicalQuarters.map((q) => q.newProductWinRate);
  const newProductACV = historicalQuarters.map((q) => q.newProductACV);
  const newProductSalesCycle = historicalQuarters.map((q) => q.newProductSalesCycle);

  const churnRate = historicalQuarters.map((q) => q.churnRate);

  return {
    avgMonthlyInboundPipeline: meanNonZero(inboundPipeline),
    avgInboundWinRate: meanNonZero(inboundWinRate),
    avgInboundACV: meanNonZero(inboundACV),
    avgInboundSalesCycle: meanNonZero(inboundSalesCycle),
    avgMonthlyHIS: meanNonZero(inboundHIS),
    avgInboundHisToPipelineRate: meanNonZero(inboundHisToPipelineRate),
    avgMonthlyOutboundPipeline: meanNonZero(outboundPipeline),
    avgOutboundWinRate: meanNonZero(outboundWinRate),
    avgOutboundACV: meanNonZero(outboundACV),
    avgOutboundSalesCycle: meanNonZero(outboundSalesCycle),
    avgExpansionPipeline: meanNonZero(expansionPipeline),
    avgExpansionWinRate: meanNonZero(expansionWinRate),
    avgExpansionACV: meanNonZero(expansionACV),
    avgExpansionSalesCycle: meanNonZero(expansionSalesCycle),
    avgNewProductPipeline: meanNonZero(newProductPipeline),
    avgNewProductWinRate: meanNonZero(newProductWinRate),
    avgNewProductACV: meanNonZero(newProductACV),
    avgNewProductSalesCycle: meanNonZero(newProductSalesCycle),
    monthlyChurnRate: meanNonZero(churnRate),
  };
}

// ── Function 4: applyBetsToRates ────────────────────────────────

export function applyBetsToRates(
  baseRates: Record<string, number>,
  bets: StrategicBet[],
  month: number
): Record<string, number> {
  const result = { ...baseRates };

  for (const bet of bets) {
    if (!bet.enabled) continue;

    const { startMonth, rampMonths, currentValue, improvedValue, metric } = bet;

    let value: number;
    if (month < startMonth) {
      value = currentValue;
    } else if (month >= startMonth + rampMonths) {
      value = improvedValue;
    } else {
      // Linear interpolation
      const elapsed = month - startMonth;
      const pct = safeDivide(elapsed, rampMonths);
      value = currentValue + (improvedValue - currentValue) * pct;
    }

    // Map bet metric to rate field
    const fieldMap: Record<string, string> = {
      winRate: bet.channel === 'inbound' ? 'avgInboundWinRate' : 'avgOutboundWinRate',
      salesCycleMonths: bet.channel === 'inbound' ? 'avgInboundSalesCycle' : 'avgOutboundSalesCycle',
      hisToPipelineRate: 'avgInboundHisToPipelineRate',
      hisMonthly: 'avgMonthlyHIS',
      pipelineMonthly: bet.channel === 'inbound' ? 'avgMonthlyInboundPipeline' : 'avgMonthlyOutboundPipeline',
      acv: bet.channel === 'inbound' ? 'avgInboundACV' : 'avgOutboundACV',
      expansionRate: 'avgExpansionWinRate',
      monthlyChurnRate: 'monthlyChurnRate',
    };

    const field = fieldMap[metric];
    if (field && field in result) {
      result[field] = value;
    }
  }

  return result;
}
