import type { UserResponse } from '@/api/generated/akariAPI.schemas'
import { createStore, useStore } from './store'

/**
 * Perfil escolhido na seleção de perfis; `null` no modo anônimo. Trocar de
 * perfil passa pela seleção, que desmonta todas as telas: quem lê o perfil
 * não precisa reagir a uma troca no meio.
 */
export const activeProfile = createStore<UserResponse | null>(null)

/** `userId` das rotas que leem ou gravam dados do perfil; `undefined` no modo anônimo. */
export function useUserId(): number | undefined {
  return useStore(activeProfile)?.id
}

// Cor do avatar pelo id: perfis vizinhos ficam distintos sem o usuário escolher nada.
const AVATAR_COLORS = [
  'var(--color-brand)',
  'var(--color-season-winter)',
  'var(--color-season-spring)',
  'var(--color-season-summer)',
  'var(--color-season-fall)',
]

export function avatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length] ?? 'var(--color-brand)'
}

/** Inicial maiúscula do nome, como aparece no avatar. */
export function avatarInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}
