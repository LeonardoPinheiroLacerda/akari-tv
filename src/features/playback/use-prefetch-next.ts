import { useEffect } from 'react'
import { queueCacheDownload } from '@/api/generated/cache/cache'
import { getFileAvailability } from '@/api/generated/playback/playback'

/**
 * Começa a baixar para o cache o próximo da fila enquanto o atual toca, para
 * ele já estar pronto na tela de fim. Segue o mesmo fluxo do contrato
 * (`availability` → `NEEDS_DOWNLOAD` → `POST /v1/cache/items`) e não faz nada
 * se o próximo já está pronto ou baixando. Diferente do download do arquivo
 * aberto, este não é cancelado ao sair: o objetivo é deixá-lo no cache.
 * Falhas são silenciosas — no pior caso, o próximo baixa quando for aberto.
 */
export function usePrefetchNext(
  nextFileId: number | undefined,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || nextFileId === undefined) return
    const controller = new AbortController()
    // Adiado: a montagem descartada do StrictMode (dev) não chega a consultar.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const availability = await getFileAvailability(nextFileId, {
            signal: controller.signal,
          })
          if (availability.status !== 'NEEDS_DOWNLOAD') return
          await queueCacheDownload(
            { fileId: nextFileId },
            { signal: controller.signal },
          )
        } catch {
          // Sem rede, já enfileirado por outro cliente, provider LOCAL: nada a fazer.
        }
      })()
    }, 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [nextFileId, enabled])
}
