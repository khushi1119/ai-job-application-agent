import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';

/**
 * OnboardingRoute Guard
 * Protects onboarding routes like /onboarding/resume.
 * - If unauthenticated, redirects to /login.
 * - If user has already completed onboarding, redirects to /dashboard.
 * - Allows access if user is authenticated and onboardingCompleted is false.
 */
export const OnboardingRoute = ({ children }) => {
  const { currentUser, mongoUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070D18] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading onboarding..." />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isProfileRoute = location.pathname.includes('/onboarding/profile');
  const isResumeRoute = location.pathname.includes('/onboarding/resume');
  const isReupload = location.search.includes('reupload=true');

  // 3. Resume exists + completed profile -> redirect to /dashboard unless editing profile or re-uploading
  if (mongoUser && mongoUser.onboardingCompleted === true) {
    if (!isProfileRoute && !isReupload) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // 1. No resume -> /onboarding/resume
  if (mongoUser && !mongoUser.hasResume && isProfileRoute) {
    return <Navigate to="/onboarding/resume" replace />;
  }

  // 2. Resume exists + profile exists but onboardingCompleted=false -> real editable /onboarding/profile
  if (
    mongoUser &&
    mongoUser.hasResume &&
    mongoUser.hasProfile &&
    isResumeRoute &&
    !isReupload
  ) {
    return <Navigate to="/onboarding/profile" replace />;
  }

  return children ? children : <Outlet />;
};

export default OnboardingRoute;
