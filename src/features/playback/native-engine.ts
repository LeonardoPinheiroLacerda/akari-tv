import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { NativePlayer, nativePlayback } from './native-player'
import type { EngineHandlers, PlaybackEngine } from './playback-engine'
import type { PlaybackSource } from './use-playback-session'

// Classe no <html> enquanto o player nativo existe: a página fica
// transparente para o vídeo, desenhado por baixo da WebView, aparecer
// (index.css).
const NATIVE_VIDEO_CLASS = 'native-video'

// Id de cada `load`, único no app inteiro: eventos de uma fonte já trocada (ou
// de um player anterior) chegam com o id antigo e são ignorados.
let nextLoadId = 1

// Um player que sobrou de uma página recarregada (o JS some, o nativo não).
if (nativePlayback) void NativePlayer.release()

/** Motor do app Android: o `NativePlayerPlugin` (Media3) por baixo da WebView. */
export function useNativeEngine(
  source: PlaybackSource | undefined,
  handlers: EngineHandlers,
): PlaybackEngine {
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })
  const loadId = useRef(0)
  const paused = useRef(false)

  useEffect(() => {
    const root = document.documentElement
    root.classList.add(NATIVE_VIDEO_CLASS)
    return () => {
      root.classList.remove(NATIVE_VIDEO_CLASS)
      void NativePlayer.release()
    }
  }, [])

  useEffect(() => {
    const handles = [
      NativePlayer.addListener('timeupdate', (event) => {
        if (event.id === loadId.current) latest.current.onTime(event.position)
      }),
      NativePlayer.addListener('state', (event) => {
        if (event.id !== loadId.current) return
        paused.current = event.paused
        latest.current.onPausedChange(event.paused)
        latest.current.onBufferingChange(event.buffering)
        if (event.ended) latest.current.onEnded()
      }),
      NativePlayer.addListener('error', (event) => {
        if (event.id === loadId.current)
          latest.current.onFatal(event.transcodeFailed)
      }),
    ]
    return () => {
      for (const handle of handles) void handle.then((h) => h.remove())
    }
  }, [])

  useEffect(() => {
    if (!source) return
    const id = nextLoadId
    nextLoadId += 1
    loadId.current = id
    paused.current = false
    void NativePlayer.load({
      id,
      url: source.url,
      startPosition: source.localStart,
    })
  }, [source])

  const togglePlay = useCallback(() => {
    if (paused.current) void NativePlayer.play()
    else void NativePlayer.pause()
  }, [])

  const seek = useCallback((local: number) => {
    void NativePlayer.seek({ position: local })
  }, [])

  return { view: null, togglePlay, seek }
}
