---
name: docs-interview
description: Faz curadoria da especificação do akari-web (../ESPECIFICACAO.md) e do README.md, resolvendo marcas de hedge ("a confirmar", "placeholder", "pendência") e pontos em aberto via entrevista com o usuário. Trigger em "revisar a especificação", "curadoria da documentação", "tirar dúvidas da especificação", "deixar a documentação mais confiável", ou sempre que o usuário pedir pra passar pela especificação perguntando sobre pontos em aberto. Só pergunta ao usuário o que é decisão de produto/intenção — tudo que é verificável lendo o código (grep, arquivos, git log) é resolvido sozinho, sem pergunta. Não cobre APRENDIZADOS.md: esse arquivo é histórico fechado, sem pontos em aberto a entrevistar (ver skill docs-style).
---

# docs-interview

Resolve pontos em aberto em `../ESPECIFICACAO.md` (relativo à raiz do repo — o arquivo mora um
nível acima do projeto `akari-web`, junto do `icon.png`) e em `README.md`, fazendo perguntas
objetivas ao usuário — só sobre o que *só ele* pode responder — e verificando tudo o mais sozinho,
lendo o código. Diferente do akari (backend), aqui não há uma árvore de `domain/<x>/README.md`: a
arquitetura inteira do frontend está num único documento com seções numeradas. O objetivo final é
nunca deixar uma marca de hedge sem resolução: todo ponto vira **Confirmado** (fato verificado em
código/dispositivo), **Aceito** (decisão deliberada, não é dívida), ou **Backlog real** (dívida
técnica reconhecida, não urgente).

## Por que a divisão pergunta-vs-verificação importa

Perguntar algo que já dá pra responder lendo o código desperdiça o tempo do usuário e sinaliza que
você não leu o projeto direito. Mas assumir uma intenção de produto (se um comportamento é
aceitável, se algo é roadmap, se vale mudar uma decisão agora) sem perguntar é pior — vira
documentação que parece confiável mas reflete só a sua suposição. A regra de ouro:

- **Dá pra confirmar com uma ferramenta** (grep, `Read`, `git log`, rodar `npm run check`/`build`,
  testar no dispositivo via `adb`) → verifique você mesmo, nunca pergunte. Isso cobre quase todo "a
  confirmar"/"não verificado"/"placeholder" deixado por uma versão anterior da especificação.
- **Só o mantenedor sabe** (é aceitável assim pro volume de uso atual? é intencional ou falta
  implementar? vale mudar a decisão agora?) → pergunte, com opções objetivas.

## Processo

### 1. Escopo e ordem

`ESPECIFICACAO.md` tem seções numeradas (1. Princípios … 9. Plano de entrega). Percorra na ordem,
**uma seção de cada vez**, perguntando ao final de cada uma se segue para a próxima — nunca emende
várias seções na mesma leva sem o usuário pedir. Depois da especificação, se houver pontos em
aberto, passe pelo `README.md`.

`APRENDIZADOS.md` fica de fora desta curadoria: é um log fechado (sintoma → causa → correção já
resolvidos), não tem "Hipótese" pendente por definição — ver `docs-style` para o porquê desse
arquivo ser tratado diferente.

### 2. Levantar os pontos em aberto da seção

Leia a seção inteira e liste os candidatos a pergunta/verificação. Os sinais mais comuns neste
projeto (não usamos a palavra "Hipótese:" como marca formal — os hedges aparecem como linguagem
natural):

- "a confirmar", "placeholder", "falta", "pendência", "TODO" — qualquer hedge que sinaliza que
  quem escreveu não teve certeza ou deixou algo incompleto de propósito.
- Decisões que citam um valor sem justificar (ex.: uma largura, um tempo de transição) quando não
  há referência de design real por trás — vale perguntar se é intencional ou só um placeholder até
  existir um valor definitivo.
- Afirmações sobre comportamento de biblioteca/dispositivo que nunca foram testadas de verdade
  (diferente do que já foi validado no Google TV Streamer conectado).

### 3. Verificar sozinho o que for factual

Antes de perguntar qualquer coisa, tente resolver via ferramenta:

- **Existe algo no código?** `grep`/`Read` direto em `src/` (ex.: "o throttle está configurado?" →
  grep por `throttle` em `app/providers.tsx`).
- **O comportamento é real ou só documentado?** Rode `npm run check` (type-check + lint) e, quando
  fizer sentido, valide de verdade no dispositivo conectado via `adb` (como foi feito pro flicker
  de foco e pro manifesto Android) — não aceite "deveria funcionar" sem checar.
- **Já foi decidido antes?** `git log`/`git show` no histórico de `ESPECIFICACAO.md` e
  `APRENDIZADOS.md` — uma dúvida pode já ter sido resolvida numa sessão anterior.

Atualize o arquivo com o resultado, usando a marca **Confirmado** (ou, se for corrigir um equívoco
factual tipo um texto desatualizado, corrija o texto direto e registre o que mudou). Cite
`arquivo:linha` quando ajudar quem for reler depois.

### 4. Perguntar só o que sobrar

O que não dá pra resolver em código vira pergunta via `AskUserQuestion`. Agrupe até 4 perguntas por
chamada (o limite da ferramenta) e prefira esse formato:

- Pergunta objetiva, citando o trecho/comportamento exato (não "o que você acha de X", mas "X está
  especificado como Y, mas nunca foi validado — mantém assim ou muda?").
- 2 a 4 opções concisas, cada uma com uma frase de consequência. O par mais comum:
  - **Aceito** / **Intencional** — decisão deliberada, não precisa virar tarefa.
  - **Backlog real** / **Lacuna a cobrir** — dívida reconhecida, sem pressa — ou, quando for algo
    que o usuário quer corrigir no ato, ofereça essa opção também.
- Não pergunte duas vezes pela mesma coisa: se o usuário já estabeleceu uma **política geral**,
  aplique a seções equivalentes sem perguntar de novo — só marque "**Backlog real** (confirmado
  pelo mantenedor)".

### 5. Atualizar o arquivo

Troque a marca de incerteza pela resolução, direto no texto (não deixe a pergunta e a resposta só
na conversa). Vocabulário padrão, em negrito:

- **Confirmado** (+ evidência: arquivo:linha, teste no dispositivo, etc.) — fato verificado.
- **Aceito** (confirmado pelo mantenedor) — comportamento deliberado, não é dívida.
- **Backlog real** (confirmado pelo mantenedor) — dívida reconhecida, candidata a correção futura,
  sem compromisso de prazo.
- Quando a resposta implica um **TODO item concreto que o usuário aprovou fazer agora**, não
  documente só a intenção — execute a mudança de verdade e documente o resultado, não a promessa.

O que não entra no texto da especificação é a jornada de como chegamos à resolução — isso, quando
vale a pena preservar, vai pra `APRENDIZADOS.md`, não pra `ESPECIFICACAO.md` (ver skill
`docs-style` pro critério exato).

### 6. Fechar a seção e seguir

Resuma em 1-2 frases o que foi resolvido (quantas perguntas novas, o que foi resolvido sozinho) e
pergunte explicitamente se segue para a próxima seção. Não pule a confirmação — o ritmo é do
usuário, não seu.

## Quando a entrevista vira mudança de código de verdade

Às vezes uma resposta não é só "documenta isso" — é "sim, corrige/muda agora". Quando o usuário
aprovar explicitamente uma ação concreta:

1. Levante **todas** as referências antes de tocar em qualquer arquivo (`grep -rn` pelo termo em
   `src/`, `ESPECIFICACAO.md`, `README.md`, `APRENDIZADOS.md`).
2. Faça a mudança.
3. Rode `npm run check` (e, se a mudança afetar build/Android, `npm run build`) antes de dar o
   fluxo por encerrado.
4. Só então atualize a especificação/README afetados.
5. Nunca comitar essa mudança sem aprovação explícita e separada — mesma regra de sempre para
   commits.

## O que NÃO fazer

- Não pergunte algo que um `grep`/`Read`/teste no dispositivo resolve — isso é o erro mais caro
  desta metodologia.
- Não invente opções de resposta fora do que a pergunta realmente admite; mantenha 2-4 opções
  claras.
- Não acumule perguntas de várias seções numa pergunta só.
- Não avance para a próxima seção sem o usuário confirmar.
- Não deixe um hedge sem resolução — se você leu a seção e viu um, ele entra na lista de pontos a
  cobrir nesta rodada, mesmo que pareça trivial.
- Não rode a bateria de evals/benchmarks do skill-creator para este fluxo — é uma metodologia de
  trabalho interno do projeto, não uma skill genérica a ser distribuída/otimizada por eval.
