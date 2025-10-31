module.exports = {
  darkMode: 'class',
  content: [
    // scan source, pages, components and app folders so Tailwind keeps classes used in pages/
    "./src/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    // include mina-scheduler package for Tailwind class scanning
    "./node_modules/mina-scheduler/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        status: {
          present: '#10B981', // green-500
          absent: '#EF4444',  // red-500
          late: '#F97316',    // orange-500
          excused: '#F59E0B', // yellow-500
          holiday: '#3B82F6'  // blue-500
        }
      },
      // Ensure gradient colors are included
      gradientColorStops: theme => theme('colors'),
    },
  },
  plugins: [
    require('daisyui')
  ],
  daisyui: {
    themes: [
      'light', // default light theme
      'dark'   // include dark for future use
    ],
    darkTheme: 'dark'
  }
}