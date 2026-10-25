import { useCallback, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { HOME_FOCUS_KEY } from '@/features/home/home-screen'
import { SEARCH_FOCUS_KEY } from '@/features/search/search-screen'
import { Sidebar, SIDEBAR_COLLAPSED_REM, type SidebarItemKey } from '@/ui/sidebar'
import { registerBackHandler } from './back'

const PATHS: Record<SidebarItemKey, string> = {
  home: '/',
  search: '/search',
}

const SCREEN_FOCUS_KEYS: Record<SidebarItemKey, string> = {
  home: HOME_FOCUS_KEY,
  search: SEARCH_FOCUS_KEY,
}

function sidebarKeyFor(pathname: string): SidebarItemKey | undefined {
  return (Object.keys(PATHS) as SidebarItemKey[]).find((key) => PATHS[key] === pathname)
}

/**
 * Casca das telas de topo: sidebar fixa + tela atual no `<Outlet>`. Os itens
 * da sidebar são abas (navegação com `replace`, sem empilhar); Voltar fora do
 * Início volta pro Início, e no Início deixa o app fechar. A pilha de telas
 * da seção 6 entra quando houver telas de detalhe.
 */
export function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeKey = sidebarKeyFor(pathname)

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

  useEffect(() => {
    return registerBackHandler(() => {
      if (pathname === PATHS.home) return false
      navigate(PATHS.home, { replace: true })
      return true
    })
  }, [navigate, pathname])

  return (
    <>
      <Sidebar activeKey={activeKey} onSelect={handleSelect} />
      <main
        className="min-h-screen bg-background py-[3.375rem] pr-8 text-foreground"
        style={{ paddingLeft: `${SIDEBAR_COLLAPSED_REM}rem` }}
      >
        <Outlet />
      </main>
    </>
  )
}
