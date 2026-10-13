import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HeroSection } from '../components/landing/HeroSection.jsx';
import { HowItWorksSection } from '../components/landing/HowItWorksSection.jsx';
import { FeaturesSection } from '../components/landing/FeaturesSection.jsx';
import { FinalCtaSection } from '../components/landing/FinalCtaSection.jsx';

export const HomePage = () => {
  const location = useLocation();

  // Scroll to hash element if present on mount or route transition
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [location.hash, location.pathname]);

  const handleScrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* 1. Hero Section & Product Preview */}
      <HeroSection onSeeHowItWorks={handleScrollToHowItWorks} />

      {/* 2. How It Works (3 Steps) */}
      <HowItWorksSection />

      {/* 3. Core Features (4 Cards) */}
      <FeaturesSection />

      {/* 4. Final CTA */}
      <FinalCtaSection />
    </div>
  );
};

export default HomePage;
