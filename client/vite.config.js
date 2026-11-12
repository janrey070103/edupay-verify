import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// The app calls "/api"; Vite passes those requests to the Express server.
const proxy = { '/api': { target: 'http://localhost:5000', changeOrigin: true } }

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run dev:lan` (TESTING ONLY): reachable from phones and other PCs on
  // the same Wi-Fi, over HTTPS so the QR camera works. Plain `npm run dev`
  // stays on this PC only.
  const lan = mode === 'lan'
  return {
    plugins: [react(), tailwindcss(), ...(lan ? [basicSsl()] : [])],
    server: { host: lan ? true : 'localhost', proxy },
    preview: { proxy },
  }
})
