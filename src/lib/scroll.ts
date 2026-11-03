// Rolagem suave que segue o foco. O `scrollTo({ behavior: 'smooth' })` nativo
// recomeça a animação (com aceleração do zero) a cada chamada: com a seta
// segurada, um passo a cada 100 ms, a rolagem quase não saía do lugar e,
// quando o foco parava, corria tudo de uma vez — a grade "engasgava" e depois
// saltava milhares de pixels. Aqui cada elemento tem uma animação só, que a
// cada quadro anda uma fração do que falta até o alvo; um alvo novo só muda o
// destino, sem reiniciar a velocidade.

// Fração da distância restante percorrida por quadro de 60 Hz: um passo
// isolado assenta em ~250 ms, e a seta segurada acompanha com poucos quadros
// de atraso.
const EASE_PER_FRAME = 0.2
const FRAME_MS = 1000 / 60
// Abaixo disso a animação termina no alvo exato.
const SNAP_PX = 0.5

interface Target {
  top?: number
  left?: number
}

interface Animation {
  top: number
  left: number
  /** Timestamp do quadro anterior; `undefined` antes do primeiro. */
  last?: number
}

const animations = new WeakMap<HTMLElement, Animation>()

function clamp(value: number, max: number): number {
  return Math.min(Math.max(0, value), Math.max(0, max))
}

function step(element: HTMLElement, animation: Animation, now: number) {
  // Cancelada (ou trocada por outra depois de um `jumpScrollTo`): esta cadeia de quadros para.
  if (animations.get(element) !== animation) return
  // Corrige pelo tempo real do quadro: na TV um quadro pode levar mais que
  // 16 ms. O primeiro conta como um quadro: o timestamp do rAF pode ser
  // anterior ao momento da chamada, e um tempo negativo andaria para trás.
  const elapsed =
    animation.last === undefined
      ? FRAME_MS
      : Math.min(Math.max(now - animation.last, 0), 100)
  animation.last = now
  if (elapsed === 0) {
    requestAnimationFrame((time) => step(element, animation, time))
    return
  }
  const ease = 1 - Math.pow(1 - EASE_PER_FRAME, elapsed / FRAME_MS)

  const dy = animation.top - element.scrollTop
  const dx = animation.left - element.scrollLeft
  if (Math.abs(dy) < SNAP_PX && Math.abs(dx) < SNAP_PX) {
    element.scrollTop = animation.top
    element.scrollLeft = animation.left
    animations.delete(element)
    return
  }
  const before = [element.scrollTop, element.scrollLeft]
  element.scrollTop += dy * ease
  element.scrollLeft += dx * ease
  // Sem progresso — passo menor que um pixel do aparelho, ou posição presa
  // num limite porque o conteúdo encolheu —, vai direto ao alvo e termina,
  // em vez de animar para sempre.
  if (element.scrollTop === before[0] && element.scrollLeft === before[1]) {
    element.scrollTop = animation.top
    element.scrollLeft = animation.left
    animations.delete(element)
    return
  }
  requestAnimationFrame((time) => step(element, animation, time))
}

/** Rola `element` suavemente até `target`; chamadas seguidas só redirecionam a animação. */
export function smoothScrollTo(element: HTMLElement, target: Target) {
  const maxTop = element.scrollHeight - element.clientHeight
  const maxLeft = element.scrollWidth - element.clientWidth
  const current = animations.get(element)
  const top = clamp(target.top ?? current?.top ?? element.scrollTop, maxTop)
  const left = clamp(
    target.left ?? current?.left ?? element.scrollLeft,
    maxLeft,
  )

  if (current) {
    current.top = top
    current.left = left
    return
  }
  const animation = { top, left }
  animations.set(element, animation)
  requestAnimationFrame((time) => step(element, animation, time))
}

/** Desloca o alvo atual (ou a posição, sem animação em curso) por `delta`. */
export function smoothScrollBy(element: HTMLElement, delta: Target) {
  const current = animations.get(element)
  smoothScrollTo(element, {
    top: (current?.top ?? element.scrollTop) + (delta.top ?? 0),
    left: (current?.left ?? element.scrollLeft) + (delta.left ?? 0),
  })
}

/** Alvo pendente da animação em curso, ou a posição atual. */
export function scrollTarget(element: HTMLElement): Required<Target> {
  const current = animations.get(element)
  return {
    top: current?.top ?? element.scrollTop,
    left: current?.left ?? element.scrollLeft,
  }
}

/** Vai direto a `target`, cancelando a animação em curso (ex.: lista nova, volta ao topo). */
export function jumpScrollTo(element: HTMLElement, target: Target) {
  animations.delete(element)
  if (target.top !== undefined) element.scrollTop = target.top
  if (target.left !== undefined) element.scrollLeft = target.left
}
