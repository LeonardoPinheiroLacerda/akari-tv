import { useEffect, type ReactNode } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { registerBackHandler } from '@/app/back'

interface DialogProps {
  /** Nome do modal para leitores de tela. */
  label: string
  /** Região de foco do modal; única por modal. */
  focusKey: string
  /** Voltar fecha o modal; quem abriu devolve o foco. */
  onClose: () => void
  children: ReactNode
}

/**
 * Modal centralizado (seção 6, painéis): prende o foco (`isFocusBoundary`) e
 * fecha com Voltar, por cima da pilha do Voltar. O fundo escurece com uma
 * camada estática, sem blur (seção 7). Quem usa põe um item com `autoFocus`
 * dentro e renderiza o modal fora do `FocusContext` da tela, para a região
 * dela continuar lembrando o item que abriu o modal.
 */
export function Dialog({ label, focusKey, onClose, children }: DialogProps) {
  const { ref, focusKey: regionKey } = useFocusable({
    focusKey,
    isFocusBoundary: true,
  })

  useEffect(
    () =>
      registerBackHandler(() => {
        onClose()
        return true
      }),
    [onClose],
  )

  return (
    <FocusContext.Provider value={regionKey}>
      <div
        ref={ref}
        role="dialog"
        aria-modal
        aria-label={label}
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/75"
      >
        <div className="bg-surface flex max-w-[56rem] flex-col items-start gap-8 rounded-3xl p-12">
          {children}
        </div>
      </div>
    </FocusContext.Provider>
  )
}
