import { useSyncExternalStore } from 'react'

/**
 * Valor observável fora do estado do React: quem escreve não re-renderiza,
 * só quem lê com `useStore`. Usado para o foco alimentar uma região (ex.: o
 * hero) sem o estado de foco subir para a tela (seção 7 da especificação).
 */
export interface Store<T> {
  get: () => T
  set: (value: T) => void
  subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get)
}
