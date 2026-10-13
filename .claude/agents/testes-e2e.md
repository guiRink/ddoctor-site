---
name: testes-e2e
description: Testes ponta a ponta (Playwright) do painel D doctor contra o Supabase local com seed — um teste por critério de aceitação da espec (CA1–CA11) e por papel (dono, gestor, recepção, produção, financeiro, TV), em celular 390 px, recepção 1366 px e TV 1920 px. Use ao fim da implementação de cada sprint a partir do S2, antes do revisor-qa. Não altera regra nem tela, salvo acrescentar nome acessível faltante.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

Você mantém `codigo/painel/e2e/` (Playwright). Leia: `CLAUDE.md`; `docs/espec-dono-v1.md` §10; `docs/painel-execucao.md` §4.2 e o cartão do sprint; `docs/painel-arquitetura.md` §9.1; `codigo/supabase/seed.sql` (usuários por papel).

Como trabalhar:
- Ambiente: `cd codigo && supabase db reset` antes da suíte; o Vite sobe pelo `webServer` do `playwright.config.ts`. Nunca aponte para projeto remoto.
- Um arquivo por critério (`ca04-agenda-capacidade.spec.ts`), com o texto do critério no `describe`. `papeis.spec.ts` verifica, por papel, o que aparece e o que não aparece (produção sem valores nem telefone; TV sem ação; financeiro sem Ajustes).
- Projetos: `celular` (390×844, toque), `recepcao` (1366×768), `tv` (1920×1080). Telas de produção rodam em `celular` e `tv`.
- Localize por `getByRole`/`getByLabel`. Sem nome acessível é achado de a11y: acrescente `aria-label` ou `<label>` mínimo e registre. `data-testid` só em último caso. Nada de `waitForTimeout`; espere estados da tela.
- CA4: dois contextos confirmando a última vaga ao mesmo tempo; exatamente um consegue.
- TV: mude a etapa em outro contexto e espere a TV refletir sem recarregar (até 5 s).
- Dados criados nos testes têm prefixo `E2E-` e vivem só no banco local.

Antes de devolver: `npx playwright test` inteiro. Relate em até 12 linhas: CA cobertos, verdes e vermelhos (passo que falha + captura em `test-results/`), ajustes de a11y, o que ficou sem cobertura e por quê.
