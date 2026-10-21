-- 0001_nucleo.sql — oficina, perfis (equipe), configuração, auditoria e funções de contexto.
-- Painel D doctor, sprint S1. Roda no SQL Editor do Supabase (Postgres 15+), em ordem, uma vez por projeto.
-- Idempotente onde dá: create ... if not exists, create or replace, drop ... if exists.
-- Convenções (codigo/supabase/README.md):
--   * PK uuid (gen_random_uuid); toda tabela tem oficina_id, criado_em, atualizado_em, criado_por.
--   * Dinheiro em CENTAVOS (bigint), igual ao TS; datas de negócio em date; marcos em timestamptz.
--   * Estados como text + check alinhados aos enums de codigo/compartilhado/src/tipos.ts.
--   * Colunas jsonb guardam o formato do TS (camelCase) sem tradução: recepcao, alerta, endereco, config...

-- ---------------------------------------------------------------- utilitários

create or replace function public._tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- Chave de comparação de nomes (sem acento, sem caixa, espaços colapsados) — igual a chaveNome do TS.
create or replace function public._chave(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(btrim(regexp_replace(
    translate(coalesce(t, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'),
    '\s+', ' ', 'g')))
$$;

-- Bloqueia UPDATE/DELETE (tabelas imutáveis: correção = novo registro). Vale até para o dono da tabela.
create or replace function public._imutavel() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'registro_imutavel: % não aceita %', tg_table_name, tg_op using errcode = 'DD002';
end $$;

-- ---------------------------------------------------------------- oficina

create table if not exists public.oficina (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  fuso text not null default 'America/Sao_Paulo',
  -- número legível da última OS aberta (criar_atendimento_rapido incrementa com a linha travada)
  ultimo_numero_os integer not null default 0 check (ultimo_numero_os >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid
);

-- ---------------------------------------------------------------- perfis (equipe)
-- Funcionário com login: auth_user_id = auth.users.id. Sem login (só aparece nas etapas): auth_user_id null.
-- O salário NÃO mora aqui (o gerente lê perfis): fica em perfil_salario, com RLS de financeiro.

create table if not exists public.perfil (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficina (id) on delete cascade,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  nome text not null constraint nome_obrigatorio check (btrim(nome) <> ''),
  papel text not null constraint papel_invalido check (papel in ('dono', 'gestor', 'recepcao', 'producao', 'financeiro', 'dispositivo')),
  funcao text,
  especialidade text,
  usuario text constraint usuario_invalido check (usuario is null or (usuario ~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$' and length(usuario) between 3 and 30 and position('..' in usuario) = 0)),
  email text constraint email_invalido check (email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  telefone text constraint telefone_invalido check (telefone is null or telefone ~ '^\+55[0-9]{10,11}$'),
  admitido_em date,
  ativo boolean not null default true,
  usa_terminal boolean not null default false,
  -- login desativado pelo dono (Edge Function equipe-login): o usuário do Auth é banido e meu_papel() deixa de valer
  login_desativado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid
);
create unique index if not exists usuario_em_uso on public.perfil (oficina_id, usuario) where usuario is not null;
create index if not exists perfil_oficina_idx on public.perfil (oficina_id);

-- Salário fixo (folha): só dono e financeiro leem (podeVerFolha).
create table if not exists public.perfil_salario (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficina (id) on delete cascade,
  perfil_id uuid not null unique references public.perfil (id) on delete cascade,
  salario_mensal bigint constraint salario_invalido check (salario_mensal is null or salario_mensal between 0 and 100000000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid
);

-- ---------------------------------------------------------------- contexto do usuário (usado pela RLS)
-- security definer: lê perfil sem passar pela RLS de perfil (senão a política se chamaria em laço).

create or replace function public.meu_perfil_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.perfil p
  where p.auth_user_id = auth.uid() and p.ativo and p.login_desativado_em is null
  limit 1
$$;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = '' as $$
  select p.papel from public.perfil p
  where p.auth_user_id = auth.uid() and p.ativo and p.login_desativado_em is null
  limit 1
$$;

create or replace function public.minha_oficina() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.oficina_id from public.perfil p
  where p.auth_user_id = auth.uid() and p.ativo and p.login_desativado_em is null
  limit 1
$$;

-- O usuário tem um destes papéis? (false sem login/perfil)
create or replace function public.tem_papel(p_papeis text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_papel() = any (p_papeis), false)
$$;

-- ---------------------------------------------------------------- configuração da oficina
-- Uma linha por oficina; cada seção é o objeto do ConfigOficina (TS) tal como está, em camelCase.
-- Valores provisórios: provisorio = true até o dono confirmar; confirmado = { campo: true } por campo.
-- As regras de comissão moram em regra_comissao (RLS de financeiro); o repositório monta config.comissoes.

create table if not exists public.config_oficina (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null unique references public.oficina (id) on delete cascade,
  expediente jsonb not null default '{"diasSemana":[1,2,3,4,5,6],"inicio":"08:00","fim":"18:00","sabadoFim":"12:00"}'
    check (jsonb_typeof(expediente) = 'object' and jsonb_typeof(expediente -> 'diasSemana') = 'array'),
  semaforo jsonb not null default '{"laranjaAntesHoras":8,"vermelhoBloqueioHoras":4,"laranjaFracao":0.8}'
    check (jsonb_typeof(semaforo) = 'object'),
  capacidade_padrao jsonb not null default '{"vagasEntrada":4,"carrosSimultaneos":12,"pecasDia":10}'
    check (jsonb_typeof(capacidade_padrao) = 'object' and (capacidade_padrao ->> 'vagasEntrada')::int >= 0),
  alerta_carro jsonb check (alerta_carro is null or jsonb_typeof(alerta_carro) = 'object'),
  checklist jsonb check (checklist is null or jsonb_typeof(checklist) = 'array'),
  provisorio boolean not null default true,
  confirmado jsonb not null default '{}' check (jsonb_typeof(confirmado) = 'object'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid
);

-- ---------------------------------------------------------------- auditoria (imutável)
-- Duas origens: 'trigger' (toda escrita, com antes/depois só das colunas que mudaram) e 'app' (as funções do
-- painel gravam a frase legível em `resumo`). A vw_auditoria mostra a frase da função e esconde as linhas de
-- trigger da mesma transação (mesmo `transacao`).

create table if not exists public.evento_auditoria (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid references public.oficina (id) on delete cascade,
  tabela text not null,
  registro_id uuid,
  acao text not null,
  antes jsonb,
  depois jsonb,
  rotulo text, -- nome/descrição/placa do registro, para a frase genérica
  resumo text,
  perfil_id uuid, -- quem fez (perfil do login)
  envolvido_id uuid, -- de quem é a ação (ex.: responsável da etapa), para o histórico do funcionário
  auth_user_id uuid,
  origem text not null default 'trigger' check (origem in ('app', 'trigger', 'worker')),
  transacao bigint not null default txid_current(),
  em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);
create index if not exists evento_auditoria_em_idx on public.evento_auditoria (oficina_id, em desc);
create index if not exists evento_auditoria_registro_idx on public.evento_auditoria (tabela, registro_id);
create index if not exists evento_auditoria_transacao_idx on public.evento_auditoria (transacao);
create index if not exists evento_auditoria_perfil_idx on public.evento_auditoria (perfil_id);
create index if not exists evento_auditoria_envolvido_idx on public.evento_auditoria (envolvido_id);

drop trigger if exists evento_auditoria_imutavel on public.evento_auditoria;
create trigger evento_auditoria_imutavel before update or delete on public.evento_auditoria
  for each row execute function public._imutavel();
revoke update, delete, truncate on public.evento_auditoria from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on public.evento_auditoria from %I', r);
    end if;
  end loop;
end $$;

-- Trigger genérico: grava toda escrita. Os seeds desligam com set_config('ddoctor.sem_auditoria','on',false)
-- (só vale fora de requisição da API: sem request.jwt.claims).
create or replace function public._auditoria_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_acao text;
  v_antes jsonb;
  v_depois jsonb;
  v_reg jsonb;
  v_a jsonb;
  v_d jsonb;
begin
  if coalesce(current_setting('ddoctor.sem_auditoria', true), '') = 'on'
     and coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    v_acao := 'criar';
    v_depois := to_jsonb(new);
    v_reg := v_depois;
  elsif tg_op = 'UPDATE' then
    v_acao := 'editar';
    v_a := to_jsonb(old);
    v_d := to_jsonb(new);
    v_reg := v_d;
    select jsonb_object_agg(e.key, v_a -> e.key), jsonb_object_agg(e.key, e.value)
      into v_antes, v_depois
      from jsonb_each(v_d) e
     where e.key <> 'atualizado_em' and (v_a -> e.key) is distinct from e.value;
    if v_depois is null then
      return null; -- nada mudou de fato
    end if;
  else
    v_acao := 'remover';
    v_antes := to_jsonb(old);
    v_reg := v_antes;
  end if;
  insert into public.evento_auditoria (oficina_id, tabela, registro_id, acao, antes, depois, rotulo, perfil_id, auth_user_id, origem)
  values (
    nullif(v_reg ->> 'oficina_id', '')::uuid,
    tg_table_name,
    case when (v_reg ->> 'id') ~ '^[0-9a-f-]{36}$' then (v_reg ->> 'id')::uuid end,
    v_acao,
    v_antes,
    v_depois,
    coalesce(v_reg ->> 'nome', v_reg ->> 'descricao', v_reg ->> 'placa', v_reg ->> 'numero', v_reg ->> 'data'),
    public.meu_perfil_id(),
    auth.uid(),
    'trigger'
  );
  return null;
end $$;

-- Linha legível gravada pelas funções do painel (a frase que aparece em Ajustes → Auditoria e no histórico).
create or replace function public._auditar(p_acao text, p_tabela text, p_registro uuid, p_resumo text, p_envolvido uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.evento_auditoria (oficina_id, tabela, registro_id, acao, resumo, perfil_id, envolvido_id, auth_user_id, origem)
  values (public.minha_oficina(), p_tabela, p_registro, p_acao, p_resumo, public.meu_perfil_id(), p_envolvido, auth.uid(), 'app');
end $$;

-- ---------------------------------------------------------------- preparo padrão de tabela e políticas
-- _preparar_tabela: trigger de atualizado_em (se a coluna existe) e de auditoria (se pedida).
create or replace function public._preparar_tabela(p_tabela text, p_auditar boolean default true) returns void
language plpgsql set search_path = '' as $$
begin
  execute format('alter table public.%I enable row level security', p_tabela);
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_tabela and column_name = 'atualizado_em') then
    execute format('drop trigger if exists %I on public.%I', p_tabela || '_atualizado_em', p_tabela);
    execute format('create trigger %I before update on public.%I for each row execute function public._tocar_atualizado_em()', p_tabela || '_atualizado_em', p_tabela);
  end if;
  execute format('drop trigger if exists %I on public.%I', p_tabela || '_auditoria', p_tabela);
  if p_auditar then
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public._auditoria_trigger()', p_tabela || '_auditoria', p_tabela);
  end if;
end $$;

-- _politicas: (re)cria as políticas por papel da tabela, sempre restritas à oficina do usuário.
-- Lista vazia/null = nenhuma política para aquela operação (negado).
create or replace function public._politicas(p_tabela text, p_ler text[], p_inserir text[], p_alterar text[], p_apagar text[])
returns void
language plpgsql set search_path = '' as $$
declare
  v_cond text;
begin
  execute format('alter table public.%I enable row level security', p_tabela);
  execute format('drop policy if exists %I on public.%I', p_tabela || '_ler', p_tabela);
  execute format('drop policy if exists %I on public.%I', p_tabela || '_inserir', p_tabela);
  execute format('drop policy if exists %I on public.%I', p_tabela || '_alterar', p_tabela);
  execute format('drop policy if exists %I on public.%I', p_tabela || '_apagar', p_tabela);
  if coalesce(cardinality(p_ler), 0) > 0 then
    v_cond := format('oficina_id = (select public.minha_oficina()) and (select public.tem_papel(%L::text[]))', p_ler);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', p_tabela || '_ler', p_tabela, v_cond);
  end if;
  if coalesce(cardinality(p_inserir), 0) > 0 then
    v_cond := format('oficina_id = (select public.minha_oficina()) and (select public.tem_papel(%L::text[]))', p_inserir);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_tabela || '_inserir', p_tabela, v_cond);
  end if;
  if coalesce(cardinality(p_alterar), 0) > 0 then
    v_cond := format('oficina_id = (select public.minha_oficina()) and (select public.tem_papel(%L::text[]))', p_alterar);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p_tabela || '_alterar', p_tabela, v_cond, v_cond);
  end if;
  if coalesce(cardinality(p_apagar), 0) > 0 then
    v_cond := format('oficina_id = (select public.minha_oficina()) and (select public.tem_papel(%L::text[]))', p_apagar);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', p_tabela || '_apagar', p_tabela, v_cond);
  end if;
end $$;

-- Tabelas de dinheiro (o gerente não vê; a auditoria delas só aparece para dono e financeiro).
-- material/movimento_estoque entram porque antes/depois trazem custo médio e custo unitário (veCustosOS).
create or replace function public._tabela_financeira(p_tabela text) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select p_tabela = any (array[
    'titulo_receber', 'baixa', 'despesa', 'categoria_financeira', 'fechamento_caixa', 'pagador',
    'pagamento_folha', 'perfil_salario', 'regra_comissao', 'custo_os', 'material', 'movimento_estoque'
  ])
$$;

-- A oficina nunca fica sem dono ativo (validarMudancaPapel → ultimo_dono). Vale para qualquer escrita.
create or replace function public._guarda_ultimo_dono() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.papel = 'dono' and old.ativo
     and (tg_op = 'DELETE' or new.papel <> 'dono' or not new.ativo or new.login_desativado_em is not null)
     and not exists (
       select 1 from public.perfil p
        where p.oficina_id = old.oficina_id and p.id <> old.id and p.papel = 'dono' and p.ativo
     ) then
    raise exception 'ultimo_dono' using errcode = 'DD001';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists perfil_ultimo_dono on public.perfil;
create trigger perfil_ultimo_dono before update or delete on public.perfil
  for each row execute function public._guarda_ultimo_dono();

-- ---------------------------------------------------------------- RLS do núcleo

select public._preparar_tabela('oficina');
select public._preparar_tabela('perfil');
select public._preparar_tabela('perfil_salario');
select public._preparar_tabela('config_oficina');
alter table public.evento_auditoria enable row level security;

-- oficina: todos os papéis leem a própria; só o dono altera.
drop policy if exists oficina_ler on public.oficina;
create policy oficina_ler on public.oficina for select to authenticated using (id = (select public.minha_oficina()));
drop policy if exists oficina_alterar on public.oficina;
create policy oficina_alterar on public.oficina for update to authenticated
  using (id = (select public.minha_oficina()) and (select public.tem_papel('{dono}')))
  with check (id = (select public.minha_oficina()) and (select public.tem_papel('{dono}')));

-- perfil: dono, gerente e financeiro leem a tabela; cada um lê o próprio perfil. Os demais usam vw_equipe.
-- Escrita só por salvar_funcionario (dono) e pela Edge Function equipe-login (service_role).
select public._politicas('perfil', '{dono,gestor,financeiro}', null, null, null);
drop policy if exists perfil_proprio on public.perfil;
create policy perfil_proprio on public.perfil for select to authenticated using (auth_user_id = (select auth.uid()));

-- salário: só dono e financeiro (podeVerFolha); escrita por salvar_funcionario (dono).
select public._politicas('perfil_salario', '{dono,financeiro}', null, null, null);

-- configuração: todos leem (expediente/semáforo são usados na TV e na produção); dono e gerente salvam
-- (salvarConfig/salvarChecklistConfig validam no TS com aplicarConfig antes do UPDATE).
select public._politicas('config_oficina', '{dono,gestor,recepcao,producao,financeiro,dispositivo}', null, '{dono,gestor}', null);

-- auditoria: dono tudo; gerente o que não é financeiro; financeiro só o financeiro (arq. §9.1). Ninguém escreve
-- direto (só trigger e funções, que são security definer).
drop policy if exists evento_auditoria_ler on public.evento_auditoria;
create policy evento_auditoria_ler on public.evento_auditoria for select to authenticated using (
  oficina_id = (select public.minha_oficina())
  and (
    (select public.tem_papel('{dono}'))
    or ((select public.tem_papel('{gestor}')) and not public._tabela_financeira(tabela))
    or ((select public.tem_papel('{financeiro}')) and public._tabela_financeira(tabela))
  )
);
