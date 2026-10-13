/**
 * Centralized Design Tokens for AI Job Application Agent
 * Consistent Design System across entire application
 */

export const colors = {
  background: '#F6F8FC',
  navy: {
    DEFAULT: '#0B1930',
    dark: '#07101E',
    light: '#14294B',
  },
  primary: {
    DEFAULT: '#2563EB',
    hover: '#1D4ED8',
    light: '#EFF6FF',
  },
  ai: {
    DEFAULT: '#06B6D4',
    light: '#ECFEFF',
  },
  surface: {
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    muted: '#F8FAFC',
    input: '#F8FAFC',
  },
  border: {
    DEFAULT: '#E2E8F0',
    subtle: '#F1F5F9',
    focus: '#2563EB',
  },
  text: {
    primary: '#111827',
    secondary: '#64748B',
    muted: '#94A3B8',
    inverted: '#FFFFFF',
  },
  status: {
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    info: '#2563EB',
    infoBg: '#EFF6FF',
  },
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
  cardHover: '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
  glow: '0 0 20px -3px rgba(37, 99, 235, 0.25)',
};

export const transitions = {
  default: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  smooth: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};
