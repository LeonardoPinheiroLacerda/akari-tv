import type { ReactNode } from 'react'
import { nativePlayback } from './native-player'
import { useNativeEngine } from './native-engine'
import type { PlaybackSource } from './use-playback-session'
import { useWebEngine } from './web-engine'

/**
 * Eventos do motor de reprodução. Lidos sempre na versão mais recente (por
 * ref): trocar os callbacks não reinicia nada no motor.
 */
export interface EngineHandlers {
  /** Tempo dentro da fonte atual (`localStart` + avanço), a cada avanço ou seek. */
  onTime: (local: number) => void
  onPausedChange: (paused: boolean) => void
  onBufferingChange: (buffering: boolean) => void
  onEnded: () => void
  /** Erro fatal da playlist ou de um segmento; `transcodeFailed`: o backend respondeu 500. */
  onFatal: (transcodeFailed: boolean) => void
}

export interface PlaybackEngine {
  /** O que desenhar na camada do player: o `<video>` no navegador; nada no nativo. */
  view: ReactNode
  togglePlay: () => void
  /** Posiciona dentro da fonte atual, sem trocar de transcode. */
  seek: (local: number) => void
}

/**
 * Motor que toca a fonte HLS da sessão. Cada `source.key` é um transcode novo,
 * tocado a partir de `source.localStart`.
 *
 * No app Android o vídeo vai para o player nativo (Media3): o `<video>` da
 * WebView não para o áudio na hora — na pausa ele seguia por ~0,5 s e no seek
 * tocava a posição antiga sobre o vídeo novo. No navegador fica o `<video>`
 * com hls.js. A escolha é fixa por plataforma.
 */
export const usePlaybackEngine: (
  source: PlaybackSource | undefined,
  handlers: EngineHandlers,
) => PlaybackEngine = nativePlayback ? useNativeEngine : useWebEngine

/** Com o player nativo, a camada do player é transparente: o vídeo fica atrás da WebView. */
export const transparentPlayer = nativePlayback
