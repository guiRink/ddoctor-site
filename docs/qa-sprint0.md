# Revisão QA do Sprint 0 — achados para o VS Code resolver

Data: 02/10/2026. Revisor: agente `revisor-qa` sobre `codigo/painel/src`. Build e os 9 testes passam. Nada disto foi corrigido ainda: é a primeira fila de trabalho da sessão de código no VS Code, antes de abrir funcionalidades novas.

## Bloqueia (corrigir primeiro)

1. **Overflow horizontal no celular.** `src/componentes/Layout.tsx` — o `<aside>` é item de grid sem `min-w-0`; a navegação com seis links `whitespace-nowrap` força a shell a 726 px num viewport de 390 px. O botão **Novo** e os itens Financeiro/Ajustes ficam fora da tela. Correção: `min-w-0` no `<aside>` e `grid-rows-[auto_1fr]` no grid para a faixa de navegação não esticar.
2. **`placaValida` aceita 8+ caracteres.** `src/dominio/regras.ts` — `normalizarPlaca` trunca em 7 antes do regex, então `ABC1D234` passa. Validar o valor sem truncar (exigir 7) e cobrir no teste.
3. **`documentacao_recusada` falha se envio e recusa caem no mesmo dia** ou se os formatos de data diferem (string compare). Registrar o reenvio explicitamente (`recusa.reenviadaEm`) ou comparar data-hora com `parseISO`; adicionar teste do mesmo dia.

## Material

4. **Prazos 3 / 2 / 30 dias apresentados como fato.** `src/telas/Pendencias.tsx`, `regras.ts`, `Financeiro.tsx` (hardcode `> 30`). Interpolar `LIMITES.*` nos textos e qualificar como "limite provisório do painel, a confirmar com a oficina". O prazo de pagamento da Maxpar é NÃO ENCONTRADO no estudo.
5. **"Maxpar/seguradoras a receber" soma carros que nem entraram.** `Financeiro.tsx` + `aReceberEmAberto`. Renomear para "Autorizado ainda não pago" ou separar "faturado (doc. enviada)" × "autorizado em andamento".
6. **Sem estado de erro.** `src/dados/hooks.ts`, `telas/Ajustes.tsx` — falha de IndexedDB vira "Carregando…" eterno; botões de demo travam sem mensagem. `try/finally` + aviso de erro; hook de leitura devolvendo `{ dados, erro }` e tela `Vazio` de erro.
7. **Leitura bypassa a interface `Repositorio`.** `hooks.ts` consulta `banco.atendimentos` direto. Dentro do `useLiveQuery`, chamar `repositorio.listar()/obter()/contarDemo()` para a troca por Supabase ficar só em `repositorioDexie.ts`.
8. **Rótulos de pendência inline** em `Patio.tsx` divergem de `ROTULO_PENDENCIA`. Criar `ROTULO_PENDENCIA_CURTO` em `rotulos.ts`.
9. **Vistoria já vencida mostra "vence em -1 dia(s)".** `Pendencias.tsx`, `regras.ts`. Mostrar "venceu há N dia(s)" / rótulo "Vistoria vencida"; teste do caso negativo.
10. **"Sair" não existe no celular.** `Layout.tsx` — colocar no fim da faixa de navegação mobile ou em Ajustes.
11. **Botão Novo sem nome acessível abaixo de 640 px.** `aria-label="Novo atendimento"` no link.

## Menor

12. Capturas de referência desatualizadas (`.impeccable/review/painel/financeiro.png`); `App.tsx` só semeia demo quando não há registros, então seed antigo sobrevive a mudanças em `demo.ts`.
13. Tokens fora do DESIGN.md: `amarelo-escuro`, `alerta` (vermelho) e `ok` (verde) em `estilos.css`, e `bg-white` nos cards (quarto material). Documentar um adendo "painel" no DESIGN.md ou trocar `bg-white` por papel + fio.
14. Regras reimplementadas fora de `dominio/`: `Agenda.tsx` (atraso por string), `Patio.tsx` (repete `estaNaOficina`), `Financeiro.tsx` (placa formatada à mão).
15. Código morto na busca (`Layout.tsx`: ternário com os dois ramos iguais); o termo some da barra depois de buscar.
16. Lacunas de teste: placa com 8+ chars, vistoria vencida, recusa no mesmo dia, `receitaPrevista`, `diasNaEtapa`, `estaNaOficina`, `formatarPlaca` com menos de 7 chars.
17. `demo.ts` fixa `hoje` no carregamento do módulo; calcular dentro de `gerarDemo()`.
18. Copy e marcação: "há 0 dia(s)" vs "hoje"; "5 dias desde…" sem "(s)"; `<th>` sem `scope="col"`; inputs de PIN sem `autoComplete="new-password"`; `alt=""` no logo faz o leitor ler só "doctor".
19. `codigo/painel/README.md` ainda é o template do Vite em inglês.

## O que está bem (manter)

Enum de etapas idêntico ao plano; `salvar` atualiza `atualizadoEm`; demo sempre `demo: true` e limpável; seguradoras/produtos do demo batem com o estudo; raio zero, sem decoração, labels, foco visível, alvos ≥ 44 px; estados vazios com próxima ação em todas as telas.
