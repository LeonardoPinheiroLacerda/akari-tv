import { memo, useEffect, useState, type CSSProperties } from 'react'
import type { AnimeResponse } from '@/api/generated/akariAPI.schemas'
import {
  CalendarDays,
  Clock,
  Film,
  Flower2,
  Leaf,
  ListVideo,
  Snowflake,
  Star,
  Sun,
  Tv,
  type LucideIcon,
} from 'lucide-react'
import { episodesLabel, formatLabel, htmlToText, scoreLabel, seasonLabel } from '@/lib/format'
import { useStore, type Store } from '@/lib/store'
import { InfoBadge } from '@/ui/info-badge'

// Espera o foco assentar antes de trocar o hero: navegando rápido pela grade,
// só o item onde o usuário parou decodifica o banner (seção 7: imagens grandes
// decodificadas uma por vez).
const SETTLE_MS = 250

function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  // Primeiro valor (nada exibido ainda) aparece na hora.
  return settled ?? value
}

interface FadeInImageProps {
  src: string
  alt?: string
  className: string
  style?: CSSProperties
}

/**
 * Imagem que só aparece depois de carregada (fade de opacity). Usada com
 * `key={src}`: cada URL é um elemento novo, então a imagem anterior some na
 * hora em vez de continuar na tela enquanto a nova carrega — o que deixaria
 * o logo de um anime ao lado do texto de outro.
 */
function FadeInImage({ src, alt = '', className, style }: FadeInImageProps) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={className}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: 'opacity 300ms' }}
    />
  )
}

interface BackdropImage {
  src: string
  /** Pôster no lugar do banner: vira só uma mancha das cores dele. */
  blurred: boolean
}

const BANNER_LAYER = { className: 'absolute inset-0 size-full object-cover' }

// Sem banner, o pôster pequeno é desenhado num elemento minúsculo em 16:9
// (4rem × 2.25rem), desfocado e escurecido ali, e só então ampliado 32× por
// transform até cobrir a tela: o blur age sobre poucos pixels e o resultado é
// uma variação de cor sem nada reconhecível. Blur estático, nunca animado — a
// troca continua sendo só opacity (seção 7).
const BLURRED_LAYER = {
  className: 'absolute top-1/2 left-1/2 h-[2.25rem] w-[4rem] max-w-none object-cover',
  style: {
    transform: 'translate(-50%, -50%) scale(32)',
    filter: 'blur(0.125rem) brightness(0.6)',
  } satisfies CSSProperties,
}

function layerFor(image: BackdropImage) {
  return image.blurred ? BLURRED_LAYER : BANNER_LAYER
}

/**
 * Fundo em tela cheia com uma única imagem por vez: trocar de anime remove a
 * anterior na hora e a nova entra com fade ao carregar (só opacity). Nunca há
 * duas imagens de tela cheia empilhadas — nem o banner antigo aparecendo
 * atrás do pôster desfocado, nem o custo de compor duas camadas grandes.
 * Degradês estáticos dão leitura ao texto à esquerda e fundem o fundo com a
 * linha de pôsteres embaixo.
 */
const Backdrop = memo(function Backdrop({ src, blurred = false }: Partial<BackdropImage>) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {src && (
        <FadeInImage key={`${blurred}:${src}`} src={src} {...layerFor({ src, blurred })} />
      )}
      <div className="absolute inset-y-0 left-0 w-3/5 bg-linear-to-r from-bg via-bg/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-bg via-bg/70 to-transparent" />
    </div>
  )
})

interface HomeHeroProps {
  store: Store<AnimeResponse | undefined>
}

const SEASON_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  WINTER: { icon: Snowflake, color: 'var(--color-season-winter)' },
  SPRING: { icon: Flower2, color: 'var(--color-season-spring)' },
  SUMMER: { icon: Sun, color: 'var(--color-season-summer)' },
  FALL: { icon: Leaf, color: 'var(--color-season-fall)' },
}

interface Badge {
  key: string
  icon: LucideIcon
  label: string
  iconColor?: string
  filled?: boolean
}

/**
 * Metadados do anime como badges, cada informação separada (temporada e ano
 * são dados distintos). Cor só onde informa algo: a estação e a nota; o resto
 * fica neutro.
 */
function badgesFor(anime: AnimeResponse): Badge[] {
  const badges: Badge[] = []
  if (anime.year) badges.push({ key: 'year', icon: CalendarDays, label: String(anime.year) })
  if (anime.season) {
    const season = SEASON_ICONS[anime.season]
    badges.push({
      key: 'season',
      icon: season?.icon ?? CalendarDays,
      label: seasonLabel(anime.season),
      iconColor: season?.color,
    })
  }
  if (anime.format) {
    badges.push({
      key: 'format',
      icon: anime.format === 'MOVIE' ? Film : Tv,
      label: formatLabel(anime.format),
    })
  }
  // Filme é sempre 1 episódio: a contagem seria redundante ao lado de "Filme".
  if (anime.episodes && anime.format !== 'MOVIE') {
    badges.push({ key: 'episodes', icon: ListVideo, label: episodesLabel(anime.episodes) })
  }
  if (anime.duration) badges.push({ key: 'duration', icon: Clock, label: anime.duration })
  if (anime.score != null) {
    badges.push({
      key: 'score',
      icon: Star,
      label: scoreLabel(anime.score),
      iconColor: 'var(--color-brand)',
      filled: true,
    })
  }
  return badges
}

/** Hero fixo da Início: mostra o anime em foco na grade (via `store`). */
export const HomeHero = memo(function HomeHero({ store }: HomeHeroProps) {
  const anime = useSettled(useStore(store), SETTLE_MS)
  const title = anime?.titles?.main ?? ''
  const backdrop = anime?.banner ?? anime?.thumbnails?.small ?? anime?.thumbnails?.medium

  const badges = anime ? badgesFor(anime) : []

  return (
    <>
      <Backdrop src={backdrop ?? undefined} blurred={!anime?.banner} />
      {/* Ocupa toda a altura que sobra acima da linha de pôsteres; o texto
          fica ancorado embaixo, junto da linha. */}
      <div className="relative flex min-h-0 flex-1 flex-col items-start justify-end gap-4">
        {anime?.logo ? (
          <FadeInImage
            key={anime.logo}
            src={anime.logo}
            alt={title}
            className="h-[9rem] w-[32rem] object-contain object-left-bottom"
          />
        ) : (
          <h1 className="text-[3.5rem] leading-tight font-medium">{title}</h1>
        )}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {badges.map(({ key, ...badge }) => (
              <InfoBadge key={key} {...badge} />
            ))}
          </div>
        )}
        {anime?.genres && anime.genres.length > 0 && (
          <p className="text-[1.75rem] text-muted-foreground">{anime.genres.join(' · ')}</p>
        )}
        {anime?.synopsis && (
          <p className="line-clamp-3 max-w-[56rem] text-[1.75rem] leading-snug">
            {htmlToText(anime.synopsis)}
          </p>
        )}
      </div>
    </>
  )
})
