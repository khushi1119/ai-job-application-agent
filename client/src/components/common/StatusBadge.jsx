import React from 'react';

export const StatusBadge = ({
  status = 'online', // 'online' | 'offline' | 'pending' | 'warning'
  label,
  className = '',
}) => {
  const configs = {
    online: {
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      defaultLabel: 'Operational',
    },
    offline: {
      color: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20',
      dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
      defaultLabel: 'Disconnected',
    },
    pending: {
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      dot: 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.5)]',
      defaultLabel: 'Checking...',
    },
    warning: {
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
      defaultLabel: 'Degraded',
    },
  };

  const current = configs[status] || configs.online;

  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${current.color} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${current.dot}`} />
      <span>{label || current.defaultLabel}</span>
    </span>
  );
};

export default StatusBadge;
