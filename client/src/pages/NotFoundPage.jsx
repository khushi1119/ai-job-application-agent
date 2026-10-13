import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-[#F6F8FC] dark:bg-[#070D18] min-h-[60vh] font-sans transition-colors">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-10 max-w-md w-full text-center border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
        <span className="text-5xl font-black text-blue-600 dark:text-blue-500 font-mono">404</span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Page Not Found</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          The requested page does not exist or has been moved.
        </p>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
