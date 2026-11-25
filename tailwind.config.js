/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Arabic"', '"Cairo"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          sidebar: '#142d50',
          'sidebar-label': '#a8c7ff',
          'sidebar-active': '#2c5895',
          primary: '#245fb0',
          'primary-hover': '#1d4e92',
          accent: '#204e8e',
          page: '#f6f8fc',
          card: '#ffffff',
          border: '#d9e2ee',
          'input-border': '#cdd9e6',
          ink: '#1c2c42',
          muted: '#5e728a',
          'table-head': '#edf2f9',
          info: '#eaf1fa',
          note: '#eef3fa',
          'note-border': '#5d86bc',
          success: '#28644f',
          'success-bg': '#e8f4ee',
        },
      },
    },
  },
  plugins: [],
};
