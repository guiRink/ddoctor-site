# Revisão SG — resposta do mecânico ao especialista de sistemas (rodada 2)

## 1. Onde ele acertou

- **Números que não batem matam a confiança.** "Na oficina" 8 contra 6, e três valores de "a receber" diferentes. É a primeira coisa a corrigir.
- **Quadrados com as placas dentro e uma gaveta ao clicar.** É exatamente o "em quadrados" que o Guilherme pediu.
- **"Resolver agora" com 5 linhas** (placa, problema, quem resolve). Uma lista só, no lugar de 7 grupos.
- **Laranja por percentual do prazo da etapa.** Chegamos à mesma conclusão por caminhos diferentes.
- **"Tempo na situação atual"** no lugar de "Idade", com o mais parado em cima.
- **Filtros de Orçamentos** (busca de placa na página, seguradora, valor e tempo) e a soma do filtro no rodapé.
- **Agenda com arrastar e Desfazer.** Deixar soltar acima da capacidade com aviso é certo: encaixe acontece todo dia.
- **"Avisar cliente" quando o carro movido já estava confirmado.** É assim que se faz no balcão.
- **Capacidade por turno** (manhã e tarde), não só por dia.
- **Impedido vence Atenção.** Uma pílula só.
- **"Guardada até", tirar "Aparelho", tirar os parágrafos explicativos.**
- **Novo atendimento começando pela placa.**

## 2. Onde ele exagerou para a realidade da oficina

- **Tirar Vistorias do menu.** Para o dono, tudo bem a foto morar na ficha. Mas a recepção fotografa o carro na porta, com o cliente esperando: ela digita a placa e fotografa. O funileiro tira a foto do "durante" no celular. **Eu faria assim:** fica no menu como "**Fotos**" para recepção e produção, e para o dono vira aba da ficha.
- **Juntar Recebíveis, Financeiro e Relatórios.** Concordo em levar os Relatórios para dentro do Financeiro. "A receber" tem de ser a **primeira aba** e ter link direto, porque quem cobra seguradora mexe nisso todo dia. A recepção não deve precisar do Financeiro: a franquia se cobra na **ficha**, e o Geral da recepção ganha o quadrado "Prontos — cobrar franquia".
- **"Atendimentos".** Serve, porque bate com o botão "Novo atendimento". Mas a recepcionista pensa "orçamento" enquanto o carro não entrou. Por isso "**Em orçamento**" tem de ser o primeiro filtro, bem visível. Se o dono estranhar, a alternativa é "Carros".
- **Menu de 9 itens.** Está bom para o dono. O que importa mesmo é o menu **por papel**:
  - **Recepção:** Geral · Atendimentos · Agenda · Fotos · Clientes · Produção (só ver).
  - **Funileiro, no celular:** Minhas tarefas · Quadro · Fotos. Hoje a barra do celular dele mostra **"Funcionários"**, e funileiro vendo o número do colega dá briga. Tirar.
  - **O que o funileiro procura e não acha:** "qual é o próximo carro que vem pra mim" e o quadro da oficina.
- **Planejamento só na Agenda.** Pode ir, desde que a Agenda mostre também as **saídas prometidas** da semana, não só as entradas. É a saída que diz se cabe mais carro.
- **"Maxpar segurando pagamento"** no Geral do financeiro. A Maxpar não segura nem paga nada; escreva "**Seguradora atrasou**". O mesmo erro está em Recebíveis.
- **Seleção múltipla com Shift/Cmd na Agenda.** Pode ter, mas a recepção vai usar a **caixinha**. Ela tem de estar sempre à vista no cartão, não só quando passa o mouse.
- **"Encerrado" virar "Pago e fechado".** Na oficina se fala "**Fechado**" ou "Faturado". Curto.

## 3. O que um viu e o outro não

**Eu vi e ele não:**
- **Recebíveis com "Pagador: Maxpar".** Quem paga é a HDI, a Liberty, a Tokio.
- **Aba Pagamentos mostrando "Total R$ 0,00"** com franquia de R$ 160 a cobrar.
- **Entrega sem foto de saída.** Achei um carro encerrado com 0 fotos de saída.
- **A entrega prometida ao cliente** tem de aparecer maior que o prazo da etapa, e mudar só com motivo.
- **"Pronto há X dias"**, para o cliente que não vem buscar.
- **Tamanho do serviço no cartão da agenda.** 4 martelinhos não pesam o mesmo que 4 pinturas.
- **Ocorrências que não existem no sistema:** peça encomendada, complemento por dano oculto, glosa, garantia e retrabalho por pessoa. Ficam para o próximo sprint, porque mexem no banco.

**Ele viu e eu não, e concordo:**
- "Saem hoje" e "Entregam hoje" são a mesma coisa com dois nomes.
- A ficha diz "1 de 3 etapas", mas a lista tem 4 linhas.
- O "Ver como" no topo é ferramenta de teste.
- Os botões Entrada, Retirada e Editar se repetem em cada linha do Estoque.
- O Estoque tem filtro que repete os números do topo.

## 4. Lista final para ESTE sprint (o que o dono vê amanhã)

1. **Geral em quadrados** com as placas dentro e gaveta ao clicar, "Resolver agora" (5 linhas) e Dinheiro só para o dono. Variante por papel (recepção sem dinheiro, com "Prontos — cobrar franquia").
2. **Uma contagem, um nome**: "Na oficina 8 (6 em serviço + 2 prontos)" e "Saem hoje" iguais no Geral, Produção, TV e Atendimentos. Nomes de dinheiro exatos.
3. **Semáforo**: laranja a partir de cerca de 75% do prazo da etapa, impedido vence atenção, e na TV "atrasado X dias" em vermelho.
4. **Atendimentos (ex-Orçamentos)**: busca de placa na página, filtros de situação, seguradora, valor e tempo, coluna "Há quanto tempo" na situação atual, o mais parado em cima, sem "atualiz. agora".
5. **Agenda**: arrastar entre dias e turnos com Desfazer, vários de uma vez pela caixinha, cartões que encolhem quando o dia enche, "Avisar cliente" quando mudou um confirmado e vagas por turno.
6. **Recebíveis**: o pagador é a seguradora, não a Maxpar, com filtro por seguradora. "A receber" vira a primeira aba do Financeiro.
7. **Ficha, aba Pagamentos**: "Cliente deve: franquia R$ X" desde a entrada. "Registrar entrega" avisa quando falta franquia paga ou foto de saída.
8. **Entrega prometida em destaque** na ficha e no cartão da Produção, com "alterar" que pede motivo.
9. **Celular do funileiro**: cartão "Funilaria · serviço: Pintura" e barra do celular Minhas tarefas · Quadro · Fotos, sem Funcionários.
10. **Menu por papel**: Relatórios dentro do Financeiro, Quadro da TV como botão na Produção, Minhas tarefas só para a produção, Vistorias vira "Fotos" para recepção e produção, "Ver como" no menu do usuário.
11. **Palavras e ruído**: "Guardada até", sem "Aparelho", sem parágrafos explicativos, origem e data só ao passar o mouse, "provisório" num canto só, "Fechado" no lugar de "Encerrado", e a ficha com "2 de 3 (1 dispensada)".
12. **Novo atendimento começa pela placa** e puxa carro e cliente que já vieram antes.
