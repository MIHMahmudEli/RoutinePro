/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/index.html",
    "./public/js/**/*.js",
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
