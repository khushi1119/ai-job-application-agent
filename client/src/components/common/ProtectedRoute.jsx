import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';

/**
 * ProtectedRoute Guard
 * Protects dashboard routes requiring authentication and completed onboarding.
 * - If user is unauthenticated, redirects to /login preserving the requested location.
 * - If authenticated user's onboardingCompleted is false, redirects to /onboarding/resume.
 */
export const ProtectedRoute = ({ children }) => {
  const { currentUser, mongoUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070D18] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading workspace..." />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Route guards for dashboard access:
  // 1. No resume -> /onboarding/resume
  if (mongoUser && !mongoUser.hasResume) {
    return <Navigate to="/onboarding/resume" replace />;
  }

  // 2. Resume exists + profile exists but onboardingCompleted=false -> real editable /onboarding/profile
  if (mongoUser && !mongoUser.onboardingCompleted) {
    return <Navigate to="/onboarding/profile" replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
