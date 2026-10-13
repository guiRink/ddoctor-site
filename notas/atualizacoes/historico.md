# Atualização noturna — 2026-10-06

> Varredura automática do vault. Primeira vez que esta pasta entra na varredura (não existia em 31/08). Tipo `codigo` inferido — o CLAUDE.md não tem o marcador `tipo:`.

## Precisa de você
- Agendar com o dono o portão G1 (inspeção da conta Maxpar) e as decisões abertas 1–7: se uma OS nasce na aprovação, no agendamento ou na entrada; etapas e limiares de prazo; capacidade por dia; campos da planilha financeira. Sem isso o Sprint 1 da arquitetura codifica regras sobre suposição (`notas/mapa.md`, `docs/espec-dono-v1.md` §11).
- Confirmar se Porto/Azul chegam pela Carglass e não pela Maxpar; segue em aberto (`notas/mapa.md`).
- Mandar ao irmão o link do painel demo e pedir prints, planilha atual e prazo real de pagamento da Maxpar (já pedido em 02/10; sem sinal de resposta nos arquivos).

## O que mudou
- GusPainel é o projeto da oficina D doctor (martelinho de ouro, Curitiba): landing page publicada e painel de gestão em construção (`CLAUDE.md`).
- Tudo no repositório é de 02/10 (11 commits, nenhum depois): landing com filme scroll-driven e depois o Sprint 0 do painel.
- Último commit: especificação do dono (`docs/espec-dono-v1.md`), arquitetura técnica v2 (`docs/painel-arquitetura.md`) e achados da QA (`docs/qa-sprint0.md`).
- Próximo passo registrado: quitar a dívida da QA (B1 a B3) e iniciar o Sprint 1 da arquitetura no VS Code (`notas/mapa.md`).

## Decisões registradas nos arquivos
- Sprints curtos em loop, com checkpoint do irmão entre eles — porquê: muitos fatos da operação ainda são suposição (`notas/mapa.md`).
- Dexie atrás da interface `Repositorio`; Supabase só depois — porquê: demo imediata sem conta em serviço nenhum (`notas/mapa.md`).
- Sem integração com a Maxpar na V1; entrada manual/colar texto e ações no portal viram pendências humanas — porquê: não há API pública confirmada (`notas/mapa.md`, `docs/espec-dono-v1.md` §1).
- PIN local nos Sprints 0–3 — porquê: evitar tela errada em demonstração (`notas/mapa.md`).

## O que ficou pela metade
- Dívida da QA do Sprint 0: 3 itens que bloqueiam (overflow no celular, placa com 8+ caracteres, recusa no mesmo dia), 8 materiais, 8 menores; nada corrigido (`docs/qa-sprint0.md`).
- `docs/painel-plano.md` desatualizado nos sprints; a arquitetura substitui a seção 5 (`notas/mapa.md`).
- `notas/status.md` está defasado em relação ao mapa: marca shell, dados demo e PIN como pendentes, mas o mapa diz Sprint 0 fechado e publicado.
- Landing: endereço completo, horário e logo vetorial seguem como placeholders (`docs/landing-page.md`).

## Cobertura desta varredura
- 11 commits, 19 arquivos .md alterados; lidos integralmente: `notas/mapa.md`, `notas/status.md`, `Atualização noturna.md` (02/10), `notas/atualizacoes/historico.md`, `docs/qa-sprint0.md`, `docs/espec-dono-v1.md`, `docs/landing-page.md`, `CLAUDE.md` (60 linhas). Não lidos (longos/gerados): `docs/painel-arquitetura.md`, `docs/maxpar-estudo.md`, `docs/painel-plano.md`, `DESIGN.md`, `PRODUCT.md`.

---
Detalhe completo: [[mapa]] · histórico: [[historico]]

---

# Atualização noturna — 02/10/2026

## Precisa de você
- Mandar ao seu irmão o link do painel com dados demo (https://guirink.github.io/ddoctor-site/painel/, PIN 3316) e pedir: prints da Área do Credenciado / Portal do Prestador, a planilha atual (abas e colunas), prazo real de pagamento da Maxpar e quais seguradoras chegam via Maxpar. Sem isso o Sprint 1 vai no escuro em peças, status e documentação.
- Confirmar se Porto Seguro/Azul chegam pela Carglass (outro sistema) e não pela Maxpar — muda se o painel precisa de uma segunda origem.
- Conta Supabase: só é necessária no Sprint 4; não precisa criar agora.

## O que mudou
- A landing está aprovada e publicada; o scroll do filme ficou fluido, com encaixe nos takes e entrega ao scroll normal no fim.
- O estudo da Maxpar mudou o enquadramento: ela é gestora de assistências (martelinho, SRA, pintura, funilaria com teto de mão de obra e franquia paga na oficina), não plataforma de orçamento de sinistro.
- O painel nasceu: plano em cinco sprints, estrutura padrão do projeto, CLAUDE.md, três agentes e um app funcionando com 12 carros fictícios em Pátio, Atendimentos, Ficha, Agenda, Pendências e Financeiro.
- Tudo publicado no mesmo link da landing, em /painel/, protegido por PIN provisório.

## Decisões que eu tomei sozinho
- Sprints curtos rodados em loop, com checkpoint seu/do seu irmão entre eles — porquê: muitos fatos da operação ainda são suposição.
- Dados guardados no navegador (IndexedDB) até o Sprint 4; Supabase depois — porquê: demo imediata sem conta em serviço nenhum; a troca fica isolada numa camada.
- Regras de pendência com limites provisórios (3 dias sem autorização, aviso 2 dias antes da vistoria vencer, 30 dias para pagamento) — porquê: valores do estudo público; ajustar com a oficina.
- Incluí "Sinistros e seguradoras" como frente na landing — porquê: a oficina atende via Maxpar; está marcado como inferido para confirmar.

## O que ficou pela metade
- Sprint 0 fechado; Sprint 1 (cadastro/edição da ficha, mover carros no pátio, entrada rápida) não começou.
- Revisão de qualidade (revisor-qa) do Sprint 0 em andamento; achados materiais entram antes do Sprint 1.
- Landing: endereço completo, horário e logo vetorial seguem como placeholders.

---
Detalhe completo: [[mapa]] · histórico: [[historico]]

---
# Histórico das atualizações noturnas

(As atualizações anteriores são anexadas aqui, mais recente primeiro, antes de cada sobrescrita de `Atualização noturna.md`.)
