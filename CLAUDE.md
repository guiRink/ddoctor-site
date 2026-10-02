# GusPainel — site e painel da oficina D doctor

Projeto do Guilherme para a oficina **D doctor — martelinho de ouro** (Curitiba). Duas partes: a **landing page** publicada e o **painel de gestão** em construção. Tudo em pt-BR.

## Leia antes de trabalhar
1. `notas/mapa.md` — estado atual e próximo passo (sempre).
2. `docs/painel-plano.md` — método, stack, modelo de dados e checklist dos sprints.
3. `PRODUCT.md` — fatos do produto. Itens `[inferido]`/`[aberto]` **não viram afirmação na UI**.
4. `DESIGN.md` — tokens e componentes da identidade (amarelo `#F2C200`, preto `#0A0A0A`, papel `#F4F3EE`, Archivo).
5. `docs/maxpar-estudo.md` — como a Maxpar funciona e o que a oficina controla por fora.

## Estrutura (padrão da skill obsidian-codigo)
```
codigo/site/     landing (HTML estático; frames do filme em codigo/site/frames)
codigo/painel/   painel (Vite + React + TS + Tailwind v4 + Dexie; build → codigo/site/painel)
codigo/tools/    serve.mjs (servidor local), shot.mjs (captura via CDP), probe.mjs (JS em headless)
docs/            planos e estudos
notas/           mapa.md (histórico), status.md (checklist por componente), atualizacoes/
fotos/           fotos originais da oficina (não padrão, mantida por ser fonte)
media/           filme-fonte .mp4 (fora do git)
.claude/agents/  escrivao, revisor-qa, frontend-painel
```

## Comandos
```bash
node codigo/tools/serve.mjs codigo/site 8765      # landing em http://localhost:8765/
cd codigo/painel && npm run dev                    # painel em http://localhost:5173/ddoctor-site/painel/ (?dev=1 libera o PIN e carrega demo, só em dev)
cd codigo/painel && npm test && npm run build      # testes + build (sai em codigo/site/painel)
node codigo/tools/shot.mjs out.png URL 1440 900 9000   # captura headless
```
Deploy: push na `main` → workflow `.github/workflows/pages.yml` builda o painel e publica `codigo/site` em https://guirink.github.io/ddoctor-site/ (painel em `/painel/`).

## Regras do painel
- **Operate mode**: clareza, escaneabilidade e consistência acima de expressão. Nada de hero, nada de animação decorativa. Tabela/kanban/formulário bem resolvidos.
- Tokens só do `DESIGN.md`, expostos no Tailwind como `amarelo`, `preto`, `grafite`, `papel`, `tinta`, `linha`, `alerta`, `ok` (ex.: `bg-amarelo`, `text-tinta-suave`); utilitários `titulo-condensado`, `rotulo`, `faixa-zebrada`. Raio zero; amarelo para ação primária e estado, nunca como fundo de texto longo.
- Dados passam pela interface `Repositorio` (`codigo/painel/src/dados/repositorio.ts`). Hoje Dexie; Supabase depois. Componentes não falam com Dexie direto.
- Enum de etapas e nomes do domínio como em `docs/painel-plano.md` §4; rótulos em pt-BR centralizados em `src/dominio/rotulos.ts`.
- Dados demo sempre marcados `demo: true` e removíveis em um clique.
- Não inventar fatos da oficina (preços, prazos, seguradoras parceiras). Campo em aberto fica como placeholder claro.
- Regras de negócio (etapas, prazos, financeiro) em `src/dominio/` com teste Vitest.

## Como trabalhar (sprint em loop)
Cada sprint é um bloco demonstrável. Dentro do sprint, trabalhe em loop até o checklist fechar: implementar → `npm test` → `npm run build` → conferir no navegador → commit. No fim: `revisor-qa` no diff, corrigir, `escrivao` atualiza `notas/` e `Atualização noturna.md`, push, link para o irmão. Checkpoint do cliente entre sprints. Não pule para o próximo sprint sem o checkpoint, a menos que o Guilherme peça.

## Agentes
- `escrivao` — recebe resumos compactos e escreve `notas/mapa.md`, `notas/status.md`, `Atualização noturna.md` (anexando o anterior em `notas/atualizacoes/historico.md`). Nunca lê histórico bruto.
- `revisor-qa` — revisa o diff do sprint: bugs, regras de negócio, acessibilidade básica, build e testes. Devolve lista ordenada; não edita.
- `frontend-painel` — constrói telas do painel a partir de uma spec (tela, dados, estados vazio/erro/carregando) seguindo DESIGN.md e as regras acima.

## Observações do ambiente
- O cache do npm em `~/.npm/_cacache` tem arquivos sem permissão (EACCES). Instale com `npm_config_cache=/tmp/npm-cache npm install` ou corrija as permissões com `sudo chown -R $(id -u):$(id -g) ~/.npm`.

## Git
Commits em pt-BR, imperativo, com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Autor `guiRink <guirink7@gmail.com>`. Nunca commitar `media/`, `node_modules`, `codigo/site/painel/` (gerado no CI).
