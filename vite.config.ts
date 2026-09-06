import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    {
      name: 'dialkit-local-fonts',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('/dialkit/') && id.endsWith('.css')) {
          // DialKit's optional Google font is unnecessary for a local offline editor.
          return code.replace(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com\/[^'"]+['"]\);?/g, '');
        }
      },
    },
    react(),
  ],
  base: './',
  server: { port: 5199 },
});
