import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/gitsparse/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.unit.test.ts', 'src/**/*.unit.test.tsx'],
    alias: {
      '@/': path.resolve(__dirname, './src') + '/',
    },
  },
});
