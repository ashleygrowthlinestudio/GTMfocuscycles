'use client';

import React from 'react';

import MetricInput from './MetricInput';

import type { InboundFunnelInputs, OutboundFunnelInputs } from '@/lib/types';

interface FunnelInputsProps {

  title: string;

  inbound: InboundFunnelInputs;

  outbound: OutboundFunnelInputs;

  onInboundChange: (inputs: InboundFunnelInputs) => void;

  onOutboundChange: (inputs: OutboundFunnelInputs) => void;

  hideInbound?: boolean;

  hideOutbound?: boolean;

  isNewProduct?: boolean;

}

export default function FunnelInputs({

  title,

  inbound,

  outbound,

  onInboundChange,

  onOutboundChange,

  hideInbound = false,

  hideOutbound = false,

  isNewProduct = false,

}: FunnelInputsProps) {

  return (

    <div className="border border-gray-200 rounded-lg p-4 bg-white">

      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Inbound */}

        {!hideInbound && <div className="space-y-3">

          <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{isNewProduct ? 'New Product' : 'Inbound'}</h4>

          {!isNewProduct && (
            <>
              <MetricInput

                label="High-Intent Submissions / mo"

                value={inbound.hisMonthly}

                onChange={(v) => onInboundChange({ ...inbound, hisMonthly: v })}

                type="number"

                hint="Monthly high-intent form submissions"

              />

              <MetricInput

                label="HIS → Pipeline Rate"

                value={inbound.hisToPipelineRate}

                onChange={(v) => onInboundChange({ ...inbound, hisToPipelineRate: v })}

                type="percent"

                hint="Conversion from HIS to qualified pipeline"

              />
            </>
          )}

          <MetricInput

            label="Win Rate"

            value={inbound.winRate}

            onChange={(v) => onInboundChange({ ...inbound, winRate: v })}

            type="percent"

          />

          <MetricInput

            label="ACV"

            value={inbound.acv}

            onChange={(v) => onInboundChange({ ...inbound, acv: v })}

            type="currency"

          />

          <MetricInput

            label="Sales Cycle"

            value={inbound.salesCycleMonths}

            onChange={(v) => onInboundChange({ ...inbound, salesCycleMonths: v })}

            type="months"

            min={0}

            max={24}

          />

        </div>}

        {/* Outbound */}

        {!hideOutbound && <div className="space-y-3">

          <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide">Outbound</h4>

          <MetricInput

            label="Pipeline Created / mo"

            value={outbound.pipelineMonthly}

            onChange={(v) => onOutboundChange({ ...outbound, pipelineMonthly: v })}

            type="currency"

            hint="Monthly pipeline generated ($)"

          />

          <MetricInput

            label="Win Rate"

            value={outbound.winRate}

            onChange={(v) => onOutboundChange({ ...outbound, winRate: v })}

            type="percent"

          />

          <MetricInput

            label="ACV"

            value={outbound.acv}

            onChange={(v) => onOutboundChange({ ...outbound, acv: v })}

            type="currency"

          />

          <MetricInput

            label="Sales Cycle"

            value={outbound.salesCycleMonths}

            onChange={(v) => onOutboundChange({ ...outbound, salesCycleMonths: v })}

            type="months"

            min={0}

            max={24}

          />

        </div>}

      </div>

    </div>

  );

}
