import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import Hls, { type LoadPolicy, type RetryConfig } from 'hls.js'
import type { EngineHandlers, PlaybackEngine } from './playback-engine'
import type { PlaybackSource } from './use-playback-session'

// Poster transparente de 1px: sem `poster`, a WebView do Android desenha o
// próprio placeholder (ícone de play cinza, em baixa resolução) enquanto o
// vídeo não tem quadro — no lugar dele entra o spinner do app.
const TRANSPARENT_POSTER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

// O backend responde 404 enquanto o transcode ainda não gerou a playlist (≈2s
// numa sessão nova; mais com legenda queimada) ou o segmento pedido. O hls.js
// nunca repete em 4xx (`retryForHttpStatus`) e, no manifesto, só tenta mais uma
// vez — o 404 passageiro virava erro fatal. Aqui o 404 conta como "ainda não":
// repete a cada 1s até ~30s antes de desistir.
// O 500 é o contrário: `TRANSCODE_FAILED` (o ffmpeg morreu, a sessão não se
// recupera) — nunca repete, vira erro na hora. O hls.js não expõe o corpo da
// resposta no erro, então o `code` não dá para ler; o 500 nos endpoints de
// sessão é tratado como esse caso. 502/504 seguem a política padrão.
const TRANSCODE_FAILED_STATUS = 500
const NOT_READY_RETRY: RetryConfig = {
  maxNumRetry: 30,
  retryDelayMs: 1000,
  maxRetryDelayMs: 1000,
  backoff: 'linear',
  shouldRetry: (config, retryCount, _isTimeout, response, retry) => {
    if (response?.code === TRANSCODE_FAILED_STATUS) return false
    return (
      retry ||
      (response?.code === 404 && retryCount < (config?.maxNumRetry ?? 0))
    )
  },
}

function notReadyPolicy(maxLoadTimeMs: number): LoadPolicy {
  return {
    default: {
      maxTimeToFirstByteMs: 10000,
      maxLoadTimeMs,
      timeoutRetry: { maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0 },
      errorRetry: NOT_READY_RETRY,
    },
  }
}

/**
 * Anexa a fonte HLS ao `<video>` (`hls.js`; a WebView não toca HLS nativo).
 * Cada `source.key` é um transcode novo: destrói o anterior e começa em
 * `localStart`. A playlist é `EVENT` (cresce enquanto o backend transcodifica),
 * então o hls.js a trata como ao vivo — por isso a posição inicial explícita,
 * senão ele começaria na borda.
 */
function useHlsSource(
  video: HTMLVideoElement | null,
  source: PlaybackSource | undefined,
  onFatal: (transcodeFailed: boolean) => void,
) {
  useEffect(() => {
    if (!video || !source) return
    const hls = new Hls({
      startPosition: source.localStart,
      maxBufferLength: 30,
      backBufferLength: 30,
      lowLatencyMode: false,
      manifestLoadPolicy: notReadyPolicy(20000),
      playlistLoadPolicy: notReadyPolicy(20000),
      fragLoadPolicy: notReadyPolicy(120000),
    })
    let recovered = false
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
        recovered = true
        hls.recoverMediaError()
        return
      }
      onFatal(data.response?.code === TRANSCODE_FAILED_STATUS)
    })
    hls.on(
      Hls.Events.MANIFEST_PARSED,
      () => void video.play().catch(() => undefined),
    )
    hls.loadSource(source.url)
    hls.attachMedia(video)
    return () => hls.destroy()
  }, [video, source, onFatal])
}

/** Motor do navegador: `<video>` com hls.js. */
export function useWebEngine(
  source: PlaybackSource | undefined,
  handlers: EngineHandlers,
): PlaybackEngine {
  // O elemento em estado (os efeitos reagem à montagem) e em ref (as ações
  // imperativas: play, pause, seek).
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element
    setVideo(element)
  }, [])
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })

  const handleFatal = useCallback(
    (transcodeFailed: boolean) => latest.current.onFatal(transcodeFailed),
    [],
  )
  useHlsSource(video, source, handleFatal)

  useEffect(() => {
    if (!video) return
    const onTime = () => latest.current.onTime(video.currentTime)
    const onPause = () => latest.current.onPausedChange(true)
    const onPlay = () => latest.current.onPausedChange(false)
    const onWaiting = () => latest.current.onBufferingChange(true)
    const onPlaying = () => latest.current.onBufferingChange(false)
    const onEnded = () => latest.current.onEnded()
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('pause', onPause)
    video.addEventListener('play', onPlay)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('ended', onEnded)
    }
  }, [video])

  const togglePlay = useCallback(() => {
    const current = videoRef.current
    if (!current) return
    if (current.paused) void current.play().catch(() => undefined)
    else current.pause()
  }, [])

  const seek = useCallback((local: number) => {
    if (videoRef.current) videoRef.current.currentTime = local
  }, [])

  return {
    view: (
      <video
        ref={attachVideo}
        className="absolute inset-0 size-full"
        poster={TRANSPARENT_POSTER}
        playsInline
      />
    ),
    togglePlay,
    seek,
  }
}
