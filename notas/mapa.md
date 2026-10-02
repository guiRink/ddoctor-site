# GusPainel (D doctor) — mapa

## Estado atual (sempre atualizado, sempre curto)
- Onde está: landing publicada e aprovada. Painel com Sprint 0 fechado e publicado em https://guirink.github.io/ddoctor-site/painel/ (PIN 3316). O dono entregou a especificação V1 (`docs/espec-dono-v1.md`) e a arquitetura técnica derivada está em `docs/painel-arquitetura.md` (12 seções: componentes, origens, destinos, superfícies, modelo v2, máquinas de estado, integrações, segurança, sprints 1–8 com portões G1–G4, decisões e riscos).
- Próximo passo (sessão no VS Code): 1) quitar a dívida da QA do Sprint 0 em `docs/qa-sprint0.md` (B1 overflow mobile, B2 placa, B3 recusa no mesmo dia primeiro); 2) iniciar o Sprint 1 da arquitetura (domínio v2 em `codigo/compartilhado/`, migrations Supabase locais, Repositorio v2, hooks via Repositorio, login). Em paralelo, agendar com o dono o portão G1 (inspeção da conta Maxpar) e as decisões 2–6 da seção 11 da arquitetura.
- Atenção: `docs/painel-plano.md` ficou desatualizado nos sprints (a arquitetura substitui a seção 5 dele); stack e modelo v1 continuam válidos como histórico.
- Bloqueios em aberto: conta Supabase (necessária só no Sprint 4); endereço completo e horário da oficina para a landing; confirmar se Porto/Azul chegam via Carglass e não via Maxpar.

---

## Histórico (mais recente primeiro)

### 02/10/2026 Sprint 0 — Fundação do painel (em andamento)
**Decisões tomadas:**
- Método: sprints curtos, cada um rodado em loop autônomo até fechar o checklist, com checkpoint do irmão entre sprints — porquê: muitos fatos da operação ainda estão em aberto; validar cedo evita construir sobre suposição, e o loop dentro do sprint evita micro-gerência.
- Stack: Vite + React 19 + TypeScript + Tailwind v4, HashRouter, Dexie (IndexedDB) atrás de uma interface `Repositorio`; Supabase só no Sprint 4 — porquê: funciona hoje sem conta em serviço nenhum e permite demo imediata; a troca de backend fica isolada numa camada.
- Deploy do painel no mesmo GitHub Pages da landing, em `/painel/`, com build no workflow — porquê: um link só para o cliente, custo zero.
- Estrutura do repositório migrada para o padrão da skill obsidian-codigo (`codigo/`, `notas/`, `docs/`) — porquê: padronizar com os outros projetos; `fotos/` e `media/` ficam fora do padrão por serem fonte bruta.
- Acesso ao painel nos Sprints 0–3 por PIN local — porquê: evitar tela errada em demonstração; login real vem com o Supabase.

**O que foi implementado:**
- Estudo da Maxpar (`docs/maxpar-estudo.md`): a Maxpar é a gestora de assistências do Grupo Autoglass, não plataforma de orçamento de sinistro; fluxo da oficina reconstruído; dores e lista priorizada do painel.
- Plano do painel (`docs/painel-plano.md`): método, stack, modelo de dados v1, cinco sprints.
- `CLAUDE.md`, agentes `escrivao`, `revisor-qa`, `frontend-painel`.
- Scaffold do app em `codigo/painel/`.

**O que ficou de fora (de propósito):**
- Integração com a Maxpar — porquê: não existe API pública; entrada será manual/colar texto.
- Orçamentação de sinistro de casco (Audatex/Cilia) — porquê: outro fluxo, sem evidência de uso pela oficina.

**Arquivos relevantes:**
- `docs/painel-plano.md`, `docs/maxpar-estudo.md`, `CLAUDE.md`, `.claude/agents/`, `codigo/painel/`

### 02/10/2026 Landing page — construída, revisada e publicada
**Decisões tomadas:**
- Filme da oficina gerado no Higgsfield (Kling 3.0) a partir das fotos reais, 6 clipes de 5 s, controlado pelo scroll — porquê: pedido do Guilherme ("vídeo que anda com o scroll") sem gastar com filmagem.
- Direção visual: a sinalização física da oficina (placa preta, D amarelo, piso zebrado) como interface — porquê: identidade já existe no lugar; não inventar uma nova.
- Scroll da sequência como um único movimento com inércia que encaixa no próximo take ao soltar, parando em quadros inteiros escolhidos por nitidez — porquê: três rodadas de feedback do Guilherme (travado → fluido → sem borrão → sem travar no fim).
- Repositório público `guiRink/ddoctor-site` com GitHub Pages — porquê: link imediato para o irmão.

**O que foi implementado:**
- `codigo/site/index.html` completo (hero, 6 capítulos, serviços, frase do Senna, fotos, contato), 240 quadros WebP desktop e mobile, fontes self-hosted, revisão impeccable com veredito "ship", `DESIGN.md`.

**O que ficou de fora (de propósito):**
- Endereço completo, horário e logo vetorial oficial — porquê: não confirmados pelo cliente; placeholders claros na página.

**Arquivos relevantes:**
- `codigo/site/index.html`, `codigo/site/frames/`, `DESIGN.md`, `PRODUCT.md`, `docs/landing-page.md`, `.github/workflows/pages.yml`
