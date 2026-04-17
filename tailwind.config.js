/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./js/**/*.js",
    "./api/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        '900': ['900'],
      },
      fontWeight: {
        '900': '900',
      }
    },
  },
  plugins: [],
}
