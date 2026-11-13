import { memo } from 'react'
import { Check, Plus } from 'lucide-react'
import { getGetAnimeFranchiseQueryKey } from '@/api/generated/anime-relations/anime-relations'
import type { AnimeFranchiseResponse } from '@/api/generated/akariAPI.schemas'
import {
  getListUserWatchlistInfiniteQueryKey,
  useAddUserWatchlistItem,
  useRemoveUserWatchlistItem,
} from '@/api/generated/user/user'
import { queryClient } from '@/api/queryClient'
import { PlayButton } from '@/ui/play-button'

interface WatchlistButtonProps {
  userId: number
  anilistId: number
  /** Se o anime está na lista do perfil, como a franquia informou. */
  inWatchlist: boolean
}

/**
 * Põe e tira o anime da lista do perfil, no hero do detalhe, logo sob a
 * sinopse. O estado vem da franquia (`inWatchlist`); depois do OK, a resposta
 * em cache da franquia é atualizada com o novo estado (o backend confirmou
 * com `204`), sem buscar a franquia de novo, e a linha "Minha lista" da
 * Início recarrega.
 */
export const WatchlistButton = memo(function WatchlistButton({
  userId,
  anilistId,
  inWatchlist,
}: WatchlistButtonProps) {
  const applyChange = (added: boolean) => {
    queryClient.setQueryData<AnimeFranchiseResponse>(
      getGetAnimeFranchiseQueryKey(anilistId, { userId }),
      (franchise) => franchise && { ...franchise, inWatchlist: added },
    )
    return queryClient.invalidateQueries({
      queryKey: getListUserWatchlistInfiniteQueryKey(userId),
    })
  }
  const add = useAddUserWatchlistItem({
    mutation: { onSuccess: () => applyChange(true) },
  })
  const remove = useRemoveUserWatchlistItem({
    mutation: { onSuccess: () => applyChange(false) },
  })

  const pending = add.isPending || remove.isPending
  const failed = add.isError || remove.isError
  const handlePress = () => {
    if (pending) return
    // Um erro antigo não fica no rótulo depois de uma nova tentativa.
    add.reset()
    remove.reset()
    if (inWatchlist) remove.mutate({ userId, anilistId })
    else add.mutate({ userId, data: { anilistId } })
  }

  // Enquanto o backend responde, o botão já mostra o estado novo, sem texto de
  // carregando; se falhar, volta ao estado da franquia com o aviso.
  const listed = add.isPending ? true : remove.isPending ? false : inWatchlist
  const label = failed
    ? 'Não foi possível alterar'
    : listed
      ? 'Na minha lista'
      : 'Minha lista'

  return (
    <PlayButton
      label={label}
      icon={listed ? Check : Plus}
      onPress={handlePress}
    />
  )
})
