import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import type { MediaInfoResponse } from '@/api/generated/akariAPI.schemas'
import { registerBackHandler } from '@/app/back'
import type { PlaybackDisplay } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { PlayButton } from '@/ui/play-button'
import { Spinner } from '@/ui/spinner'
import {
  CONTROLS_FOCUS_KEY,
  PLAY_FOCUS_KEY,
  PlayerControls,
  TRACKS_FOCUS_KEY,
} from './player-controls'
import { transparentPlayer, usePlaybackEngine } from './playback-engine'
import { TrackPanel } from './track-panel'
import {
  TRANSCODE_FAILED_MESSAGE,
  usePlaybackSession,
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

/** Faixas iniciais: as marcadas como padrão no arquivo, senão a primeira de áudio e nenhuma legenda. */
function defaultTracks(probe: MediaInfoResponse): TrackSelection {
  const audio = probe.audio.findIndex((track) => track.defaultTrack)
  const subtitle = probe.subtitles.findIndex((track) => track.defaultTrack)
  return {
    audio: Math.max(0, audio),
    subtitle: subtitle >= 0 ? subtitle : null,
  }
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
  const initialTracks = useMemo(() => defaultTracks(probe), [probe])
  const playback = usePlaybackSession(fileId, initialTracks)
  const { state, source, tracks, seek, switchTracks, reportPosition, retry } =
    playback

  // Mensagem do erro do motor (playlist ou segmento); `undefined` sem erro.
  const [failed, setFailed] = useState<string>()

  const duration = probe.container.durationSeconds ?? undefined
  // Avisa o fim uma vez só (o `ended` e a posição podem chegar juntos).
  const ended = useRef(false)
  const endedOnce = useCallback(() => {
    if (ended.current) return
    ended.current = true
    onEnded()
  }, [onEnded])

  // Posição da mídia = offset da fonte + tempo do motor.
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

  const {
    view: engineView,
    togglePlay: toggleEngine,
    seek: seekEngine,
  } = usePlaybackEngine(source, {
    onTime: (local) => {
      const absolute = offset + local
      const target = seekTarget.current
      // Fim: o evento `ended` do motor e, por garantia, a posição chegando à
      // duração do probe — a playlist é `EVENT` e o fim depende de o backend
      // ter fechado a lista, o que nem sempre chega antes do último quadro.
      if (
        target === undefined &&
        duration &&
        absolute >= duration - END_TOLERANCE_SECONDS
      ) {
        endedOnce()
      }
      if (target !== undefined) {
        if (Math.abs(absolute - target) > SEEK_SETTLE_TOLERANCE_SECONDS) return
        settleSeek()
      }
      setPosition(absolute)
      reportPosition(absolute)
    },
    onPausedChange: setPaused,
    onBufferingChange: setBuffering,
    onEnded: endedOnce,
    onFatal: (transcodeFailed) =>
      setFailed(
        transcodeFailed
          ? TRANSCODE_FAILED_MESSAGE
          : 'A reprodução foi interrompida.',
      ),
  })

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
          if (result && seekTarget.current === target) {
            seekEngine(result.localTime)
          }
        })
      }, SEEK_COMMIT_MS)
    },
    [clamp, position, seek, seekEngine, settleSeek, showOsd],
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
    toggleEngine()
  }, [showOsd, toggleEngine])

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
      <div
        ref={ref}
        className={cn('fixed inset-0 z-30', !transparentPlayer && 'bg-black')}
      >
        {engineView}
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
