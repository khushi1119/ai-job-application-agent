import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Settings as SettingsIcon,
  Bell,
  Shield,
  LogOut,
  Mail,
  CheckCircle2,
  ExternalLink,
  Sliders,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

export const SettingsPlaceholderPage = () => {
  const navigate = useNavigate();
  const { currentUser, mongoUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeSection, setActiveSection] = useState('account');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [matchAlerts, setMatchAlerts] = useState(true);

  const displayName =
    mongoUser?.name ||
    mongoUser?.displayName ||
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
  const email = currentUser?.email || mongoUser?.email || '';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const sections = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'preferences', label: 'Profile preferences', icon: Sliders },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'logout', label: 'Logout', icon: LogOut, danger: true },
  ];

  return (
    <div className="space-y-6 max-w-4xl font-sans">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your account preferences, theme appearance, and notification alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Navigation Sidebar inside Settings */}
        <div className="md:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-2 shadow-sm space-y-1 transition-colors">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                id={`settings-tab-${sec.id}`}
                data-testid={`settings-tab-${sec.id}`}
                onClick={() => {
                  if (sec.id === 'logout') {
                    handleLogout();
                  } else {
                    setActiveSection(sec.id);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all text-left ${
                  sec.danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                    : isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section Content Area */}
        <div className="md:col-span-8 space-y-5">
          {/* 1. Account Section */}
          {activeSection === 'account' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-5 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Account Information</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your core user details and credentials</p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
                    {displayName}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email Address</label>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 flex items-center justify-between">
                    <span>{email}</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 font-medium">
                      Verified
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    to="/onboarding/profile"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                  >
                    <span>Edit full candidate profile &rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* 2. Appearance Section */}
          {activeSection === 'appearance' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-5 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Appearance &amp; Theme</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize how the interface looks and feels</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  id="theme-select-light"
                  data-testid="theme-select-light"
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-3 ${
                    theme === 'light'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Sun className="w-4 h-4" />
                    </div>
                    {theme === 'light' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Light Mode</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Clean, bright interface</p>
                  </div>
                </button>

                <button
                  type="button"
                  id="theme-select-dark"
                  data-testid="theme-select-dark"
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-3 ${
                    theme === 'dark'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <Moon className="w-4 h-4" />
                    </div>
                    {theme === 'dark' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Dark Mode</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Reduced eye strain in low light</p>
                  </div>
                </button>

                <button
                  type="button"
                  id="theme-select-system"
                  data-testid="theme-select-system"
                  onClick={() => setTheme('system')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-3 ${
                    theme === 'system'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-400 flex items-center justify-center">
                      <Laptop className="w-4 h-4" />
                    </div>
                    {theme === 'system' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">System Default</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Matches your device theme</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 3. Profile Preferences */}
          {activeSection === 'preferences' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-5 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Profile Preferences</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize your job target and work mode settings</p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Role Category</label>
                  <input
                    type="text"
                    defaultValue="Software Engineering / Frontend"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 outline-none focus:bg-white dark:focus:bg-slate-850 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Preferred Location</label>
                  <input
                    type="text"
                    defaultValue="Remote / Hybrid"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 outline-none focus:bg-white dark:focus:bg-slate-850 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. Notifications */}
          {activeSection === 'notifications' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-5 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose which notifications you wish to receive</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 cursor-pointer">
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                      New Job Matches
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Receive alerts when new roles match 90%+ of your profile.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={matchAlerts}
                    onChange={(e) => setMatchAlerts(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 cursor-pointer">
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                      Application Updates
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Get notified when an employer responds to your submission.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* 5. Security */}
          {activeSection === 'security' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-5 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Security</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Password management and security safeguards</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                      Password Reset
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Need to update or change your password?
                    </span>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Send Reset Link
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPlaceholderPage;
