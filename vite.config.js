import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // SPA history fallback — Vite dev server serves index.html for all routes by default
  // (appType: 'spa' is the default). For production, configure your hosting to do the same.
});
