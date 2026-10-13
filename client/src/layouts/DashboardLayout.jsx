import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/dashboard/Sidebar.jsx';
import { Topbar } from '../components/dashboard/Topbar.jsx';
import { MobileNav } from '../components/dashboard/MobileNav.jsx';

export const DashboardLayout = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  });

  // Responsive listener: auto-compact on tablet, auto-expand on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen flex bg-[#F6F8FC] dark:bg-[#070D18] text-slate-800 dark:text-slate-100 relative overflow-hidden font-sans transition-colors duration-200">
      {/* Desktop & Tablet Sidebar (Fixed left) */}
      <div className="hidden md:flex shrink-0 h-screen sticky top-0 z-20 shadow-sm">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile Drawer (Hidden on md+) */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area: fills remaining viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#F6F8FC] dark:bg-[#070D18]">
        {/* Sticky Topbar */}
        <Topbar
          onMenuClick={() => setIsMobileNavOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F6F8FC] dark:bg-[#070D18]">
          {/* Child route page */}
          <div className="max-w-7xl mx-auto w-full pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
