import React from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Bookmark,
  FileText,
  User,
  Send,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

// Essential navigation items
export const primaryNavItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'Jobs', path: '/dashboard/jobs', icon: Briefcase },
  { name: 'Saved Jobs', path: '/dashboard/saved', icon: Bookmark },
  { name: 'Resume', path: '/dashboard/resume', icon: FileText },
  { name: 'Profile', path: '/onboarding/profile', icon: User },
  { name: 'Applications', path: '/dashboard/applications', icon: Send },
];


export const settingsNavItem = {
  name: 'Settings',
  path: '/dashboard/settings',
  icon: Settings,
};

export const allNavItems = [...primaryNavItems, settingsNavItem];
export const navItems = allNavItems;

export const Sidebar = ({
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, mongoUser, logout } = useAuth();

  const displayName =
    currentUser?.displayName ||
    mongoUser?.name ||
    mongoUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
  const email = currentUser?.email || mongoUser?.email || '';

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };
  const initials = getInitials(displayName);

  const handleLogout = async () => {
    if (onClose) onClose();
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const isItemActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <aside
      className={`h-full flex flex-col bg-[#0B1930] border-r border-slate-800/80 select-none transition-all duration-300 relative text-slate-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* 1. Brand Logo Header */}
      <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 group focus:outline-none"
          onClick={onClose}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/25 shrink-0 group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base text-white tracking-tight flex items-center gap-1">
                Ai Job Agent
              </span>
            </div>
          )}
        </Link>

        {/* Desktop Collapse Toggle */}
        {onToggleCollapse && !isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Compact sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Main Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 transition-transform ${
                  active ? 'text-white' : 'text-slate-400 group-hover:text-white'
                }`}
              />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </div>

      {/* 3. Bottom Section: Settings & User Profile */}
      <div className="p-3 border-t border-slate-800/80 space-y-2 shrink-0">
        {/* Settings Navigation */}
        <Link
          to={settingsNavItem.path}
          onClick={onClose}
          title={isCollapsed ? settingsNavItem.name : undefined}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
            isItemActive(settingsNavItem)
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          } ${isCollapsed ? 'justify-center px-0' : ''}`}
        >
          <Settings className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-white" />
          {!isCollapsed && <span>{settingsNavItem.name}</span>}
        </Link>

        {/* Logged-in User Profile Summary */}
        <div
          className={`rounded-xl bg-slate-900/60 border border-slate-800 p-2.5 flex items-center justify-between gap-2.5 ${
            isCollapsed ? 'justify-center p-2' : ''
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">{email}</p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Collapsed Expand Button */}
        {isCollapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
