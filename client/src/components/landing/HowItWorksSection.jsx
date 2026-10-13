import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FileUp,
  Search,
  ClipboardList,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export const HowItWorksSection = () => {
  const shouldReduceMotion = useReducedMotion();

  const steps = [
    {
      step: '01',
      title: 'Upload your resume',
      description:
        'Upload your PDF or DOCX file to extract your skills, work history, and background into a structured, editable profile.',
      icon: FileUp,
      details: ['Structured skills extraction', 'Work history & project mapping', 'Full profile control'],
    },
    {
      step: '02',
      title: 'Discover relevant roles',
      description:
        'Search and filter open opportunities that align with your experience, with clear match indicators for each position.',
      icon: Search,
      details: ['Skill match breakdown', 'Role & keyword filtering', 'Remote and location options'],
    },
    {
      step: '03',
      title: 'Track your applications',
      description:
        'Keep all your applications, interview stages, and status updates organized in one centralized workspace.',
      icon: ClipboardList,
      details: ['Stage-by-stage tracking', 'Saved opportunities', 'Complete search history'],
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 bg-white dark:bg-[#070D18] border-b border-slate-200/60 dark:border-slate-800/80 scroll-mt-20 font-sans transition-colors duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16 space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Your application journey</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1930] dark:text-slate-100 tracking-tight">
            Three simple steps to your next job
          </h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
            From parsing your resume to tracking interviews, experience a calm, organized job search workflow.
          </p>
        </motion.div>

        {/* 3 Step Distinct Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{
                  duration: 0.45,
                  delay: idx * 0.1,
                }}
                whileHover={
                  shouldReduceMotion
                    ? {}
                    : { y: -4, transition: { duration: 0.2 } }
                }
                className="rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/40 transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-mono text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                      {item.step}
                    </span>
                    <div className="w-11 h-11 rounded-xl bg-blue-100/70 dark:bg-blue-950/70 border border-blue-200/60 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                  {item.details.map((detail, dIdx) => (
                    <div key={dIdx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
