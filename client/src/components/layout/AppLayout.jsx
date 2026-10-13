import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import { Footer } from './Footer.jsx';

export const AppLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] dark:bg-[#070D18] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Main navigation */}
      <Navbar />

      {/* Route content */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default AppLayout;
