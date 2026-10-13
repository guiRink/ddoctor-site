# Painel D doctor — sistema visual

Data: 12/10/2026, revisado em 13/10/2026 (sprint SE). Fonte da verdade da aparência do painel; complementa o `DESIGN.md` (identidade da landing). Quem mantém: `designer-painel`. Toda tela nova segue este documento; padrão novo entra aqui antes de entrar no código.

## Revisão SE (13/10/2026) — direção clean

O Guilherme pediu um painel **mais limpo, profissional e bonito** (ver `docs/concorrente-analise.md` §4). Referências de acabamento: Linear, Stripe Dashboard, Vercel, Attio — claro, arejado, hierarquia tipográfica calma, cor só com significado. Esta revisão **substitui** as regras abaixo da versão de 12/10:

| Antes (12/10) | Agora (SE) |
| --- | --- |
| Raio zero em tudo | Raio 8 px em cartões e superfícies (`rounded-cartao`), 6 px em controles, campos e etiquetas retangulares (`rounded-controle`), pílulas de estado em `rounded-full`. A `Placa` mantém o raio de placa real (3–7 px conforme o tamanho). |
| Barra lateral preta, D amarelo | Barra lateral **branca** com borda direita; marca = D preto em quadrado amarelo (`MarcaD`) + "D doctor". |
| Títulos Archivo 800 `wdth 84` em caixa-alta condensada | Archivo largura normal (`wdth 100`), 650, sentence case. `titulo-condensado` continua existindo por compatibilidade, mas agora rende o título limpo. |
| Rótulos 11 px 700 caixa-alta `tracking .1em` | `rotulo` = 12 px / 500, sentence case, sem tracking — também nos cabeçalhos de tabela. Rótulo de campo em formulário/ficha: 13 px / 500 `tinta-suave`. |
| Faixa zebrada amarelo/preto | Retirada. `faixa-zebrada` virou um fundo amarelo liso (use como linha fina de 2 px, se precisar). |
| Fundo `papel` creme `#F4F3EE`, muito preto | Fundo neutro `#F7F7F5`, superfícies brancas, bordas 1 px `#E7E5E0`; preto só em texto, placa e TV. |
| Filtro selecionado preto | Controle segmentado: trilho `cinza-100`, selecionado branco elevado. |
| Botão secundário preto | Secundário = branco com borda (igual a `contorno`); preto virou a variante rara `escuro`. |
| Hover de linha `amarelo-claro` | Hover `cinza-50`; amarelo-claro só para destaque de estado (ex.: "hoje"). |
| Sem sombra | Sombra quase nula em cartões (`shadow-cartao`) e controles; `elevacao` só no que flutua. |
| Ícones traço 2 px, pontas retas | Traço 1,75 px, pontas e cantos arredondados (2 px no item ativo e na TV). |

**Amarelo `#F2C200` só em:** botão primário (texto preto), item ativo do menu (ícone), indicador do item ativo no celular, foco, "hoje" e etapa atual. Nunca em hover, fundo de seção ou enfeite.

## 1. Princípio

O painel é uma ferramenta de trabalho (modo *Operate*): **o carro certo, o estado certo e a próxima ação aparecem em 5 segundos**. A identidade da oficina (amarelo, preto, Archivo, placa) dá o acabamento; a clareza manda. "Bonito" aqui é: hierarquia óbvia, espaço generoso, cor só com significado, números alinhados, nada desalinhado, nada sobrando.

Três regras que valem para todas as telas:
1. **Um elemento dominante por tela.** Na Produção é o quadro; no Geral é "Precisa de ação"; na Ficha é a placa e o estado.
2. **Cor = significado.** Amarelo = ação primária, item ativo da navegação, "hoje", etapa atual, foco. Filtro selecionado é branco elevado sobre trilho cinza (ver `Segmentos`), para não competir com a ação primária. Verde/laranja/vermelho = semáforo de prazo. Nada colorido por enfeite.
3. **O carro é identificado pela placa.** Sempre o componente `Placa` (formato Mercosul), nunca texto solto.

## 2. Tokens

Os nomes do Tailwind ficaram os mesmos da versão 12/10 (as telas já usam); os valores mudaram na revisão SE. Tokens novos: `cinza-50/100/200`, `amarelo-tinta`, `maxpar-claro`, `rounded-cartao`, `rounded-controle`, `shadow-cartao`, `shadow-controle`, `shadow-flutuante`.

| Token (Tailwind) | Valor | Uso |
| --- | --- | --- |
| `papel` | `#F7F7F5` | Fundo da aplicação; trilho do campo de busca |
| `cartao` | `#FFFFFF` | Superfícies: cartões, tabelas, barra lateral, topo, formulários |
| `cinza-50` / `cinza-100` / `cinza-200` | `#FAFAF9` / `#F2F2EF` / `#E8E7E3` | Hover de linha / hover de menu, trilho de segmentos, pílula neutra, item ativo / avatar, pílula "escuro", etapa futura |
| `tinta` / `tinta-suave` / `tinta-fraca` | `#111111` / `#6B6B6B` / `#8C8C87` | Texto principal / secundário e rótulos / dicas, contagens, desabilitado (não usar em texto que precisa ser lido) |
| `linha` / `linha-forte` | `#E7E5E0` / `#D5D3CD` | Divisórias e bordas de superfície / bordas de controles e campos |
| `amarelo` / `amarelo-escuro` / `amarelo-claro` / `amarelo-tinta` | `#F2C200` / `#D9A800` / `#FEF7D6` / `#7A5C00` | Ação primária, foco / hover do primário, ícone do item ativo, anel de foco / fundo de "hoje" e da pílula amarela / texto sobre `amarelo-claro` |
| `preto` | `#111111` | Placa (borda e caracteres), fundo da TV, variante `escuro` de botão |
| `grafite` / `grafite-2` / `grafite-3` | `#1A1A1A` / `#1F1F1F` / `#2E2E2E` | Superfícies da TV e da galeria; trilhos escuros |
| `linha-clara`, `papel-suave`, `papel-fraco` | branco 10 % / papel 72 % / papel 50 % | Bordas e texto secundário sobre fundo escuro (TV, galeria) |
| `ok` / `ok-claro` | `#1F7A4A` / `#EAF5EE` | Semáforo verde, concluído, recebido |
| `atencao` / `atencao-claro` | `#B45309` / `#FDF1E2` | Semáforo laranja, vencendo |
| `alerta` / `alerta-claro` | `#B93A2C` / `#FCEDEB` | Semáforo vermelho, atrasado, impedido, erro |
| `maxpar` / `maxpar-claro` | `#2F4A7A` / `#EAEFF7` | Só a Proveniência "Maxpar", a pílula da Calia e a faixa azul da placa |
| `rounded-cartao` / `rounded-controle` | 8 px / 6 px | Cartões, tabelas, painéis / botões, campos, segmentos, menu |
| `shadow-cartao` / `shadow-controle` / `shadow-flutuante` (`elevacao`) | `0 1px 2px` 4 % / `0 1px 1px` 4 % / `0 12px 32px -12px` 20 % | Cartões / botões brancos / menus, painéis laterais e folhas |

Tipografia: Archivo (self-hosted), largura normal. Escala fixa em px (sem `clamp` nas telas do painel): 12 · 13 · 14 (corpo) · 15 · 16 · 20 · 24 (título de página) · 28 (número de indicador). Pesos: 400 corpo, 500 rótulos e itens de menu, 600 títulos de cartão e botões, 650 títulos de página. Utilitários: `titulo-pagina` (24/650, `-0.015em`), `titulo` e `titulo-condensado` (mesmo desenho, tamanho vem da tela), `rotulo` (12/500, sentence case), `numero` (tabular). **Todo número em `tabular-nums`.** Campos (`input`, `select`, `textarea`) recebem raio 6 pela base, sem classe.

Movimento: só para mudança de estado, 150–200 ms, `cubic-bezier(.22,1,.36,1)`. A TV troca dados sem animação.

## 3. Componentes

| Componente | Para quê | Regras |
| --- | --- | --- |
| `Placa` | Identificar o carro | Formato Mercosul: corpo branco, faixa azul `maxpar` no topo com "BRASIL" (6/7/9/12 px), caracteres pretos `wdth 106` e `tabular-nums`, borda preta 1,5 px, raio de placa real (3/4/5/7 px). Tamanhos `p` 96 px (listas), `m` 122 (cartões), `g` 180 (ficha), `tv` 264. A pior sequência (WWW8W88) cabe dentro da borda em todos. `encolher` deixa a placa ocupar a coluna até o tamanho cheio (mínimo `p` 92 px) — usado na grade da Agenda. Placa antiga também usa o formato. |
| `MarcaD` (`ui/Marca.tsx`) | Marca da oficina na casca e no PIN | D preto em quadrado amarelo, raio 6. `tamanho` em px (28 na casca, 36 no PIN). |
| `Semaforo` | Estado de prazo | Pílula `rounded-full` 24 px: tint claro + texto escuro da cor + ponto 6 px. "No prazo" (ok), "Atenção" (atencao), "Atrasado" ou "Impedido" (alerta). Nunca só a cor: sempre texto junto. |
| `Etiqueta` | Estado da OS, do orçamento, do agendamento, do título | Mesma pílula, 12/500, rótulos de `rotulos.ts`. Tons: `ok`, `atencao`, `alerta`, `amarelo` (em andamento: `amarelo-claro` + `amarelo-tinta`), `escuro` (estado firme: `cinza-200` + tinta, ponto preto), `maxpar`, `neutro` (`cinza-100` + `tinta-suave`, sem ponto). `ponto={false}` tira o ponto. |
| `ProgressoEtapas` | Onde o carro está na produção | Barra segmentada `rounded-full`, um segmento por etapa: concluída `tinta`, atual cor do semáforo, dispensada hachurada, futura `cinza-200`. Abaixo, "Etapa 3 de 5 · Pintura". |
| `Responsavel` | Quem faz | Avatar redondo 28 px com iniciais (`cinza-200` + tinta; na TV `grafite-3`) + nome 13/500; sem foto. |
| `Cartao` | Agrupar | `SUPERFICIE` (`bg-cartao border border-linha rounded-cartao shadow-cartao`), cabeçalho 48 px com título 14/600, contagem 13 `tinta-fraca` e ação à direita; sem cartão dentro de cartão. Cartões montados na tela usam a constante `SUPERFICIE` de `ui/Basicos.tsx`. |
| `CabecalhoPagina` | Topo de cada aba | Título `titulo-pagina` (24/650), resumo 14 `tinta-suave`, ações à direita; 24 px até o conteúdo. |
| `FaixaIndicadores` + `Indicador` | Números do topo (Geral, Recebíveis, Financeiro, Estoque) | **Uma** superfície dividida em células (2 colunas no celular, 2–5 no desktop) — nunca um cartão grande por número. Célula: rótulo 13/500 `tinta-suave`, número 28/600 tabular, detalhe 12 opcional; `alerta` deixa o número vermelho; `para` torna a célula inteira um link para a lista filtrada. |
| `Secao` | Bloco de tela com contagem | Título + número + link "Ver tudo" que abre a lista filtrada. |
| `Tabela`, `Th`, `Td`, `Linha` (`ui/Tabela.tsx`) | Listas densas | Superfície branca raio 8; cabeçalho **branco** com `rotulo` `tinta-suave` (sentence case) e divisória; linhas 52 px; hover `cinza-50`; primeira coluna com `Placa`; números à direita. Linha vencida/atrasada ganha fundo `alerta-claro` a 50 %, nunca faixa colorida na borda esquerda. `CLASSE_TH` e `CLASSE_LINHA` para tabelas montadas à mão. |
| `LinhaCarro` | Carro em lista de cartão | Placa `p` + modelo 14/500 + detalhe (até 2 linhas) + complemento à direita; hover `cinza-50`; em coluna com menos de 24rem o complemento desce para baixo do texto (container query). |
| `CartaoOS` | Carro no quadro de produção | `SUPERFICIE` com padding 16; Placa `m` + Semáforo; modelo, tipo de reparo, ProgressoEtapas, Responsável e tempo. |
| `Botao` / `BotaoLink` | Ações | Raio 6, 600. Primário `amarelo` + preto; secundário e contorno = branco com borda `linha-forte` e `shadow-controle`; fantasma sem fundo (hover `cinza-100`); perigo branco com texto `alerta`; escuro `preto` + branco (raro). Alturas: denso 36 (40 no celular), padrão 40 (44 no celular), grande 56 (celular da produção). Só ícone = quadrado na mesma altura; ícone 16/18/22. |
| `Segmentos` (`GrupoFiltros`, `ui/Filtros.tsx`) | Filtro de um valor só, com contagem | Trilho `cinza-100` raio 8 com 2 px de respiro; opções 32 px (40 no celular), raio 6, 13/500 `tinta-suave`; selecionada branca, 600, com sombra mínima e anel `linha`. Contagem tabular em `tinta-fraca`, vermelha quando crítica. Rótulo à esquerda 13/500 `tinta-suave`. No celular o trilho rola até a borda. Mesmo componente em Produção, Recebíveis, Estoque e Funcionários. Abas de estado (Orçamentos) são navegação: sublinhado amarelo. |
| `Proveniencia` (`ui/Proveniencia.tsx`) | De onde veio o dado | Etiqueta 24 px raio 6, 12/500: "Maxpar · lido 12/10 14:30" em `maxpar` sobre `maxpar-claro`; "manual · 12/10 14:30" em `cinza-100` + `tinta-suave` (o azul é só da Maxpar); vermelha com "· desatualizado" se a leitura passou de 24 h e a tela permite. |
| Campos de formulário | Entrada de dados | Altura 40 (44 no celular), raio 6 (base), borda `linha-forte`, foco: borda `tinta-fraca` + anel `amarelo/30` 3 px. Rótulo acima 13/500 `tinta-suave`. |
| `Vazio` / `Erro` / `Carregando` | Estados | Vazio ensina a próxima ação (ícone em quadrado `cinza-100` raio 8); Erro em `alerta-claro` raio 8 com "Tentar de novo"; Carregando é esqueleto `cinza-100` na forma do conteúdo, nunca spinner no meio. |
| `Provisorio` | Valor ainda não confirmado pelo dono | Sublinhado pontilhado `atencao` + dica "provisório — a confirmar". |

## 4. Superfícies

| Superfície | Tela | Padrão |
| --- | --- | --- |
| Recepção / escritório (1366–1920 px) | Todas as abas | Barra lateral **branca** 232 px com borda direita: `MarcaD` + "D doctor / Painel da oficina"; grupos com cabeçalho 12/500 `tinta-fraca` (sentence case); itens 36 px, ícone 18 + texto 14/500 `tinta-suave`; ativo `cinza-100`, texto 600 `tinta`, ícone `amarelo-escuro`; rodapé com avatar, nome, papel e botão Sair só ícone. Topo branco 56 px: busca (campo `papel` raio 6 com ícone, até 448 px), "Ver como" discreto, botão primário **Novo atendimento** 36 px. Conteúdo em `papel`, largura máxima 1440 px, margens 32 px. |
| Celular (390 px) | Produção "Minhas tarefas", consultas rápidas do dono | Topo branco com `MarcaD`, busca e "+" amarelo 40 px. Menu vira barra inferior **branca** com borda superior, 5 itens (ícone 22 + rótulo 11 em até 2 linhas, nunca cortado); ativo em tinta 600 com traço amarelo de 2 px no topo. "Mais" abre folha branca com raio 12 no topo. Botões de ação 56 px, um cartão por tarefa, Iniciar/Concluir/Impedimento grandes e separados. |
| TV (1920×1080) | Produção TV | Continua escura: fundo `preto` `#111`, cartões `grafite`/`grafite-2` raio 8, colunas por etapa, cabeçalho do cartão na cor do semáforo, `Placa` tamanho `tv`, tempo e responsável em 24 px+, rodapé com relógio e "atualizado há X s". Rótulos em sentence case (sem caixa-alta espaçada). Sem cursor, sem foco, sem rolagem: se não couber, rotaciona páginas a cada 20 s. Motivo do impedimento em até 2 linhas; legenda separa cor (No prazo · Atenção · Atrasado · Pronto) do ícone de impedido. |
| PIN | Entrada | Fundo `papel`, cartão branco raio 12 centralizado com `MarcaD`, campo 48 px e botão primário de largura total. |

## 5. Telas (composição)

| Aba | Elemento dominante | Composição |
| --- | --- | --- |
| Geral | "Precisa de ação" | Três colunas: **Hoje** (entradas e entregas do dia, linha do tempo manhã/tarde) · **Precisa de ação** (atrasados, impedidos, pendências no portal, aguardando agendamento, vistoria vencendo; cada grupo com contagem e itens com `Placa`) · **Dinheiro** (a receber vencido, a vencer em 7 dias, recebido no mês). Cada número abre a lista filtrada. |
| Orçamentos | Lista por estado | Abas de estado com contagem (Rascunho · Aguardando aprovação · Aguardando agendamento · Recusados); tabela com Placa, cliente, seguradora, peças autorizadas/solicitadas, valor, idade. Ficha da OS: cabeçalho com Placa `g`, estado e próxima ação; colunas Itens (versões lado a lado) e Lateral (cliente, veículo, atendimento externo com Proveniência, pendências). |
| Agenda | Semana | Grade seg–sáb × manhã/tarde com ocupação "3 de 4" e barra; cartões dos carros com Placa; fila "Aguardando agendamento" à direita com botão Agendar. Dia lotado em `alerta-claro`, bloqueado hachurado. |
| Vistorias | Galeria | Lista de OS com miniaturas; dentro, fases (Entrada · Durante · Final · Maxpar) em faixas horizontais de fotos com autor e hora. |
| Produção | Quadro | Colunas por etapa (Na fila / Em execução por nome de etapa); cartões com Placa `m`, modelo, Semáforo, ProgressoEtapas, Responsável, tempos "fila 2 h · execução 1 h 40". Filtros: Atrasados, Impedidos, Entregas de hoje, por responsável. |
| Funcionários | Tabela por pessoa | Etapas concluídas, peças, carros, tempo médio em execução, impedimentos; clique abre o histórico. |
| Estoque | Lista com status | Saldo estimado com barra até o mínimo; status Baixo/Zerado/Conferir; ações Compra, Uso, Conferência. |
| Recebíveis | Aging | Faixa no topo com totais por faixa (a vencer · 0–30 · 31–60 · 61+) clicável; tabela de títulos por pagador com saldo, vencimento e estado. |
| Financeiro | Saldo do mês | Recebido × pago no mês, projeção 30 dias; despesas por categoria em barras horizontais; lista de despesas a pagar. |
| Ajustes | Lista de seções | Tipos de reparo e etapas, prazos e semáforo, capacidade, pagadores, pessoas, dados de demonstração; todo valor provisório marcado. |

## 6. Texto

Português do Brasil, frases curtas, verbo no botão ("Registrar entrada", "Concluir etapa"). Datas "12/10", "seg 12/10"; horas "14:30"; durações "2 h 15 min"; dinheiro "R$ 1.234,56". Nada de "Lorem", nada de número inventado sobre a oficina fora do modo demonstração.
