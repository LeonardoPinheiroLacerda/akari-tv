import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { subscribeCacheEvents, type CacheEvent } from '@/api/cache-events'
import { ApiError } from '@/api/errors'
import type { CacheItemId } from '@/api/generated/akariAPI.schemas'
import {
  deleteCacheItem,
  queueCacheDownload,
} from '@/api/generated/cache/cache'
import { getFileAvailability } from '@/api/generated/playback/playback'

// Espera antes de conferir de novo quando o stream cai por erro de rede.
const RETRY_DELAY_MS = 3000

export type CacheDownloadState =
  | { kind: 'checking' }
  | { kind: 'queued' }
  | { kind: 'downloading'; percentage?: number; speed?: number; eta?: number }
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
      speed: action.speed ?? state.speed,
      eta: action.eta ?? state.eta,
    }
  }
  return action
}

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
      closeStream = subscribeCacheEvents({
        onEvent: (event: CacheEvent) => {
          if (event.type === 'SNAPSHOT') {
            const item = event.items?.find((entry) => entry.id === itemId)
            if (!item) return recheck()
            return dispatch(
              item.status === 'DOWNLOADING'
                ? { kind: 'downloading' }
                : { kind: 'queued' },
            )
          }
          if (event.type === 'IDLE') return recheck()
          if (event.id !== itemId) return
          switch (event.type) {
            case 'QUEUED':
              return dispatch({ kind: 'queued' })
            case 'STARTED':
              return dispatch({ kind: 'downloading' })
            case 'PROGRESS':
              return dispatch({
                kind: 'downloading',
                percentage: event.percentage ?? undefined,
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

    void run()
    return () => {
      controller.abort()
      closeStream?.()
      clearTimeout(retryTimer)
    }
  }, [attempt, fileId, recheck])

  return { state, retry: recheck }
}
