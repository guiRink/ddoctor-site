# Painel D doctor — sistema visual

Data: 12/10/2026. Fonte da verdade da aparência do painel; complementa o `DESIGN.md` (identidade da landing). Quem mantém: `designer-painel`. Toda tela nova segue este documento; padrão novo entra aqui antes de entrar no código.

## 1. Princípio

O painel é uma ferramenta de trabalho (modo *Operate*): **o carro certo, o estado certo e a próxima ação aparecem em 5 segundos**. A identidade da oficina (amarelo, preto, papel, Archivo, raio zero) dá o acabamento; a clareza manda. "Bonito" aqui é: hierarquia óbvia, cor só com significado, números alinhados, nada desalinhado, nada sobrando.

Três regras que valem para todas as telas:
1. **Um elemento dominante por tela.** Na Produção é o quadro; no Geral é "Precisa de ação"; na Ficha é a placa e o estado.
2. **Cor = significado.** Amarelo = ação primária, item selecionado em navegação (menu, aba, dia de hoje), etapa atual. Filtro selecionado é preto (ver `Segmentos`), para não competir com a ação primária. Verde/laranja/vermelho = semáforo de prazo. Nada colorido por enfeite.
3. **O carro é identificado pela placa.** Sempre o componente `Placa` (formato Mercosul), nunca texto solto.

## 2. Tokens

| Token (Tailwind) | Valor | Uso |
| --- | --- | --- |
| `preto` | `#0A0A0A` | Barra lateral, cabeçalhos de tabela, botão secundário, TV (fundo) |
| `grafite` / `grafite-2` | `#15161A` / `#1E2025` | Item ativo do menu, cartões da TV |
| `papel` | `#F4F3EE` | Fundo das telas claras |
| `cartao` | `#FFFFFF` | Superfície de cartões, tabelas e formulários sobre o papel (segunda camada neutra) |
| `tinta` / `tinta-suave` / `tinta-fraca` | `#0A0A0A` / 66 % / 45 % | Texto principal / secundário / desabilitado e dicas |
| `linha` / `linha-forte` | 10 % / 22 % de preto | Divisórias e bordas / borda em hover e foco de campo |
| `amarelo` / `amarelo-claro` | `#F2C200` / `#FDF3C4` | Ação primária, selecionado, etapa atual / fundo de destaque suave |
| `ok` / `ok-claro` | `#1E7F45` / `#E3F2E9` | Semáforo verde, concluído, recebido |
| `atencao` / `atencao-claro` | `#C75B00` / `#FCEBD8` | Semáforo laranja, vencendo |
| `alerta` / `alerta-claro` | `#C8321E` / `#FBE4E0` | Semáforo vermelho, atrasado, impedido, erro |
| `maxpar` | `#2F4A7A` | Só a etiqueta de proveniência "Maxpar" e a faixa azul da placa |

Tipografia: Archivo (self-hosted). Escala fixa em rem (sem `clamp` nas telas do painel): 12 · 13 · 14 (corpo) · 16 · 20 · 24 · 32 (título de página). Títulos de página em Archivo 800 `wdth 84` (`titulo-condensado`); rótulos 11 px 700 caixa-alta `tracking .1em` (`rotulo`); **todo número em `tabular-nums`**. Raio zero em tudo. Sem sombra, exceto a sombra de elevação do cabeçalho fixo e de menus que flutuam (`0 8px 24px -12px rgba(10,10,10,.35)`).

Movimento: só para mudança de estado, 150–200 ms, `cubic-bezier(.22,1,.36,1)`. A TV troca dados sem animação.

## 3. Componentes

| Componente | Para quê | Regras |
| --- | --- | --- |
| `Placa` | Identificar o carro | Formato Mercosul: corpo branco, faixa azul `maxpar` no topo com "BRASIL" (6/7/9/12 px), caracteres pretos `wdth 106` e `tabular-nums`, borda preta 1,5 px. Tamanhos `p` 96 px (listas), `m` 122 (cartões), `g` 180 (ficha), `tv` 264. A pior sequência (WWW8W88) cabe dentro da borda em todos. `encolher` deixa a placa ocupar a coluna até o tamanho cheio (mínimo `p` 92 px) — usado na grade da Agenda. Placa antiga também usa o formato. |
| `Semaforo` | Estado de prazo | Pílula quadrada com ponto + texto: "No prazo" (ok), "Atenção" (atencao), "Atrasado" ou "Impedido" (alerta). Nunca só a cor: sempre texto junto. |
| `EtiquetaEstado` | Estado da OS, do orçamento, do agendamento, do título | Fundo claro + texto da cor do grupo; rótulos de `rotulos.ts`. Neutros (rascunho, aguardando) em contorno `linha`. |
| `ProgressoEtapas` | Onde o carro está na produção | Barra segmentada, um segmento por etapa: concluída `preto`, atual cor do semáforo, dispensada hachurada `linha`, futura `linha`. Abaixo, "Etapa 3 de 5 · Pintura". |
| `Responsavel` | Quem faz | Quadrado 28 px com iniciais em `grafite` + nome; sem foto. |
| `Cartao` | Agrupar | `bg-cartao border border-linha`, cabeçalho com título 16/700 e ação à direita; sem cartão dentro de cartão. |
| `Secao` | Bloco de tela com contagem | Título + número entre parênteses + link "ver tudo" que abre a lista filtrada. |
| `Tabela` | Listas densas | Cabeçalho `rotulo` sobre `papel` sem quebra de linha, linhas 48 px, hover `amarelo-claro`, primeira coluna com `Placa`, números alinhados à direita. Linha vencida/atrasada ganha fundo `alerta-claro` a 50 %, nunca faixa colorida na borda esquerda. |
| `LinhaCarro` | Carro em lista de cartão | Placa `p` + modelo + detalhe (até 2 linhas) + complemento à direita; em coluna com menos de 24rem o complemento desce para baixo do texto (container query), para o modelo não ser cortado. |
| `Botao` | Ações | Primário `amarelo`+`preto`; secundário `preto`+`papel`; contorno; perigo. Alturas 36 (denso; 44 abaixo de 768 px), 44 (padrão), 56 (celular da produção). Só ícone = quadrado na mesma altura, ícone 18 px que não encolhe. |
| `Segmentos` (`ui/Filtros.tsx`) | Filtro de um valor só, com contagem | Botões lado a lado, gap 6 px, 36 px (44 no celular), borda `linha-forte`; selecionado `preto`+`papel`; contagem `tabular-nums` em `tinta-fraca`, vermelha quando crítica (atrasados, impedidos). Rótulo à esquerda em `rotulo`. No celular a fileira rola até a borda da tela. Mesmo componente em Produção, Recebíveis, Estoque e Funcionários. Escolha única em formulário (Origem, no Novo atendimento) usa o mesmo selecionado preto. Abas de estado (Orçamentos) são navegação: sublinhado amarelo. |
| `Proveniencia` (`ui/Proveniencia.tsx`) | De onde veio o dado | Etiqueta 24 px, 11 px semibold: "Maxpar · lido 12/10 14:30" em `maxpar` sobre azul claro; "manual · 12/10 14:30" neutra (`papel` + `tinta-suave`, o azul é só da Maxpar); vermelha com "· desatualizado" se a leitura passou de 24 h e a tela permite. |
| `Vazio` / `Erro` / `Carregando` | Estados | Vazio ensina a próxima ação; Erro tem "Tentar de novo"; Carregando é esqueleto na forma do conteúdo, nunca spinner no meio. |
| `Provisorio` | Valor ainda não confirmado pelo dono | Sublinhado pontilhado + dica "provisório — a confirmar". |

## 4. Superfícies

| Superfície | Tela | Padrão |
| --- | --- | --- |
| Recepção / escritório (1366–1920 px) | Todas as abas | Barra lateral preta 240 px com o D amarelo; topo com busca por placa/protocolo/cliente, botão **Novo atendimento** e seletor de papel (demo); conteúdo em `papel`, largura máxima 1440 px. |
| Celular (390 px) | Produção "Minhas tarefas", consultas rápidas do dono | Menu vira barra inferior com 5 itens (rótulo 11 px em até 2 linhas, nunca cortado); botões de ação 56 px, um cartão por tarefa, Iniciar/Concluir/Impedimento grandes e separados. |
| TV (1920×1080) | Produção TV | Fundo `preto`, colunas por etapa, cartões `grafite` com cabeçalho na cor do semáforo, `Placa` tamanho `tv`, tempo e responsável em 24 px+, rodapé com relógio e "atualizado há X s". Sem cursor, sem foco, sem rolagem: se não couber, rotaciona páginas a cada 20 s. Motivo do impedimento em até 2 linhas; legenda separa cor (No prazo · Atenção · Atrasado · Pronto) do ícone de impedido. |

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
