# Aprendizados

Lições específicas da implementação deste projeto (diferente da `ESPECIFICACAO.md`,
que é a decisão/arquitetura — aqui ficam os porquês descobertos na prática).

## Foco por D-pad "vai e volta" ao navegar rápido

**Sintoma:** ao mover o foco entre itens com o D-pad, às vezes ele parecia ir
pro item certo e voltar rapidinho pro anterior — mais perceptível quanto mais
rápido o usuário navegava.

**Não era isso:**
- Não era corrida assíncrona no `norigin-spatial-navigation` (layout
  medido/foco trocado via ciclo `async`). Throttle (`throttle: 100`,
  `app/providers.tsx`) foi aplicado como reforço, mas não era a causa.
- Não era re-render desnecessário por falta de memoização (havia um real,
  corrigido — `Focusable` com `React.memo` + extrair o botão da tela num
  componente próprio em vez de closure inline no `.map()` —, mas também não
  era a causa do sintoma relatado).

**Era isso:** o `Button` do shadcn/ui tem `transition-all` nas classes base
(anima cor, fundo, borda — tudo). A tela trocava a `variant` do botão
(`default` ↔ `secondary`) a cada mudança de foco pra indicar qual estava
selecionado. Resultado: a cada navegação, dois botões cruzavam cor ao mesmo
tempo (um escurecendo, outro clareando), sem nenhuma garantia de sincronia
com o `scale` do foco. Visualmente ambíguo — e pior quanto mais rápido o
crossfade anterior ainda não tinha terminado quando o próximo começava.

**Como foi confirmado:** não deu pra achar só lendo código. O que resolveu foi
instrumentar o app de verdade no dispositivo (`init({ debug: true })` da lib
+ um `console.log` próprio emparelhando timestamp, item e `focused` em cada
transição, lido via `adb logcat`) e comparar contra os eventos brutos de
teclado (`window.addEventListener('keydown', ...)`). O log provou, transição
por transição, que a lógica estava 100% correta — nenhum item errado,
nenhuma duplicata — mesmo nos trechos mais rápidos. Isso descartou de vez a
hipótese de bug de estado e apontou pra fora do React: se o dado está certo e
a tela parece errada, o problema é na pintura, não no estado.

**Correção:** nunca trocar `variant`/classe de cor do `Button` pra indicar
foco. O efeito de foco fica isolado numa camada própria (um `div` envolvendo
o botão), animando só `transform: scale()` e `outline-color`, 120ms — exatamente
o que a seção 3/7 da `ESPECIFICACAO.md` já mandava desde o início. A variante
do botão fica fixa; o estado visual de foco nunca reusa o `transition-all`
herdado de um componente de terceiros.

**Regra geral daqui pra frente:** qualquer indicação de foco/seleção que
reusar um componente de terceiros (shadcn ou outro) tem que isolar a
transição numa camada própria com `transition` explícito (só as propriedades
permitidas pela seção 7), nunca confiar que trocar `variant`/classe do
componente de terceiros vai animar do jeito que a especificação pede.
