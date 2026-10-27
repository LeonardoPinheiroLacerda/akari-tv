import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Hls, { type LoadPolicy, type RetryConfig } from 'hls.js'
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import type { MediaInfoResponse } from '@/api/generated/akariAPI.schemas'
import { registerBackHandler } from '@/app/back'
import type { PlaybackDisplay } from '@/lib/navigation'
import { PlayButton } from '@/ui/play-button'
import { Spinner } from '@/ui/spinner'
import {
  CONTROLS_FOCUS_KEY,
  PLAY_FOCUS_KEY,
  PlayerControls,
  TRACKS_FOCUS_KEY,
} from './player-controls'
import { TrackPanel } from './track-panel'
import {
  TRANSCODE_FAILED_MESSAGE,
  usePlaybackSession,
  type PlaybackSource,
  type TrackSelection,
} from './use-playback-session'

const PLAYER_FOCUS_KEY = 'PLAYER'
const SEEK_STEP_SECONDS = 10
// "Pular abertura": salto fixo de 1:25, a duração típica de uma abertura de anime.
const SKIP_INTRO_SECONDS = 85
// O seek para a esta distância do fim: um transcode reiniciado no último
// segundo não gera playlist (o backend responde TRANSCODE_FAILED), e o resto
// toca até o fim normalmente.
const SEEK_END_MARGIN_SECONDS = 10
// A posição a menos disso da duração conta como fim do vídeo.
const END_TOLERANCE_SECONDS = 0.75
// Setas seguidas acumulam o alvo; o seek só vai pro backend quando o usuário para.
const SEEK_COMMIT_MS = 600
// O alvo do seek fica na barra até o vídeo reportar uma posição a esta
// distância dele; antes disso, as posições antigas (do trecho de antes, ou da
// fonte que está sendo trocada) são ignoradas.
const SEEK_SETTLE_TOLERANCE_SECONDS = 1.5
// Se o vídeo nunca chegar perto do alvo (erro, fim da mídia), solta a barra.
const SEEK_SETTLE_TIMEOUT_MS = 15000
// Os controles somem sozinhos depois disso sem tecla, se o vídeo estiver tocando.
const OSD_HIDE_MS = 5000
// Poster transparente de 1px: sem `poster`, a WebView do Android desenha o
// próprio placeholder (ícone de play cinza, em baixa resolução) enquanto o
// vídeo não tem quadro — no lugar dele entra o spinner do app.
const TRANSPARENT_POSTER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** Faixas iniciais: as marcadas como padrão no arquivo, senão a primeira de áudio e nenhuma legenda. */
function defaultTracks(probe: MediaInfoResponse): TrackSelection {
  const audio = probe.audio.findIndex((track) => track.defaultTrack)
  const subtitle = probe.subtitles.findIndex((track) => track.defaultTrack)
  return {
    audio: Math.max(0, audio),
    subtitle: subtitle >= 0 ? subtitle : null,
  }
}

/**
 * Anexa a fonte HLS ao `<video>` (`hls.js`; a WebView não toca HLS nativo).
 * Cada `source.key` é um transcode novo: destrói o anterior e começa em
 * `localStart`. A playlist é `EVENT` (cresce enquanto o backend transcodifica),
 * então o hls.js a trata como ao vivo — por isso a posição inicial explícita,
 * senão ele começaria na borda.
 */
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

interface PlayerProps {
  fileId: number
  probe: MediaInfoResponse
  display?: PlaybackDisplay
  /** O arquivo saiu do cache (sessão `404` ao iniciar): a tela volta a prepará-lo. */
  onStale: () => void
  /** O vídeo chegou ao fim. */
  onEnded: () => void
  /** Episódio anterior/próximo da lista de origem; ausente quando não há. */
  onPrevious?: () => void
  onNext?: () => void
}

/**
 * Player em tela cheia, em dois modos:
 * - tela limpa (controles ocultos, ou visíveis só como informação durante um
 *   seek): ◀ ▶ voltam e avançam direto, OK pausa e mostra os controles, ▲ ▼
 *   mostram os controles;
 * - controles ativos: o foco anda pelos botões (voltar, play/pause, avançar,
 *   áudio e legendas) e pela barra de progresso; Voltar esconde os controles.
 * As teclas de mídia do controle funcionam nos dois. A região é uma fronteira
 * de foco: as setas nunca saem para a sidebar.
 */
export function Player({
  fileId,
  probe,
  display,
  onStale,
  onEnded,
  onPrevious,
  onNext,
}: PlayerProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const initialTracks = useMemo(() => defaultTracks(probe), [probe])
  const playback = usePlaybackSession(fileId, initialTracks)
  const { state, source, tracks, seek, switchTracks, reportPosition, retry } =
    playback

  // Mensagem do erro do hls.js (playlist ou segmento); `undefined` sem erro.
  const [failed, setFailed] = useState<string>()
  const handleFatal = useCallback(
    (transcodeFailed: boolean) =>
      setFailed(
        transcodeFailed
          ? TRANSCODE_FAILED_MESSAGE
          : 'A reprodução foi interrompida.',
      ),
    [],
  )
  useHlsSource(video, source, handleFatal)

  const duration = probe.container.durationSeconds ?? undefined
  // Avisa o fim uma vez só (o `ended` e a posição podem chegar juntos).
  const ended = useRef(false)
  const endedOnce = useCallback(() => {
    if (ended.current) return
    ended.current = true
    onEnded()
  }, [onEnded])

  // Posição da mídia = offset da fonte + tempo do <video>.
  const [position, setPosition] = useState(0)
  const [paused, setPaused] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [pendingSeek, setPendingSeek] = useState<number>()
  const offset = source?.offset ?? 0

  // Alvo do seek em andamento, do primeiro toque na seta até o vídeo chegar
  // lá — inclui a espera pela resposta do backend e pela fonte nova quando o
  // transcode reinicia. Sem isso a barra voltava para a posição antiga entre
  // soltar a seta e o vídeo realmente pular.
  const seekTarget = useRef<number | undefined>(undefined)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const settleSeek = useCallback(() => {
    clearTimeout(settleTimer.current)
    seekTarget.current = undefined
    setPendingSeek(undefined)
  }, [])

  useEffect(() => {
    if (!video) return
    const onTime = () => {
      const absolute = offset + video.currentTime
      const target = seekTarget.current
      if (target !== undefined) {
        if (Math.abs(absolute - target) > SEEK_SETTLE_TOLERANCE_SECONDS) return
        settleSeek()
      }
      setPosition(absolute)
      reportPosition(absolute)
    }
    const onPause = () => setPaused(true)
    const onPlay = () => setPaused(false)
    const onWaiting = () => setBuffering(true)
    const onPlaying = () => setBuffering(false)
    // Fim: o evento `ended` do <video> e, por garantia, a posição chegando à
    // duração do probe — a playlist é `EVENT` e o fim depende de o backend
    // ter fechado a lista, o que nem sempre chega antes do último quadro.
    const onEnd = () => endedOnce()
    const onEndByTime = () => {
      const absolute = offset + video.currentTime
      if (
        seekTarget.current === undefined &&
        duration &&
        absolute >= duration - END_TOLERANCE_SECONDS
      ) {
        endedOnce()
      }
    }
    video.addEventListener('ended', onEnd)
    video.addEventListener('timeupdate', onEndByTime)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('pause', onPause)
    video.addEventListener('play', onPlay)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('ended', onEnd)
      video.removeEventListener('timeupdate', onEndByTime)
    }
  }, [video, offset, reportPosition, settleSeek, duration, endedOnce])

  // Controles: `controlsActive` = foco nos botões. Visíveis também durante
  // carregamento, pausa ou seek em andamento. Qualquer tecla adia o sumiço.
  const [controlsActive, setControlsActive] = useState(false)
  const [osdUntil, setOsdUntil] = useState(() => Date.now() + OSD_HIDE_MS)
  const [now, setNow] = useState(() => Date.now())
  const showOsd = useCallback(() => setOsdUntil(Date.now() + OSD_HIDE_MS), [])
  // Tocando, sem tecla por um tempo, os controles saem (pausado ou com o
  // painel aberto eles ficam). Lido por ref para o timer não reiniciar a
  // cada mudança desses estados.
  const keepControls = useRef({ paused: false, panelOpen: false })
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setNow(Date.now())
        if (!keepControls.current.paused && !keepControls.current.panelOpen) {
          setControlsActive(false)
        }
      },
      Math.max(0, osdUntil - Date.now()) + 50,
    )
    return () => clearTimeout(timer)
  }, [osdUntil])
  const idle = now >= osdUntil

  const clamp = useCallback(
    (seconds: number) =>
      Math.max(
        0,
        duration
          ? Math.min(seconds, duration - SEEK_END_MARGIN_SECONDS)
          : seconds,
      ),
    [duration],
  )

  // Seek acumulado: cada seta move o alvo; o backend só é chamado quando para.
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const stepSeek = useCallback(
    (delta: number) => {
      showOsd()
      // Base é o alvo em andamento, mesmo depois de enviado ao backend: um
      // novo toque continua de onde a barra está, não da posição antiga.
      const target = clamp((seekTarget.current ?? position) + delta)
      seekTarget.current = target
      setPendingSeek(target)
      clearTimeout(settleTimer.current)
      clearTimeout(commitTimer.current)
      commitTimer.current = setTimeout(() => {
        settleTimer.current = setTimeout(settleSeek, SEEK_SETTLE_TIMEOUT_MS)
        void seek(target).then((result) => {
          // Só aplica se nenhum toque novo mudou o alvo enquanto isso.
          if (result && video && seekTarget.current === target) {
            video.currentTime = result.localTime
          }
        })
      }, SEEK_COMMIT_MS)
    },
    [clamp, position, seek, settleSeek, showOsd, video],
  )
  useEffect(
    () => () => {
      clearTimeout(commitTimer.current)
      clearTimeout(settleTimer.current)
    },
    [],
  )

  const togglePlay = useCallback(() => {
    showOsd()
    if (!video) return
    if (video.paused) void video.play().catch(() => undefined)
    else video.pause()
  }, [showOsd, video])

  const step = useCallback(
    (direction: 1 | -1) => stepSeek(direction * SEEK_STEP_SECONDS),
    [stepSeek],
  )

  const skipIntro = useCallback(() => stepSeek(SKIP_INTRO_SECONDS), [stepSeek])

  const activateControls = useCallback(() => {
    showOsd()
    setControlsActive(true)
  }, [showOsd])
  const deactivateControls = useCallback(() => setControlsActive(false), [])

  // O foco acompanha o modo: ativos → botão de play; tela limpa → o próprio
  // player (a região dos controles está fora da navegação nesse modo).
  useEffect(() => {
    setFocus(controlsActive ? PLAY_FOCUS_KEY : PLAYER_FOCUS_KEY)
  }, [controlsActive])

  // Painel de faixas: Voltar fecha o painel antes de esconder os controles,
  // e o foco volta para o botão que o abriu.
  const [panelOpen, setPanelOpen] = useState(false)
  const closePanel = useCallback(() => {
    setPanelOpen(false)
    showOsd()
    setFocus(TRACKS_FOCUS_KEY)
  }, [showOsd])
  useLayoutEffect(() => {
    keepControls.current = { paused, panelOpen }
  })
  useEffect(() => {
    if (!panelOpen) return
    return registerBackHandler(() => {
      closePanel()
      return true
    })
  }, [panelOpen, closePanel])

  useEffect(() => {
    if (!controlsActive) return
    return registerBackHandler(() => {
      deactivateControls()
      return true
    })
  }, [controlsActive, deactivateControls])

  const handleSelectTracks = useCallback(
    (selection: TrackSelection) => {
      closePanel()
      if (
        selection.audio === tracks.audio &&
        selection.subtitle === tracks.subtitle
      )
        return
      setFailed(undefined)
      // A troca reinicia o transcode na posição atual: segura o tempo e a
      // barra nela, como num seek, até o vídeo novo chegar lá — no meio da
      // troca o vídeo antigo ainda reporta tempos da fonte anterior.
      seekTarget.current = position
      setPendingSeek(position)
      clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(settleSeek, SEEK_SETTLE_TIMEOUT_MS)
      void switchTracks(selection, position)
    },
    [closePanel, position, settleSeek, switchTracks, tracks],
  )

  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: PLAYER_FOCUS_KEY,
    isFocusBoundary: true,
    preferredChildFocusKey: CONTROLS_FOCUS_KEY,
    onEnterPress: () => {
      togglePlay()
      activateControls()
    },
    onArrowPress: (direction) => {
      if (direction === 'left') step(-1)
      else if (direction === 'right') step(1)
      else activateControls()
      return false
    },
  })
  useEffect(() => {
    focusSelf()
  }, [focusSelf])

  // Teclas de mídia do controle chegam como keydown (seção 6).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      showOsd()
      if (panelOpen) return
      if (
        event.key === 'MediaPlayPause' ||
        event.key === 'MediaPlay' ||
        event.key === 'MediaPause'
      ) {
        togglePlay()
      } else if (event.key === 'MediaFastForward') {
        stepSeek(SEEK_STEP_SECONDS)
      } else if (event.key === 'MediaRewind') {
        stepSeek(-SEEK_STEP_SECONDS)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, showOsd, stepSeek, togglePlay])

  useEffect(() => {
    if (state.kind === 'stale') onStale()
  }, [state.kind, onStale])

  const loading = buffering || state.kind === 'starting'
  const error = state.kind === 'error' ? state.message : failed
  const handleRetry = useCallback(() => {
    setFailed(undefined)
    retry()
    setFocus(PLAYER_FOCUS_KEY)
  }, [retry])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="fixed inset-0 z-30 bg-black">
        <video
          ref={setVideo}
          className="absolute inset-0 size-full"
          poster={TRANSPARENT_POSTER}
          playsInline
        />
        {loading && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}
        <PlayerControls
          display={display}
          position={pendingSeek ?? position}
          duration={duration}
          chapters={probe.chapters}
          paused={paused}
          visible={
            controlsActive ||
            panelOpen ||
            paused ||
            loading ||
            pendingSeek !== undefined ||
            !idle
          }
          active={controlsActive && !panelOpen && !error}
          stepSeconds={SEEK_STEP_SECONDS}
          onTogglePlay={togglePlay}
          onStep={step}
          onOpenTracks={() => setPanelOpen(true)}
          onSkipIntro={skipIntro}
          onPrevious={onPrevious}
          onNext={onNext}
        />
        {error && (
          <div className="bg-bg/80 absolute inset-0 flex flex-col items-center justify-center gap-6">
            <p className="text-[2rem] font-medium">{error}</p>
            <PlayButton
              label="Tentar de novo"
              autoFocus
              onPress={handleRetry}
            />
          </div>
        )}
        {panelOpen && (
          <TrackPanel
            probe={probe}
            selection={tracks}
            onSelect={handleSelectTracks}
          />
        )}
      </div>
    </FocusContext.Provider>
  )
}
