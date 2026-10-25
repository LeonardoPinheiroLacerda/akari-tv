import { App as CapacitorApp } from '@capacitor/app'

/** Retorna `true` quando a tecla Voltar foi tratada (não deve fechar o app / voltar o navegador). */
type BackHandler = () => boolean

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)
}

export function registerBackHandler(handler: BackHandler): () => void {
  const listenerPromise = CapacitorApp.addListener('backButton', () => {
    if (!handler()) {
      CapacitorApp.exitApp()
    }
  })

  const onKeyDown = (event: KeyboardEvent) => {
    // Em campo de texto, Backspace apaga caractere em vez de voltar.
    if (event.key === 'Backspace' && isEditable(event.target)) {
      return
    }
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
