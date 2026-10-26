import type {
  CacheItem,
  CacheItemId,
  CacheStatus,
} from './generated/akariAPI.schemas'
import { getServerUrl } from './mutator'

/*
 * Stream SSE `GET /v1/cache/events`, que não está no contrato OpenAPI (o
 * gerador do backend não descreve SSE) e por isso não sai do Orval. O formato
 * abaixo espelha o `CacheEvent` do backend: o nome do evento SSE é o `type` e
 * o `data` é o JSON do evento.
 *
 * Inscrição sem nada ativo na fila recebe `IDLE` e o backend fecha a conexão
 * na hora; a fila esvaziando também manda `IDLE` e fecha. Por isso quem usa
 * este stream enfileira antes de se inscrever e, a cada `IDLE`, para de ouvir
 * e confere de novo a disponibilidade do arquivo.
 */

export type CacheEventType =
  | 'SNAPSHOT'
  | 'IDLE'
  | 'QUEUED'
  | 'STARTED'
  | 'PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'EVICTED'
  | 'CANCELLED'
  | 'DELETED'

export interface CacheEvent {
  type: CacheEventType
  id?: CacheItemId | null
  status?: CacheStatus | null
  errorMessage?: string | null
  bytes?: number | null
  totalBytes?: number | null
  /** bytes/segundo */
  speed?: number | null
  /** segundos restantes */
  eta?: number | null
  /** 0 a 100 */
  percentage?: number | null
  items?: CacheItem[] | null
}

const EVENT_TYPES: CacheEventType[] = [
  'SNAPSHOT',
  'IDLE',
  'QUEUED',
  'STARTED',
  'PROGRESS',
  'COMPLETED',
  'FAILED',
  'EVICTED',
  'CANCELLED',
  'DELETED',
]

interface CacheEventHandlers {
  onEvent: (event: CacheEvent) => void
  /** Conexão caiu (rede ou servidor). O stream já está fechado: não reconecta sozinho. */
  onError: () => void
}

/**
 * Abre o stream e devolve a função que o fecha. O `EventSource` reconectaria
 * sozinho a cada fechamento do servidor (que acontece a cada `IDLE`); aqui ele
 * é fechado no primeiro erro e quem chamou decide o que fazer.
 */
export function subscribeCacheEvents({
  onEvent,
  onError,
}: CacheEventHandlers): () => void {
  const source = new EventSource(`${getServerUrl()}/v1/cache/events`)

  const listener = (message: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(message.data) as CacheEvent)
    } catch {
      // Evento fora do formato: ignora em vez de derrubar o stream.
    }
  }
  for (const type of EVENT_TYPES) source.addEventListener(type, listener)

  source.onerror = () => {
    source.close()
    onError()
  }

  return () => source.close()
}
