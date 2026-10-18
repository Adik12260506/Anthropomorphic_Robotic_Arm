import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Enable HTTPS if --https flag is present or HTTPS env var is set
const isHttps = process.argv.includes('--https') || process.env.HTTPS === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(isHttps ? [basicSsl()] : []),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
