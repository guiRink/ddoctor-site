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
