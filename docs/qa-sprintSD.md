# Revisão QA do sprint SD (telas v2 em memória)

Data: 12/10/2026. Revisor: agente `revisor-qa` sobre `main...sprint/sd-design`. Verificações: tsc, vitest, lint (0 erros), build — todas verdes. Fluxo de dados correto (telas só por hooks; nada importa o repositório direto). Produção e TV não veem valor, telefone, seguradora nem protocolo em nenhuma tela (conferido no navegador por papel).

## Corrigido no próprio sprint

| # | Achado | Correção |
| --- | --- | --- |
| 1 (bloqueia) | OS voltava de "na oficina" para "aguardando agendamento" ao cancelar uma proposta antiga da Calia | Entrada cancela propostas/pendentes da OS; cancelar e "não compareceu" só mexem em agendamento ativo e só devolvem para a fila OS que está `agendada` |
| 2 | Repositório refazia as guardas à mão; `transicaoOS` não era usada | Toda mudança de estado da OS passa por `transicaoOS`; aprovação bloqueada com conflito aberto; nova transição `agendada → aguardando_agendamento` (com motivo) no domínio, com teste |
| 2 | Agenda aceitava dia passado e domingo | `dataAgendavel`: recusa `data_passada` e `dia_fechado` (inclui sábado à tarde) em agendar e reagendar |
| 3 | Protocolo duplicado criava 2ª OS | Recusa `protocolo_duplicado` e devolve o `osId` existente |
| 8 | Tela em branco se os perfis demorassem ou falhassem | Provedor de sessão mostra esqueleto ou erro com "Tentar de novo" |
| 10 | Repositório sem testes | `src/dados/repositorioMemoria.test.ts` (6 sequências) |
| menor | Proposta vencida contava como ativa | `agendamentoAtivo` filtra por `expiraEm` |
| menor | Demo regenerava pela data UTC | Compara pela data no fuso da oficina |
| — | Ordem "Etapa 3 de 3" errada com etapa dispensada; data de abertura em UTC; placa da TV estourando; mensagens de erro faltando | Corrigidos nos componentes compartilhados |

## Ainda aberto (entra no S1 ou precisa de decisão)

| # | Achado | Onde fecha |
| --- | --- | --- |
| 4 | Produção vê o nome do cliente em Vistorias | Correção de tela pós-designer neste sprint |
| 5 | Não existe leitura "de produção" sem dados pessoais: TV, Minhas tarefas, Vistorias e Funcionários usam `listarOS()` completo. No S1, com RLS, essas telas quebram | **S1**: criar `listarProducao()` (placa, modelo, cor, tipo, etapas, previsão, prioridade) espelhando `vw_producao` e trocar nas 4 telas |
| 6 | "Na fila sem responsável" no celular mostra OS que a política §6.6 não deixa a produção ler | **Decisão do dono**: a produção pode "pegar" etapas livres? Se sim, a política inclui etapas na fila sem responsável; se não, a lista sai do celular e só o gestor atribui |
| 7 | Celular: barra inferior corta itens além de 5 e não tem "Sair" | Correção de tela pós-designer neste sprint ("Mais") |
| 9 | Ficha da OS fica no esqueleto se config/perfis/tipos/pagadores falharem | Correção de tela pós-designer neste sprint |
| menor | Contagem de peças vem preenchida com o previsto | Correção de tela pós-designer |
| menor | Links que levam a "Sem acesso" para produção/TV (placa em Funcionários, logo, busca) | Correção de tela pós-designer |
| menor | Recorte de Vistorias da produção inclui OS com etapas só concluídas | S1, junto com a política RLS |
| menor | Alvos de 32–36 px no celular; contraste do foco amarelo sobre papel | `designer-painel` |
| menor | Semáforo só com limiar absoluto (8 h úteis); "percentual restante" da §7.4 não implementado | Decisão registrada: limiar absoluto até o dono responder o questionário 2.2 |
| menor | `reagendar` de proposta sem `expiraEm` gera proposta sem validade | S7 (Calia) |
