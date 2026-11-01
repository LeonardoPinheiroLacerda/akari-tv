import { ROW_PADDING_REM } from '@/ui/poster-row'
import { SkeletonGroup } from '@/ui/skeleton'
import { EpisodeCardSkeleton } from './episode-card'
import { EPISODE_GAP_REM, EPISODE_ROW_HEIGHT_REM } from './episode-row'

/**
 * Linha de episódios carregando, na mesma altura, folga e espaçamento da real;
 * segura o foco (seção 6). Fora de `episode-row.tsx` para aquele arquivo ficar
 * só com o componente virtualizado.
 */
export function EpisodeRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonGroup
      holdFocus
      label="Carregando episódios"
      className="flex overflow-hidden"
      style={{
        height: `${EPISODE_ROW_HEIGHT_REM}rem`,
        padding: `${ROW_PADDING_REM}rem`,
        gap: `${EPISODE_GAP_REM}rem`,
      }}
    >
      {Array.from({ length: count }, (_, index) => (
        <EpisodeCardSkeleton key={index} />
      ))}
    </SkeletonGroup>
  )
}
