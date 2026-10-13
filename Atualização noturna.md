# Atualização noturna — 12/10/2026

## Precisa de você
- [L09] Tipos de reparo e etapas (questionário 1.1) — trava o Sprint 3 (provisório em uso: 4 tipos de `docs/painel-informacoes.md` §4)
- [L18] Planilha financeira atual (questionário 5.1) — trava o Sprint 4 (provisório em uso: campos de informações §3.8–3.9)
- Decidir se a produção pode "pegar" etapas livres na fila (`docs/qa-sprintSD.md` item 6)
- Instalar Docker Desktop ou OrbStack no Mac — pré-requisito do Sprint 1
- Mandar ao dono o link do painel (PIN 3316) e o questionário, e combinar o checkpoint das telas

## Onde estamos
Fase 0 · Sprint SD fechado (checklist completo) · Portões: G1 ❌ · G2 ❌ · G3 ❌ · G4 ❌

## O que mudou
- Plano de execução aprovado; novo sprint SD fechado antes do S1, com tag `sprint-SD`, mesclado na `main`.
- 14 telas navegáveis em memória (Geral até Ajustes, TV e celular) sobre domínio compartilhado com 133 testes e 21 carros fictícios; a placa Mercosul identifica cada carro.
- Revisão QA e crítica visual aplicadas (bug da OS devolvida à fila, protocolo duplicado e agenda em data passada corrigidos).
- Publicado em https://guirink.github.io/ddoctor-site/painel/; questionário do dono criado em `docs/questionario-dono.md`.

## Decisões que eu tomei sozinho (provisórias, a confirmar)
- Semáforo da OS só em "na oficina", com limiar absoluto de 8 h úteis — porquê: sem etapas confirmadas pelo dono (L09) não há limiar relativo.
- Bloqueio fica vermelho após 4 h úteis; feriados não contam — porquê: valores sugeridos da ficha (L10, L11).
- Mão de obra da Maxpar líquida da franquia — porquê: o estudo da Maxpar indica isso; questionário e domínio alinhados (L20), a confirmar com o dono.
- Os demais itens L01–L29 seguem com o valor sugerido do questionário (tabela em [[mapa]]).

## O que ficou pela metade
- Sem banco real, login individual nem fotos reais (S1/S3).
- Ações ainda sem suporte: ajustar prazo com motivo, reordenar prioridade, bloqueio de agenda, edição em Ajustes, compras de estoque, lançar despesa, exportar CSV.
- Próximo: checkpoint do dono sobre as telas, depois S1 (Supabase local, RLS, login por papel, `listarProducao`).

---
Detalhe completo: [[mapa]] · histórico: [[historico]]
