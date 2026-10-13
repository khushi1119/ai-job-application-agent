import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Clock,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import { resumeService } from '../../services/api.js';
import { UpdateResumeModal } from '../../components/dashboard/UpdateResumeModal.jsx';

export const ResumePlaceholderPage = () => {
  const [resume, setResume] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const fetchResume = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await resumeService.getMyResume();
      setResume(res?.data?.resume || null);
    } catch (err) {
      console.warn('Failed to load resume:', err);
      setFetchError(err.message || 'Failed to retrieve resume details from server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResume();
  }, [fetchResume]);

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
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getParsingStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Resume details extracted</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed space-y-0.5">
                <span className="font-bold block text-blue-950 dark:text-blue-200">Connected to your Candidate Profile</span>
                <p className="text-blue-700 dark:text-blue-300">
                  Your resume details have been extracted. Your skills, experience, and projects are available across your profile and job recommendations.
                </p>
              </div>
            </div>
          ),
        };
      case 'processing':
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold shrink-0">
              <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
              <span>Extracting details</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-start gap-3">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0 animate-spin" />
              <div className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed space-y-0.5">
                <span className="font-bold block text-blue-950 dark:text-blue-200">Extraction in progress</span>
                <p className="text-blue-700 dark:text-blue-300">
                  Analyzing document contents to extract your experience and skills. Check back in a moment or refresh.
                </p>
              </div>
            </div>
          ),
        };
      case 'failed':
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-semibold shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>Extraction Failed</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="text-xs text-red-900 dark:text-red-100 leading-relaxed space-y-0.5">
                <span className="font-bold block text-red-950 dark:text-red-200">Could not extract details</span>
                <p className="text-red-700 dark:text-red-300">
                  We could not parse text from this document. Click Update Resume to upload a clean PDF or Word file.
                </p>
              </div>
            </div>
          ),
        };
      case 'pending':
      default:
        return {
          badge: (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold shrink-0">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Pending Extraction</span>
            </span>
          ),
          note: (
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed space-y-0.5">
                <span className="font-bold block text-amber-950 dark:text-amber-200">Queued for extraction</span>
                <p className="text-amber-700 dark:text-amber-300">
                  Document is saved safely and queued for profile information extraction.
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
    <div className="space-y-6 max-w-4xl font-sans">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Resume Management
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Your master resume used to match qualifications and recommend relevant career opportunities.
        </p>
      </div>

      {/* Error Alert with Retry */}
      {fetchError && !isLoading && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-800 dark:text-red-300 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-900 dark:text-red-200">Failed to load resume details</h4>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchResume}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Resume Card / Skeleton / Error / Empty State */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-6 animate-pulse">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-slate-200/80 dark:bg-slate-800 shrink-0" />
              <div className="space-y-2">
                <div className="h-4 w-48 bg-slate-200/80 dark:bg-slate-850 rounded-md" />
                <div className="h-3 w-32 bg-slate-200/60 dark:bg-slate-850 rounded-md" />
              </div>
            </div>
            <div className="h-6 w-24 bg-slate-200/80 dark:bg-slate-800 rounded-full" />
          </div>

          <div className="h-20 w-full bg-slate-200/60 dark:bg-slate-800 rounded-xl" />

          <div className="flex items-center justify-between pt-1">
            <div className="h-4 w-40 bg-slate-200/60 dark:bg-slate-800 rounded-md" />
            <div className="h-10 w-36 bg-slate-200/80 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      ) : fetchError ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-8 sm:p-10 shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center shadow-xs">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Failed to load resume details
            </h3>
            <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 leading-relaxed">
              {fetchError}
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={fetchResume}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>

          <div className="pt-2 text-xs text-slate-400 dark:text-slate-500">
            Please check your network connection or try again.
          </div>
        </div>
      ) : resume ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {resume.fileName || 'Uploaded Resume'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {[
                    formatFileSize(resume.fileSize),
                    formatUploadDate(resume.updatedAt || resume.createdAt)
                      ? `Uploaded ${formatUploadDate(resume.updatedAt || resume.createdAt)}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>
            </div>

            {statusConfig?.badge}
          </div>

          {/* Parsed highlights / parsing status note */}
          {statusConfig?.note}

          {/* Details & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Supported formats: PDF, DOCX (Max 10MB)
            </span>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {resume.storageUrl && (
                <button
                  type="button"
                  onClick={() => window.open(resume.storageUrl, '_blank', 'noopener,noreferrer')}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View Document</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsUpdateModalOpen(true)}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Update Resume</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-8 sm:p-10 shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <FileText className="w-7 h-7" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              No resume uploaded yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Upload your resume in PDF or Word format to extract your skills, experience, and qualifications automatically.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Resume</span>
            </button>
          </div>

          <div className="pt-2 text-xs text-slate-400 dark:text-slate-500">
            Supported formats: PDF, DOCX (Max 10MB)
          </div>
        </div>
      )}

      {/* Update Resume Modal */}
      <UpdateResumeModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        onResumeUpdated={fetchResume}
      />
    </div>
  );
};

export default ResumePlaceholderPage;

