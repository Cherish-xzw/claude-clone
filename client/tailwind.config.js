/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#CC785C',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        surface: {
          light: '#F5F5F5',
          dark: '#2A2A2A',
        },
        background: {
          light: '#FFFFFF',
          dark: '#1A1A1A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      }
    },
  },
  plugins: [],
}
