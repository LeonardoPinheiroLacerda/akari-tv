import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  useLocation,
  useNavigate,
  useNavigationType,
  useOutlet,
} from 'react-router-dom'
import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { HOME_FOCUS_KEY } from '@/features/home/home-screen'
import { SEARCH_FOCUS_KEY } from '@/features/search/search-screen'
import { isPushedScreen } from '@/lib/navigation'
import {
  Sidebar,
  SIDEBAR_COLLAPSED_REM,
  type SidebarItemKey,
} from '@/ui/sidebar'
import { registerBackHandler } from './back'
import { ScreenActiveContext } from './screen'

const PATHS: Record<SidebarItemKey, string> = {
  home: '/',
  search: '/search',
}

const SCREEN_FOCUS_KEYS: Record<SidebarItemKey, string> = {
  home: HOME_FOCUS_KEY,
  search: SEARCH_FOCUS_KEY,
}

// Telas montadas ao mesmo tempo (seção 6). Acima disso a mais antiga
// desmonta e, se o usuário voltar até ela, remonta e restaura pela memória
// de foco.
const MAX_MOUNTED_SCREENS = 5

interface StackEntry {
  key: string
  element: ReactNode
}

/**
 * Próxima pilha para uma navegação: tela aberta a partir de outra empilha;
 * Voltar (`POP`) desempilha até a tela de destino; aba da sidebar (`REPLACE`
 * sem ser tela empilhada) recomeça a pilha, já que abas são raízes; tela
 * empilhada com `REPLACE` troca o topo.
 */
function nextStack(
  stack: StackEntry[],
  entry: StackEntry,
  navigationType: string,
  pushed: boolean,
): StackEntry[] {
  if (navigationType === 'POP') {
    const index = stack.findIndex((item) => item.key === entry.key)
    return index >= 0 ? stack.slice(0, index + 1) : [entry]
  }
  // Tela empilhada trocada no lugar (ex.: próximo episódio): substitui o topo,
  // para a anterior desmontar em vez de ficar oculta atrás.
  if (pushed && navigationType === 'REPLACE')
    return [...stack.slice(0, -1), entry]
  if (pushed) return [...stack, entry].slice(-MAX_MOUNTED_SCREENS)
  return [entry]
}

function sidebarKeyFor(pathname: string): SidebarItemKey | undefined {
  return (Object.keys(PATHS) as SidebarItemKey[]).find(
    (key) => PATHS[key] === pathname,
  )
}

/**
 * Casca das telas: sidebar fixa + tela atual no `<Outlet>`. Os itens da
 * sidebar são abas (navegação com `replace`, sem empilhar). Voltar numa tela
 * aberta a partir de outra (detalhe do anime) desfaz o passo; numa aba fora do
 * Início volta pro Início; no Início deixa o app fechar. As telas abaixo do
 * topo da pilha ficam montadas e ocultas (`display: none`), então foco,
 * rolagem e dados voltam sem refazer a tela (seção 6).
 */
export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { pathname } = location
  const pushed = isPushedScreen(location.state)
  const activeKey = sidebarKeyFor(pathname)

  // `useOutlet` captura o elemento da rota com o contexto dela (params): uma
  // tela empilhada continua lendo os próprios params enquanto está oculta.
  const outlet = useOutlet()
  const navigationType = useNavigationType()
  const [stack, setStack] = useState<StackEntry[]>(() => [
    { key: location.key, element: outlet },
  ])
  const [stackLocationKey, setStackLocationKey] = useState(location.key)
  if (location.key !== stackLocationKey) {
    setStackLocationKey(location.key)
    setStack((current) =>
      nextStack(
        current,
        { key: location.key, element: outlet },
        navigationType,
        pushed,
      ),
    )
  }

  const handleSelect = useCallback(
    (key: SidebarItemKey) => {
      // Mesma tela: não há remontagem pra disparar o foco inicial dela, então
      // o foco vai direto pra região da tela (último item focado ou o primeiro).
      if (key === activeKey) {
        setFocus(SCREEN_FOCUS_KEYS[key])
        return
      }
      navigate(PATHS[key], { replace: true })
    },
    [activeKey, navigate],
  )

  // Registrado uma vez só, na base da pilha do Voltar: handlers de painéis e
  // telas (ex.: o painel de faixas do player) ficam por cima e respondem antes.
  // A rota atual é lida por ref para o registro não se repetir a cada navegação,
  // o que o levaria para o topo da pilha.
  const route = useRef({ pathname, pushed })
  useLayoutEffect(() => {
    route.current = { pathname, pushed }
  })
  useEffect(() => {
    return registerBackHandler(() => {
      if (route.current.pushed) {
        navigate(-1)
        return true
      }
      if (route.current.pathname === PATHS.home) return false
      navigate(PATHS.home, { replace: true })
      return true
    })
  }, [navigate])

  return (
    <>
      <Sidebar activeKey={activeKey} onSelect={handleSelect} />
      <main
        className="bg-background text-foreground min-h-screen py-[3.375rem] pr-8"
        style={{ paddingLeft: `${SIDEBAR_COLLAPSED_REM}rem` }}
      >
        {stack.map((entry, index) => {
          const active = index === stack.length - 1
          return (
            <ScreenActiveContext.Provider key={entry.key} value={active}>
              <div style={{ display: active ? undefined : 'none' }}>
                {entry.element}
              </div>
            </ScreenActiveContext.Provider>
          )
        })}
      </main>
    </>
  )
}
