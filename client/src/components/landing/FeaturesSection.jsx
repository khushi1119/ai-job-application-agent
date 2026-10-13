import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FileText,
  Compass,
  Sparkles,
  Send,
  CheckCircle,
  Target,
} from 'lucide-react';

export const FeaturesSection = () => {
  const shouldReduceMotion = useReducedMotion();

  const features = [
    {
      title: 'Resume Details Extraction',
      description:
        'Extract your technical skills, work experience, projects, and education into a structured candidate profile without manual data entry.',
      icon: FileText,
      badge: 'Profile Parsing',
      points: ['Structured skill extraction', 'Experience & project mapping', 'Editable profile view'],
      accentColor: 'blue',
    },
    {
      title: 'Job Match Relevance',
      description:
        'Compare your qualifications directly against role descriptions. Review calculated fit scores to focus your efforts on the strongest matches.',
      icon: Target,
      badge: 'Matching Engine',
      points: ['Skill overlap percentage', 'Experience level alignment', 'Tailored recommendations'],
      accentColor: 'cyan',
    },
    {
      title: 'Application Pipeline',
      description:
        'Organize your submissions across clear stages: Applied, Interview, Offer, and Rejected with centralized tracking.',
      icon: Send,
      badge: 'Tracker',
      points: ['Stage status updates', 'Company and role indexing', 'Personal application notes'],
      accentColor: 'blue',
    },
    {
      title: 'Role Discovery & Filters',
      description:
        'Search verified opportunities across tech companies and boards, filtered by location, seniority, and work style.',
      icon: Compass,
      badge: 'Discovery',
      points: ['Remote and hybrid filters', 'Keyword and role search', 'Direct board links'],
      accentColor: 'cyan',
    },
  ];

  return (
    <section
      id="features"
      className="py-20 md:py-28 bg-[#F1F6FF] dark:bg-[#0A1324] border-b border-blue-100/60 dark:border-slate-800/80 scroll-mt-20 font-sans transition-colors duration-300"
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
            <span>Core Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1930] dark:text-slate-100 tracking-tight">
            Built for modern candidates
          </h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
            Everything you need to discover relevant roles and manage your applications efficiently.
          </p>
        </motion.div>

        {/* 4 Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            const isCyan = feature.accentColor === 'cyan';

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
                    : { y: -3, transition: { duration: 0.2 } }
                }
                className="rounded-2xl p-6 sm:p-8 flex flex-col justify-between border border-blue-100/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:shadow-blue-900/5 dark:hover:shadow-black/30 transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs ${
                        isCyan
                          ? 'bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200/80 dark:border-cyan-800/60 text-cyan-600 dark:text-cyan-400'
                          : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        isCyan
                          ? 'bg-cyan-50/70 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border-cyan-200/70 dark:border-cyan-800'
                          : 'bg-blue-50/70 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200/70 dark:border-blue-800'
                      }`}
                    >
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">
                    {feature.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                    {feature.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {feature.points.map((pt, pIdx) => (
                    <div key={pIdx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      <CheckCircle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isCyan ? 'text-cyan-500' : 'text-blue-500'
                        }`}
                      />
                      <span>{pt}</span>
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

export default FeaturesSection;
