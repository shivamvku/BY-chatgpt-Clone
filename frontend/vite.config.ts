import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000' },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/highlight.js') ||
            id.includes('node_modules/rehype-highlight')
          )
            return 'syntax';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-'))
            return 'charts';
          if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/'))
            return 'mui';
          if (
            id.includes('node_modules/react-markdown') ||
            id.includes('node_modules/remark-') ||
            id.includes('node_modules/rehype-') ||
            id.includes('node_modules/micromark') ||
            id.includes('node_modules/mdast-') ||
            id.includes('node_modules/hast-')
          )
            return 'markdown';
        },
      },
    },
  },
});
