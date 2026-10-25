import type { Page } from './generated/akariAPI.schemas'

/**
 * Opções do envelope de paginação (0-based) do contrato para `useInfiniteQuery`:
 * a próxima página é `page + 1` enquanto houver páginas.
 */
export const pageInfiniteOptions = {
  initialPageParam: 0,
  getNextPageParam: (lastPage: Page) =>
    lastPage.page + 1 < lastPage.totalPages ? lastPage.page + 1 : undefined,
}
