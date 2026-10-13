import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({
  size = 'md',
  message = '',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2
        className={`${sizeMap[size] || sizeMap.md} text-blue-600 animate-spin`}
      />
      {message && (
        <p className="text-xs font-medium text-slate-500 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export const Skeleton = ({ className = '', ...props }) => (
  <div
    className={`bg-slate-200/80 dark:bg-slate-800 rounded-xl animate-pulse ${className}`}
    {...props}
  />
);

export const CardSkeleton = ({ className = '' }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm ${className}`}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <div className="pt-2 flex gap-2">
      <Skeleton className="h-8 w-24 rounded-lg" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  </div>
);

export const PageLoading = ({ message = 'Loading...' }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[350px] space-y-4">
    <div className="w-full max-w-md space-y-3">
      <Skeleton className="h-8 w-1/2 mx-auto" />
      <Skeleton className="h-4 w-3/4 mx-auto" />
      <div className="grid grid-cols-2 gap-3 pt-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    </div>
    {message && (
      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{message}</p>
    )}
  </div>
);

export const Loading = {
  Spinner: LoadingSpinner,
  Skeleton: Skeleton,
  CardSkeleton: CardSkeleton,
  Page: PageLoading,
};

export default Loading;
