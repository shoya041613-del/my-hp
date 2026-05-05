import { defineConfig } from 'vite';

// Vite 設定
// - ビルドエントリ: index.html（ÉPUREメインページ）
// - 開発時: /api/* を Express バックエンド（port 3001）にプロキシ
export default defineConfig({
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
