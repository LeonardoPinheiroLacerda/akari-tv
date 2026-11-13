import { VenetianMask } from 'lucide-react'
import type { UserResponse } from '@/api/generated/akariAPI.schemas'
import { avatarColor, avatarInitial } from '@/lib/profile'

interface ProfileAvatarProps {
  /** `null` no modo anônimo. */
  profile: UserResponse | null
  sizeRem: number
}

/**
 * Avatar do perfil: círculo na cor dele com a inicial do nome; no modo
 * anônimo, a máscara num círculo neutro. Mesmo desenho da seleção de perfis.
 */
export function ProfileAvatar({ profile, sizeRem }: ProfileAvatarProps) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: `${sizeRem}rem`,
        height: `${sizeRem}rem`,
        background: profile
          ? avatarColor(profile.id)
          : 'var(--color-surface-elevated)',
      }}
    >
      {profile ? (
        <span
          className="text-bg leading-none font-medium"
          style={{ fontSize: `${sizeRem * 0.46}rem` }}
        >
          {avatarInitial(profile.name)}
        </span>
      ) : (
        <VenetianMask
          color="var(--color-text)"
          strokeWidth={2}
          style={{
            width: `${sizeRem * 0.6}rem`,
            height: `${sizeRem * 0.6}rem`,
          }}
        />
      )}
    </span>
  )
}
