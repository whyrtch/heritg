import React from "react";

/** Heritg flower mark: our own drawing (eight petals around a seed) on a warm brown tile. */
export function FlowerMark({ size = 44, className }: { size?: number; className?: string }) {
  const petals = Array.from({ length: 8 }, (_, index) => index * 45);
  return <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="heritg-mark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c4a57a" />
        <stop offset="1" stopColor="#9c7c52" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#heritg-mark)" />
    <g transform="translate(32 31)" fill="none" stroke="#fffdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {petals.map(angle => <path key={angle} transform={`rotate(${angle})`} d="M0 -5 C 5 -9 5 -16 0 -20 C -5 -16 -5 -9 0 -5 Z" />)}
      <circle r="3.4" fill="#fffdf8" stroke="none" />
      <path d="M0 21 V 25" />
    </g>
  </svg>;
}
