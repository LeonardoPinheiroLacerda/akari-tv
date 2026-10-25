import { App as CapacitorApp } from '@capacitor/app'

/** Retorna `true` quando a tecla Voltar foi tratada (não deve fechar o app / voltar o navegador). */
type BackHandler = () => boolean

export function registerBackHandler(handler: BackHandler): () => void {
  const listenerPromise = CapacitorApp.addListener('backButton', () => {
    if (!handler()) {
      CapacitorApp.exitApp()
    }
  })

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Backspace') {
      handler()
    }
  }
  window.addEventListener('keydown', onKeyDown)

  return () => {
    void listenerPromise.then((listener) => listener.remove())
    window.removeEventListener('keydown', onKeyDown)
  }
}
