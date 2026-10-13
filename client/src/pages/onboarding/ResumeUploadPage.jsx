import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Briefcase,
  LogOut,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { resumeService } from '../../services/api.js';
import { ThemeToggle } from '../../components/common/ThemeToggle.jsx';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ResumeUploadPage = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { currentUser, mongoUser, logout, syncUser } = useAuth();

  const fileInputRef = useRef(null);

  const isProcessingRef = useRef(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  // Extracting state
  const [isExtracting, setIsExtracting] = useState(false);

  // Success state with stored document
  const [uploadedResume, setUploadedResume] = useState(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  const displayName =
    currentUser?.displayName ||
    mongoUser?.name ||
    mongoUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
  const email = currentUser?.email || mongoUser?.email || '';

  // Check if user already has an uploaded resume
  useEffect(() => {
    let isMounted = true;
    const checkExistingResume = async () => {
      try {
        const response = await resumeService.getMyResume();
        const existing = response?.data?.resume;
        if (isMounted && existing) {
          setUploadedResume(existing);
        }
      } catch (err) {
        console.warn('Notice checking existing resume:', err?.message || err);
      } finally {
        if (isMounted) setIsLoadingExisting(false);
      }
    };

    checkExistingResume();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Validate file type and size
  const validateFile = (file) => {
    if (!file) return false;

    const fileName = file.name || '';
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(fileExt) && !ALLOWED_MIME_TYPES.includes(file.type)) {
      setValidationError('Please select a valid PDF (.pdf) or Word document (.docx).');
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(
        `File size (${formatFileSize(file.size)}) exceeds the 10 MB limit. Please choose a smaller file.`
      );
      return false;
    }

    setValidationError('');
    return true;
  };

  // Upload and parse pipeline with protection against concurrent duplicate executions
  const processResumeUpload = async (fileToUpload) => {
    if (!fileToUpload || !currentUser) return;
    if (isProcessingRef.current || isUploading || isExtracting) return;

    isProcessingRef.current = true;
    setIsUploading(true);
    setIsExtracting(false);
    setUploadProgress(15);
    setUploadError('');
    setValidationError('');

    const isReplacing = Boolean(uploadedResume);
    setSelectedFile(fileToUpload);

    try {
      const uploadStartTime = performance.now();

      // 1. Upload file buffer to Cloudinary & persist new/updated document in MongoDB
      const uploadResponse = await resumeService.uploadResume(
        fileToUpload,
        (progress) => setUploadProgress(progress)
      );

      const uploadDuration = Math.round(performance.now() - uploadStartTime);
      console.log(`[ResumeUpload] File upload completed in ${uploadDuration}ms`);

      const savedDoc = uploadResponse?.data?.resume;
      setUploadProgress(100);
      setIsUploading(false);
      setIsExtracting(true);

      const extractStartTime = performance.now();

      // 2. Extract structured data with Gemini AI & update candidate Profile
      const extractResponse = await resumeService.extractResume();

      const extractDuration = Math.round(performance.now() - extractStartTime);
      console.log(`[ResumeUpload] AI extraction completed in ${extractDuration}ms`);

      const finalResume = extractResponse?.data?.resume || savedDoc || {
        fileName: fileToUpload.name,
        fileSize: fileToUpload.size,
        fileType: fileToUpload.type,
        version: (uploadedResume?.version || 1) + 1,
        uploadedAt: new Date().toISOString(),
      };

      // Non-blocking user synchronization so UI immediately reflects extracted state
      if (syncUser) {
        syncUser().catch((syncErr) => console.warn('[ResumeUpload] Background user sync notice:', syncErr));
      }

      // 3. Update uploaded resume state strictly with the NEW resume
      setUploadedResume(finalResume);
      setSelectedFile(null);
    } catch (err) {
      console.error('Resume upload/extraction failed:', err);
      setUploadError(err.message || 'Failed to process resume. Please verify your document and try again.');
      if (isReplacing) {
        // Invalidate stale resume on replacement failure so old data is not used for continuation
        setUploadedResume(null);
      }
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
      isProcessingRef.current = false;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isUploading || isExtracting) return;

    if (validateFile(file)) {
      setValidationError('');
      setUploadError('');

      if (uploadedResume) {
        // User clicked "Upload a different resume": immediately upload & parse replacement
        processResumeUpload(file);
      } else {
        // First-time resume selection: stage file for preview
        setSelectedFile(file);
      }
    } else {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading || isExtracting) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (validateFile(file)) {
        setValidationError('');
        setUploadError('');

        if (uploadedResume) {
          processResumeUpload(file);
        } else {
          setSelectedFile(file);
        }
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setValidationError('');
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Execute upload flow for first-time staged file
  const handleUpload = () => {
    if (selectedFile) {
      processResumeUpload(selectedFile);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleContinue = async () => {
    if (isUploading || isExtracting || !uploadedResume) return;

    // If resume details already extracted, proceed directly to profile setup
    if (uploadedResume?.parsed?.extractedData || uploadedResume?.parsed?.parsingStatus === 'success') {
      navigate('/onboarding/profile');
      return;
    }

    // Fallback: If extraction hasn't run on existing resume, extract before proceeding
    setIsExtracting(true);
    setUploadError('');

    try {
      const fallbackExtractStart = performance.now();
      await resumeService.extractResume();
      const fallbackDuration = Math.round(performance.now() - fallbackExtractStart);
      console.log(`[ResumeUpload] Fallback AI extraction completed in ${fallbackDuration}ms`);

      if (syncUser) {
        syncUser().catch((syncErr) => console.warn('[ResumeUpload] Background user sync notice:', syncErr));
      }
      navigate('/onboarding/profile');
    } catch (err) {
      console.warn('Extraction notice, proceeding to profile:', err);
      navigate('/onboarding/profile');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070D18] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Navigation Bar */}
      <header className="h-16 px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 flex items-center justify-between transition-colors">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/25">
            <Briefcase className="w-5 h-5" />
          </div>
          <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight">
            Ai Job Agent
          </span>
        </Link>

        {/* User info and Sign Out button */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[150px]">
              {displayName}
            </p>
            <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{email}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center max-w-2xl w-full mx-auto p-4 sm:p-6 lg:p-8 my-auto">
        {/* Step Indicator: 1 Resume -> 2 Profile -> 3 Dashboard */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {/* Step 1: Resume */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                1
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Resume</span>
            </div>

            <div className="flex-1 h-0.5 mx-3 bg-slate-200 dark:bg-slate-800" />

            {/* Step 2: Profile */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 text-xs font-bold flex items-center justify-center">
                2
              </div>
              <span className="text-xs font-medium text-slate-400">Profile</span>
            </div>

            <div className="flex-1 h-0.5 mx-3 bg-slate-200 dark:bg-slate-800" />

            {/* Step 3: Dashboard */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 text-xs font-bold flex items-center justify-center">
                3
              </div>
              <span className="text-xs font-medium text-slate-400">Dashboard</span>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm dark:shadow-black/40 p-6 sm:p-8 space-y-6 transition-colors">
          {/* Hidden File Input mounted unconditionally so picker can always be opened */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading || isExtracting}
            tabIndex={-1}
            aria-hidden="true"
          />

          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Upload your resume
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Upload your latest PDF or DOCX resume to extract your qualifications and match open roles.
            </p>
          </div>

          {/* After upload success card */}
          {uploadedResume && !isUploading && !isExtracting && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Resume details extracted
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Ready to review and complete your profile
                    </p>
                  </div>
                </div>
              </div>

              {/* File Info */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1 mr-3">
                  <span className="text-[11px] text-slate-400 block font-medium">Filename</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                    {uploadedResume.fileName || 'Master_Resume.pdf'}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] text-slate-400 block font-medium">Size</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block mt-0.5 font-mono">
                    {formatFileSize(uploadedResume.fileSize)}
                  </span>
                </div>
              </div>

              {/* Upload different file button */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={isUploading || isExtracting}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isUploading || isExtracting) return;
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                    fileInputRef.current?.click();
                  }}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Upload a different resume</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Dropzone for initial upload or when no resume is loaded */}
          {!uploadedResume && !isUploading && !isExtracting && (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => {
                  if (!isUploading && !isExtracting) {
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                    fileInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 select-none ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-sm border border-blue-100/60 dark:border-blue-900/60">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Drag and drop your resume here, or <span className="text-blue-600 dark:text-blue-400">browse file</span>
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  PDF or DOCX &bull; Maximum 10MB
                </p>
              </div>

              {/* Selected file preview before uploading */}
              {selectedFile && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>

                  {!isUploading && !isExtracting && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile();
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Validation Error Message */}
          {validationError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Upload Error Message */}
          {uploadError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Uploading progress indicator */}
          {isUploading && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
                  {selectedFile ? `Uploading ${selectedFile.name}...` : 'Uploading your resume...'}
                </span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Extracting qualifications indicator */}
          {isExtracting && (
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-blue-700 dark:text-blue-300">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
                  Analyzing qualifications with AI...
                </span>
                <span className="font-mono text-blue-600 dark:text-blue-400">Processing</span>
              </div>
              <div className="w-full bg-blue-200/60 dark:bg-blue-800/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500 animate-pulse w-full"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            {selectedFile && !uploadedResume && !isUploading && !isExtracting && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || isExtracting}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Resume</span>
              </button>
            )}

            {(uploadedResume || isUploading || isExtracting) && (
              <button
                type="button"
                onClick={handleContinue}
                disabled={isUploading || isExtracting || !uploadedResume}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>
                  {isUploading
                    ? 'Uploading resume...'
                    : isExtracting
                    ? 'Analyzing qualifications...'
                    : 'Continue to Profile'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResumeUploadPage;
