# Atualização noturna — 21/10/2026

## Precisa de você
- [L45–L51] Nome "Atendimentos"; laranja a 80 % do prazo; "cliente não buscou" a 2 dias; vistoria vencendo a 2 dias; encaixe acima da capacidade com aviso; quadrados de dinheiro com a quantidade; "Avisar cliente" só no aparelho — confirmar (provisórios em uso)
- [L52–L55] Travar a entrega sem foto? Capacidade pesada pelo tamanho do serviço? Checklist "tudo ok" em um toque? Passar em lote as etapas de quem faltou?
- Mandar o link ao irmão (22/10); domínio (Cloudflare Pages) e conta Supabase do dono; instalar OrbStack — trava o Sprint 1
- [L09] Tipos de reparo e etapas — trava o Sprint 3 · [L34] CPF/CNPJ antes de o S1 criar a coluna

## Onde estamos
Fase 0 · Sprint SG — 12 de 12 itens (merge, tag e publicação em 21/10/2026) · Portões: G1 ❌ · G2 ❌ · G3 ❌ · G4 ❌

## O que mudou
- Revisão de produto (mecânico + especialista em sistemas, `docs/revisao-sg/`): Geral em 6 quadrados com as placas e gaveta com a lista, por papel; contagens únicas (Na oficina = 8 em todas as telas); semáforo a 80 % do prazo da etapa.
- Atendimentos (ex-Orçamentos) com busca, filtros e soma; Agenda de arrastar e soltar (desfazer, Mover para… no celular, Avisar cliente, Não veio); A receber por seguradora; menu por papel (11 itens para o dono); Estoque enxuto.
- Ficha com "Cliente deve" e entrega prometida; aviso antes de entregar. QA sem bloqueios; 5 importantes corrigidos. 436 testes no painel, 225 no compartilhado; lint 0 erros; build ok.

## Decisões que eu tomei sozinho (provisórias, a confirmar)
- Nome "Atendimentos"; laranja a 80 % (revisa a L11); cliente não buscou a 2 dias; vistoria a 2 dias — porquê: pontos de partida editáveis (L45–L48).
- Encaixe acima da capacidade permitido com aviso — porquê: a recepção precisa encaixar o urgente (L49).
- Quadrados de dinheiro mostram a quantidade; "Avisar cliente" só no aparelho — porquê: valor fica na lista; não há banco ainda (L50–L51).

## O que ficou pela metade
- Para o S1/banco: complemento por dano oculto, peça encomendada, glosa, mudança de prazo com motivo, decisão sobre item negado, retrabalho/garantia, carro reserva, vagas por turno, "Avisar cliente" no banco, `encaixe` na função do Supabase.

---
Detalhe completo: [[mapa]] · histórico: [[historico]]

---

# Atualização noturna — 20/10/2026

## Precisa de você
- [L39] Validade do orçamento (15 dias?) — fica fora do PDF até você confirmar (provisório em uso: 15 dias, oculto)
- [L40] Gestor também edita a capacidade (o pedido era "só o dono") — confirmar ou restringir (provisório em uso: gestor edita)
- [L41–L44] Recepção cria categoria de serviço; tema padrão automático; peças fora do cartão da TV; PDF de seguradora com o total autorizado — confirmar
- Mandar o link ao irmão (checkpoint); domínio (hospedagem Cloudflare Pages) e conta Supabase do dono; instalar OrbStack — trava o Sprint 1
- [L09] Tipos de reparo e etapas — trava o Sprint 3 · [L34] CPF/CNPJ antes de o S1 criar a coluna

## Onde estamos
Fase 0 · Sprint SF — 7 de 7 tarefas (merge e publicação em 20/10/2026) · Portões: G1 ❌ · G2 ❌ · G3 ❌ · G4 ❌

## O que mudou
- Pedidos do dono atendidos: modo escuro (Claro/Escuro/Automático), orçamento em PDF para compartilhar no WhatsApp, foto real ao concluir etapa e nas Vistorias, nova categoria de serviço com etapas, Agenda e capacidade editável em Ajustes.
- Produção e TV refeitas: todas as etapas na tela, Quadro/Lista, abas por etapa no celular, TV com cartões que se ajustam e paginação por coluna.
- QA sem bloqueios; 4 importantes corrigidos. 329 testes, lint 0 erros, build ok.

## Decisões que eu tomei sozinho (provisórias, a confirmar)
- Validade do orçamento de 15 dias fora do PDF — porquê: o prazo ainda não foi confirmado (L39).
- Gestor edita a capacidade — porquê: segui a matriz de permissões (L40).
- Recepção cria categoria; tema padrão automático; peças fora da TV; total autorizado no PDF de seguradora — porquê: ponto de partida editável (L41–L44).

## O que ficou pela metade
- Para o S1: permissões no banco para fotos, configuração e tipos de serviço (RLS + pgTAP); fotos no R2 (hoje ficam no aparelho, no demo).

---
Detalhe completo: [[mapa]] · histórico: [[historico]]

---

# Atualização noturna — 13/10/2026

## Precisa de você
- [L34] Guardar CPF/CNPJ do cliente? Conflita com o provisório "CPF não armazenado" (L19) — decidir antes de o Sprint 1 criar a coluna (provisório em uso: guardado e validado no demo)
- [L30] Capacidade de 10 peças/dia (veio do sistema do concorrente) — confirmar com o dono (provisório em uso: 10)
- [L35] O caixa do dia fechado pode ser reaberto? [L36] Valor da hora de mão de obra — trava o custo real da OS no Sprint 4
- [L09] Tipos de reparo e etapas — trava o Sprint 3 · [L18] Planilha financeira — trava o Sprint 4
- Mostrar o painel ao irmão (checkpoint), instalar Docker Desktop ou OrbStack, mandar o questionário ao dono (ainda sem as decisões L30–L36)

## Onde estamos
Fase 0 · Sprint SE — 13 de 13 tarefas (merge, tag e publicação aguardam o checkpoint) · Portões: G1 ❌ · G2 ❌ · G3 ❌ · G4 ❌

## O que mudou
- Visual clean em todas as telas (fundo claro, barra lateral clara, raio 8/6, amarelo só em ação, ativo, foco e "hoje"); placa Mercosul mantida, TV escura.
- Novo frente ao ERP do concorrente (`docs/concorrente-analise.md`): Clientes com CPF/CNPJ, Receber o carro em 4 passos com mapa de avarias, Ficha da OS com Custos, Resultado e Pagamentos, impressão A4, Estoque completo, caixa do dia, Relatórios, produção prevista.
- 295 testes, lint sem erros, build ok; QA em `docs/qa-sprintSE.md` com correções aplicadas; demo v3, tudo fictício.

## Decisões que eu tomei sozinho (provisórias, a confirmar)
- Capacidade de 10 peças/dia — porquê: valor visto no sistema do concorrente (L30).
- Checklist padrão de 21 itens, categorias financeiras de receita, estoque parado a partir de 90 dias — porquê: ponto de partida editável em Ajustes (L31–L33).
- Guardar CPF/CNPJ do cliente — porquê: o cadastro PF/PJ do concorrente exige; contradiz a L19 e pede decisão de LGPD (L34).

## O que ficou pela metade
- Para o S1: `listarProducao()` sem dados pessoais, custos fora da `OSVisao` e tabelas novas no banco (`custo_os`, `fornecedor`, `categoria_financeira`, `fechamento_caixa`, recepção/avarias, `baixa.parcelas`).
- Merge, tag `sprint-SE` e publicação; reabertura do caixa (L35) e hora de mão de obra (L36) indefinidos.

---
Detalhe completo: [[mapa]] · histórico: [[historico]]

---

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

---

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
