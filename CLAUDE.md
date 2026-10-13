# GusPainel — site e painel da oficina D doctor

Projeto do Guilherme para a oficina **D doctor — martelinho de ouro** (Curitiba). Duas partes: a **landing page** publicada e o **painel de gestão** em construção. Tudo em pt-BR.

## Leia antes de trabalhar
1. `notas/mapa.md` — estado atual, próximo passo e **Decisões do dono** (sempre).
2. `docs/painel-execucao.md` — fases, sprints, critérios de pronto, agentes e ritual. Sprint corrente: `notas/sprints/sprint-N.md`.
3. `docs/painel-design.md` — sistema visual do painel (componentes, densidade, cores de estado, padrões por superfície). **UI/UX é requisito, não acabamento.**
4. `docs/painel-arquitetura.md` — modelo v2 (§6), estados (§7), integrações (§8), papéis e segurança (§9).
5. `docs/painel-informacoes.md` — de onde vem cada campo, quem preenche, onde aparece; provisórios (§4–5).
6. `docs/espec-dono-v1.md` — voz do dono; critérios de aceitação (§10).
7. `PRODUCT.md` e `DESIGN.md` — fatos e identidade. Itens `[inferido]`/`[aberto]` não viram afirmação na UI.
8. `docs/maxpar-estudo.md` e, após o G1, `docs/maxpar-g1.md`.
`docs/painel-plano.md` é histórico.

## Estrutura (padrão da skill obsidian-codigo)
```
codigo/site/          landing (HTML estático; frames do filme em codigo/site/frames)
codigo/painel/        frontend: Vite + React 19 + TS + Tailwind v4 + TanStack Query + supabase-js; e2e/ (Playwright)
codigo/compartilhado/ tipos, enums e contratos v2 (painel e worker importam daqui; banco.gerado.ts vem da CLI)
codigo/supabase/      migrations/, tests/ (pgTAP), functions/ (Edge), seed.sql — rode a CLI de dentro de codigo/
codigo/worker/        Node 22: fila, backup, leitores Maxpar, Calia (a partir do S5)
codigo/tools/         serve.mjs (servidor local), shot.mjs (captura via CDP), probe.mjs (JS em headless)
docs/  notas/ (sprints/ = checklist por sprint)  fotos/  media/ (fora do git; inclui media/g1)
.claude/agents/       escrivao, revisor-qa, frontend-painel, designer-painel, arquiteto-dados, dominio-regras, testes-e2e, integracao
```

## Comandos
```bash
cd codigo && supabase start                 # Postgres/Auth/Storage locais (precisa Docker ou OrbStack)
cd codigo && supabase db reset              # migrations + seed demo
cd codigo && supabase test db               # pgTAP (RLS, funções)
cd codigo && supabase gen types typescript --local > compartilhado/src/banco.gerado.ts
cd codigo/painel && npm run dev             # painel local em http://localhost:5173/ddoctor-site/painel/ ; VITE_DADOS=supabase|memoria
cd codigo/painel && npm test -- --run && npm run lint && npm run build
cd codigo/painel && npx playwright test     # e2e (a partir do S2)
node codigo/tools/serve.mjs codigo/site 8765
node codigo/tools/shot.mjs out.png URL 1440 900 9000   # captura headless (usar nas revisões de UI)
```
Deploy: push na `main` → workflow `.github/workflows/pages.yml` builda o painel e publica `codigo/site` em https://guirink.github.io/ddoctor-site/ (painel em `/painel/`). Produção do banco: `supabase db push` só pelo Guilherme, à mão, após checkpoint e backup.

## Regras do painel
- **UI/UX:** o painel tem de ser bonito, claro e rápido de ler. Toda tela segue `docs/painel-design.md`; toda aba nova passa pelo `designer-painel` (composição antes, crítica com capturas em 390/1366/1920 depois) antes de ir ao dono. Nada de tela "funcional mas feia".
- **Visual clean (revisão SE, 13/10/2026, pedido do Guilherme):** fundo claro, barra lateral clara, Archivo largura normal, raio pequeno (8 cartão / 6 controle), sombra só sutil; amarelo só para ação primária, item ativo, foco e "hoje"; estados em pílulas suaves; a `Placa` Mercosul identifica cada carro. Tokens no Tailwind (`amarelo`, `preto`, `papel`, `cartao`, `tinta`, `linha`, `ok`, `atencao`, `alerta`, `maxpar`, `cinza-*`); componentes genéricos em `src/componentes/ui/`. A TV continua escura. Detalhes em `docs/painel-design.md`.
- **Dados:** telas → hooks de `src/dados/` (TanStack Query) → `Repositorio` → `RepositorioSupabase` ou `RepositorioMemoria`. Telas e componentes nunca importam `@supabase/supabase-js` nem `dexie` (o lint bloqueia).
- **Esquema** só por migration nova (`arquiteto-dados`); nunca editar migration commitada. Toda tabela nasce com `oficina_id`, RLS, políticas por papel (arq. §9.1) e teste pgTAP.
- **Segredos:** o front só usa a anon key via `.env.local` (fora do git). `service_role`, credenciais da Maxpar e da Calia nunca no front, no repositório, no chat ou em log. **O repositório é público:** nenhum dado real em seed, fixture, print ou commit.
- **Demo** só no `seed.sql` (`oficina-demo`) ou no repositório em memória, sempre marcado; nunca no projeto de produção.
- **Regras de negócio** puras em TS com Vitest (`src/dominio/` ou `codigo/compartilhado/`); dinheiro em centavos; `agora` por parâmetro.
- **Valores não confirmados** vêm de `config_oficina` e aparecem como "provisório — a confirmar". Não inventar fatos da oficina.
- **Maxpar:** tudo é hipótese até `docs/maxpar-g1.md`. Nada escreve na Maxpar; nada contorna CAPTCHA ou MFA. Ação no portal vira `pendencia_externa`.
- Rótulos pt-BR em `src/dominio/rotulos.ts`.

## Como trabalhar (sprint em loop)
Siga `docs/painel-execucao.md` §5: branch `sprint/N-slug` → checklist em `notas/sprints/sprint-N.md` (aprovado pelo Guilherme) → loop tarefa → agente → verificar → commit → `designer-painel` (telas) → `testes-e2e` → `revisor-qa` → `escrivao` → merge e push → checkpoint do dono. Não abrir sprint que dependa de resposta pendente do dono sem o checkpoint, salvo pedido do Guilherme.

## Agentes
- `arquiteto-dados` — banco Supabase: migrations, RLS, funções, views, Storage, seed, pgTAP. Único que cria migrations.
- `dominio-regras` — regras puras em TS + Vitest: estados, semáforo, horas úteis, capacidade, vencimento, aging, estoque, margem, contratos.
- `frontend-painel` — telas e componentes sobre hooks/Repositorio, seguindo `docs/painel-design.md`.
- `designer-painel` — UI/UX: compõe a tela antes do código e critica a tela pronta com capturas; corrige apresentação.
- `testes-e2e` — Playwright por critério de aceitação e por papel, em 390/1366/1920 (a partir do S2).
- `integracao` — worker, backup, leitores Maxpar, Calia; só com o portão aberto (S5–S7).
- `revisor-qa` — revisa o diff do sprint e roda tudo; não edita.
- `escrivao` — mantém `notas/mapa.md` (com Decisões do dono), `notas/status.md` por fase e `Atualização noturna.md`.

## Observações do ambiente
- O cache do npm em `~/.npm/_cacache` tem arquivos sem permissão (EACCES). Instale com `npm_config_cache=/tmp/npm-cache npm install` ou corrija as permissões com `sudo chown -R $(id -u):$(id -g) ~/.npm`.
- Não há Docker no Mac ainda: instalar Docker Desktop ou OrbStack antes do S1 (Supabase local). Até lá, o painel roda com `VITE_DADOS=memoria`.

## Git
Commits em pt-BR, imperativo, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Autor `guiRink <guirink7@gmail.com>`. Branches `sprint/N-slug`; commits `Painel S<N>: …`; tag `sprint-N` no merge. Nunca commitar `media/`, `node_modules`, `.env*`, `codigo/site/painel/` (gerado no CI).
