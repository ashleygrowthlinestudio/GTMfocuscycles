'use client';

import React from 'react';

interface MetricInputProps {

  label: string;

  value: number;

  onChange: (value: number) => void;

  type?: 'currency' | 'percent' | 'number' | 'months';

  min?: number;

  max?: number;

  step?: number;

  hint?: string;

}

export default function MetricInput({

  label,

  value,

  onChange,

  type = 'number',

  min,

  max,

  step,

  hint,

}: MetricInputProps) {

  const displayValue = type === 'percent' ? (value * 100).toFixed(1) : value;

  const prefix = type === 'currency' ? '$' : '';

  const suffix = type === 'percent' ? '%' : type === 'months' ? ' mo' : '';

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {

    let v = parseFloat(e.target.value);

    if (isNaN(v)) v = 0;

    if (type === 'percent') v = v / 100;

    onChange(v);

  }

  return (

    <div className="flex flex-col gap-1">

      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">

        {label}

      </label>

      <div className="relative">

        {prefix && (

          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">

            {prefix}

          </span>

        )}

        <input

          type="number"

          value={displayValue}

          onChange={handleChange}

          min={type === 'percent' ? (min !== undefined ? min * 100 : undefined) : min}

          max={type === 'percent' ? (max !== undefined ? max * 100 : undefined) : max}

          step={step ?? (type === 'percent' ? 0.1 : type === 'currency' ? 1000 : 1)}

          className={`w-full rounded-md border border-gray-300 bg-white py-1.5 text-sm text-gray-900

            focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none

            ${prefix ? 'pl-6' : 'pl-2'} ${suffix ? 'pr-8' : 'pr-2'}`}

        />

        {suffix && (

          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">

            {suffix}

          </span>

        )}

      </div>

      {hint && <span className="text-xs text-gray-400">{hint}</span>}

    </div>

  );

}
