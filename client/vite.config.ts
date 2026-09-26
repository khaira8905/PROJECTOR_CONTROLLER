import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Listen on the LAN so a projector laptop can open /display/:eventId.
    host: true,
    proxy: {
      // xfwd: the server sees the address the browser used (needed for the Google OAuth callback URL).
      '/api': { target: API_TARGET, changeOrigin: true, xfwd: true },
      '/socket.io': { target: API_TARGET, ws: true, changeOrigin: true, xfwd: true },
    },
  },
});
