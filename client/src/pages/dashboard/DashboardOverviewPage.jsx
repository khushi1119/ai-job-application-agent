import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Briefcase,
  Send,
  Calendar,
  CheckCircle2,
  FileText,
  Search,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Target,
  RefreshCw,
  Clock,
  Loader2,
  AlertCircle,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { profileService, resumeService, applicationService } from '../../services/api.js';
import { UpdateResumeModal } from '../../components/dashboard/UpdateResumeModal.jsx';
import { calculateProfileCompletion, calculateSectionCompletion } from '../../utils/helpers.js';

export const DashboardOverviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, mongoUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [resumeError, setResumeError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [resume, setResume] = useState(null);
  const [appStats, setAppStats] = useState({
    total: 0,
    interview: 0,
    offer: 0,
  });
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');

  // Extract candidate first name
  const rawName =
    mongoUser?.name ||
    mongoUser?.displayName ||
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'there');
  const firstName = rawName.trim().split(/\s+/)[0] || 'there';

  // Dynamic greeting based on current local hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Fetch real Dashboard data from backend APIs
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    setProfileError(null);
    setResumeError(null);
    try {
      const [profileRes, resumeRes, statsRes] = await Promise.allSettled([
        profileService.getMyProfile(),
        resumeService.getMyResume(),
        applicationService.getApplicationStats(),
      ]);

      let errorMessages = [];

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value?.data?.profile || null);
        setProfileError(null);
      } else {
        const msg = profileRes.reason?.message || 'Failed to fetch candidate profile';
        setProfile(null);
        setProfileError(msg);
        errorMessages.push(msg);
      }

      if (resumeRes.status === 'fulfilled') {
        setResume(resumeRes.value?.data?.resume || null);
        setResumeError(null);
      } else {
        const msg = resumeRes.reason?.message || 'Failed to fetch resume details';
        setResume(null);
        setResumeError(msg);
        errorMessages.push(msg);
      }

      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value?.data || statsRes.value || {};
        setAppStats({
          total: Number(statsData.total) || 0,
          interview: Number(statsData.interview) || 0,
          offer: Number(statsData.offer) || 0,
        });
      } else {
        setAppStats({
          total: 0,
          interview: 0,
          offer: 0,
        });
      }

      if (errorMessages.length > 0) {
        setFetchError(errorMessages.join('. '));
      }
    } catch (err) {
      const msg = err.message || 'An unexpected error occurred while loading dashboard data';
      setFetchError(msg);
      setProfileError(msg);
      setResumeError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, location.key]);

  // Compute profile completion percentage and section statuses
  const completionPercentage = profile
    ? (profile.completionPercentage ?? calculateProfileCompletion(profile))
    : 0;

  const sectionCompletion = calculateSectionCompletion(profile || {});

  const formatFileSize = (bytes) => {
    if (bytes === null || bytes === undefined || bytes === '') return '';
    const num = Number(bytes);
    if (!Number.isFinite(num) || num <= 0) return '';
    const kb = num / 1024;
    if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatUploadDate = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return `Uploaded ${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    } catch {
      return '';
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (jobSearchQuery.trim()) {
      navigate(`/dashboard/jobs?q=${encodeURIComponent(jobSearchQuery.trim())}`);
    } else {
      navigate('/dashboard/jobs');
    }
  };

  const handleChipClick = (chip) => {
    setJobSearchQuery(chip);
    navigate(`/dashboard/jobs?q=${encodeURIComponent(chip)}`);
  };

  const popularChips = [
    'Frontend Developer',
    'React Developer',
    'Software Engineer',
    'Internship',
  ];

  // SVG Circle calculation for circular progress
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPercentage / 100) * circumference;

  // Actual parsing status resolution from MongoDB
  const getParsingStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Parsed</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5 text-xs text-emerald-950 dark:text-emerald-200">
                <p className="font-bold">Resume details extracted</p>
                <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Your skills, education, and projects have been extracted. Review and edit in your profile.
                </p>
              </div>
            </div>
          ),
        };
      case 'processing':
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
              <span>Processing</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 flex items-start gap-3">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0 animate-spin" />
              <div className="space-y-0.5 text-xs text-blue-950 dark:text-blue-200">
                <p className="font-bold">Parsing in progress</p>
                <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                  Analyzing your document. This usually takes just a few seconds.
                </p>
              </div>
            </div>
          ),
        };
      case 'failed':
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>Parsing Failed</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-red-50/70 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5 text-xs text-red-950 dark:text-red-200">
                <p className="font-bold">Parsing failed</p>
                <p className="text-red-800 dark:text-red-300 leading-relaxed">
                  Could not extract structured data. Please update with a clean PDF or Word document.
                </p>
              </div>
            </div>
          ),
        };
      case 'pending':
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Pending Parsing</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5 text-xs text-amber-950 dark:text-amber-200">
                <p className="font-bold">Waiting to be parsed</p>
                <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                  Your document has been stored and is queued for extraction.
                </p>
              </div>
            </div>
          ),
        };
      default:
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Uploaded</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5 text-xs text-slate-800 dark:text-slate-200">
                <p className="font-bold">Document stored</p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Your master resume has been saved. Trigger re-parsing to update qualifications.
                </p>
              </div>
            </div>
          ),
        };
    }
  };

  const statusConfig = resume
    ? getParsingStatusConfig(resume?.parsed?.parsingStatus)
    : null;

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* 1. Welcome Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">{getGreeting()},</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>{firstName}</span>
            <span>👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Let&apos;s find your next opportunity.</p>
        </div>

        {/* Right Hero Banner */}
        <div className="w-full lg:w-auto lg:min-w-[420px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 dark:from-blue-900 dark:via-indigo-900 dark:to-blue-950 text-white p-5 shadow-sm border border-transparent dark:border-blue-800/50 relative overflow-hidden flex items-center justify-between gap-4 transition-colors">
          <div className="space-y-1 relative z-10">
            <div className="flex items-center gap-1.5 text-xs text-blue-100 dark:text-blue-200 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Career overview</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Your application journey <span className="underline decoration-blue-300">organized</span> in one place
            </h3>
            <p className="text-xs text-blue-100 dark:text-blue-200 max-w-xs">
              Discover relevant opportunities and keep your applications organized.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/jobs')}
            className="shrink-0 bg-white text-blue-600 hover:bg-blue-50 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap"
          >
            Find Jobs
          </button>

          {/* Decorative ambient ring in background */}
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 dark:bg-white/5 blur-xl pointer-events-none" />
        </div>
      </div>

      {/* Error Alert State with Retry */}
      {fetchError && !isLoading && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-800 dark:text-red-300 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-900 dark:text-red-100">Failed to load dashboard data</h4>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 2. Top Stat Cards (4 items) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Jobs Found */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm hover:shadow dark:hover:shadow-black/30 transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="h-8 w-12 bg-slate-200/80 dark:bg-slate-800 rounded-lg animate-pulse my-0.5" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
                0
              </span>
            )}
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Jobs Found</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Based on your profile</p>
          </div>
        </div>

        {/* Card 2: Applications */}
        <div
          onClick={() => navigate('/dashboard/applications')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm hover:shadow dark:hover:shadow-black/30 transition-all flex flex-col justify-between space-y-3 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="h-8 w-12 bg-slate-200/80 dark:bg-slate-800 rounded-lg animate-pulse my-0.5" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
                {appStats.total ?? 0}
              </span>
            )}
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Applications</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Tracked</p>
          </div>
        </div>

        {/* Card 3: Interviews */}
        <div
          onClick={() => navigate('/dashboard/applications')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm hover:shadow dark:hover:shadow-black/30 transition-all flex flex-col justify-between space-y-3 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="h-8 w-12 bg-slate-200/80 dark:bg-slate-800 rounded-lg animate-pulse my-0.5" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
                {appStats.interview ?? 0}
              </span>
            )}
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Interviews</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Scheduled</p>
          </div>
        </div>

        {/* Card 4: Offers */}
        <div
          onClick={() => navigate('/dashboard/applications')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm hover:shadow dark:hover:shadow-black/30 transition-all flex flex-col justify-between space-y-3 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="h-8 w-12 bg-slate-200/80 dark:bg-slate-800 rounded-lg animate-pulse my-0.5" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
                {appStats.offer ?? 0}
              </span>
            )}
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Offers</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Received</p>
          </div>
        </div>
      </div>

      {/* 3. Find Relevant Jobs Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm dark:shadow-black/40 relative overflow-hidden space-y-4 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Find Relevant Jobs
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Get personalized job recommendations based on your skills and resume.
            </p>
          </div>

          {/* Decorative Target Icon Accent */}
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-950/60 border border-blue-100 dark:border-blue-900/60 items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <Target className="w-6 h-6" />
          </div>
        </div>

        {/* Search Bar Input */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={jobSearchQuery}
              onChange={(e) => setJobSearchQuery(e.target.value)}
              placeholder="Search by role, company or keyword..."
              className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 py-2.5 outline-none focus:bg-white dark:focus:bg-slate-850 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <span>Search Jobs</span>
          </button>
        </form>

        {/* Popular Searches Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium mr-1">Popular searches:</span>
          {popularChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Profile + Resume Section (Side-by-Side Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {isLoading ? (
          <>
            {/* Card 1 Skeleton: Profile */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6 animate-pulse">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="h-5 w-28 bg-slate-200/80 dark:bg-slate-800 rounded-md" />
                </div>

                <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-20 h-20 rounded-full bg-slate-200/80 dark:bg-slate-800 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-slate-200/80 dark:bg-slate-800 rounded-md" />
                    <div className="h-3 w-48 bg-slate-200/60 dark:bg-slate-800/60 rounded-md" />
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-slate-200/80 dark:bg-slate-800" />
                        <div className="h-3 w-28 bg-slate-200/80 dark:bg-slate-800 rounded-md" />
                      </div>
                      <div className="h-3 w-8 bg-slate-200/80 dark:bg-slate-800 rounded-md" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-10 w-full bg-slate-200/80 dark:bg-slate-800 rounded-xl" />
            </div>

            {/* Card 2 Skeleton: Resume */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6 animate-pulse">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="h-5 w-28 bg-slate-200/80 dark:bg-slate-800 rounded-md" />
                  <div className="h-6 w-20 bg-slate-200/80 dark:bg-slate-800 rounded-full" />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-slate-200/80 dark:bg-slate-800 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-40 bg-slate-200/80 dark:bg-slate-800 rounded-md" />
                    <div className="h-3 w-28 bg-slate-200/60 dark:bg-slate-800/60 rounded-md" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="h-10 bg-slate-200/80 dark:bg-slate-800 rounded-xl" />
                  <div className="h-10 bg-slate-200/80 dark:bg-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="h-16 w-full bg-slate-200/60 dark:bg-slate-800/60 rounded-xl" />
            </div>
          </>
        ) : (
          <>
            {/* Card 1: Your Profile */}
            {profileError ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6 transition-colors">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Your Profile</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      <span>Unavailable</span>
                    </span>
                  </div>

                  <div className="p-6 rounded-xl bg-red-50/60 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-center space-y-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center shadow-xs">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-red-900 dark:text-red-100">Failed to load profile</h4>
                      <p className="text-xs text-red-700 dark:text-red-300 max-w-sm mx-auto leading-relaxed">
                        {profileError}
                      </p>
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={fetchDashboardData}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                  <div className="space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                    <p className="font-bold text-slate-900 dark:text-slate-100">Profile data temporarily offline</p>
                    <p className="leading-relaxed">
                      We could not reach the profile service. Your profile is safe in our database.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6 transition-colors">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Your Profile</h3>
                  </div>

                  {/* Circular Progress & Profile Completion Text */}
                  <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    {/* Circular SVG Ring */}
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                      <svg className="w-20 h-20 transform -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          className="text-slate-200 dark:text-slate-800"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke="#2563EB"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {completionPercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Text */}
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Profile Completion</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {completionPercentage >= 80
                          ? 'Your profile is well-detailed for automated matching.'
                          : 'Complete your profile to get better job matches.'}
                      </p>
                    </div>
                  </div>

                  {/* Section Breakdown List */}
                  <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            sectionCompletion.personal.isComplete
                              ? 'text-emerald-500'
                              : sectionCompletion.personal.percentage > 0
                              ? 'text-amber-500'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>Personal Information</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        {sectionCompletion.personal.percentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            sectionCompletion.summary.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>Summary</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        {sectionCompletion.summary.percentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            sectionCompletion.skills.isComplete
                              ? 'text-emerald-500'
                              : sectionCompletion.skills.percentage > 0
                              ? 'text-amber-500'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>Skills</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        {sectionCompletion.skills.percentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            sectionCompletion.experience.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>Experience</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        {sectionCompletion.experience.percentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            sectionCompletion.education.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>Education</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        {sectionCompletion.education.percentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            sectionCompletion.projects.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>Projects</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        {sectionCompletion.projects.percentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            sectionCompletion.certifications.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>Certifications</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        {sectionCompletion.certifications.percentage}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action: Edit Profile */}
                <button
                  type="button"
                  onClick={() => navigate('/onboarding/profile')}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Edit Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Card 2: Your Resume */}
            {resumeError ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6 transition-colors">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Your Resume</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      <span>Unavailable</span>
                    </span>
                  </div>

                  <div className="p-6 rounded-xl bg-red-50/60 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 text-center space-y-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center shadow-xs">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-red-900 dark:text-red-100">Failed to load resume</h4>
                      <p className="text-xs text-red-700 dark:text-red-300 max-w-sm mx-auto leading-relaxed">
                        {resumeError}
                      </p>
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={fetchDashboardData}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                  <div className="space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                    <p className="font-bold text-slate-900 dark:text-slate-100">Resume status offline</p>
                    <p className="leading-relaxed">
                      Unable to verify resume records from the server right now.
                    </p>
                  </div>
                </div>
              </div>
            ) : resume ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6 transition-colors">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Your Resume</h3>
                    {statusConfig?.badge}
                  </div>

                  {/* Resume File Item */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100/60 dark:border-blue-900/60">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {resume.fileName || 'Uploaded Resume'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {[
                          formatFileSize(resume.fileSize),
                          formatUploadDate(resume.updatedAt || resume.createdAt),
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    </div>
                  </div>

                  {/* Resume Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (resume.storageUrl) {
                          window.open(resume.storageUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          navigate('/onboarding/resume');
                        }
                      }}
                      className="w-full py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Resume</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsUpdateModalOpen(true)}
                      className="w-full py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-transparent dark:border-slate-700 text-xs sm:text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Update Resume</span>
                    </button>
                  </div>
                </div>

                {/* Status Note Box */}
                {statusConfig?.note}
              </div>
            ) : (
              /* Clean Empty State: No resume uploaded yet */
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6 transition-colors">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Your Resume</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                      Not Uploaded
                    </span>
                  </div>

                  {/* Empty State Banner */}
                  <div className="p-6 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center shadow-xs border border-blue-100/60 dark:border-blue-900/60">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">No resume uploaded yet</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Upload your resume in PDF or Word format to extract your skills and experience into a clean candidate profile.
                      </p>
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setIsUpdateModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload Resume</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Informational Guidance Note */}
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="space-y-0.5 text-xs text-blue-950 dark:text-blue-200">
                    <p className="font-bold">Structured profile extraction</p>
                    <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                      Your skills, education, and career experience are organized immediately upon upload.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 5. Working Update Resume Modal */}
      <UpdateResumeModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        onResumeUpdated={fetchDashboardData}
      />
    </div>
  );
};

export default DashboardOverviewPage;
