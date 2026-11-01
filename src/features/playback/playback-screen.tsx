import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useGetMediaProbe } from '@/api/generated/media-probe/media-probe'
import { useGetVideoFile } from '@/api/generated/video-file/video-file'
import { useScreenFocusable } from '@/app/screen'
import { remainingLabel, sizeLabel, speedLabel } from '@/lib/format'
import {
  playbackDisplayFrom,
  playbackListFrom,
  siblingPlaybackRoute,
} from '@/lib/navigation'
import { Backdrop } from '@/ui/anime-hero'
import { PlayButton } from '@/ui/play-button'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
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

/** Bytes baixados e total, à esquerda sob a barra ("1,2 GB de 2,8 GB"). */
function amountText(
  state: CacheDownloadState,
  fileSize: number | undefined,
): string | undefined {
  if (state.kind !== 'downloading') return undefined
  const total = state.totalBytes ?? fileSize
  if (state.bytes == null) return total != null ? sizeLabel(total) : undefined
  return total != null
    ? `${sizeLabel(state.bytes)} de ${sizeLabel(total)}`
    : sizeLabel(state.bytes)
}

/** Velocidade e tempo restante, à direita sob a barra. */
function rateText(state: CacheDownloadState): string | undefined {
  if (state.kind !== 'downloading') return undefined
  const parts = [
    state.speed != null && speedLabel(state.speed),
    state.eta != null && `${remainingLabel(state.eta)} restantes`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function queueText(ahead: number): string {
  if (ahead === 0) return 'Próximo da fila'
  return ahead === 1 ? '1 download na frente' : `${ahead} downloads na frente`
}

function detailText(state: CacheDownloadState): string | undefined {
  if (state.kind === 'queued') {
    if (state.ahead == null)
      return 'O download começa assim que a fila liberar.'
    const queue = queueText(state.ahead)
    return state.current ? `${queue} · baixando agora: ${state.current}` : queue
  }
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
  // Nome, tamanho e formato do arquivo, para a tela de preparo.
  const fileQuery = useGetVideoFile(fileId)
  const file = fileQuery.data

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
  const fileSize = file?.sizeBytes ?? undefined
  const amount = amountText(state, fileSize)
  const rate = rateText(state)
  const fileMeta = [
    fileSize != null && sizeLabel(fileSize),
    file?.format?.toUpperCase(),
  ].filter(Boolean)

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

        <div className="relative flex w-[48rem] max-w-full flex-col gap-3">
          <p role="status" className="text-[2rem] font-medium">
            {statusText(state)}
          </p>
          {showBar && (
            // Barra pelo scaleX de uma camada de largura fixa: só transform
            // anima (seção 7), nunca a largura.
            <div className="bg-surface-elevated h-3 w-full overflow-hidden rounded-full">
              <div
                className="bg-brand h-full w-full origin-left rounded-full"
                style={{
                  transform: `scaleX(${percentage / 100})`,
                  transition: 'transform 600ms linear',
                }}
              />
            </div>
          )}
          {(amount || rate) && (
            <div className="text-muted-foreground flex justify-between gap-6 text-[1.75rem] tabular-nums">
              <span>{amount}</span>
              <span>{rate}</span>
            </div>
          )}
          {detail && (
            <p className="text-muted-foreground truncate text-[1.75rem]">
              {detail}
            </p>
          )}
          {file && (
            // O nome corta com reticências; tamanho e formato ficam sempre visíveis.
            <p className="text-muted-foreground mt-3 flex gap-3 font-mono text-[1.5rem]">
              <span className="truncate">{file.name}</span>
              {fileMeta.length > 0 && (
                <span className="shrink-0">· {fileMeta.join(' · ')}</span>
              )}
            </p>
          )}
          {fileQuery.isPending && (
            <SkeletonGroup label="Carregando o arquivo" className="mt-3">
              <Skeleton className="h-[1.5rem] w-[36rem] rounded-md" />
            </SkeletonGroup>
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
