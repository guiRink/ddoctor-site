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
✅ SE merge, tag `sprint-SE` e publicação (13/10/2026, com aval do Guilherme) · ✅ SF merge, tag `sprint-SF` e publicação (20/10/2026)
✅ SF Pedidos do dono (modo escuro, orçamento em PDF/WhatsApp, foto real ao concluir etapa, nova categoria de serviço, Agenda e capacidade editável, Produção e TV refeitas; QA com 4 importantes corrigidos; 329 testes) — branch `sprint/sf-pedidos-dono`, merge e publicação em 20/10/2026
✅ SG Revisão de produto (mecânico + especialista em sistemas, `docs/revisao-sg/`): Geral em 6 quadrados com gaveta, contagens únicas, semáforo a 80 % do prazo, Atendimentos com filtros, Agenda de arrastar e soltar, A receber por seguradora, menu por papel, Estoque enxuto; 12 de 12 itens, QA com 5 importantes corrigidos; 436 testes no painel e 225 no compartilhado — branch `sprint/sg-revisao-produto`, merge, tag `sprint-SG` e publicação em 21/10/2026
✅ SH Pedidos do dono em dois áudios (`docs/revisao-sh/`): Geral só com números, menu lateral amarelo, "Orçamentos" de volta, "Parado" no lugar de "Impedido", cor do carro pela entrega e andamento com base em Ajustes → Cores dos carros e ajuste por carro, TV em mosaico, Produção com cor e filtros, lembrete "cobrar franquia"; 488 testes — branch `sprint/sh-pedidos-audio`, merge, tag `sprint-SH` e publicação em 22/10/2026
🔧 Checkpoint do dono sobre as telas (SD + SE + SF + SG + SH) — o Guilherme manda o link ao irmão; o dono salva a base das cores em Ajustes; decidir se a produção pode "pegar" etapas livres; decisões novas L30–L36, L39–L44, L45–L55 e L56–L63 (cores dos carros; CPF/CNPJ, capacidade, caixa, hora de mão de obra, validade do orçamento, permissões, nome Atendimentos, laranja a 80 %, travar entrega sem foto)
❌ Domínio do dono (hospedagem Cloudflare Pages) e conta Supabase do dono — aguardando
❌ G1 Inspeção Maxpar → `docs/maxpar-g1.md` (necessário antes do S5/S6)
❌ G2 Supabase produção · ❌ G3 Calia · ❌ G4a endereço do painel · ❌ G4b host do worker
❌ OrbStack (ou Docker Desktop) no Mac (pré-requisito do S1)

## Painel — Fase 1 · Pátio fora da planilha
❌ Banco núcleo (migrations, RLS, auditoria, funções), RepositorioSupabase, login por papel, `listarProducao` sem dados pessoais e custos fora da `OSVisao` — S1 (próximo)
❌ Permissões no banco para fotos, configuração e tipos de serviço (RLS + pgTAP) e fotos no Cloudflare R2 (telas prontas no SF, no aparelho) — S1/S3
❌ Tabelas novas do SE no banco (`custo_os`, `fornecedor`, `categoria_financeira`, `fechamento_caixa`, recepção/avarias, `baixa.parcelas`; `movimento_estoque.tipo` mudou) — S1
❌ Itens do SG que precisam de banco: complemento por dano oculto, peça encomendada, glosa, mudança de prazo com motivo, decisão sobre item negado, retrabalho/garantia, carro reserva, vagas por turno, "Avisar cliente" no banco, `encaixe` na função do Supabase — S1/S2
❌ Clientes, veículos, OS e ficha; entrada rápida — S2 (telas prontas em memória no SD/SE, incluindo Clientes com CPF/CNPJ e Receber o carro em 4 passos; falta o banco real)
❌ Agenda com capacidade e reserva atômica; pendências externas — S2 (grade, fila e arrastar e soltar prontos em memória no SD/SG; falta reserva atômica no banco)
❌ Tipos de reparo, etapas e semáforo configuráveis — S3 (semáforo e etapas fixos no domínio do SD; configuração trava em L09)
❌ Produção: kanban, TV, celular, terminal com PIN — S3 (quadro, TV e Minhas tarefas prontos em memória no SD; falta terminal com PIN)
❌ Vistorias e fotos privadas — S3 (galeria por fase no SD; no SF foto real comprimida no aparelho ao concluir etapa e nas Vistorias, no demo; faltam armazenamento privado e RLS)
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
