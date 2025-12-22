import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    strictPort: true,
    hmr: {
      timeout: 60000,
      clientPort: 443,
    },
  },
  optimizeDeps: {
    include: ['lucide-react', 'recharts'],
  },
});
