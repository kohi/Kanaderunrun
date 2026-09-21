import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: './', // Use relative path for universal deployment (root or subfolder on rental servers)
  plugins: [
    react(),
    tailwindcss(),
  ],
});
