/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#F5F5F5',
          100: '#E8E8E8',
          200: '#D0D0D0',
          300: '#B0B0B0',
          400: '#888888',
          500: '#555555',
          600: '#333333',
          700: '#1A1A1A',
          800: '#111111',
          900: '#0A0A0A',
          DEFAULT: '#0A0A0A',
        },
        secondary: '#888888',
        surface: '#F5F5F5',
        danger: '#ef4444',
        success: '#22c55e',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
