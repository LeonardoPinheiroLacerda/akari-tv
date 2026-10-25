import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Focusable } from '@/ui/focusable'
import { Button } from '@/ui/button'
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

export function PlaceholderScreen() {
  const [presses, setPresses] = useState(0)
  const { data } = useBootstrapCheck()

  useEffect(() => {
    return registerBackHandler(() => {
      console.log('[akari] Voltar pressionado (placeholder, sem pilha de telas ainda)')
      return true
    })
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-24 text-foreground">
      <div className="text-center">
        <h1 className="text-2xl font-medium">Akari TV</h1>
        <p className="mt-2 text-muted-foreground">
          Placeholder de bootstrap — {data ?? 'carregando…'}
        </p>
      </div>

      <div className="flex gap-6">
        {['Esquerda', 'Centro', 'Direita'].map((label) => (
          <Focusable
            key={label}
            autoFocus={label === 'Centro'}
            onEnterPress={() => setPresses((count) => count + 1)}
          >
            {(focused) => (
              <Button
                variant={focused ? 'default' : 'secondary'}
                className={focused ? 'scale-105' : ''}
              >
                {label}
              </Button>
            )}
          </Focusable>
        ))}
      </div>

      <p className="font-mono text-sm text-muted-foreground">
        D-pad → setas · OK → Enter · Voltar → Escape/Backspace · confirmações: {presses}
      </p>
    </main>
  )
}
