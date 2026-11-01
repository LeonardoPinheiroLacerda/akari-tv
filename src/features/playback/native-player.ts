import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core'

/** Eventos do `NativePlayerPlugin`; `id` é o do `load` que gerou o evento. */
export interface NativeTimeEvent {
  id: number
  /** Segundos dentro da fonte carregada. */
  position: number
}

export interface NativeStateEvent {
  id: number
  paused: boolean
  buffering: boolean
  ended: boolean
}

export interface NativeErrorEvent {
  id: number
  /** O backend respondeu 500 (`TRANSCODE_FAILED`). */
  transcodeFailed: boolean
  message?: string
}

interface NativePlayerPlugin {
  load(options: {
    id: number
    url: string
    startPosition: number
  }): Promise<void>
  play(): Promise<void>
  pause(): Promise<void>
  seek(options: { position: number }): Promise<void>
  release(): Promise<void>
  addListener(
    event: 'timeupdate',
    listener: (event: NativeTimeEvent) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    event: 'state',
    listener: (event: NativeStateEvent) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    event: 'error',
    listener: (event: NativeErrorEvent) => void,
  ): Promise<PluginListenerHandle>
}

/**
 * Player nativo do app Android (`android/.../NativePlayerPlugin.java`): Media3
 * desenhando o vídeo por baixo da WebView. No navegador não existe — lá o
 * player é o `<video>` com hls.js.
 */
export const NativePlayer = registerPlugin<NativePlayerPlugin>('NativePlayer')

/** `true` no app Android: o vídeo toca no player nativo. */
export const nativePlayback = Capacitor.isPluginAvailable('NativePlayer')
