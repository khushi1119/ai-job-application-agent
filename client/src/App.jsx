import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { DashboardLayout } from './layouts/DashboardLayout.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { LoginPage, SignupPage, ForgotPasswordPage } from './pages/auth/index.js';
import { ProtectedRoute } from './components/common/ProtectedRoute.jsx';
import { PublicRoute } from './components/common/PublicRoute.jsx';
import { OnboardingRoute } from './components/common/OnboardingRoute.jsx';
import { ResumeUploadPage } from './pages/onboarding/ResumeUploadPage.jsx';
import { ProfileSetupPage } from './pages/onboarding/ProfileSetupPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Dashboard Routes
import { DashboardOverviewPage } from './pages/dashboard/DashboardOverviewPage.jsx';
import { JobsPlaceholderPage } from './pages/dashboard/JobsPlaceholderPage.jsx';
import { SavedJobsPlaceholderPage } from './pages/dashboard/SavedJobsPlaceholderPage.jsx';
import { ApplicationsPlaceholderPage } from './pages/dashboard/ApplicationsPlaceholderPage.jsx';
import { ResumePlaceholderPage } from './pages/dashboard/ResumePlaceholderPage.jsx';
import { ProfilePlaceholderPage } from './pages/dashboard/ProfilePlaceholderPage.jsx';
import { AgentPlaceholderPage } from './pages/dashboard/AgentPlaceholderPage.jsx';
import { SettingsPlaceholderPage } from './pages/dashboard/SettingsPlaceholderPage.jsx';

const OnboardingIndex = () => {
  const { mongoUser } = useAuth();
  if (mongoUser?.hasResume && mongoUser?.hasProfile) {
    return <Navigate to="profile" replace />;
  }
  return <Navigate to="resume" replace />;
};

export const App = () => {
  return (
    <Routes>
      {/* Main Application Layout */}
      <Route path="/" element={<AppLayout />}>
        <Route index element={<HomePage />} />
        
        {/* Public-only auth routes (redirects authenticated users to /dashboard) */}
        <Route element={<PublicRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
        </Route>

        <Route path="forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Onboarding Flow (Requires auth; redirects completed onboarding to /dashboard) */}
      <Route
        path="/onboarding"
        element={
          <OnboardingRoute />
        }
      >
        <Route index element={<OnboardingIndex />} />
        <Route path="resume" element={<ResumeUploadPage />} />
        <Route path="profile" element={<ProfileSetupPage />} />
      </Route>

      {/* Protected Dashboard Layout (redirects unauthenticated users to /login) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverviewPage />} />
        <Route path="jobs" element={<JobsPlaceholderPage />} />
        <Route path="saved" element={<SavedJobsPlaceholderPage />} />
        <Route path="applications" element={<ApplicationsPlaceholderPage />} />
        <Route path="resume" element={<ResumePlaceholderPage />} />
        <Route path="profile" element={<Navigate to="/onboarding/profile" replace />} />
        <Route path="agent" element={<AgentPlaceholderPage />} />
        <Route path="settings" element={<SettingsPlaceholderPage />} />
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<AppLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default App;
