# GusPainel (D doctor) — mapa

## Estado atual (sempre atualizado, sempre curto)
- Onde está: Sprint S1 (banco Supabase real + Equipe, Folha e Comissões) feito em 21–22/10/2026 na branch `sprint/s1-supabase`: migrations 0001–0015, 235 checagens, `RepositorioSupabase`, login, Edge Function `equipe-login`. Aplicado e testado no projeto de teste `ddoctor-teste` (235/235). Em aberto: publicação no domínio do dono e o banco oficial `ddoctor` (ainda sem as migrations). Antes: SH (22/10), SG (21/10), SF (20/10), SE (13/10), SD (12/10).
- Próximo passo: (1) dono cria conta Cloudflare, adiciona ddoctorauto.com.br e troca os nameservers no Registro.br (perguntar antes se há e-mail no domínio); (2) aplicar no `ddoctor` oficial com `aplicar.mjs oficial` (sem dados de exemplo), publicar a Edge Function lá, desligar o cadastro aberto, Site URL = https://ddoctorauto.com.br, criar o usuário do dono e rodar `definir_primeiro_dono`; (3) chave anon do oficial na configuração do build (nunca a service_role); depois checkpoint do dono e S2.
- Bloqueios: conta Cloudflare e troca de nameservers pelo dono; dono responder o questionário (1.1 tipos de reparo e etapas, trava o S3; 5.1 planilha financeira, trava o S4; as decisões L30–L36, L39–L44, L45–L55 e L64–L70 ainda não estão nele); L34 (CPF/CNPJ do cliente, LGPD) a confirmar com o dono antes de o banco oficial receber dados reais; dono decidir se a produção pode ver fotos de entrada de carros que ainda não pegou (L66) e se pode "pegar" etapas livres; endereço completo e horário da oficina para a landing; confirmar se Porto/Azul chegam via Carglass e não via Maxpar. OrbStack deixou de ser pré-requisito do S1 (o banco foi validado no PGlite e no projeto de teste).
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
| L11 | Quando o carro fica laranja? E vermelho? Quem muda prazo? | Original: laranja a partir de 8 h úteis (só limiar absoluto). Revista no SG: laranja a 80 % do prazo da etapa (ver L46). Vermelho vencido ou impedimento > 4 h úteis; dono e gestor mudam prazo; semáforo só em "na oficina" | revista (21/10/2026) | 12/10/2026 · questionário 2.2 a 2.4; revista em 21/10/2026 · Sprint SG | SD domínio (semáforo); SG semáforo por % do prazo |
| L12 | Entradas por dia, carros ao mesmo tempo, cabine ou boxes que limitam | 4 por dia; 12 simultâneos (só aviso); boxes das placas | provisória | 12/10/2026 · questionário 3.1 a 3.3 | SD Agenda (capacidade); SF Ajustes → Agenda e capacidade editável ("Confirmar" tira o provisório) |
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
| L25 | Conta Supabase de produção, plano Free ou Pro | Dois projetos grátis na org "D Doctor" (sa-east-1): `ddoctor-teste` (ref mogpmpypunsxxsbpeaef, dados de exemplo) e `ddoctor` oficial (ref pihmssohyyfcneeutbfq, zerado). Plano grátis (ver L37) | provisória | 12/10/2026 · questionário 8.1; atualizada em 22/10/2026 · Sprint S1 | S1 (teste aplicado; oficial pendente) |
| L26 | Endereço do painel: Cloudflare Pages + domínio ou GitHub Pages | Dono tem o domínio ddoctorauto.com.br (L64); Cloudflare Pages planejada com site em / e painel em /painel. Até lá, GitHub Pages + HashRouter | revista (22/10/2026) | 12/10/2026 · questionário 8.2; revista em 22/10/2026 · Sprint S1 | Deploy atual (GitHub Pages) |
| L27 | Worker no PC da oficina ou na nuvem (R$ 30–70/mês) | PC da oficina | provisória | 12/10/2026 · questionário 8.3 | — |
| L28 | Retenção de dados | Fotos: 12 meses depois da entrega, depois apagadas (com pacote para baixar antes); textos e números para sempre (estatística de anos); 12 meses snapshots/Calia | confirmada (fotos e dados) | 20/10/2026 · Guilherme, pelo dono | SF mostra a retenção de 12 meses nas fotos; S1/S3 Storage e rotina de retenção |
| L29 | Autorização escrita para leitura automática do portal | Sem ela o S6 não roda; só após L05/L06 favoráveis | aberta | 12/10/2026 · questionário 8.5 | — |
| L30 | Capacidade de produção em peças por dia | 10 peças/dia (valor visto no sistema do concorrente, sem confirmação) | provisória | 13/10/2026 · Sprint SE, `docs/concorrente-analise.md` | SE Geral (produção prevista contra a capacidade); SF Ajustes → Agenda e capacidade (editável; Geral e Agenda deixam de marcar provisório quando o dono confirma) |
| L31 | Itens do checklist de recepção do veículo | Checklist padrão de 21 itens, configurável em Ajustes | provisória | 13/10/2026 · Sprint SE | SE Receber o carro e Ajustes |
| L32 | Categorias financeiras de receita | Lista padrão provisória, editável em Ajustes | provisória | 13/10/2026 · Sprint SE | SE Financeiro e Ajustes |
| L33 | A partir de quantos dias o estoque conta como parado | 90 dias | provisória | 13/10/2026 · Sprint SE | SE Estoque |
| L34 | Guardar CPF/CNPJ do cliente? | Guardado (validado) no cadastro PF/PJ; conflita com o provisório da L19 ("sem CPF") e exige decisão de LGPD antes do banco real | provisória | 13/10/2026 · Sprint SE | SE Clientes |
| L35 | O fechamento do caixa do dia pode ser reaberto? | A confirmar com o dono; a QA do SE protegeu o caixa fechado (`docs/qa-sprintSE.md`) | aberta | 13/10/2026 · Sprint SE | SE Financeiro (caixa do dia) |
| L36 | Valor da hora de mão de obra (custo da OS) | A confirmar com o dono; o painel usa um valor provisório no demo | aberta | 13/10/2026 · Sprint SE | SE Ficha da OS (Custos e Resultado) |
| L37 | Infraestrutura sem mensalidade | Supabase grátis (conta do dono, Guilherme convidado), backup diário próprio fora do Supabase, fotos na Cloudflare R2 (10 GB grátis), site e painel na Cloudflare Pages com o domínio do dono | confirmada | 20/10/2026 · Guilherme (dono quer cortar gastos; US$ 25/mês do Supabase Pro descartado) | S1 em diante |
| L38 | Volume de fotos | ~15–20 carros/semana × ~50–60 fotos; comprimidas no celular (~200 KB + miniatura) ≈ 12–14 GB em regime com a retenção de 12 meses | confirmada (estimativa) | 20/10/2026 · Guilherme | SF compressão no aparelho (~200 KB + miniatura); S3 fotos |
| L39 | Validade do orçamento | 15 dias; não sai no PDF do cliente até o dono confirmar o prazo | provisória | 20/10/2026 · Sprint SF | SF Enviar orçamento (PDF) |
| L40 | Quem edita a capacidade (Agenda e capacidade) | O pedido era "só o dono"; seguiu a matriz de permissões, então o gestor também edita | provisória | 20/10/2026 · Sprint SF | SF Ajustes → Agenda e capacidade |
| L41 | Quem pode criar categoria de serviço (tipo de reparo) | Recepção também pode, no Receber o carro e em Ajustes → Tipos de serviço | provisória | 20/10/2026 · Sprint SF | SF Tipos de serviço |
| L42 | Tema padrão do painel | Automático (segue o aparelho); escolha Claro/Escuro/Automático salva por aparelho; placa e impressão sempre claras, TV escura | provisória | 20/10/2026 · Sprint SF | SF Modo escuro |
| L43 | Peças no cartão da TV | Não aparecem mais (cartões se ajustam ao espaço) | provisória | 20/10/2026 · Sprint SF | SF Quadro da TV |
| L44 | O que o PDF mostra no orçamento de seguradora | O total autorizado | provisória | 20/10/2026 · Sprint SF | SF Enviar orçamento (PDF) |
| L45 | Nome da tela de orçamentos | Voltou a "Orçamentos" a pedido do dono (no SG tinha virado "Atendimentos") | revista (22/10/2026) | 21/10/2026 · Sprint SG; revista em 22/10/2026 · 1º áudio do dono (`docs/revisao-sh/pedido-dono.md`) | SG Atendimentos; SH Orçamentos |
| L46 | Quando o carro fica laranja (semáforo) | A partir de 80 % do prazo da etapa ou entrega amanhã; configurável em Ajustes (revisa o limiar de 8 h da L11) | provisória | 21/10/2026 · Sprint SG | SG semáforo; Ajustes (laranja em %) |
| L47 | "Cliente não buscou" | A partir de 2 dias depois de pronto | provisória | 21/10/2026 · Sprint SG | SG Geral (Parados e atrasados) |
| L48 | Vistoria vencendo | Aviso a 2 dias do vencimento | provisória | 21/10/2026 · Sprint SG | SG Vistorias e Geral |
| L49 | Encaixe acima da capacidade na Agenda | Permitido, com aviso | provisória | 21/10/2026 · Sprint SG | SG Agenda (a função do Supabase precisa aprender `encaixe` no S1) |
| L50 | Quadrados de dinheiro no Geral | Mostram a quantidade de títulos/carros como número grande (o valor em R$ fica na segunda linha do quadrado; o dono pode preferir o R$ como número grande). No SH o Geral passou a ter só números, sem placas; clique abre a lista | revista (22/10/2026) | 21/10/2026 · Sprint SG; revista em 22/10/2026 · 1º áudio do dono | SG Geral; SH Geral |
| L51 | "Avisar cliente" ao mover carro confirmado | Guardado só no aparelho até existir o banco | provisória | 21/10/2026 · Sprint SG | SG Agenda; banco no S1 |
| L52 | Travar a entrega quando falta foto de saída | Hoje só avisa e deixa seguir (`docs/revisao-sg/plano.md`) | aberta | 21/10/2026 · Sprint SG, plano | SG aviso na entrega |
| L53 | Capacidade pesada pelo tamanho do serviço | Sem resposta; hoje conta peças (`docs/revisao-sg/plano.md`) | aberta | 21/10/2026 · Sprint SG, plano | — |
| L54 | Checklist "tudo ok" em um toque | Sem resposta (`docs/revisao-sg/plano.md`) | aberta | 21/10/2026 · Sprint SG, plano | — |
| L55 | Passar em lote as etapas de quem faltou | Sem resposta (`docs/revisao-sg/plano.md`) | aberta | 21/10/2026 · Sprint SG, plano | — |
| L56 | Cor do carro: quando fica laranja e vermelho | Pedido do dono: vermelho piscando = passou da entrega; vermelho = entrega em até 1 dia útil e nenhuma etapa concluída; laranja = entrega em até 1 dia útil com etapa concluída; verde = resto. Base de 1 dia útil é provisória (o dono pediu "hoje ou amanhã" e ajustável) | provisória | 22/10/2026 · 2º áudio do dono (`docs/revisao-sh/pedido-dono-2.md`) | SH `corDoCarro`; Ajustes → Cores dos carros |
| L57 | Vermelho piscando | Ligado por padrão; liga/desliga em Ajustes → Cores dos carros | provisória | 22/10/2026 · 2º áudio do dono (pediu como opção) | SH Ajustes e TV |
| L58 | Prazo padrão de entrega | 10 dias úteis a partir da entrada; ajustável por carro | provisória | 22/10/2026 · 2º áudio do dono (exemplo de 10 dias úteis) | SH Ajustes e Receber o carro |
| L59 | Carro sem data de entrega | Fica verde | provisória | 22/10/2026 · Sprint SH | SH `corDoCarro` |
| L60 | Carro parado e a cor | Parado não muda a cor; aparece como selo à parte | provisória | 22/10/2026 · Sprint SH | SH Produção e TV |
| L61 | O que conta em "Aguardando aprovação" | Orçamentos feitos e não aprovados, cada um conta como um; rascunho não entra | provisória | 22/10/2026 · 1º áudio do dono; rascunho fora por decisão do SH | SH Geral e Orçamentos |
| L62 | Carro atrasado e parado ao mesmo tempo | Aparece nas duas listas (Atrasados e Parados) | provisória | 22/10/2026 · Sprint SH | SH Geral |
| L63 | Feriados nos dias úteis da cor | Ainda não contam (a L10 prevê que feriados não contam; falta aplicar) | provisória | 22/10/2026 · Sprint SH | — |
| L64 | Domínio do dono | ddoctorauto.com.br (registro .com.br, no Registro.br); hospedagem planejada na Cloudflare Pages (conta a criar pelo dono). Falta trocar os nameservers e saber se há e-mail no domínio | decidida (domínio); hospedagem provisória | 22/10/2026 · Guilherme, pelo dono | Edge Function (CORS inclui o domínio); publicação pendente |
| L65 | Onde ficam as fotos no início | Supabase Storage privado (limite 2 MB por foto); ~1.000 fotos/mês ≈ 220 MB/mês, então o 1 GB grátis dura ~4 meses; depois troca para a Cloudflare R2. Complementa a L38 (que estimava 12–14 GB em regime) | provisória | 22/10/2026 · Guilherme, Sprint S1 | S1 Storage; aviso de uso e troca para R2 preparada |
| L66 | A produção pode ver as fotos de entrada de carros que ainda não pegou? | A confirmar com o dono | aberta | 22/10/2026 · Sprint S1 | S1 RLS das fotos (regra provisória do banco) |
| L67 | O gerente pode cadastrar funcionário? | A confirmar: só para recepção, produção e TV (nunca outro gerente, financeiro ou dono) | provisória | 22/10/2026 · Sprint S1 (revisão QA) | S1 Equipe e RLS |
| L68 | Comissão por tipo de serviço | A comissão cadastrada para o tipo de serviço é paga a cada etapa concluída; valor editável em Ajustes → Comissões | provisória | 22/10/2026 · Sprint S1 (pedido: pintura concluída = R$ 40) | S1 Folha e Ajustes → Comissões |
| L69 | Admissão no meio do mês na folha | Recebe o salário inteiro do mês | provisória | 22/10/2026 · Sprint S1 | S1 Folha |
| L70 | Feriados nos dias úteis (folha e banco) | Ficam fora dos dias úteis; pode ser a mesma regra da L63, que no painel ainda não aplica feriados | provisória | 22/10/2026 · Sprint S1 | S1 (a confirmar onde entra) |
| L71 | Quem vê o financeiro | Financeiro (A receber, Financeiro, Relatórios), folha, custos e margem só para o dono e a função financeiro; gerente vê quase tudo menos isso e menos salários; gerente só edita recepção e produção | decidida (pedido do Guilherme) | 22/10/2026 · Guilherme, Sprint S1 | S1 matriz de permissões e RLS (migrations 0001–0015) |
| — | Produção pode "pegar" etapas livres na fila? | Sem resposta (`docs/qa-sprintSD.md` item 6) | aberta | 12/10/2026 · QA do SD | — |

Nota L64–L71: IDs atribuídos pelo escrivão em 22/10/2026 (o resumo não trouxe IDs). A L34 (guardar CPF/CNPJ) segue provisória: confirmar com o dono antes de o banco oficial receber dados reais.

Nota L56–L63: IDs atribuídos pelo escrivão em 22/10/2026 (o resumo não trouxe IDs). Todas são provisórias até o dono salvar a base em Ajustes → Cores dos carros. A L46 (laranja a 80 % do prazo da etapa, semáforo da etapa) segue valendo; a cor do carro é uma regra separada, pela entrega.

Nota L45–L55: IDs atribuídos pelo escrivão em 21/10/2026 (o resumo não trouxe IDs). L45–L51 vêm do resumo; L52–L55 são as perguntas "precisa do dono" do plano do SG, registradas como abertas. L46 revisa a L11.

Nota L39–L44: IDs atribuídos pelo escrivão em 20/10/2026 às decisões provisórias novas do Sprint SF (o resumo não trouxe IDs).

Nota L30–L36: IDs atribuídos pelo escrivão em 13/10/2026 às decisões novas do Sprint SE (o resumo não trouxe IDs); L34 e L19 se contradizem (CPF), e a L12 (4 entradas por dia) é outra medida que a L30 (10 peças/dia).

Nota L20: a ficha original sugeria "não desconta", mas o estudo da Maxpar (§2.1 passo 10) indica que ela paga a mão de obra autorizada menos a franquia. O questionário e o domínio foram alinhados em 12/10/2026 para "desconta"; segue provisório até o dono responder.

---

## Histórico (mais recente primeiro)

### 21–22/10/2026 Sprint S1 — Banco Supabase real, Equipe, Folha e Comissões (feito na branch; publicação e banco oficial em aberto)
**Decisões tomadas** (L64 a L71; L25 e L26 atualizadas):
- Dois projetos Supabase grátis: `ddoctor-teste` com dados de exemplo e `ddoctor` oficial zerado — porquê: pedido do Guilherme; o dono começa limpo, o teste serve para ver e testar sem risco (L25).
- Domínio do dono é ddoctorauto.com.br; hospedagem na Cloudflare Pages com site em / e painel em /painel — porquê: sem mensalidade (L37) e com o domínio próprio do dono (L64, revisa L26).
- Fotos começam no Storage privado do Supabase (2 MB por foto) e depois migram para a R2 — porquê: ~1.000 fotos/mês ≈ 220 MB/mês, o 1 GB grátis dura ~4 meses (L65).
- Gerente sem financeiro, custos e salários; financeiro e folha só para o dono e a função financeiro; gerente edita só recepção e produção — porquê: pedido do Guilherme sobre quem vê dinheiro (L71) e achado da revisão QA.
- Comissão por tipo de serviço paga cada etapa; admissão no meio do mês recebe o salário inteiro; feriados fora dos dias úteis — porquê: pontos de partida provisórios para a folha (L68 a L70).
- Cadastro aberto ("Allow new users to sign up") desligado no teste; login de funcionário só pela Edge Function `equipe-login` com a service_role dentro do próprio Supabase — porquê: ninguém entra sem o dono criar o acesso; a chave secreta nunca vai ao front.
- Primeiro dono definido pela função `definir_primeiro_dono` (nome "Gustavo"; o e-mail do dono não é registrado aqui porque o repositório é público) — porquê: o banco não tem dono até alguém definir; `oficina_tem_dono` impede definir de novo.
- A confirmar com o dono: produção ver fotos de entrada de carros que ainda não pegou (L66); gerente cadastrar funcionário só de recepção, produção e TV (L67).

**O que foi implementado:**
- Banco completo em `codigo/supabase/`: migrations 0001–0015 (tabelas com RLS por papel, funções atômicas, views de recorte só leitura, Storage privado de fotos 2 MB, auditoria, tempo real, `oficina_tem_dono`, correções de segurança da revisão QA — views só leitura, OS travada, gerente sem editar financeiro/gerente, despesa paga, fotos da produção, configuração validada); 235 checagens em `checagens.sql` (rodam no PGlite e no projeto); seeds `producao.sql` (padrão, sem dados de exemplo) e `teste.sql` (fictício); `scripts/aplicar.mjs` (pede a senha escondida; `--so-migrations`).
- Edge Function `equipe-login`: dar, tirar e sincronizar login de funcionário.
- Painel: `RepositorioSupabase`, login por usuário ou e-mail, modo demonstração `?demo=1`, fotos no Storage com URL assinada, TV e quadro atualizando a cada 20–30 s; Equipe (funcionários, função, permissão, login, histórico), Folha (salário + comissões, pagar gera despesa "Salários") e Ajustes → Comissões.
- Aplicado no `ddoctor-teste`: 235 de 235 checagens; Edge Function publicada (verify JWT desligado, CORS inclui ddoctorauto.com.br); testes de gravação ok (cliente, iniciar etapa, foto no Storage, pagamento). `.gitignore` passou a proteger `.env*`; a chave anon do teste fica só em `codigo/painel/.env.local`.

**O que ficou de fora (de propósito):**
- Publicação no domínio ddoctorauto.com.br — porquê: depende de o dono criar a conta Cloudflare e trocar os nameservers no Registro.br.
- Banco oficial `ddoctor` (migrations, Edge Function, dono, Site URL, cadastro aberto desligado) — porquê: só depois da publicação e do checkpoint; produção do banco é à mão, pelo Guilherme.
- Chave anon do oficial no build da Cloudflare — porquê: o projeto oficial ainda não está aplicado; a service_role nunca entra no build.
- Fotos na R2 — porquê: começam no Storage do Supabase; a troca vem quando o 1 GB acabar (~4 meses).

**Arquivos relevantes:**
- `codigo/supabase/migrations/` (0001–0015), `codigo/supabase/checagens.sql`, `codigo/supabase/seed/` (`producao.sql`, `teste.sql`), `codigo/supabase/scripts/aplicar.mjs`, Edge Function `equipe-login` em `codigo/supabase/functions/`, `codigo/painel/src/` (`RepositorioSupabase`, Equipe, Folha, Ajustes → Comissões), `notas/sprints/sprint-S1.md`

### 22/10/2026 Sprint SH — Pedidos do dono em dois áudios (fechado; merge, tag e publicação em 22/10/2026)
**Decisões tomadas** (provisórias até o dono salvar a base em Ajustes → Cores dos carros — L56 a L63; L45 e L50 revistas):
- Os dois áudios do dono, transcritos pelo Guilherme, mandam no sprint (`docs/revisao-sh/pedido-dono.md` e `pedido-dono-2.md`) — porquê: é a voz do dono sobre o que ele quer ver ao abrir o painel.
- Geral só com números e clique abre as placas — porquê: o dono pediu "inicialmente só números, para não ficar muita informação" (revisa a L50).
- "Atendimentos" volta a "Orçamentos"; situações "Aguardando aprovação" e "Aguardando agendamento"; "Impedido" vira "Parado"/"Parada" em todo lugar — porquê: palavras do dono (revisa a L45).
- Cor do carro pela entrega e andamento (`corDoCarro`) com laranja e vermelho a 1 dia útil — porquê: o dono quer ver os carros que precisam de trabalho antes de o prazo estourar, sem "verde, verde, verde, laranja e vermelho".
- Piscar ligado por padrão, prazo padrão de 10 dias úteis, sem data de entrega = verde, parado não muda a cor — porquê: pontos de partida do áudio, editáveis; sem prazo não há como cobrar; parado é outra situação, mostrada em selo.
- "Aguardando aprovação" não inclui rascunho; carro atrasado e parado aparece nas duas listas — porquê: rascunho ainda não é orçamento feito; as duas situações são diferentes.
- Feriados ainda não contam nos dias úteis da cor — porquê: não foi aplicado neste sprint.

**O que foi implementado:**
- Geral: Na oficina · Entram hoje · Saem hoje; Atrasados e Parados separados, grandes e verdes em zero; Aguardando aprovação · Aguardando seguradora · Aguardando agendamento · Dinheiro vencido; clique abre as placas; quadrados brancos.
- Menu lateral amarelo com logo e barra de busca pretos (também no celular).
- Cor do carro: vermelho piscando = passou da entrega; vermelho = entrega em até 1 dia útil e nenhuma etapa concluída; laranja = entrega em até 1 dia útil com etapa concluída; verde = resto. Base em Ajustes → Cores dos carros (piscar liga/desliga, prazo padrão); ajuste por carro na ficha ("Ajustar prazo": urgente, prazo em dias úteis, dias antes para laranja/vermelho) e no Receber o carro.
- TV em mosaico (quadradinhos com placa e etapa pintados pela cor, piores primeiro, 30 por tela, contagem por cor e legenda; visão por etapas em `?visao=etapas`); Produção com a cor no cartão e filtros por cor.
- Lembrete "cobrar franquia" para a recepção em Para fazer hoje. Demo com 11 carros na oficina (3 novos para mostrar as cores).
- QA do 1º áudio: nada bloqueava; acertos aplicados. 488 testes, lint 0 erros, build ok.

**O que ficou de fora (de propósito):**
- Feriados nos dias úteis da cor — porquê: não aplicado ainda (L63).
- Itens do S1/banco e do dono (L52–L55) herdados do SG — porquê: seguem iguais.

**Arquivos relevantes:**
- `docs/revisao-sh/pedido-dono.md`, `docs/revisao-sh/pedido-dono-2.md`, `notas/sprints/sprint-SH.md`, `codigo/painel/src/`, `codigo/compartilhado/src/`

### 21/10/2026 Sprint SG — Revisão de produto: mecânico e especialista em sistemas (fechado; merge, tag e publicação em 21/10/2026)
**Decisões tomadas** (provisórias, a confirmar com o dono — L45 a L51; L52 a L55 abertas):
- Revisão feita por conversa entre um especialista em sistemas e um mecânico especialista, a pedido do Guilherme (ele odiou o Geral e achou partes confusas) — porquê: juntar o olhar de quem desenha o sistema e de quem vive o pátio; a conversa e o plano estão em `docs/revisao-sg/`.
- Princípios do plano: todo número abre a própria lista; uma contagem e um nome para cada coisa em todas as telas; palavras da oficina; uma ação amarela por tela; "provisório" discreto — porquê: o Geral tinha números sem lista e contagens que divergiam entre telas.
- Contagens únicas em `src/dominio/contagens.ts` (Na oficina = 8 no Geral, Produção, TV e Atendimentos) — porquê: o mesmo nome tinha números diferentes por tela.
- Semáforo por 80 % do prazo da etapa, configurável em Ajustes (L46, revisa a L11) — porquê: o limiar fixo de 8 h pintava quase tudo de laranja; o alvo é no máximo 2 de 7 carros laranja na demonstração.
- Nome "Atendimentos" no lugar de "Orçamentos" (L45) — porquê: a tela passou a cobrir o atendimento inteiro, não só o orçamento.
- "Cliente não buscou" a partir de 2 dias (L47) e vistoria vencendo a 2 dias (L48) — porquê: pontos de partida para o dono ajustar.
- Encaixe acima da capacidade permitido com aviso (L49) — porquê: a recepção precisa conseguir encaixar o carro urgente; o aviso mantém o controle.
- Quadrados de dinheiro mostram a quantidade como número grande (L50) — porquê: o valor fica na lista; o quadrado serve para ver o tamanho do problema.
- "Avisar cliente" guardado só no aparelho até o banco (L51) — porquê: não existe banco ainda.
- Quem paga é a seguradora (HDI, Liberty…), nunca "Maxpar" — porquê: a Maxpar é a gestora, não a pagadora.
- Aviso na entrega só avisa e deixa seguir (L52 aberta, travar a entrega sem foto) — porquê: travar é decisão do dono.

**O que foi implementado:**
- Geral em 6 quadrados com as placas dentro (Na oficina, Entram hoje, Saem hoje, Parados e atrasados, Esperando seguradora, Dinheiro vencido) e gaveta com a lista completa (tela cheia no celular); "Para fazer hoje" com quem faz; variações por papel (recepção, financeiro, produção em Minhas tarefas).
- Horários legíveis ("hoje 16h", "amanhã", "atrasado 1 dia"); Produção, TV e Minhas tarefas com uma pílula por cartão e "próximo carro pra mim"; demonstração com prazos em horas úteis.
- Atendimentos (ex-Orçamentos): busca na página, filtros de situação, seguradora, origem, valor e tempo (na URL), "há quanto tempo" na situação atual e soma no rodapé.
- Agenda de arrastar e soltar (`@dnd-kit`): um ou vários carros, fila para o dia, encaixe, desfazer, "Mover para…" no celular, Avisar cliente, Não veio.
- Ficha da OS: "Cliente deve" com regra única (`clienteDeveOS`), entrega prometida em destaque, Resultado parcial, aviso antes de entregar.
- Menu por papel (11 itens para o dono, Equipe, "Ver como" no menu do usuário, Quadro da TV como botão na Produção); A receber por seguradora; Relatórios dentro do Financeiro; Estoque enxuto (Acabando, Lista de compra); Ajustes com "A confirmar" e laranja em %.
- QA: nada bloqueava; 5 importantes e menores corrigidos (Na oficina = 8 em Atendimentos, Cliente deve com regra única, laranja na sexta, Não veio só confirmado, proposta mantém validade, seguradora nunca Maxpar). 436 testes no painel e 225 no compartilhado, lint 0 erros, build ok.

**O que ficou de fora (de propósito):**
- Precisa de banco (S1): complemento por dano oculto, peça encomendada com data prevista, glosa na baixa, mudança de prazo com motivo, decisão do cliente sobre item negado, retrabalho e garantia ligados à OS, carro reserva, vagas por turno, "Avisar cliente" no banco, `encaixe` na função do Supabase — porquê: dependem de tabelas e funções que só existem com o banco real.
- Precisa do dono (L52–L55): travar a entrega sem foto, capacidade pesada pelo tamanho do serviço, checklist "tudo ok" em um toque, passar em lote as etapas de quem faltou — porquê: são regras de operação que não cabe ao painel decidir.

**Arquivos relevantes:**
- `docs/revisao-sg/` (`pedido.md`, `mecanico-r1.md`, `sistemas-r1.md`, `mecanico-r2.md`, `sistemas-r2.md`, `plano.md`), `notas/sprints/sprint-SG.md`, `codigo/painel/src/dominio/contagens.ts`, `codigo/painel/src/`, `codigo/compartilhado/src/`

### 20/10/2026 Sprint SF — Pedidos do dono (fechado; merge e publicação em 20/10/2026)
**Decisões tomadas** (todas provisórias, a confirmar com o dono — L39 a L44):
- Validade do orçamento de 15 dias fica fora do PDF do cliente até o dono confirmar o prazo — porquê: o prazo é palpite; não pode virar promessa ao cliente.
- Gestor também edita a capacidade — porquê: o pedido era "só o dono", mas a matriz de permissões já deixa o gestor mudar prazos; seguiu-se a matriz.
- Recepção pode criar categoria de serviço — porquê: é quem recebe o carro e encontra o tipo que falta na hora.
- Tema padrão automático, salvo por aparelho; placa e impressão sempre claras, TV escura — porquê: placa e papel precisam de contraste fixo; a TV é lida de longe.
- Peças saem do cartão da TV — porquê: os cartões passaram a se ajustar ao espaço e a TV mostra todas as etapas.
- No orçamento de seguradora o PDF mostra o total autorizado — porquê: é o valor que a seguradora aprovou.
- Fotos comprimidas no aparelho (~200 KB + miniatura), com a retenção de 12 meses (L28) mostrada ao usuário — porquê: segue a infraestrutura sem mensalidade (L37, L38).

**O que foi implementado:**
- Modo escuro: Claro, Escuro ou Automático, lembrado por aparelho.
- Enviar orçamento: PDF real (jsPDF carregado sob demanda, em chunk separado); no celular compartilha direto (WhatsApp); no computador baixa o PDF e abre o WhatsApp com a mensagem pronta.
- Concluir etapa com foto de verdade (câmera, galeria ou arquivo), guardada no IndexedDB no demo; Vistorias também adicionam fotos.
- Nova categoria de serviço com suas etapas, em Receber o carro e em Ajustes → Tipos de serviço.
- Ajustes → Agenda e capacidade editável (entradas por dia, carros simultâneos, peças por dia, semáforo); "Confirmar" tira o selo de provisório (Geral e Agenda acompanham).
- Produção e TV refeitas: todas as etapas na tela, etapas vazias numa linha só, visão Quadro/Lista, abas por etapa no celular, painel do carro sobreposto; TV com cartões que se ajustam e paginação por coluna.
- QA: nada bloqueava; 4 itens importantes corrigidos (paginação da TV, prévia do PDF, provisório na Agenda, fotos resilientes) mais menores (envio só para quem edita orçamentos, Vistorias durante o envio). 329 testes, lint 0 erros, build ok.

**O que ficou de fora (de propósito):**
- Permissões no banco para fotos, configuração e tipos de serviço (RLS + pgTAP) — S1, junto com o banco real.
- Fotos no Cloudflare R2 — S1/S3; no demo ficam no aparelho.

**Arquivos relevantes:**
- `notas/sprints/sprint-SF.md`, `codigo/painel/src/`, `codigo/compartilhado/src/`

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
