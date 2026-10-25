// Telas abertas a partir de outra (ex.: detalhe do anime) levam este estado
// no `navigate`: o Voltar desfaz o passo (`navigate(-1)`) em vez de ir pro
// Início, como fazem as abas da sidebar.
export const PUSHED_SCREEN = { pushed: true } as const

export function isPushedScreen(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'pushed' in state
}

// Último item focado por tela, em memória: ao voltar para a tela, o foco
// volta pro item de onde o usuário saiu (seção 6). A cópia no localStorage e
// a pilha de telas montadas entram depois.
const lastFocused = new Map<string, number>()

export const focusMemory = {
  get: (screen: string) => lastFocused.get(screen),
  set: (screen: string, id: number) => void lastFocused.set(screen, id),
}
