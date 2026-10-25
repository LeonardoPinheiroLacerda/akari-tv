import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Proxy de API (seção 5 da especificação) fica para quando os caminhos reais
  // do contrato forem conhecidos (gerados a partir de http://localhost:8080/q/openapi).
})
