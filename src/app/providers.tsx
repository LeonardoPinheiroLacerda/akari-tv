import type { ReactNode } from 'react'
import { init } from '@noriginmedia/norigin-spatial-navigation'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/api/queryClient'

// shouldFocusDOMNode: sincroniza o foco real do DOM com o item em foco pela
// navegação espacial (sem isso, o único foco é lógico/interno da lib, sem
// chamar `.focus()` nativo — leitores de tela e `:focus-visible` dependem
// disso). Deixar a própria lib coordenar evita o "vai e volta" de fazer esse
// `.focus()` manualmente em cada <Focusable>, fora de ordem com a troca
// interna de foco dela.
init({
  shouldFocusDOMNode: true,
  domNodeFocusOptions: { preventScroll: true },
  // Cada navegação é assíncrona (mede layout, calcula distância, troca foco).
  // Throttle serializa: a primeira tecla de uma sequência processa na hora
  // (leading), qualquer uma a mais dentro da janela é descartada (trailing:
  // false, padrão da lib), nunca enfileirada — nunca dois ciclos ao mesmo tempo.
  throttle: 100,
  throttleKeypresses: false,
})

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
