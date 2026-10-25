import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

const MAX_RETRIES = 2

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= MAX_RETRIES) return false
        if (!(error instanceof ApiError)) return false
        if (error.code === 'NETWORK_ERROR') return true
        // 5xx, exceto 503 (configuração pendente no servidor, não transitório).
        return error.status >= 500 && error.status < 600 && error.status !== 503
      },
    },
  },
})
