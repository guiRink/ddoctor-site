# Revisão QA do sprint SE (visual clean e o que faltava)

Data: 13/10/2026. Revisor: agente `revisor-qa` sobre `main...sprint/se-clean-concorrente`. Nada bloqueava. Verificações finais: tsc, vitest (295 testes), lint (0 erros) e build, todos verdes. Nenhum dado real no repositório e nada do sistema concorrente no código.

## Corrigido no próprio sprint

| # | Achado | Correção |
| --- | --- | --- |
| 1 | O financeiro conseguia retirar material e lançar custo na OS (ver ≠ editar) | Insumos só com `veCustosOS` + editar estoque; mão de obra e terceiros só com `veCustosOS` + editar orçamentos |
| 2 | Relatórios e o Resultado da OS calculavam a receita de jeitos diferentes | `receitaOS({versoes, titulos})` única no domínio, usada no Resultado, nos Relatórios e na impressão |
| 3 | Caixa fechado aceitava lançamento em dinheiro na mesma data | `checarCaixaAberto`: pagamento, baixa, despesa e pagar despesa recusam `caixa_ja_fechado` |
| 4 | WhatsApp do demo abria conversa com números que podem existir | Cliente e fornecedor do demo marcados `demo`; sem `wa.me`/`tel:` para eles (`contatoClicavel`) |
| 6 | Devolver insumo apagava a retirada | Devolução vira ajuste "mais" ligado à OS; a saída original fica no extrato |
| 7 | Pagamento depois de quitada criava outro título | `os_quitada`; a aba Pagamentos mostra "Quitada" |
| 8 | Total pago do cliente somava o que a seguradora pagou | Só títulos de pagador `cliente` |
| 9 | Listas fora de ordem por misturar UTC e -03:00 | Marcos gravados sempre com -03:00 e ordenação pelo instante real |
| 10 | Edição apagava a data original da recepção; dava para editar após a entrega | Guarda registrada e atualizada; `os_fechada` depois da entrega |
| 11 | Datas não validadas no repositório | `data_invalida` e `data_futura` |
| 12 | "1.000" era lido como 1 | `lerNumero` com testes |
| 13 | Documento já cadastrado descartava nome e telefone digitados sem aviso | Aviso "Usar <cliente>" antes de salvar |
| 14 | Produção prevista contava peças já feitas | Conta só as peças restantes |
| 15–20 | Auditoria com texto absoluto; títulos cancelados nas somas; mão de obra R$ 0; `ocupado` da Agenda; "Receber o carro" na recepção adiantada | Corrigidos |

## Ainda aberto

| # | Achado | Onde fecha |
| --- | --- | --- |
| 5 | `OSVisao` traz custos e dados pessoais do cliente para todos os papéis (a tela esconde; no S1 a RLS precisa de uma visão reduzida) | **S1**: `listarProducao()` sem dados pessoais e custos só por `listarCustosOS` |
| — | Não existe reabrir caixa | Decidir com o dono se é preciso |
| — | CPF/CNPJ do cliente agora é guardado; o provisório da NF dizia "CPF não armazenado" | **Decisão do dono** (LGPD) |
| — | Capacidade de 10 peças por dia, checklist padrão e categorias de receita são provisórios | Questionário do dono |
| — | O banco ainda não tem `custo_os`, `fornecedor`, `categoria_financeira`, `fechamento_caixa`, recepção/avarias nem `baixa.parcelas`; `movimento_estoque.tipo` mudou | **S1**: `arquiteto-dados` |
| — | Bundle de 912 kB | Separar rotas em chunks (S2) |
