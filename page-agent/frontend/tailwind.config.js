/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        night:    { blue: '#071426' },
        ink:      { blue: '#132B45' },
        moon:     { white: '#DCE8FF' },
        imperial: { gold: '#C89B3C' },
      },
      fontFamily: {
        brand: ['"Noto Serif SC"', 'serif'],
        sans:  ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
