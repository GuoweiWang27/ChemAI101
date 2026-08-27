/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        science: {
          50: '#faf8f5',
          100: '#f0ece4',
          200: '#e8d5b8',
          300: '#D4A76A',
          400: '#b98a45',
          500: '#8C1515',
          600: '#7a1212',
          700: '#6f1010',
          800: '#5a0d0d',
          900: '#471010',
        },
        sand: {
          DEFAULT: '#D4A76A',
          dark: '#866027',
          light: '#e8d5b8',
        },
        accent: '#8C1515',
      },
      fontFamily: {
        sans: ['Source Serif 4', 'Georgia', 'serif'],
        serif: ['Source Serif 4', 'Georgia', 'serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
};
