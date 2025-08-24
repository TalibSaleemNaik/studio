'use client';

import React from 'react';

export function GradientFlag({
  id,
  stops,
  className,
}: {
  id: string;
  stops: { offset: string; color: string }[];
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {stops.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>

      <path
        d="M4 2v20"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="
          M5.2 4
          C 8.4 3.2, 10.6 5.2, 13.8 4.5
          L 18.5 3.8
          L 18.5 12.2
          C 15.3 13.0, 13.1 11.0, 10.0 11.7
          L 5.2 11.7 Z
        "
        fill={`url(#${id})`}
        stroke={`url(#${id})`}
        strokeWidth="1.25"
        strokeLinejoin="round"
        shapeRendering="geometricPrecision"
      />
    </svg>
  );
}
