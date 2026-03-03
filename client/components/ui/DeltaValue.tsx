'use client';

import React, { useEffect, useRef, useState } from 'react';

interface DeltaEntry {
  id: number;
  diff: number;
}

interface DeltaValueProps {
  /** The numeric value to display and track for changes */
  value: number;
  /** Optional formatter — defaults to Math.floor */
  format?: (v: number) => string;
  className?: string;
}

/**
 * Displays a number and shows a floating "+N" / "-N" chip whenever
 * the value changes. The chip animates upward and fades out.
 * No delta is shown on the initial mount.
 */
export default function DeltaValue({ value, format, className }: DeltaValueProps) {
  const mounted = useRef(false);
  const prevRef = useRef(value);
  const counter = useRef(0);
  const [deltas, setDeltas] = useState<DeltaEntry[]>([]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prevRef.current = value;
      return;
    }
    const diff = value - prevRef.current;
    prevRef.current = value;
    if (diff === 0) return;

    const id = ++counter.current;
    setDeltas((d) => [...d, { id, diff }]);
    const t = setTimeout(
      () => setDeltas((d) => d.filter((x) => x.id !== id)),
      1400,
    );
    return () => clearTimeout(t);
  }, [value]);

  const display = format ? format(value) : Math.floor(value).toString();

  return (
    <span className={`relative inline-block ${className ?? ''}`}>
      {display}
      {deltas.map(({ id, diff }) => (
        <span
          key={id}
          className={[
            'absolute left-1/2 bottom-full mb-0.5',
            'text-[10px] font-bold pointer-events-none whitespace-nowrap',
            'animate-delta-float',
            diff > 0 ? 'text-green-400' : 'text-red-400',
          ].join(' ')}
        >
          {diff > 0 ? '+' : ''}
          {Math.round(diff)}
        </span>
      ))}
    </span>
  );
}
