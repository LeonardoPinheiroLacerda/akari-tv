import { defineConfig } from 'orval'

// Seção 5 da especificação: o contrato é buscado direto do backend em
// desenvolvimento, sem arquivo de contrato versionado no repo.
export default defineConfig({
  akari: {
    input: {
      target: 'http://localhost:8080/q/openapi',
    },
    output: {
      target: 'src/api/generated',
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'tags-split',
      mock: true,
      clean: true,
      formatter: 'prettier',
      override: {
        mutator: {
          path: 'src/api/mutator.ts',
          name: 'apiFetch',
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
        query: {
          useInfinite: true,
          useInfiniteQueryParam: 'page',
        },
      },
    },
  },
})
