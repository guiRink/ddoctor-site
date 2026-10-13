# Sprint SE — visual clean e o que faltava (vs. concorrente)

Branch `sprint/se-clean-concorrente`. Pedido do Guilherme em 13/10/2026: ver o ERP do concorrente, acrescentar o que esquecemos e deixar o painel "mais clean, profissional e bonito". Análise em `docs/concorrente-analise.md`.

## Checklist
- [x] Fundação visual clean (tokens, barra lateral clara, tipografia, componentes base, `docs/painel-design.md` revisão SE): `designer-painel`
- [x] Tipos e regras novas no compartilhado (cliente completo e documento, recepção com checklist e avarias, custos da OS e resultado, formas de pagamento, movimentos de estoque e custo médio, categorias, caixa, relatórios, produção prevista, auditoria): `dominio-regras`
- [x] Camada de dados: Repositorio, memória, demo e hooks para tudo acima: `frontend-painel`
- [x] Clientes e veículos (lista, ficha, cadastro completo)
- [x] Recepção do veículo na entrada (km, combustível, reclamação, checklist, mapa de avarias)
- [x] Ficha da OS: abas Recepção, Custos (insumos, mão de obra, terceiros), Resultado (restrito), Pagamentos; Imprimir orçamento
- [x] Estoque: entrada, retirada, movimentações, reposição, fornecedores, consumo por funcionário, exportar CSV
- [x] Financeiro: nova despesa, competência, fechamento de caixa; categorias em Ajustes
- [x] Relatórios (tela nova)
- [x] Geral: produção prevista contra a capacidade e calendário de entregas
- [x] Ajustes: categorias, itens do checklist, auditoria
- [x] Todas as telas no visual novo, com crítica do designer (390/1366/1920)
- [x] Revisão QA, notas (escrivão); merge, tag `sprint-SE` e publicação ficam para depois do checkpoint do Guilherme

Fechado em 13/10/2026: 295 testes, lint 0 erros, build ok, demo v3. QA em `docs/qa-sprintSE.md`. Fica para o S1: `listarProducao()` sem dados pessoais, custos fora da `OSVisao` e as tabelas novas no banco.
