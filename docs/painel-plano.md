# Painel D doctor — plano do projeto

Data: 02/10/2026. Base: `docs/maxpar-estudo.md` (o que a Maxpar é de fato e o que a oficina controla em planilha) e `PRODUCT.md`.

## 1. O que o painel é

Gestão interna da oficina, do carro que chega ao dinheiro que entra. Substitui as planilhas Excel e dá visão do que está "preso" na Maxpar. **Não substitui a Maxpar**: a conversa com a seguradora (autorização, encerramento, documentação) continua na Área do Credenciado / Portal do Prestador; o painel registra e cobra.

Usuários: o dono (visão geral, financeiro, pendências) e a recepção/funileiros (fila do pátio, ficha do carro). Celular e PC da recepção.

## 2. Método de trabalho: sprints curtos, cada um rodado em loop

Decisão: **sprints de 1 bloco de valor demonstrável, executados em loop autônomo até fechar o checklist do sprint, com checkpoint do cliente (irmão) entre sprints.**

Por quê: muitos fatos ainda estão em aberto (telas reais do portal, planilha atual, prazo real de pagamento, quais seguradoras chegam via Maxpar vs Carglass). Um loop único "até terminar o projeto" construiria telas sobre suposições. Sprints curtos trazem o irmão para validar cedo; dentro do sprint, o loop evita micro-gerência.

Ritual de cada sprint:
1. Ler `notas/mapa.md` (estado atual) e o checklist do sprint neste arquivo.
2. Implementar em loop até o checklist fechar (build limpo, testes, deploy em `/painel/`).
3. Rodar o agente `revisor-qa` no diff; corrigir o que for material.
4. Rodar o agente `escrivao` para atualizar `notas/mapa.md`, `notas/status.md` e `Atualização noturna.md`.
5. Mandar o link para o irmão com 3 perguntas objetivas. As respostas viram o backlog do próximo sprint.

## 3. Stack (decidida)

| Camada | Escolha | Por quê |
|---|---|---|
| App | **Vite + React 19 + TypeScript** | SPA simples, rápida de iterar, sem servidor. |
| Estilo | **Tailwind v4** com os tokens de `DESIGN.md` (amarelo `#F2C200`, preto `#0A0A0A`, papel `#F4F3EE`, Archivo) | Mesma identidade da landing; painel é modo *Operate*: clareza acima de expressão. |
| Rotas | react-router (**HashRouter**) | GitHub Pages não faz fallback de rota; hash evita 404. |
| Dados (Sprint 0–3) | **Dexie (IndexedDB)** atrás de uma interface `Repositorio` | Funciona hoje, sem conta em serviço nenhum; dados demo para aprovação. |
| Dados (Sprint 4+) | **Supabase** (Postgres + Auth + Storage) implementando a mesma interface | Multi-dispositivo (celular do dono + PC da recepção), fotos, login. Precisa que o cliente crie a conta. |
| Deploy | GitHub Pages, build do Vite para `codigo/site/painel/` no workflow | Mesmo link da landing: `https://guirink.github.io/ddoctor-site/painel/`. |
| Testes | Vitest + Testing Library | Regras de negócio (etapas, prazos, financeiro) testadas sem navegador. |

Decisões derivadas:
- `base` do Vite = `/ddoctor-site/painel/`; o botão **Entrar** da landing aponta para `painel/`.
- Acesso no Sprint 0–3: PIN local simples (não é segurança; é para o irmão não mostrar a tela errada por acidente). Login de verdade vem com o Supabase.
- Idioma de código: identificadores em português para o domínio (`atendimento`, `etapa`, `franquia`) e inglês para infraestrutura (`repo`, `hooks`). Comentários e UI em pt-BR.

## 4. Modelo de dados (v1)

```ts
type Origem = "maxpar" | "seguradora_direta" | "particular";
type Etapa =
  | "aguardando_autorizacao" | "autorizado" | "aguardando_peca" | "agendado"
  | "no_patio" | "pronto" | "entregue" | "documentacao_enviada" | "pago";
type SubEtapaProducao = "desmontagem" | "martelinho" | "funilaria" | "preparacao" | "pintura" | "montagem" | "polimento";
type Tecnica = "sra" | "martelinho" | "pintura" | "funilaria";

interface Peca { id; nome; tecnica: Tecnica; solicitada: boolean; autorizada: boolean | null; valorAutorizado?: number; observacao?: string }
interface Atendimento {
  id; protocolo?: string; origem: Origem; seguradora?: string; produto?: string;
  placa; modelo?; cor?; cliente: { nome; telefone? }; corretor?;
  abertura: string; limiteVistoria?: string;
  pecas: Peca[];
  franquia: { valor?: number; paga: boolean; forma?: string };
  complemento?: number;                 // particular, acima do teto
  etapa: Etapa; subEtapa?: SubEtapaProducao; box?: string; responsavel?: string;
  previsaoCliente?: string; previsaoPortal?: string; entregueEm?: string;
  documentacao: { fotosAntes; fotosDepois; pdfOrdem; assinatura; nf; enviadaEm?; recusas: { data; motivo }[]; pagoEm?; valorPago? };
  financeiro: { aReceberMaxpar?: number; custoMaterial?: number; comissao?: number };
  contatos: { data; canal; quem; resumo; protocolo? }[];   // "falei com o analista"
  observacoes?: string; criadoEm; atualizadoEm;
}
```

## 5. Sprints

### Sprint 0 — Fundação (hoje)
- [ ] Estrutura do projeto no padrão (codigo/, notas/, CLAUDE.md, agentes).
- [ ] App Vite + React + TS + Tailwind com tokens do DESIGN.md, HashRouter, Dexie.
- [ ] Shell do painel: barra lateral (Pátio, Atendimentos, Agenda, Pendências, Financeiro, Ajustes), topo com busca por placa, tela vazia bem resolvida.
- [ ] Dados demo (≈12 atendimentos plausíveis, marcados como demo) e botão "limpar demo".
- [ ] PIN local de acesso.
- [ ] Build no workflow do Pages → `/painel/` publicado e botão Entrar da landing funcionando.

### Sprint 1 — Ficha e Pátio (substitui a planilha principal)
- [ ] Lista de atendimentos com filtros (etapa, origem, seguradora, atrasados) e busca por placa/protocolo/cliente.
- [ ] Ficha única do atendimento (criar/editar), peças solicitadas × autorizadas, franquia, complemento.
- [ ] Kanban do pátio pelas etapas reais, arrastar entre colunas, box e responsável.
- [ ] Entrada rápida (30 s): placa + protocolo + peças.
- [ ] Testes das regras de etapa.
- Checkpoint: irmão cadastra 3 carros reais e diz o que faltou.

### Sprint 2 — Prazo, pendências e documentação
- [ ] Previsão de entrega (cliente × portal) com alerta de atraso; agenda do dia/semana.
- [ ] Painel de pendências: sem autorização há N dias, vistoria vencendo, documentação recusada, pagamento atrasado.
- [ ] Checklist de encerramento/documentação com recusa + motivo e data de pagamento.
- [ ] Registro de contatos com analista/gestor.

### Sprint 3 — Financeiro
- [ ] Por carro: a receber Maxpar, franquia recebida, complemento, material, comissão → margem.
- [ ] Por seguradora e por mês; aging do que a Maxpar ainda não pagou.
- [ ] Exportar CSV.

### Sprint 4 — Multi-dispositivo e fotos
- [ ] Supabase: auth, tabelas, RLS, Storage; adaptador `RepositorioSupabase`; migração dos dados locais.
- [ ] Fotos por etapa (antes/durante/depois) com legenda e data.
- [ ] Importação por colar texto da listagem do portal (campos mapeados após o levantamento).

### Sprint 5 — Gestão
- [ ] Comissão/produção por funileiro.
- [ ] Histórico por placa/cliente (garantia 90 dias / 6 meses).
- [ ] Indicadores: carros/dia, tempo médio, % no prazo, ticket Maxpar × particular, taxa de recusa.

## 6. Levantamento com a oficina (paralelo ao Sprint 1)
Prints da Área do Credenciado e do Portal do Prestador (lista, detalhe, encerramento, pendências/saldos); a planilha atual (abas e colunas); exemplo do padrão de fotos; prazo real de pagamento; quais seguradoras chegam via Maxpar vs Carglass vs direto; se o portal exporta CSV/PDF.

## 7. Fora de escopo (por evidência)
Orçamentação de sinistro de casco (Audatex/Cilia); substituir a comunicação com segurado/Maxpar; integração oficial com a Maxpar (não há API pública).
