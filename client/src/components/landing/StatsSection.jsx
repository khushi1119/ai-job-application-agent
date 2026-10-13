import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Zap, Target, ShieldCheck, CheckCircle } from 'lucide-react';

export const StatsSection = () => {
  const stats = [
    {
      label: 'Target Processing Speed',
      value: '< 45s',
      detail: 'Simulated role evaluation and field mapping',
      icon: Zap,
    },
    {
      label: 'Match Confidence Target',
      value: '95%+',
      detail: 'Semantic keyword and skill graph alignment',
      icon: Target,
    },
    {
      label: 'Projected Time Saved',
      value: '20+ hrs/wk',
      detail: 'Estimated reduction in repetitive manual inputs',
      icon: Clock,
    },
    {
      label: 'ATS Compatibility Goal',
      value: 'High-Precision',
      detail: 'Engineered for standard application schemas',
      icon: ShieldCheck,
    },
  ];

  const platforms = [
    'Greenhouse',
    'Lever',
    'Ashby',
    'Workday',
    'SmartRecruiters',
    'LinkedIn Direct',
  ];

  return (
    <section className="py-12 border-y border-dark-border bg-dark-900/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header / Disclaimer */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs font-mono text-slate-400">
            <span className="text-neon-lime">&bull;</span> Simulated Architecture Benchmarks
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Workflow Target Specs</span>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="glass-card glass-card-hover p-6 rounded-2xl relative overflow-hidden group"
              >
                <div className="w-10 h-10 rounded-xl bg-neon-lime-bg border border-neon-lime-border flex items-center justify-center text-neon-lime mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-neon-lime" />
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1 font-mono">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-slate-200 mb-1">
                  {stat.label}
                </div>
                <div className="text-xs text-slate-400">
                  {stat.detail}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Supported Platforms ticker/bar */}
        <div className="mt-12 pt-8 border-t border-dark-border/60 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-neon-lime" />
            <span>Target Applicant Tracking Systems & Career Portals</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {platforms.map((platform, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-lg bg-dark-850 border border-dark-border text-xs font-medium text-slate-300 hover:border-neon-lime-border transition-colors"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
