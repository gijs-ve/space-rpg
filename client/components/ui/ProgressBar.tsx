import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  colorClass?: string;
  className?: string;
}

export default function ProgressBar({
  value,
  max,
  label,
  colorClass = 'bg-amber-500',
  className = '',
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{label}</span>
          <span>{value} / {max}</span>
        </div>
      )}
      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
