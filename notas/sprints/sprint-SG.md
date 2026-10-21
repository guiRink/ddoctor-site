# Sprint SG — revisão de produto: mecânico e especialista em sistemas (21/10/2026)

Branch `sprint/sg-revisao-produto`. O Guilherme odiou o Geral e achou partes confusas; um especialista em sistemas e um mecânico especialista conversaram e fecharam o plano. Conversa e plano em `docs/revisao-sg/` (`pedido.md`, `mecanico-r1.md`, `sistemas-r1.md`, `mecanico-r2.md`, `sistemas-r2.md`, `plano.md`).

## Checklist (12 itens do `docs/revisao-sg/plano.md`)
- [x] 1. Geral em 6 quadrados com as placas dentro (Na oficina, Entram hoje, Saem hoje, Parados e atrasados, Esperando seguradora, Dinheiro vencido); "Para fazer hoje" com quem faz; gaveta com a lista (tela cheia no celular); variações por papel (recepção, financeiro, produção em Minhas tarefas)
- [x] 2. Contagens únicas em `src/dominio/contagens.ts`, usadas por Geral, Produção, TV e Atendimentos (Na oficina = 8 em todas)
- [x] 3. Semáforo pelo prazo da etapa: laranja a 80 % (configurável em Ajustes) ou entrega amanhã; impedido vence atenção; uma pílula só
- [x] 4. Horários legíveis ("hoje 16h", "amanhã", "atrasado 1 dia") na Produção, TV e Minhas tarefas
- [x] 5. Atendimentos (ex-Orçamentos): busca, filtros de situação, seguradora, origem, valor e tempo (na URL), "há quanto tempo" e soma no rodapé
- [x] 6. Agenda de arrastar e soltar (um ou vários, fila para o dia, encaixe, desfazer, "Mover para…" no celular, Avisar cliente, Não veio)
- [x] 7. A receber por seguradora (nunca "Maxpar" como pagador)
- [x] 8. Ficha da OS: "Cliente deve" (regra única `clienteDeveOS`), entrega prometida em destaque, Resultado parcial
- [x] 9. Aviso na entrega (franquia ou complemento não pago, falta de foto de saída); avisa e deixa seguir
- [x] 10. Menu por papel (11 itens para o dono, Equipe, "Ver como" no menu do usuário, Quadro da TV como botão na Produção, Relatórios dentro do Financeiro)
- [x] 11. Estoque enxuto (abre em Acabando, aba Lista de compra, 2 números como filtro, ações no "⋯")
- [x] 12. Ruído fora ("Guardada até", sem "Aparelho", sem parágrafos explicativos, "Fechado" no lugar de "Encerrado")
- [x] Crítica do designer, revisão QA (nada bloqueava; 5 importantes e menores corrigidos), notas
- [x] Merge, tag `sprint-SG` e publicação em 21/10/2026 (Guilherme faz em seguida)

## Fica para o S1 / banco
Complemento por dano oculto, peça encomendada, glosa, mudança de prazo com motivo, decisão sobre item negado, retrabalho e garantia, carro reserva, vagas por turno, "Avisar cliente" no banco, `encaixe` na função do Supabase.

## Fica para o dono (L52–L55)
Travar entrega sem foto; capacidade pesada pelo tamanho do serviço; checklist "tudo ok" em um toque; passar em lote as etapas de quem faltou.
