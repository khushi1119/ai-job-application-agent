/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // App Theme Core Palette
        brand: {
          bg: '#F6F8FC',
          navy: '#0B1930',
          'navy-dark': '#07101E',
          'navy-light': '#132644',
          blue: '#2563EB',
          'blue-hover': '#1D4ED8',
          'blue-light': '#EFF6FF',
          ai: '#06B6D4',
          'ai-light': '#ECFEFF',
          text: '#111827',
          muted: '#64748B',
          border: '#E2E8F0',
          card: '#FFFFFF',
          success: '#10B981',
          'success-light': '#ECFDF5',
          warning: '#F59E0B',
          'warning-light': '#FFFBEB',
          error: '#EF4444',
          'error-light': '#FEF2F2',
        },
        navy: {
          950: '#07101E',
          900: '#0B1930',
          850: '#0E1E38',
          800: '#14294B',
          700: '#1E3A66',
          600: '#2A4D85',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
        'ai-glow': '0 0 25px -5px rgba(37, 99, 235, 0.25)',
      },
    },
  },
  plugins: [],
};
