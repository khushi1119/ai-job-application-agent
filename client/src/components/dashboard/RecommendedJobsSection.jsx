import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Building,
  MapPin,
  Bookmark,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Send,
  CheckCircle2,
  Sparkles,
  User,
  FileText,
  Search,
} from 'lucide-react';
import { jobService } from '../../services/api.js';
import { formatJobFreshness } from '../../utils/helpers.js';

/**
 * RecommendedJobsSection
 * Professional job portal presentation for real ML job recommendations.
 * - Prominent employer branding
 * - Clear job title and location
 * - Subtle, neutral match percentage indicator
 * - Real matched skills only (no invented chips or fallback fake labels)
 * - Platform badges (Greenhouse/Lever) excluded from main card view
 * - Protected against duplicate concurrent requests and rapid retries
 * - Consistent Light & Dark theme support
 */
export const RecommendedJobsSection = ({
  savedJobIds = new Set(),
  savingJobId = null,
  onToggleSave,
  trackedJobIds = new Set(),
  onTrackJob,
}) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emptyProfile, setEmptyProfile] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState('');
  const [personalization, setPersonalization] = useState(null);

  const abortControllerRef = useRef(null);
  const isInFlightRef = useRef(false);

  const fetchRecommendations = useCallback(async (options = {}) => {
    const isManualRefresh = Boolean(options?.refresh);

    // Prevent duplicate initial or overlapping automated requests
    if (isInFlightRef.current && !isManualRefresh) {
      return;
    }

    // Cancel previous in-flight call if explicitly refreshing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    isInFlightRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const response = await jobService.getRecommendedJobs(
        { topK: 20 },
        { signal: controller.signal, forceRefresh: isManualRefresh }
      );

      const data = response?.data || response;
      const jobList = Array.isArray(data?.jobs) ? data.jobs : [];
      const isProfileEmpty = Boolean(data?.emptyProfile);

      setEmptyProfile(isProfileEmpty);
      setEmptyMessage(data?.message || response?.message || '');
      setPersonalization(data?.personalization || null);
      setRecommendations(jobList);
    } catch (err) {
      // Ignore user-aborted / cleanup cancellations cleanly
      if (
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.message === 'canceled'
      ) {
        return;
      }
      setError(err?.message || 'Failed to load recommendations. Please try again.');
      setRecommendations([]);
    } finally {
      if (abortControllerRef.current === controller) {
        isInFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
    return () => {
      // Cleanup in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRecommendations]);

  return (
    <div className="space-y-5 font-sans">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Recommended for You
            </h2>
            {personalization?.detectedDomainLabel && personalization?.detectedDomain !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shadow-2xs">
                <Sparkles className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                <span>{personalization.detectedDomainLabel}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {personalization?.evidenceSummary || 'Ranked by relevance to your verified resume, skills, and background.'}
          </p>
        </div>

        {!loading && !error && recommendations.length > 0 && (
          <button
            type="button"
            onClick={() => fetchRecommendations({ refresh: true })}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm animate-pulse flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-2.5 w-full sm:w-2/3">
                <div className="flex items-center gap-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" />
                  <div className="h-4 bg-slate-100 dark:bg-slate-850 rounded w-16" />
                </div>
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="flex gap-1.5 pt-1">
                  <div className="h-5 bg-slate-100 dark:bg-slate-850 rounded w-16" />
                  <div className="h-5 bg-slate-100 dark:bg-slate-850 rounded w-20" />
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        /* Real API Error State - No fake fallbacks */
        <div className="bg-red-50/70 dark:bg-red-950/40 rounded-2xl border border-red-200/80 dark:border-red-800/60 p-8 text-center shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Unable to load recommendations
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            {error}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => fetchRecommendations({ refresh: true })}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : emptyProfile ? (
        /* State A: Incomplete Profile / Missing Resume */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-10 sm:p-12 text-center shadow-sm space-y-4 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center shadow-xs border border-blue-100/60 dark:border-blue-900/60">
            <User className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Complete your profile to get recommendations
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {emptyMessage ||
                'Add your skills, experience, or upload your resume to receive tailored recommendations.'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/onboarding/profile"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Complete Profile</span>
            </Link>
            <Link
              to="/dashboard/resume"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Upload Resume</span>
            </Link>
          </div>
        </div>
      ) : recommendations.length === 0 ? (
        /* State B: Usable Profile, but No Qualifying India/Remote Matches */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-10 sm:p-12 text-center shadow-sm space-y-4 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mx-auto flex items-center justify-center shadow-xs">
            <Building className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              No matching India or remote roles found
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              {emptyMessage ||
                'No sufficiently relevant openings were found among current India-based or eligible remote listings. You can browse all international positions or check back later.'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dashboard/jobs"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Search All Jobs</span>
            </Link>
            <button
              type="button"
              onClick={() => fetchRecommendations({ refresh: true })}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Check Again</span>
            </button>
          </div>
        </div>
      ) : (
        /* Professional Job Portal Card Presentation */
        <div className="space-y-4">
          {recommendations.map((job) => {
            const jobId = (job._id || job.id)?.toString();
            const isSaved = jobId ? savedJobIds.has(jobId) : false;
            const isToggling = savingJobId === jobId;
            const isTracked = jobId ? trackedJobIds.has(jobId) : false;
            const matchPct = typeof job.matchPercentage === 'number' ? job.matchPercentage : 0;
            const hasMatchedSkills = Array.isArray(job.matchedSkills) && job.matchedSkills.length > 0;

            return (
              <div
                key={jobId || job.sourceUrl}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow dark:hover:shadow-black/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  {/* Employer Name (Prominent) + Subtle Match Indicator */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <Building className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">
                        {job.company}
                      </span>
                    </div>

                    {/* Subtle, neutral match badge (not dominant) */}
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 font-mono">
                      {matchPct}% match
                    </span>

                    {/* Seniority Tier Badge */}
                    {job.seniorityLabel && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                          job.seniorityTier === 1
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                            : job.seniorityTier === 3 || job.seniorityTier === 4
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'
                        }`}
                      >
                        {job.seniorityLabel}
                      </span>
                    )}

                    {/* Freshness Badge (Verified Listings Only) */}
                    {formatJobFreshness(job.lastVerifiedAt) && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                        {formatJobFreshness(job.lastVerifiedAt)}
                      </span>
                    )}
                  </div>

                  {/* Job Title - Clear & Readable */}
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                    {job.title}
                  </h3>

                  {/* Location & Salary Details */}
                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>{job.location || 'Remote'}</span>
                    </span>

                    {job.salaryRange && (job.salaryRange.min || job.salaryRange.max) && (
                      <span className="text-slate-500 dark:text-slate-400">
                        • ${Number(job.salaryRange.min || 0).toLocaleString()} - $
                        {Number(job.salaryRange.max || 0).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Real Matched Skills from ML Response only */}
                  {hasMatchedSkills && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-0.5">
                        Matched skills:
                      </span>
                      {job.matchedSkills.map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 font-medium capitalize"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions: Save, Track, Apply */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                  {/* Bookmark Button */}
                  {onToggleSave && (
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => onToggleSave(job)}
                      className={`p-2 rounded-xl border transition-all ${
                        isSaved
                          ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                      title={isSaved ? 'Remove from saved jobs' : 'Save job'}
                      aria-label={isSaved ? 'Remove from saved jobs' : 'Save job'}
                    >
                      {isToggling ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                      )}
                    </button>
                  )}

                  {/* Track Application Button */}
                  {onTrackJob && (
                    <button
                      type="button"
                      onClick={() => onTrackJob(job)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        isTracked
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                      title={isTracked ? 'Application tracked' : 'Track this application'}
                    >
                      {isTracked ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Tracked</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Track</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Apply Now External Link */}
                  {job.sourceUrl && (
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                    >
                      <span>Apply Now</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecommendedJobsSection;
