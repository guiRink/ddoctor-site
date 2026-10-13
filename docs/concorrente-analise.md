# Análise do ERP concorrente (13/10/2026)

O Guilherme pediu para ver o sistema que outro fornecedor montou para a D doctor (app Lovable, perfil Recepção). Este documento compara o que ele tem com o nosso painel e diz o que entra no sprint SE. **Nenhum dado de lá vem para cá.** Nomes de funcionários e de clientes vistos lá não entram no repositório.

## 1. O que ele tem, tela por tela

| Tela | Conteúdo |
| --- | --- |
| Visão geral | 4 contadores: clientes cadastrados, veículos, OS e OS em aberto. Gráfico "Produção prevista" com peças por dia útil contra a capacidade (10 peças/dia) e calendário do mês com peças previstas por dia. |
| Clientes | Lista com busca por nome, CPF/CNPJ, telefone, WhatsApp e e-mail. Cadastro com PF/PJ, CPF/CNPJ, nome, telefone, WhatsApp, e-mail, endereço completo (CEP, rua, número, complemento, bairro, cidade, UF) e observações. |
| Veículos | Lista com busca por placa, marca, modelo ou cliente; a placa aparece como etiqueta de texto. |
| Ordens de serviço | Lista com filtro por estado. Os filtros mostram estados "legado". Nova OS em 4 abas: **Dados** (busca do cliente por CPF, veículo, entrada, previsão, **km**, **nível de combustível**, **reclamação do cliente**, **observações internas**), **Checklist** (23 itens em 4 grupos), **Mapa de avarias** (desenho do carro em 5 vistas, tipo amassado/risco/pintura/vidro/outro, tamanho P/M/G) e **Serviços** (itens e desconto). |
| Ficha da OS | Cliente, veículo (km, combustível) e valores (subtotal, desconto, total). Abas: Serviços, **Insumos** (retirada do estoque por funcionário com custo), **Mão de obra** (apontamento por hora ou minuto e valor), **Outros custos** (terceirização com fornecedor), **Resultado** (custo e margem, restrito), **Pagamentos** (total, recebido, saldo, forma, parcelas), Checklist e Avarias. Botão **Imprimir orçamento**. |
| Produção | Kanban por estado da OS (aguardando início, preparação, andamento, aguardando material, finalizado, entregue). Os cartões mostram o valor. |
| Estoque | Contadores: materiais ativos, itens críticos e estoque parado há 90 dias. Botões de entrada, retirada e novo material. Abas: materiais, **movimentações** rastreadas (compra, saída para OS, consumo interno), **reposição**, **fornecedores**, funcionários e **consumo por funcionário**. Exportação. Custo médio ponderado. |
| Custos operacionais | Restrito; não aparece para a recepção. |
| Financeiro | Competência mensal. Entradas, saídas, resultado e a pagar. Nova despesa com descrição, categoria, valor, vencimento, pago em, forma, fornecedor e observações. **Fechamento de caixa diário**: saldo inicial, contado, entradas e saídas em dinheiro, esperado e diferença. |
| Relatórios | Recebido, despesas pagas, resultado, OS abertas e ticket médio. Abas: faturamento por forma de pagamento, despesas por categoria, recebimentos por dia, OS por estado com margem estimada, top 10 clientes e peças consumidas. |
| Configurações | Usuários e permissões, **categorias financeiras**, auditoria, dados de teste. |

## 2. Onde ele é mais fraco que o nosso

- Não tem fluxo de seguradora nem Maxpar: falta protocolo, autorização, franquia, pendência no portal e proveniência dos dados.
- Não tem agenda com capacidade nem fila de quem espera agendamento.
- A produção é por estado da OS. Não tem etapas, responsável, prazo, semáforo, impedimento nem tempo em fila. Também não tem TV nem celular do funcionário.
- A Visão geral mostra contagens que não pedem ação. Não diz o que está atrasado, quem entra hoje ou o que vence.
- O valor aparece no quadro de produção, então não há separação por papel do que cada um vê.
- Há dados duplicados (o mesmo usuário três vezes), funções "sem função" e estados "legado" expostos.
- Visual: tema cinza-escuro genérico de kit pronto, pílulas por toda parte e cartões grandes para um número só.

## 3. O que trazemos para o nosso (sprint SE)

1. **Clientes e veículos:** tela própria com ficha do cliente (veículos, histórico de OS, total pago); cadastro completo (PF/PJ, CPF/CNPJ validado, WhatsApp, e-mail, endereço); busca por documento.
2. **Recepção do veículo** na entrada: km, combustível, reclamação, observações internas, checklist configurável e mapa de avarias (5 vistas, tipo, tamanho).
3. **Custos da OS:** insumos retirados do estoque (com funcionário), mão de obra, terceirização e outros custos. **Resultado** com margem, só para dono, gestor e financeiro.
4. **Pagamentos na OS** (particular e franquia): forma, parcelas, saldo; ligado aos títulos e baixas.
5. **Imprimir orçamento / OS** em folha A4 limpa.
6. **Estoque:** entrada por compra com custo médio ponderado, retirada para OS ou consumo interno, movimentações, reposição, fornecedores, consumo por funcionário, estoque parado e exportação em CSV.
7. **Financeiro:** nova despesa, categorias configuráveis, competência mensal e fechamento de caixa diário.
8. **Relatórios:** tela nova com faturamento por forma, despesas por categoria, recebimentos por dia, OS por estado, ticket médio, margem, top clientes e peças consumidas.
9. **Geral:** produção prevista contra a capacidade e calendário de entregas do mês, sem perder o "Precisa de ação".
10. **Ajustes:** categorias financeiras, itens do checklist e registro de auditoria.

Fica de fora: login por e-mail ou Google (o login por papel entra no S1 com o Supabase) e o kanban por estado da OS (o nosso é por etapa, que é melhor).

## 4. Visual

O Guilherme pediu um painel **mais limpo, profissional e bonito**. A direção nova está em `docs/painel-design.md` (revisão SE):
- fundo claro e neutro, com barra lateral clara;
- raio pequeno e espaço generoso;
- títulos em Archivo de largura normal, sem caixa-alta condensada em todo lugar;
- amarelo só na ação primária e no item ativo;
- estados em pílulas suaves.

A placa Mercosul continua sendo a identidade de cada carro.
