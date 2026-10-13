# Painel D doctor: plano de execução

> Este documento diz **como** construir o painel. O **quê** está em `docs/espec-dono-v1.md` (voz do dono), `docs/painel-arquitetura.md` (técnico) e `docs/painel-informacoes.md` (campos). Data: 12/10/2026. Ele substitui a seção 5 de `docs/painel-plano.md`.
>
> **Regra de honestidade:** até o portão G1 (inspeção da conta Maxpar), nada da Maxpar é automático. A Maxpar entra no painel pela **entrada rápida** (digitação em 30 s). Ela faz parte do produto e não é um remendo.

---

## 1. Resposta direta: um passo só ou vários?

**Vários: 5 fases, 10 sprints e tarefas.** O loop autônomo roda só dentro de cada sprint. Um passo único não serve aqui, por cinco motivos:

- **Há decisões do dono em aberto.** São 12 na arquitetura (§11.1) e 15 nas informações (§9). Várias mexem no esquema do banco: quando a OS nasce, etapas, financeiro. Construir tudo de uma vez é gravar suposição em migrations, e migration é cara de desfazer.
- **Há 4 portões externos (G1–G4)** que não dependem de código. O G1 pode cancelar o Sprint 6 inteiro (leitor do portal).
- **O escopo é grande:** 11 abas, TV, celular, worker, duas integrações e RLS por papel. Nenhum loop único segura contexto e qualidade nesse tamanho.
- **O dono precisa ver valor cedo.** O pátio é a dor diária. Ele vem primeiro e valida o modelo antes do financeiro.
- **O contrário também não serve:** um sprint por tarefa geraria micro-gerência. Dentro do sprint o loop roda sozinho. O humano entra no começo (aprova o checklist) e no fim (checkpoint).

**Forma**

| Nível | Termina quando | Quem decide que terminou |
| --- | --- | --- |
| **Fase** (objetivo de negócio) | O dono sente o marco (ex.: "o pátio saiu da planilha") | O dono |
| **Sprint** (bloco demonstrável) | Critério de pronto verificável + checkpoint | Guilherme + dono |
| **Tarefa** (linha de `notas/sprints/sprint-N.md`) | Testes e build verdes + commit | O loop |

**O que roda em loop autônomo dentro do sprint:** tarefa → agente responsável → `db reset`/testes/lint/build → conferência no navegador → commit → próxima tarefa. **O loop para e pergunta só quando:**
- falta uma decisão do dono que não tem provisório;
- algo exige conta, credencial ou ação no portal Maxpar;
- a mesma falha persiste depois de 3 tentativas;
- é preciso alterar uma migration já commitada ou um contrato de `codigo/compartilhado/` usado em outro sprint.

**O que nunca roda em loop:**
- a reunião com o dono e o G1;
- a criação de contas;
- o `supabase db push` em produção;
- o checkpoint.

---

## 2. Fase 0: preparação com o dono (antes de qualquer código novo)

**Ordem:** S1a (1 sessão, deixa o demo sem bugs) → reunião (até 2 h) → S1 começa enquanto o dono faz a lição de casa.

### 2.1 Preparar antes (Guilherme, cerca de 1 h)

- [ ] S1a fechado e publicado (o demo é o bloco 1 da reunião).
- [ ] Ficha 2.4 impressa em paisagem e as três planilhas-modelo (2.5) em Google Sheets ou .xlsx, prontas para compartilhar.
- [ ] Combinar com o dono que ele estará **logado na Maxpar no computador dele**.
- [ ] Notebook com `docs/maxpar-g1.md` aberto, em branco, com os títulos do checklist 2.3.

### 2.2 Roteiro da reunião (110 min)

| # | Min | Bloco | O que fazer | Itens da ficha |
| --- | --- | --- | --- | --- |
| 1 | 10 | Demo e plano | Mostrar o painel publicado. Explicar: "primeiro o pátio, depois o dinheiro, depois a Maxpar automática se der" | — |
| 2 | 30 | **G1: Maxpar** | O dono navega e o Guilherme anota (regras em 2.3) | L01–L07 |
| 3 | 20 | Como o carro anda | OS, etapas, prazos, cores, capacidade. Entregar a M1 para ele preencher | L08–L14 |
| 4 | 10 | Pessoas e aparelhos | Andar até o pátio: ver TV, Wi-Fi, PC da recepção. Entregar a M2 | L15–L17 |
| 5 | 15 | Dinheiro | Pedir a planilha. NF, prazos, franquia. Entregar a M3 | L18–L22 |
| 6 | 5 | Calia | Regras de contato. Contato do fornecedor | L23–L24 |
| 7 | 15 | Contas e custos | Supabase (Free × Pro), endereço/domínio, onde roda o worker, retenção. Marcar a sessão de criação de contas | L25–L28 |
| 8 | 5 | Fechamento | Ler em voz alta os provisórios que ficaram. Prazo da lição de casa (M1, M2, M3, planilha, termos de uso). Data do checkpoint do S1 | — |

### 2.3 Regras do G1 (inspeção sem gravar credenciais)

- [ ] O dono digita a senha. O Guilherme não vê, não anota e não salva no navegador dele.
- [ ] Só navegar e ler. **Nenhum clique** em enviar, encerrar, aceitar ou salvar.
- [ ] Prints só de telas estruturais. Nome, telefone, CPF e placa ficam borrados antes de sair do computador. Os prints vão para `media/g1/`, que fica fora do git (**o repositório é público**).
- [ ] Observar:
  - qual portal a oficina usa e quantos usuários tem;
  - na lista: colunas, filtros, paginação e **exportação**;
  - no detalhe: status (anotar **todos os textos** vistos), peças, técnica, valor, teto, franquia, data-limite, previsão, fotos;
  - a tela "Serviço Realizado / Avaliação de Danos";
  - "Pendência Fornecimento" e "Saldo Fornecimento";
  - MFA, CAPTCHA e quanto dura a sessão.
- [ ] Pedir cópia dos termos de uso ou do contrato de credenciamento. **Não pedir ainda autorização de automação** (isso é o L29, só depois de ler os termos).
- [ ] Resultado em `docs/maxpar-g1.md`, sem dados pessoais e sem URL com token. Termina com veredito: *ArquivoReader viável? PortalReader candidato?*

### 2.4 Ficha de levantamento (levar impressa)

"Antes de": o primeiro sprint que trava sem a resposta. "Se não vier": o valor que o painel usa, rotulado "provisório — a confirmar".

| ID | Pergunta | Formato · quem entrega | Antes de | Se não vier (provisório) | Resposta |
| --- | --- | --- | --- | --- | --- |
| L01 | Qual portal a oficina usa (Área do Credenciado ou Portal do Prestador)? Quantos usuários? | Inspeção · Guilherme anota | S5 | Sem leitor; só entrada manual | |
| L02 | A lista tem exportação (Excel/CSV) ou "Impressão de Serviço" em PDF? | Inspeção + print anonimizado | S5 | S5 sem ArquivoReader | |
| L03 | Que status existem? O que o detalhe mostra (peças, técnica, valor, teto, franquia, data-limite, previsão, fotos)? | Prints anonimizados | S2, S5 | Campos (H) opcionais em `dados_brutos` | |
| L04 | O que a Maxpar exige para encerrar? O que mostram "Pendência" e "Saldo Fornecimento"? | Prints | S3, S4 | Checklist dos 5 itens do Sprint 0 | |
| L05 | O login tem MFA ou CAPTCHA? Quanto dura a sessão? | Observação | S6 | PortalReader não é construído | |
| L06 | Os termos de uso ou o contrato de credenciamento falam de automação? | Cópia do documento · dono | S6 | PortalReader não é construído | |
| L07 | Que campos a recepção olha no portal todo dia? Vai copiar para o painel desde já? | Resposta curta · dono + recepção | S2 | Obrigatórios: protocolo, seguradora, placa, peças; o resto opcional | |
| L08 | A OS nasce quando o caso aparece, quando é aprovado ou quando o carro entra? Dois atendimentos no mesmo carro viram uma OS? | Resposta curta · dono | S1 (ideal), S2 | Nasce na entrada rápida como rascunho; 1 OS com N atendimentos, vínculo manual | |
| L09 | Tipos de reparo, etapas em ordem, prazo de cada etapa | Planilha M1 · dono | **S3 (duro)** | 4 tipos de informações §4 | |
| L10 | Expediente? Sábado? Dias úteis ou corridos? Prazo total típico por tipo? | Resposta curta | S3 | Seg–sex 8–18, sáb 8–12; soma das etapas + 20 % | |
| L11 | Quando o carro fica laranja? E vermelho? Quem pode mudar prazo? | 3 números + nomes | S3 | 8 h úteis / vencido / impedimento > 4 h; dono e gestor | |
| L12 | Entradas por dia? Carros ao mesmo tempo? Cabine ou boxes que limitam? | Resposta curta | S2 | 4 por dia; 12 simultâneos (só aviso); boxes das placas | |
| L13 | Vistoria final é obrigatória para entregar? Peças contadas por peça ou por ponto? Garantia: prazo, e vira OS? | Resposta curta | S3 | Aviso; por peça autorizada; 90 dias, OS "garantia" sem título | |
| L14 | Não compareceu: tolerância e quem marca? Previsão ao cliente é data ou data + hora? | Resposta curta | S2 | 2 h após a janela, recepção; só data | |
| L15 | Quem trabalha, função, celular próprio ou terminal, e-mail | Planilha M2 · dono | S1 (seed), S3 | 1 dono, 1 recepção, 3 produção em terminal | |
| L16 | Quem faz as tarefas no portal Maxpar? Quem registra entrada e entrega? | Nomes | S2 | Recepção | |
| L17 | Tem TV na oficina? O Wi-Fi chega no pátio? Tem PC na recepção? | Foto / resposta | S3 | TV com navegador ou stick (orçar); sem Wi-Fi, celular com dados | |
| L18 | Planilha financeira atual | Arquivo .xlsx · dono (vai para `media/`) | **S4 (duro)** | Campos de informações §3.8–3.9 | |
| L19 | NF: emite para quem (Maxpar, franquia)? Quem emite? Precisa CPF? | Resposta curta | S4 | NF registrada à mão; obrigatória no título Maxpar; sem CPF | |
| L20 | Prazo real de pagamento por pagador. A Maxpar desconta a franquia? | Planilha M3 | S4 | Maxpar 30 dias corridos após a doc.; não desconta | |
| L21 | Franquia recebida na entrada ou na entrega? Categorias de despesa? Comissão existe e o funcionário vê? | Resposta curta | S4 | Na entrega; categorias de §4; comissão só o dono vê | |
| L22 | Quais seguradoras vêm via Maxpar, direto ou via Carglass? Teto e franquia de cada uma | Planilha M3 | S2, S4 | Lista pública, todas via Maxpar; R$ 1.000 / R$ 160 | |
| L23 | Calia: horário permitido, tentativas, sem resposta, quem assume | Resposta curta | S7 | Seg–sex 9–18, sáb 9–12; 2 tentativas a cada 24 h; depois recepção | |
| L24 | Contato do fornecedor da Calia e documentação/API (G3) | E-mail ou contato · dono | S7 (parte B) | Modo manual (texto pronto) | |
| L25 | Conta Supabase de produção (G2), plano Free ou Pro | Dono cria em sessão guiada e convida o Guilherme | P1 | Dev local + projeto demo do Guilherme, só dados fictícios | |
| L26 | Endereço do painel: Cloudflare Pages + domínio próprio, ou GitHub Pages (G4a) | Decisão; domínio registrado pelo dono | S2 (ideal), P1 | GitHub Pages + HashRouter | |
| L27 | Worker no PC da oficina (ligado no expediente) ou na nuvem a R$ 30–70/mês (G4b) | Decisão | S5 | PC da oficina | |
| L28 | Retenção: 5 anos financeiro, 24 meses fotos, 12 meses snapshots/Calia | Ok ou ajuste | P1 | Propostas da arq. §9.3 | |
| L29 | Autorização escrita para leitura automática do portal | Mensagem ou documento · dono | S6 | Só após L05/L06 favoráveis; sem ela o S6 não roda | |

### 2.5 Planilhas-modelo (deixar com o dono)

**M1: Tipos de reparo**

| Tipo de reparo | Ordem | Etapa | Prazo padrão (h) | Pode pular? | Exige foto? | Conta peças? | Quem costuma fazer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

**M2: Pessoas**

| Nome | Função | Especialidade | Celular próprio ou terminal | E-mail (se tiver) | Pode mudar prazo? |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

**M3: Pagadores**

| Pagador | Chega via (Maxpar/direto/Carglass) | Prazo conta a partir de (NF/entrega/envio da doc.) | Dias | Úteis ou corridos | Teto | Franquia | Desconta franquia? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

### 2.6 Depois da reunião (mesmo dia)

- [ ] `docs/maxpar-g1.md` escrito, com veredito.
- [ ] Respostas na tabela "Decisões do dono" de `notas/mapa.md` (via `escrivao`), cada uma como decidida, provisória ou aberta.
- [ ] Prints em `media/g1/`, já borrados.
- [ ] Se o G1 mudou S5 ou S6, ajustar a §4 deste documento.
- [ ] Lembrete em 5 dias úteis: M1, M2, M3, planilha, termos de uso.

---

## 3. Agentes

### 3.1 Quem faz o quê

| Agente | Papel | Entra em | Entradas | Saídas | Ferramentas | Modelo | Situação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| (principal) | Orquestra o sprint: escreve o checklist, delega, integra, faz os commits | Todos | Este documento, mapa, checklist | Commits; `notas/sprints/sprint-N.md` | Todas | opus | — |
| `arquiteto-dados` | Migrations, RLS, triggers, funções SQL, views, Storage, seed, pgTAP | S1–S5, S7 | Arq. §6, §7, §9.1; tarefa | `codigo/supabase/**`, `banco.gerado.ts` | Read, Write, Edit, Bash, Glob, Grep | opus | **Novo** |
| `dominio-regras` | Regras puras em TS + Vitest: estados, semáforo, horas úteis, capacidade, vencimento, aging, estoque, margem, pré-condições da Calia; contratos | S1–S4, S7 | Arq. §6.3, §7, §8; informações §3–5 | `codigo/compartilhado/**`, `src/dominio/**` | Read, Write, Edit, Bash, Glob, Grep | opus | **Novo** |
| `frontend-painel` | Telas: Orçamentos, Agenda, Produção, TV, celular, Vistorias, Recebíveis… | S1–S8 | Arq. §5; informações §3; DESIGN.md | `src/telas`, `src/componentes`, `src/dados/hooks` | Read, Write, Edit, Bash, Glob, Grep | opus | Existe; **reescrever** (Anexo B) |
| `testes-e2e` | Playwright: um teste por CA da espec e por papel, em 390, 1366 e 1920 px | S2–S8 | Espec §10; seed; esta §4 | `codigo/painel/e2e/**`, relatório | Read, Write, Edit, Bash, Glob, Grep | sonnet | **Novo** |
| `integracao` | Worker, fila, backup, leitores Maxpar, normalizador, conciliação, Calia | S5–S7, **só com portão aberto** | Arq. §2, §8, §9.4–9.5; `maxpar-g1.md` | `codigo/worker/**`, Edge Functions de integração | Read, Write, Edit, Bash, Glob, Grep | opus | **Novo** |
| `revisor-qa` | Revisa o diff: bugs, regras, RLS, segredos, estados, a11y; roda tudo; não edita | Fim de cada sprint | Diff `main...HEAD` | Lista por severidade | Read, Bash, Glob, Grep | opus | Existe; **ajustar** |
| `escrivao` | Mantém mapa (com Decisões do dono), status por fase, Atualização noturna | Fim de cada sprint e depois da Fase 0 | Resumo compacto | `notas/*`, `Atualização noturna.md` | Read, Write, Edit, Glob, Grep | sonnet | Existe; **ajustar** |

### 3.2 Agentes que não foram criados, e por quê

- **`ux-operacao`:** já existe a skill `impeccable`, usada no Sprint 0 (`.impeccable/`). Usar em modo critique/audit na TV (1920) e no celular (390) no S3 e no S8. A validação de uso real é presencial (TV a 3 m, funileiro de luva) e nenhum agente substitui isso.
- **`integracao-maxpar` e `integracao-calia` separados:** os dois vivem no mesmo processo (`codigo/worker`), seguem o mesmo padrão de idempotência e segredos, e a Calia pode ficar só no modo manual. Um agente só, com portões explícitos, basta.
- **Agente de segurança:** usar `/security-review` antes de entrar dado real (P1, S6, S8), além do `revisor-qa`.

### 3.3 Ajustes nos agentes existentes

**`frontend-painel`:** reescrever inteiro (texto no Anexo B). O texto atual fala de Dexie e de `painel-plano.md`. Passa a usar Supabase atrás de `Repositorio` + TanStack Query, papéis, proveniência, TV e celular.

**`revisor-qa`** (trocar estes trechos):
- **Description:** stack "(Vite + React + TS + Tailwind v4 + TanStack Query + Supabase)".
- **Primeiro parágrafo:** "Leia `CLAUDE.md`, `docs/painel-arquitetura.md` §6, §7 e §9.1, o checklist `notas/sprints/sprint-N.md` e `DESIGN.md`."
- **Passo 2:** "Rode `cd codigo && supabase db reset && supabase test db`; `cd codigo/painel && npm test -- --run && npm run lint && npm run build`; e `npx playwright test` se `e2e/` existir."
- **Item (b):** "tudo passa por hooks de `src/dados/` sobre `Repositorio`; nenhum import de `@supabase/supabase-js` em `src/telas` ou `src/componentes`; mutações invalidam as queries."
- **Item (f):** "dados demo só em `seed.sql` (`oficina-demo`)."
- **Acrescentar (h) banco:** toda tabela nova tem RLS, políticas por papel conforme §9.1 e teste pgTAP; nenhuma migration commitada foi editada; funções `security definer` com `search_path` fixo; tabelas imutáveis sem UPDATE/DELETE.
- **Acrescentar (i) segredos e privacidade:** nenhuma chave, credencial ou dado real em código, seed, fixture, log ou print; `service_role` fora do front; logs sem PII.
- **Acrescentar (j) critérios:** os CA que o sprint diz fechar têm teste e estão verdes.
- **No fim:** "O agente principal grava em `docs/qa-sprintN.md` o que não for corrigido."

**`escrivao`** (acrescentar):
- Manter em `notas/mapa.md` a seção **"## Decisões do dono"** (formato em 6.5), entre "Estado atual" e "Histórico". Atualizar a linha quando o resumo trouxer resposta; nunca apagar linha.
- `notas/status.md` organizado **por fase** e com o bloco de CA (formato em 6.4).
- `Atualização noturna.md` no formato de 6.6, com a linha "Onde estamos" (fase, sprint, portões).
- Nunca citar `docs/painel-plano.md` como fonte atual.

---

## 4. Fases e sprints

### 4.1 Fases

| Fase | Marco de negócio | Sprints | Termina quando |
| --- | --- | --- | --- |
| **0: Preparação** | Sabemos o que construir e o que ainda é suposição | S1a + reunião + lição de casa | Ficha preenchida, G1 feito, decisões na tabela |
| **1: O pátio sai da planilha** | Recepção e produção usam o painel para todo carro | S1, S2, S3, P1 | 5 dias úteis com o pátio só no painel |
| **2: O financeiro sai do Excel** | O dono fecha o mês no painel | S4 | Mês fechado no painel bate com a planilha |
| **3: Integrações** | Menos digitação: Maxpar por arquivo ou portal, Calia | S5, S6 (condicional), S7 | O que os portões permitiram roda sem duplicar |
| **4: Piloto completo** | A planilha é aposentada | S8 | Semana sem planilha paralela; restauração testada |

**Caminho crítico e paralelos**

```
Crítico:  S1a → Reunião F0 → S1 → S2 → S3 → P1 → S4 → S8

Paralelos (git worktree separado, no máximo 2 trilhas ao mesmo tempo):
  S4  em paralelo a S3/P1 se L18–L21 já chegaram (tabelas distintas; conflito só em Geral/Ajustes)
  S5  depois de S2 + G1 (docs/maxpar-g1.md fechado) + L27
  S6  depois de S5, só com L05/L06 favoráveis + L29
  S7-A (Calia manual) depois de S2;  S7-B (HTTP) só com G3
  S8  espera S4 e o que existir de S5–S7 (não espera portão que não abriu)
```

**Tamanho relativo:** P ≤ 2 sessões; M = 3–5 sessões; G = 6–10 sessões. Uma sessão é um bloco de 2–3 h no VS Code com o loop rodando. São estimativas, não prazo.

**Desvio consciente da arquitetura §10:** as migrations são **incrementais por sprint**. O S1 cria só o núcleo da Fase 1. Financeiro e estoque entram no S4, sincronização no S5, Calia no S7. Assim nenhum esquema nasce de suposição antes da resposta do dono.

### 4.2 Critérios de aceitação da espec (§10): onde cada um fecha

| CA | Critério | Fecha em |
| --- | --- | --- |
| CA1 | Mesmo veículo com várias OS sem misturar fotos, valores e aprovações | S2 (OS e aprovação), S3 (fotos), S4 (valores) |
| CA2 | Importar duas vezes não duplica; conflito visível e revisável | S5 |
| CA3 | Dados mostram origem e data; o painel funciona com cadastro manual | S2 (manual), S5 (importado) |
| CA4 | Agenda impede confirmar acima da capacidade; reagendar libera a vaga | S2 |
| CA5 | Etapa concluída libera a próxima; bloqueio e dispensa exigem motivo; fila e execução são tempos distintos | S3 |
| CA6 | Alertas seguem o tipo de reparo e os ajustes auditados; prazo global visível | S3 |
| CA7 | Vistorias com fotos por OS, placa e fase, com autor, data e permissões | S3 |
| CA8 | Compra e uso de material afetam o estoque; o caixa só registra o efetivo | S4 |
| CA9 | Vencimento pela regra do pagador; baixa parcial | S4 |
| CA10 | Calia não dispara duas vezes; exceções vão para a recepção | S7 |
| CA11 | Tarefas no portal ficam visíveis e nunca aparecem "sincronizadas" sem confirmação | S2 |

### 4.3 Dívida da QA do Sprint 0 (`docs/qa-sprint0.md`)

| Itens | Onde fecha | Como |
| --- | --- | --- |
| 1, 2, 3 (bloqueiam) | S1a | Corrigir, com teste (placa com 8 ou mais caracteres; recusa no mesmo dia via `parseISO`) |
| 4, 5, 8, 9, 10, 11, 15, 18, 19 | S1a | Texto e marcação baratos que aparecem no demo da reunião ("provisório — a confirmar", "autorizado ainda não pago", "venceu há N dias", Sair no celular, `aria-label`, `scope`, README) |
| 13 | S1a | Adendo "Painel" no DESIGN.md (`alerta`, `ok`, `amarelo-escuro`); `bg-white` vira papel + fio |
| 6, 7 | S1 | Hooks TanStack Query sobre o Repositorio v2 e componente de erro padrão |
| 14, 16, 17 | S1 | Regras migram para o domínio v2 com testes; `seed.sql` substitui `demo.ts` |
| 12 | S1 | Capturas refeitas no shell novo; o seed é recriado por `db reset` |

### 4.4 Sprints

#### S1a: Dívida da QA que sobrevive · Fase 0 · **P**

| | |
| --- | --- |
| Objetivo | O demo que o dono verá na reunião, sem bugs e sem prazo inventado apresentado como fato |
| Entregas | Itens da linha S1a em 4.3; `docs/qa-sprint0.md` com cada item marcado |
| Agentes | Principal → `revisor-qa` (só nos arquivos tocados) → `escrivao` |
| Dono antes | Nada |
| Pronto quando | Testes novos verdes; captura 390 px sem rolagem horizontal (`shot.mjs`); todo prazo rotulado como provisório; publicado |
| Checkpoint | É o bloco 1 da reunião da Fase 0 |
| Riscos | Polir código Dexie que morre no S1. Limite rígido à lista; nenhuma funcionalidade nova |

#### S1: Fundação v2 · Fase 1 · **G**

| | |
| --- | --- |
| Objetivo | Banco real, login por papel e regras testadas, sem mudar o que o dono vê |
| Entregas | **(a)** Docker Desktop ou OrbStack instalado pelo Guilherme (hoje não há Docker no Mac); `supabase init` em `codigo/`; dependências instaladas com `npm_config_cache=/tmp/npm-cache`. **(b)** `codigo/compartilhado/` (enums, tipos, contratos) importável pelo painel e pelo CI, com workflow ajustado. **(c)** Migrations do núcleo: oficina, perfil, config_oficina, cliente, veiculo, atendimento_externo, os, os_atendimento_externo, orcamento, orcamento_versao, item_orcamento, aprovacao, tipo_reparo, modelo_etapas(+item), etapa_os, bloqueio_etapa, ajuste_prazo, capacidade_dia, bloqueio_agenda, agendamento, pendencia_externa, registro_contato, evento_auditoria; RLS; triggers; `reservar_vaga`, `iniciar/concluir/bloquear_etapa`; seed demo com um usuário por papel. **(d)** Domínio: máquinas de estado de §7.2, semáforo e tempos em horas úteis, capacidade, placa. **(e)** Repositorio v2 + `RepositorioSupabase` + `RepositorioMemoria`; hooks TanStack Query; componente de erro; login Supabase no lugar do PIN; o build publicado usa Memória até o G2; Dexie removido; lint proíbe supabase-js e dexie em `src/telas` e `src/componentes` |
| Agentes | `arquiteto-dados` em paralelo com `dominio-regras` (no 1º dia: o arquiteto gera `banco.gerado.ts` e o domínio consome) → `frontend-painel` → `revisor-qa` → `escrivao` |
| Dono antes | Nada obrigatório. Ideal: L08 e L15 |
| Pronto quando | `supabase db reset` e `supabase test db` verdes, com RLS testada por papel e corrida pela última vaga; Vitest cobre todas as transições de §7.2 e o semáforo; login local com os 6 papéis; Pátio, Atendimentos e Ficha lendo via v2; o lint barra import proibido; o build publicado (Memória) abre sem erro |
| Checkpoint | Entrar como dono e como produção e ver a diferença. Perguntas: L08, L11 |
| Riscos | Maior sprint do plano. Fazer em três blocos com commit verde entre eles (dados, domínio, front). Se passar de 10 sessões, dividir em S1-dados e S1-front |

#### S2: Orçamentos, OS e Agenda · Fase 1 · **G**

| | |
| --- | --- |
| Objetivo | A recepção registra todo carro (Maxpar, particular, seguradora direta) em até 1 minuto e agenda sem estourar o dia |
| Entregas | Busca por placa, telefone ou protocolo, que sugere vínculo e não funde sozinha. OS e ficha: cliente e veículo com proveniência, atendimento externo `fonte = manual`, versões lado a lado, aprovação com evidência, contatos, pendências. Entrada rápida de 30 s. Exceções E1, E2, E4 e E7. Fila "aguardando agendamento". Agenda semanal com capacidade, bloqueios, reserva atômica e reagendamento. Botão "copiar mensagem de agendamento" (Calia manual mínima). Pendências externas: criar e concluir com data, quem e evidência. Cloudflare Pages + BrowserRouter se L26 estiver decidido. Playwright instalado |
| Agentes | `arquiteto-dados` (ajustes e views) → `dominio-regras` (dedupe, guardas de aprovação, vagas restantes) → `frontend-painel` (Orçamentos e Agenda podem ser duas instâncias) → `testes-e2e` → `revisor-qa` → `escrivao` |
| Dono antes | L07, L08, L12, L14, L16, L22; L26 opcional |
| Pronto quando | CA1 (parte OS e aprovação), CA3 (parte manual), CA4 e CA11 verdes no Playwright; 3 casos reais (anonimizados enquanto não houver G2) cadastrados pela recepção em até 1 min cada |
| Checkpoint | A recepção cadastra um caso Maxpar e um particular com peça negada, lota um dia e vê a recusa, reagenda e vê a vaga voltar. Perguntas: a M1 está pronta? L17? |
| Riscos | Se a resposta de L08 mudar depois, só uma transição muda (o estado inicial fica isolado). Se a entrada for lenta, medir no checkpoint |

#### S3: Produção, TV, celular e Vistorias · Fase 1 · **G** (pode virar S3a produção + S3b vistorias)

| | |
| --- | --- |
| Objetivo | O pátio inteiro na TV, e cada funcionário toca os próprios botões |
| Entregas | Ajustes de produção: tipos de reparo, modelos de etapa, semáforo, expediente, boxes, motivos de impedimento. "Registrar entrada" gera as etapas e a previsão. Kanban do gestor: atribuir, prioridade, ajustar prazo com motivo, dispensar. `/producao/eu`: Iniciar, Concluir (contagem e foto), Impedimento, Retomar. `/producao/tv` com Realtime e filtros na URL. Terminal compartilhado + PIN (Edge Function). Vistorias com Storage privado, miniatura de até 1600 px, sem EXIF, exclusão em até 10 min. Entregar gera a pendência "encerrar no portal". Cadastro de funcionários |
| Agentes | `arquiteto-dados` (Storage, `vw_producao`, Realtime, PIN) → `dominio-regras` (geração de etapas, horas úteis, tempos) → `frontend-painel` (TV + kanban em paralelo com celular + vistorias) → `testes-e2e` → skill `impeccable` (TV e celular) → `revisor-qa` → `escrivao` |
| Dono antes | **L09 (duro)**, L10, L11, L13, L15, L17 |
| Pronto quando | CA5, CA6, CA7 e CA1 (fotos) verdes; a TV reflete uma mudança em até 5 s sem recarregar; produção e TV não veem valor nem telefone (`papeis.spec`); teste presencial com a TV real a 3 m e um funileiro usando o celular dele |
| Checkpoint | Na oficina, com a TV ligada |
| Riscos | Etapas que não batem com a rotina tiram o crédito do semáforo; por isso L09 é obrigatório. Wi-Fi fraco no pátio |

#### P1: Piloto do pátio · Fase 1 · **P** para o desenvolvimento, **M** para o dono

| | |
| --- | --- |
| Objetivo | Uma semana com o pátio só no painel |
| Entregas | Projeto Supabase de produção (G2) com migrations aplicadas **à mão pelo Guilherme** (`supabase link` + `db push`, sem seed). Usuários convidados. TV e terminal configurados. Endereço final (G4a). `pg_dump` semanal e uma restauração testada. `/security-review` + `revisor-qa` focado em RLS **antes** de entrar dado real. Guia de 1 página impresso para recepção e produção |
| Agentes | Principal, `revisor-qa`, `escrivao` |
| Dono antes | L25, L26, L15, L17, L28 |
| Pronto quando | 5 dias úteis com todo carro novo no painel e a planilha do pátio parada; lista de ajustes priorizada |
| Checkpoint | Conversa de 30 min com o dono e a recepção sobre a semana; os ajustes viram itens do S4 ou um sprint curto de ajuste (P) |
| Riscos | O plano Free pausa sem uso (uso diário evita) e não tem backup diário, daí o `pg_dump`. Se a recepção voltar à planilha, medir carros no painel × carros chegados |

#### S4: Recebíveis, Financeiro, Estoque e Geral · Fase 2 · **G**

| | |
| --- | --- |
| Objetivo | O dono fecha o mês sem o Excel |
| Entregas | Migrations financeiras: pagador, regra_prazo, titulo_receber, baixa, despesa, pagamento, material, movimento_estoque, categorias; `aplicar_baixa`, `vw_caixa_*`, `vw_geral_*`. Títulos sugeridos na entrega (franquia, mão de obra, complemento). NF. Baixa parcial e glosa. Aging. Despesas e pagamentos. Estoque com despesa vinculada uma vez só. Geral com indicadores clicáveis. Indicadores de Funcionários. CSV para Excel pt-BR (`;`, vírgula decimal, UTF-8 com BOM). Carga dos títulos em aberto da planilha |
| Agentes | `arquiteto-dados` em paralelo com `dominio-regras` (vencimento, aging, saldo, projeção, margem, em centavos) → `frontend-painel` → `testes-e2e` → `revisor-qa` → `escrivao` |
| Dono antes | **L18 a L22 (duro: sem a planilha o sprint não começa)** |
| Pronto quando | CA8 e CA9 verdes; um mês real fechado no painel bate com a planilha (diferenças explicadas por escrito); o CSV abre no Excel do dono |
| Checkpoint | O dono registra uma baixa parcial e vê aging e saldo do mês ao lado da planilha |
| Riscos | Regra fiscal: o painel só registra NF, não emite. Se a planilha atrasar, o S4 espera e S5 e S7-A podem andar |

#### S5: Worker, sincronização e leitores sem portal · Fase 3 · **M**

| | |
| --- | --- |
| Objetivo | Dados da Maxpar entram por arquivo sem duplicar e com conflito visível; worker e backup ficam automáticos |
| Entregas | `codigo/worker/`: fila `job`, cron, heartbeat, backup `pg_dump` + espelho de fotos. Migrations de sincronização: `sincronizacao`, `snapshot_sync`, `conflito_sync`, `job`, `mapa_status_externo`. ArquivoReader com o mapa de colunas de `maxpar-g1.md` (só se L02 confirmou). Normalizador. Conciliação em Orçamentos. Monitor em Ajustes. Alertas por e-mail. Expurgo por retenção |
| Agentes | `arquiteto-dados` → `integracao` → `frontend-painel` → `testes-e2e` → `revisor-qa` → `escrivao` |
| Dono antes | G1 fechado (L01–L04), L27, L28 |
| Pronto quando | CA2 e CA3 verdes: o mesmo arquivo importado 2 vezes não duplica, e o conflito é revisável e auditado; worker parado aparece no Geral em até 15 min; backup restaurado num projeto temporário |
| Checkpoint | Importar o arquivo real com o dono e resolver um conflito |
| Riscos | Se não houver exportação, o S5 entrega worker, backup e conciliação para o manual; o ArquivoReader fica ❌ com o motivo |

#### S6: Leitor do portal Maxpar (Playwright) · Fase 3 · **M, condicional**

| | |
| --- | --- |
| Objetivo | Leitura automática do portal, **somente leitura**, e só se os portões permitirem |
| Entregas | PortalReader com login assistido pelo dono; leitura de lista, detalhe e anexos; lista de URLs permitidas; pausa em CAPTCHA ou MFA; teste de fumaça diário; seletores centralizados |
| Agentes | `integracao` → `revisor-qa` + `/security-review` → `escrivao` |
| Dono antes | L05 e L06 favoráveis; **L29 assinada**; credenciais digitadas pelo próprio dono no host do worker |
| Pronto quando | Uma amostra de 10 atendimentos lidos bate campo a campo com o portal; nenhuma escrita é possível (allowlist + revisão de código); falha vira alerta |
| Checkpoint | Sessão com o dono, com leitura ao vivo |
| Riscos | Bloqueio ou descredenciamento: frequência baixa, IP da oficina, desligar ao primeiro sinal. **Se os termos proibirem, o sprint é cancelado e registrado** |

#### S7: Calia · Fase 3 · **M**

| | |
| --- | --- |
| Objetivo | Agendamento por WhatsApp sem disparo duplicado nem vaga estourada |
| Entregas | `interacao_calia`. **Parte A** (manual, pode começar depois do S2): estados completos, texto pronto, a recepção registra a resposta, pré-condições (aprovação confiável, telefone, opt-out, horário). **Parte B** (só com G3): CaliaClientHttp, webhook com HMAC, endpoint de disponibilidade, proposta com TTL e expiração |
| Agentes | `arquiteto-dados` → `dominio-regras` (pré-condições) → `integracao` → `frontend-painel` (Agenda) → `testes-e2e` → `revisor-qa` → `escrivao` |
| Dono antes | L23 (parte A); L24/G3 (parte B) |
| Pronto quando | CA10 verde; proposta expirada devolve a vaga. Sem G3, o sprint fecha na parte A e a parte B fica ❌ com o motivo |
| Checkpoint | A recepção dispara (manual ou automático) para um contato de teste e vê a exceção cair para ela |
| Riscos | Se a API da Calia não existir ou for limitada, o modo manual é o produto |

#### S8: Piloto completo e endurecimento · Fase 4 · **M**

| | |
| --- | --- |
| Objetivo | O dono opera uma semana sem planilha paralela |
| Entregas | Amostra real confrontada entre portal, painel e Excel. Testes de conflito, capacidade, atraso, baixa parcial, permissões e falha de sincronização. Modelos e prazos ajustados com o dono. LGPD: retenção ativa; localizar, exportar e anonimizar titular. Teste de restauração. Decisão Free × Pro. Guia de operação |
| Agentes | `testes-e2e` (suíte inteira) → `revisor-qa` + `/security-review` → `frontend-painel` (ajustes) → `escrivao` |
| Dono antes | Tempo dele e da recepção; L28 |
| Pronto quando | CA1 a CA11 verdes; 5 dias úteis sem Excel; restauração testada e anotada em Ajustes |
| Checkpoint | Entrega formal e decisão sobre o que vai para "Futuro" (API oficial, ponto, câmeras) |

---

## 5. Ritual de cada sprint no VS Code

**Abrir (5 min)**
1. `git switch main && git pull`. Ler `notas/mapa.md`: Estado atual e Decisões do dono.
2. Criar a branch `sprint/N-slug` (ex.: `sprint/2-orcamentos-agenda`). Para uma trilha paralela: `git worktree add ../GusPainel-s4 -b sprint/4-financeiro`.
3. Sessão nova do Claude Code (um sprint por sessão; `/clear` entre sprints). Colar o prompt:

~~~text
Sprint N — <título>. Leia CLAUDE.md, notas/mapa.md e docs/painel-execucao.md §4 (cartão do Sprint N).
1. Confira os pré-requisitos do dono deste sprint na tabela "Decisões do dono". Para cada um ausente,
   use o provisório de docs/painel-execucao.md §2.4 ou docs/painel-informacoes.md §4, rotulado
   "provisório — a confirmar", e liste-os.
2. Escreva notas/sprints/sprint-N.md: pré-requisitos (ID → estado), tarefas numeradas (uma por linha,
   com agente responsável e verificação objetiva), critérios de pronto, CA que o sprint fecha,
   provisórios usados, roteiro do checkpoint com 3 perguntas ao dono. Mostre e espere meu ok.
3. Com o ok, trabalhe em loop até o checklist fechar: delegue cada tarefa ao agente da coluna,
   verifique (comandos abaixo), confira no navegador, marque [x] e faça commit. Subagentes só em
   paralelo quando tocam diretórios diferentes; migrations sempre em série pelo arquiteto-dados.
   Pare e pergunte só se: faltar decisão sem provisório; algo exigir conta, credencial ou ação no
   portal Maxpar; a mesma falha persistir após 3 tentativas; for preciso alterar migration já
   commitada ou contrato de codigo/compartilhado usado por outro sprint.
4. No fim: testes-e2e (S2+), revisor-qa no diff main...HEAD, corrija "bloqueia" e "material",
   grave o resto em docs/qa-sprintN.md, chame o escrivao com o resumo compacto e me entregue o
   roteiro do checkpoint.
~~~

**Verificar (a cada tarefa)**

```bash
cd codigo && supabase db reset && supabase test db                # se tocou no banco
cd codigo/painel && npm test -- --run && npm run lint && npm run build
cd codigo/painel && npx playwright test                           # a partir do S2, no fim do sprint
```

Conferir no navegador com `preview_start` "painel" (`.claude/launch.json`) nos tamanhos da superfície: 390 (celular), 1366 (recepção), 1920 (TV).

**Quando chamar cada agente**

| Situação | Agente |
| --- | --- |
| A tarefa toca tabela, política, função, view, Storage ou seed | `arquiteto-dados` |
| A tarefa toca regra, cálculo, estado ou contrato | `dominio-regras` |
| A tarefa é tela ou componente | `frontend-painel` |
| A implementação do sprint terminou (S2+) | `testes-e2e` |
| Worker, Maxpar ou Calia, **com o portão aberto** | `integracao` |
| TV ou celular prontos (S3, S8) | skill `impeccable` |
| Antes de dado real (P1, S6, S8) | `/security-review` |
| Fechamento | `revisor-qa` → `escrivao` |

**Fechar**
1. `revisor-qa`, depois as correções, e o que não foi corrigido vai para `docs/qa-sprintN.md`.
2. `escrivao` com o resumo compacto: decisões com o porquê, implementado, de fora, arquivos, bloqueios, respostas do dono.
3. `git switch main && git merge --no-ff sprint/N-slug && git tag sprint-N && git push --tags origin main`. O push publica. Até o G4 o build vai para o GitHub Pages em modo Memória.
4. **Produção (a partir do P1):** `supabase db push` só pelo Guilherme, à mão, depois do checkpoint e com `pg_dump` antes.

**Checkpoint com o dono:** link + roteiro de 10 min do cartão + 3 perguntas. As respostas vão para a tabela "Decisões do dono" (via `escrivao`). O que contradiz algo já construído vira tarefa do próximo sprint. Valor configurável (limiar, capacidade, prazo) entra em Ajustes ou `config_oficina`, **não em código**. Sem checkpoint, não se abre sprint que dependa da resposta pendente; um sprint independente pode andar.

**Convenções**
- **Commits:** `Painel S<N>: <verbo no imperativo> …` (ex.: `Painel S2: adiciona reserva atômica de vaga na agenda`), com o rodapé `Co-Authored-By` do CLAUDE.md. Um commit por tarefa verde.
- **Branches:** `sprint/N-slug`; correções urgentes em `fix/slug`. Em `main`, direto, só documentação.
- **Nunca commitar:** `.env*`, `media/`, `codigo/site/painel/`, `codigo/supabase/.temp/`, prints do G1, planilha do dono.

---

## 6. Arquivos de controle

### 6.1 Fontes da verdade

| Arquivo | O que é | Quem altera | Quando |
| --- | --- | --- | --- |
| `docs/espec-dono-v1.md` | Voz do dono e critérios de aceitação | Ninguém (congelado) | Revisão grande do dono vira `espec-dono-v2.md` |
| `docs/painel-arquitetura.md` | Contratos técnicos | Principal | Quando uma decisão do dono muda modelo ou estado (anotar a data na seção) |
| `docs/painel-informacoes.md` | Campo a campo e provisórios | Principal | Idem |
| `docs/painel-execucao.md` (este) | Fases, sprints, ritual, agentes | Principal | Só quando o plano muda (portão fechou, sprint dividido) |
| `docs/maxpar-g1.md` | Resultado da inspeção | Guilherme | Depois do G1 |
| `notas/sprints/sprint-N.md` | Checklist vivo do sprint | Principal | Durante o sprint |
| `docs/qa-sprintN.md` | Achados não corrigidos | Principal | Fim do sprint |
| `notas/mapa.md`, `notas/status.md`, `Atualização noturna.md` | Estado, decisões do dono, checklist por fase | `escrivao` | Fim de sprint e depois da Fase 0 |
| `docs/painel-plano.md` | Histórico (método, stack e modelo v1) | — | Recebe o aviso abaixo e não muda mais |

### 6.2 Aviso para o topo de `docs/painel-plano.md`

~~~markdown
> **Histórico (12/10/2026).** Este plano descreve o Sprint 0 (Dexie, PIN, modelo v1). Sprints, stack de dados e método atuais estão em `docs/painel-execucao.md`; contratos técnicos em `docs/painel-arquitetura.md`. Não use este arquivo para decidir.
~~~

### 6.3 CLAUDE.md: seções a substituir (as demais ficam)

~~~markdown
## Leia antes de trabalhar
1. `notas/mapa.md` — estado atual, próximo passo e **Decisões do dono** (sempre).
2. `docs/painel-execucao.md` — fases, sprints, critérios de pronto, agentes e ritual. Sprint corrente: `notas/sprints/sprint-N.md`.
3. `docs/painel-arquitetura.md` — modelo v2 (§6), estados (§7), integrações (§8), papéis e segurança (§9).
4. `docs/painel-informacoes.md` — de onde vem cada campo, quem preenche, onde aparece; provisórios (§4–5).
5. `docs/espec-dono-v1.md` — voz do dono; critérios de aceitação (§10).
6. `PRODUCT.md` e `DESIGN.md` — fatos e identidade. Itens `[inferido]`/`[aberto]` não viram afirmação na UI.
7. `docs/maxpar-estudo.md` e, após o G1, `docs/maxpar-g1.md`.
`docs/painel-plano.md` é histórico.

## Estrutura
```
codigo/site/          landing (HTML estático)
codigo/painel/        frontend: Vite + React 19 + TS + Tailwind v4 + TanStack Query + supabase-js; e2e/ (Playwright)
codigo/compartilhado/ tipos, enums e contratos v2 (painel e worker importam daqui; banco.gerado.ts vem da CLI)
codigo/supabase/      migrations/, tests/ (pgTAP), functions/ (Edge), seed.sql — rode a CLI de dentro de codigo/
codigo/worker/        Node 22: fila, backup, leitores Maxpar, Calia (a partir do S5)
codigo/tools/         serve.mjs, shot.mjs, probe.mjs
docs/  notas/ (sprints/ = checklist por sprint)  fotos/  media/ (fora do git; inclui media/g1)
.claude/agents/       escrivao, revisor-qa, frontend-painel, arquiteto-dados, dominio-regras, testes-e2e, integracao
```

## Comandos
```bash
cd codigo && supabase start                 # Postgres/Auth/Storage locais (precisa Docker ou OrbStack)
cd codigo && supabase db reset              # migrations + seed demo
cd codigo && supabase test db               # pgTAP (RLS, funções)
cd codigo && supabase gen types typescript --local > compartilhado/src/banco.gerado.ts
cd codigo/painel && npm run dev             # painel local; VITE_DADOS=supabase|memoria
cd codigo/painel && npm test -- --run && npm run lint && npm run build
cd codigo/painel && npx playwright test     # e2e (a partir do S2)
node codigo/tools/serve.mjs codigo/site 8765
```
Deploy: push na `main` → workflow publica. Produção do banco: `supabase db push` só pelo Guilherme, à mão, após checkpoint e backup.

## Regras do painel
- **Operate mode** e tokens do `DESIGN.md` (+ adendo Painel), como antes: raio zero, amarelo só para ação primária e estado.
- **Dados:** telas → hooks de `src/dados/` (TanStack Query) → `Repositorio` → `RepositorioSupabase` ou `RepositorioMemoria`. Telas e componentes nunca importam `@supabase/supabase-js` (o lint bloqueia).
- **Esquema** só por migration nova (`arquiteto-dados`); nunca editar migration commitada. Toda tabela nasce com `oficina_id`, RLS, políticas por papel (arq. §9.1) e teste pgTAP.
- **Segredos:** o front só usa a anon key via `.env.local` (fora do git). `service_role`, credenciais da Maxpar e da Calia nunca no front, no repositório, no chat ou em log. **O repositório é público:** nenhum dado real em seed, fixture, print ou commit.
- **Demo** só no `seed.sql` (`oficina-demo`); nunca no projeto de produção.
- **Regras de negócio** puras em TS com Vitest (`src/dominio/` ou `codigo/compartilhado/`); dinheiro em centavos; `agora` por parâmetro.
- **Valores não confirmados** vêm de `config_oficina` e aparecem como "provisório — a confirmar". Não inventar fatos da oficina.
- **Maxpar:** tudo é hipótese até `docs/maxpar-g1.md`. Nada escreve na Maxpar; nada contorna CAPTCHA ou MFA. Ação no portal vira `pendencia_externa`.
- Rótulos pt-BR em `src/dominio/rotulos.ts`.

## Como trabalhar (sprint em loop)
Siga `docs/painel-execucao.md` §5: branch `sprint/N-slug` → checklist em `notas/sprints/sprint-N.md` (aprovado pelo Guilherme) → loop tarefa → agente → verificar → commit → `testes-e2e` → `revisor-qa` → `escrivao` → merge e push → checkpoint do dono. Não abrir sprint que dependa de resposta pendente do dono sem o checkpoint, salvo pedido do Guilherme.
~~~

Na seção **Agentes** do CLAUDE.md, listar os 7 agentes com uma linha cada, como na tabela 3.1. Na seção **Git**, acrescentar: "Branches `sprint/N-slug`; commits `Painel S<N>: …`; tag `sprint-N` no merge."

### 6.4 `notas/status.md` proposto (seção do painel)

~~~markdown
## Painel — Fase 0 · Preparação com o dono
✅ Sprint 0 (shell, demo, PIN, deploy em /painel/)
❌ S1a Dívida da QA que sobrevive (itens 1–5, 8–11, 13, 15, 18, 19)
❌ Reunião de levantamento (ficha 2.4) · ❌ G1 Inspeção Maxpar → docs/maxpar-g1.md
❌ Lição de casa: M1 etapas · M2 pessoas · M3 pagadores · planilha financeira · termos de uso
❌ G2 Supabase produção · ❌ G3 Calia · ❌ G4a endereço do painel · ❌ G4b host do worker

## Painel — Fase 1 · Pátio fora da planilha
❌ Banco núcleo (migrations, RLS, auditoria, funções) — S1
❌ Domínio v2 (estados, semáforo, capacidade) — S1
❌ Repositorio v2, hooks e login por papel — S1
❌ Clientes, veículos, OS e ficha; entrada rápida — S2
❌ Agenda com capacidade e reserva atômica; pendências externas — S2
❌ Tipos de reparo, etapas e semáforo configuráveis — S3
❌ Produção: kanban, TV, celular, terminal com PIN — S3
❌ Vistorias e fotos privadas — S3
❌ Piloto do pátio (5 dias úteis) — P1

## Painel — Fase 2 · Financeiro fora do Excel
❌ Recebíveis (títulos, NF, baixa parcial, aging) — S4
❌ Financeiro (despesas, caixa, projeção) e Estoque — S4
❌ Geral com indicadores clicáveis e CSV — S4

## Painel — Fase 3 · Integrações
❌ Worker, backup automático, monitor — S5
❌ Importação por arquivo + conciliação (depende de G1) — S5
❌ Leitor do portal (só com G1 + termos + autorização) — S6
❌ Calia manual — S7-A · ❌ Calia automática (depende de G3) — S7-B

## Painel — Fase 4 · Piloto completo
❌ Semana sem planilha, LGPD, restauração testada — S8

## Critérios de aceitação (espec §10)
❌ CA1 veículo com N OS sem misturar · ❌ CA2 importação idempotente · ❌ CA3 origem/data + manual
❌ CA4 capacidade da agenda · ❌ CA5 etapas e tempos · ❌ CA6 alertas e ajustes auditados
❌ CA7 vistorias com permissão · ❌ CA8 estoque e caixa efetivo · ❌ CA9 vencimento e baixa parcial
❌ CA10 Calia sem duplicar · ❌ CA11 pendências do portal confirmadas
~~~

### 6.5 Bloco "Decisões do dono" em `notas/mapa.md`

~~~markdown
## Decisões do dono
Estados: aberta (sem provisório) · provisória (usando padrão "a confirmar") · decidida · revista.
| ID | Pergunta | Resposta | Estado | Data · fonte | Aplicada em |
| --- | --- | --- | --- | --- | --- |
| L08 | Quando nasce a OS | — | provisória: entrada rápida, rascunho | — | domínio S1 |
| L09 | Tipos de reparo e etapas | — | provisória: 4 tipos (informações §4) | — | config S3 |
(uma linha por item L01–L29; decisões 1–12 da arq. §11.1 já estão mapeadas nesses IDs)
~~~

### 6.6 Formato novo da `Atualização noturna.md`

~~~markdown
# Atualização noturna — [DATA]
## Precisa de você
- [L-ID] o que falta do dono — trava o Sprint N (provisório em uso: …)   ← no máximo 5; "nada" se vazio
## Onde estamos
Fase X · Sprint N — Y de Z tarefas · Portões: G1 ✅/❌ · G2 ✅/❌ · G3 ✅/❌ · G4 ✅/❌
## O que mudou (3–5 linhas)
## Decisões que eu tomei sozinho (provisórias, a confirmar) — decisão — porquê
## O que ficou pela metade
---
Detalhe completo: [[mapa]] · histórico: [[historico]]
~~~

---

## 7. Riscos de execução e como o plano os contém

| Risco | Contenção |
| --- | --- |
| O dono não entrega a lição de casa | Provisórios rotulados permitem andar; só travam S3 (L09) e S4 (L18) por desenho; lembrete em 5 dias |
| G1 negativo (sem exportação ou termos proíbem) | ManualReader é o produto; S5 fica com worker e backup; S6 é cancelado e registrado; nada prometido antes |
| Sem Docker no Mac | Pré-requisito explícito do S1; alternativa: projeto Supabase de desenvolvimento do Guilherme, só com dados fictícios |
| S1 grande demais | Três blocos com commit verde entre eles; regra para dividir passando de 10 sessões |
| Agentes voltam a acessar o banco direto | Lint de import proibido + item (b) do `revisor-qa` |
| Brecha de RLS expõe valores à produção ou à TV | pgTAP por papel (S1+), `papeis.spec` (S2+), `/security-review` antes de dado real |
| Dado real vaza no repositório público | Seed fictício, `media/` fora do git, prints borrados, regra no CLAUDE.md; avaliar repositório privado com Cloudflare Pages no G4 |
| Dois agentes conflitam em migrations | Só o `arquiteto-dados` cria migrations, sempre em série |
| Contexto longo degrada o loop | Um sprint por sessão; estado em `notas/sprints/sprint-N.md`, não na conversa |
| Dono sem tempo para checkpoint | Checkpoint assíncrono (link + vídeo curto + 3 perguntas); sprints independentes seguem |
| Automação derruba a conta Maxpar | S6 só com G1 + termos + L29; frequência baixa; somente leitura; pausa em CAPTCHA |

---

## Anexo A: agentes novos (copiar para `.claude/agents/`)

### A1. `.claude/agents/arquiteto-dados.md`

~~~markdown
---
name: arquiteto-dados
description: Banco do painel D doctor no Supabase — migrations SQL do modelo v2, RLS por oficina e papel, triggers de auditoria, funções SQL (reservar_vaga, iniciar/concluir/bloquear_etapa, aplicar_baixa), views (vw_producao, vw_geral_*, vw_caixa_*), políticas de Storage, seed demo e testes pgTAP. Use quando uma tarefa precisa de tabela, coluna, política, função, view ou bucket. Único agente que cria arquivos em codigo/supabase/migrations.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

Você cuida do banco do painel da oficina D doctor (Supabase: Postgres, Auth, Storage, RLS, Edge Functions), em `codigo/supabase/`; rode a CLI de dentro de `codigo/`. Leia antes: `CLAUDE.md`; `docs/painel-arquitetura.md` §6 (modelo, enums, RLS), §7.2–7.4 (estados, reserva atômica, semáforo) e §9.1 (papel × módulo); `docs/painel-informacoes.md` §6 (proveniência, imutáveis, auditoria); `notas/sprints/sprint-N.md`; as migrations existentes.

Regras fixas:
- Escopo do sprint: crie só o que a tarefa pede. Não antecipe tabelas de sprints futuros (financeiro no S4, sincronização no S5, Calia no S7).
- Migrations só de acréscimo: `supabase migration new <descricao_snake>`. Nunca edite migration commitada; correção = migration nova.
- Toda tabela nova, na mesma migration: `id uuid`, `oficina_id`, `criado_em`, `atualizado_em`, `criado_por`; RLS habilitada; políticas por papel conforme §9.1 via `papel_atual()`/`oficina_atual()`; trigger de `atualizado_em`; trigger de auditoria se sensível (OS, etapa, prazo, aprovação, financeiro, configuração).
- Imutáveis (`evento_auditoria`, `snapshot_sync`, `sincronizacao`, versões de orçamento, baixas, pagamentos): `REVOKE UPDATE, DELETE` para todos; correção por novo registro.
- Funções que mudam estado: `security definer`, `set search_path = ''`, validam oficina, papel e responsável, e falham com código legível (`sem_vaga`, `nao_responsavel`, `motivo_obrigatorio`, `transicao_invalida`). Transições exatamente como §7.2; se o TS do `dominio-regras` divergir, aponte.
- Dinheiro `numeric(12,2)`; datas de negócio `date`; marcos `timestamptz`; fuso em `oficina.fuso` (`America/Sao_Paulo`).
- Campos da Maxpar marcados (H) ficam em `dados_brutos jsonb` até existir `docs/maxpar-g1.md`; não crie coluna rígida para hipótese.
- `seed.sql`: só dados fictícios na `oficina-demo`, um usuário por papel com senha de desenvolvimento. O repositório é público: nunca dado real, nunca chave.
- Depois de mudar enum ou tabela: `supabase gen types typescript --local > compartilhado/src/banco.gerado.ts`; diga no relatório o que mudou para `dominio-regras` e `frontend-painel`.
- Nunca rode `supabase link`, `db push` ou qualquer comando contra projeto remoto.

Testes (pgTAP em `codigo/supabase/tests/`): para cada tabela nova, um "pode" e um "não pode" por papel relevante (produção sem valores; TV só na view); para cada função, caminho feliz e cada guarda; em `reservar_vaga`, duas reservas concorrentes na última vaga (exatamente uma falha).

Antes de devolver: `supabase db reset` e `supabase test db` verdes; se os tipos mudaram, `cd painel && npm run build` verde. Relate em até 12 linhas: migrations, tabelas/políticas/funções/views, testes, tipos alterados, provisórios ("a confirmar").
~~~

### A2. `.claude/agents/dominio-regras.md`

~~~markdown
---
name: dominio-regras
description: Regras de negócio do painel D doctor em TypeScript puro com Vitest — tipos e enums v2, máquinas de estado (OS, orçamento, agendamento, etapa), semáforo e tempos em horas úteis, capacidade, vencimento por regra do pagador, aging, saldo de estoque, margem, dedupe de cliente/veículo, pré-condições da Calia, contratos MaxparReader/Calia. Use quando uma tarefa cria ou muda regra, cálculo ou contrato. Não escreve UI nem SQL.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

Você escreve o domínio do painel da oficina D doctor. Tipos, enums e contratos ficam em `codigo/compartilhado/src/`; regras usadas também pelo worker, em `codigo/compartilhado/src/dominio/`; regras só da UI, em `codigo/painel/src/dominio/`. Leia antes: `CLAUDE.md`; `docs/painel-arquitetura.md` §6.3, §7, §8.1 e §8.3; `docs/painel-informacoes.md` §3 (fórmulas na coluna Observação) e §4–5 (provisórios); `notas/sprints/sprint-N.md`; `compartilhado/src/banco.gerado.ts`.

Regras fixas:
- Funções puras: sem I/O, sem `Date.now()` ou `new Date()` interno. `agora` e a configuração (`config_oficina`) entram por parâmetro.
- Teste primeiro: cada regra nasce com casos Vitest tirados dos documentos, incluindo bordas (mesmo dia, virada de expediente, sábado, prazo vencido, bloqueio aberto, vaga exata, baixa maior que o saldo).
- Máquinas de estado como tabela de transições com guardas que devolvem `{ ok: true }` ou `{ ok: false, codigo }`, com os mesmos códigos das funções SQL (`sem_vaga`, `motivo_obrigatorio`, `transicao_invalida`…). Se o SQL divergir de §7.2, aponte.
- Dinheiro em centavos inteiros; arredondar só na exibição. Datas de negócio no fuso `America/Sao_Paulo` (date-fns).
- Horas úteis pelo expediente da configuração. Valores não confirmados pelo dono são padrões de configuração marcados `provisorio: true`, nunca literais em tela.
- Em fila, em execução e bloqueada são três números separados; nunca some num "atraso".
- Placa: exatamente 7 caracteres depois de normalizar (Mercosul ou antiga); não trunque antes de validar.
- Enums têm uma fonte só: derive das uniões de `banco.gerado.ts`. Se faltar valor, peça ao `arquiteto-dados` no relatório.
- Nada da Maxpar vira regra fixa antes de `docs/maxpar-g1.md`; mapeamento de status é dado configurável.

Antes de devolver: `cd codigo/painel && npm test -- --run && npm run build` verdes (e o build do worker, se existir). Relate em até 12 linhas: módulos e funções, casos de teste, contratos alterados, provisórios usados.
~~~

### A3. `.claude/agents/testes-e2e.md`

~~~markdown
---
name: testes-e2e
description: Testes ponta a ponta (Playwright) do painel D doctor contra o Supabase local com seed — um teste por critério de aceitação da espec (CA1–CA11) e por papel (dono, gestor, recepção, produção, financeiro, TV), em celular 390 px, recepção 1366 px e TV 1920 px. Use ao fim da implementação de cada sprint a partir do S2, antes do revisor-qa. Não altera regra nem tela, salvo acrescentar nome acessível faltante.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

Você mantém `codigo/painel/e2e/` (Playwright). Leia: `CLAUDE.md`; `docs/espec-dono-v1.md` §10; `docs/painel-execucao.md` §4.2 e o cartão do sprint; `docs/painel-arquitetura.md` §9.1; `codigo/supabase/seed.sql` (usuários por papel).

Como trabalhar:
- Ambiente: `cd codigo && supabase db reset` antes da suíte; o Vite sobe pelo `webServer` do `playwright.config.ts`. Nunca aponte para projeto remoto.
- Um arquivo por critério (`ca04-agenda-capacidade.spec.ts`), com o texto do critério no `describe`. `papeis.spec.ts` verifica, por papel, o que aparece e o que não aparece (produção sem valores nem telefone; TV sem ação; financeiro sem Ajustes).
- Projetos: `celular` (390×844, toque), `recepcao` (1366×768), `tv` (1920×1080). Telas de produção rodam em `celular` e `tv`.
- Localize por `getByRole`/`getByLabel`. Sem nome acessível é achado de a11y: acrescente `aria-label` ou `<label>` mínimo e registre. `data-testid` só em último caso. Nada de `waitForTimeout`; espere estados da tela.
- CA4: dois contextos confirmando a última vaga ao mesmo tempo; exatamente um consegue.
- TV: mude a etapa em outro contexto e espere a TV refletir sem recarregar (até 5 s).
- Dados criados nos testes têm prefixo `E2E-` e vivem só no banco local.

Antes de devolver: `npx playwright test` inteiro. Relate em até 12 linhas: CA cobertos, verdes e vermelhos (passo que falha + captura em `test-results/`), ajustes de a11y, o que ficou sem cobertura e por quê.
~~~

### A4. `.claude/agents/integracao.md`

~~~markdown
---
name: integracao
description: Integrações externas do painel D doctor no worker Node (codigo/worker) e nas Edge Functions de integração — fila job, cron, heartbeat, backup, leitores Maxpar (Manual, Arquivo e, só com G1 aprovado, Portal via Playwright), normalizador, snapshots/hash, conflitos, e cliente Calia (manual; HTTP após G3). Use só nos sprints 5–7 e só com os portões exigidos registrados em notas/mapa.md.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

Você constrói a ponte entre o painel e o mundo externo. Leia antes: `CLAUDE.md`; `docs/painel-arquitetura.md` §2 (worker), §8 (contratos e leitores), §9.4–9.5 (backup, monitoramento); `docs/maxpar-g1.md`; a tabela "Decisões do dono" de `notas/mapa.md`; `notas/sprints/sprint-N.md`.

Portões. Verifique antes de qualquer código; se faltar, pare e relate:
- `ArquivoReader`: `docs/maxpar-g1.md` confirma exportação e traz o mapa de colunas.
- `PortalReader`: veredito "viável" em `docs/maxpar-g1.md`, termos sem proibição de automação (L06) e autorização escrita do dono (L29) registrada.
- `CaliaClientHttp`: documentação da API da Calia (G3) em `docs/`.

Regras fixas:
- Somente leitura na Maxpar. O leitor só navega e lê, com lista de URLs e ações permitidas; qualquer outra falha. Ação exigida no portal vira `pendencia_externa`.
- Nunca contorne CAPTCHA, MFA, limite ou bloqueio: pare, grave `sincronizacao.estado = bloqueada` e alerte o gestor. Frequência baixa (30–60 min em horário comercial), um navegador, sem paralelismo.
- Credenciais: nunca peça, leia, escreva ou registre senha, cookie ou token no repositório, no chat, em fixture ou em log. Elas vivem em variáveis de ambiente do host do worker, preenchidas pelo dono; a sessão persistida fica cifrada fora do repositório.
- Idempotência: `hashConteudo` canônico. Mesmo hash, nada muda. Hash novo gera snapshot, diff por campo e preenche só o que não foi validado; o resto vira `conflito_sync`. Anexos deduplicados por SHA-256.
- Seletores e mapas de colunas centralizados num arquivo; mudança de layout gera erro visível, nunca dado silenciosamente errado.
- Logs só com `os.numero`, `id_externo` e contadores; sem nome, telefone ou placa completa. `service_role` só no worker e nas Edge Functions, via ambiente.
- Calia: chave `os_id:finalidade:versao` UNIQUE; webhook valida HMAC; proposta com TTL; `humano`, `sem_resposta`, `recusado` e `falhou` viram `transferida_recepcao`. Sem G3, só `CaliaClientManual`.
- Testes Vitest com fixtures anonimizadas (dados inventados no formato visto no G1); nenhum teste automatizado acessa o portal real. Teste real só manual, com o dono presente, registrado em `notas/`.

Antes de devolver: testes e build do worker verdes; `supabase test db` verde se tocou em SQL. Relate em até 12 linhas: leitores e adaptadores, portões verificados, testes, riscos novos, o que precisa do dono.
~~~

## Anexo B: `.claude/agents/frontend-painel.md` reescrito

~~~markdown
---
name: frontend-painel
description: Constrói telas e componentes do painel D doctor a partir de uma tarefa do sprint (tela, dados, ações, papéis, estados), seguindo DESIGN.md, CLAUDE.md, a matriz de papéis e a camada Repositorio + hooks TanStack Query sobre Supabase. Use para uma aba inteira, a TV, a tela do celular da produção ou um componente complexo.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

Você implementa a UI do painel em `codigo/painel/` (Vite + React 19 + TypeScript + Tailwind v4 + react-router + TanStack Query; dados no Supabase atrás de `Repositorio`). Leia primeiro: `CLAUDE.md`, `DESIGN.md`, a linha da aba em `docs/painel-arquitetura.md` §5 e §9.1, a seção da aba em `docs/painel-informacoes.md` §3, `notas/sprints/sprint-N.md` e os arquivos de `src/` citados.

Regras fixas:
- Dados só por hooks de `src/dados/` (TanStack Query sobre `Repositorio`). Nunca importe `@supabase/supabase-js` em `src/telas` ou `src/componentes`. Mutação invalida as queries afetadas; código de erro do banco (`sem_vaga`, `motivo_obrigatorio`…) vira mensagem pt-BR de `rotulos.ts`.
- Regra de negócio não mora na tela: use `src/dominio/` ou `codigo/compartilhado/`; se faltar, peça no relatório.
- Estados em toda tela: carregando, vazio (com próxima ação), erro com "tentar de novo", sem permissão, dado externo desatualizado (`lido_em` > 24 h), lista longa, texto longo.
- Proveniência: campo que pode vir da Maxpar mostra etiqueta de fonte e data (informações §6.1).
- Papéis: esconda o que o papel não pode fazer, mas a barreira é a RLS. Produção e TV nunca veem valor, telefone ou seguradora.
- Superfícies: recepção 1366 px densa; celular 390 px com alvos ≥ 44 px e botões Iniciar/Concluir/Impedimento grandes; TV 1920 px sem foco nem interação, legível a 3–4 m, com hora da última atualização no rodapé.
- Modo Operate, tokens do DESIGN.md (+ adendo Painel), raio zero, sem gradiente, sombra ou animação decorativa. Amarelo só para ação primária e estado.
- Valores não confirmados vêm de `config_oficina` com "provisório — a confirmar". Fatos da oficina só do PRODUCT.md.
- Formulários com `<label>`, foco visível e teclado; nome acessível em todo botão de ícone (o `testes-e2e` depende disso).
- Sem dependência nova sem avisar no relatório.

Antes de devolver: `npm test -- --run`, `npm run lint` e `npm run build` verdes; confira no navegador nos tamanhos da superfície. Relate em até 12 linhas: arquivos, decisões de interface, estados cobertos, o que ficou de fora.
~~~

---

### Critical Files for Implementation
- /Users/guilhermerink/Documents/Claude/GusPainel/docs/painel-arquitetura.md
- /Users/guilhermerink/Documents/Claude/GusPainel/docs/painel-informacoes.md
- /Users/guilhermerink/Documents/Claude/GusPainel/CLAUDE.md
- /Users/guilhermerink/Documents/Claude/GusPainel/codigo/painel/src/dados/repositorio.ts
- /Users/guilhermerink/Documents/Claude/GusPainel/.claude/agents/frontend-painel.md

**Observações para quem chamou:**
1. Não há Docker instalado no Mac (`docker not found`; o Supabase CLI está em `/opt/homebrew/bin`). Por isso o plano trata Docker ou OrbStack como pré-requisito do S1.
2. O repositório `guiRink/ddoctor-site` é público. Daí as regras sobre prints do G1, planilha e seed.
3. O plano desvia da arquitetura §10 em dois pontos, ambos marcados no texto: migrations incrementais por sprint (em vez do esquema inteiro no S1) e o piloto do pátio (P1) antecipado para o fim da Fase 1.