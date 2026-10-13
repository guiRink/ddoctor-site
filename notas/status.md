# GusPainel (D doctor) — status

## Landing page
✅ Filme scroll-driven (240 quadros, 6 takes, inércia com encaixe, entrega ao scroll normal no fim)
✅ Seções: serviços, frase da parede, fotos reais, contato, rodapé
✅ Publicação no GitHub Pages com workflow
🔧 Conteúdo a confirmar com a oficina — endereço completo, horário, logo vetorial, texto "Sinistros e seguradoras"

## Painel — Fase 0 · Preparação
✅ Sprint 0 (shell, demo, PIN, deploy em /painel/)
✅ Planejamento: arquitetura, mapa de informações, plano de execução, agentes (12/10/2026)
✅ Plano de execução aprovado pelo Guilherme (12/10/2026); agente `designer-painel` e `docs/painel-design.md`
🔧 Questionário curto para o dono — `docs/questionario-dono.md`; criado, falta enviar e receber as respostas (prioridades 1.1 e 5.1)
✅ S1a Dívida da QA que sobrevive — absorvido pelo SD (revisão QA aplicada; ver `docs/qa-sprintSD.md`)
✅ SD Design e telas v2 em memória (domínio compartilhado com 133 testes, repositório em memória, 14 telas, TV, celular, "Ver como" por papel; tag `sprint-SD`, publicado)
✅ SE Visual clean e o que faltava frente ao concorrente (clientes, recepção com checklist e avarias, custos e resultado da OS, pagamentos, estoque completo, caixa do dia, relatórios, produção prevista; 295 testes, demo v3) — pronto na branch `sprint/se-clean-concorrente`
🔧 SE merge, tag `sprint-SE` e publicação — falta o checkpoint do Guilherme com o irmão
🔧 Checkpoint do dono sobre as telas (SD + SE) — falta mandar o link e ouvir; decidir se a produção pode "pegar" etapas livres; decisões novas L30–L36 (CPF/CNPJ, capacidade, caixa, hora de mão de obra)
❌ G1 Inspeção Maxpar → `docs/maxpar-g1.md` (necessário antes do S5/S6)
❌ G2 Supabase produção · ❌ G3 Calia · ❌ G4a endereço do painel · ❌ G4b host do worker
❌ Docker Desktop ou OrbStack no Mac (pré-requisito do S1)

## Painel — Fase 1 · Pátio fora da planilha
❌ Banco núcleo (migrations, RLS, auditoria, funções), RepositorioSupabase, login por papel, `listarProducao` sem dados pessoais e custos fora da `OSVisao` — S1 (próximo)
❌ Tabelas novas do SE no banco (`custo_os`, `fornecedor`, `categoria_financeira`, `fechamento_caixa`, recepção/avarias, `baixa.parcelas`; `movimento_estoque.tipo` mudou) — S1
❌ Clientes, veículos, OS e ficha; entrada rápida — S2 (telas prontas em memória no SD/SE, incluindo Clientes com CPF/CNPJ e Receber o carro em 4 passos; falta o banco real)
❌ Agenda com capacidade e reserva atômica; pendências externas — S2 (grade e fila prontas em memória no SD; falta reserva atômica no banco)
❌ Tipos de reparo, etapas e semáforo configuráveis — S3 (semáforo e etapas fixos no domínio do SD; configuração trava em L09)
❌ Produção: kanban, TV, celular, terminal com PIN — S3 (quadro, TV e Minhas tarefas prontos em memória no SD; falta terminal com PIN)
❌ Vistorias e fotos privadas — S3 (galeria por fase pronta no SD; fotos reais e privadas faltam)
❌ Piloto do pátio (5 dias úteis) — P1

## Painel — Fase 2 · Financeiro fora do Excel
❌ Recebíveis (títulos, NF, baixa parcial, aging) — S4 (tela e aging prontos em memória no SD)
❌ Financeiro (despesas, caixa, projeção) e Estoque — S4 (em memória no SE: nova despesa, competência, caixa do dia, entrada/retirada, custo médio, fornecedores e CSV; falta o banco real e confirmar L35/L36)
❌ Geral com indicadores clicáveis e CSV; Relatórios — S4 (Geral com produção prevista e calendário de entregas e Relatórios com CSV prontos em memória no SE)

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
