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
import { FastForward, RotateCcw, SkipForward } from 'lucide-react'
import type { MediaInfoResponse } from '@/api/generated/akariAPI.schemas'
import { registerBackHandler } from '@/app/back'
import type { PlaybackDisplay } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { Spinner } from '@/ui/spinner'
import { creditsStart, openingAt } from './chapters'
import { HudPill } from './hud'
import {
  CONTROLS_FOCUS_KEY,
  PLAY_FOCUS_KEY,
  PlayerControls,
  TRACKS_FOCUS_KEY,
  type PlayerOffer,
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
// Uma oferta nova ("Pular abertura", "Próximo episódio") flutua sozinha na
// tela por este tempo; depois fica só nos controles, quando eles aparecem.
const OFFER_PROMPT_MS = 5000

interface PlayerProps {
  fileId: number
  /** Posição da mídia onde a reprodução começa (de onde o perfil parou). */
  startSeconds?: number
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
  startSeconds,
  probe,
  display,
  onStale,
  onEnded,
  onPrevious,
  onNext,
}: PlayerProps) {
  // As faixas iniciais saem das preferências do backend (idioma padrão de
  // áudio e legenda); `tracks` fica `undefined` até a sessão responder.
  const playback = usePlaybackSession(fileId, startSeconds)
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
  const [position, setPosition] = useState(startSeconds ?? 0)
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
  // Durante o seek pelas setas o vídeo fica congelado (pausado) e só volta a
  // tocar quando chega no ponto escolhido — se estava tocando quando o seek
  // começou. `undefined`: nenhum seek das setas em andamento.
  const resumeAfterSeek = useRef<boolean | undefined>(undefined)

  // Créditos finais (encerramento/prévia, pelos capítulos): daí em diante o
  // próximo episódio fica oferecido.
  const credits = useMemo(
    () => creditsStart(probe.chapters, duration),
    [probe.chapters, duration],
  )

  const {
    view: engineView,
    togglePlay: toggleEngine,
    play: playEngine,
    pause: pauseEngine,
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

  // O vídeo chegou no alvo (ou desistiu dele): solta a barra e aplica a
  // decisão de retomar. Com o transcode reiniciado, a fonte nova começa
  // tocando sozinha — por isso também pausa quando não é para retomar.
  const settleSeek = useCallback(() => {
    clearTimeout(settleTimer.current)
    seekTarget.current = undefined
    setPendingSeek(undefined)
    const resume = resumeAfterSeek.current
    resumeAfterSeek.current = undefined
    if (resume === true) playEngine()
    else if (resume === false) pauseEngine()
  }, [pauseEngine, playEngine])

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
      // Primeiro toque: congela o vídeo e guarda se ele deve voltar a tocar.
      if (resumeAfterSeek.current === undefined) {
        resumeAfterSeek.current = !paused
        pauseEngine()
      }
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
    [
      clamp,
      paused,
      pauseEngine,
      position,
      seek,
      seekEngine,
      settleSeek,
      showOsd,
    ],
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
    // No meio de um seek o vídeo segue congelado (o botão mostra "Reproduzir"):
    // apertar faz ele tocar quando chegar no alvo.
    if (resumeAfterSeek.current !== undefined) {
      resumeAfterSeek.current = true
      return
    }
    toggleEngine()
  }, [showOsd, toggleEngine])

  const step = useCallback(
    (direction: 1 | -1) => stepSeek(direction * SEEK_STEP_SECONDS),
    [stepSeek],
  )

  // Até o fim do capítulo de abertura em que o vídeo está.
  const skipIntro = useCallback(() => {
    const base = seekTarget.current ?? position
    const opening = openingAt(probe.chapters, base)
    if (opening) stepSeek(opening.endSeconds - base)
  }, [position, probe.chapters, stepSeek])

  // Oferta do momento, pelos capítulos: "Pular abertura" dentro da abertura,
  // "Próximo episódio" nos créditos finais. Sem esses capítulos, nenhuma.
  const shownPosition = pendingSeek ?? position
  const offerKey = openingAt(probe.chapters, shownPosition)
    ? 'PLAYER_SKIP_INTRO'
    : onNext && credits !== undefined && shownPosition >= credits
      ? 'PLAYER_NEXT_OFFER'
      : undefined

  // Quando uma oferta aparece, ela flutua na tela por `OFFER_PROMPT_MS` e o
  // OK do player aciona ela; depois disso o OK volta a pausar e a oferta fica
  // só nos controles. Sair e voltar ao capítulo oferece de novo.
  const [prompt, setPrompt] = useState<{ key?: string; open: boolean }>({
    open: false,
  })
  if (offerKey !== prompt.key) {
    setPrompt({ key: offerKey, open: offerKey !== undefined })
  }
  useEffect(() => {
    if (!prompt.open) return
    const timer = setTimeout(
      () => setPrompt((current) => ({ ...current, open: false })),
      OFFER_PROMPT_MS,
    )
    return () => clearTimeout(timer)
  }, [prompt])
  const prompting = prompt.open && offerKey === prompt.key

  const offer = useMemo((): PlayerOffer | undefined => {
    if (offerKey === 'PLAYER_SKIP_INTRO')
      return {
        focusKey: offerKey,
        label: 'Pular abertura',
        icon: FastForward,
        onPress: skipIntro,
      }
    if (offerKey === 'PLAYER_NEXT_OFFER' && onNext)
      return {
        focusKey: offerKey,
        label: 'Próximo episódio',
        icon: SkipForward,
        onPress: onNext,
      }
    return undefined
  }, [offerKey, onNext, skipIntro])

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
        selection.audio === tracks?.audio &&
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
    // Na tela limpa, OK aciona a oferta enquanto ela flutua na tela.
    onEnterPress: () => {
      if (offer && prompting) {
        offer.onPress()
        return
      }
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
          // Antes da sessão responder ainda não se sabe as faixas ativas.
          onOpenTracks={() => tracks && setPanelOpen(true)}
          offer={offer}
          prompting={prompting}
          onPrevious={onPrevious}
          onNext={onNext}
        />
        {error && (
          <div className="bg-bg/80 absolute inset-0 flex flex-col items-center justify-center gap-6">
            <p className="text-[2rem] font-medium">{error}</p>
            <HudPill
              label="Tentar de novo"
              icon={RotateCcw}
              autoFocus
              onPress={handleRetry}
            />
          </div>
        )}
        {panelOpen && tracks && (
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
