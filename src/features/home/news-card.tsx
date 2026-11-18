import { memo, useCallback } from 'react'
import type { FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation'
import { Check } from 'lucide-react'
import type { AnimeBindingSummary } from '@/api/generated/akariAPI.schemas'
import { cn } from '@/lib/utils'
import { POSTER_HEIGHT_REM } from '@/ui/anime-poster'
import { Focusable } from '@/ui/focusable'

// Altura do pôster, para a fila de Novidades ocupar a área das filas da
// Início como as outras; 16:9 dá 32rem (512px, ~1024 na TV). Por isso o
// backend entrega a imagem do episódio em tamanho original (seção 7: o TMDB
// não tem tamanho de still entre `w300` e `original`).
const NEWS_CARD_HEIGHT_REM = POSTER_HEIGHT_REM
export const NEWS_CARD_WIDTH_REM = (POSTER_HEIGHT_REM * 16) / 9
// Mesma linguagem do card de episódio: fora de foco esmaecido, base da imagem
// some por máscara para o texto ficar legível, texto na base e progresso numa
// barra fina rente à base — sem selos sobre a imagem.
const UNFOCUSED_OPACITY = 0.55
const COVER_FADE = 'linear-gradient(to top, transparent, black 60%)'

/** O que o card de uma Novidade mostra, já formatado. */
export interface NewsCardContent {
  /** Miniatura do episódio, ou o banner do anime (o backend escolhe). */
  thumbnail?: string | null
  /** Nome do anime. */
  title: string
  /**
   * Episódio e o que se sabe dele (ex.: "E6 · Título do episódio", "E6 · Baixando 45%"); o
   * número vem primeiro para não ser cortado quando o texto trunca.
   */
  subtitle: string
  /** Barra fina rente à base: o quanto já baixou, enquanto chega, ou até onde o perfil assistiu. */
  bar?: { fraction: number; label: string }
  /** O perfil já assistiu o episódio: selo no canto, como no card de episódio. */
  watched?: boolean
}

interface NewsCardProps {
  anime: AnimeBindingSummary
  content: NewsCardContent
  index: number
  autoFocus: boolean
  onFocused: (anime: AnimeBindingSummary, index: number, node: HTMLElement) => void
  /** OK no card (abrir o anime). Estável, como `onFocused`. */
  onSelect?: (anime: AnimeBindingSummary) => void
}

/** Card 16:9 de um episódio que chegou (ou está chegando) por torrent, na fila Novidades da Início. */
export const NewsCard = memo(function NewsCard({
  anime,
  content,
  index,
  autoFocus,
  onFocused,
  onSelect,
}: NewsCardProps) {
  const handleFocus = useCallback(
    (layout: FocusableComponentLayout) => onFocused(anime, index, layout.node),
    [anime, index, onFocused],
  )
  const handleEnter = useCallback(() => onSelect?.(anime), [anime, onSelect])

  return (
    <Focusable autoFocus={autoFocus} onFocus={handleFocus} onEnterPress={handleEnter}>
      {(focused) => (
        <div
          className={cn('relative overflow-hidden rounded-xl', !content.thumbnail && 'bg-surface-elevated')}
          style={{
            width: `${NEWS_CARD_WIDTH_REM}rem`,
            height: `${NEWS_CARD_HEIGHT_REM}rem`,
            contain: 'layout paint',
            transform: focused ? 'scale(1.05)' : 'scale(1)',
            opacity: focused ? 1 : UNFOCUSED_OPACITY,
            outlineStyle: 'solid',
            outlineWidth: '0.25rem',
            outlineOffset: '0.125rem',
            outlineColor: focused ? 'var(--color-brand)' : 'transparent',
            transition: 'transform 120ms, opacity 120ms, outline-color 120ms',
          }}
        >
          {content.thumbnail && (
            <img
              src={content.thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
              style={{ maskImage: COVER_FADE }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
            <p className="truncate text-[1.75rem] leading-tight font-medium">{content.title}</p>
            <p className="text-muted-foreground truncate text-[1.75rem] leading-tight">{content.subtitle}</p>
          </div>
          {content.watched && (
            <div
              aria-label="Assistido"
              className="bg-brand absolute top-2 right-2 flex size-10 items-center justify-center rounded-full"
            >
              <Check aria-hidden className="size-6" strokeWidth={3} color="var(--color-bg)" />
            </div>
          )}
          {content.bar && (
            // Preenchimento pelo scaleX de uma camada de largura fixa, como a
            // barra do card de episódio: nada de largura variável (seção 7).
            <div aria-label={content.bar.label} className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25">
              <div
                className="bg-brand h-full w-full origin-left"
                style={{ transform: `scaleX(${content.bar.fraction})` }}
              />
            </div>
          )}
        </div>
      )}
    </Focusable>
  )
})
