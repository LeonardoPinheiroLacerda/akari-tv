import { useLocation, useParams } from 'react-router-dom'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useScreenFocusable } from '@/app/screen'
import { remainingLabel, speedLabel } from '@/lib/format'
import { playbackDisplayFrom } from '@/lib/navigation'
import { Backdrop } from '@/ui/anime-hero'
import { PlayButton } from '@/ui/play-button'
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
      return 'Pronto para reproduzir'
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
  if (state.kind === 'ready') return 'O player entra na próxima etapa.'
  if (state.kind === 'failed' || state.kind === 'error') return state.message
  return undefined
}

interface PlaybackScreenProps {
  fileId: number
}

/**
 * Reprodução (placeholder): por enquanto só prepara o arquivo — se ele está num
 * storage remoto, baixa para o cache e mostra o progresso — e para em "Pronto
 * para reproduzir". O player (sessão HLS) entra na próxima etapa.
 */
function PlaybackScreen({ fileId }: PlaybackScreenProps) {
  const { ref, focusKey } = useScreenFocusable({ focusKey: PLAYBACK_FOCUS_KEY })
  const display = playbackDisplayFrom(useLocation().state)
  const { state, retry } = useCacheDownload(fileId)

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
        className="flex h-[calc(100svh-6.75rem)] flex-col justify-end gap-6 pb-12"
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
