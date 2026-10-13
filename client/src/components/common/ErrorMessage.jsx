import React from 'react';
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

export const ErrorMessage = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry = null,
  onDismiss = null,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`glass-card border-red-500/30 bg-red-950/20 text-red-200 rounded-xl p-4 flex items-start gap-3 shadow-lg ${className}`}
    >
      <div className="p-1 rounded-lg bg-red-500/10 text-red-400 mt-0.5 shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-red-300">{title}</h4>
        <p className="text-xs text-red-200/80 mt-1 break-words">{message}</p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors border border-red-500/30"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-400 hover:text-red-200 transition-colors p-1"
          aria-label="Dismiss error"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
