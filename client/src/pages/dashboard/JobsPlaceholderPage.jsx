import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  Search,
  MapPin,
  Filter,
  Bookmark,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Send,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { jobService, savedJobService, applicationService } from '../../services/api.js';
import { filterJobsByPills } from '../../utils/jobFilters.js';
import { formatJobFreshness } from '../../utils/helpers.js';
import { TrackApplicationModal } from '../../components/dashboard/TrackApplicationModal.jsx';
import { RecommendedJobsSection } from '../../components/dashboard/RecommendedJobsSection.jsx';

export const JobsPlaceholderPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const initialTab = searchParams.get('tab') || (urlQuery ? 'all' : 'recommended');
  const [activeTab, setActiveTab] = useState(initialTab);

  const [keyword, setKeyword] = useState(urlQuery);
  const [location, setLocation] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    remote: false,
    fullTime: false,
    internship: false,
    experience: false,
  });

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(initialTab === 'all');
  const [error, setError] = useState(null);
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [savingJobId, setSavingJobId] = useState(null);
  const [saveActionError, setSaveActionError] = useState(null);
  const hasFetchedAllJobsRef = useRef(false);

  // Personalized domain state
  const [selectedDomain, setSelectedDomain] = useState('auto');
  const [personalization, setPersonalization] = useState(null);

  // Application tracking state
  const [trackedJobIds, setTrackedJobIds] = useState(new Set());
  const [jobToTrack, setJobToTrack] = useState(null);

  // Fetch saved job IDs for O(1) bookmark state lookup
  const fetchSavedJobIds = useCallback(async () => {
    try {
      const res = await savedJobService.getSavedJobIds();
      const ids = res?.data?.ids || res?.ids || [];
      setSavedJobIds(new Set(ids.map(String)));
    } catch (err) {
      console.warn('Failed to fetch saved job IDs:', err);
    }
  }, []);

  // Fetch tracked job IDs for O(1) application tracking status
  const fetchTrackedJobIds = useCallback(async () => {
    try {
      const res = await applicationService.getTrackedJobIds();
      const ids = res?.data?.ids || res?.ids || [];
      setTrackedJobIds(new Set(ids.map(String)));
    } catch (err) {
      console.warn('Failed to fetch tracked job IDs:', err);
    }
  }, []);

  useEffect(() => {
    fetchSavedJobIds();
    fetchTrackedJobIds();
  }, [fetchSavedJobIds, fetchTrackedJobIds]);

  // Handle saving and unsaving jobs with optimistic UI update
  const handleToggleSave = async (job) => {
    const jobId = (job._id || job.id)?.toString();
    if (!jobId || savingJobId) return;

    const wasSaved = savedJobIds.has(jobId);
    setSavingJobId(jobId);
    setSaveActionError(null);

    // Optimistic state toggle
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });

    try {
      if (wasSaved) {
        await savedJobService.unsaveJob(jobId);
      } else {
        await savedJobService.saveJob(jobId);
      }
    } catch (err) {
      // Revert optimistic update on failure
      setSavedJobIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) {
          next.add(jobId);
        } else {
          next.delete(jobId);
        }
        return next;
      });
      setSaveActionError(err.message || 'Failed to update saved job status');
    } finally {
      setSavingJobId(null);
    }
  };

  // Fetch jobs from backend API
  const fetchJobs = useCallback(
    async (searchKeyword = keyword, searchLocation = location, domainOverride = selectedDomain) => {
      setLoading(true);
      setError(null);

      try {
        const params = {};
        const trimmedKeyword = (searchKeyword || '').trim();
        const trimmedLocation = (searchLocation || '').trim();

        if (trimmedKeyword) {
          params.q = trimmedKeyword;
        }

        if (trimmedLocation) {
          params.location = trimmedLocation;
        } else if (activeFilters.remote) {
          params.location = 'Remote';
        }

        if (domainOverride && domainOverride !== 'auto') {
          params.domain = domainOverride;
        }

        const response = await jobService.getJobs(params);
        const jobList = response?.data?.jobs || response?.jobs || [];
        const persData = response?.data?.personalization || response?.personalization || null;

        setJobs(Array.isArray(jobList) ? jobList : []);
        setPersonalization(persData);
      } catch (err) {
        setError(err.message || 'Failed to load job listings');
        setJobs([]);
      } finally {
        setLoading(false);
      }
    },
    [keyword, location, activeFilters.remote, selectedDomain]
  );

  // Lazy-load Search All Jobs only when activeTab === 'all'
  useEffect(() => {
    if (activeTab === 'all' && !hasFetchedAllJobsRef.current) {
      hasFetchedAllJobsRef.current = true;
      fetchJobs();
    }
  }, [activeTab, fetchJobs]);

  // Sync keyword input if navigated with URL query params
  useEffect(() => {
    if (urlQuery && urlQuery !== keyword) {
      setKeyword(urlQuery);
      if (activeTab === 'all') {
        fetchJobs(urlQuery, location);
      }
    }
  }, [urlQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeTab !== 'all') {
      setActiveTab('all');
    }
    fetchJobs(keyword, location);
  };

  const handleDomainChange = (domainId) => {
    setSelectedDomain(domainId);
    fetchJobs(keyword, location, domainId);
  };

  const toggleFilter = (filterKey) => {
    setActiveFilters((prev) => {
      const next = { ...prev, [filterKey]: !prev[filterKey] };
      return next;
    });
  };

  const handleClearFilters = () => {
    setActiveFilters({
      remote: false,
      fullTime: false,
      internship: false,
      experience: false,
    });
    setKeyword('');
    setLocation('');
    fetchJobs('', '');
  };

  // Synchronize URL parameters with active tab and search query
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    if (keyword) {
      nextParams.set('q', keyword);
    }
    setSearchParams(nextParams, { replace: true });
  };

  // Client-side filtering across active pills
  const filteredJobs = filterJobsByPills(jobs, activeFilters);

  const filterOptions = [
    { key: 'remote', label: 'Remote Only' },
    { key: 'fullTime', label: 'Full-Time' },
    { key: 'internship', label: 'Internship / Entry' },
    { key: 'experience', label: '0-2 Yrs Experience' },
  ];

  const hasActiveFiltersOrSearch =
    activeFilters.remote ||
    activeFilters.fullTime ||
    activeFilters.internship ||
    activeFilters.experience ||
    keyword.trim() !== '' ||
    location.trim() !== '';

  return (
    <div className="space-y-6 max-w-5xl font-sans">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Discover Jobs
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Explore and apply to active tech roles tailored to your verified candidate profile.
        </p>
      </div>

      {/* Tabs: Recommended for You vs Search All Jobs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleTabChange('recommended')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'recommended'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Recommended for You</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'all'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Search All Jobs</span>
        </button>
      </div>

      {/* Tab 1: Recommended for You */}
      {activeTab === 'recommended' ? (
        <RecommendedJobsSection
          savedJobIds={savedJobIds}
          savingJobId={savingJobId}
          onToggleSave={handleToggleSave}
          trackedJobIds={trackedJobIds}
          onTrackJob={(job) => setJobToTrack(job)}
        />
      ) : (
        /* Tab 2: Search All Jobs */
        <div className="space-y-6">
          {/* Search Bar & Filters Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm dark:shadow-black/40 space-y-4 transition-colors">
            <form
              onSubmit={handleSearchSubmit}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3"
            >
              {/* Keyword / Role / Company input */}
              <div className="relative sm:col-span-6">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search by role, company, or keyword..."
                  className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 py-2.5 outline-none focus:bg-white dark:focus:bg-slate-850 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                />
              </div>

              {/* Location input */}
              <div className="relative sm:col-span-4">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location (e.g. Remote, SF)..."
                  className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 py-2.5 outline-none focus:bg-white dark:focus:bg-slate-850 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                />
              </div>

              {/* Search Button */}
              <button
                type="submit"
                disabled={loading}
                className="sm:col-span-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Search</span>
                )}
              </button>
            </form>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </span>

              {filterOptions.map((f) => {
                const isSelected = activeFilters[f.key];
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleFilter(f.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Career Domain Filter Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium mr-1 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Domain:</span>
                  </span>
                  {(personalization?.availableDomains || [
                    { id: 'all', label: 'All Domains' },
                    { id: 'tech', label: 'Software & IT' },
                    { id: 'data', label: 'Data & Analytics' },
                    { id: 'finance', label: 'Finance & Commerce' },
                    { id: 'business', label: 'Business & Management' },
                    { id: 'marketing_hr', label: 'Marketing & HR' },
                  ]).map((dom) => {
                    const currentDom = selectedDomain === 'auto'
                      ? (personalization?.activeDomain || 'all')
                      : selectedDomain;
                    const isSelected = currentDom === dom.id;
                    return (
                      <button
                        key={dom.id}
                        type="button"
                        onClick={() => handleDomainChange(dom.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {dom.label}
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const currentDom = selectedDomain === 'auto'
                    ? (personalization?.activeDomain || 'all')
                    : selectedDomain;
                  if (currentDom !== 'all') {
                    return (
                      <button
                        type="button"
                        onClick={() => handleDomainChange('all')}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold underline transition-colors"
                      >
                        Show All Domains
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Explainable Personalization Banner */}
              {(() => {
                const currentDom = selectedDomain === 'auto'
                  ? (personalization?.activeDomain || 'all')
                  : selectedDomain;
                if (personalization?.isPersonalized && currentDom === personalization.detectedDomain) {
                  return (
                    <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 rounded-xl px-3 py-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>
                        {personalization.evidenceSummary ||
                          `Defaulting to ${personalization.detectedDomainLabel} roles tailored to your profile.`}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Save Action Error Notice */}
          {saveActionError && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{saveActionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveActionError(null)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-800 font-semibold text-xs ml-3"
              >
                Dismiss
              </button>
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
                      <div className="h-5 bg-slate-100 dark:bg-slate-850 rounded w-24" />
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
                Unable to load job listings
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                {error}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => fetchJobs(keyword, location)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            /* Empty Collection State */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center shadow-sm space-y-3 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center border border-blue-100/60 dark:border-blue-900/60">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Your next opportunity is waiting.
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Search for jobs to get started. As positions are discovered for your profile, they will appear here.
              </p>
            </div>
          ) : filteredJobs.length === 0 ? (
            /* Filter / Query Yielded No Matches */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center shadow-sm space-y-3 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                No matching jobs found
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                No positions matched your active criteria. Try adjusting your search keywords, location, or clearing filters.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                {hasActiveFiltersOrSearch && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <span>Clear filters &amp; search</span>
                  </button>
                )}
                {(() => {
                  const currentDom = selectedDomain === 'auto'
                    ? (personalization?.activeDomain || 'all')
                    : selectedDomain;
                  if (currentDom !== 'all') {
                    return (
                      <button
                        type="button"
                        onClick={() => handleDomainChange('all')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Switch to All Domains</span>
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          ) : (
            /* Job Results List */
            <div className="space-y-4">
              {filteredJobs.map((job) => (
                <div
                  key={job._id || job.id || job.sourceUrl}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow dark:hover:shadow-black/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{job.company}</span>
                      {job.platform && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium capitalize border border-blue-100/60 dark:border-blue-900/40">
                          {job.platform}
                        </span>
                      )}
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
                      {formatJobFreshness(job.lastVerifiedAt) && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                          {formatJobFreshness(job.lastVerifiedAt)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">{job.title}</h4>
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
                    {(() => {
                      const jobId = (job._id || job.id)?.toString();
                      const isSaved = savedJobIds.has(jobId);
                      const isToggling = savingJobId === jobId;
                      const isTracked = jobId && trackedJobIds.has(jobId);

                      return (
                        <>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleSave(job)}
                            className={`p-2 rounded-xl border transition-all ${
                              isSaved
                                ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                            title={isSaved ? 'Remove from Saved Jobs' : 'Save Job'}
                          >
                            <Bookmark
                              className={`w-4 h-4 transition-transform ${
                                isToggling ? 'animate-pulse scale-90' : ''
                              } ${isSaved ? 'fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400' : ''}`}
                            />
                          </button>

                          {isTracked ? (
                            <span
                              className="px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5"
                              title="Application tracked in your applications list"
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
                        </>
                      );
                    })()}

                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Apply Now</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
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

export default JobsPlaceholderPage;
