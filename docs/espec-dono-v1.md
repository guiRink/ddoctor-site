# Arquitetura funcional e de dados — Painel da oficina (V1)

> Origem: documento gerado na conversa do Guilherme com o dono da oficina em 02/10/2026, descrevendo o que ele quer nas telas, abas e integrações. É a **voz do cliente**; a arquitetura técnica derivada dele está em `docs/painel-arquitetura.md`.

**Estado:** especificação inicial para implementação incremental. A inspeção da conta Maxpar da oficina e da planilha financeira ainda é necessária para confirmar campos, telas, permissões e regras. Nenhum endpoint, exportação ou permissão de escrita da Maxpar está confirmado.

## 1. Objetivo e limite da V1

Criar o painel interno da oficina para controlar orçamentos, agendamento, vistorias, etapas da produção, prazos, responsáveis, materiais, valores a receber e resultado financeiro. A Maxpar continua sendo usada nas interações obrigatórias com seguradoras. A V1 tenta importar os dados disponíveis da conta autorizada da oficina por automação autenticada do portal, com cadastro/importação manual como contingência. Posteriormente, substituir o leitor do portal por uma API oficial, se disponível e autorizada.

Não prometer envio automático de dados para a Maxpar antes de verificar a existência, autorização e comportamento de uma interface de escrita. Na V1, as ações necessárias no portal externo viram pendências para um funcionário executar e marcar como concluídas.

## 2. Menu e responsabilidades

| Aba | Visão e ações principais | Registro mestre |
| --- | --- | --- |
| Geral | Entradas, carros na oficina, entregas, atrasos, recebíveis e resumo financeiro; lista de pendências | Agregação dos módulos locais |
| Orçamentos | Casos, versões do orçamento, itens, valores, fotos e estados de aprovação; fila para agendar | Maxpar para versões/estados externos confirmados; painel para rascunhos internos |
| Agenda | Semana atual/próxima, vagas por dia, bloqueios, agendamento e reagendamento | Painel |
| Vistorias | Galeria e formulários por atendimento, placa, fase e data | Painel; anexos Maxpar marcados como importados |
| Produção | Painel visual para TV e tela operacional no celular; etapa, responsável, prazos, impedimentos | Painel |
| Funcionários | Etapas, peças e carros trabalhados por pessoa | Painel |
| Estoque | Compras, uso aproximado, conferência, saldo e reposição estimados | Painel, lançamentos do dono |
| Recebíveis | Títulos de seguradoras/particulares, emissão da NF, vencimento e baixas | Painel financeiro |
| Financeiro | Despesas, pagamentos, saldo realizado e projeção | Painel financeiro |
| Folha/ponto | Futuro: importação do fornecedor de ponto e cálculo de folha | Fora da integração V1 |

## 3. Modelo de domínio

- **Oficina, Usuário, Papel:** isolar dados da oficina e permissões de dono/gestor, recepção/orçamentista, produção e financeiro.
- **Cliente e Veículo:** dados de contato e veículo. Placa é atributo de busca, não identificador único de serviço; o mesmo veículo pode voltar várias vezes.
- **AtendimentoExterno/Sinistro:** referência Maxpar, seguradora, status e proveniência. Preferir chave única composta por oficina + seguradora + ID externo. Sem ID confiável, solicitar conciliação humana.
- **OrdemServico (OS):** serviço físico da oficina, vinculado ao veículo e, quando aplicável, a um ou mais atendimentos externos. Não fundir automaticamente atendimentos só porque a placa coincide.
- **Orcamento, OrcamentoVersao, ItemOrcamento, Aprovacao:** histórico de valores e itens; a aprovação aponta para a versão efetivamente aprovada.
- **TipoReparo, ModeloEtapas, EtapaOS:** etapas aplicáveis, prazo padrão, responsável, horário de entrada na fila, início, conclusão, bloqueios e alterações de prazo por OS.
- **Agendamento, CapacidadeDia/Bloqueio:** entradas, reagendamentos, vagas e restrições por dia ou recurso.
- **Vistoria, Foto:** fase, OS, peça/dano quando aplicável, autor, data, origem, referência externa e arquivo privado.
- **Material, MovimentoEstoque:** compra, uso estimado, conferência e ajuste; saldo estimado calculado a partir dos movimentos.
- **Pagador, RegraPrazo, TituloReceber, Baixa:** seguradora/particular, valor, data da NF, vencimento e pagamentos parciais.
- **Despesa, Pagamento:** obrigação e saída de caixa; compra de material pode originar despesa vinculada, sem duplicar seu valor.
- **InteracaoCalia, PendenciaExterna, EventoAuditoria, Sincronizacao:** mensagens, ações manuais no portal, alterações relevantes e saúde da importação.

## 4. Matriz de origem, destino e atualização

**M = Maxpar; P = painel próprio.** Todos os campos marcados como M são hipóteses até a inspeção do portal; disponibilidade e granularidade ainda não foram verificadas.

| Dados | Origem inicial → destino | Quem altera / gatilho | Regra de conflito e uso |
| --- | --- | --- | --- |
| ID do atendimento, seguradora, número do sinistro | M → cópia P | Leitura programada ou manual | Vincular a OS; deduplicar por oficina + seguradora + ID; caso ambíguo vai à revisão |
| Placa, modelo, cliente, telefone | M se disponível → P; completar na recepção | Importação ou cadastro local | Preservar fonte, data e validação por campo; alteração externa não apaga correção local validada |
| Orçamento externo, itens, valor, fotos, aprovação e data | M → versão/snapshot P | Importação quando houver mudança | Preservar versões; divergência de aprovação bloqueia contato automático e cria alerta |
| Orçamento interno e fotos adicionais | Funcionário → P | Cadastro/edição interna | Não presumir que o rascunho foi enviado ou aceito pela Maxpar |
| Tipo de reparo, etapas, prazos, entrega prevista | Gestor → P | Abertura/ajuste da OS | Painel é mestre; registrar autor, antes/depois e motivo de mudanças |
| Vagas, bloqueios, reserva e confirmação | Recepção/gestor/Calia → P | Ação humana ou retorno de contato | Reserva atômica; reagendamento libera vaga anterior; Calia consulta disponibilidade real |
| Entrada real, vistorias e fotos internas | Funcionário → P | Cada marco da OS | Guardar OS, fase, data, autor e origem; fotos externas ficam identificadas como M |
| Fila, início, fim, impedimento, peças executadas | Funcionário → P | Botões da produção | Medir tempo esperando e tempo em execução separadamente |
| Compra, uso estimado, conferência de estoque | Dono → P | Lançamento manual | Saldo é estimativa; compra vincula despesa uma vez, uso físico não gera nova saída de caixa |
| NF, pagador, prazo, título, recebimento | Gestor/financeiro → P | Emissão, correção ou baixa | Vencimento por regra do pagador; valor a receber só entra no caixa após baixa |
| Aluguel, folha manual se adotada, outras despesas | Gestor/financeiro → P | Lançamento e pagamento | Despesa prevista separada de saída efetiva de caixa |
| Marcação do ponto e faltas | Fornecedor futuro → P | Integração futura | Não compõe o cálculo automático da V1 |
| Mensagem e resposta de agendamento | P → Calia; Calia → P | Aprovação confirmada, contato válido, resposta | Chave de disparo por OS + finalidade + versão/estado evita duplicidade; exceções para recepção |
| Atualização exigida pela seguradora | P → tarefa humana → M | Funcionário executa no portal | Mostrar pendência e registrar confirmação; escrita automática depende de validação posterior |

## 5. Fluxo operacional e estados

1. **Caso/orçamento:** importar da Maxpar quando possível ou cadastrar; guardar versões e fotos. Estados: rascunho, enviado/aguardando, aprovado, recusado. A aprovação pertence a uma versão.
2. **Fila de agenda:** aprovação confiável gera `aguardando agendamento`. Conferir telefone e regra de contato; Calia pode propor apenas horários com capacidade disponível. Estados: pendente, contatando, proposto, confirmado, cancelado, não compareceu. Reserva e confirmação devem impedir excesso de vagas em concorrência.
3. **Entrada:** registrar data real, vistoria inicial e tipo de reparo; gerar etapas aplicáveis, responsáveis e prazo de entrega ajustável. Não iniciar produção somente porque houve aprovação externa.
4. **Produção:** etapa passa por `na fila`, `em execução`, `concluída`; pode ficar `bloqueada` ou `dispensada` com motivo. O funcionário inicia, registra impedimento quando houver e conclui sua parte. A próxima etapa fica disponível. Funilaria pode ser dispensada.
5. **Saída:** vistoria final e liberação, entrega real, registro de NF e recebíveis conforme o processo da oficina. Tarefas obrigatórias na Maxpar aparecem em checklist até existir escrita autorizada.

Para cada OS, mostrar **previsão global de entrega** e **prazo da etapa atual**. Para cada etapa, mostrar **tempo na fila** e **tempo em execução**. Modelos por tipo de reparo sugerem prazos, mas o gestor pode ajustá-los por carro com motivo registrado. Verde = no prazo, laranja = atenção conforme limiar configurado, vermelho = vencido ou crítico conforme regra configurada. A cor indica necessidade de ação; impedimentos e histórico mostram o contexto do atraso, sem atribuir culpa automaticamente.

## 6. Integração Maxpar, Calia e futuras fontes

### Maxpar na V1

Definir contrato interno `MaxparReader` que entrega registros normalizados, origem, identificador externo, carimbo da leitura e anexos disponíveis. Implementar um leitor de portal autenticado **após observação com acesso autorizado da oficina**, se as telas e regras permitirem, e leitores alternativos para entrada manual e arquivo exportado, se existir. Rodar importação em worker isolado, com botão de sincronizar, última sincronização visível, retentativas limitadas e fila de erros.

Credenciais e sessão ficam em armazenamento seguro; logs não incluem senha, sessão ou dados pessoais desnecessários. Não contornar CAPTCHA, MFA ou bloqueios do serviço. Importações repetidas precisam ser idempotentes; snapshots/hashes ajudam a reconhecer alterações e evitar fotos duplicadas. Divergências relevantes vão para revisão, sem sobrescrever indiscriminadamente dados locais.

Para migrar à API oficial, criar `OfficialApiReader` com o mesmo contrato interno, comparar amostras entre API e portal, conciliar diferenças e então alternar a fonte. Escrita na Maxpar requer uma análise independente de endpoints, autorização e ações suportadas.

### Calia

Evento `aprovacao_confirmada` cria pendência de agendamento. Antes do envio, validar telefone, regra de contato e se já houve mensagem para aquela OS/finalidade. A Calia solicita horários ao painel e devolve confirmação, recusa, pedido de outro horário ou pedido de atendimento humano. Registrar IDs e estados das mensagens para conciliação.

### Ponto eletrônico

Deixar uma interface de importação de marcações desacoplada do fornecedor. Somente implementar após o irmão contratar o serviço e disponibilizar documentação/API, regras de faltas e cálculo variável. A produtividade operacional de cada funcionário já funciona na V1 sem ponto.

## 7. Interface do painel visual

Tela de TV: cartões grandes por etapa ou ordem de urgência, com placa, veículo, serviço, etapa, responsável, peças realizadas/previstas, tempo na fila, tempo em execução, previsão de conclusão e cor do alerta. Filtros para atrasados, entregas de hoje e impedidos. Tela de celular: lista de tarefas do funcionário, botões Iniciar, Concluir e Informar impedimento; foto e contagem de peças conforme a etapa.

O Geral consolida contagens e valores sem editar diretamente registros de origem. Cada indicador deve abrir a lista filtrada correspondente.

## 8. Segurança, confiabilidade e permissões

Autenticação individual e papéis por módulo; produção vê apenas dados necessários ao serviço, financeiro e folha restritos. Fotos ficam em armazenamento privado com acesso autorizado. Registrar auditoria de aprovações, mudanças de prazo, alterações financeiras, conclusão de etapas e ações de integração. Fazer backups e monitorar falhas de sincronização e envio. Dados externos devem exibir origem e horário da última atualização.

## 9. Sequência de implementação para Claude Code

1. **Descoberta curta:** observar a conta Maxpar com o irmão, anotar URL/telas/campos/exportações/permissões/etapas que exigem atualização externa; examinar a planilha financeira e a rotina real da oficina. Nunca registrar credenciais no documento ou repositório.
2. **Esqueleto e dados:** criar projeto web responsivo, API, banco, armazenamento privado, autenticação, papéis, entidades, migrações, auditoria e dados de exemplo. Estabelecer contratos de origem externa e de eventos.
3. **Fluxo interno:** OS, orçamento versionado, agenda e capacidade, vistorias, etapas/semáforo, TV, produção por funcionário, estoque manual, recebíveis e financeiro. Usar cadastro manual para tornar o fluxo testável.
4. **Maxpar V1:** implementar automação de leitura autorizada se a descoberta confirmar viabilidade; mapeamentos, importação idempotente, anexos, conflitos, monitor e contingência manual/arquivo. Manter ações externas em checklist humano.
5. **Calia:** conectar disparo de agendamento e retorno de estados quando aprovação e contatos forem confiáveis, com proteção contra mensagens duplicadas.
6. **Piloto:** importar casos reais em pequena amostra, confrontar com o portal e o Excel, testar conflito de dados, capacidade, atraso, pagamentos parciais, permissões e falha de sincronização. Ajustar modelos de reparo e prazos com o dono.
7. **Próximas versões:** API oficial Maxpar quando contratada/documentada; ponto e folha quando fornecedor definido; visão por câmeras somente após avaliar viabilidade e qualidade dos dados.

## 10. Critérios mínimos de aceitação

- Mesmo veículo pode ter vários atendimentos e OS sem misturar fotos, valores ou aprovações.
- Importar duas vezes o mesmo atendimento não duplica OS, itens ou imagens; conflito é visível e revisável.
- Dados importados mostram origem e data; o painel funciona com cadastro manual quando a Maxpar está indisponível.
- Agenda impede confirmação acima da capacidade e libera a vaga anterior ao reagendar.
- Etapa concluída libera a próxima; etapa bloqueada/dispensada exige motivo; tempo de espera e execução são distintos.
- Alertas seguem o tipo de reparo e ajustes auditados da OS; prazo global também é mostrado.
- Vistorias exibem fotos por OS, placa e fase, com autor/data e permissões.
- Compra e uso de material afetam o estoque estimado; o caixa registra somente pagamentos e recebimentos efetivos.
- Recebíveis calculam vencimento pela regra do pagador e aceitam baixa parcial.
- Calia não dispara duas vezes para o mesmo evento e transfere exceções à recepção.
- Tarefas que exigem atualização na Maxpar são visíveis e não aparecem como sincronizadas sem confirmação.

## 11. Decisões ainda abertas

1. URL e comportamento real da conta Maxpar; campos exportáveis, fotos, ações de escrita e frequência permitida da leitura.
2. Se uma OS nasce na aprovação, no agendamento ou na entrada física; quando a oficina combina vários atendimentos em um mesmo reparo.
3. Categorias reais de reparo, etapas, limiares verde/laranja/vermelho, dias úteis/corridos e quem aprova mudança de prazo.
4. Capacidade: limite de entradas por dia, carros simultâneos, recursos críticos e bloqueios.
5. Campos da planilha financeira, política de NF, prazos efetivos por seguradora, variáveis de funcionários e eventual folha manual na V1.
6. Quem cadastra cada informação, quem executa tarefas no portal Maxpar e quais funcionários usam celular ou terminal compartilhado.
7. Condições de contato pelo WhatsApp/Calia e tratamento dos casos sem número válido ou sem resposta.

**Orientação ao implementador:** não assumir que uma hipótese sobre a Maxpar seja fato. Primeiro entregar um fluxo interno completo com registros de origem; adaptar a integração aos recursos comprovados durante a inspeção. Registrar decisões em aberto antes de codificar regras irreversíveis de negócio.
