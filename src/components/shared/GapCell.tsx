'use client';

import React from 'react';

interface GapCellProps {

  value: number;

  formatter: (v: number) => string;

  /** If true, positive values are bad (e.g. churn gap) */

  invertColor?: boolean;

}

export default function GapCell({ value, formatter, invertColor = false }: GapCellProps) {

  const isPositive = invertColor ? value < 0 : value > 0;

  const isNegative = invertColor ? value > 0 : value < 0;

  const isNeutral = Math.abs(value) < 0.01;

  let colorClass = 'text-gray-500';

  let bgClass = '';

  if (!isNeutral) {

    if (isPositive) {

      colorClass = 'text-red-700';

      bgClass = 'bg-red-50';

    } else if (isNegative) {

      colorClass = 'text-green-700';

      bgClass = 'bg-green-50';

    }

  }

  return (

    <td className={`py-1.5 px-2 text-right text-xs ${colorClass} ${bgClass}`}>

      {value > 0 ? '+' : ''}{formatter(value)}

    </td>

  );

}
