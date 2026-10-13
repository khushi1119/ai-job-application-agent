import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles, FileText, Search } from 'lucide-react';

export const FinalCtaSection = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="py-20 md:py-28 bg-white dark:bg-[#070D18] font-sans relative overflow-hidden transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 20 }
          }
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl p-8 sm:p-12 lg:p-16 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 dark:from-blue-900 dark:via-indigo-900 dark:to-blue-950 text-white shadow-2xl shadow-blue-950/20 dark:shadow-black/50 border border-blue-400/25 dark:border-blue-700/40 overflow-hidden text-center max-w-4xl mx-auto"
        >
          {/* Subtle decorative background ambient glows */}
          <div className="absolute -right-12 -bottom-12 w-72 h-72 rounded-full bg-white/10 dark:bg-white/5 blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -top-12 w-72 h-72 rounded-full bg-indigo-300/15 dark:bg-indigo-300/5 blur-3xl pointer-events-none" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Ready to start?</span>
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight max-w-2xl mx-auto">
            Find the right job. Take the next step.
          </h2>

          {/* Subtitle */}
          <p className="mt-4 text-sm sm:text-base text-blue-100 dark:text-blue-200 max-w-xl mx-auto leading-relaxed">
            Discover relevant opportunities and keep your applications organized in one place.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/jobs')}
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-blue-700 hover:bg-blue-50 text-sm sm:text-base font-bold rounded-xl shadow-lg shadow-black/10 transition-all flex items-center justify-center gap-2 group"
            >
              <Search className="w-4 h-4 text-blue-600" />
              <span>Find Jobs</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/onboarding/resume')}
              className="w-full sm:w-auto px-7 py-3.5 bg-blue-800/60 hover:bg-blue-800/80 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-white border border-white/25 dark:border-slate-700 text-sm sm:text-base font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>Upload Resume</span>
            </button>
          </div>

          {/* Highlights */}
          <div className="mt-8 pt-6 border-t border-white/15 flex flex-wrap items-center justify-center gap-6 text-xs text-blue-100 dark:text-blue-200 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
              <span>Structured resume extraction</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
              <span>Qualification match scoring</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
              <span>Centralized application tracking</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCtaSection;
