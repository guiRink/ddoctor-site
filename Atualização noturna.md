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
