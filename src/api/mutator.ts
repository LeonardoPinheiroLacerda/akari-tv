import { STORAGE_KEYS } from '@/lib/keys'
import { readStorage } from '@/lib/storage'
import { ApiError } from './errors'

const TIMEOUT_MS = 15_000
// Sem servidor salvo, usa o do build (`VITE_SERVER_URL`, ex.: o IP do backend
// na rede local para a TV) e, por último, o backend local do navegador.
const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080'

/** Tipo de erro dos hooks gerados pelo Orval (lido deste arquivo pelo `override.mutator`). */
// O Orval exige a assinatura genérica `ErrorType<Error>`; todo erro é `ApiError`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ErrorType<_Error> = ApiError

interface ApiErrorBody {
  code?: string
  message?: string
  details?: unknown
}

const NO_JSON = Symbol('no-json')

function getServerUrl(): string {
  return readStorage(STORAGE_KEYS.serverUrl, DEFAULT_SERVER_URL)
}

/** Corpo vazio vira `undefined`; corpo que não é JSON vira `NO_JSON`. */
function parseJson(text: string): unknown {
  if (text === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    return NO_JSON
  }
}

export async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
  callerSignal?: AbortSignal,
): Promise<T> {
  // Os hooks gerados pelo Orval passam o signal do Query dentro de `init`.
  const signal = init.signal ?? callerSignal
  // Cancelamento pelo chamador antes de começar: não dispara a requisição.
  signal?.throwIfAborted()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onCallerAbort = () => controller.abort()
  signal?.addEventListener('abort', onCallerAbort)

  try {
    const response = await fetch(`${getServerUrl()}${url}`, {
      ...init,
      signal: controller.signal,
    })
    // A leitura do corpo usa o mesmo signal: timeout e cancelamento valem até o fim.
    const body = parseJson(await response.text())

    if (!response.ok) {
      const errorBody =
        body !== NO_JSON && typeof body === 'object' && body !== null
          ? (body as ApiErrorBody)
          : undefined
      throw new ApiError({
        status: response.status,
        code: errorBody?.code ?? 'UNKNOWN_ERROR',
        message: errorBody?.message ?? 'Erro inesperado do servidor.',
        details: errorBody?.details,
      })
    }

    if (body === NO_JSON) {
      throw new ApiError({
        status: response.status,
        code: 'UNKNOWN_ERROR',
        message: 'Resposta do servidor fora do formato esperado.',
      })
    }

    return body as T
  } catch (err) {
    if (signal?.aborted) {
      throw err
    }
    if (err instanceof ApiError) {
      throw err
    }
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Sem resposta do servidor.',
    })
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onCallerAbort)
  }
}
