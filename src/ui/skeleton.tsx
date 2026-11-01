import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Focusable } from './focusable'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

/**
 * Bloco estático no lugar de um conteúdo que ainda está carregando, com a
 * forma e o tamanho dele. Não anima sozinho: quem pulsa é o `SkeletonGroup`
 * em volta, uma animação por região em vez de uma por bloco.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('bg-skeleton shrink-0 rounded-xl', className)}
      style={style}
    />
  )
}

interface SkeletonGroupProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  label?: string
  /**
   * Segura o foco no skeleton enquanto a tela carrega (seção 6), senão ele
   * cai no menu lateral. O item real que entra no lugar pega o foco com o
   * próprio `autoFocus`.
   */
  holdFocus?: boolean
}

/**
 * Região de skeleton: pulsa só por `opacity` (`animate-skeleton`, seção 7) e se
 * anuncia como carregando para leitores de tela.
 */
export function SkeletonGroup({
  children,
  className,
  style,
  label = 'Carregando',
  holdFocus = false,
}: SkeletonGroupProps) {
  const group = (
    <div
      role="status"
      aria-label={label}
      aria-busy
      className={cn('animate-skeleton', className)}
      style={style}
    >
      {children}
    </div>
  )
  if (!holdFocus) return group
  return <Focusable autoFocus>{() => group}</Focusable>
}
