# Banco do painel D doctor (Supabase) — sprint S1

Dois projetos (org D Doctor, sa-east-1): **`ddoctor-teste`** (exemplo fictício, para ver as telas) e **`ddoctor`** (oficial, começa zerado). O mesmo esquema nos dois; só o seed muda.

## O que tem aqui

| Caminho | O que é |
| --- | --- |
| `migrations/0001…0015_*.sql` | Esquema inteiro: tabelas, RLS por papel, funções, views, Storage, tempo real, correções de segurança. Rodar **em ordem**. Idempotentes (rodar de novo não quebra). Os grants finais estão em `public._aplicar_permissoes()` (0015). |
| `seed/producao.sql` | Só o padrão da oficina, tudo **provisório**: oficina "D doctor", config (expediente, semáforo, capacidade, alerta do carro, checklist), 5 tipos de reparo, 16 categorias financeiras, 3 pagadores. Nenhum dado de exemplo. |
| `seed/teste.sql` | Exemplo **fictício** do `gerarDemo()` (24 OS, 22 clientes, 9 perfis sem login, estoque, financeiro…), com datas relativas ao momento em que roda. **Só no `ddoctor-teste`.** |
| `checagens.sql` | Confere tudo (235 checagens: RLS por papel, views só leitura, funções com caminho feliz e cada guarda, imutáveis, Storage, entradas inválidas). Não deixa rastro (rollback). |
| `functions/equipe-login/` | Edge Function: o dono dá/troca/tira o login do funcionário; dono (ou gerente, só para produção/recepção/TV) bloqueia o login de quem foi desativado (usa a service_role do servidor). |
| `scripts/gerar-seed-teste.ts` | Gera os dois seeds a partir do código do painel (`demo.ts`, `config.ts`). |
| `scripts/testar-local.mjs` | Roda migrations (2×) + seeds + checagens no **PGlite** (Postgres em WASM), sem Docker. |
| `scripts/concorrencia.mjs` | Duas reservas simultâneas na última vaga (precisa de duas conexões: roda contra o `ddoctor-teste`). |
| `../painel/src/dados/mapeamento.ts` | Coluna ↔ campo, selects com embedding, RPCs e erros — para o `RepositorioSupabase`. |

## Aplicar (SQL Editor do Supabase)

Ordem, nos **dois** projetos:

1. `migrations/0001_nucleo.sql` … `migrations/0015_seguranca.sql`, um por vez, na ordem (ou tudo junto: `cat migrations/*.sql | pbcopy` e colar; ou `node scripts/aplicar.mjs teste|oficial [--so-migrations]`, que roda todas em ordem). **O 0015 tem de vir depois do 0013**: ele refaz os grants e tira a escrita das views.
2. `seed/producao.sql`.
3. **Só no `ddoctor-teste`:** `seed/teste.sql`.
4. `checagens.sql` → a última tabela deve vir com `ok = true` em todas as linhas.
5. Primeiro dono (abaixo).
6. Edge Function (abaixo).
7. Autenticação do projeto (abaixo) — **obrigatório antes de publicar**.

Migration nova no futuro: arquivo novo `0016_…sql` (nunca editar um aplicado) que **termina com `select public._aplicar_permissoes();`**. O Supabase dá ALL a `anon`/`authenticated` em todo objeto novo de `public` (default privileges): sem essa linha, uma view nova nasce gravável por cima da RLS e uma função nova fica aberta para quem não tem login. Função interna nova (prefixo `_`) que escreve ou contorna a RLS entra na lista de `_aplicar_permissoes()` (redefinida na própria migration nova). As checagens `views só leitura` e `anon executa só oficina_tem_dono()` pegam o esquecimento.

> Sem `supabase link`/`db push` por enquanto: a aplicação é manual, pelo Guilherme, depois de backup e checkpoint. Os nomes `0001_…` também funcionam como versão de migration da CLI quando ela entrar.

### Primeiro dono

1. Supabase → **Authentication → Users → Add user** → e-mail e senha do dono, marcar **Auto Confirm User**.
2. SQL Editor: `select public.definir_primeiro_dono('email@do.dono', 'Nome do dono');`

Só funciona enquanto nenhum dono tem login (depois disso os logins saem da aba **Equipe**). A função não fica exposta à API.

### Edge Function `equipe-login`

```bash
cd codigo && supabase functions deploy equipe-login --project-ref <ref>   # feito pelo Guilherme (republicar a cada mudança no index.ts)
supabase secrets set PAINEL_ORIGENS="https://ddoctorauto.com.br,https://www.ddoctorauto.com.br,https://guirink.github.io,http://localhost:5173" --project-ref <ref>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas pelo próprio Supabase. Ações: `definir` (só o dono; cria/troca usuário e senha; e-mail técnico `usuario@equipe.ddoctor.app`, confirmado), `remover` (só o dono; apaga o usuário do Auth; cadastro e histórico ficam; não vale para si mesmo → `proprio_login`), `sincronizar` (perfil inativo = login banido; chamar depois de `salvarFuncionario` mudar `ativo`; o dono para qualquer perfil, o gerente **só** para produção, recepção e TV → senão `sem_permissao`). Senha: mínimo 8 caracteres e no máximo **72 bytes** em UTF-8 (limite do bcrypt; letra acentuada ocupa 2 bytes) → `senha_curta`/`senha_longa`; nunca vai para banco ou log.

`perfil.login_desativado_em` (decisão): é o espelho no banco do bloqueio no Auth. A Edge grava a data quando bane (perfil inativo em `sincronizar` ou `definir`) e limpa quando reativa ou quando `remover` tira o login. `meu_papel()`/`minha_oficina()` já ignoram perfil inativo; o campo serve para a `vw_equipe` mostrar `tem_login = false` de quem está bloqueado e para a Edge recusar chamador bloqueado.

### Autenticação do projeto (obrigatório, nos dois projetos, antes de publicar)

1. **Authentication → Sign In / Providers → desligar "Allow new users to sign up".** Os logins só nascem pelo dono (Edge `equipe-login`) e pelo primeiro dono (SQL). Com o cadastro aberto, qualquer pessoa cria usuário com a anon key (pública no front); ela não vê nada (sem perfil, a RLS nega tudo), mas não deve existir.
2. **Authentication → URL Configuration → Site URL = `https://ddoctorauto.com.br`.**
3. **Redirect URLs:** `https://ddoctorauto.com.br/painel/**`, `https://www.ddoctorauto.com.br/painel/**` (e, enquanto existir, `https://guirink.github.io/ddoctor-site/painel/**`; no `ddoctor-teste`, também `http://localhost:5173/**`).
4. Conferir que a Edge `equipe-login` publicada é a versão atual (republicar depois de mudar `functions/equipe-login/index.ts`).

## Gerar os seeds e testar localmente

```bash
cd codigo && node supabase/scripts/gerar-seed-teste.ts      # precisa de codigo/painel/node_modules
cd codigo/supabase && npm_config_cache=/tmp/npm-cache npm install
node scripts/testar-local.mjs              # migrations 2× + producao + teste + checagens
node scripts/testar-local.mjs --sem-teste  # como o oficial (só o padrão)
```

O PGlite usa `scripts/stub-supabase.sql` para imitar `auth`, `storage` e os papéis (**nunca** rodar o stub no Supabase). Concorrência real não dá para testar nele (uma conexão só):

```bash
DATABASE_URL='postgresql://postgres.<ref>:<senha>@…pooler.supabase.com:5432/postgres' node scripts/concorrencia.mjs
```

## Decisões

- **Ids:** `uuid` em tudo. O exemplo do demo usa ids de texto (`os-1`, `p-diego`); o gerador converte com `uid(texto)` (sha1 determinístico), então o `producao.sql` e o `teste.sql` casam. Ids internos de jsonb (itens do checklist, avarias) continuam texto.
- **Dinheiro:** centavos em `bigint` (igual ao TS, sem conversão). Diverge do `numeric(12,2)` da arquitetura §6.1 por pedido do S1. Quantidades de estoque: `numeric(14,3)`.
- **Estados:** `text` + `check` com os valores de `tipos.ts` (não enum do Postgres: mudar valor vira migration simples).
- **jsonb no formato do TS** (camelCase): `os.recepcao`, `os.alerta`, `cliente.endereco`, `proveniencia`, `tipo_reparo.etapas`, seções de `config_oficina`.
- **Config:** uma linha em `config_oficina` com uma coluna jsonb por seção + `provisorio` + `confirmado`. Comissões em `regra_comissao` (RLS própria); o repositório monta `config.comissoes`.
- **Salário** fora de `perfil`: tabela `perfil_salario` (só dono e financeiro). O gerente lista a equipe por `vw_equipe` sem salário.
- **Valores em tabelas mistas:** produção e TV **não leem as tabelas** com cliente/valor: só `vw_producao` (placa, modelo, cor, tipo, etapas, peças sem valor, previsão, prioridade, alerta, box). Gerente vê estoque por `vw_material`/`vw_movimento_estoque` (custo nulo) e comissões por `vw_regra_comissao` (valor nulo).
- **OSVisao:** sem view; um `select` com embedding do PostgREST (`SELECT_OS_VISAO` em `mapeamento.ts`). A RLS de cada tabela embutida corta o que o papel não vê (títulos vazios para o gerente, custos só dono/financeiro).
- **Escritas:** estado e dinheiro só por função `security definer` (`search_path=''`, checam oficina + papel + responsável; devolvem `{ok, codigo, campo, id}`; erro desfaz tudo). Cadastro simples é escrita direta com RLS (cliente, veículo, fornecedor, categoria, capacidade do dia, config, regra de comissão, box/observações da OS); as constraints têm o **nome do código de erro** (`documento_invalido`, `placa_duplicada`…), e `codigoDoErro()` traduz.
- **Cálculo de calendário no banco:** horas úteis, dias úteis e previsão sugerida reimplementados em SQL (`_somar_horas_uteis`, `_entrega_por_dias_uteis`, `_previsao_sugerida`), iguais a `dominio/expediente.ts`/`corCarro.ts` (feriados ainda não entram).
- **Auditoria:** trigger em toda tabela (antes/depois só do que mudou) + frase legível gravada pelas funções (`origem='app'`). `vw_auditoria` mostra a frase e esconde as linhas de trigger da mesma transação. Etapas gravam `acao` = `iniciar_etapa|concluir_etapa|bloquear_etapa|retomar_etapa|dispensar_etapa|atribuir`, `registro_id` = etapa, `perfil_id` = quem fez, `envolvido_id` = responsável (histórico do funcionário). Imutável (trigger + revoke).
- **Imutáveis:** `evento_auditoria`, `movimento_estoque`, `baixa`, `fechamento_caixa` (trigger que recusa UPDATE/DELETE para qualquer um + revoke); conteúdo da versão do orçamento e do item (só estado/aprovação/status mudam); folha paga.
- **Agenda:** `pg_advisory_xact_lock` por (oficina, dia) dentro de `agendar`/`reagendar`; `encaixe` só ignora a falta de vaga.
- **Views só leitura (0015):** toda view de `public` fica sem INSERT/UPDATE/DELETE/TRUNCATE para `anon` e `authenticated`. As views de recorte rodam com os direitos do dono (é o que deixa a produção/TV lerem o quadro sem ler as tabelas e o gerente ver estoque sem custo), por isso **não** são `security_invoker`; e por isso mesmo não podem ser graváveis (uma view simples é auto-atualizável e escreveria como o dono, por cima da RLS). Só `vw_auditoria` é `security_invoker`. TRUNCATE também saiu de `authenticated` em todas as tabelas.
- **OS pela API (0015):** escrita direta só muda `box`, `observacoes` e `previsao_entrega`; qualquer outra coluna (inclusive as que vierem a ser criadas) só pelas funções (`transicao_invalida`).
- **Equipe (0015):** quem não é dono não edita perfil de dono, gerente ou financeiro (nem o próprio) → `sem_permissao`.
- **Despesa (0015):** `pagar_despesa` só paga despesa a pagar; já paga ou ligada a uma folha → `ja_pago` (correção = novo lançamento).
- **Configuração (0015):** o banco valida o expediente (≥ 1 dia de 0 a 6 sem repetir, `HH:MM`, início < fim, sábado > início) e que semáforo/capacidade são números ≥ 0 → `config_invalida`. Só o dono muda `provisorio`/`confirmado`: o gerente salva os valores, e a marca "provisório — a confirmar" fica como estava (o trigger mantém os valores anteriores; não dá erro).
- **Responsável de etapa (0015):** só perfil ativo com papel produção, gerente ou dono (`sem_responsavel`). Estoque e custos recusam `perfilId`/`osId` de outra oficina (`perfil_inexistente`/`os_nao_encontrada`).
- **Entradas inválidas (0015):** id que não é uuid, marco que não é data/hora, booleano que não é true/false, número fora do limite → `{ok:false, codigo:'valor_invalido', campo}` em vez de erro do Postgres. Datas `AAAA-MM-DD` continuam com `data_invalida`.
- **Fotos da produção (0015, decisão):** a produção vê o QUADRO inteiro (`vw_producao`: placa, etapas, peças sem valor), mas **fotos** só das OS em que é responsável por alguma etapa ainda aberta (não concluída nem dispensada), e **nunca** as da vistoria da seguradora (fase `externa`). Vale para a tabela `foto` (política `foto_ler_producao`) e para os arquivos (`_foto_legivel`). Ao concluir a última etapa dela na OS, as fotos somem para ela. Gravar continua como antes (OS do quadro; foto de etapa só na própria).
- **Fotos:** bucket privado `fotos`, 2 MB, webp/jpeg, caminho `<oficina_id>/<os_id>/<foto_id>.webp` (+ `.min.webp`). O aparelho sobe e depois chama `adicionar_foto` (confere que o arquivo existe). `remover_foto` marca `removida_em` e devolve os caminhos para o aparelho apagar (a política só deixa apagar arquivo de foto removida ou órfão). O limite de 2 MB é menor que `COMPRESSAO_FOTO.maxBytesSalva` (5 MB) do TS.

## Papéis (RLS)

| | dono | gestor (Gerente) | recepcao | producao | financeiro | dispositivo (TV) |
| --- | --- | --- | --- | --- | --- | --- |
| Clientes, veículos, OS, orçamento (com valor), agenda, pendências | E | E | E | — (vw_producao) | L (sem agenda) | — (vw_producao) |
| Etapas | E | E | L | as próprias, por função | L | — |
| Fotos | E | E | E | L: OS com etapa aberta sua, sem vistoria (externa); grava nas OS do quadro | L | — |
| Títulos e baixas da OS | E | — | L + cobra no balcão | — | E | — |
| Despesas, caixa, folha, custos da OS, custo de estoque | E | — | — | — | E | — |
| Estoque (saldo) | E | E (sem custo) | — | — | L | — |
| Equipe | E (papel, salário, login) | E (nome, função, ativo) só de produção, recepção e TV | nomes | nomes | nomes + salário | nomes |
| Config | E (e confirma o provisório) | E (valores; não confirma) | L | L | L | L |
| Comissões | E | L sem R$ | — | — | L | — |
| Auditoria | tudo | menos financeiro | — | — | só financeiro | — |

## Provisório — a confirmar

- Recepção cobrar no balcão e ver os títulos da OS (`vePagamentosOS`); fechamento de caixa só dono/financeiro.
- Gerente cria e edita (inclusive desativa) só funcionário de recepção/produção/TV; trocar papel e salário só o dono.
- Produção sem etapa aberta na OS não vê as fotos dela (decisão de segurança do S1; confirmar com o dono se a produção precisa ver fotos de entrada de carros que ainda não pegou).
- Pendência "encerrar portal" vai para a primeira recepção ativa.
- Peças previstas das etapas com contagem = itens autorizados da versão vigente.
- Salário do mês inteiro mesmo admitido no meio do mês; desligado recebe 0 de salário (ajuste pelo dono).
- Feriados fora do cálculo de dias/horas úteis.
- Campos (H) da Maxpar ficam em `atendimento_externo.dados_brutos` até `docs/maxpar-g1.md`.
