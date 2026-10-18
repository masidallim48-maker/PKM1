/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        school: {
          950: '#003f32',
          900: '#005643',
          800: '#006a52',
          100: '#dcefe9',
        },
      },
      boxShadow: {
        card: '0 8px 22px rgba(0, 35, 27, 0.12)',
      },
    },
  },
  plugins: [],
}