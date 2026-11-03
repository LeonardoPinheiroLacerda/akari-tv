import type { ReactNode } from 'react'
import { GetBoundingClientRectAdapter, init } from '@noriginmedia/norigin-spatial-navigation'
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
  // A cada tecla a lib mede todos os irmãos do item em foco (a grade inteira
  // da Início, por exemplo). O adaptador padrão soma `offsetTop`/`offsetLeft`
  // subindo pelos `offsetParent` — dezenas de leituras de layout por item, que
  // na TV passavam de 60 ms por tecla. `getBoundingClientRect` é uma leitura só.
  layoutAdapter: GetBoundingClientRectAdapter,
  // Cada navegação é assíncrona (mede layout, calcula distância, troca foco).
  // Throttle serializa: a primeira tecla de uma sequência processa na hora
  // (leading), qualquer uma a mais dentro da janela é descartada (trailing:
  // false, padrão da lib), nunca enfileirada — nunca dois ciclos ao mesmo tempo.
  // O Android repete a tecla segurada a cada 50 ms: com 80 ms passa exatamente
  // uma repetição a cada duas (um passo a cada 100 ms), com folga para o
  // jitter. Com 100 ms, uma repetição que chegava aos 99 ms era descartada e o
  // passo alternava entre 100 e 150 ms — a navegação "engasgava".
  throttle: 80,
  throttleKeypresses: false,
})

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
