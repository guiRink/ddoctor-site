# Sprint SH — pedidos do dono em dois áudios (22/10/2026)

Branch `sprint/sh-pedidos-audio`. Origem: dois áudios do dono transcritos pelo Guilherme (`docs/revisao-sh/pedido-dono.md` e `docs/revisao-sh/pedido-dono-2.md`).

## Checklist
### 1º áudio — Geral e menu
- [x] Geral só com números: Na oficina · Entram hoje · Saem hoje; Atrasados e Parados separados, grandes, verdes em zero; Aguardando aprovação · Aguardando seguradora · Aguardando agendamento · Dinheiro vencido; clique abre as placas
- [x] Quadrados brancos
- [x] Menu lateral amarelo, com logo e barra de busca pretos (também no celular)
- [x] "Atendimentos" volta a ser "Orçamentos"
- [x] Situações "Aguardando aprovação" e "Aguardando agendamento"; "Impedido" vira "Parado"/"Parada" em todo lugar
- [x] QA do 1º áudio: nada bloqueava; acertos aplicados

### 2º áudio — cor do carro
- [x] Regra `corDoCarro`: vermelho piscando = passou da entrega; vermelho = entrega em até 1 dia útil e nenhuma etapa concluída; laranja = entrega em até 1 dia útil com etapa concluída; verde = resto
- [x] Ajustes → Cores dos carros (piscar liga/desliga, prazo padrão 10 dias úteis, base editável)
- [x] Ajuste por carro na ficha ("Ajustar prazo": urgente, prazo em dias úteis, dias antes para laranja/vermelho) e no Receber o carro
- [x] TV em mosaico (placa e etapa pintadas pela cor, piores primeiro, 30 por tela, contagem por cor e legenda; visão por etapas em `?visao=etapas`)
- [x] Produção com a cor no cartão e filtros por cor
- [x] Lembrete "cobrar franquia" para a recepção em Para fazer hoje
- [x] Demo com 11 carros na oficina (3 novos para mostrar as cores)
- [x] 488 testes; lint 0 erros; build ok
- [x] Merge, tag `sprint-SH` e publicação em 22/10/2026 (feito pelo Guilherme)

## Fica para depois
Feriados nos dias úteis da cor (hoje não contam); itens do S1/banco e do dono (L52–L55) herdados do SG.
