import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  CheckCircle2,
  Building2,
  MapPin,
  Search,
  Bookmark,
  Calendar,
  Sparkles,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';

export const HeroSection = ({ onSeeHowItWorks }) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // Gentle float animations (4-6px movement), strictly respecting prefers-reduced-motion
  const floatCard1 = shouldReduceMotion
    ? {}
    : {
        y: [0, -5, 0],
        transition: {
          duration: 5.5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };

  const floatCard2 = shouldReduceMotion
    ? {}
    : {
        y: [0, 5, 0],
        transition: {
          duration: 4.8,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.6,
        },
      };

  const floatCard3 = shouldReduceMotion
    ? {}
    : {
        y: [0, -4, 0],
        transition: {
          duration: 5.2,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1.2,
        },
      };

  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-[#EEF4FF] to-[#E9F0FE] dark:from-[#080E1A] dark:via-[#0B1528] dark:to-[#080E1A] border-b border-blue-100/60 dark:border-slate-800/80 font-sans transition-colors duration-300">
      {/* Background ambient lighting */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-gradient-to-r from-blue-200/35 via-indigo-100/35 to-cyan-100/25 dark:from-blue-600/10 dark:via-indigo-600/10 dark:to-cyan-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headline and CTAs */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            {/* Small Product Badge */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Career platform</span>
            </motion.div>

            {/* Headline with natural human-friendly copy */}
            <motion.h1
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0B1930] dark:text-slate-100 tracking-tight leading-[1.12]"
            >
              Find the right job.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 dark:from-blue-400 dark:via-indigo-400 dark:to-blue-300">
                Take the next step.
              </span>
            </motion.h1>

            {/* Supporting Text */}
            <motion.p
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              Discover relevant opportunities and keep your applications organized.
            </motion.p>

            {/* Primary Actions: Find Jobs & Upload Resume */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2"
            >
              <Button
                size="lg"
                variant="primary"
                leftIcon={Search}
                onClick={() => navigate('/dashboard/jobs')}
                className="w-full sm:w-auto px-7 py-3 text-sm sm:text-base font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 transition-all"
              >
                Find Jobs
              </Button>
              <Button
                size="lg"
                variant="secondary"
                leftIcon={FileText}
                onClick={() => navigate('/onboarding/resume')}
                className="w-full sm:w-auto px-6 py-3 text-sm sm:text-base font-semibold border-slate-200/90 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800 shadow-sm"
              >
                Upload Resume
              </Button>
            </motion.div>

            {/* Quick Value Highlights */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.32 }}
              className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs text-slate-500 dark:text-slate-400 font-medium"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Structured resume parsing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Role match scoring</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Application tracking</span>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Visually polished job-search preview with 2-3 overlapping floating cards */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-6 max-w-xl mx-auto w-full relative"
          >
            {/* Top Sample Data Tag */}
            <div className="flex items-center justify-between px-2 mb-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Job Search &amp; Application Overview
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Sample preview
              </span>
            </div>

            {/* Floating Card Stack Container */}
            <div className="relative pt-4 pb-6">
              {/* Card 1: Main Job Match Card (Centerpiece) */}
              <motion.div
                animate={floatCard1}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_16px_40px_-8px_rgba(11,25,48,0.08),0_4px_16px_-2px_rgba(11,25,48,0.03)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.4)] p-5 sm:p-6 space-y-4 relative z-10 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        Senior Frontend Engineer
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Linear</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" /> Remote
                        </span>
                      </p>
                    </div>
                  </div>

                  <Badge variant="success" size="sm" className="shrink-0 font-bold">
                    88% Match
                  </Badge>
                </div>

                {/* Job Metadata Tags */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    Full-time
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    $135,000 - $160,000
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200/60 dark:border-emerald-800/60">
                    Matches your React &amp; TypeScript skills
                  </span>
                </div>

                {/* Skill Overlap Badges */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Skills: React, TypeScript, Next.js, Tailwind</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/jobs')}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-0.5 text-xs"
                  >
                    <span>View</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>

              {/* Card 2: Floating Tracked Application (Top-Right / Overlapping) */}
              <motion.div
                animate={floatCard2}
                className="sm:absolute sm:-top-3 sm:-right-4 w-full sm:w-72 mt-3 sm:mt-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-lg shadow-slate-900/5 dark:shadow-black/30 p-3.5 space-y-2 z-20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Application Tracked</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Stripe &bull; Frontend Platform</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Interview
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Technical Round
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Scheduled</span>
                </div>
              </motion.div>

              {/* Card 3: Floating Resume Parsed Pill (Bottom-Left / Overlapping) */}
              <motion.div
                animate={floatCard3}
                className="sm:absolute sm:-bottom-4 sm:-left-4 w-full sm:w-80 mt-3 sm:mt-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-lg shadow-slate-900/5 dark:shadow-black/30 p-3.5 space-y-2 z-20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Resume details extracted</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Candidate_Resume.pdf</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Parsed
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <TrendingUp className="w-3 h-3 text-blue-500" />
                  <span>14 skills &amp; 4 years experience identified</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
