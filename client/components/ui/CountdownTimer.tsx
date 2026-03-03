'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CountdownTimerProps {
  endsAt: string | Date;
  onComplete?: () => void;
  className?: string;
}

function formatMs(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CountdownTimer({ endsAt, onComplete, className = '' }: CountdownTimerProps) {
  const getRemaining = useCallback(() => new Date(endsAt).getTime() - Date.now(), [endsAt]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete?.();
      return;
    }
    const id = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        onComplete?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, getRemaining, onComplete, remaining]);

  return (
    <span className={`tabular-nums font-mono text-amber-300 ${className}`}>
      {remaining > 0 ? formatMs(remaining) : 'Done'}
    </span>
  );
}
