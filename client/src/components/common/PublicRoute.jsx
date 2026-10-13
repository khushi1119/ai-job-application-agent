import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';

/**
 * PublicRoute Guard
 * Protects public-only authentication routes like /login and /signup.
 * If user is already authenticated, redirects them to /dashboard (or their intended destination).
 */
export const PublicRoute = ({ children }) => {
  const { currentUser, mongoUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
        <LoadingSpinner size="md" message="Checking session..." />
      </div>
    );
  }

  if (currentUser) {
    const target = location.state?.from?.pathname;
    const defaultDestination =
      mongoUser && mongoUser.onboardingCompleted === false ? '/onboarding/resume' : '/dashboard';
    const destination = target && target !== '/login' && target !== '/signup' ? target : defaultDestination;
    return <Navigate to={destination} replace />;
  }

  return children ? children : <Outlet />;
};

export default PublicRoute;
