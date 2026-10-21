# Revisão SG — visão de sistemas e produto (rodada 1)

21/10/2026. Base: capturas reais do painel em 1366, 390 e 1920 (dono, recepção, produção e financeiro), a leitura de `pedido.md`, `docs/painel-design.md`, `docs/concorrente-analise.md` e o código de `codigo/painel/src/telas/`. Referências: Linear, Stripe Dashboard, Shopmonkey, Tekmetric.

## 1. Diagnóstico geral

**O visual está bom. O que falha é a organização.** Os tokens clean, a `Placa` e as pílulas funcionam. O painel parece confuso por quatro motivos.

1. **Telas demais que mostram os mesmos carros.** O dono tem 14 itens no menu. O mesmo carro aparece no Geral (em 7 grupos), em Orçamentos (8 abas), na Produção, na Agenda, em Vistorias e em Recebíveis, sempre com um recorte diferente e sem dizer qual tela é a "casa" do carro.
2. **Os números não batem entre telas.** Isso destrói a confiança no painel.
   - "Na oficina": **8** no Geral, **6** na Produção, na TV e na aba de Orçamentos.
   - "Saem hoje" (Geral) e "Entregam hoje" (Produção e TV) são a mesma coisa com dois nomes.
   - O quadro "Atrasados 1" fica ao lado do grupo "Atrasados e impedidos 2".
   - A receber: **R$ 900** "a vencer em 7 dias" (Geral), **R$ 1.970** "a vencer" (Recebíveis) e **R$ 2.460** "a receber em aberto" (Financeiro). São três números diferentes sem explicação.
3. **Muitos números não abrem lista.** Os 4 quadros do topo do Geral não mostram quais carros estão por trás.
4. **Linguagem de sistema e explicações na tela.** Exemplos: "Idade" e "atualiz. agora" em Orçamentos; "manual · 17/10 22:34" na fila da Agenda; "Apagada em 11/09/2027" em Vistorias (parece que a foto foi apagada, mas é o prazo de guarda); coluna "Aparelho" e o texto "Impedimento é contexto, não penalidade. Comissão: só entra se o dono pedir" em Funcionários; um parágrafo sobre a regra de vencimento em Recebíveis; os estados "Entregue" e "Encerrado", que o dono não sabe distinguir.

Há também um problema de regra que pesa no visual. O limite "laranja faltando **8 h** úteis" (Ajustes) é maior que etapas de 2 a 4 h, então a etapa já nasce laranja. Na Produção, 5 de 7 cartões estão em "Atenção", e a cor perdeu o sentido.

Hierarquia: o Geral do dono tem cerca de 1.800 px de altura, com 3 colunas, 12 cartões e mais um bloco "Planejamento" abaixo da dobra. Não existe um elemento dominante.

## 2. Geral (P0)

**Ideia: quadrados que mostram os próprios carros.** Cada quadrado tem nome curto, número grande e **as placas dentro** (até 6, depois "+N"). Clicar num quadrado abre uma gaveta lateral com a lista completa e a ação de cada carro, sem sair do Geral. Sai a coluna "Precisa de ação" com 7 grupos. Entra uma única lista "Resolver agora" com os 5 itens mais urgentes, cada um com o problema escrito em palavras da oficina.

Ordem: (1) saudação e data numa linha; (2) quadrados do **fluxo do carro**; (3) quadrados de **problemas** (aparecem em `alerta` só quando passam de 0; com 0 ficam cinza, com "Nada aqui"); (4) "Resolver agora"; (5) **Dinheiro** (só dono e financeiro). "Produção prevista" e "Entregas do mês" saem do Geral e vão para a Agenda.

### 1366, dono

```
Quarta, 21 de outubro · Bom dia, Carlos                     Maxpar: atualizado 20/10 19:34
┌ Entram hoje 1 ─────┐┌ Na oficina 8 ──────┐┌ Prontos p/ retirar 2┐┌ Saem hoje 3 ───────┐
│ [RTO9H02] tarde    ││ [RTB2E90][RAV3K61] ││ [RFG5N90][QXT4D88] ││ [QPZ6M77][SCH4A22] │
│                    ││ [RKP1L34][QPZ6M77] ││                    ││ [RFG5N90]          │
│                    ││ [SCH4A22][RJC8T15] ││                    ││                    │
│                    ││ +2                 ││                    ││                    │
└────────────────────┘└────────────────────┘└────────────────────┘└────────────────────┘
┌ Atrasados/parados 2┐┌ Sem autorização 1 ─┐┌ Pendência Maxpar 3 ┐┌ Esperando agenda 3 ┐
│ [RKP1L34] atrasado ││ [RHK2C47] 6 dias   ││ [SJQ7R03][RCD8P15] ││ [RNA4S66][SAE5P73] │
│ [RTB2E90] peça     ││                    ││ [RJC8T15]          ││ [QWE3R27]          │
└────────────────────┘└────────────────────┘└────────────────────┘└────────────────────┘
Resolver agora                                                              Ver tudo (10)
 [RKP1L34] Range Rover — Pintura atrasada, entrega era ter 20/10    Marcos  [Abrir]
 [RTB2E90] Mercedes GLC — parado: peça do segurado não chegou       Diego   [Abrir]
 [RHK2C47] BMW 320i — vistoria vence amanhã                                 [Abrir]
 [SJQ7R03] BMW X1 — reenviar documentação no portal (há 4 d)                [Abrir]
 [RNA4S66] Volvo XC40 — horário proposto expira 03:04                       [Agenda]
Dinheiro   ┌ Vencido R$ 1.560 · 2 ┐┌ Vence em 7 dias R$ 900 · 1 ┐┌ Recebido no mês R$ 2.320 ┐
```

Quadrado: `Cartao` raio 8, padding 16, altura mínima 168 px. Título 14/600 com o número 28/650 à direita. Placas `p` em grade de 2. Borda `alerta` só quando é problema e o número é maior que 0. Passar o mouse sobre uma placa mostra modelo e etapa no `title`. Os quadrados de problemas mostram, além da placa, o motivo em 12 px.

### 390

```
Quarta, 21/10                      
┌ Entram hoje  1 ┐┌ Na oficina   8 ┐
│ [RTO9H02]      ││ [RTB2E90] +7   │
└────────────────┘└────────────────┘
┌ Prontos      2 ┐┌ Saem hoje    3 ┐
│ [RFG5N90] +1   ││ [QPZ6M77] +2   │
└────────────────┘└────────────────┘
┌ Atrasados    2 ┐┌ Maxpar       3 ┐   (só os de problema > 0)
Resolver agora (5 linhas, placa + motivo)
Dinheiro (dono): 1 linha, rolagem horizontal
```

Tocar num quadrado abre a lista em tela cheia. Grade de 2 colunas, uma placa visível e "+N".

### Por papel

| Papel | Quadrados (nesta ordem) | Dinheiro |
| --- | --- | --- |
| Dono | os 8 acima | sim, 3 quadrados |
| Recepção | Entram hoje · Saem hoje · Prontos p/ retirar · Esperando agenda · Sem autorização · Pendência Maxpar · Na oficina | não |
| Financeiro | A receber vencido · Vence em 7 dias · Contas a pagar (7 dias) · Prontos sem pagamento · Maxpar segurando pagamento · Recebido no mês | é a tela inteira |
| Produção | não vê o Geral; entra direto em Minhas tarefas | não |

Código: reescrever `telas/Geral.tsx` com o componente novo `componentes/geral/QuadroCarros.tsx` e a gaveta `GavetaLista`. As seleções ficam num único `componentes/geral/selecoes.ts`, com as mesmas funções usadas por Produção, TV e Orçamentos.

## 3. Orçamentos → "Atendimentos" (P0)

A tela não é de orçamentos. Ela lista **todo carro do orçamento à entrega**, e daí vem a confusão. Proposta: renomear o menu para **Atendimentos** (o botão do topo já se chama "Novo atendimento"). "Orçamento" vira um dos filtros.

**Barra de filtros, numa linha de 36 px:**
- **Busca da página**, sempre visível: placa, cliente, protocolo ou OS, filtrando enquanto se digita. Hoje a busca só existe no topo e manda para `?q=`.
- **Situação** (segmentado, com contagem): Em orçamento (junta rascunho e aguardando aprovação) · Aprovado, sem data · Agendado · Na oficina · Pronto · Entregue · Todos. Recusados e cancelados ficam em "Arquivados", no fim. Isso dá 7 abas, contra 8 hoje.
- **Origem**: Maxpar · Seguradora direta · Particular, mais um select de **Seguradora** (HDI, Mapfre…).
- **Valor**: até R$ 500 · R$ 500–1.500 · R$ 1.500–5.000 · acima de R$ 5.000.
- **Tempo**: parado há mais de 3 · 7 · 15 dias.
- **Ordenar**: mais tempo parado (padrão) · maior valor · mais recente.
- "Limpar filtros" aparece só quando há filtro. Os filtros ficam na URL, para que o Geral possa linkar direto.

**Colunas:**
Placa · Carro e cliente · Origem (seguradora + protocolo) · Peças (autorizadas/pedidas; a negada em vermelho) · **Valor** (autorizado; se ainda for orçado, valor em cinza com a etiqueta "orçado") · **Situação** (pílula + próxima ação em 12 px, por exemplo "cobrar seguradora") · **Tempo** ("há 6 dias" **na situação atual**; laranja quando passa do limite da situação).

Sai a linha "atualiz. agora". No rodapé: "21 carros · R$ 9.870 orçado · R$ 7.410 autorizado" (somatório do filtro). No celular, os cartões ficam como estão, com a busca grudada no topo e os filtros num botão "Filtros (2)" que abre uma folha.

Arquivo: `telas/Orcamentos.tsx`. O cálculo de "tempo na situação" sai do histórico de estado em `dominio/`, com `atualizadoEm` como provisório.

## 4. Agenda: arrastar e soltar (P0)

Biblioteca: `@dnd-kit/core` (sensores de mouse, toque e **teclado**).

- **Um carro.** Arrastar o cartão para outro dia ou turno grava na hora, sem formulário. Aparece um toast por 8 s: "RTO9H02 → qui 22/10 · tarde · **Desfazer**". Se o horário estava confirmado com o cliente, o cartão passa a "**Avisar cliente**" (pílula `atencao` com "Copiar mensagem").
- **Da fila para a grade.** Arrastar de "Aguardando agendamento" para uma célula agenda o carro. O botão "Agendar" continua existindo como alternativa.
- **Vários carros.** Shift ou Cmd + clique, ou a caixinha que aparece ao passar o mouse, marca o cartão com anel amarelo. Uma barra flutuante mostra "3 selecionados · Mover para… · Limpar". Arrastar um dos marcados leva todos, com uma pilha "3" sob o cursor. Um único Desfazer reverte tudo.
- **Capacidade durante o arraste.** Cada célula mostra "2 de 2 livres". Se soltar vai passar do limite, a célula fica `alerta-claro` com "5 de 4 — encaixe". Soltar é permitido, e o toast avisa "Dia acima da capacidade". Turno fechado (sábado à tarde, hachurado) e dias passados não aceitam o carro: o cursor mostra bloqueio e nada é gravado.
- **Teclado.** Foco no cartão; Espaço pega; setas trocam dia e turno; Enter solta; Esc cancela.
- **Celular.** Nada de arrastar dentro de uma lista que rola. Toque longo entra em modo seleção, e "Mover para…" abre uma folha com os dias e turnos e as vagas de cada um.
- **Dia lotado.** O quadrado do dia cresce e o cartão encolhe. A densidade é escolhida por turno:
  - até 2 carros: **cheio** (placa `p`, modelo, cliente, estado);
  - 3 ou 4: **compacto** (placa `p` + modelo numa linha, ponto de estado);
  - 5 ou mais: **mini** (só as placas, 2 por linha, motivo no `title`).

  A linha da semana fica com a altura do turno mais cheio. Não há rolagem interna, e a largura das colunas não muda.
- O cabeçalho do dia mostra manhã e tarde separados ("M 1/2 · T 2/2"), não só "1 de 4". Hoje a grade é por turno e a capacidade é por dia.

Arquivos: `componentes/agenda/Grade.tsx` e `Fila.tsx`, um hook novo `useMoverAgendamento` com mutação otimista e rollback, e a regra de capacidade por turno em `dominio/`.

## 5. Demais telas

**P0**
- **Uma fonte para cada contagem.** Definir "Na oficina" como todo carro fisicamente presente, prontos incluídos (8). Usar **"Saem hoje"** em todo lugar. Os nomes de dinheiro passam a ser exatos: "Vencido", "Vence em 7 dias", "Em aberto (todos)". Arquivos: `componentes/geral/selecoes.ts`, `componentes/orcamentos/selecoes.ts`, `telas/Producao.tsx`, `ProducaoTV.tsx`, `Financeiro.tsx`, `Recebiveis.tsx`.
- **Semáforo.** A "Atenção" passa a disparar por **percentual do prazo da etapa** (por exemplo, 75% consumidos) em vez de 8 h fixas. Arquivos: `dominio/` e Ajustes → Prazos e cores.
- **Minhas tarefas (`telas/MinhasTarefas.tsx`).**
  - O cartão impedido mostra "Atenção" e "Impedida" ao mesmo tempo. Impedido deve vencer e mostrar só uma pílula.
  - "Etapa 2 de 6 · Pintura" mistura a etapa com o tipo de serviço. Corrigir para "Funilaria · etapa 2 de 6 (serviço: Pintura)".
- **Ficha da OS (`telas/FichaOS.tsx`).** O texto diz "1 de 3 etapas feitas" e "Etapa 2 de 3", mas a lista tem 4 linhas. Mostrar "2 de 3 (1 dispensada)". A volta deve ser "← Atendimentos".

**P1: menu de 14 para 9 itens** (`componentes/Layout.tsx`, `MENU`):

```
Operação:  Geral · Atendimentos · Agenda · Produção · Clientes
Gestão:    Financeiro · Estoque · Equipe
           Ajustes
```

- **Minhas tarefas** fica só no papel produção.
- **Quadro da TV** vira botão na Produção (já existe) e um link em Ajustes.
- **Vistorias** vira a aba "Fotos" da ficha. Para a produção no celular, fica o atalho "Fotos".
- **Recebíveis, Financeiro e Relatórios** viram um só **Financeiro** com abas A receber · A pagar · Caixa do dia · Relatórios. Hoje Relatórios repete os mesmos três números do Financeiro.
- **Funcionários** passa a se chamar **Equipe**.
- "Ver como" sai do topo e vai para o menu do usuário. Ela é ferramenta de teste.

**P1: texto**
- Tirar os parágrafos explicativos de Funcionários, Recebíveis e Ajustes, e o subtítulo de Orçamentos. Se a explicação for necessária, ela vai para um "?" com dica.
- Tirar a coluna "Aparelho".
- A proveniência "manual · data" da fila da Agenda e da ficha só aparece ao passar o mouse.
- Em Vistorias, "Apagada em…" vira "Guardada até…".
- "Encerrado" vira "Pago e fechado", ou o estado nem aparece para a recepção.

**P1: Estoque (`telas/Estoque.tsx`)**
- Os 5 números do topo viram os próprios filtros. Sai o segmentado "Situação", que repete esses números.
- "Entrada · Retirada · Editar" repetidos em cada linha vão para um menu "⋯". Fica visível só "Retirada", que é a ação do dia a dia.

**P2**
- Novo atendimento: começar pela **placa**, que acha o carro e o cliente. A busca de cliente vem depois.
- Produção: a linha "Sem carro agora…" só aparece no modo Lista.
- TV: usar os mesmos nomes de contagem do Geral.
- Clientes: não mexer (pedido do dono).

## 6. Princípios para o sistema inteiro

1. **Todo número é clicável e mostra a lista**, e a lista tem o mesmo total que o número.
2. **Uma contagem, um nome, uma função.** O mesmo número aparece igual no Geral, na Produção, na TV e em Atendimentos.
3. **Cada carro tem uma casa**: a ficha. As outras telas são recortes que levam a ela.
4. **Uma ação primária por tela** (amarelo). O resto é secundário ou fica no "⋯".
5. **Nomes da oficina, não de sistema**: "Saem hoje", "Parado", "Tempo", "A receber". Nada de "Idade", "Aparelho", "proveniência" ou "Encerrado".
6. **A placa identifica o carro**: sempre a placa antes do número.
7. **Cor só com significado.** Se metade dos cartões está laranja, a regra está errada, não o carro.
8. **Mover sem formulário, sempre com Desfazer**: arrastar, mudar estado e atribuir pessoa.
9. **A tela não se explica.** Texto de ajuda vai para "?" ou para o primeiro uso.
10. **O que não precisa de ação some** (com 0, fica cinza ou recolhido). Sem atalhos de teste na tela.
