# Revisão SG — sistemas, rodada 2 (resposta ao mecânico)

## 1. Onde ele acertou (muda minha proposta)

- **6 quadrados, não 8.** "Prontos" vira linha dentro de "Na oficina"; "Sem autorização" entra em "Esperando seguradora"; Maxpar, vistoria e horário proposto vão para "Para fazer hoje", com quem faz.
- **Semáforo por prazo:** laranja com 80 % do prazo da etapa ou entrega amanhã.
- **"Pagador: Maxpar" está errado:** quem paga é a seguradora (coluna e filtro).
- **Ruído:** "provisório" discreto, "demonstração" num selo só, proveniência no hover.
- **Ficha da OS:** "Cliente deve: franquia", Resultado "parcial", "Prometido ao cliente", aviso na entrega.
- **Estoque** abre em "Acabando" e "Lista de compra". **Relatórios** deixa de repetir o Financeiro.
- **Glosa, complemento, peça encomendada, prazo com motivo, decisão do item negado:** certos, mas precisam de banco, então ficam para depois.

## 2. Onde discordo

- **"Na oficina", não "No pátio":** é o nome do estado, da Produção e da TV. O que importa é o número bater ("6 em serviço · 2 prontos").
- **"Provisório" não some:** o `CLAUDE.md` exige; fica pontilhado com dica e uma lista em Ajustes → "A confirmar". Tirar de vez é decisão do dono.
- **Estoque:** Movimentações e Fornecedores ficam (o custo médio alimenta os Custos da OS); só saem da vista padrão.
- **Custos + Resultado** valem também para o financeiro, não só para o dono.
- **Vistorias fica no menu:** retiro minha ideia de fundir na ficha.
- **Entrega sem foto de saída:** avisa, não trava (travar é decisão do dono). Capacidade pesada pelo tamanho do serviço também é decisão do dono.

## 3. Proposta final para este sprint

### Geral definitivo, 1366 (dono)

```
Quarta, 21 de outubro · Bom dia, Carlos                     Maxpar: 20/10 19:34
┌ Na oficina      8 ─────┐┌ Entram hoje     1 ─────┐┌ Saem hoje       3 ─────┐
│ 6 em serviço · 2 prontos││ tarde 1 · chegou 0     ││ 1 pronto · 2 em serviço│
│ [RKP1L34][RTB2E90]      ││ [RTO9H02] tarde        ││ [RFG5N90] pronto       │
│ [RAV3K61][QPZ6M77] +4   ││                        ││ [QPZ6M77][SCH4A22]     │
└─────────────────────────┘└────────────────────────┘└────────────────────────┘
┌ Parados e atrasados 2 ──┐┌ Esperando seguradora 2 ┐┌ Dinheiro vencido ──────┐
│ [RKP1L34] atrasado 1 d  ││ mais antigo há 6 d     ││ R$ 1.560 · 2 títulos   │
│ [RTB2E90] peça segurado ││ [RHK2C47][SDF1G39]     ││ Liberty · cliente      │
└─────────────────────────┘└────────────────────────┘└────────────────────────┘
Para fazer hoje                                                    Ver todos (7)
 [SJQ7R03] Reenviar documentação no portal Maxpar · há 4 d       Recepção [Abrir]
 [RHK2C47] Vistoria vence amanhã                                  Recepção [Abrir]
 [RNA4S66] Horário proposto expira 03:04                          Recepção [Agenda]
 [SAE5P73] Ligar para agendar · aprovado há 1 d                   Recepção [Agenda]
```

### Geral definitivo, 390

```
Quarta, 21/10
┌ Na oficina  8 ┐┌ Entram hoje 1 ┐
│ 6 serv · 2 pr ││ [RTO9H02]     │
│ [RKP1L34] +7  ││               │
└───────────────┘└───────────────┘
┌ Saem hoje   3 ┐┌ Parados     2 ┐
┌ Seguradora  2 ┐┌ Vencido R$1,5m┐
Para fazer hoje (4 linhas + Ver todos)
```

Tocar num quadrado abre a lista em tela cheia. No computador, a lista abre numa gaveta à direita.

### Regras de cada quadrado

| Quadrado | O que conta | Ao clicar, a lista mostra |
| --- | --- | --- |
| Na oficina | OS `na_oficina` + `pronta` | placa, modelo, etapa ou "pronto há X d", responsável, entrega prometida, semáforo; atrasados no topo; pronto há 2 d ou mais com "cliente não buscou" |
| Entram hoje | agendamentos de hoje ainda não recebidos | turno, cliente, telefone, confirmado ou não; botões "Registrar entrada" e "Não veio" |
| Saem hoje | entrega prometida hoje | etapa e o que falta, franquia a cobrar; "Registrar entrega" se estiver pronto; o que não está pronto aparece em laranja |
| Parados e atrasados | impedidos + etapa atrasada + entrega vencida | motivo, há quanto tempo, quem resolve |
| Esperando seguradora | OS de seguradora aguardando aprovação | seguradora, protocolo, há X dias, valor orçado |
| Dinheiro vencido | títulos vencidos | quem deve (seguradora ou cliente), valor, dias de atraso; leva a A receber |

O quadrado fica em `alerta` só quando é problema e o número é maior que 0. Quadrado com 0 aparece cinza com "Nada aqui".

**Variações por papel**
- **Recepção:** "Dinheiro vencido" é trocado por "Para agendar" (fila com telefone e "Copiar mensagem").
- **Financeiro:** Vencido · Vence em 7 dias · Franquia a cobrar · A pagar em 7 dias · Recebido no mês.
- **Produção:** entra direto em Minhas tarefas.

### Menu final

Minhas tarefas fica só no menu da produção. Quadro da TV vira botão na Produção. "Ver como" vai para o menu do usuário.

```
Operação:  Geral · Atendimentos* · Agenda · Produção · Vistorias · Clientes
Dinheiro:  A receber · Financeiro (abas: Resumo · Despesas · Caixa do dia · Relatórios)
Gestão:    Equipe · Estoque · Ajustes
```

\* "Atendimentos" depende de o dono aprovar o nome amanhã.

### Este sprint (12 itens)

| # | Item | Tela / arquivo | Pronto quando |
| --- | --- | --- | --- |
| 1 | Geral novo | `telas/Geral.tsx`, `componentes/geral/QuadroCarros.tsx`, `GavetaLista.tsx` | 6 quadrados por papel; cada número abre a lista com o mesmo total; capturas 390/1366/1920 aprovadas pelo `designer-painel` |
| 2 | Contagens únicas | `componentes/geral/selecoes.ts` usado por Produção, TV e Orçamentos | "Na oficina" = 8 em todas as telas; "Saem hoje" em todo lugar; teste Vitest |
| 3 | Semáforo pelo prazo | `compartilhado/src/dominio/semaforo.ts` | laranja com 80 % do prazo ou entrega amanhã; testes; na demo, no máximo 2 de 7 cartões laranja |
| 4 | Horários legíveis | `componentes/producao/`, `ProducaoTV.tsx` | "hoje 16h" e "amanhã" no lugar de "até 04:04"; TV mostra "atrasado 1 dia" em vermelho |
| 5 | A receber por seguradora | `telas/Recebiveis.tsx` | coluna e filtro mostram a seguradora do atendimento; menu "A receber" |
| 6 | Minhas tarefas | `telas/MinhasTarefas.tsx` | pílula única (impedido vence); "Serviço: Pintura"; foto obrigatória com `capture="environment"` |
| 7 | Ficha da OS | `telas/FichaOS.tsx` | "Cliente deve: franquia" desde a entrada; Resultado "parcial"; "Prometido ao cliente" no topo; "2 de 3 (1 dispensada)" |
| 8 | Aviso na entrega | ação "Registrar entrega" | avisa sobre franquia ou complemento não pagos e sobre 0 fotos de saída; deixa seguir |
| 9 | Ruído fora | Layout, Agenda, Orçamentos, Vistorias, Funcionários, Recebíveis, Ajustes | provisório pontilhado; selo único de demonstração; "Guardada até"; sem "Aparelho", sem "atualiz.", sem parágrafos explicativos |
| 10 | Menu final | `componentes/Layout.tsx` (`MENU`) | 11 itens para o dono; TV e Ver como fora do menu |
| 11 | Estoque enxuto | `telas/Estoque.tsx` | abre em "Acabando"; aba "Lista de compra"; só 2 números no topo, que funcionam como filtro; ações no "⋯" |
| 12 | Relatórios úteis | `telas/Relatorios.tsx` vira aba do Financeiro | sem os 3 números repetidos; entregues, faturado por seguradora, tempo médio de pátio, negados por seguradora |

### Depois (banco/S1 ou decisão do dono)

- **Precisa de banco** (`arquiteto-dados`): complemento ou dano oculto ("esperando complemento", que depois entra em "Esperando seguradora"), peça encomendada com previsão, glosa na baixa, mudança de prazo com motivo, decisão do cliente sobre item negado, retrabalho e garantia com OS ligada, retrabalho por pessoa em Equipe, carro reserva.
- **Precisa do dono:** nome "Atendimentos"; travar a entrega sem fotos; capacidade pesada pelo tamanho do serviço; confirmar os 80 %; checklist "tudo ok" em um toque; passar em lote as etapas de quem faltou.

### Ajustes para os agentes que já estão trabalhando

- **Orçamentos:**
  - deixar o nome da tela num só lugar em `rotulos.ts`, para que "Atendimentos" seja uma linha;
  - "Tempo" contado desde a **última mudança de estado**, com o mais parado em cima por padrão;
  - Peças escritas como "1 de 2 autorizadas";
  - filtro por **seguradora** (não por "Maxpar");
  - sem "atualiz. agora".
- **Agenda:**
  - cartão com o tamanho do serviço ("2 peças · martelinho");
  - botão "Não veio" no cartão do dia;
  - tirar "(provisório — a confirmar)" do título;
  - vagas por turno no cabeçalho do dia;
  - ao mover um carro confirmado, o cartão passa a "Avisar cliente".
