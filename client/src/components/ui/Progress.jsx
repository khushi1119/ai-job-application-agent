import React from 'react';

export const Progress = ({
  value = 0,
  max = 100,
  showLabel = false,
  label = '',
  size = 'md',
  variant = 'blue',
  className = '',
}) => {
  const percentage = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  const variants = {
    blue: 'bg-blue-600',
    ai: 'bg-cyan-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-indigo-600',
    lime: 'bg-blue-600',
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>{label}</span>
          <span className="font-mono text-blue-600">{percentage}%</span>
        </div>
      )}

      <div
        className={`w-full bg-slate-100 rounded-full overflow-hidden ${
          sizes[size] || sizes.md
        }`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            variants[variant] || variants.blue
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default Progress;
