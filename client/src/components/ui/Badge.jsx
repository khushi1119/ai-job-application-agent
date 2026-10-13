import React from 'react';

export const Badge = ({
  children,
  variant = 'blue',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variants = {
    blue: {
      wrap: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60',
      dot: 'bg-blue-600 dark:bg-blue-400',
    },
    ai: {
      wrap: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900/60',
      dot: 'bg-cyan-500 dark:bg-cyan-400',
    },
    success: {
      wrap: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
    },
    warning: {
      wrap: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
      dot: 'bg-amber-500 dark:bg-amber-400',
    },
    danger: {
      wrap: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60',
      dot: 'bg-red-500 dark:bg-red-400',
    },
    neutral: {
      wrap: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400 dark:bg-slate-500',
    },
    lime: {
      wrap: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60',
      dot: 'bg-blue-600 dark:bg-blue-400',
    },
    rose: {
      wrap: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60',
      dot: 'bg-indigo-600 dark:bg-indigo-400',
    },
    brown: {
      wrap: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-500 dark:bg-slate-400',
    },
    ivory: {
      wrap: 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400 dark:bg-slate-500',
    },
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 rounded-full gap-1',
    md: 'text-xs px-2.5 py-1 rounded-full gap-1.5',
  };

  const current = variants[variant] || variants.blue;

  return (
    <span
      className={`inline-flex items-center font-medium border select-none ${current.wrap} ${
        sizes[size] || sizes.md
      } ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
