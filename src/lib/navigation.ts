// Telas abertas a partir de outra (ex.: detalhe do anime) levam este estado
// no `navigate`: o Voltar desfaz o passo (`navigate(-1)`) em vez de ir pro
// Início, como fazem as abas da sidebar.
export const PUSHED_SCREEN = { pushed: true } as const

export function isPushedScreen(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'pushed' in state
}

/** O que a tela de reprodução mostra enquanto prepara o arquivo (só exibição). */
export interface PlaybackDisplay {
  title: string
  subtitle?: string
  backdrop?: string
}

/** Abre a reprodução de um arquivo como tela empilhada. */
export function playbackRoute(fileId: number, display: PlaybackDisplay) {
  return [`/play/${fileId}`, { state: { ...PUSHED_SCREEN, display } }] as const
}

export function playbackDisplayFrom(
  state: unknown,
): PlaybackDisplay | undefined {
  if (typeof state !== 'object' || state === null || !('display' in state))
    return undefined
  return (state as { display: PlaybackDisplay }).display
}

// Último item focado por tela, em memória: quando uma tela remonta (aba da
// sidebar, ou acima do limite da pilha), o foco volta pro item de onde o
// usuário saiu (seção 6). A cópia no localStorage entra depois.
const lastFocused = new Map<string, number>()

export const focusMemory = {
  get: (screen: string) => lastFocused.get(screen),
  set: (screen: string, id: number) => void lastFocused.set(screen, id),
}
