/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        night:    { blue: '#071426' },
        ink: {
          50:  '#F3F1EA',
          100: '#E7E3D6',
          200: '#CFC9B8',
          300: '#A8A293',
          400: '#8A8578',
          500: '#6B655C',
          600: '#4A4A44',
          700: '#383A3D',
          800: '#2A2E37',
          900: '#1E2229',
        },
        paper:  { DEFAULT: '#F5F1E6', card: '#FCFAF4' },
        moon:   { white: '#DCE8FF' },
        vermilion: {
          400: '#DA1E2B',
          500: '#C41824',
          600: '#A8131D',
        },
        imperial: { red: '#DA1E2B', gold: '#D9A845' },
      },
      fontFamily: {
        brand: ['"Noto Serif SC"', 'serif'],
        sans:  ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
