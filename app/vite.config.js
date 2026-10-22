import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|scheduler|react-router-dom|react-router)(?:[\\/]|$)/,
              priority: 30,
              minSize: 10000,
            },
            {
              name: 'firebase-vendor',
              test: /node_modules[\\/](?:firebase|@firebase)(?:[\\/]|$)/,
              priority: 20,
              minSize: 20000,
              maxSize: 250000,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 0,
              minSize: 20000,
              maxSize: 250000,
            },
          ],
        },
      },
    },
  },
})
