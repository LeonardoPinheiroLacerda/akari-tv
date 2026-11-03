import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { registerBackHandler } from '@/app/back'
import { remToPx } from '@/lib/layout'
import { smoothScrollBy } from '@/lib/scroll'

// Quanto o painel rola a cada ▲/▼.
const SCROLL_STEP_REM = 8

interface SynopsisPanelProps {
  title?: string
  text: string
  onClose: () => void
}

/**
 * Painel lateral com a sinopse inteira (seção 6: prende o foco e fecha com
 * Voltar). Sem itens dentro: o próprio painel recebe o foco, ▲/▼ rolam o
 * texto e OK também fecha. Só o conteúdo rola; o rodapé com as teclas fica
 * fixo embaixo, sempre visível.
 */
function SynopsisPanel({ title, text, onClose }: SynopsisPanelProps) {
  const [scrollable, setScrollable] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { ref, focusKey, focusSelf } = useFocusable<unknown, HTMLDivElement>({
    isFocusBoundary: true,
    onEnterPress: onClose,
    onArrowPress: (direction) => {
      const area = scrollRef.current
      if (area && (direction === 'up' || direction === 'down')) {
        const step = (direction === 'up' ? -1 : 1) * remToPx(SCROLL_STEP_REM)
        smoothScrollBy(area, { top: step })
      }
      return false
    },
  })

  useEffect(() => {
    focusSelf()
  }, [focusSelf])

  // Dica de rolagem só quando o texto passa da área de conteúdo. O
  // ResizeObserver avisa uma vez ao começar a observar, antes da pintura.
  const textRef = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => {
    const area = scrollRef.current
    const content = textRef.current
    if (!area || !content) return
    const observer = new ResizeObserver(() =>
      setScrollable(area.scrollHeight > area.clientHeight + 1),
    )
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  useEffect(
    () =>
      registerBackHandler(() => {
        onClose()
        return true
      }),
    [onClose],
  )

  return (
    <FocusContext.Provider value={focusKey}>
      <div className="fixed inset-0 z-40">
        <div aria-hidden className="bg-bg/70 absolute inset-0" />
        <div
          ref={ref}
          role="dialog"
          aria-modal
          aria-label={title ? `Sinopse de ${title}` : 'Sinopse'}
          tabIndex={-1}
          className="bg-surface absolute inset-y-0 right-0 flex w-[56rem] flex-col py-[3.375rem]"
        >
          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-6 overflow-y-auto px-12"
          >
            <p className="text-muted-foreground text-[1.75rem]">Sinopse</p>
            {title && (
              <h2 className="text-[2.5rem] leading-tight font-medium">
                {title}
              </h2>
            )}
            <p
              ref={textRef}
              className="text-[2rem] leading-relaxed whitespace-pre-line"
            >
              {text}
            </p>
          </div>
          <p className="text-muted-foreground shrink-0 px-12 pt-6 text-[1.75rem]">
            {scrollable && '▲ ▼ para rolar · '}OK ou Voltar para fechar
          </p>
        </div>
      </div>
    </FocusContext.Provider>
  )
}

interface ExpandableSynopsisProps {
  text: string
  /** Mostrado no topo do painel (nome do anime ou do episódio). */
  title?: string
}

/**
 * Sinopse do hero em até 3 linhas. Quando o texto não cabe, ela vira um item
 * focável (alcançado subindo com ▲ a partir da linha abaixo): em foco ganha o
 * contorno e o selo "OK · Ler tudo", e OK abre o painel com o texto completo.
 * Texto que cabe inteiro não ganha foco — não haveria nada a expandir.
 */
export function ExpandableSynopsis({ text, title }: ExpandableSynopsisProps) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [truncated, setTruncated] = useState(false)
  const [open, setOpen] = useState(false)

  // Mede se o `line-clamp` cortou o texto: na troca do texto e quando o
  // tamanho muda (fontes carregando, layout). O ResizeObserver avisa uma vez
  // ao começar a observar, antes da pintura.
  useLayoutEffect(() => {
    const element = textRef.current
    if (!element) return
    const observer = new ResizeObserver(() =>
      setTruncated(element.scrollHeight > element.clientHeight + 1),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [text])

  const handleOpen = useCallback(() => setOpen(true), [])
  const { ref, focused, focusKey } = useFocusable<unknown, HTMLDivElement>({
    focusable: truncated,
    onEnterPress: handleOpen,
  })
  const handleClose = useCallback(() => {
    setOpen(false)
    setFocus(focusKey)
  }, [focusKey])

  return (
    <>
      <div
        ref={ref}
        role={truncated ? 'button' : undefined}
        aria-label={truncated ? 'Ler a sinopse completa' : undefined}
        tabIndex={-1}
        // A folga em volta (margem negativa + padding) deixa o contorno fora
        // do texto sem deslocá-lo em relação ao título e aos badges; o texto
        // continua com até 56rem.
        className="relative -mx-4 -my-2 max-w-[58rem] origin-bottom-left rounded-2xl px-4 py-2"
        style={{
          transform: focused ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 120ms',
        }}
      >
        <div
          aria-hidden
          className="border-brand bg-text/5 absolute inset-0 rounded-2xl border-[0.25rem]"
          style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
        />
        <p
          ref={textRef}
          className="relative line-clamp-3 text-[1.75rem] leading-snug"
        >
          {text}
        </p>
        {/* Selo fora do contorno, à direita (só o fundo do hero ali): não
            cobre o texto nem ocupa espaço — o hero não muda de altura entre
            itens com e sem texto cortado. */}
        {truncated && (
          <span
            aria-hidden
            className="bg-brand text-bg absolute top-1/2 left-full ml-4 -translate-y-1/2 rounded-full px-4 text-[1.75rem] leading-[3rem] font-medium whitespace-nowrap"
            style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
          >
            OK · Ler tudo
          </span>
        )}
      </div>
      {open && (
        <SynopsisPanel title={title} text={text} onClose={handleClose} />
      )}
    </>
  )
}
