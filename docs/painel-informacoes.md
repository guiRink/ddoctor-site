# Painel D doctor — Inventário de informações (quem vê, quem preenche, de onde vem)

> Complemento de `docs/painel-arquitetura.md` (modelo de dados §6, máquinas de estado §7, integrações §8, papéis §9) e de `docs/espec-dono-v1.md`. Este documento não repete contratos nem tabelas do banco: responde, campo a campo, **de onde vem cada informação, quem preenche e onde aparece**. Data: 12/10/2026.
>
> **Legenda de origem:** `Maxpar-L` = lido do portal/arquivo da Maxpar pelo leitor; `Maxpar-M` = copiado à mão do portal pela recepção; `Recepção`; `Produção`; `Gestor` (dono/gestor); `Financeiro`; `Calia`; `Calc` = calculado pelo painel. **(H)** = a disponibilidade do campo na Maxpar é **hipótese** até a inspeção da conta (portão G1, arquitetura §10). Nenhum campo (H) deve ser prometido ao dono como automático.

---

## 1. Pessoas e papéis

| Pessoa | Quando usa | Aparelho | Precisa ver em 5 segundos | O que preenche | Papel (arquitetura §9.1) |
| --- | --- | --- | --- | --- | --- |
| **Dono / gestor** | Manhã (abrir o dia), fim do dia (fechar), e sempre que alguém pergunta "e o carro X?" | Celular (maior parte), PC da recepção | Geral: carros na oficina, entregas de hoje, atrasados em vermelho, recebíveis vencidos, pendências no portal, se a Maxpar foi lida hoje | Tipo de reparo e etapas da OS, ajuste de prazo com motivo, dispensa/bloqueio de etapa, compras e conferência de estoque, decisões de conflito Maxpar × local, cadastros em Ajustes | Dono (A em tudo) / Gestor (E, sem usuários e segredos) |
| **Recepção / orçamentista** | O dia inteiro, a cada carro que chega, liga ou chega pelo portal | PC da recepção (placa "ORÇAMENTO — PARE AQUI"), celular para foto de entrada | Orçamentos: fila "aguardando agendamento" e o que está sem autorização; Agenda: quem chega hoje/amanhã e vagas | Cliente, veículo, dados do atendimento Maxpar quando o leitor não existir (formulário de 30 s), orçamento interno/particular, aprovação manual com evidência, agendamento/reagendamento, entrada real, vistoria de entrada, entrega, pendências externas executadas no portal, registro de contato com analista | Recepção (E em Orçamentos/Agenda/Vistorias; L em Produção e Recebíveis) |
| **Funileiro / martelinho / pintor / polidor** | Ao pegar e ao largar um carro; quando trava (peça, tinta, dúvida) | Celular próprio ou terminal compartilhado com PIN (decisão 6 da arquitetura) | "Minhas tarefas": qual carro é o próximo, prazo da etapa, cor, peças previstas | Botões Iniciar, Concluir (com contagem de peças e foto quando a etapa exige), Informar impedimento (motivo), Retomar; fotos "durante" | Produção (E só nas próprias etapas) |
| **Financeiro** (hoje o próprio dono; pode virar pessoa ou contador) | Semanal/mensal; a cada NF emitida e a cada extrato conferido | PC | Recebíveis vencidos e a vencer, o que a Maxpar ainda não pagou por OS, saldo realizado do mês | NF (número, data, valor), baixas (parcial/total), despesas e pagamentos, categorias, recálculo de vencimento com motivo | Financeiro (E em Recebíveis/Financeiro; L em Orçamentos valores) |
| **TV da produção** | Ligada o expediente inteiro | TV na oficina, conta "dispositivo" | Cartões grandes: placa, carro, etapa, responsável, peças feitas/previstas, tempos, cor; rodapé com hora da última atualização | Nada (somente leitura, sem teclado) | Dispositivo (L em `vw_producao`) |
| **Segurado / cliente** (via Calia) | Quando recebe o WhatsApp de agendamento; ao reagendar | WhatsApp do próprio cliente | Horários disponíveis que o painel liberou | Escolha de data/janela, confirmação, pedido de outro horário, pedido de falar com humano | Não tem conta; aparece como `origem = calia` no agendamento |
| **Analista Maxpar / gestor de rede** (ator externo) | Fora do painel: autoriza peças, recusa documentação, paga | Portal Maxpar, WhatsApp, chat | — | Nada no painel. Suas decisões chegam como snapshot (leitor) ou são copiadas pela recepção; contatos com ele viram "registro de contato" na OS | Sem acesso |

---

## 2. A jornada de um carro

Convenções: **R** recepção, **G** gestor, **P** produção, **F** financeiro, **S** sistema, **C** Calia. "Ficha" = ficha da OS dentro de Orçamentos.

### 2.1 Caminho A — assistência via Maxpar (o volume principal)

| # | Evento | Quem registra | Onde | Campos preenchidos | O que o painel faz em seguida |
| --- | --- | --- | --- | --- | --- |
| A1 | Atendimento aparece na conta Maxpar da oficina (o segurado foi direcionado) | S (leitor, após G1) **ou** R copiando do portal | Orçamentos → "Entrada rápida" (30 s) | Protocolo (H), seguradora (H), produto (H), placa, modelo (H), nome e telefone do segurado (H), data de abertura (H), data-limite da vistoria (H), peças solicitadas (H) | Cria `atendimento_externo` com fonte/`lido_em`; procura cliente/veículo por placa e telefone; se achar, sugere vincular (não funde sozinho); cria OS `rascunho` ligada ao atendimento (decisão 2 da arquitetura: provisoriamente a OS nasce aqui) |
| A2 | Recepção completa cliente/veículo | R | Ficha → Cliente/Veículo | Telefone confirmado (WhatsApp), e-mail, cor, ano, opt-out de contato | Marca campos como validados pela recepção (importação futura não sobrescreve) |
| A3 | Vistoria na loja (fotos no padrão da Maxpar) | R ou P | Vistorias → fase "entrada"/"externa" | Fotos (panorâmica + placa, por peça), danos por peça, observações | Guarda autor/data/dispositivo; vincula foto a peça do orçamento quando marcada; abre pendência externa "enviar fotos no portal" se a Maxpar exigir upload (H) |
| A4 | Autorização por peça chega (total, parcial ou negada) | S (leitor) **ou** R | Ficha → Orçamento externo, versão nova | Por peça: status (autorizada/negada/reanálise), técnica, valor autorizado (H); teto (H); franquia (H) | Nova versão externa imutável; aprovação aponta para ela; se todas as peças relevantes autorizadas e sem conflito → OS `aguardando_agendamento`; peça negada → ver exceção E1 |
| A5 | Fila de agendamento | S | Agenda → fila "aguardando agendamento" | — | Verifica telefone válido, regra de contato, opt-out; cria `interacao_calia` (ou texto para a recepção enviar à mão, até G3) |
| A6 | Cliente escolhe horário | C (ou R se manual) | Agenda | Data, janela, origem = calia | `reservar_vaga` como `proposto` com TTL; confirmação → `confirmado`; OS `agendada` |
| A7 | Carro entra fisicamente | R | Ficha → botão "Registrar entrada" | Data/hora real, tipo de reparo, box, prioridade, previsão de entrega (sugerida pelo modelo, ajustável com motivo) | OS `na_oficina`; gera etapas do modelo; primeira etapa `na_fila`; vistoria de entrada obrigatória (fotos antes) |
| A8 | Funcionário inicia etapa | P | Celular → Minhas tarefas → Iniciar | — (registra `iniciada_em`, usuário efetivo) | Etapa `em_execucao`; TV atualiza; começa a contar tempo em execução |
| A9 | Trava (peça do segurado não chegou, tinta, dúvida com analista) | P | Celular → Informar impedimento | Motivo (lista + texto) | Etapa `bloqueada`; cor pode ir a vermelho pelo limiar; gestor vê em Produção; se motivo = "peça", sugere pendência "aguardando peça do segurado" |
| A10 | Funcionário conclui etapa | P | Celular → Concluir | Peças feitas (contagem), foto "durante/depois" se o modelo exigir | Etapa `concluida`; próxima vira `na_fila`; registra tempos; TV atualiza |
| A11 | Última etapa concluída | S | — | — | OS `pronta`; aparece em "entregas de hoje" no Geral; sugere vistoria final |
| A12 | Vistoria final e entrega | R | Vistorias → fase "final"; Ficha → "Entregar" | Fotos finais, data/hora de entrega, franquia recebida (valor, forma), complemento recebido | OS `entregue`; cria `pendencia_externa(encerrar_portal)`; sugere títulos: franquia (pagador cliente, baixa já), complemento (cliente), mão de obra autorizada (pagador Maxpar/seguradora, `previsto`) |
| A13 | Encerramento no portal ("Serviço Realizado / Avaliação de Danos") | R ou G executa no portal e confirma no painel | Geral → Pendências externas → "Concluída" | Data, quem fez, evidência (print opcional), checklist: fotos no padrão, PDF na ordem, assinatura, NF | Pendência `concluida`; título Maxpar vira `emitido` com vencimento pela regra do pagador (base = data do envio, provisório) |
| A14 | Documentação recusada | S (leitor, se o portal mostrar (H)) ou R | Pendências externas → nova `reenviar_documentacao` | Motivo da recusa, data | Reabre checklist; vencimento do título pode ser recalculado com motivo |
| A15 | Pagamento da Maxpar cai | F | Recebíveis → Baixa | Valor, data, forma, comprovante | Título `recebido` (ou `parcial`); caixa do período; OS `encerrada` quando títulos e pendências fecham |

### 2.2 Caminho B — particular

| # | Evento | Quem | Onde | Campos | O painel faz |
| --- | --- | --- | --- | --- | --- |
| B1 | Cliente chega ou chama no WhatsApp | R | Orçamentos → Nova OS (origem = particular) | Cliente, veículo, fotos, itens do orçamento interno (peça, técnica, valor), desconto, validade | OS `rascunho` → `aguardando_aprovacao` ao salvar versão com ≥ 1 item |
| B2 | Cliente aprova | R | Ficha → "Registrar aprovação" | Data, canal (WhatsApp/presencial), evidência (print/assinatura), `confiavel` | OS `aguardando_agendamento`; dispara Calia ou agenda na hora se o carro já está lá |
| B3–B11 | Agenda, entrada, produção, entrega | Igual A6–A12 | | | Sem pendência externa; título único com pagador = cliente; sinal/entrada aceitos como baixa parcial antes da entrega |

### 2.3 Caminho C — seguradora direta ou outra assistência (ex.: Porto/Azul via Carglass, decisão 12 da arquitetura)

| # | Evento | Quem | Onde | Campos | O painel faz |
| --- | --- | --- | --- | --- | --- |
| C1 | Seguradora/assistência envia o caso por outro portal, e-mail ou telefone | R | Orçamentos → Entrada rápida (origem = seguradora_direta; fonte = manual) | Seguradora, número do sinistro/protocolo, placa, cliente, previsão exigida, contato do analista | `atendimento_externo` com `fonte = manual` (leitor não se aplica); mesma OS e mesmo fluxo |
| C2 | Orçamento/aprovação | R | Ficha → versão interna + aprovação manual com evidência (e-mail/PDF) | Itens, valores, franquia do sinistro se houver | Igual A4, sem leitor; se a seguradora exigir datas (previsão de início/conclusão), viram pendências externas "atualizar previsão" |
| C3 | Faturamento | F | Recebíveis | NF de serviço, vencimento pela regra do pagador (ex.: "3 dias úteis após faturamento", a confirmar por seguradora) | Título pagador = seguradora |

### 2.4 Exceções

| Caso | Quem | Onde | Campos | O painel faz |
| --- | --- | --- | --- | --- |
| **E1 Peça negada pela Maxpar → oferecer particular** | R | Ficha → "Criar versão interna a partir da negada" | Peças negadas copiadas com preço cheio, aprovação do cliente | OS vira `origem = misto`; dois títulos (Maxpar pela parte autorizada, cliente pela parte particular); etapas cobrem todas as peças |
| **E2 Complemento acima do teto** | R | Ficha → Orçamento externo → campo "complemento particular" | Valor combinado, aceite do cliente (evidência) | Título separado pagador = cliente; nunca somado ao valor autorizado |
| **E3 Documentação recusada** | R/G | Pendências externas | Motivo (assinatura, ordem do PDF, foto fora do padrão), data | Nova pendência `reenviar_documentacao`; conta recusas por OS (indicador "taxa de recusa") |
| **E4 Não compareceu** | R | Agenda → agendamento → "Não compareceu" | Motivo opcional | Vaga liberada; OS volta a `aguardando_agendamento`; nova interação Calia (versão +1) ou recepção liga |
| **E5 Protocolo com carro errado** (dor real do estudo) | S detecta / R resolve | Orçamentos → Conciliação | Placa do portal × placa local, decisão (manter local / aceitar externo / desvincular) | Conflito, não sobrescrita; pendência externa "pedir correção à Maxpar" |
| **E6 Reanálise de peça** | R | Ficha → pendência `solicitar_reanalise` | Peça, justificativa, data do pedido, protocolo do contato | Enquanto aberta, a OS não entra na fila de agendamento por aquela peça; se restante autorizado, gestor decide se entra parcial |
| **E7 Cancelamento** | G | Ficha → "Cancelar OS" | Motivo | Libera vaga, cancela Calia pendente, títulos `cancelado` |

---

## 3. Inventário de informações por aba

Colunas: campo | origem | quem preenche | quando/gatilho | obrigatório | validação/formato | onde mais aparece | observação.

### 3.1 Geral (só leitura; todo indicador abre a lista filtrada)

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Entradas hoje / semana | Calc | — | Agendamentos `confirmado` com data = hoje / semana | — | inteiro | Agenda | `count(agendamento.confirmado por data)` |
| Carros na oficina | Calc | — | OS `na_oficina` ou `pronta` | — | inteiro | Produção, TV | `count(os.estado in (na_oficina, pronta))` |
| Entregas previstas hoje | Calc | — | `previsao_entrega = hoje` e não entregue | — | inteiro | Produção | — |
| Atrasados | Calc | — | Semáforo vermelho | — | inteiro + lista | Produção, TV | Fórmula do semáforo em 3.5 |
| Aguardando autorização há mais de N dias | Calc | — | `atendimento_externo.status_normalizado = aguardando_autorizacao` e `hoje − abertura_em > N` | — | inteiro | Orçamentos | N provisório = 3 (seção 4) |
| Vistorias com data-limite vencendo (H) | Calc | — | `limite_vistoria_em − hoje ≤ 2` | — | inteiro | Orçamentos | Depende de a Maxpar mostrar a data-limite |
| Recebíveis vencidos / a vencer 7 e 30 dias | Calc | — | Títulos `emitido` por vencimento | — | R$ | Recebíveis | `vencido = vencimento < hoje e estado ∉ (recebido, cancelado)` |
| Saldo realizado do mês | Calc | — | Baixas − pagamentos no mês | — | R$ | Financeiro | Nunca inclui previsto |
| Pendências externas abertas | Calc | — | `pendencia_externa.estado in (aberta, em_andamento)` | — | inteiro + lista por tipo | Ficha da OS | É a "lista de tarefas no portal" |
| Saúde da sincronização | Calc | — | Última `sincronizacao`, conflitos abertos, worker online | — | "há X min · N conflitos · estado" | Ajustes | Se `lido_em` > 24 h: "desatualizado" |
| Fila de conciliação | Calc | — | `atendimento_externo.estado_conciliacao ≠ ok` | — | inteiro | Orçamentos | — |

### 3.2 Orçamentos (lista + ficha da OS)

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Número da OS | Calc | S | Criação | sim | sequencial por oficina (ex.: 2026-0143) | Todas | Nunca reaproveitado |
| Origem da OS | Recepção | R | Criação | sim | maxpar / seguradora_direta / particular / misto | Lista, Recebíveis | `misto` nasce na exceção E1 |
| Estado da OS | Calc | S | Máquina de estados (arq. §7.2) | sim | enum | Geral, Produção, Agenda | Só muda por ação com guarda |
| **Cliente** — nome | Maxpar-L (H) / Maxpar-M / Recepção | R valida | Entrada rápida ou cadastro | sim | texto ≥ 3 | Agenda, Vistorias, Recebíveis | Proveniência por campo |
| Cliente — telefone | Maxpar-L (H) / Recepção | R valida | Idem | sim para Calia | E.164 (+55 41 9…), 1 principal + extras | Agenda, Calia | Normalizado; dedupe por telefone |
| Cliente — e-mail | Recepção | R | Opcional | não | e-mail | Recebíveis (NF) | — |
| Cliente — CPF/CNPJ | Recepção | R | Só se a política de NF exigir | não | 11/14 dígitos, cifrado | Recebíveis | Minimização LGPD (arq. §9.3) |
| Cliente — opt-out de contato automático | Recepção | R | Pedido do cliente | não | bool | Agenda | Bloqueia Calia |
| **Veículo** — placa | Maxpar-L (H) / Recepção | R | Criação | sim | Mercosul ABC1D23 ou antiga ABC1234, exatamente 7, maiúscula (corrigir bug `placaValida` da QA) | Todas, TV | Índice, não chave; mesmo carro, N OS |
| Veículo — modelo, cor, ano | Maxpar-L (H) / Recepção | R | Criação | modelo sim | texto; ano 4 dígitos | Produção, TV, Agenda | — |
| Veículo — chassi | Maxpar-L (H) / Recepção | R | Opcional | não | 17 caracteres | — | Só se exigido pela seguradora |
| **Atendimento externo** — protocolo | Maxpar-L (H) / Maxpar-M | S ou R | Entrada rápida | sim quando origem ≠ particular | texto/numérico (ex.: 18383261) | Lista, Pendências, Recebíveis | Chave `(oficina, seguradora, id_externo)` |
| Seguradora | Maxpar-L (H) / Maxpar-M | S ou R | Idem | sim quando origem ≠ particular | escolha do cadastro de pagadores | Lista, Financeiro | Lista inicial na seção 5 |
| Produto da assistência (H) | Maxpar-L / Maxpar-M | S ou R | Idem | não | texto (ex.: Lataria e Pintura; Premium) | Ficha | Define teto provável |
| Número do sinistro (H) | Maxpar-L / Maxpar-M | S ou R | Se existir além do protocolo | não | texto | Ficha | Pode não existir em assistência |
| Status no portal (bruto) (H) | Maxpar-L | S | Cada leitura | — | texto como está no portal | Ficha | Nunca editado à mão; só anotado |
| Status normalizado | Calc | S | Mapa de status (Ajustes, após G1) | — | enum arq. §6.3 | Lista, Geral | Desconhecido → alerta |
| Data de abertura (H) | Maxpar-L / Maxpar-M | S ou R | Entrada | sim quando externo | data | Geral (sem autorização há N dias) | — |
| Data-limite da vistoria (H) | Maxpar-L / Maxpar-M | S ou R | Entrada | não | data | Geral | Estudo confirma que o link tem limite; se o portal mostra, (H) |
| Previsão registrada no portal (H) | Maxpar-L / Maxpar-M | S ou R | Se o portal exigir | não | data | Ficha, Produção | Separada da previsão ao cliente |
| Corretor (H) | Maxpar-L / Maxpar-M | S ou R | Se disponível | não | texto | Ficha | Vai em `dados_brutos` |
| Analista / gestor de rede responsável | Recepção | R | Primeiro contato | não | nome + canal | Ficha | Ajuda a cobrar |
| Fonte e `lido_em` | Calc | S | Cada leitura | — | "Maxpar (portal) · lido 12/10 14:32" | Ficha, Geral | Etiqueta "desatualizado" > 24 h |
| Estado de conciliação | Calc/Gestor | S propõe, R/G decide | Placa divergente, sem id externo | — | ok / pendente / conflito | Fila de conciliação | — |
| **Orçamento externo** — versão nº | Calc | S | Cada mudança detectada (hash) | — | inteiro | Ficha | Imutável |
| Item — peça (H) | Maxpar-L / Maxpar-M | S ou R | Cada versão | sim | lista fixa + "outra" (porta dianteira esq., capô, teto, para-lama, para-choque, tampa traseira, coluna, retrovisor…) | Vistorias, Produção (peças previstas) | Lista inicial na seção 5 |
| Item — técnica (H) | Maxpar-L / Maxpar-M | S ou R | Idem | sim | sra / martelinho / pintura / funilaria / polimento / outro | Produção | Técnicas públicas da Maxpar |
| Item — valor autorizado (H) | Maxpar-L / Maxpar-M | S ou R | Autorização | não | R$ 0,00 | Recebíveis | Base do título Maxpar |
| Item — status por peça (H) | Maxpar-L / Maxpar-M | S ou R | Autorização | sim | solicitado / autorizado / negado / reanálise / dispensado | Lista (contagem), Produção | Aprovação parcial preservada item a item |
| Teto de mão de obra (H) | Maxpar-L / Maxpar-M / cadastro do pagador | S ou R | Autorização | não | R$ | Ficha | Padrão por seguradora no cadastro (R$ 1.000 a confirmar) |
| Franquia (valor) (H) | Maxpar-L / Maxpar-M | S ou R | Autorização | sim quando Maxpar | R$ | Recebíveis (título cliente), Entrega | Paga na oficina (fato público) |
| Complemento particular | Recepção | R | Negociação com o segurado | não | R$ + evidência de aceite | Recebíveis | Exceção E2 |
| **Orçamento interno** — versão, itens, valor, desconto, validade | Recepção | R | Particular, complemento, peça negada | sim ≥ 1 item | R$; validade em dias | Recebíveis | Nunca marcado como "enviado à Maxpar" sozinho |
| Aprovação — tipo, data, evidência, confiável | Maxpar-L (H) / Recepção | S ou R | Autorização ou aceite do cliente | sim para avançar | externa / interna / cliente; print/áudio/assinatura; bool | Agenda (fila) | `confiavel = false` bloqueia Calia |
| Fotos vinculadas | Vistorias | P/R | Ver 3.4 | — | — | Vistorias | — |
| Pendências externas da OS | Calc / Recepção | S cria, R/G conclui | Marcos (arq. §3) | — | tipo, estado, responsável, data, evidência | Geral | Checklist de encerramento vira itens |
| Registro de contato (analista, gestor de rede, cliente) | Recepção/Gestor | R/G | Cada ligação/chat | não | data, canal (WhatsApp/telefone/chat portal/e-mail), quem, resumo, protocolo do chat | Ficha | Substitui `contatos[]` do v1 |
| Observações | Recepção/Gestor | R/G | Livre | não | texto | Ficha, Produção (resumo) | — |
| Conflitos abertos | Calc | S | Diff de snapshot | — | campo, valor local, valor externo | Ajustes | Resolução auditada |

### 3.3 Agenda

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Vagas de entrada do dia | Gestor (padrão em Ajustes) | G | Override por dia | sim | inteiro ≥ 0 | Geral, Calia | Padrão provisório na seção 4 |
| Carros simultâneos máx. | Gestor | G | Idem | não | inteiro | Produção (aviso laranja) | Avisa, não bloqueia (decisão 4) |
| Bloqueio — início, fim, recurso, motivo | Gestor | G | Feriado, cabine em manutenção, folga | sim motivo | datas; recurso opcional (cabine, box) | Calia (vagas) | Zera ou reduz vagas |
| Agendamento — data, janela, hora | Recepção / Calia | R ou C | Confirmação | sim | data; manhã/tarde/hora | Geral, Ficha | Reserva atômica |
| Estado do agendamento | Calc | S | Máquina §7.2 | sim | pendente … realizado | Ficha | `proposto` ocupa vaga até expirar |
| Origem | Calc | S | Quem criou | sim | recepção / calia / cliente | — | — |
| Expira em | Calc | S | Proposta da Calia | — | timestamp (TTL padrão 2 h) | — | Job libera vaga |
| Substitui (reagendamento) | Calc | S | Reagendar | — | id do anterior | Ficha | Anterior vira `cancelado` na mesma transação |
| Motivo de cancelamento / não compareceu | Recepção | R | Ação | sim | lista + texto | Ficha | Indicador "não comparecimento" por mês |
| Fila "aguardando agendamento" | Calc | S | OS no estado | — | lista: OS, cliente, telefone válido?, estado Calia, dias na fila | Geral | Ordenada por data da aprovação |
| Estado da interação Calia | Calia / Calc | C/S | Webhook ou registro manual | — | pendente … transferida_recepcao | Ficha | Até G3: recepção marca à mão |
| Texto da mensagem (modo manual) | Calc | S gera, R envia | Disparo | — | texto pronto para copiar | — | Até a API da Calia |
| Vagas restantes (calc) | Calc | — | — | — | inteiro | Geral, Calia | `vagas_entrada − count(proposto não expirado + confirmado)` |

### 3.4 Vistorias

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fase | Produção/Recepção | P/R | Entrada, durante, final; externa (importada) | sim | enum | Ficha, Produção | Fotos externas nunca na mesma vistoria das internas |
| Data/hora, autor, dispositivo | Calc | S | Upload | sim | timestamp; usuário efetivo | Ficha | Terminal + PIN registra o funcionário, não o terminal |
| Fotos | Produção/Recepção | P/R | Câmera direta no celular | entrada e final: sim (configurável) | JPEG ≤ 1600 px, EXIF de localização removido, SHA-256 | Ficha, Produção (celular) | Dedupe por hash |
| Legenda | Produção/Recepção | P/R | Opcional | não | texto curto | — | — |
| Peça/dano vinculado | Produção/Recepção | P/R | Ao fotografar | recomendado | escolha entre itens do orçamento | Orçamentos | Prova para disputa de aprovação parcial |
| Danos por peça (formulário) | Recepção | R | Entrada | não | peça, tipo (amassado, risco, trinca), tamanho aproximado, pré-existente? | Orçamentos | "Pré-existente" protege a oficina |
| Checklist "padrão de fotos da Maxpar" (H) | Gestor (cadastro) / Recepção | R marca | Entrada e final | não | itens: panorâmica com placa, por peça antes, por peça depois… | Pendências externas | O padrão real não é público; cadastrar após G1 |
| Fotos importadas da Maxpar (H) | Maxpar-L | S | Sincronização | — | origem = maxpar, ref externa | Ficha | Só leitura |
| Excluir própria foto | Produção/Recepção | autor | Até 10 min após envio | — | — | — | Depois só gestor, auditado |

### 3.5 Produção (kanban do gestor, TV e celular)

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tipo de reparo | Gestor (R pode) | G/R | Entrada real | sim | escolha do cadastro | Ficha, Funcionários | Gera etapas do modelo |
| Etapas da OS (nome, ordem) | Calc (modelo) + Gestor | S gera, G ajusta | Entrada real | sim | lista ordenada | TV, celular | Gestor pode dispensar (motivo) ou inserir |
| Estado da etapa | Produção / Calc | P (botões), S | §7.2 | sim | aguardando / na_fila / em_execucao / bloqueada / concluida / dispensada | TV, celular, Geral | — |
| Responsável | Gestor | G (R pode sugerir) | Entrada ou reatribuição | sim para iniciar | funcionário ativo | TV, celular, Funcionários | Só responsável ou gestor mexe na etapa |
| Box | Recepção/Gestor | R/G | Entrada; mudança | não | escolha do cadastro de boxes | TV, Ficha | — |
| Prioridade | Gestor | G | Reordenar | não | inteiro / "urgente" | TV (ordem) | — |
| Prazo da etapa (horas) e `prazo_em` | Calc (modelo) + Gestor | S, G ajusta | Entrada na fila / ajuste | sim | horas úteis; timestamp | TV, celular | Ajuste grava antes/depois/motivo/autor |
| Previsão global de entrega | Calc (modelo) + Gestor | S sugere, G/R ajusta | Entrada real | sim | data (+ hora opcional) | Geral, Agenda, Ficha, TV | Mostrada junto com a previsão do portal (H) quando houver |
| Entrou na fila em / iniciada em / concluída em | Calc | S nos botões | Botões | — | timestamp | TV, Funcionários | Base dos tempos |
| Peças previstas / feitas | Calc (itens autorizados) / Produção | S, P | Concluir | feitas: se o modelo exigir | inteiro | TV, Funcionários | "3/5" no cartão |
| Impedimento — motivo, início, fim | Produção | P (Retomar) | Botão | sim motivo | lista (peça do segurado, material, dúvida com analista, retrabalho, outro) + texto | TV ("impedido"), Geral, Funcionários | Não atribui culpa; só contexto |
| Dispensa — motivo | Gestor | G | Etapa não se aplica (ex.: funilaria em martelinho puro) | sim | texto | Ficha | Auditado |
| **Tempo em fila** | Calc | — | — | — | h:mm | TV, celular, Funcionários | `(iniciada_em ou agora) − entrou_fila_em` |
| **Tempo em execução** | Calc | — | — | — | h:mm | TV, celular, Funcionários | `(concluida_em ou agora) − iniciada_em − Σ(bloqueios)` |
| **Tempo bloqueada** | Calc | — | — | — | h:mm | TV, Ficha | `Σ(fim − início dos bloqueios)`; exibido separado, nunca somado |
| **Semáforo** | Calc | — | — | — | verde / laranja / vermelho | Geral, TV, celular, Agenda | Verde se nenhuma condição; laranja se `prazo_em − agora < laranja_antes_horas` (padrão 8 h úteis) ou previsão global ≤ 1 dia útil com etapas restantes; vermelho se `agora > prazo_em` ou `agora > previsao_entrega` ou bloqueio ativo > 4 h (arq. §7.4) |
| TV — campos exibidos | Calc | — | Realtime | — | placa, modelo/cor, serviço (tipo de reparo), etapa, responsável, peças feitas/previstas, tempo em fila, tempo em execução, previsão, cor, impedimento ativo | — | **Sem** cliente, telefone, valores, seguradora |
| TV — filtros por URL | Gestor | G configura | `?filtro=atrasados\|hoje\|impedidos` + rotação | — | — | — | — |
| Celular — "Minhas tarefas" | Calc | — | Login/PIN | — | etapas `na_fila`/`em_execucao`/`bloqueada` do usuário, ordenadas por cor e prazo | — | Detalhe mostra peças previstas, fotos de entrada, observações da OS (sem valores) |

### 3.6 Funcionários

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nome, papel, ativo | Gestor (dono) | D/G | Cadastro | sim | papel: dono / gestor / recepção / produção / financeiro | Produção (responsável), Ajustes | Usuário desativado some das listas, não do histórico |
| Especialidades | Gestor | G | Cadastro | não | martelinho / funilaria / pintura / polimento / higienização | Produção (sugestão de responsável) | — |
| E-mail de login **ou** PIN de terminal | Gestor | D | Convite ou terminal | um dos dois | e-mail; PIN 4–6 dígitos (hash) | — | Decisão 6 |
| Etapas concluídas, peças, carros (período) | Calc | — | — | — | inteiros | Geral (opcional) | `count(etapa_os.concluida por responsavel)`; peças = `Σ pecas_feitas`; carros = `count distinct os` |
| Tempo médio em execução por etapa | Calc | — | — | — | h:mm | — | média de "tempo em execução" por nome de etapa |
| Impedimentos informados | Calc | — | — | — | inteiro + motivos | — | Contexto, não penalidade |
| Regra de comissão (opcional) | Gestor | D | Só se o dono informar | não | % sobre mão de obra autorizada ou valor fixo por peça | Financeiro (indicador) | Não é obrigação financeira na V1 (arq. §4) |

### 3.7 Estoque

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Material — nome, categoria, unidade, saldo mínimo | Gestor | G | Cadastro | sim | categoria (tinta, massa, lixa, polidor, fita, solvente, outro); unidade (L, kg, un, m) | Financeiro (categoria) | Lista inicial na seção 5 |
| Compra — qtd, custo unitário, fornecedor, data, NF | Gestor | G | Compra | sim | R$; data | Financeiro (despesa vinculada **uma vez**) | Checkbox "gerar despesa" |
| Uso estimado — qtd, OS | Gestor (P pode informar na conclusão, opcional) | G/P | Conclusão de etapa de pintura/polimento | não | qtd por OS | Margem por OS | Estimativa, não baixa fiscal |
| Conferência — qtd contada, data | Gestor | G | Inventário | não | qtd | — | Redefine o saldo na data |
| Ajuste — qtd ±, motivo | Gestor | G | Perda, quebra | sim motivo | qtd; texto | — | Auditado |
| **Saldo estimado** | Calc | — | — | — | qtd | Geral (abaixo do mínimo) | `última conferência + Σ(compras e ajustes positivos após) − Σ(usos e ajustes negativos após)` |
| Última conferência | Calc | — | — | — | data | — | Alerta se > 90 dias (provisório) |
| Reposição sugerida | Calc | — | saldo < mínimo | — | lista | Geral | — |

### 3.8 Recebíveis

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Título — OS, pagador, descrição, valor | Calc (sugestão) + Financeiro | S sugere na entrega, F confirma | Entrega | sim | pagador do cadastro; R$ | Ficha, Geral, Financeiro | Três títulos típicos por OS Maxpar: franquia (cliente), complemento (cliente), mão de obra (Maxpar/seguradora) |
| Tipo de título | Calc | S | Sugestão | sim | franquia / complemento / mao_obra_autorizada / particular / peca | Financeiro (por tipo) | — |
| NF — número, data, valor, série | Financeiro | F | Emissão fora do painel | conforme política (seção 4) | texto; data; R$ | Pendências externas (checklist "NF") | Painel não emite NF |
| Vencimento | Calc + Financeiro | S pela regra, F recalcula com motivo | Emissão | sim | data | Geral | `base (nf_emitida_em \| entregue_em \| servico_realizado_em) + dias` (úteis ou corridos conforme regra do pagador) |
| Estado | Calc | S | Baixas | sim | previsto / emitido / vencido / parcial / recebido / cancelado | Geral | `vencido` é derivado |
| Baixa — valor, data, forma, comprovante | Financeiro / Recepção (franquia no balcão) | F ou R | Recebimento | sim | R$; data; dinheiro/Pix/débito/crédito/transferência; arquivo | Financeiro (caixa) | Parcial permitida; franquia costuma ser baixada na entrega |
| Desconto / glosa | Financeiro | F | Pagamento menor que o título | sim motivo | R$; motivo | — | Mantém rastro do que a Maxpar descontou |
| **Aging** | Calc | — | — | — | 0–30 / 31–60 / 61+ dias | Geral, Financeiro | `hoje − vencimento` para títulos emitidos não recebidos; também "dias desde o envio da documentação" |
| Saldo em aberto por pagador | Calc | — | — | — | R$ | Financeiro | `Σ(valor − baixas)` por pagador |
| Autorizado ainda não faturado | Calc | — | — | — | R$ | Geral | Títulos `previsto` (corrige o rótulo "a receber" criticado na QA) |

### 3.9 Financeiro

| Campo | Origem | Quem | Gatilho | Obrig. | Formato | Onde mais | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Despesa — categoria, descrição, valor previsto, vencimento, fornecedor, recorrente? | Financeiro/Gestor | F/G | Lançamento | sim | categoria do cadastro; R$; data | Geral (projeção) | Compra de material cria uma despesa vinculada |
| Pagamento — valor, data, forma | Financeiro | F | Pagamento | sim | R$; data; forma | Caixa | Previsto ≠ pago |
| **Saldo realizado do período** | Calc | — | — | — | R$ | Geral | `Σ baixas − Σ pagamentos` no período |
| **Projeção** | Calc | — | — | — | R$ | Geral | `saldo realizado + títulos a vencer no horizonte − despesas previstas a vencer` |
| **Margem por OS** | Calc | — | — | — | R$ e % | Ficha (gestor/financeiro) | `Σ títulos da OS − Σ(uso_estimado × custo_unitário médio) − comissão (se regra)`; rótulo "prevista" até todas as baixas |
| Por seguradora / pagador | Calc | — | — | — | carros, faturado, recebido, em aberto, prazo médio de pagamento, recusas de documentação | Geral | Prazo médio = média de `recebido_em − enviado_em` |
| Por categoria de despesa | Calc | — | — | — | R$ | — | — |
| Exportação CSV/PDF | Calc | F/D | Botão | — | arquivo com URL assinada | — | Para o contador |

### 3.10 Folha / ponto (futuro)

| Campo | Origem | Observação |
| --- | --- | --- |
| Marcações de ponto, faltas, horas | Fornecedor de ponto (futuro) | Interface `LeitorPonto` reservada (arq. §8.4). Nada na V1; a tela mostra "fora da V1". |

---

## 4. Informações que ninguém tem hoje

| Item | Por que o painel precisa | Formato sugerido de resposta do dono | O que o painel assume se não vier (provisório, rotulado "a confirmar") |
| --- | --- | --- | --- |
| **Tipos de reparo e etapas** | Gera as etapas da OS na entrada, define o kanban, a TV e o semáforo | Tabela: tipo de reparo → etapas em ordem → prazo padrão (h) → dispensável? → exige foto? → exige contagem de peças? | 4 tipos: Martelinho (desmontagem opcional → martelinho → polimento → montagem/revisão), Pintura (desmontagem → funilaria opcional → preparação → pintura → polimento → montagem), SRA (preparação → pintura localizada → polimento), Polimento/Higienização (polimento → higienização). Prazos: 4 h por etapa simples, 8 h pintura, 2 h polimento |
| **Prazo global por tipo** | Previsão de entrega sugerida | "Martelinho 1 peça: 1 dia útil; pintura 1 peça: 3 dias úteis…" | Soma dos prazos das etapas + 20 % de folga; dias úteis seg–sex |
| **Limiares do semáforo** | Credibilidade da cor na TV | Três números: laranja a X h do prazo da etapa; vermelho quando vencido; impedimento vira vermelho após Y h | 8 h úteis, vencido, 4 h (arq. §7.4) |
| **Horário de expediente e dias úteis** | Contar horas úteis | Seg–sex 8h–18h? Sábado? Almoço? | Seg–sex 8h–18h, sábado 8h–12h, sem desconto de almoço |
| **Capacidade** | Agenda e Calia só propõem o que cabe | Entradas por dia; carros simultâneos; recursos críticos (cabine de pintura? quantos boxes?) | 4 entradas/dia; 12 carros simultâneos (só aviso); boxes: funilaria, pintura, polimento, higienização (das placas da oficina, PRODUCT.md) |
| **Quem aprova mudança de prazo** | Permissão do botão | Só dono; dono e gestor; recepção também? | Dono e gestor |
| **Regras de prazo por pagador** | Vencimento dos títulos e aging | Tabela: pagador → base (data da NF / entrega / envio da documentação) → dias → úteis ou corridos | Maxpar: 30 dias corridos após envio da documentação (NÃO ENCONTRADO no estudo; valor do Sprint 0); cliente: na entrega; seguradora direta: 3 dias úteis após NF |
| **Política de NF** | Checklist de encerramento e campos do título | Emite NF de serviço para a Maxpar? Para o cliente na franquia? Quem emite (contador/sistema)? Precisa CPF do cliente? | NF registrada manualmente (número/data/valor), obrigatória para o título Maxpar, opcional para franquia; CPF não armazenado |
| **Categorias de despesa** | Financeiro por categoria | Lista a partir da planilha atual | Aluguel, energia/água, material de pintura, material de polimento, ferramentas, salários/pró-labore, comissões, marketing, impostos, manutenção, outros |
| **Planilha financeira atual** | Não perder colunas que o dono já usa | Enviar a planilha (abas e colunas) | Campos da seção 3.8/3.9 |
| **Lista de funcionários e papéis** | Login, responsáveis, PIN | Tabela: nome → função → celular próprio ou terminal → e-mail (se tiver) | 1 dono, 1 recepção, 3 produção em terminal compartilhado |
| **Quem executa no portal Maxpar** | Responsável padrão das pendências externas | Nome | Recepção |
| **Calia: horário e regras de contato** | Pré-condições de disparo | Horário permitido; tentativas; intervalo; o que fazer sem resposta ou sem número; quem assume | Seg–sex 9h–18h, sáb 9h–12h; 2 tentativas com 24 h de intervalo; depois recepção |
| **O que a Calia oferece (G3)** | HTTP ou manual | Documentação/contrato | Modo manual (texto pronto para copiar) |
| **Peças mais comuns** | Lista fechada no orçamento | Lista das peças que aparecem nas autorizações | Lista da seção 5 |
| **Padrão de fotos exigido pela Maxpar** (H) | Checklist de vistoria | Prints/manual, se existirem | Panorâmica com placa + 1 por peça antes e depois |
| **Seguradoras que chegam via Maxpar × direto × Carglass** | `origem` e cadastro de pagadores | Lista | Lista pública do estudo (seção 5), todas via Maxpar |
| **Teto e franquia por seguradora** | Sugestão de valores | Tabela seguradora → teto → franquia | Teto R$ 1.000; franquia R$ 160 (valores públicos, variam) |
| **Garantia** | Histórico por placa / retrabalho | 90 dias ou 6 meses? | 90 dias; retrabalho = nova OS com `origem = garantia` sem título |
| **Retenção de dados** | Expurgo e LGPD | Confirmar propostas da arq. §9.3 | 5 anos financeiro, 24 meses fotos, 12 meses snapshots e Calia |

---

## 5. Dados de referência e configuração (Ajustes)

| Cadastro | Quem mantém | Onde | Valores iniciais sugeridos (todos **provisórios**) |
| --- | --- | --- | --- |
| **Pagadores / seguradoras** | Dono | Ajustes → Pagadores | Maxpar (tipo maxpar); seguradoras que operam com a Maxpar segundo fontes públicas: Tokio Marine, Liberty, HDI, Zurich, MAPFRE, BB Seguros, Bradesco, Allianz, SulAmérica, Azul, Porto Seguro (as duas últimas possivelmente via Carglass — decisão 12); Cliente particular (tipo cliente); Outro |
| **Regra de prazo por pagador** | Dono/financeiro | Ajustes → Pagadores → regra | Ver seção 4 |
| **Teto e franquia padrão por seguradora (H)** | Dono | Ajustes → Pagadores | R$ 1.000 / R$ 160; Zurich Premium R$ 1.500; HDI R$ 900 |
| **Tipos de reparo e modelos de etapas** | Dono/gestor | Ajustes → Produção | Ver seção 4 |
| **Peças** | Gestor | Ajustes → Produção → Peças | Para-choque dianteiro/traseiro, capô, teto, tampa traseira, para-lama DE/DD/TE/TD, porta DE/DD/TE/TD, coluna, retrovisor, soleira, outra |
| **Técnicas** | Fixo no código (enum) | — | sra, martelinho, pintura, funilaria, polimento, outro |
| **Motivos de impedimento** | Gestor | Ajustes → Produção | Peça do segurado não chegou, falta de material, dúvida com analista/aprovação, retrabalho, cliente não respondeu, outro |
| **Boxes / recursos** | Gestor | Ajustes → Produção → Boxes | Funilaria, Pintura (cabine), Polimento/Espelhamento, Higienização, Pátio coberto (das placas da oficina) |
| **Funcionários e papéis** | Dono | Ajustes → Usuários | Ver seção 4; conta "TV" e conta "Terminal produção" |
| **Semáforo** | Dono/gestor | Ajustes → Prazos | 8 h úteis / vencido / 4 h; expediente seg–sex 8–18, sáb 8–12 |
| **Capacidade padrão** | Dono/gestor | Ajustes → Agenda | 4 entradas/dia; 12 simultâneos (aviso); janelas manhã/tarde |
| **Regras de contato Calia** | Dono | Ajustes → Calia | Ver seção 4; TTL da proposta 2 h |
| **Categorias de material** | Gestor | Ajustes → Estoque | Tinta/verniz, massa/primer, lixa/abrasivo, polidor/cera, fita/mascaramento, solvente, EPI, outro |
| **Categorias de despesa** | Financeiro | Ajustes → Financeiro | Ver seção 4 |
| **Formas de pagamento** | Financeiro | Ajustes → Financeiro | Dinheiro, Pix, débito, crédito, transferência, boleto |
| **Tipos de pendência externa** | Fixo + gestor | Ajustes → Integrações | encerrar_portal, enviar_documentacao, reenviar_documentacao, solicitar_reanalise, atualizar_previsao, pedir_correcao_veiculo, outro |
| **Checklist de encerramento (H)** | Gestor | Ajustes → Integrações | Fotos antes, fotos depois, PDF na ordem, assinatura conforme manual, NF (itens do v1) |
| **Mapa de status da Maxpar (H)** | Gestor (após G1) | Ajustes → Integrações | Vazio até G1; valor desconhecido → `desconhecido` + alerta |
| **Limites de alerta** | Gestor | Ajustes → Prazos | Sem autorização > 3 dias; vistoria vence em ≤ 2 dias; pagamento Maxpar > 30 dias; conferência de estoque > 90 dias |
| **Retenção** | Dono | Ajustes → Privacidade | Arq. §9.3 |

---

## 6. Regras de qualidade da informação

### 6.1 Proveniência

| Regra | Como aparece |
| --- | --- |
| Todo campo que pode vir da Maxpar carrega fonte (`maxpar_portal` / `maxpar_arquivo` / `manual` / `api`), `lido_em` e, quando a recepção confirmou, `validado_por` + `validado_em` | Na ficha: etiqueta pequena ao lado do campo ("Maxpar · 12/10 14:32" ou "Recepção · Ana · 12/10") |
| Dado externo com `lido_em` > 24 h | Etiqueta "desatualizado"; o Geral mostra "Maxpar: última leitura há X" |
| Campo digitado à mão a partir do portal (`Maxpar-M`) | Fonte = `manual`, com observação "copiado do portal"; vale menos que leitura automática em conflito futuro, mas mais que vazio |
| Registro sem protocolo confiável | `estado_conciliacao = pendente`; não entra em indicadores de autorização até resolver |

### 6.2 Conflito Maxpar × local

| Situação | Comportamento |
| --- | --- |
| Importação encontra campo local **vazio ou não validado** | Preenche, com fonte Maxpar |
| Importação encontra campo local **validado** com valor diferente | Não sobrescreve; abre `conflito_sync` (campo, valor local, valor externo); ficha mostra aviso; Ajustes lista; resolução por recepção/gestor com uma de três ações: manter local, aceitar externo, ignorar; auditada |
| Placa do portal ≠ placa do veículo vinculado | Conflito bloqueante: a OS não avança para agendamento até resolver (exceção E5) |
| Status externo muda | Nunca é editado localmente; nova versão/snapshot; se a mudança contradiz a aprovação registrada (ex.: peça autorizada passa a negada), bloqueia disparo Calia e cria alerta |
| Peça do orçamento interno sem correspondente externo | Permitido (particular/complemento); nunca marcado como "enviado à Maxpar" sem pendência externa concluída |

### 6.3 Campos imutáveis

| O que | Regra |
| --- | --- |
| Versões de orçamento (externas e internas) e seus itens | Nunca editadas; correção = nova versão; anterior vira `substituido` |
| Aprovação | Aponta para uma versão; mudar = nova aprovação sobre nova versão |
| Snapshots e `sincronizacao` | Somente inserção; nem o dono apaga |
| Eventos de auditoria | Somente inserção |
| Baixas e pagamentos | Não se edita; estorno = novo lançamento negativo com motivo |
| Número da OS, número da versão, número do título | Sequenciais, nunca reutilizados |
| Fotos | Não se substitui o arquivo; exclusão só pelo autor em 10 min ou pelo gestor com motivo (registro fica, arquivo some) |

### 6.4 Auditoria — mudanças que exigem motivo

| Ação | Quem pode | Motivo obrigatório | Registro |
| --- | --- | --- | --- |
| Ajustar prazo de etapa ou previsão global | Dono/gestor (decisão da seção 4) | sim | `ajuste_prazo` + evento |
| Dispensar ou bloquear etapa | Gestor (bloquear: produção) | sim | evento |
| Registrar aprovação manual | Recepção/gestor | evidência obrigatória | evento |
| Resolver conflito | Recepção/gestor | sim | evento |
| Recalcular vencimento | Financeiro | sim | evento |
| Baixa com valor menor que o título (glosa) | Financeiro | sim | evento |
| Cancelar OS ou agendamento | Gestor / recepção | sim | evento |
| Reatribuir responsável com etapa em execução | Gestor | sim | evento |
| Editar cadastros em Ajustes | Dono/gestor | não, mas auditado | evento |
| Concluir pendência externa | Recepção/gestor | data + quem + evidência opcional | evento |

### 6.5 Privacidade (LGPD) — complemento da arq. §9.3

| Dado | Quem vê | Regra |
| --- | --- | --- |
| Nome e telefone do segurado | Recepção, gestor, dono, financeiro | Produção vê só nome abreviado na OS; TV não vê |
| CPF/CNPJ | Financeiro, dono | Só se política de NF exigir; cifrado; não exportado em CSV padrão |
| Fotos | Quem tem acesso à OS | Bucket privado, URL assinada 10 min; EXIF de localização removido; podem conter rosto/documento: não compartilhar fora do painel |
| Valores autorizados, franquia, margem | Gestor, dono, financeiro (recepção: valores da OS, sem margem) | TV e celular nunca |
| Transcrição Calia | Recepção, gestor | 12 meses; sem exportação |
| Snapshots brutos da Maxpar | Dono, gestor (Ajustes) | 12 meses; contêm dados pessoais do segurado: mesma proteção |
| Direitos do titular | Dono | Localizar por telefone/placa → exportar ou anonimizar (OS e títulos permanecem) |
| Logs e alertas | — | Só número da OS e protocolo; sem nome, telefone, senha, token |

---

## 7. Mapa "de onde vem → onde aparece"

Legenda: **C** cria, **E** edita, **L** lê, **∅** não aparece. Colunas: Ger = Geral, Orç = Orçamentos/ficha, Age = Agenda, Vis = Vistorias, Prod = Produção (gestor), TV, Cel = Produção celular, Fun = Funcionários, Est = Estoque, Rec = Recebíveis, Fin = Financeiro, Aju = Ajustes.

| Entidade | Ger | Orç | Age | Vis | Prod | TV | Cel | Fun | Est | Rec | Fin | Aju |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cliente | L (contagem) | C/E | L | L | L (nome abreviado) | ∅ | L (nome abreviado) | ∅ | ∅ | L | ∅ | E (anonimizar) |
| Veículo | L | C/E | L | L | L | L (placa/modelo) | L | L | ∅ | L | ∅ | ∅ |
| Atendimento externo | L (sem autorização, conciliação) | C/E (manual) · L (leitor) | L | L (ref. fotos externas) | L (status) | ∅ | ∅ | ∅ | ∅ | L (protocolo) | L (por seguradora) | L (snapshots, conflitos, mapa de status) |
| OS | L (contagens) | C/E | L/E (estado via agendamento) | L | E (box, prioridade, previsão) | L | L (própria) | L | L (uso por OS) | L | L (margem) | ∅ |
| Orçamento / versão / item | ∅ | C/E/L | L (fila) | L (vincular foto a peça) | L (peças previstas) | L (contagem de peças) | L (peças da etapa, sem valor) | L (peças feitas) | ∅ | L (base do título) | L (valores) | ∅ |
| Aprovação | L (fila) | C/L | L | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | L | ∅ | ∅ |
| Etapa da OS | L (atrasados) | L | ∅ | L | C/E (gerar, atribuir, prazo, dispensar) | L | E (iniciar, concluir, impedimento) | L (agregado) | ∅ | ∅ | ∅ | L (modelos) |
| Agendamento / capacidade / bloqueio | L (entradas) | L | C/E | ∅ | L (aviso de simultâneos) | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | E (capacidade padrão) |
| Vistoria / foto | ∅ | L | ∅ | C/E | L (miniaturas) | ∅ | C (foto na conclusão) | ∅ | ∅ | ∅ | ∅ | E (retenção) |
| Material / movimento | L (abaixo do mínimo) | ∅ | ∅ | ∅ | ∅ | ∅ | C (uso estimado, opcional) | ∅ | C/E | ∅ | L (despesa vinculada) | E (categorias) |
| Título / baixa | L (vencidos, a vencer) | L (resumo da OS) | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | C/E | L | E (pagadores, regras) |
| Despesa / pagamento | L (saldo, projeção) | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | L (comissão, se regra) | C (compra) | ∅ | C/E | E (categorias) |
| Pendência externa | L (lista) | C/E | ∅ | L (checklist de fotos) | L (aviso) | ∅ | ∅ | ∅ | ∅ | L (NF) | ∅ | E (tipos, checklist) |
| Interação Calia | L (contagem) | L | C/E (disparar, parar, assumir) | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | E (regras) |
| Registro de contato | ∅ | C/L | L | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | L | ∅ | ∅ |
| Auditoria / sincronização | L (saúde) | L (histórico da OS) | ∅ | ∅ | L (ajustes de prazo) | ∅ | ∅ | ∅ | ∅ | L (financeira) | L | L |
| Funcionário / perfil | ∅ | ∅ | ∅ | L (autor) | L (responsável) | L (nome) | L (próprio) | C/E | ∅ | ∅ | ∅ | C/E |

---

## 8. O que muda em relação ao Sprint 0

| Tela / campo atual (Sprint 0) | O que vira no modelo completo | Reaproveitar ou descartar |
| --- | --- | --- |
| `Atendimento` único (`tipos.ts`) | Cliente + Veículo + AtendimentoExterno + OS + Orçamento/Versão/Item + Aprovação (arq. §6.4) | Descartar a interface; manter enums de técnica e sub-etapas como ponto de partida |
| `etapa` macro (9 valores) | Desdobra em `atendimento_externo.status_normalizado`, `os.estado`, `agendamento.estado`, `etapa_os`, `pendencia_externa`, `titulo_receber` | Descartar; o kanban por macro-etapa some |
| `subEtapa`, `box`, `responsavel`, `etapaDesde` | `etapa_os` (nome, estado, responsável, entrou_fila_em, iniciada_em, concluída_em), `os.box` | Reaproveitar nomes de etapas como modelo inicial |
| `pecas[]` com `solicitada`/`autorizada`/`valorAutorizado` | `item_orcamento` numa versão externa; `status_item`; aprovação por versão | Reaproveitar a ideia de "por peça"; descartar booleanos |
| `franquia`, `complemento`, `financeiro.aReceberMaxpar` | Três títulos em Recebíveis + campos da versão | Descartar os campos soltos |
| `documentacao` (checkboxes, `enviadaEm`, `recusas[]`, `pagoEm`) | `pendencia_externa` (checklist como itens), recusas = novas pendências, pagamento = `baixa` | Reaproveitar os 5 itens do checklist como cadastro inicial |
| `contatos[]` | Registro de contato na OS (data, canal, quem, resumo, protocolo) | Reaproveitar o formato quase igual |
| `financeiro.custoMaterial`, `comissao` | `movimento_estoque(uso_estimado)`, regra de comissão opcional | Descartar como campo manual |
| `previsaoCliente` / `previsaoPortal` | `os.previsao_entrega` (mestre) / `atendimento_externo.previsao_portal` (H) | Reaproveitar o par |
| `LIMITES` (3/2/30 dias) e `pendencias()` | `config_oficina.limites` editável; pendências viram indicadores calculados do Geral com rótulo "provisório" | Reaproveitar como padrão; corrigir rótulo (QA 4) |
| Tela **Pátio** | **Produção** (kanban por etapa de produção, não por macro-etapa) + TV + celular | Descartar colunas; reaproveitar cartão (placa, modelo, responsável, dias) |
| Tela **Atendimentos** (lista) | **Orçamentos** (lista por estado da OS, com filtros) | Reaproveitar busca por placa/protocolo/cliente |
| Tela **Ficha** | Ficha da OS em Orçamentos, com seções Cliente/Veículo, Atendimento externo (com proveniência), Versões lado a lado, Fotos, Pendências, Contatos | Reaproveitar o componente `Campo` e a estrutura; seção "Dinheiro" vai para Recebíveis com resumo na ficha |
| Tela **Pendências** | Bloco de pendências no Geral (calculadas) + lista de `pendencia_externa` (humanas) | Reaproveitar os textos explicativos; separar "alerta calculado" de "tarefa no portal" |
| Tela **Agenda** (entregas por previsão) | **Agenda** de entradas com capacidade, bloqueios e fila; entregas previstas passam para Geral/Produção | Descartar a lógica atual (era agenda de entregas, não de entradas) |
| Tela **Financeiro** | **Recebíveis** (títulos, NF, baixas, aging) + **Financeiro** (despesas, caixa, projeção) | Reaproveitar "por seguradora"; renomear "a receber" (QA 5) |
| Tela **Ajustes** (demo + PIN) | Ajustes com todos os cadastros da seção 5; PIN vira PIN de terminal por funcionário; demo vira `seed.sql` | Descartar PIN do navegador; manter botão de demo |
| `placaValida` | Corrigir para exigir 7 caracteres (QA 2) | Corrigir |
| `rotulos.ts` | Cresce com rótulos de estados v2 e etiqueta curta de pendência (QA 8) | Reaproveitar |
| Dados Dexie | Não migram (arq. §6.4) | Descartar |

---

## 9. Perguntas abertas

As decisões 1–12 da arquitetura §11.1 (portal e campos da Maxpar, quando nasce a OS, tipos de reparo e limiares, capacidade, planilha e NF, quem cadastra e terminal, Calia, hospedagem, plano Supabase, retenção, Carglass) continuam valendo e não são repetidas. As seguintes são específicas da informação:

1. **A recepção quer copiar do portal ou esperar o leitor?** Se copiar desde o Sprint 2, o formulário de 30 s precisa de todos os campos (H) como opcionais e a proveniência `manual` passa a ser a regra; se esperar, a V1 fica sem indicadores de autorização até G1.
2. **Quais campos a oficina realmente consulta no portal no dia a dia** (peça, valor, status, data-limite, previsão exigida)? Define quais (H) viram obrigatórios na entrada rápida e quais ficam em `dados_brutos`.
3. **Franquia é baixada na entrega ou na entrada do carro?** Muda quem registra (recepção no balcão × financeiro) e se a Agenda mostra "franquia pendente" antes do serviço.
4. **A Maxpar desconta a franquia do que paga à oficina?** (INFERÊNCIA do estudo.) Se sim, o título Maxpar nasce com `valor = mão de obra autorizada − franquia` e a glosa é esperada; se não, o título é cheio.
5. **Existe "Impressão de Serviço" em PDF e o dono aceita colar texto?** Habilita o `ArquivoReader` e define o mapeamento de colunas; senão fica só manual.
6. **O funcionário pode informar uso de material na conclusão da etapa?** Se sim, o celular ganha um campo opcional e a margem por OS fica mais real; se não, só o gestor lança e a margem é por média.
7. **A contagem de peças feitas é por peça autorizada ou por "ponto" de martelinho?** Muda o que "peças feitas/previstas" significa na TV e em Funcionários.
8. **Vistoria final é obrigatória para entregar?** Se sim, o botão "Entregar" trava sem fotos finais; se não, vira aviso.
9. **Quem assina "não compareceu" e com que tolerância** (ex.: 2 h após a janela)? Define o job de expiração e se a vaga volta no mesmo dia.
10. **Previsão ao cliente é data ou data + hora?** Muda o semáforo global (≤ 1 dia útil) e o texto da Calia.
11. **Comissão aparece para o funcionário no celular?** Se sim, o papel produção passa a ver um valor financeiro (hoje proibido pela RLS); se não, só o dono vê em Funcionários.
12. **Seguradora direta exige datas no portal dela** (como Tokio: previsão de início/conclusão)? Se sim, `atualizar_previsao` vira pendência automática quando o gestor muda a previsão global.
13. **Garantia vira OS própria?** Define `origem = garantia`, sem título e com vínculo à OS original, e se conta na produtividade.
14. **Carro com dois atendimentos (duas seguradoras ou Maxpar + particular) é uma OS ou duas?** Além da decisão 2 da arquitetura: define se a TV mostra um cartão ou dois e como os títulos se separam.
15. **O dono quer o indicador "taxa de recusa de documentação" e "prazo médio de pagamento por seguradora" no Geral?** Se sim, `pendencia_externa` precisa de motivo normalizado (lista) além do texto.

---

### Arquivos críticos para a implementação

- `/Users/guilhermerink/Documents/Claude/GusPainel/docs/painel-arquitetura.md` — seções 6 (modelo), 7 (estados), 8 (integrações), 9 (papéis) às quais este documento se amarra.
- `/Users/guilhermerink/Documents/Claude/GusPainel/docs/espec-dono-v1.md` — abas, matriz origem→destino e critérios de aceitação que cada tabela acima detalha.
- `/Users/guilhermerink/Documents/Claude/GusPainel/codigo/painel/src/dominio/tipos.ts` — modelo v1 a desdobrar conforme a seção 8.
- `/Users/guilhermerink/Documents/Claude/GusPainel/codigo/painel/src/dominio/regras.ts` — `LIMITES`, `pendencias()`, `placaValida` que migram para `config_oficina` e para os indicadores calculados.
- `/Users/guilhermerink/Documents/Claude/GusPainel/codigo/painel/src/telas/Ficha.tsx` — base da ficha da OS (componente `Campo`, seções) a reorganizar em Orçamentos.