'use client';

import React from 'react';

export default function Methodology() {
  return (
    <>
      <style>{`
        @media print {
          header, nav, [data-tab-nav], [data-header] { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          body { background: white !important; color: black !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto space-y-12 pb-16">

        {/* ── Section 1: Overview ──────────────────────────────── */}
        <section>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Methodology</h1>
          <p className="text-sm text-gray-500 mt-1">How the GTM Focus Cycle model works, step by step.</p>

          <div className="mt-6 space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              The GTM Focus Cycle tool is a structured planning framework that connects your go-to-market
              inputs (pipeline, win rates, deal sizes) to revenue outputs (ARR growth) through a unified
              model. It answers a single question: <em className="font-medium text-gray-900">What does it
              take to hit our number?</em>
            </p>
            <p>The six tabs build on each other in sequence:</p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {[
              { tab: '0. Setup', desc: 'Define your starting ARR, target ARR, and enter 4-8 quarters of historical performance data per channel.' },
              { tab: '1. Revenue Targets', desc: 'The model calculates what your funnel must produce each month to reach your target — how many leads, how much pipeline, and how many deals.' },
              { tab: '2. Current Performance', desc: 'Projects forward using the average of your historical metrics with no improvement. This is your baseline: what happens if nothing changes.' },
              { tab: '3. The Gap', desc: 'Compares Revenue Targets to Current Performance side-by-side, showing exactly where the plan asks for more than history delivers.' },
              { tab: '4. Strategic Bets', desc: 'Select 1-3 specific metrics to improve and model the impact. Identify the highest-leverage changes to close the gap.' },
              { tab: '5. Executive Summary', desc: 'A print-ready board deck summarizing your plan, gap, bets, and key actions in plain English.' },
            ].map((step) => (
              <div key={step.tab} className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span className="flex-shrink-0 text-xs font-bold text-blue-700 bg-blue-100 rounded px-2 py-1 h-fit">{step.tab}</span>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 2: Core Formulas ─────────────────────────── */}
        <section className="print-break">
          <h2 className="text-lg font-bold text-gray-900">Core Formulas</h2>
          <p className="text-sm text-gray-500 mt-1">The math behind each revenue channel.</p>

          <div className="mt-6 space-y-8">

            {/* Inbound */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Inbound</h3>
              <div className="space-y-3">
                <Formula
                  formula="HIS × HIS→Pipeline Rate × ACV = Qualified Pipeline Created"
                  explanation="High-Intent Submissions are multiplied by the conversion rate to pipeline, then valued at the average contract value to produce dollar pipeline."
                />
                <Formula
                  formula="Qualified Pipeline × Win Rate = Closed Won ARR"
                  explanation="Pipeline created converts to closed-won revenue at the win rate, after a sales cycle delay (see below)."
                />
                <Formula
                  formula="Closed Won ARR ÷ ACV = New Customers"
                  explanation="The number of new logos acquired, derived from total closed revenue divided by the average deal size."
                />
              </div>
            </div>

            {/* Outbound */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Outbound</h3>
              <div className="space-y-3">
                <Formula
                  formula="Pipeline Created × Win Rate = Closed Won ARR"
                  explanation="Outbound pipeline is entered directly as a dollar amount. It converts at the win rate after the sales cycle delay."
                />
                <Formula
                  formula="Closed Won ARR ÷ ACV = New Customers"
                  explanation="Same as inbound — total revenue divided by average deal size yields customer count."
                />
              </div>
            </div>

            {/* Expansion */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Expansion</h3>
              <Formula
                formula="Current ARR × Monthly Expansion Rate = Expansion Revenue"
                explanation="Each month, a percentage of the existing ARR base expands through upsells, cross-sells, or seat additions."
              />
            </div>

            {/* Churn */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Churn</h3>
              <Formula
                formula="Current ARR × Monthly Churn Rate = Churned Revenue"
                explanation="Each month, a percentage of the ARR base is lost to churn. This is subtracted from new ARR to compute net growth."
              />
            </div>

            {/* Total New ARR */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Total New ARR</h3>
              <Formula
                formula="Inbound Won + Outbound Won + NP Inbound + NP Outbound + Expansion − Churn = Total New ARR"
                explanation="All closed-won revenue from every channel, plus expansion, minus churn, gives total net new ARR added in a given month."
              />
            </div>

            {/* Cumulative ARR */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Cumulative ARR</h3>
              <Formula
                formula="Previous Month ARR + Total New ARR = Ending ARR"
                explanation="Each month's ending ARR is the previous month's ARR plus the net new ARR added that month. This compounds across all 12 months."
              />
            </div>

          </div>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 3: Pipeline Waterfall / Sales Cycle Delay ── */}
        <section className="print-break">
          <h2 className="text-lg font-bold text-gray-900">Pipeline Waterfall &amp; Sales Cycle Delay</h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Pipeline created in Month X closes in Month X + Sales Cycle length. This means a 3-month sales
            cycle means pipeline created in January closes in April. The model automatically shifts revenue
            recognition forward by the sales cycle for each channel.
          </p>

          {/* Visual timeline */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Example: 3-Month Sales Cycle</p>
            <div className="flex items-center gap-0">
              {[
                { month: 'Month 1', label: 'Pipeline Created', color: 'bg-blue-500 text-white' },
                { month: 'Month 2', label: 'In Progress', color: 'bg-blue-200 text-blue-800' },
                { month: 'Month 3', label: 'In Progress', color: 'bg-blue-200 text-blue-800' },
                { month: 'Month 4', label: 'Closes', color: 'bg-green-500 text-white' },
              ].map((step, i) => (
                <React.Fragment key={step.month}>
                  {i > 0 && (
                    <div className="flex-shrink-0 w-6 text-center text-gray-400 text-lg">→</div>
                  )}
                  <div className="flex-1 text-center">
                    <div className={`rounded-lg py-3 px-2 ${step.color}`}>
                      <div className="text-xs font-bold">{step.label}</div>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 font-medium">{step.month}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            This delay is applied independently to each channel. If inbound has a 2-month cycle and
            outbound has a 4-month cycle, their pipeline closes in different months even if created
            simultaneously.
          </p>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 4: Seasonality ──────────────────────────── */}
        <section className="print-break">
          <h2 className="text-lg font-bold text-gray-900">Seasonality</h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Seasonality weights adjust monthly production to reflect natural business cycles.
            A weight of <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">1.0</code> means
            an average month. A weight of <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">1.2</code> means
            that month is expected to be 20% stronger than average. A weight
            of <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">0.8</code> means 20% weaker.
          </p>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            When 8 quarters of historical data are entered, seasonality is auto-calculated by comparing
            each quarter&apos;s total revenue to the average quarterly revenue. With fewer than 8 quarters,
            flat seasonality (1.0 for every month) is used as a safe default.
          </p>

          {/* Example weights */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Example Seasonality Weights</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { q: 'Q1', w: '0.85', note: 'Slow start' },
                { q: 'Q2', w: '1.05', note: 'Ramp-up' },
                { q: 'Q3', w: '0.90', note: 'Summer dip' },
                { q: 'Q4', w: '1.20', note: 'Year-end push' },
              ].map((item) => (
                <div key={item.q} className="p-2 bg-white rounded border border-gray-200">
                  <div className="font-bold text-gray-700">{item.q}</div>
                  <div className="text-blue-700 font-mono font-medium mt-0.5">{item.w}</div>
                  <div className="text-gray-400 text-[10px] mt-0.5">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 5: Status Quo Projection ────────────────── */}
        <section className="print-break">
          <h2 className="text-lg font-bold text-gray-900">Status Quo Projection</h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            The Current Performance tab projects forward using the average of your historical metrics
            with no improvement assumed. This represents your baseline — what happens if nothing changes.
          </p>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            Historical averages are calculated from filled quarters: win rates, pipeline creation volumes,
            ACV, sales cycle length, expansion rates, and churn rates are each averaged independently.
            These averaged inputs are then run through the same model engine as the Revenue Targets tab,
            producing a full 12-month projection.
          </p>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            The gap between this Status Quo projection and your Target is the central question the
            planning exercise must answer: <em className="font-medium text-gray-900">What specific
            changes will close the delta?</em>
          </p>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 6: Strategic Bets ───────────────────────── */}
        <section className="print-break">
          <h2 className="text-lg font-bold text-gray-900">Strategic Bets</h2>

          <h3 className="text-sm font-semibold text-gray-800 mt-4">Metric Bets</h3>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Each bet modifies a single input metric (e.g., win rate, ACV, pipeline volume). The model
            recalculates all downstream projections using the improved value, showing the isolated
            impact of that one change. This helps teams identify the highest-leverage improvements —
            often a small change in win rate has more impact than a large increase in pipeline volume.
          </p>

          <h3 className="text-sm font-semibold text-gray-800 mt-6">Revenue Mix Bets</h3>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Revenue mix bets shift what percentage of total revenue comes from each channel. Instead
            of modifying a specific rate, they scale the channel&apos;s pipeline creation inputs
            proportionally to achieve a target channel mix while keeping total ARR constant. For example,
            shifting the inbound mix from 30% to 40% scales up inbound HIS volume by the
            ratio <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">40 / 30 = 1.33×</code>,
            producing 33% more inbound pipeline.
          </p>

          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">Best Practice</p>
            <p className="text-sm text-purple-800">
              Focus on 1-3 bets for maximum clarity. More bets spread attention and make it harder
              to track accountability. The goal is to leave the planning exercise with a focused set
              of strategic bets your team can row in the same direction on.
            </p>
          </div>
        </section>

        <hr className="border-gray-200" />

        {/* ── Section 7: Actuals & Reforecasting ──────────────── */}
        <section className="print-break">
          <h2 className="text-lg font-bold text-gray-900">Actuals &amp; Reforecasting</h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            When in <strong>In-Year Reforecast</strong> mode, completed months use your actual values
            instead of model projections. Future months are projected using rates recalibrated from your
            actuals — so if your actual win rate has been 30% vs the planned 25%, the remaining months
            project forward at 30%.
          </p>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            This creates a continuously updating forecast that blends real results with calibrated
            projections, giving you the most accurate picture of where you&apos;ll land by year end.
          </p>

          {/* Visual example */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Example: Reforecast as of April</p>
            <div className="flex gap-0.5">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                <div key={m} className="flex-1 text-center">
                  <div className={`rounded py-2 text-[10px] font-bold ${
                    i < 3
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {i < 3 ? 'ACT' : 'PLAN'}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{m}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-green-100 border border-green-300"></span> Actual data
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-300"></span> Projected (recalibrated from actuals)
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            The variance view (available in the Revenue Targets tab) shows how actuals compare to the
            original plan, highlighting where you&apos;re ahead or behind at each point in time.
          </p>
        </section>

      </div>
    </>
  );
}

// ── Formula display component ────────────────────────────────

function Formula({ formula, explanation }: { formula: string; explanation: string }) {
  return (
    <div>
      <div className="bg-gray-900 text-gray-100 rounded-lg px-4 py-2.5 font-mono text-xs leading-relaxed">
        {formula}
      </div>
      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed pl-1">{explanation}</p>
    </div>
  );
}
