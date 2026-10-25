import { STORAGE_KEYS } from '@/lib/keys'
import { readStorage } from '@/lib/storage'
import { ApiError } from './errors'

const TIMEOUT_MS = 15_000
const DEFAULT_SERVER_URL = 'http://localhost:8080'

interface ApiErrorBody {
  code?: string
  message?: string
  details?: unknown
}

function getServerUrl(): string {
  return readStorage(STORAGE_KEYS.serverUrl, DEFAULT_SERVER_URL)
}

export async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onCallerAbort = () => controller.abort()
  signal?.addEventListener('abort', onCallerAbort)

  try {
    const response = await fetch(`${getServerUrl()}${url}`, {
      ...init,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null
      throw new ApiError({
        status: response.status,
        code: body?.code ?? 'UNKNOWN_ERROR',
        message: body?.message ?? 'Erro inesperado do servidor.',
        details: body?.details,
      })
    }

    return (await response.json()) as T
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
