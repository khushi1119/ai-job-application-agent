import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Calendar,
  XCircle,
  CheckCircle2,
  Clock,
  Briefcase,
  ExternalLink,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  Trash2,
  Edit3,
  FileText,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react';
import { applicationService } from '../../services/api.js';
import { TrackApplicationModal } from '../../components/dashboard/TrackApplicationModal.jsx';

export const ApplicationsPlaceholderPage = () => {
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    applied: 0,
    interview: 0,
    rejected: 0,
    offer: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action States
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [editingNoteApp, setEditingNoteApp] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [deletingAppId, setDeletingAppId] = useState(null);

  // Fetch applications and aggregated stats from backend API
  const fetchApplicationsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, statsRes] = await Promise.allSettled([
        applicationService.getApplications(),
        applicationService.getApplicationStats(),
      ]);

      if (appsRes.status === 'fulfilled') {
        const appsList = appsRes.value?.data?.applications || appsRes.value?.applications || [];
        setApplications(Array.isArray(appsList) ? appsList : []);
      } else {
        const msg = appsRes.reason?.message || 'Failed to fetch tracked applications';
        setError(msg);
        setApplications([]);
      }

      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value?.data || statsRes.value || {};
        setStats({
          total: Number(statsData.total) || 0,
          applied: Number(statsData.applied) || 0,
          interview: Number(statsData.interview) || 0,
          rejected: Number(statsData.rejected) || 0,
          offer: Number(statsData.offer) || 0,
        });
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while loading applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplicationsData();
  }, [fetchApplicationsData]);

  // Handle application status change
  const handleStatusChange = async (applicationId, newStatus) => {
    if (!applicationId || updatingStatusId) return;

    setUpdatingStatusId(applicationId);
    const previousApplications = [...applications];

    // Optimistic UI update
    setApplications((prev) =>
      prev.map((app) => (app._id === applicationId ? { ...app, status: newStatus } : app))
    );

    try {
      await applicationService.updateApplication(applicationId, { status: newStatus });
      // Refresh stats in background
      applicationService.getApplicationStats().then((res) => {
        const data = res?.data || res || {};
        setStats({
          total: Number(data.total) || 0,
          applied: Number(data.applied) || 0,
          interview: Number(data.interview) || 0,
          rejected: Number(data.rejected) || 0,
          offer: Number(data.offer) || 0,
        });
      }).catch(() => {});
    } catch (err) {
      // Revert on failure
      setApplications(previousApplications);
      alert(err.message || 'Failed to update status. Please try again.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Open note modal
  const handleOpenNoteModal = (app) => {
    setEditingNoteApp(app);
    setEditingNoteText(app.notes || '');
  };

  // Save note changes
  const handleSaveNote = async () => {
    if (!editingNoteApp || isSavingNote) return;

    setIsSavingNote(true);
    const appId = editingNoteApp._id;
    const newNote = editingNoteText.trim();

    try {
      await applicationService.updateApplication(appId, { notes: newNote });
      setApplications((prev) =>
        prev.map((app) => (app._id === appId ? { ...app, notes: newNote } : app))
      );
      setEditingNoteApp(null);
    } catch (err) {
      alert(err.message || 'Failed to save note. Please try again.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Delete an application
  const handleDeleteApplication = async (applicationId) => {
    if (!applicationId || deletingAppId) return;

    const confirmed = window.confirm('Are you sure you want to stop tracking this job application?');
    if (!confirmed) return;

    setDeletingAppId(applicationId);
    const previousApplications = [...applications];

    // Optimistically remove from state
    setApplications((prev) => prev.filter((app) => app._id !== applicationId));

    try {
      await applicationService.deleteApplication(applicationId);
      // Refresh stats
      applicationService.getApplicationStats().then((res) => {
        const data = res?.data || res || {};
        setStats({
          total: Number(data.total) || 0,
          applied: Number(data.applied) || 0,
          interview: Number(data.interview) || 0,
          rejected: Number(data.rejected) || 0,
          offer: Number(data.offer) || 0,
        });
      }).catch(() => {});
    } catch (err) {
      // Revert on failure
      setApplications(previousApplications);
      alert(err.message || 'Failed to delete application.');
    } finally {
      setDeletingAppId(null);
    }
  };

  // Callback when a new application is successfully tracked
  const handleApplicationTracked = (created) => {
    setApplications((prev) => [created, ...prev]);
    // Refresh stats
    applicationService.getApplicationStats().then((res) => {
      const data = res?.data || res || {};
      setStats({
        total: Number(data.total) || 0,
        applied: Number(data.applied) || 0,
        interview: Number(data.interview) || 0,
        rejected: Number(data.rejected) || 0,
        offer: Number(data.offer) || 0,
      });
    }).catch(() => {});
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  // Client-side filtering & search
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Status filter
      if (statusFilter !== 'All' && app.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Keyword search (company or job title)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const comp = (app.company || '').toLowerCase();
        const role = (app.jobTitle || '').toLowerCase();
        if (!comp.includes(q) && !role.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [applications, statusFilter, searchQuery]);

  // Status Badge and interactive selector
  const renderStatusSelector = (app) => {
    const current = app.status || 'Applied';
    const isUpdating = updatingStatusId === app._id;

    const getBadgeStyle = (status) => {
      switch (status?.toLowerCase()) {
        case 'offer':
          return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60';
        case 'interview':
          return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60';
        case 'rejected':
          return 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/60';
        default:
          return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60';
      }
    };

    return (
      <div className="relative inline-flex items-center">
        {isUpdating ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Updating...</span>
          </span>
        ) : (
          <div className="relative group">
            <select
              value={current}
              onChange={(e) => handleStatusChange(app._id, e.target.value)}
              className={`appearance-none cursor-pointer pl-2.5 pr-6 py-1 rounded-full text-xs font-semibold border transition-all outline-none ${getBadgeStyle(
                current
              )}`}
              title="Click to update application status"
            >
              <option value="Applied" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Applied</option>
              <option value="Interview" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Interview</option>
              <option value="Offer" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Offer</option>
              <option value="Rejected" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Rejected</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 group-hover:opacity-100" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl font-sans">
      {/* 1. Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Application Tracking
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor your job applications, submission statuses, and interview schedules.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsTrackModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all inline-flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Track Application</span>
        </button>
      </div>

      {/* 2. Top 4 Stats: Applied, Interview, Rejected, Offers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Applied */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm dark:shadow-black/30 space-y-2 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Applied</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse my-0.5" />
          ) : (
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {stats.applied ?? 0}
            </span>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Total submitted</p>
        </div>

        {/* Interview */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm dark:shadow-black/30 space-y-2 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Interview</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse my-0.5" />
          ) : (
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {stats.interview ?? 0}
            </span>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Conversations scheduled</p>
        </div>

        {/* Rejected */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm dark:shadow-black/30 space-y-2 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Rejected</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse my-0.5" />
          ) : (
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {stats.rejected ?? 0}
            </span>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Not selected</p>
        </div>

        {/* Offers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm dark:shadow-black/30 space-y-2 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Offers</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse my-0.5" />
          ) : (
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {stats.offer ?? 0}
            </span>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Offers received</p>
        </div>
      </div>

      {/* 3. Filter Bar & Search Input */}
      {!loading && applications.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'All', label: 'All', count: applications.length },
              { key: 'Applied', label: 'Applied', count: stats.applied },
              { key: 'Interview', label: 'Interview', count: stats.interview },
              { key: 'Offer', label: 'Offer', count: stats.offer },
              { key: 'Rejected', label: 'Rejected', count: stats.rejected },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                  statusFilter === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === tab.key
                      ? 'bg-blue-700 text-blue-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.count ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company or role..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all shadow-sm"
            />
          </div>
        </div>
      )}

      {/* 4. Error Alert State */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-800 dark:text-red-300 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-semibold">{error}</p>
              <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">Please check your connection and try again.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchApplicationsData}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 5. Main Content Area */}
      {loading ? (
        /* Loading Skeletons */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-4 animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-850 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
      ) : applications.length === 0 ? (
        /* Zero State: No applications tracked yet */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center shadow-sm dark:shadow-black/40 space-y-4 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center border border-blue-100/60 dark:border-blue-900/60">
            <Send className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              You haven&apos;t applied to or tracked any jobs yet.
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Track positions you&apos;ve applied for, log interviews, and keep your job search organized.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/jobs')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all inline-flex items-center gap-2"
            >
              <Briefcase className="w-4 h-4" />
              <span>Explore Jobs</span>
            </button>
            <button
              type="button"
              onClick={() => setIsTrackModalOpen(true)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Track Manually</span>
            </button>
          </div>
        </div>
      ) : filteredApplications.length === 0 ? (
        /* Filter / Search yielded no results */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-10 text-center shadow-sm space-y-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No applications match your filter</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            {searchQuery
              ? `No tracked positions found matching "${searchQuery}".`
              : `No applications with status "${statusFilter}".`}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('All');
              setSearchQuery('');
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Applications Table / Cards */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm dark:shadow-black/40 overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Company &amp; Role</th>
                  <th className="py-3.5 px-5">Applied Date</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Notes</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredApplications.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group">
                    {/* Company & Role */}
                    <td className="py-4 px-5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{app.company}</span>
                          {app.applicationUrl && (
                            <a
                              href={app.applicationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Open application link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{app.jobTitle}</p>
                      </div>
                    </td>

                    {/* Applied Date */}
                    <td className="py-4 px-5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{formatDate(app.appliedAt || app.createdAt)}</span>
                      </div>
                    </td>

                    {/* Interactive Status Selector */}
                    <td className="py-4 px-5 whitespace-nowrap">{renderStatusSelector(app)}</td>

                    {/* Notes Preview & Editor */}
                    <td className="py-4 px-5 max-w-[220px]">
                      {app.notes ? (
                        <div
                          onClick={() => handleOpenNoteModal(app)}
                          className="cursor-pointer group/note"
                          title="Click to edit notes"
                        >
                          <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-700 group-hover/note:border-blue-200 dark:group-hover/note:border-blue-700 transition-colors">
                            {app.notes}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenNoteModal(app)}
                          className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Add note</span>
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenNoteModal(app)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit notes"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingAppId === app._id}
                          onClick={() => handleDeleteApplication(app._id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="Delete application"
                        >
                          {deletingAppId === app._id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Track Application Modal */}
      <TrackApplicationModal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        onApplicationTracked={handleApplicationTracked}
      />

      {/* Edit Notes Modal */}
      {editingNoteApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Notes for {editingNoteApp.company}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingNoteApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <textarea
                rows={4}
                value={editingNoteText}
                onChange={(e) => setEditingNoteText(e.target.value)}
                placeholder="Log interview stages, interviewer names, follow-up dates, or salary discussions..."
                className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all resize-none"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingNoteApp(null)}
                  disabled={isSavingNote}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingNote}
                  onClick={handleSaveNote}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingNote ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Note</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationsPlaceholderPage;
