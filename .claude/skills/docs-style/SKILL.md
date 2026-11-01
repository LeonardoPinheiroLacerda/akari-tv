---
name: docs-style
description: Convenção de escrita para ../ESPECIFICACAO.md e README.md do akari-tv — documentam só o estado atual da decisão/arquitetura, nunca a jornada de como chegamos lá. APRENDIZADOS.md é a exceção deliberada: existe justamente para registrar a jornada (sintoma, hipóteses descartadas, causa real, investigação) — nunca resuma ele pro padrão "só estado atual" dos outros dois. Trigger sempre que for editar/criar ESPECIFICACAO.md, README.md ou APRENDIZADOS.md, seja numa entrevista de curadoria (skill docs-interview), seja de passagem ao implementar uma feature ou corrigir um bug.
---

# docs-style

`../ESPECIFICACAO.md` (decisões de stack e arquitetura — mora um nível acima da raiz do repo,
junto do `icon.png`) e `README.md` (scripts e apontamentos) descrevem **o estado atual** da
decisão, nunca o processo de como foi alcançada. `APRENDIZADOS.md` é a exceção: existe para
registrar exatamente a jornada que os outros dois cortam.

## O teste (ESPECIFICACAO.md e README.md)

Antes de escrever uma frase sobre decisão/mudança, pergunte: **isso ajuda alguém a
implementar/manter o projeto a partir de agora?**

- Se a frase é sobre a *jornada* (abordagem anterior considerada e trocada, "antes isso usava X,
  mudamos pra Y porque na prática não funcionou", "chegamos a tentar Z") — **corte**. Ninguém
  implementando a próxima tela precisa do histórico; só da decisão final.
- Se é uma **razão não-óbvia pro desenho atual** — mesmo citando uma alternativa rejeitada (ex.:
  "o manifesto Android é editado direto no projeto gerado, não via plugin local, porque a
  recomendação oficial do Capacitor é versionar o projeto nativo") — **mantenha**. Essa razão evita
  que alguém desfaça depois algo que não está quebrado.

### Cortar

- "Chegamos a implementar X como plugin Capacitor local, mas voltamos pra Y" → só descreva Y e,
  se for relevante, a razão ("porque a recomendação oficial do Capacitor é versionar `android/`
  como código-fonte").
- Histórico de versões anteriores de uma seção da especificação sem nenhum fato presente de valor.
- Qualquer bullet que só narra um problema já resolvido sem deixar fato presente (isso é assunto de
  `APRENDIZADOS.md`, não de `ESPECIFICACAO.md`).

### Manter

- A razão curta pro estado atual, mesmo citando o que foi descartado.
- Qualquer decisão que, sem a razão registrada, pareceria arbitrária e tentadora de "corrigir" no
  futuro (ex.: por que o tema não troca de claro/escuro, por que `android/` é versionado).
- Marcas de curadoria (`Confirmado`, `Aceito`, `Backlog real` — ver `docs-interview`) quando a
  especificação já tiver passado por uma entrevista.

## APRENDIZADOS.md é a exceção — não aplique o corte acima

Esse arquivo existe *para* a jornada que `ESPECIFICACAO.md`/`README.md` cortam. Cada entrada
documenta, nessa ordem: sintoma observado → hipóteses descartadas (e por que pareciam certas, e
como foram eliminadas) → causa real → como foi confirmada (idealmente com evidência reproduzível —
log do dispositivo, não só releitura de código) → correção aplicada → regra geral daí pra frente.

Não resuma uma entrada existente pra virar só "a causa era X" — o valor do arquivo é a trilha de
investigação ficar registrada, pra não repetir o mesmo caminho errado da próxima vez. Ver a entrada
"Foco por D-pad 'vai e volta'" como referência de formato: ela preserva explicitamente as duas
hipóteses erradas testadas (corrida assíncrona na lib, falta de memoização) antes de chegar na
causa real, porque saber *o que já foi descartado e por quê* evita que alguém investigue o mesmo
caminho de novo.

Uma entrada nova em `APRENDIZADOS.md` só é candidata a corte se for genuinely redundante com uma
entrada já existente (mesma causa raiz, mesmo componente) — nesse caso, estenda a entrada existente
em vez de duplicar, mas ainda preservando a jornada de ambas se forem instrutivas de formas
diferentes.

## Quando estiver em dúvida

Julgamento frase a frase, não find-and-replace mecânico. Se não tiver certeza se uma frase é
"jornada que corta" (em `ESPECIFICACAO.md`/`README.md`) ou "razão que fica", pergunte ao usuário
antes de remover texto — é mais barato perguntar do que apagar uma decisão que parecia óbvia mas
tinha um motivo. Para `APRENDIZADOS.md`, o viés por padrão é preservar, não cortar.
