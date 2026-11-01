import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { subscribeCacheEvents } from '@/api/cache-events'
import { ApiError } from '@/api/errors'
import type { CacheEvent, CacheItemId } from '@/api/generated/akariAPI.schemas'
import {
  deleteCacheItem,
  queueCacheDownload,
} from '@/api/generated/cache/cache'
import { getFileAvailability } from '@/api/generated/playback/playback'

// Espera antes de conferir de novo quando o stream cai por erro de rede.
const RETRY_DELAY_MS = 3000

export type CacheDownloadState =
  | { kind: 'checking' }
  | {
      kind: 'queued'
      /** Downloads na frente deste na fila (serial); ausente até o `SNAPSHOT`. */
      ahead?: number
      /** Nome do arquivo que está baixando agora, na frente deste. */
      current?: string
    }
  | {
      kind: 'downloading'
      percentage?: number
      bytes?: number
      totalBytes?: number
      /** bytes/segundo */
      speed?: number
      /** segundos restantes */
      eta?: number
    }
  | { kind: 'ready' }
  | { kind: 'failed'; message?: string }
  | { kind: 'error'; message: string }

function reducer(
  state: CacheDownloadState,
  action: CacheDownloadState,
): CacheDownloadState {
  // Um evento de progresso sem métricas não apaga as métricas que já vieram.
  if (action.kind === 'downloading' && state.kind === 'downloading') {
    return {
      kind: 'downloading',
      percentage: action.percentage ?? state.percentage,
      bytes: action.bytes ?? state.bytes,
      totalBytes: action.totalBytes ?? state.totalBytes,
      speed: action.speed ?? state.speed,
      eta: action.eta ?? state.eta,
    }
  }
  return action
}

// Eventos em que uma linha sai da fila ativa.
const LEAVES_QUEUE = new Set<CacheEvent['type']>([
  'COMPLETED',
  'FAILED',
  'EVICTED',
  'CANCELLED',
  'DELETED',
])

/**
 * Cancela, ao sair da tela, o download que ela mesma enfileirou. Confere a
 * disponibilidade antes: o `DELETE` numa linha já `COMPLETED` apagaria o
 * arquivo baixado, então só cancela se a mesma linha ainda estiver baixando.
 * Falha aqui é silenciosa — no pior caso o download termina e fica no cache.
 */
async function cancelOwnedDownload(fileId: number, itemId: CacheItemId) {
  try {
    const availability = await getFileAvailability(fileId)
    if (
      availability.status === 'DOWNLOADING' &&
      availability.cacheItemId === itemId
    ) {
      await deleteCacheItem(itemId)
    }
  } catch {
    // Sem rede ou linha já resolvida: nada a cancelar.
  }
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Sem resposta do servidor.'
}

/**
 * Deixa o arquivo pronto para tocar, seguindo o fluxo do contrato:
 * `GET …/availability` diz o que falta; `NEEDS_DOWNLOAD` enfileira
 * (`POST /v1/cache/items`); `DOWNLOADING` (ou logo após enfileirar) acompanha
 * pelo SSE `/v1/cache/events` até `COMPLETED`. Toda dúvida (stream fechado com
 * `IDLE`, linha removida, conexão caída) volta para o `availability`, que é a
 * fonte da verdade — o hook nunca deduz o estado sozinho.
 *
 * Sair da tela fecha o stream e cancela o download que esta tela enfileirou e
 * que ainda não terminou — um episódio aberto por engano não ocupa a fila
 * (serial, um download por vez). Download que já estava em andamento quando a
 * tela abriu (iniciado por outra tela ou pelo portal) não é cancelado.
 */
export function useCacheDownload(fileId: number) {
  const [state, dispatch] = useReducer(reducer, { kind: 'checking' })
  // Cada tentativa é um ciclo novo do efeito (availability → fila → stream);
  // os estados intermediários não reiniciam o ciclo nem fecham o stream.
  const [attempt, setAttempt] = useState(0)
  const recheck = useCallback(() => {
    dispatch({ kind: 'checking' })
    setAttempt((count) => count + 1)
  }, [])

  // Linha de cache criada por esta tela; só ela é cancelada ao sair.
  const ownedItemId = useRef<CacheItemId | undefined>(undefined)
  useEffect(() => {
    const owned = ownedItemId
    return () => {
      if (owned.current) void cancelOwnedDownload(fileId, owned.current)
    }
  }, [fileId])

  useEffect(() => {
    const controller = new AbortController()
    let closeStream: (() => void) | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    function follow(itemId: CacheItemId) {
      // Fila na frente deste arquivo, montada pelo `SNAPSHOT` (ordem de
      // `queuedAt`) e reduzida pelos eventos das outras linhas. É só
      // informação de tela: o estado do arquivo continua vindo dos eventos
      // dele e do availability.
      const ahead = new Map<CacheItemId, string | undefined>()
      let downloadingId: CacheItemId | undefined
      let waiting = true
      const dispatchQueued = () =>
        dispatch({
          kind: 'queued',
          ahead: ahead.size,
          current: downloadingId && ahead.get(downloadingId),
        })

      closeStream = subscribeCacheEvents({
        onEvent: (event: CacheEvent) => {
          if (event.type === 'SNAPSHOT') {
            const items = [...(event.items ?? [])].sort((a, b) =>
              a.queuedAt.localeCompare(b.queuedAt),
            )
            const item = items.find((entry) => entry.id === itemId)
            if (!item) return recheck()
            ahead.clear()
            for (const entry of items.slice(0, items.indexOf(item))) {
              ahead.set(entry.id, entry.videoFile?.name)
              if (entry.status === 'DOWNLOADING') downloadingId = entry.id
            }
            if (item.status === 'DOWNLOADING') {
              waiting = false
              return dispatch({ kind: 'downloading' })
            }
            return dispatchQueued()
          }
          if (event.type === 'IDLE') return recheck()
          if (event.id !== itemId) {
            if (!event.id || !ahead.has(event.id)) return
            if (event.type === 'STARTED') downloadingId = event.id
            else if (LEAVES_QUEUE.has(event.type)) ahead.delete(event.id)
            else return
            if (waiting) dispatchQueued()
            return
          }
          switch (event.type) {
            case 'QUEUED':
              waiting = true
              return dispatchQueued()
            case 'STARTED':
              waiting = false
              return dispatch({ kind: 'downloading' })
            case 'PROGRESS':
              waiting = false
              return dispatch({
                kind: 'downloading',
                percentage: event.percentage ?? undefined,
                bytes: event.bytes ?? undefined,
                totalBytes: event.totalBytes ?? undefined,
                speed: event.speed ?? undefined,
                eta: event.eta ?? undefined,
              })
            case 'COMPLETED':
              closeStream?.()
              return dispatch({ kind: 'ready' })
            case 'FAILED':
              return dispatch({
                kind: 'failed',
                message: event.errorMessage ?? undefined,
              })
            default:
              // EVICTED, CANCELLED, DELETED: a linha sumiu; o availability diz o que fazer.
              return recheck()
          }
        },
        onError: () => {
          retryTimer = setTimeout(recheck, RETRY_DELAY_MS)
        },
      })
    }

    async function run() {
      try {
        const availability = await getFileAvailability(fileId, {
          signal: controller.signal,
        })
        if (availability.status === 'READY') return dispatch({ kind: 'ready' })
        if (availability.status === 'DOWNLOADING' && availability.cacheItemId) {
          dispatch({ kind: 'queued' })
          return follow(availability.cacheItemId)
        }
        const item = await queueCacheDownload(
          { fileId },
          { signal: controller.signal },
        )
        ownedItemId.current = item.id
        dispatch({ kind: 'queued' })
        follow(item.id)
      } catch (error) {
        if (controller.signal.aborted) return
        // Outro cliente pode ter enfileirado entre o availability e o POST.
        if (
          error instanceof ApiError &&
          error.code === 'BUSINESS_RULE_VIOLATION'
        ) {
          retryTimer = setTimeout(recheck, RETRY_DELAY_MS)
          return
        }
        dispatch({ kind: 'error', message: messageOf(error) })
      }
    }

    // Adiado pelo mesmo motivo do início da sessão (`usePlaybackSession`): a
    // montagem descartada do StrictMode não chega a consultar nem enfileirar.
    const startTimer = setTimeout(() => void run(), 0)
    return () => {
      clearTimeout(startTimer)
      controller.abort()
      closeStream?.()
      clearTimeout(retryTimer)
    }
  }, [attempt, fileId, recheck])

  return { state, retry: recheck }
}
