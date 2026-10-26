import { createContext, useContext, useEffect, useRef } from 'react'
import {
  useFocusable,
  type UseFocusableConfig,
} from '@noriginmedia/norigin-spatial-navigation'

/** `true` só para a tela no topo da pilha; as de baixo ficam montadas e ocultas. */
export const ScreenActiveContext = createContext(true)

/**
 * `useFocusable` da região raiz de uma tela da pilha. Oculta, a região sai da
 * navegação espacial (`focusable: false`), para o D-pad nunca entrar numa tela
 * com `display: none`. Ao voltar ao topo, devolve o foco ao último item focado
 * dela (`saveLastFocusedChild`), sem remontar nada (seção 6).
 */
export function useScreenFocusable(config: UseFocusableConfig) {
  const active = useContext(ScreenActiveContext)
  const result = useFocusable({ ...config, saveLastFocusedChild: true, focusable: active })
  const { focusSelf } = result

  const wasActive = useRef(active)
  useEffect(() => {
    if (active && !wasActive.current) focusSelf()
    wasActive.current = active
  }, [active, focusSelf])

  return result
}
