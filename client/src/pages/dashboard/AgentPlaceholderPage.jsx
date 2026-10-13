import React from 'react';
import { Bot, Sparkles, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AgentPlaceholderPage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-5xl font-sans">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Application Assistant
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Candidate assistance for application preparation and job matching.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center shadow-sm dark:shadow-black/40 space-y-4 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center border border-blue-100/60 dark:border-blue-900/60">
          <Bot className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Assistant Ready</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Your candidate profile is connected and verified. The assistant helps analyze job requirements and organize your applications.
          </p>
        </div>
        <div className="pt-2 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/jobs')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            Explore Matching Jobs
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentPlaceholderPage;
