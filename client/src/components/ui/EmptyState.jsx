import React from 'react';
import { Sparkles } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Sparkles,
  title = 'No items found',
  description = 'There are no records to display at this moment.',
  action = null,
  children = null,
  className = '',
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-sm ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-100/80 dark:border-blue-900/40">
        <Icon className="w-6 h-6" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>

      {action && <div className="mt-5">{action}</div>}

      {children && <div className="mt-5 w-full">{children}</div>}
    </div>
  );
};

export default EmptyState;
