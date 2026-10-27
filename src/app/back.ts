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
  if (target.isContentEditable || target instanceof HTMLTextAreaElement)
    return true
  return (
    target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)
  )
}

// Pilha de handlers (seção 6): o registrado por último responde primeiro — um
// painel aberto fecha antes de a tela voltar. Um único par de listeners para
// todos, senão cada registro reagiria à mesma tecla.
const handlers: BackHandler[] = []
let installed = false

function dispatchBack(): boolean {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index]?.()) return true
  }
  return false
}

function install() {
  if (installed) return
  installed = true

  void CapacitorApp.addListener('backButton', () => {
    if (!dispatchBack()) {
      void CapacitorApp.exitApp()
    }
  })

  window.addEventListener('keydown', (event) => {
    // Em campo de texto, Backspace apaga caractere em vez de voltar.
    if (event.key === 'Backspace' && isEditable(event.target)) {
      return
    }
    if (event.key === 'Escape' || event.key === 'Backspace') {
      dispatchBack()
    }
  })
}

export function registerBackHandler(handler: BackHandler): () => void {
  install()
  handlers.push(handler)
  return () => {
    const index = handlers.lastIndexOf(handler)
    if (index >= 0) handlers.splice(index, 1)
  }
}
