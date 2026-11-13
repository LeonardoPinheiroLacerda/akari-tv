import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FocusContext,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  UserRound,
  UserRoundPlus,
  VenetianMask,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { UserResponse } from '@/api/generated/akariAPI.schemas'
import {
  getListUsersQueryKey,
  useCreateUser,
  useDeleteUser,
  useListUsers,
} from '@/api/generated/user/user'
import { queryClient } from '@/api/queryClient'
import { registerBackHandler } from '@/app/back'
import { useScreenFocusable } from '@/app/screen'
import { applyKey } from '@/features/search/apply-key'
import {
  KEY_BACKSPACE,
  KEYBOARD_WIDTH_REM,
  SearchKeyboard,
} from '@/features/search/search-keyboard'
import { STORAGE_KEYS } from '@/lib/keys'
import { activeProfile } from '@/lib/profile'
import { readStorage, writeStorage } from '@/lib/storage'
import { Dialog } from '@/ui/dialog'
import { Focusable } from '@/ui/focusable'
import { PlayButton } from '@/ui/play-button'
import { avatarColor, avatarInitial } from '@/lib/profile'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'

export const PROFILES_FOCUS_KEY = 'PROFILES'
const KEYBOARD_FOCUS_KEY = 'SEARCH_KEYBOARD'

const HOME_PATH = '/home'
const ANONYMOUS_KEY = 'anonymous'
const NEW_PROFILE_KEY = 'new'
const MAX_NAME_LENGTH = 30
const AVATAR_REM = 13
const LOGO_REM = 16

function profileKey(user: UserResponse): string {
  return `user-${user.id}`
}

/** Item focável de um perfil, para devolver o foco a ele depois do modal. */
function tileFocusKey(tileKey: string): string {
  return `PROFILE_${tileKey}`
}

const MANAGE_FOCUS_KEY = 'PROFILES_MANAGE'

/**
 * Inicial maiúscula em cada palavra: o teclado na tela só tem minúsculas, e
 * "leo" viraria um perfil "leo".
 */
function capitalizeWords(text: string): string {
  return text.replace(
    /(^|\s)(\S)/g,
    (_, space: string, letter: string) => space + letter.toUpperCase(),
  )
}

/** Fundo da seleção: um brilho quente e estático atrás do logo, sem blur (seção 7). */
const SCREEN_GLOW =
  'radial-gradient(ellipse 60% 45% at 50% 18%, rgb(255 105 0 / 0.16), transparent 70%)'

interface ProfileTileProps {
  tileKey: string
  name: string
  /** Fundo do avatar; sem ele, o avatar é neutro. */
  color?: string
  /** Ícone no avatar; sem ele, a inicial do nome. */
  icon?: LucideIcon
  /** Modo de gerenciar: a lixeira cobre o avatar e o OK remove. */
  removable?: boolean
  autoFocus: boolean
  onSelect: (tileKey: string) => void
}

/**
 * Avatar redondo com o nome embaixo. Foco como anel laranja numa camada
 * própria que entra por opacidade, mais o scale do conjunto — só
 * opacity/transform animam (seção 7).
 */
const ProfileTile = memo(function ProfileTile({
  tileKey,
  name,
  color,
  icon: Icon,
  removable = false,
  autoFocus,
  onSelect,
}: ProfileTileProps) {
  const handleEnterPress = useCallback(
    () => onSelect(tileKey),
    [onSelect, tileKey],
  )

  return (
    <Focusable
      focusKey={tileFocusKey(tileKey)}
      autoFocus={autoFocus}
      onEnterPress={handleEnterPress}
    >
      {(focused) => (
        <div
          role="button"
          className="flex flex-col items-center gap-5"
          style={{
            width: `${AVATAR_REM + 3}rem`,
            transform: focused ? 'scale(1.07)' : 'scale(1)',
            transition: 'transform 120ms',
          }}
        >
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: `${AVATAR_REM}rem`,
              height: `${AVATAR_REM}rem`,
              background: color ?? 'var(--color-surface-elevated)',
            }}
          >
            {Icon ? (
              <Icon
                aria-hidden
                className="size-20"
                strokeWidth={1.5}
                color={
                  focused ? 'var(--color-text)' : 'var(--color-text-muted)'
                }
              />
            ) : (
              // No modo de gerenciar, a lixeira toma o lugar da inicial.
              !removable && (
                <span
                  aria-hidden
                  className="text-bg text-[6rem] leading-none font-medium"
                >
                  {avatarInitial(name)}
                </span>
              )
            )}
            {removable && (
              <div
                aria-label="Remover"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60"
              >
                <Trash2
                  aria-hidden
                  className="size-16"
                  strokeWidth={1.75}
                  color="var(--color-text)"
                />
              </div>
            )}
            <div
              aria-hidden
              className="border-brand absolute -inset-2.5 rounded-full border-[0.3rem]"
              style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
            />
          </div>
          <span
            className="w-full truncate text-center text-[2.25rem] font-medium"
            style={{
              color: focused ? 'var(--color-text)' : 'var(--color-text-muted)',
            }}
          >
            {name}
          </span>
        </div>
      )}
    </Focusable>
  )
})

/**
 * Tecla do controle desenhada como uma tecla quadrada, para as dicas de uso.
 * Setas como ícone (os glifos ◀ ▶ da fonte saem desalinhados do centro).
 */
function KeyCap({ icon: Icon, label }: { icon?: LucideIcon; label?: string }) {
  return (
    <span className="bg-surface-elevated text-foreground inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-2 text-[1.75rem] leading-none font-medium">
      {Icon ? (
        <Icon aria-hidden className="size-7" strokeWidth={2.75} />
      ) : (
        label
      )}
    </span>
  )
}

/** Perfis carregando: avatares e nomes no tamanho real. */
function ProfilesSkeleton() {
  return (
    <SkeletonGroup holdFocus label="Carregando perfis" className="flex gap-14">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex flex-col items-center gap-5">
          <Skeleton
            className="rounded-full"
            style={{ width: `${AVATAR_REM}rem`, height: `${AVATAR_REM}rem` }}
          />
          <Skeleton className="h-[2rem] w-[8rem] rounded-lg" />
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** Campo do nome (só exibição): o texto vem do teclado na tela ou do físico. */
function NameField({ name }: { name: string }) {
  return (
    <div
      className="bg-surface flex h-20 items-center rounded-2xl border px-6"
      style={{ width: `${KEYBOARD_WIDTH_REM}rem` }}
    >
      <p
        aria-live="polite"
        className="flex min-w-0 flex-1 items-center text-[2rem] leading-none"
      >
        {name ? (
          <span className="truncate whitespace-pre">{name}</span>
        ) : (
          <span className="text-muted-foreground truncate">Nome do perfil</span>
        )}
        <span
          aria-hidden
          className="bg-brand ml-1 h-9 w-[0.1875rem] shrink-0 animate-pulse rounded-full"
        />
      </p>
    </div>
  )
}

interface NewProfileFormProps {
  onCreated: (user: UserResponse) => void
}

/**
 * Cadastro de perfil: o nome pelo teclado na tela (ou pelo físico, no
 * navegador) e o botão de criar embaixo. O perfil criado já entra.
 */
function NewProfileForm({ onCreated }: NewProfileFormProps) {
  const [name, setName] = useState('')
  const create = useCreateUser({
    mutation: {
      onSuccess: (user) => {
        void queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() })
        onCreated(user)
      },
    },
  })

  const handleKey = useCallback(
    (value: string) =>
      setName((current) =>
        capitalizeWords(applyKey(current, value, MAX_NAME_LENGTH)),
      ),
    [],
  )

  // Teclado físico (navegador), como na Buscar: em captura, para o Backspace
  // apagar antes de o Voltar tratá-lo; com o campo vazio, ele segue como Voltar.
  const latestName = useRef(name)
  useLayoutEffect(() => {
    latestName.current = name
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const typed = event.key.length === 1
      const erase = event.key === 'Backspace' && latestName.current !== ''
      if (!typed && !erase) return
      event.preventDefault()
      event.stopImmediatePropagation()
      handleKey(erase ? KEY_BACKSPACE : event.key)
      setFocus(KEYBOARD_FOCUS_KEY)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handleKey])

  const trimmed = name.trim()
  const handleCreate = () => {
    if (trimmed === '' || create.isPending) return
    create.mutate({ data: { name: trimmed } })
  }

  return (
    <div className="flex items-center gap-24">
      {/* Prévia do perfil: o avatar como vai aparecer na seleção. */}
      <div className="flex w-[30rem] flex-col items-center gap-6 text-center">
        <div
          className="bg-brand flex items-center justify-center rounded-full"
          style={{ width: `${AVATAR_REM}rem`, height: `${AVATAR_REM}rem` }}
        >
          {trimmed ? (
            <span className="text-bg text-[6rem] leading-none font-medium">
              {trimmed.charAt(0)}
            </span>
          ) : (
            <UserRound
              aria-hidden
              className="size-20"
              strokeWidth={1.5}
              color="var(--color-bg)"
            />
          )}
        </div>
        <h1 className="text-[3.5rem] leading-tight font-medium">
          {trimmed || 'Novo perfil'}
        </h1>
        <p className="text-muted-foreground text-[1.75rem] leading-snug">
          Escolha um nome. O progresso e a lista de quem usar este perfil ficam
          salvos nele.
        </p>
        {create.isError && (
          <p role="alert" className="text-brand text-[1.75rem]">
            Não foi possível criar o perfil ({create.error.message})
          </p>
        )}
      </div>

      <div className="flex flex-col items-start gap-6">
        <NameField name={name} />
        <SearchKeyboard autoFocus onPress={handleKey} />
        <PlayButton
          label={create.isPending ? 'Criando…' : 'Criar perfil'}
          icon={UserRoundPlus}
          onPress={handleCreate}
        />
      </div>
    </div>
  )
}

interface RemoveProfileDialogProps {
  user: UserResponse
  onRemoved: (user: UserResponse) => void
  onClose: () => void
}

/**
 * Confirma a remoção de um perfil, que apaga junto o progresso e a lista
 * dele. O foco começa em "Cancelar": um OK distraído não apaga nada.
 */
function RemoveProfileDialog({
  user,
  onRemoved,
  onClose,
}: RemoveProfileDialogProps) {
  const remove = useDeleteUser({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getListUsersQueryKey(),
        })
        onRemoved(user)
      },
    },
  })
  const handleRemove = () => {
    if (remove.isPending) return
    remove.mutate({ userId: user.id })
  }

  return (
    <Dialog
      label={`Remover ${user.name}?`}
      focusKey="REMOVE_PROFILE_DIALOG"
      onClose={onClose}
    >
      <h2 className="text-[2.5rem] leading-tight font-medium">
        Remover {user.name}?
      </h2>
      <p className="text-[2rem] leading-snug">
        O progresso e a lista deste perfil serão apagados. Isso não pode ser
        desfeito.
      </p>
      {remove.isError && (
        <p role="alert" className="text-brand text-[1.75rem]">
          Não foi possível remover o perfil ({remove.error.message})
        </p>
      )}
      <div className="flex gap-4">
        <PlayButton label="Cancelar" icon={X} autoFocus onPress={onClose} />
        <PlayButton label="Remover" icon={Trash2} onPress={handleRemove} />
      </div>
    </Dialog>
  )
}

/**
 * Seleção de perfis, a tela que abre o app: os perfis cadastrados (na ordem
 * do backend), o modo anônimo — sem histórico nem lista — e o cadastro de
 * um perfil novo. O foco começa no item escolhido da última vez. Perfil não
 * tem senha: escolher já entra no Início. "Gerenciar perfis" troca para o
 * modo de remover: só os perfis, com a lixeira, e OK pede confirmação.
 */
export function ProfilesScreen() {
  const { ref, focusKey } = useScreenFocusable({ focusKey: PROFILES_FOCUS_KEY })
  const navigate = useNavigate()
  const query = useListUsers()
  const users = query.data

  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)
  // Perfil aguardando a confirmação da remoção.
  const [removing, setRemoving] = useState<UserResponse>()
  // Item que recebe o foco quando os itens montam: o da última escolha e,
  // voltando do cadastro, o "Novo perfil".
  const [focusTileKey, setFocusTileKey] = useState(() =>
    readStorage<string | undefined>(STORAGE_KEYS.lastProfile, undefined),
  )

  const enter = useCallback(
    (profile: UserResponse | null) => {
      activeProfile.set(profile)
      writeStorage(
        STORAGE_KEYS.lastProfile,
        profile ? profileKey(profile) : ANONYMOUS_KEY,
      )
      navigate(HOME_PATH, { replace: true })
    },
    [navigate],
  )

  const latestUsers = useRef(users)
  useLayoutEffect(() => {
    latestUsers.current = users
  })
  const handleSelect = useCallback(
    (tileKey: string) => {
      if (managing) {
        const user = latestUsers.current?.find(
          (item) => profileKey(item) === tileKey,
        )
        if (user) setRemoving(user)
        return
      }
      if (tileKey === NEW_PROFILE_KEY) {
        setCreating(true)
        return
      }
      if (tileKey === ANONYMOUS_KEY) {
        enter(null)
        return
      }
      const user = latestUsers.current?.find(
        (item) => profileKey(item) === tileKey,
      )
      if (user) enter(user)
    },
    [enter, managing],
  )

  const toggleManaging = useCallback(() => setManaging((on) => !on), [])

  // Fechar sem remover devolve o foco ao perfil que abriu o modal.
  const handleCloseRemove = useCallback(() => {
    if (removing) setFocus(tileFocusKey(profileKey(removing)))
    setRemoving(undefined)
  }, [removing])

  // Removido: o foco vai para o primeiro perfil que sobrou; sem nenhum, a
  // tela sai do modo de gerenciar com o foco em "Novo perfil".
  const handleRemoved = useCallback((user: UserResponse) => {
    setRemoving(undefined)
    if (activeProfile.get()?.id === user.id) activeProfile.set(null)
    const remaining = queryClient.getQueryData<UserResponse[]>(
      getListUsersQueryKey(),
    )
    const next = remaining?.[0]
    if (next) {
      setFocus(tileFocusKey(profileKey(next)))
      return
    }
    setFocusTileKey(NEW_PROFILE_KEY)
    setManaging(false)
  }, [])

  // Voltar no cadastro volta pros perfis e, no modo de gerenciar, sai dele
  // (o modal de remoção, por cima, fecha antes); na seleção, não é tratado
  // (o app fecha).
  useEffect(() => {
    if (!creating) return
    return registerBackHandler(() => {
      setCreating(false)
      setFocusTileKey(NEW_PROFILE_KEY)
      return true
    })
  }, [creating])
  useEffect(() => {
    if (!managing) return
    return registerBackHandler(() => {
      setManaging(false)
      setFocus(MANAGE_FOCUS_KEY)
      return true
    })
  }, [managing])

  const tileKeys = [
    ...(users ?? []).map(profileKey),
    ANONYMOUS_KEY,
    ...(query.isSuccess ? [NEW_PROFILE_KEY] : []),
  ]
  const autoFocusKey =
    focusTileKey && tileKeys.includes(focusTileKey) ? focusTileKey : tileKeys[0]

  const hasUsers = (users?.length ?? 0) > 0

  return (
    <>
      <FocusContext.Provider value={focusKey}>
        <section
          ref={ref}
          aria-label="Perfis"
          className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center px-8 py-[3.375rem]"
          style={{ backgroundImage: SCREEN_GLOW }}
        >
          {creating ? (
            <NewProfileForm onCreated={enter} />
          ) : (
            <>
              <img
                src="/logo.png"
                alt="Akari TV"
                style={{ width: `${LOGO_REM}rem`, height: `${LOGO_REM}rem` }}
              />
              <h1 className="text-[3.5rem] font-medium">
                {managing ? 'Gerenciar perfis' : 'Quem está assistindo?'}
              </h1>

              {query.isPending && (
                <div className="mt-14">
                  <ProfilesSkeleton />
                </div>
              )}
              {!query.isPending && (
                <div className="mt-14 flex max-w-full flex-wrap justify-center gap-14">
                  {users?.map((user) => (
                    <ProfileTile
                      key={user.id}
                      tileKey={profileKey(user)}
                      name={user.name}
                      color={avatarColor(user.id)}
                      removable={managing}
                      autoFocus={autoFocusKey === profileKey(user)}
                      onSelect={handleSelect}
                    />
                  ))}
                  {!managing && (
                    <ProfileTile
                      tileKey={ANONYMOUS_KEY}
                      name="Anônimo"
                      icon={VenetianMask}
                      autoFocus={autoFocusKey === ANONYMOUS_KEY}
                      onSelect={handleSelect}
                    />
                  )}
                  {query.isSuccess && !managing && (
                    <ProfileTile
                      tileKey={NEW_PROFILE_KEY}
                      name="Novo perfil"
                      icon={Plus}
                      autoFocus={autoFocusKey === NEW_PROFILE_KEY}
                      onSelect={handleSelect}
                    />
                  )}
                </div>
              )}
              {hasUsers && (
                <div className="mt-14">
                  <PlayButton
                    focusKey={MANAGE_FOCUS_KEY}
                    label={managing ? 'Concluído' : 'Gerenciar perfis'}
                    icon={managing ? Check : Pencil}
                    onPress={toggleManaging}
                  />
                </div>
              )}
              {query.isError && (
                <div className="mt-10 flex flex-col items-center gap-6">
                  <p className="text-muted-foreground text-[1.75rem]">
                    Não foi possível carregar os perfis ({query.error.message})
                  </p>
                  <PlayButton
                    label="Tentar de novo"
                    icon={RotateCw}
                    onPress={() => void query.refetch()}
                  />
                </div>
              )}

              <p className="text-muted-foreground absolute inset-x-0 bottom-[3.375rem] flex items-center justify-center gap-3 text-[1.75rem] leading-none">
                <KeyCap icon={ChevronLeft} />
                <KeyCap icon={ChevronRight} />
                <span className="mr-8">escolher</span>
                <KeyCap label="OK" />
                <span>{managing ? 'remover' : 'entrar'}</span>
              </p>
            </>
          )}
        </section>
      </FocusContext.Provider>
      {removing && (
        <RemoveProfileDialog
          user={removing}
          onRemoved={handleRemoved}
          onClose={handleCloseRemove}
        />
      )}
    </>
  )
}
