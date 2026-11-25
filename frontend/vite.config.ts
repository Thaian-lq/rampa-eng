import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const single = process.env.SINGLE === '1'

export default defineConfig({
  plugins: single ? [react(), viteSingleFile()] : [react()],
  build: { outDir: single ? 'dist-single' : 'dist', chunkSizeWarningLimit: 2000 },
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
