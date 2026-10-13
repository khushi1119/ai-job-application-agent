import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Briefcase,
  MapPin,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Search,
  Calendar,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { savedJobService, applicationService } from '../../services/api.js';
import { formatJobFreshness } from '../../utils/helpers.js';
import { TrackApplicationModal } from '../../components/dashboard/TrackApplicationModal.jsx';

export const SavedJobsPlaceholderPage = () => {
  const navigate = useNavigate();

  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unsavingJobId, setUnsavingJobId] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Application tracking state
  const [trackedJobIds, setTrackedJobIds] = useState(new Set());
  const [jobToTrack, setJobToTrack] = useState(null);

  // Fetch saved jobs for current user
  const fetchSavedJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await savedJobService.getSavedJobs();
      const list = res?.data?.savedJobs || res?.savedJobs || [];
      setSavedJobs(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Failed to load saved jobs');
      setSavedJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tracked job IDs
  const fetchTrackedJobIds = useCallback(async () => {
    try {
      const res = await applicationService.getTrackedJobIds();
      const ids = res?.data?.ids || res?.ids || [];
      setTrackedJobIds(new Set(ids.map(String)));
    } catch (err) {
      console.warn('Failed to fetch tracked job IDs in saved jobs:', err);
    }
  }, []);

  useEffect(() => {
    fetchSavedJobs();
    fetchTrackedJobIds();
  }, [fetchSavedJobs, fetchTrackedJobIds]);

  // Remove / unsave job with optimistic update
  const handleUnsave = async (jobId) => {
    if (!jobId || unsavingJobId) return;

    setUnsavingJobId(jobId);
    const previousSavedJobs = [...savedJobs];

    // Optimistically remove from state
    setSavedJobs((prev) =>
      prev.filter((item) => {
        const id = item.job?._id?.toString() || item.job?.id?.toString() || item._id?.toString();
        return id !== jobId;
      })
    );

    try {
      await savedJobService.unsaveJob(jobId);
    } catch (err) {
      // Revert optimistic removal on failure
      setSavedJobs(previousSavedJobs);
      setError(err.message || 'Failed to remove saved job. Please try again.');
    } finally {
      setUnsavingJobId(null);
    }
  };

  // Format savedAt timestamp
  const formatSavedDate = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Filter saved jobs locally by title / company
  const displayedJobs = savedJobs.filter((item) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    const title = (item.job?.title || '').toLowerCase();
    const company = (item.job?.company || '').toLowerCase();
    return title.includes(term) || company.includes(term);
  });

  return (
    <div className="space-y-6 max-w-5xl font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Saved Jobs
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review bookmarked positions and keep track of roles you're interested in.
          </p>
        </div>

        {/* Count Badge */}
        {!loading && savedJobs.length > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold self-start sm:self-auto border border-blue-100 dark:border-blue-900/60">
            <Bookmark className="w-3.5 h-3.5 fill-blue-600 dark:fill-blue-400 text-blue-600 dark:text-blue-400" />
            <span>
              {savedJobs.length} {savedJobs.length === 1 ? 'saved role' : 'saved roles'}
            </span>
          </div>
        )}
      </div>

      {/* Search Filter when multiple jobs are saved */}
      {!loading && savedJobs.length > 2 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter saved roles by title or company..."
            className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 pl-10 pr-4 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all shadow-sm"
          />
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        /* Loading Skeletons */
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm animate-pulse flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-2.5 w-full sm:w-2/3">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-24" />
                  <div className="h-4 bg-slate-100 dark:bg-slate-850 rounded-md w-16" />
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
        /* Error State with Retry Button */
        <div className="bg-red-50/70 dark:bg-red-950/40 rounded-2xl border border-red-200/80 dark:border-red-800/60 p-8 text-center shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Unable to load saved jobs
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            {error}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={fetchSavedJobs}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : savedJobs.length === 0 ? (
        /* Clean Preserved Empty State */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center shadow-sm dark:shadow-black/40 space-y-4 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center border border-blue-100/60 dark:border-blue-900/60">
            <Bookmark className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No saved jobs yet</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              You haven't bookmarked any job listings. Save roles you find interesting to view and apply later.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard/jobs')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors inline-flex items-center gap-2"
            >
              <Briefcase className="w-4 h-4" />
              <span>Discover Jobs</span>
            </button>
          </div>
        </div>
      ) : displayedJobs.length === 0 ? (
        /* Local Search Filter Empty State */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-10 text-center shadow-sm space-y-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">No matching saved jobs</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            No saved listings matched "{searchFilter}".
          </p>
          <button
            type="button"
            onClick={() => setSearchFilter('')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 pt-1"
          >
            Clear filter
          </button>
        </div>
      ) : (
        /* Saved Jobs Cards List */
        <div className="space-y-4">
          {displayedJobs.map((item) => {
            const job = item.job || {};
            const jobId = (job._id || job.id)?.toString();
            const isUnsaving = unsavingJobId === jobId;

            return (
              <div
                key={item._id || jobId}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow dark:hover:shadow-black/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {job.company || 'Unknown Company'}
                    </span>
                    {job.platform && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium capitalize border border-blue-100/60 dark:border-blue-900/40">
                        {job.platform}
                      </span>
                    )}
                    {formatJobFreshness(job.lastVerifiedAt) && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                        {formatJobFreshness(job.lastVerifiedAt)}
                      </span>
                    )}
                    {item.savedAt && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 ml-auto sm:ml-0">
                        <Calendar className="w-3 h-3" />
                        <span>Saved {formatSavedDate(item.savedAt)}</span>
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {job.title || 'Untitled Position'}
                  </h4>

                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{job.location || 'Remote'}</span>
                  </p>

                  {Array.isArray(job.requirements) && job.requirements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.requirements.slice(0, 4).map((req, rIdx) => (
                        <span
                          key={rIdx}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[280px]"
                          title={req}
                        >
                          {req}
                        </span>
                      ))}
                      {job.requirements.length > 4 && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                          +{job.requirements.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                  {/* Bookmark Button to Unsave */}
                  <button
                    type="button"
                    disabled={isUnsaving}
                    onClick={() => handleUnsave(jobId)}
                    className="p-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Remove from saved jobs"
                  >
                    <Bookmark
                      className={`w-4 h-4 fill-current ${
                        isUnsaving ? 'animate-pulse scale-90' : ''
                      }`}
                    />
                  </button>

                  {/* Track Application Button */}
                  {trackedJobIds.has(jobId) ? (
                    <span
                      className="px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5"
                      title="Application is tracked in your Applications list"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Tracked</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setJobToTrack(job)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                      title="Track application"
                    >
                      <Send className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                      <span>Track</span>
                    </button>
                  )}

                  {/* Apply Now Official External Link */}
                  {job.sourceUrl ? (
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Apply Now</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Explicit Track Application Confirmation Modal */}
      <TrackApplicationModal
        isOpen={Boolean(jobToTrack)}
        onClose={() => setJobToTrack(null)}
        initialData={
          jobToTrack
            ? {
                jobId: jobToTrack._id || jobToTrack.id,
                company: jobToTrack.company,
                jobTitle: jobToTrack.title,
                applicationUrl: jobToTrack.sourceUrl,
                status: 'Applied',
              }
            : null
        }
        onApplicationTracked={(created) => {
          const id = (
            created.jobId?._id ||
            created.jobId ||
            jobToTrack?._id ||
            jobToTrack?.id
          )?.toString();
          if (id) {
            setTrackedJobIds((prev) => new Set([...prev, id]));
          }
          setJobToTrack(null);
        }}
      />
    </div>
  );
};

export default SavedJobsPlaceholderPage;
