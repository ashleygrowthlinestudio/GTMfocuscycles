'use client';

import React, { useRef } from 'react';

import { useGTMPlan } from '@/context/GTMPlanContext';

import { exportPlanJSON, importPlanJSON } from '@/lib/storage';

import { formatCurrency } from '@/lib/format';

export default function Header() {

  const { plan, dispatch, clientId } = useGTMPlan();

  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0];

    if (!file) return;

    try {

      const imported = await importPlanJSON(file);

      dispatch({ type: 'LOAD_PLAN', payload: imported });

    } catch (err) {

      alert('Failed to import: ' + (err as Error).message);

    }

    if (fileRef.current) fileRef.current.value = '';

  }

  return (

    <header className="bg-white border-b border-gray-200 px-4 py-3">

      <div className="max-w-7xl mx-auto flex items-center justify-between">

        <div>

          <h1 className="text-lg font-bold text-gray-900">GTM Focus Cycle</h1>

          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">

            <span>{plan.planYear}</span>

            <span>Start: {formatCurrency(plan.startingARR)}</span>

            <span>Target: {formatCurrency(plan.targetARR)}</span>

            {clientId !== 'default' ? (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">Client: {clientId}</span>
            ) : (
              <span className="text-gray-400 italic">No client specified — add ?client=yourname to the URL</span>
            )}

          </div>

        </div>

        <div className="flex items-center gap-2">

          <button

            onClick={() => exportPlanJSON(plan)}

            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"

          >

            Export JSON

          </button>

          <button

            onClick={() => fileRef.current?.click()}

            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"

          >

            Import JSON

          </button>

          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

          <button

            onClick={() => {

              if (confirm('Reset all data to defaults?')) {

                dispatch({ type: 'RESET' });

              }

            }}

            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"

          >

            Reset

          </button>

        </div>

      </div>

    </header>

  );

}
