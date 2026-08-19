import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  // three-globe 体积大，启动时预打包，避免首次进入页面时浏览器请求超时（504/白屏）
  optimizeDeps: {
    include: ['three-globe'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          echarts: ['echarts', 'echarts-for-react'],
          editor: ['@tiptap/react', '@tiptap/starter-kit'],
        },
      },
    },
  },
})
