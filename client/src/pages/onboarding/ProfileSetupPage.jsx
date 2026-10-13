import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Briefcase,
  User,
  FileText,
  Wrench,
  GraduationCap,
  FolderGit2,
  Award,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  ArrowRight,
  LogOut,
  LayoutDashboard,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Github,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ThemeToggle } from '../../components/common/ThemeToggle.jsx';
import { profileService, resumeService } from '../../services/api.js';
import { calculateProfileCompletion, calculateSectionCompletion } from '../../utils/helpers.js';

export const ProfileSetupPage = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { currentUser, mongoUser, logout, syncUser } = useAuth();

  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState('');

  // Editable Profile State populated with real extracted data
  const [personal, setPersonal] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    portfolioUrl: '',
    linkedinUrl: '',
    githubUrl: '',
  });
  const [summary, setSummary] = useState('');
  const [skills, setSkills] = useState([]);
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [projects, setProjects] = useState([]);
  const [certifications, setCertifications] = useState([]);

  // Fetch real profile from MongoDB via GET /api/profile/me
  const fetchProfile = async () => {
    setIsLoading(true);
    setSaveError('');
    try {
      const response = await profileService.getMyProfile();
      const prof = response?.data?.profile;

      if (prof) {
        setPersonal({
          name: prof.personal?.name || currentUser?.displayName || '',
          email: prof.personal?.email || currentUser?.email || '',
          phone: prof.personal?.phone || '',
          location: prof.personal?.location || '',
          portfolioUrl: prof.personal?.portfolioUrl || '',
          linkedinUrl: prof.personal?.linkedinUrl || '',
          githubUrl: prof.personal?.githubUrl || '',
        });
        setSummary(prof.summary || '');
        setSkills(Array.isArray(prof.skills) ? prof.skills : []);
        setEducation(
          Array.isArray(prof.education)
            ? prof.education.map((edu) => ({
                ...edu,
                endDate: edu.endDate ? edu.endDate : edu.current ? 'Present' : '',
              }))
            : []
        );
        setExperience(
          Array.isArray(prof.experience)
            ? prof.experience.map((exp) => ({
                ...exp,
                endDate: exp.endDate ? exp.endDate : exp.current ? 'Present' : '',
              }))
            : []
        );
        setProjects(Array.isArray(prof.projects) ? prof.projects : []);
        setCertifications(Array.isArray(prof.certifications) ? prof.certifications : []);
      } else {
        // Attempt extraction fallback from uploaded resume
        try {
          const extractResp = await resumeService.extractResume();
          const extractedProf = extractResp?.data?.profile || extractResp?.data?.extractedData;
          if (extractedProf) {
            setPersonal({
              name: extractedProf.personal?.name || currentUser?.displayName || '',
              email: extractedProf.personal?.email || currentUser?.email || '',
              phone: extractedProf.personal?.phone || '',
              location: extractedProf.personal?.location || '',
              portfolioUrl: extractedProf.personal?.portfolioUrl || '',
              linkedinUrl: extractedProf.personal?.linkedinUrl || '',
              githubUrl: extractedProf.personal?.githubUrl || '',
            });
            setSummary(extractedProf.summary || '');
            setSkills(Array.isArray(extractedProf.skills) ? extractedProf.skills : []);
            setEducation(Array.isArray(extractedProf.education) ? extractedProf.education : []);
            setExperience(Array.isArray(extractedProf.experience) ? extractedProf.experience : []);
            setProjects(Array.isArray(extractedProf.projects) ? extractedProf.projects : []);
            setCertifications(
              Array.isArray(extractedProf.certifications) ? extractedProf.certifications : []
            );
          }
        } catch (extractErr) {
          console.warn('Extraction fallback notice:', extractErr.message);
          setPersonal((prev) => ({
            ...prev,
            name: currentUser?.displayName || '',
            email: currentUser?.email || '',
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setSaveError(err.message || 'Failed to retrieve profile data from server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Section and overall completeness calculations
  const currentProfileData = {
    personal,
    summary,
    skills,
    education,
    experience,
    projects,
    certifications,
  };

  const sectionCompletion = calculateSectionCompletion(currentProfileData);
  const completionPercentage = calculateProfileCompletion(currentProfileData);

  // SVG Circular calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPercentage / 100) * circumference;

  // Tabs definition
  const tabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'skills', label: 'Skills', icon: Wrench },
    { id: 'experience', label: 'Experience', icon: Briefcase },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'certifications', label: 'Certifications', icon: Award },
  ];

  // Skills handlers
  const handleAddSkill = (e) => {
    e?.preventDefault();
    const trimmed = newSkillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  // Education handlers
  const handleAddEducation = () => {
    setEducation([
      ...education,
      {
        institution: '',
        degree: '',
        fieldOfStudy: '',
        startDate: '',
        endDate: '',
        current: false,
        gpa: '',
      },
    ]);
  };

  const handleUpdateEducation = (index, field, value) => {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    setEducation(updated);
  };

  const handleRemoveEducation = (index) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  // Experience handlers
  const handleAddExperience = () => {
    setExperience([
      ...experience,
      {
        company: '',
        role: '',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        highlights: [''],
        technologies: [],
      },
    ]);
  };

  const handleUpdateExperience = (index, field, value) => {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: value };
    setExperience(updated);
  };

  const handleRemoveExperience = (index) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  // Projects handlers
  const handleAddProject = () => {
    setProjects([
      ...projects,
      {
        title: '',
        description: '',
        liveUrl: '',
        githubUrl: '',
        technologies: [],
      },
    ]);
  };

  const handleUpdateProject = (index, field, value) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    setProjects(updated);
  };

  const handleRemoveProject = (index) => {
    setProjects(projects.filter((_, i) => i !== index));
  };

  // Certifications handlers
  const handleAddCertification = () => {
    setCertifications([
      ...certifications,
      {
        name: '',
        issuer: '',
        issueDate: '',
        credentialId: '',
      },
    ]);
  };

  const handleUpdateCertification = (index, field, value) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    setCertifications(updated);
  };

  const handleRemoveCertification = (index) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  // Save profile handler
  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const normalizedExperience = experience.map((exp) => {
        const isPresent =
          typeof exp.endDate === 'string' &&
          /^(present|current|ongoing|now)$/i.test(exp.endDate.trim());
        return {
          ...exp,
          current: Boolean(exp.current || isPresent),
          endDate: isPresent ? null : (exp.endDate || null),
        };
      });

      const normalizedEducation = education.map((edu) => {
        const isPresent =
          typeof edu.endDate === 'string' &&
          /^(present|current|ongoing|now)$/i.test(edu.endDate.trim());
        return {
          ...edu,
          current: Boolean(edu.current || isPresent),
          endDate: isPresent ? null : (edu.endDate || null),
        };
      });

      const payload = {
        personal,
        summary,
        skills,
        education: normalizedEducation,
        experience: normalizedExperience,
        projects,
        certifications,
      };

      await profileService.updateProfile(payload);
      setSaveSuccess(true);

      if (syncUser) {
        await syncUser();
      }

      // If user came through onboarding, navigate forward to dashboard
      if (!mongoUser?.onboardingCompleted) {
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 800);
      } else {
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3500);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setSaveError(err.details || err.message || 'Failed to save profile. Please review your entries.');
    } finally {
      setIsSaving(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070D18] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Loading your profile...</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Fetching profile information</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070D18] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Header */}
      <header className="h-16 px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/25">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight">
              Ai Job Agent
            </span>
          </Link>

          <span className="hidden sm:inline-block text-xs font-semibold text-slate-400 dark:text-slate-600">/</span>
          <span className="hidden sm:inline-block text-xs font-semibold text-slate-700 dark:text-slate-300">Profile Management</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Profile</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Save feedback banners */}
        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-medium flex items-center gap-2.5 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Profile saved successfully! Your candidate details and matching metrics have been updated.</span>
          </div>
        )}

        {saveError && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs sm:text-sm font-medium flex items-center gap-2.5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* 2-Column Layout: Left Completeness Card, Right Tabbed Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ======================================================== */}
          {/* LEFT COLUMN: Profile Completeness Card (lg:col-span-4)   */}
          {/* ======================================================== */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm dark:shadow-black/30 space-y-5 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Profile Completeness</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Candidate Score
                </span>
              </div>

              {/* Circular Progress Display */}
              <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    <circle
                      cx="48"
                      cy="48"
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
                    <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                      {completionPercentage}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Master Profile</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Complete your sections to get optimal job match scores.
                  </p>
                </div>
              </div>

              {/* Section Completion Checklist */}
              <div className="space-y-2 text-xs">
                <div
                  onClick={() => setActiveTab('personal')}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    activeTab === 'personal'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
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
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {sectionCompletion.personal.percentage}%
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('summary')}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    activeTab === 'summary'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        sectionCompletion.summary.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                    <span>Summary</span>
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {sectionCompletion.summary.percentage}%
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('skills')}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    activeTab === 'skills'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
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
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {sectionCompletion.skills.percentage}%
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('experience')}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    activeTab === 'experience'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        sectionCompletion.experience.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                    <span>Experience</span>
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {sectionCompletion.experience.percentage}%
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('education')}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    activeTab === 'education'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        sectionCompletion.education.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                    <span>Education</span>
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {sectionCompletion.education.percentage}%
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('projects')}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    activeTab === 'projects'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        sectionCompletion.projects.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                    <span>Projects</span>
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {sectionCompletion.projects.percentage}%
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('certifications')}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    activeTab === 'certifications'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        sectionCompletion.certifications.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                    <span>Certifications</span>
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {sectionCompletion.certifications.percentage}%
                  </span>
                </div>
              </div>

              {/* Action */}
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Profile Changes</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: Editable Content Area with TABS (lg:col-span-8) */}
          {/* ======================================================== */}
          <div className="lg:col-span-8 space-y-6">
            {/* Tab Navigation Pill Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-1.5 shadow-sm dark:shadow-black/20 flex items-center gap-1 overflow-x-auto scrollbar-none transition-colors">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT: Personal Information */}
            {activeTab === 'personal' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm dark:shadow-black/30 space-y-5 transition-colors">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Personal Information</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your core contact information and public links</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                    <div className="relative flex items-center">
                      <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        type="text"
                        value={personal.name}
                        onChange={(e) => setPersonal({ ...personal, name: e.target.value })}
                        placeholder="e.g. Jane Doe"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 pl-10 pr-4 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        type="email"
                        value={personal.email}
                        onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                        placeholder="you@example.com"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 pl-10 pr-4 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
                    <div className="relative flex items-center">
                      <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        type="tel"
                        value={personal.phone}
                        onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 pl-10 pr-4 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Location</label>
                    <div className="relative flex items-center">
                      <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        type="text"
                        value={personal.location}
                        onChange={(e) => setPersonal({ ...personal, location: e.target.value })}
                        placeholder="San Francisco, CA or Remote"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 pl-10 pr-4 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">LinkedIn Profile</label>
                    <div className="relative flex items-center">
                      <Linkedin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        type="url"
                        value={personal.linkedinUrl}
                        onChange={(e) => setPersonal({ ...personal, linkedinUrl: e.target.value })}
                        placeholder="https://linkedin.com/in/username"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 pl-10 pr-4 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">GitHub Profile</label>
                    <div className="relative flex items-center">
                      <Github className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        type="url"
                        value={personal.githubUrl}
                        onChange={(e) => setPersonal({ ...personal, githubUrl: e.target.value })}
                        placeholder="https://github.com/username"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 pl-10 pr-4 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Portfolio / Website</label>
                    <div className="relative flex items-center">
                      <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        type="url"
                        value={personal.portfolioUrl}
                        onChange={(e) => setPersonal({ ...personal, portfolioUrl: e.target.value })}
                        placeholder="https://yourportfolio.com"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 pl-10 pr-4 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Professional Summary */}
            {activeTab === 'summary' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm dark:shadow-black/30 space-y-5 transition-colors">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Professional Summary</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">High-level summary of your background and achievements</p>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={6}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Write or refine your professional executive summary..."
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 p-4 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all resize-y"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 px-1">
                    <span>Used to match qualifications and personalize recommendations</span>
                    <span className="font-mono">{summary.length} characters</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Skills */}
            {activeTab === 'skills' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm dark:shadow-black/30 space-y-5 transition-colors">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Technical Skills</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Skills and proficiencies used to compute job match scores</p>
                </div>

                {/* Add new skill input */}
                <form onSubmit={handleAddSkill} className="flex gap-2">
                  <input
                    type="text"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    placeholder="Add a new skill (e.g. Next.js, Docker, Python)..."
                    className="flex-1 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </form>

                {/* Skills tags pill cloud */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {skills.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">No skills listed yet. Add some above or upload your resume.</p>
                  ) : (
                    skills.map((skill, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="Remove skill"
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Experience */}
            {activeTab === 'experience' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm dark:shadow-black/30 space-y-5 transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Work Experience</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your employment history and job achievements</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExperience}
                    className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Position</span>
                  </button>
                </div>

                {experience.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 italic">
                    No work experience listed yet. Click "Add Position" above.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {experience.map((exp, index) => (
                      <div
                        key={index}
                        className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-750 space-y-4 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Position #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExperience(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Delete position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Role / Job Title</label>
                            <input
                              type="text"
                              value={exp.role || ''}
                              onChange={(e) => handleUpdateExperience(index, 'role', e.target.value)}
                              placeholder="e.g. Senior Frontend Developer"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company</label>
                            <input
                              type="text"
                              value={exp.company || ''}
                              onChange={(e) => handleUpdateExperience(index, 'company', e.target.value)}
                              placeholder="e.g. Acme Technologies"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Location</label>
                            <input
                              type="text"
                              value={exp.location || ''}
                              onChange={(e) => handleUpdateExperience(index, 'location', e.target.value)}
                              placeholder="e.g. New York, NY / Remote"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                              <input
                                type="text"
                                value={exp.startDate || ''}
                                onChange={(e) => handleUpdateExperience(index, 'startDate', e.target.value)}
                                placeholder="e.g. Jan 2022"
                                className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                              <input
                                type="text"
                                value={exp.endDate || ''}
                                onChange={(e) => handleUpdateExperience(index, 'endDate', e.target.value)}
                                placeholder="e.g. Present"
                                className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Education */}
            {activeTab === 'education' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm dark:shadow-black/30 space-y-5 transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Education</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Degrees, academic institutions, and certifications</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEducation}
                    className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Degree</span>
                  </button>
                </div>

                {education.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 italic">
                    No education entries listed yet. Click "Add Degree" above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {education.map((edu, index) => (
                      <div
                        key={index}
                        className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-750 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Degree #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEducation(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Institution / University</label>
                            <input
                              type="text"
                              value={edu.institution || ''}
                              onChange={(e) => handleUpdateEducation(index, 'institution', e.target.value)}
                              placeholder="e.g. University of California"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Degree</label>
                            <input
                              type="text"
                              value={edu.degree || ''}
                              onChange={(e) => handleUpdateEducation(index, 'degree', e.target.value)}
                              placeholder="e.g. Bachelor of Science"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Field of Study</label>
                            <input
                              type="text"
                              value={edu.fieldOfStudy || ''}
                              onChange={(e) => handleUpdateEducation(index, 'fieldOfStudy', e.target.value)}
                              placeholder="e.g. Computer Science"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                              <input
                                type="text"
                                value={edu.startDate || ''}
                                onChange={(e) => handleUpdateEducation(index, 'startDate', e.target.value)}
                                placeholder="e.g. 2018"
                                className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                              <input
                                type="text"
                                value={edu.endDate || ''}
                                onChange={(e) => handleUpdateEducation(index, 'endDate', e.target.value)}
                                placeholder="e.g. 2022"
                                className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Projects */}
            {activeTab === 'projects' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm dark:shadow-black/30 space-y-5 transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Projects</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Key portfolio and technical projects</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProject}
                    className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Project</span>
                  </button>
                </div>

                {projects.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 italic">
                    No projects listed yet. Click "Add Project" above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {projects.map((proj, index) => (
                      <div
                        key={index}
                        className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-750 space-y-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Project #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveProject(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Project Title</label>
                            <input
                              type="text"
                              value={proj.title || ''}
                              onChange={(e) => handleUpdateProject(index, 'title', e.target.value)}
                              placeholder="e.g. AI Portfolio Generator"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Live Demo URL</label>
                            <input
                              type="url"
                              value={proj.liveUrl || ''}
                              onChange={(e) => handleUpdateProject(index, 'liveUrl', e.target.value)}
                              placeholder="https://example.com"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                            <textarea
                              rows={2}
                              value={proj.description || ''}
                              onChange={(e) => handleUpdateProject(index, 'description', e.target.value)}
                              placeholder="Brief summary of architecture and impact..."
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Certifications */}
            {activeTab === 'certifications' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm dark:shadow-black/30 space-y-5 transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Certifications</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Professional credentials and licenses</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCertification}
                    className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Certification</span>
                  </button>
                </div>

                {certifications.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 italic">
                    No certifications listed yet. Click "Add Certification" above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {certifications.map((cert, index) => (
                      <div
                        key={index}
                        className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-750 space-y-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Certification #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCertification(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Certification Name</label>
                            <input
                              type="text"
                              value={cert.name || ''}
                              onChange={(e) => handleUpdateCertification(index, 'name', e.target.value)}
                              placeholder="e.g. AWS Certified Solutions Architect"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Issuer</label>
                            <input
                              type="text"
                              value={cert.issuer || ''}
                              onChange={(e) => handleUpdateCertification(index, 'issuer', e.target.value)}
                              placeholder="e.g. Amazon Web Services"
                              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfileSetupPage;
