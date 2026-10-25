import { memo, useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Focusable } from '@/ui/focusable'
import { Button } from '@/ui/button'
import { Sidebar, SIDEBAR_COLLAPSED_REM } from '@/ui/sidebar'
import { registerBackHandler } from './back'

/**
 * Tela de validação do bootstrap (não é uma tela do produto).
 * Confirma: Vite + Tailwind + fontes do bundle, TanStack Query, navegação
 * espacial por D-pad (setas + Enter) e o handler de Voltar. Remover quando
 * as telas reais (seção 9 da especificação) começarem a ser construídas.
 */
function useBootstrapCheck() {
  return useQuery({
    queryKey: ['bootstrap-check'],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return 'TanStack Query OK'
    },
  })
}

interface PlaceholderButtonProps {
  label: string
  autoFocus: boolean
  onEnterPress: () => void
}

/**
 * Isolado num componente próprio (e não como closure inline no `.map()` da
 * tela) para que `children` do Focusable tenha identidade estável entre
 * renders — sem isso, o `memo` do Focusable não tem efeito nenhum.
 */
const PlaceholderButton = memo(function PlaceholderButton({
  label,
  autoFocus,
  onEnterPress,
}: PlaceholderButtonProps) {
  return (
    <Focusable autoFocus={autoFocus} onEnterPress={onEnterPress}>
      {(focused) => (
        // Seção 3/7 da especificação: só transform e opacity animam, 120ms, e o
        // contorno de foco é uma camada separada — nunca troca de variant/cor do
        // Button (isso herdaria o `transition-all` dele e cruzaria com o scale).
        <div
          className="rounded-lg"
          style={{
            transform: focused ? 'scale(1.05)' : 'scale(1)',
            outlineStyle: 'solid',
            outlineWidth: 4,
            outlineOffset: 2,
            outlineColor: focused ? 'var(--color-text)' : 'transparent',
            transition: 'transform 120ms, outline-color 120ms',
          }}
        >
          <Button variant="secondary">{label}</Button>
        </div>
      )}
    </Focusable>
  )
})

export function PlaceholderScreen() {
  const [presses, setPresses] = useState(0)
  const { data } = useBootstrapCheck()
  const handleEnterPress = useCallback(() => setPresses((count) => count + 1), [])

  useEffect(() => {
    return registerBackHandler(() => {
      console.log('[akari] Voltar pressionado (placeholder, sem pilha de telas ainda)')
      return true
    })
  }, [])

  return (
    <>
      <Sidebar />
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background py-[3.375rem] pr-8 text-foreground"
        style={{ paddingLeft: `${SIDEBAR_COLLAPSED_REM}rem` }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-medium">Akari TV</h1>
          <p className="mt-2 text-muted-foreground">
            Placeholder de bootstrap — {data ?? 'carregando…'}
          </p>
        </div>

        <div className="flex gap-6">
          {['Esquerda', 'Centro', 'Direita'].map((label) => (
            <PlaceholderButton
              key={label}
              label={label}
              autoFocus={label === 'Centro'}
              onEnterPress={handleEnterPress}
            />
          ))}
        </div>

        <p className="font-mono text-sm text-muted-foreground">
          D-pad → setas · OK → Enter · Voltar → Escape/Backspace · confirmações: {presses}
        </p>
      </main>
    </>
  )
}
