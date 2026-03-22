'use client';

import React, { useMemo, useState } from 'react';
import { useGTMPlan } from '@/context/GTMPlanContext';
import { runModel, applyChannelConfig } from '@/lib/engine';
import { formatCurrency, formatCurrencyFull, formatPercent, formatNumber } from '@/lib/format';
import RevenueTable from '@/components/shared/RevenueTable';
import type { RampConfig, RevenueBreakdown, ChannelConfig } from '@/lib/types';

const DEFAULT_RAMP: RampConfig = { rampMonths: 1, startMonth: 1 };

export default function TopDownPlan() {
  const { plan } = useGTMPlan();
  const cc = plan.channelConfig;

  const effectiveTargets = useMemo(
    () => applyChannelConfig(plan.targets, cc, 'targets'),
    [plan.targets, cc],
  );

  const effectiveHistorical = useMemo(
    () => applyChannelConfig(plan.historical, cc, 'historical'),
    [plan.historical, cc],
  );

  const model = useMemo(
    () => runModel(effectiveTargets, plan.seasonality, DEFAULT_RAMP, plan.startingARR, plan.existingPipeline),
    [effectiveTargets, plan.seasonality, plan.startingARR, plan.existingPipeline],
  );

  const projectedEnd = model.endingARR;
  const gap = plan.targetARR - projectedEnd;

  // Average ACV across active channels for deal count calculation
  const averageACV = useMemo(() => {
    const acvs: number[] = [];
    if (cc.hasInbound && plan.targets.newBusiness.inbound.acv > 0) acvs.push(plan.targets.newBusiness.inbound.acv);
    if (cc.hasOutbound && plan.targets.newBusiness.outbound.acv > 0) acvs.push(plan.targets.newBusiness.outbound.acv);
    if (cc.hasNewProduct) {
      if (plan.targets.newProduct.inbound.acv > 0) acvs.push(plan.targets.newProduct.inbound.acv);
      if (plan.targets.newProduct.outbound.acv > 0) acvs.push(plan.targets.newProduct.outbound.acv);
    }
    return acvs.length > 0 ? acvs.reduce((a, b) => a + b, 0) / acvs.length : 50_000;
  }, [plan.targets, cc]);

  return (
    <div className="space-y-6">
      {/* Top-level summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Starting ARR" value={formatCurrency(plan.startingARR)} color="gray" />
        <SummaryCard label="Target ARR" value={formatCurrency(plan.targetARR)} color="blue" />
        <SummaryCard label="Projected ARR" value={formatCurrency(projectedEnd)} color="green" />
        <SummaryCard
          label="Gap to Target"
          value={formatCurrency(Math.abs(gap))}
          color={gap > 0 ? 'red' : 'green'}
          suffix={gap > 0 ? 'short' : 'above'}
        />
      </div>

      {/* Revenue output table */}
      <RevenueTable
        monthly={model.monthly}
        quarterly={model.quarterly}
        startingARR={plan.startingARR}
        label="Target Revenue Projections"
        averageACV={averageACV}
      />

      {/* Walk the Math */}
      <WalkTheMath
        targets={effectiveTargets}
        historical={effectiveHistorical}
        cc={cc}
        model={model}
      />
    </div>
  );
}

/* ── Walk the Math Section ─────────────────────────────────── */

function WalkTheMath({
  targets,
  historical,
  cc,
  model,
}: {
  targets: RevenueBreakdown;
  historical: RevenueBreakdown;
  cc: ChannelConfig;
  model: { monthly: { inboundClosedWon: number; outboundClosedWon: number; newProductInboundClosedWon: number; newProductOutboundClosedWon: number; expansionRevenue: number; churnRevenue: number }[] };
}) {
  const [open, setOpen] = useState(false);

  // Sum annual totals from model
  const annual = useMemo(() => ({
    inbound: model.monthly.reduce((s, m) => s + m.inboundClosedWon, 0),
    outbound: model.monthly.reduce((s, m) => s + m.outboundClosedWon, 0),
    npInbound: model.monthly.reduce((s, m) => s + m.newProductInboundClosedWon, 0),
    npOutbound: model.monthly.reduce((s, m) => s + m.newProductOutboundClosedWon, 0),
    expansion: model.monthly.reduce((s, m) => s + m.expansionRevenue, 0),
    churn: model.monthly.reduce((s, m) => s + m.churnRevenue, 0),
  }), [model]);

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700">Show how we get there</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-6">
          {/* Inbound Core */}
          {cc.hasInbound && (
            <ChannelMathBlock
              title="Inbound — Core Business"
              target={{
                hisMonthly: targets.newBusiness.inbound.hisMonthly,
                hisToPipelineRate: targets.newBusiness.inbound.hisToPipelineRate,
                winRate: targets.newBusiness.inbound.winRate,
                acv: targets.newBusiness.inbound.acv,
                salesCycleMonths: targets.newBusiness.inbound.salesCycleMonths,
              }}
              historical={{
                hisMonthly: historical.newBusiness.inbound.hisMonthly,
                hisToPipelineRate: historical.newBusiness.inbound.hisToPipelineRate,
                winRate: historical.newBusiness.inbound.winRate,
                acv: historical.newBusiness.inbound.acv,
                salesCycleMonths: historical.newBusiness.inbound.salesCycleMonths,
              }}
              annualResult={annual.inbound}
              type="inbound"
            />
          )}

          {/* Outbound Core */}
          {cc.hasOutbound && (
            <ChannelMathBlock
              title="Outbound — Core Business"
              target={{
                pipelineMonthly: targets.newBusiness.outbound.pipelineMonthly,
                winRate: targets.newBusiness.outbound.winRate,
                acv: targets.newBusiness.outbound.acv,
                salesCycleMonths: targets.newBusiness.outbound.salesCycleMonths,
              }}
              historical={{
                pipelineMonthly: historical.newBusiness.outbound.pipelineMonthly,
                winRate: historical.newBusiness.outbound.winRate,
                acv: historical.newBusiness.outbound.acv,
                salesCycleMonths: historical.newBusiness.outbound.salesCycleMonths,
              }}
              annualResult={annual.outbound}
              type="outbound"
            />
          )}

          {/* New Product Inbound */}
          {cc.hasNewProduct && targets.newProduct.inbound.hisMonthly > 0 && (
            <ChannelMathBlock
              title="Inbound — New Product"
              target={{
                hisMonthly: targets.newProduct.inbound.hisMonthly,
                hisToPipelineRate: targets.newProduct.inbound.hisToPipelineRate,
                winRate: targets.newProduct.inbound.winRate,
                acv: targets.newProduct.inbound.acv,
                salesCycleMonths: targets.newProduct.inbound.salesCycleMonths,
              }}
              historical={{
                hisMonthly: historical.newProduct.inbound.hisMonthly,
                hisToPipelineRate: historical.newProduct.inbound.hisToPipelineRate,
                winRate: historical.newProduct.inbound.winRate,
                acv: historical.newProduct.inbound.acv,
                salesCycleMonths: historical.newProduct.inbound.salesCycleMonths,
              }}
              annualResult={annual.npInbound}
              type="inbound"
            />
          )}

          {/* New Product Outbound */}
          {cc.hasNewProduct && targets.newProduct.outbound.pipelineMonthly > 0 && (
            <ChannelMathBlock
              title="Outbound — New Product"
              target={{
                pipelineMonthly: targets.newProduct.outbound.pipelineMonthly,
                winRate: targets.newProduct.outbound.winRate,
                acv: targets.newProduct.outbound.acv,
                salesCycleMonths: targets.newProduct.outbound.salesCycleMonths,
              }}
              historical={{
                pipelineMonthly: historical.newProduct.outbound.pipelineMonthly,
                winRate: historical.newProduct.outbound.winRate,
                acv: historical.newProduct.outbound.acv,
                salesCycleMonths: historical.newProduct.outbound.salesCycleMonths,
              }}
              annualResult={annual.npOutbound}
              type="outbound"
            />
          )}

          {/* Expansion */}
          {cc.hasExpansion && (
            <div className="border border-gray-100 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Expansion</h4>
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <ComparisonBadge label="Rate" target={targets.expansion.expansionRate} historical={historical.expansion.expansionRate} format={formatPercent} higherIsBetter />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {formatPercent(targets.expansion.expansionRate)} of ARR expands monthly
                &rarr; <span className="font-semibold text-gray-800">{formatCurrencyFull(annual.expansion)}</span> annual expansion
              </p>
            </div>
          )}

          {/* Churn */}
          {cc.hasChurn && (
            <div className="border border-gray-100 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Churn</h4>
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <ComparisonBadge label="Rate" target={targets.churn.monthlyChurnRate} historical={historical.churn.monthlyChurnRate} format={formatPercent} higherIsBetter={false} />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {formatPercent(targets.churn.monthlyChurnRate)} of ARR churns monthly
                &rarr; <span className="font-semibold text-red-600">{formatCurrencyFull(annual.churn)}</span> annual churn
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Channel Math Block ──────────────────────────────────── */

type InboundMath = { hisMonthly: number; hisToPipelineRate: number; winRate: number; acv: number; salesCycleMonths: number };
type OutboundMath = { pipelineMonthly: number; winRate: number; acv: number; salesCycleMonths: number };

function ChannelMathBlock({
  title,
  target,
  historical,
  annualResult,
  type,
}: {
  title: string;
  target: InboundMath | OutboundMath;
  historical: InboundMath | OutboundMath;
  annualResult: number;
  type: 'inbound' | 'outbound';
}) {
  const isInbound = type === 'inbound';
  const t = target as InboundMath & OutboundMath;
  const h = historical as InboundMath & OutboundMath;

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{title}</h4>

      {/* Comparison table */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
        {isInbound ? (
          <>
            <ComparisonBadge label="HIS / month" target={t.hisMonthly} historical={h.hisMonthly} format={formatNumber} higherIsBetter />
            <ComparisonBadge label="HIS → Pipeline" target={t.hisToPipelineRate} historical={h.hisToPipelineRate} format={formatPercent} higherIsBetter />
          </>
        ) : (
          <ComparisonBadge label="Pipeline / month" target={t.pipelineMonthly} historical={h.pipelineMonthly} format={formatCurrencyFull} higherIsBetter />
        )}
        <ComparisonBadge label="Win Rate" target={t.winRate} historical={h.winRate} format={formatPercent} higherIsBetter />
        <ComparisonBadge label="ACV" target={t.acv} historical={h.acv} format={formatCurrencyFull} higherIsBetter />
        <ComparisonBadge label="Sales Cycle" target={t.salesCycleMonths} historical={h.salesCycleMonths} format={(v) => `${v} mo`} higherIsBetter={false} />
      </div>

      {/* Walk-through formula */}
      <div className="bg-gray-50 rounded-md p-2 text-xs text-gray-600">
        {isInbound ? (
          <p>
            {formatNumber(t.hisMonthly)} HIS &times; {formatPercent(t.hisToPipelineRate)} &rarr; Pipeline
            &times; {formatPercent(t.winRate)} win rate &times; {formatCurrencyFull(t.acv)} ACV
            = <span className="font-semibold text-gray-800">{formatCurrencyFull(t.hisMonthly * t.hisToPipelineRate * t.winRate * t.acv)}/mo</span> closed won
            <span className="text-gray-400 ml-1">({t.salesCycleMonths}mo cycle)</span>
          </p>
        ) : (
          <p>
            {formatCurrencyFull(t.pipelineMonthly)} pipeline/mo
            &times; {formatPercent(t.winRate)} win rate
            = <span className="font-semibold text-gray-800">{formatCurrencyFull(t.pipelineMonthly * t.winRate)}/mo</span> closed won
            <span className="text-gray-400 ml-1">({t.salesCycleMonths}mo cycle)</span>
          </p>
        )}
        <p className="mt-1 text-gray-500">
          Annual projected: <span className="font-semibold text-gray-800">{formatCurrencyFull(annualResult)}</span>
        </p>
      </div>
    </div>
  );
}

/* ── Comparison Badge ────────────────────────────────────── */

function ComparisonBadge({
  label,
  target,
  historical,
  format,
  higherIsBetter,
}: {
  label: string;
  target: number;
  historical: number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}) {
  const diff = target - historical;
  const isBetter = higherIsBetter ? diff > 0 : diff < 0;
  const isWorse = higherIsBetter ? diff < 0 : diff > 0;
  const isSame = diff === 0;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-800">{format(target)}</span>
        {!isSame && (
          <span className={`text-[10px] px-1 py-0.5 rounded ${isBetter ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isWorse ? 'vs ' : 'vs '}{format(historical)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Summary Card ────────────────────────────────────────── */

function SummaryCard({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: string;
  color: string;
  suffix?: string;
}) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-xs font-medium opacity-75 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mt-1">
        {value}
        {suffix && <span className="text-xs font-normal ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
