# GusPainel (D doctor) — mapa

## Estado atual (sempre atualizado, sempre curto)
- Onde está: Sprint SE (visual clean + o que faltava frente ao ERP de um concorrente) fechado em 13/10/2026 na branch `sprint/se-clean-concorrente`: 295 testes, lint sem erros, build ok, demo v3 (`ddoctor.demo.v3`), tudo fictício. Antes disso, o SD (12/10) entregou as 14 telas em memória. Banco real ainda não existe (tudo em memória). Merge, tag `sprint-SE` e publicação ficam para depois do checkpoint, a critério do Guilherme.
- Próximo passo: Guilherme mostra o painel ao irmão (checkpoint) e envia o questionário (`docs/questionario-dono.md`; as 7 decisões novas L30–L36 ainda não estão nele); instalar Docker Desktop ou OrbStack; depois S1 (Supabase local: migrations do núcleo mais as tabelas novas do SE, RLS, RepositorioSupabase, login por papel, `listarProducao`).
- Bloqueios: dono responder o questionário (1.1 tipos de reparo e etapas, trava o S3; 5.1 planilha financeira, trava o S4); L34 (guardar CPF/CNPJ do cliente, LGPD) antes de o S1 criar a coluna; dono decidir se a produção pode "pegar" etapas livres na fila (`docs/qa-sprintSD.md` item 6); Docker Desktop ou OrbStack no Mac (pré-requisito do S1); conta Supabase; endereço completo e horário da oficina para a landing; confirmar se Porto/Azul chegam via Carglass e não via Maxpar.
- Fontes atuais: `docs/painel-execucao.md`, `docs/painel-arquitetura.md`, `docs/painel-informacoes.md`, `docs/painel-design.md`. O plano antigo (`docs/painel-plano.md`) é só histórico do Sprint 0.

---

## Decisões do dono

Todas as linhas abaixo estão como provisórias, com o valor sugerido do questionário (coluna "Se não responder" da ficha em `docs/painel-execucao.md` §2.4). O painel usa esse valor até o dono responder. Questionário: https://claude.ai/code/artifact/d237c76c-2ceb-43f8-b7d5-184b3bc1a024

| ID | Pergunta | Resposta | Estado | Data · fonte | Aplicada em |
| --- | --- | --- | --- | --- | --- |
| L01 | Qual portal a oficina usa (Área do Credenciado ou Portal do Prestador)? Quantos usuários? | Sem leitor; só entrada manual | provisória | 12/10/2026 · questionário 6.1 | — |
| L02 | A lista da Maxpar tem exportação (Excel/CSV) ou "Impressão de Serviço" em PDF? | S5 sem leitor de arquivo | provisória | 12/10/2026 · questionário 6.2 | — |
| L03 | Que status existem na Maxpar? O que o detalhe mostra? | Campos de leitura opcionais guardados em dados brutos | provisória | 12/10/2026 · questionário 6.3 | — |
| L04 | O que a Maxpar exige para encerrar? O que mostram "Pendência" e "Saldo Fornecimento"? | Checklist dos 5 itens do Sprint 0 | provisória | 12/10/2026 · questionário 6.4 | — |
| L05 | O login da Maxpar tem MFA ou CAPTCHA? Quanto dura a sessão? | Leitor do portal não é construído | provisória | 12/10/2026 · questionário 6.1 | — |
| L06 | Os termos ou o contrato de credenciamento falam de automação? | Leitor do portal não é construído | provisória | 12/10/2026 · questionário 8.5 | — |
| L07 | Que campos a recepção olha no portal todo dia? | Obrigatórios: protocolo, seguradora, placa, peças; o resto opcional | provisória | 12/10/2026 · questionário 6.3 | SD Novo atendimento |
| L08 | A OS nasce quando o caso aparece, é aprovado ou o carro entra? Dois atendimentos no mesmo carro viram uma OS? | Nasce na entrada rápida como rascunho; 1 OS com N atendimentos, vínculo manual | provisória | 12/10/2026 · questionário 1.3 e 1.4 | SD domínio e Novo atendimento |
| L09 | Tipos de reparo, etapas em ordem e prazo de cada etapa | 4 tipos de informações (`docs/painel-informacoes.md` §4) | provisória | 12/10/2026 · questionário 1.1 | SD domínio; trava o S3 |
| L10 | Expediente, sábado, dias úteis ou corridos, prazo total por tipo | Seg–sex 8–18, sáb 8–12; soma das etapas + 20 %; feriados não contam | provisória | 12/10/2026 · questionário 2.1 e 1.2 | SD domínio (horas úteis) |
| L11 | Quando o carro fica laranja? E vermelho? Quem muda prazo? | Laranja a partir de 8 h úteis (só limiar absoluto), vermelho vencido ou impedimento > 4 h úteis; dono e gestor mudam prazo; semáforo só em "na oficina" | provisória | 12/10/2026 · questionário 2.2 a 2.4 | SD domínio (semáforo) |
| L12 | Entradas por dia, carros ao mesmo tempo, cabine ou boxes que limitam | 4 por dia; 12 simultâneos (só aviso); boxes das placas | provisória | 12/10/2026 · questionário 3.1 a 3.3 | SD Agenda (capacidade) |
| L13 | Vistoria final obrigatória? Peças por peça ou por ponto? Garantia | Aviso; por peça autorizada; 90 dias, OS "garantia" sem título | provisória | 12/10/2026 · questionário 1.5 | SD domínio e Vistorias |
| L14 | Não compareceu: tolerância e quem marca? Previsão ao cliente é data ou data + hora? | 2 h após a janela, recepção; só data | provisória | 12/10/2026 · questionário 3.4 e 3.5 | SD Agenda |
| L15 | Quem trabalha, função, celular próprio ou terminal, e-mail | 1 dono, 1 recepção, 3 produção em terminal | provisória | 12/10/2026 · questionário 4.1 e 4.2 | SD Funcionários (fictícios) |
| L16 | Quem faz as tarefas no portal Maxpar? Quem registra entrada e entrega? | Recepção | provisória | 12/10/2026 · questionário 4.2 | SD permissões por papel |
| L17 | Tem TV na oficina? O Wi-Fi chega no pátio? Tem PC na recepção? | TV com navegador ou stick (orçar); sem Wi-Fi, celular com dados | provisória | 12/10/2026 · questionário 4.3 e 4.4 | SD Quadro da TV |
| L18 | Planilha financeira atual | Campos de informações §3.8–3.9 | provisória | 12/10/2026 · questionário 5.1 | SD Financeiro; trava o S4 |
| L19 | NF: emite para quem? Quem emite? Precisa CPF? | NF registrada à mão; obrigatória no título Maxpar; sem CPF | provisória | 12/10/2026 · questionário 5.3 | SD Recebíveis |
| L20 | Prazo real de pagamento por pagador. A Maxpar desconta a franquia? | Maxpar 30 dias corridos após a doc.; desconta a franquia (paga mão de obra − franquia) | provisória | 12/10/2026 · questionário 5.2 | SD Recebíveis (aging) |
| L21 | Franquia na entrada ou na entrega? Categorias de despesa? Comissão? | Na entrega; categorias de informações §4; comissão só o dono vê | provisória | 12/10/2026 · questionário 5.4 a 5.6 | SD Financeiro |
| L22 | Quais seguradoras vêm via Maxpar, direto ou via Carglass? Teto e franquia | Lista pública, todas via Maxpar; R$ 1.000 / R$ 160 | provisória | 12/10/2026 · questionário 6.5 | SD dados fictícios |
| L23 | Calia: horário permitido, tentativas, sem resposta, quem assume | Seg–sex 9–18, sáb 9–12; 2 tentativas a cada 24 h; depois recepção | provisória | 12/10/2026 · questionário 7.1 e 7.2 | SD Agenda (mensagem manual) |
| L24 | Contato do fornecedor da Calia e documentação/API | Modo manual (texto pronto) | provisória | 12/10/2026 · questionário 7.3 | SD Agenda (mensagem manual) |
| L25 | Conta Supabase de produção, plano Free ou Pro | Dev local + projeto demo do Guilherme, só dados fictícios | provisória | 12/10/2026 · questionário 8.1 | — |
| L26 | Endereço do painel: Cloudflare Pages + domínio ou GitHub Pages | GitHub Pages + HashRouter | provisória | 12/10/2026 · questionário 8.2 | Deploy atual |
| L27 | Worker no PC da oficina ou na nuvem (R$ 30–70/mês) | PC da oficina | provisória | 12/10/2026 · questionário 8.3 | — |
| L28 | Retenção de dados | 5 anos financeiro, 24 meses fotos, 12 meses snapshots/Calia | provisória | 12/10/2026 · questionário 8.4 | — |
| L29 | Autorização escrita para leitura automática do portal | Sem ela o S6 não roda; só após L05/L06 favoráveis | aberta | 12/10/2026 · questionário 8.5 | — |
| L30 | Capacidade de produção em peças por dia | 10 peças/dia (valor visto no sistema do concorrente, sem confirmação) | provisória | 13/10/2026 · Sprint SE, `docs/concorrente-analise.md` | SE Geral (produção prevista contra a capacidade) |
| L31 | Itens do checklist de recepção do veículo | Checklist padrão de 21 itens, configurável em Ajustes | provisória | 13/10/2026 · Sprint SE | SE Receber o carro e Ajustes |
| L32 | Categorias financeiras de receita | Lista padrão provisória, editável em Ajustes | provisória | 13/10/2026 · Sprint SE | SE Financeiro e Ajustes |
| L33 | A partir de quantos dias o estoque conta como parado | 90 dias | provisória | 13/10/2026 · Sprint SE | SE Estoque |
| L34 | Guardar CPF/CNPJ do cliente? | Guardado (validado) no cadastro PF/PJ; conflita com o provisório da L19 ("sem CPF") e exige decisão de LGPD antes do banco real | provisória | 13/10/2026 · Sprint SE | SE Clientes |
| L35 | O fechamento do caixa do dia pode ser reaberto? | A confirmar com o dono; a QA do SE protegeu o caixa fechado (`docs/qa-sprintSE.md`) | aberta | 13/10/2026 · Sprint SE | SE Financeiro (caixa do dia) |
| L36 | Valor da hora de mão de obra (custo da OS) | A confirmar com o dono; o painel usa um valor provisório no demo | aberta | 13/10/2026 · Sprint SE | SE Ficha da OS (Custos e Resultado) |
| — | Produção pode "pegar" etapas livres na fila? | Sem resposta (`docs/qa-sprintSD.md` item 6) | aberta | 12/10/2026 · QA do SD | — |

Nota L30–L36: IDs atribuídos pelo escrivão em 13/10/2026 às decisões novas do Sprint SE (o resumo não trouxe IDs); L34 e L19 se contradizem (CPF), e a L12 (4 entradas por dia) é outra medida que a L30 (10 peças/dia).

Nota L20: a ficha original sugeria "não desconta", mas o estudo da Maxpar (§2.1 passo 10) indica que ela paga a mão de obra autorizada menos a franquia. O questionário e o domínio foram alinhados em 12/10/2026 para "desconta"; segue provisório até o dono responder.

---

## Histórico (mais recente primeiro)

### 13/10/2026 Sprint SE — Visual clean e o que faltava frente ao concorrente (fechado na branch, falta checkpoint)
**Decisões tomadas:**
- Guilherme pediu para olhar o ERP que um concorrente montou para a oficina (app feito no Lovable), acrescentar o que esquecemos e deixar o painel "mais clean, profissional e bonito" — porquê: o irmão já viu o concorrente; o painel precisa cobrir o mesmo terreno e parecer melhor. Análise em `docs/concorrente-analise.md`. A senha do sistema do concorrente não foi registrada em lugar nenhum.
- Direção visual clean: fundo claro, barra lateral clara, Archivo em peso normal, raio 8/6, amarelo só em ação, item ativo, foco e "hoje", pílulas suaves; Placa Mercosul mantida; Quadro da TV continua escuro — porquê: leitura mais calma no escritório, identidade preservada onde ela ajuda (placa) e a TV legível de longe. Revisão SE em `docs/painel-design.md`; CLAUDE.md atualizado.
- Componentes genéricos unificados em `codigo/painel/src/componentes/ui/` (Gaveta, Campos, Abas, Periodo, Contagem, BotaoExterno, Tabela, FaixaIndicadores) — porquê: telas consistentes, achado da crítica final do designer.
- Decisões do dono novas, todas provisórias (L30–L36, ver tabela): capacidade de 10 peças/dia; checklist padrão de 21 itens; categorias financeiras de receita; estoque parado a partir de 90 dias; guardar CPF/CNPJ do cliente (conflita com "CPF não armazenado", L19, por LGPD); reabrir caixa existe ou não; valor da hora de mão de obra.

**O que foi implementado:**
- Clientes: lista, ficha com veículos, histórico e total pago, cadastro PF/PJ com CPF/CNPJ validado e endereço; Novo atendimento busca cliente existente.
- Receber o carro em 4 passos (dados, km, combustível e reclamação; checklist configurável; mapa de avarias em 5 vistas).
- Ficha da OS com abas Recepção, Custos (insumos do estoque, mão de obra, terceiros), Resultado (margem) e Pagamentos (forma, parcelas); impressão A4 do orçamento.
- Estoque com entrada (custo médio ponderado), retirada, movimentações, reposição, fornecedores, consumo por funcionário e CSV; Financeiro com competência, nova despesa e caixa do dia; Relatórios (tela nova, CSV); Geral com produção prevista e calendário de entregas; Ajustes com categorias, checklist e auditoria.
- QA em `docs/qa-sprintSE.md` e correções aplicadas (custos só para quem edita, receita única da OS, caixa fechado, devolução rastreada, cliente demo sem link, entre outras). 295 testes, lint 0 erros, build ok. Demo v3 (`ddoctor.demo.v3`), tudo fictício.

**O que ficou de fora (de propósito):**
- `listarProducao()` sem dados pessoais e custos fora da `OSVisao` — S1, junto com a RLS.
- Tabelas novas no banco: `custo_os`, `fornecedor`, `categoria_financeira`, `fechamento_caixa`, recepção/avarias, `baixa.parcelas`; `movimento_estoque.tipo` mudou — S1 (migrations do `arquiteto-dados`).
- Merge, tag `sprint-SE` e publicação — dependem do checkpoint do Guilherme com o irmão.

**Arquivos relevantes:**
- `docs/concorrente-analise.md`, `docs/qa-sprintSE.md`, `docs/painel-design.md` (revisão SE), `CLAUDE.md`, `notas/sprints/sprint-SE.md`, `codigo/painel/src/componentes/ui/`, `codigo/compartilhado/src/`

### 12/10/2026 Sprint SD — Design e telas v2 em memória (fechado)
**Decisões tomadas:**
- Guilherme aprovou o plano de execução (`docs/painel-execucao.md`) e pediu UI/UX como requisito ("não pode ser coisa feia") — porquê: o dono quer as informações visíveis e fáceis de identificar.
- Novo sprint SD antes do S1 — porquê: não há Docker no Mac (o S1 depende dele), o dono precisa ver as telas cedo, e telas sobre o Repositorio v2 sobrevivem à troca para o Supabase.
- Novo agente `designer-painel` e documento `docs/painel-design.md` (sistema visual) — porquê: pedido de UI/UX; a placa no formato Mercosul virou o identificador visual de cada carro.
- Fase 0 sem reunião longa: questionário curto para o dono responder com calma — porquê: o dono já descreveu a operação em `docs/espec-dono-v1.md`.
- Provisórios tomados pelo domínio (a confirmar com o dono): semáforo da OS só em "na oficina"; bloqueio fica vermelho após 4 h úteis; feriados não contam; mão de obra da Maxpar líquida da franquia; semáforo usa só o limiar absoluto de 8 h úteis.

**O que foi implementado:**
- Tipos v2 e domínio compartilhado em `codigo/compartilhado/src/` (placa, dinheiro, expediente e horas úteis, tempos, semáforo, máquina de estados da OS e da etapa, agenda e capacidade, financeiro, estoque), com 108 testes; repositório em memória com 21 carros fictícios realistas usando as mesmas regras; hooks TanStack Query; Dexie removido. S1a (dívida da QA do Sprint 0) absorvido pelo SD.
- Telas novas com o menu da espec: Geral, Orçamentos, Ficha da OS, Novo atendimento (30 s), Agenda (grade da semana com vagas, fila de agendamento, mensagem pronta para a Calia manual), Vistorias (galeria por fase), Produção (quadro por etapa), Quadro da TV (1920, paginação automática), Minhas tarefas (celular: Iniciar, Concluir, Impedimento), Recebíveis (aging), Financeiro, Estoque, Funcionários e Ajustes; seletor "Ver como" por papel; permissões por papel na interface; menu "Mais" no celular.
- Crítica visual do designer e revisão QA aplicadas: corrigido bug que devolvia OS da oficina para a fila; protocolo duplicado recusado; agenda recusa data passada e dia fechado. 133 testes. Publicado em https://guirink.github.io/ddoctor-site/painel/ (PIN 3316); branch `sprint/sd-design` mesclada na `main`, tag `sprint-SD`.
- Questionário curto para o dono (Claude Doc https://claude.ai/code/artifact/d237c76c-2ceb-43f8-b7d5-184b3bc1a024; índice em `docs/questionario-dono.md`).

**O que ficou de fora (de propósito):**
- Banco real, login individual e fotos reais — S1/S3 (precisa de Docker e da conta Supabase).
- Leitura "de produção" sem dados pessoais (`listarProducao`) — S1, junto com a RLS (`docs/qa-sprintSD.md` item 5).
- Ações sem suporte ainda: ajustar prazo com motivo, reordenar prioridade, criar bloqueio de agenda, edição em Ajustes, compras de estoque, lançar despesa, exportar CSV — não eram necessárias para o dono avaliar as telas; entram com o backend.

**Arquivos relevantes:**
- `docs/painel-design.md`, `docs/qa-sprintSD.md`, `docs/questionario-dono.md`, `docs/painel-execucao.md` (revisão de 12/10 no topo), `codigo/compartilhado/src/`, `codigo/painel/src/`, `.claude/agents/designer-painel.md`


### 02/10/2026 Sprint 0 — Fundação do painel (em andamento)
**Decisões tomadas:**
- Método: sprints curtos, cada um rodado em loop autônomo até fechar o checklist, com checkpoint do irmão entre sprints — porquê: muitos fatos da operação ainda estão em aberto; validar cedo evita construir sobre suposição, e o loop dentro do sprint evita micro-gerência.
- Stack: Vite + React 19 + TypeScript + Tailwind v4, HashRouter, Dexie (IndexedDB) atrás de uma interface `Repositorio`; Supabase só no Sprint 4 — porquê: funciona hoje sem conta em serviço nenhum e permite demo imediata; a troca de backend fica isolada numa camada.
- Deploy do painel no mesmo GitHub Pages da landing, em `/painel/`, com build no workflow — porquê: um link só para o cliente, custo zero.
- Estrutura do repositório migrada para o padrão da skill obsidian-codigo (`codigo/`, `notas/`, `docs/`) — porquê: padronizar com os outros projetos; `fotos/` e `media/` ficam fora do padrão por serem fonte bruta.
- Acesso ao painel nos Sprints 0–3 por PIN local — porquê: evitar tela errada em demonstração; login real vem com o Supabase.

**O que foi implementado:**
- Estudo da Maxpar (`docs/maxpar-estudo.md`): a Maxpar é a gestora de assistências do Grupo Autoglass, não plataforma de orçamento de sinistro; fluxo da oficina reconstruído; dores e lista priorizada do painel.
- Plano do painel (`docs/painel-plano.md`): método, stack, modelo de dados v1, cinco sprints.
- `CLAUDE.md`, agentes `escrivao`, `revisor-qa`, `frontend-painel`.
- Scaffold do app em `codigo/painel/`.

**O que ficou de fora (de propósito):**
- Integração com a Maxpar — porquê: não existe API pública; entrada será manual/colar texto.
- Orçamentação de sinistro de casco (Audatex/Cilia) — porquê: outro fluxo, sem evidência de uso pela oficina.

**Arquivos relevantes:**
- `docs/painel-plano.md`, `docs/maxpar-estudo.md`, `CLAUDE.md`, `.claude/agents/`, `codigo/painel/`

### 02/10/2026 Landing page — construída, revisada e publicada
**Decisões tomadas:**
- Filme da oficina gerado no Higgsfield (Kling 3.0) a partir das fotos reais, 6 clipes de 5 s, controlado pelo scroll — porquê: pedido do Guilherme ("vídeo que anda com o scroll") sem gastar com filmagem.
- Direção visual: a sinalização física da oficina (placa preta, D amarelo, piso zebrado) como interface — porquê: identidade já existe no lugar; não inventar uma nova.
- Scroll da sequência como um único movimento com inércia que encaixa no próximo take ao soltar, parando em quadros inteiros escolhidos por nitidez — porquê: três rodadas de feedback do Guilherme (travado → fluido → sem borrão → sem travar no fim).
- Repositório público `guiRink/ddoctor-site` com GitHub Pages — porquê: link imediato para o irmão.

**O que foi implementado:**
- `codigo/site/index.html` completo (hero, 6 capítulos, serviços, frase do Senna, fotos, contato), 240 quadros WebP desktop e mobile, fontes self-hosted, revisão impeccable com veredito "ship", `DESIGN.md`.

**O que ficou de fora (de propósito):**
- Endereço completo, horário e logo vetorial oficial — porquê: não confirmados pelo cliente; placeholders claros na página.

**Arquivos relevantes:**
- `codigo/site/index.html`, `codigo/site/frames/`, `DESIGN.md`, `PRODUCT.md`, `docs/landing-page.md`, `.github/workflows/pages.yml`
