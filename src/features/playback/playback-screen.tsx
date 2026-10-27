import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useGetMediaProbe } from '@/api/generated/media-probe/media-probe'
import { useScreenFocusable } from '@/app/screen'
import { remainingLabel, speedLabel } from '@/lib/format'
import {
  playbackDisplayFrom,
  playbackListFrom,
  siblingPlaybackRoute,
} from '@/lib/navigation'
import { Backdrop } from '@/ui/anime-hero'
import { PlayButton } from '@/ui/play-button'
import { EndScreen } from './end-screen'
import { Player } from './player'
import { usePrefetchNext } from './use-prefetch-next'
import { useCacheDownload, type CacheDownloadState } from './use-cache-download'

const PLAYBACK_FOCUS_KEY = 'PLAYBACK'

/** Rota `/play/:fileId`: uma instância por arquivo. */
export function PlaybackRoute() {
  const { fileId } = useParams()
  return <PlaybackScreen key={fileId} fileId={Number(fileId)} />
}

function statusText(state: CacheDownloadState): string {
  switch (state.kind) {
    case 'checking':
      return 'Verificando o arquivo…'
    case 'queued':
      return 'Na fila para baixar'
    case 'downloading':
      return state.percentage == null
        ? 'Baixando…'
        : `Baixando ${Math.floor(state.percentage)}%`
    case 'ready':
      return 'Preparando a reprodução…'
    case 'failed':
      return 'Não foi possível baixar o arquivo'
    case 'error':
      return 'Não foi possível preparar o arquivo'
  }
}

function detailText(state: CacheDownloadState): string | undefined {
  if (state.kind === 'downloading') {
    const parts = [
      state.speed != null && speedLabel(state.speed),
      state.eta != null && `${remainingLabel(state.eta)} restantes`,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : undefined
  }
  if (state.kind === 'queued')
    return 'O download começa assim que a fila liberar.'
  if (state.kind === 'failed' || state.kind === 'error') return state.message
  return undefined
}

interface PlaybackScreenProps {
  fileId: number
}

/**
 * Reprodução em tela cheia (sem sidebar). Primeiro prepara o arquivo — se ele
 * está num storage remoto, baixa para o cache mostrando o progresso — e, com
 * ele pronto, lê as faixas (mediaprobe) e entrega para o player. A região é
 * uma fronteira de foco: as setas não alcançam a sidebar escondida.
 */
function PlaybackScreen({ fileId }: PlaybackScreenProps) {
  const { ref, focusKey, focusSelf } = useScreenFocusable({
    focusKey: PLAYBACK_FOCUS_KEY,
    isFocusBoundary: true,
  })
  // Tira o foco da tela de baixo (que fica montada e oculta): sem isso o OK
  // ainda acionaria o card de episódio que abriu esta tela.
  useEffect(() => {
    focusSelf()
  }, [focusSelf])
  const location = useLocation()
  const display = playbackDisplayFrom(location.state)
  const list = playbackListFrom(location.state)
  const { queue } = list
  const navigate = useNavigate()

  // Fim do vídeo: o player sai (a sessão para de receber heartbeat e expira)
  // e entra a tela de fim com o próximo da fila.
  const [ended, setEnded] = useState(false)
  const handleEnded = useCallback(() => setEnded(true), [])
  // Anterior/próximo da lista de origem, trocando a tela no lugar.
  const goSibling = useCallback(
    (direction: 1 | -1) => {
      if (!display) return
      const route = siblingPlaybackRoute({ fileId, display }, list, direction)
      if (route) navigate(...route)
    },
    [display, fileId, list, navigate],
  )
  const handleNext = useCallback(() => goSibling(1), [goSibling])
  const handlePrevious = useCallback(() => goSibling(-1), [goSibling])
  const handleBack = useCallback(() => navigate(-1), [navigate])
  const { state, retry } = useCacheDownload(fileId)

  const ready = state.kind === 'ready'
  const probe = useGetMediaProbe(fileId, { query: { enabled: ready } })
  // Com o atual pronto para tocar, o próximo da fila começa a baixar.
  usePrefetchNext(queue[0]?.fileId, ready)
  // Arquivo saiu do cache entre o "pronto" e o probe: volta a preparar.
  const probeMissing = probe.error?.status === 404
  useEffect(() => {
    if (probeMissing) retry()
  }, [probeMissing, retry])

  if (ended) {
    return (
      <FocusContext.Provider value={focusKey}>
        <section ref={ref} aria-label="Fim da reprodução">
          <EndScreen
            display={display}
            next={queue[0]}
            onNext={handleNext}
            onBack={handleBack}
          />
        </section>
      </FocusContext.Provider>
    )
  }

  if (ready && probe.data) {
    return (
      <FocusContext.Provider value={focusKey}>
        <section ref={ref} aria-label={display?.title ?? 'Reprodução'}>
          <Player
            fileId={fileId}
            probe={probe.data}
            display={display}
            onStale={retry}
            onEnded={handleEnded}
            onPrevious={list.previous.length > 0 ? handlePrevious : undefined}
            onNext={queue.length > 0 ? handleNext : undefined}
          />
        </section>
      </FocusContext.Provider>
    )
  }

  const percentage =
    state.kind === 'downloading'
      ? (state.percentage ?? 0)
      : state.kind === 'ready'
        ? 100
        : 0
  const showBar =
    state.kind === 'queued' ||
    state.kind === 'downloading' ||
    state.kind === 'ready'
  const detail = detailText(state)

  return (
    <FocusContext.Provider value={focusKey}>
      <section
        ref={ref}
        aria-label={display?.title ?? 'Reprodução'}
        className="bg-bg fixed inset-0 z-30 flex flex-col justify-end gap-6 px-[6rem] py-[3.375rem]"
      >
        <Backdrop src={display?.backdrop} />
        <div className="relative flex max-w-[56rem] flex-col gap-2">
          {display?.subtitle && (
            <p className="text-muted-foreground text-[1.75rem]">
              {display.subtitle}
            </p>
          )}
          {display?.title && (
            <h1 className="text-[3rem] leading-tight font-medium">
              {display.title}
            </h1>
          )}
        </div>

        <div className="relative flex max-w-[56rem] flex-col gap-3">
          <p role="status" className="text-[2rem] font-medium">
            {statusText(state)}
          </p>
          {showBar && (
            // Barra pelo scaleX de uma camada de largura fixa: só transform
            // anima (seção 7), nunca a largura.
            <div className="bg-surface-elevated h-3 w-[40rem] overflow-hidden rounded-full">
              <div
                className="bg-brand h-full w-full origin-left rounded-full"
                style={{
                  transform: `scaleX(${percentage / 100})`,
                  transition: 'transform 600ms linear',
                }}
              />
            </div>
          )}
          {detail && (
            <p className="text-muted-foreground text-[1.75rem]">{detail}</p>
          )}
        </div>

        {(state.kind === 'failed' || state.kind === 'error') && (
          <div className="relative">
            <PlayButton label="Tentar de novo" autoFocus onPress={retry} />
          </div>
        )}
      </section>
    </FocusContext.Provider>
  )
}
