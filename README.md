# akari-web

Stack e decisões: ver `../ESPECIFICACAO.md`. Lições da implementação (bugs
sutis, porquês descobertos na prática): ver `APRENDIZADOS.md`.

## Scripts

- `npm run dev` — servidor Vite (setas do teclado = D-pad)
- `npm run build` — build de produção (`tsc -b` + `vite build`)
- `npm run check` — type-check + lint
- `npm run lint` / `npm run format` — ESLint / Prettier
- `npm run api:gen` — gera `src/api/generated` a partir de `http://localhost:8080/q/openapi`
- `npm run api:check` — gera e falha se `src/api/generated` mudou (CI)
- `npm run android:add` — gera `android/` (usado só uma vez; a pasta é versionada)
- `npm run android:sync` — build web + `cap sync android` (depois de mudar código web ou plugins)
- `npm run android:run` — build web + `cap run android` (instala e roda no dispositivo/emulador)

## Backend

O app chama o backend em `VITE_SERVER_URL` (copie `.env.example` para `.env.local`). Na TV, use o
IP da máquina do backend na rede local — `localhost` lá é a própria TV.

`android/` é versionado (recomendação oficial do Capacitor — projeto nativo é código-fonte, não
build output). As customizações de TV (leanback, banner, orientação, cleartext) estão editadas
direto em `android/app/src/main/AndroidManifest.xml`.
