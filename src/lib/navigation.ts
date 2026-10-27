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

/** Um arquivo a reproduzir, com o que a tela mostra dele. */
export interface PlaybackItem {
  fileId: number
  display: PlaybackDisplay
}

interface PlaybackState {
  pushed: true
  display: PlaybackDisplay
  /** Os que vêm antes na lista de origem, na ordem dela (o último é o anterior). */
  previous: PlaybackItem[]
  /** Os que vêm depois na lista de origem, na ordem dela (o primeiro é o próximo). */
  queue: PlaybackItem[]
}

/** Posição de um item na lista de onde a reprodução foi aberta. */
export interface PlaybackList {
  previous: PlaybackItem[]
  queue: PlaybackItem[]
}

/**
 * Abre a reprodução de um arquivo como tela empilhada, com os itens antes e
 * depois dele na lista de origem (episódios, partes de filme), na ordem que o
 * backend entregou: o player oferece o anterior e o próximo, e a tela de fim
 * o próximo.
 */
export function playbackRoute(
  item: PlaybackItem,
  list: PlaybackList = { previous: [], queue: [] },
) {
  const state: PlaybackState = {
    ...PUSHED_SCREEN,
    display: item.display,
    previous: list.previous,
    queue: list.queue,
  }
  return [`/play/${item.fileId}`, { state }] as const
}

/**
 * Troca a tela de reprodução no lugar (`replace`), andando um item na lista:
 * a atual sai da pilha em vez de ficar montada atrás.
 */
export function siblingPlaybackRoute(
  current: PlaybackItem,
  list: PlaybackList,
  direction: 1 | -1,
) {
  const { previous, queue } = list
  const target = direction === 1 ? queue[0] : previous[previous.length - 1]
  if (!target) return undefined
  const next: PlaybackList =
    direction === 1
      ? { previous: [...previous, current], queue: queue.slice(1) }
      : { previous: previous.slice(0, -1), queue: [current, ...queue] }
  const [path, options] = playbackRoute(target, next)
  return [path, { ...options, replace: true }] as const
}

function playbackStateFrom(state: unknown): Partial<PlaybackState> {
  return typeof state === 'object' && state !== null
    ? (state as Partial<PlaybackState>)
    : {}
}

export function playbackDisplayFrom(
  state: unknown,
): PlaybackDisplay | undefined {
  return playbackStateFrom(state).display
}

export function playbackListFrom(state: unknown): PlaybackList {
  const parsed = playbackStateFrom(state)
  return { previous: parsed.previous ?? [], queue: parsed.queue ?? [] }
}

// Último item focado por tela, em memória: quando uma tela remonta (aba da
// sidebar, ou acima do limite da pilha), o foco volta pro item de onde o
// usuário saiu (seção 6). A cópia no localStorage entra depois.
const lastFocused = new Map<string, number>()

export const focusMemory = {
  get: (screen: string) => lastFocused.get(screen),
  set: (screen: string, id: number) => void lastFocused.set(screen, id),
}
