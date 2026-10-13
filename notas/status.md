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
🔧 Checkpoint do dono sobre as telas do SD — falta mandar o link e ouvir; decidir se a produção pode "pegar" etapas livres
❌ G1 Inspeção Maxpar → `docs/maxpar-g1.md` (necessário antes do S5/S6)
❌ G2 Supabase produção · ❌ G3 Calia · ❌ G4a endereço do painel · ❌ G4b host do worker
❌ Docker Desktop ou OrbStack no Mac (pré-requisito do S1)

## Painel — Fase 1 · Pátio fora da planilha
❌ Banco núcleo (migrations, RLS, auditoria, funções), RepositorioSupabase, login por papel, `listarProducao` — S1 (próximo)
❌ Clientes, veículos, OS e ficha; entrada rápida — S2 (telas já prontas em memória no SD; falta o banco real)
❌ Agenda com capacidade e reserva atômica; pendências externas — S2 (grade e fila prontas em memória no SD; falta reserva atômica no banco)
❌ Tipos de reparo, etapas e semáforo configuráveis — S3 (semáforo e etapas fixos no domínio do SD; configuração trava em L09)
❌ Produção: kanban, TV, celular, terminal com PIN — S3 (quadro, TV e Minhas tarefas prontos em memória no SD; falta terminal com PIN)
❌ Vistorias e fotos privadas — S3 (galeria por fase pronta no SD; fotos reais e privadas faltam)
❌ Piloto do pátio (5 dias úteis) — P1

## Painel — Fase 2 · Financeiro fora do Excel
❌ Recebíveis (títulos, NF, baixa parcial, aging) — S4 (tela e aging prontos em memória no SD)
❌ Financeiro (despesas, caixa, projeção) e Estoque — S4 (telas em memória no SD; faltam lançar despesa e compras de estoque)
❌ Geral com indicadores clicáveis e CSV — S4 (Geral pronto em memória no SD; falta exportar CSV)

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
