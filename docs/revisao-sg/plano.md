# Sprint SG: plano fechado depois da conversa entre o mecânico e o especialista em sistemas (21/10/2026)

A conversa está em `mecanico-r1.md`, `sistemas-r1.md`, `mecanico-r2.md` e `sistemas-r2.md`. O pedido do Guilherme está em `pedido.md`.

## Princípios

- **Todo número abre a própria lista.** Não pode haver número sem os carros por trás.
- **Uma contagem e um nome para cada coisa, em todas as telas.** "Na oficina" é o mesmo número no Geral, na Produção, na TV e em Atendimentos. "Saem hoje" é o nome em todo lugar.
- **Palavras da oficina, não de sistema.** Por exemplo: "há 3 dias", "Fechado", "Guardada até". Quem paga é a seguradora (HDI, Liberty…), nunca "Maxpar".
- **Uma ação amarela por tela.** Os parágrafos de explicação saem.
- **"Provisório" fica discreto:** sublinhado pontilhado com dica, e a lista do que falta confirmar fica em Ajustes. "Demonstração" vira um selo único.

## Este sprint (vai ao dono)

| # | Item | Pronto quando |
| --- | --- | --- |
| 1 | **Geral em 6 quadrados com as placas dentro.** Os quadrados são Na oficina, Entram hoje, Saem hoje, Parados e atrasados, Esperando seguradora e Dinheiro vencido. Embaixo vem "Para fazer hoje", com quem faz. Clicar no quadrado abre a lista dos carros numa gaveta (no celular, em tela cheia). Varia por papel: a recepção vê "Para agendar" no lugar do dinheiro; o financeiro vê os quadrados de dinheiro; a produção cai em Minhas tarefas. | Cada número abre uma lista com o mesmo total; capturas em 390, 1366 e 1920 |
| 2 | **Contagens únicas** num módulo só (`src/dominio/contagens.ts`), usado pelo Geral, pela Produção, pela TV e por Atendimentos | 8 = 8 em todas as telas; testes |
| 3 | **Semáforo pelo prazo da etapa.** Laranja a partir de 80 % do prazo ou com a entrega amanhã. Impedido vence atenção, e só uma pílula aparece. | Na demonstração, no máximo 2 de 7 carros laranja; testes |
| 4 | **Horários legíveis** ("hoje 16h", "amanhã", "atrasado 1 dia") na Produção, na TV e em Minhas tarefas | Nenhum "até 04:04" |
| 5 | **Atendimentos** (antiga Orçamentos): busca na página; filtros de situação, seguradora, valor e tempo; "Há quanto tempo" na situação atual, com o mais parado em cima; "1 de 2 autorizadas"; soma no rodapé | Filtros na URL; testes |
| 6 | **Agenda de arrastar e soltar.** Um carro ou vários, pela caixinha. Desfazer. Cartões encolhem quando o dia enche. Vagas por turno. "Avisar cliente" ao mover um carro confirmado. Tamanho do serviço no cartão. "Não veio". | Arrastar testado; no celular, "Mover para…" |
| 7 | **A receber por seguradora.** O pagador é a seguradora, e o menu ganha "A receber". | Nenhum "Pagador: Maxpar" |
| 8 | **Ficha da OS.** Ganha "Cliente deve: franquia" desde a entrada, "Prometido ao cliente" no topo, o Resultado como "parcial" e "2 de 3 (1 dispensada)". | Capturas |
| 9 | **Aviso na entrega** quando a franquia ou o complemento não foram pagos ou não há foto de saída. Avisa e deixa seguir. | Aviso aparece no caso da demonstração |
| 10 | **Menu por papel.** Dono: Geral · Atendimentos · Agenda · Produção · Vistorias · Clientes · A receber · Financeiro (abas Resumo, Despesas, Caixa do dia, Relatórios) · Equipe · Estoque · Ajustes. O Quadro da TV vira botão na Produção. Minhas tarefas fica só para a produção, que não vê Funcionários/Equipe. "Ver como" vai para o menu do usuário. | Menu de 11 itens para o dono |
| 11 | **Estoque enxuto.** Abre em "Acabando", ganha a aba "Lista de compra", mostra 2 números no topo que servem de filtro, e as ações ficam no "⋯". | Capturas |
| 12 | **Ruído fora.** "Guardada até", sem "Aparelho", sem "atualiz.", sem parágrafos explicativos, "Fechado" no lugar de "Encerrado". | Varredura |

## Depois (precisa de banco no S1 ou de decisão do dono)

- **Precisa de banco:** complemento por dano oculto, peça encomendada com data prevista, glosa na baixa, mudança de prazo com motivo, decisão do cliente sobre item negado, retrabalho e garantia ligados à OS, carro reserva.
- **Precisa do dono:**
  - o nome "Atendimentos";
  - travar a entrega sem foto;
  - capacidade pesada pelo tamanho do serviço;
  - os 80 % do semáforo;
  - checklist "tudo ok" em um toque;
  - passar em lote as etapas de quem faltou.
