import type { CapacitorConfig } from '@capacitor/cli'

// Seção 8 da especificação.
const isDev = process.env.NODE_ENV !== 'production'

const config: CapacitorConfig = {
  appId: 'com.akari.tv',
  appName: 'Akari TV',
  webDir: 'dist',
  server: {
    // WebView fala com o backend em HTTP na rede local sem bloqueio de conteúdo misto.
    androidScheme: 'http',
  },
  android: {
    allowMixedContent: isDev,
  },
}

export default config
