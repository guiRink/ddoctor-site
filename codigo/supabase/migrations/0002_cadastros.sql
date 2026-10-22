-- 0002_cadastros.sql — clientes, veículos, fornecedores, pagadores, categorias, tipos de reparo, materiais, comissões.
-- Os nomes das constraints são os CÓDIGOS de erro do painel (rotulos.ts → ERRO): o RepositorioSupabase lê o nome
-- da constraint violada (PostgREST 23514/23505) e devolve { ok: false, codigo } — ver painel/src/dados/mapeamento.ts.

-- ---------------------------------------------------------------- validações reutilizáveis (iguais ao TS)

-- Dígito verificador módulo 11 (CPF/CNPJ; CNPJ alfanumérico: valor = código ASCII − 48).
create or replace function public._dv11(p_base text, p_pesos int[]) returns int
language plpgsql immutable parallel safe set search_path = '' as $$
declare
  v_soma int := 0;
  v_r int;
begin
  for i in 1 .. length(p_base) loop
    v_soma := v_soma + (ascii(substr(p_base, i, 1)) - 48) * p_pesos[i];
  end loop;
  v_r := v_soma % 11;
  return case when v_r < 2 then 0 else 11 - v_r end;
end $$;

-- validarDocumento: CPF (11 dígitos) ou CNPJ (12 alfanuméricos + 2 dígitos), já normalizado (sem máscara, maiúsculas).
create or replace function public._documento_valido(p_doc text, p_tipo text default null) returns boolean
language plpgsql immutable parallel safe set search_path = '' as $$
declare
  v_tipo text := p_tipo;
  v_pesos int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
begin
  if p_doc is null then return true; end if;
  if v_tipo is null then
    v_tipo := case when p_doc ~ '^[0-9]{11}$' then 'pf' when p_doc ~ '^[0-9A-Z]{12}[0-9]{2}$' then 'pj' end;
  end if;
  if p_doc ~ '^(.)\1*$' then return false; end if;
  if v_tipo = 'pf' then
    return p_doc ~ '^[0-9]{11}$'
      and public._dv11(substr(p_doc, 1, 9), array[10, 9, 8, 7, 6, 5, 4, 3, 2]) = substr(p_doc, 10, 1)::int
      and public._dv11(substr(p_doc, 1, 10), array[11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) = substr(p_doc, 11, 1)::int;
  elsif v_tipo = 'pj' then
    return p_doc ~ '^[0-9A-Z]{12}[0-9]{2}$'
      and public._dv11(substr(p_doc, 1, 12), v_pesos) = substr(p_doc, 13, 1)::int
      and public._dv11(substr(p_doc, 1, 13), array[6] || v_pesos) = substr(p_doc, 14, 1)::int;
  end if;
  return false;
end $$;

-- normalizarTelefone do repositório: E.164 sem formatação; 10–11 dígitos ganham +55. null = vazio; '!' = inválido.
create or replace function public._telefone(p text) returns text
language plpgsql immutable parallel safe set search_path = '' as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if btrim(coalesce(p, '')) = '' then return null; end if;
  if btrim(p) like '+%' then return case when length(d) between 12 and 13 then '+' || d else '!' end; end if;
  if length(d) in (10, 11) then return '+55' || d; end if;
  if length(d) in (12, 13) and d like '55%' then return '+' || d; end if;
  return '!';
end $$;

-- ---------------------------------------------------------------- cliente

create table if not exists public.cliente (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  nome text not null constraint nome_obrigatorio check (btrim(nome) <> ''),
  tipo_pessoa text check (tipo_pessoa in ('pf', 'pj')),
  documento text constraint documento_invalido check (public._documento_valido(documento, tipo_pessoa)),
  telefone text constraint telefone_invalido check (telefone is null or telefone ~ '^\+[0-9]{12,13}$'),
  whatsapp text constraint whatsapp_invalido check (whatsapp is null or whatsapp ~ '^\+[0-9]{12,13}$'),
  email text constraint email_invalido check (email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  endereco jsonb constraint cep_invalido check (endereco is null or (endereco ->> 'cep') ~ '^[0-9]{8}$'),
  observacoes text,
  proveniencia jsonb,
  demo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists documento_duplicado on public.cliente (oficina_id, documento) where documento is not null;
create index if not exists cliente_nome_idx on public.cliente (oficina_id, nome);
create index if not exists cliente_telefone_idx on public.cliente (oficina_id, telefone);

-- ---------------------------------------------------------------- veículo

create table if not exists public.veiculo (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  cliente_id uuid references public.cliente (id) on delete set null,
  placa text not null constraint placa_invalida check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  marca text,
  modelo text,
  cor text,
  ano integer constraint ano_invalido check (ano is null or ano between 1950 and 2100),
  proveniencia jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists placa_duplicada on public.veiculo (oficina_id, placa);
create index if not exists veiculo_cliente_idx on public.veiculo (cliente_id);

-- ---------------------------------------------------------------- fornecedor

create table if not exists public.fornecedor (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  nome text not null constraint nome_obrigatorio check (btrim(nome) <> ''),
  documento text constraint documento_invalido check (public._documento_valido(documento)),
  telefone text constraint telefone_invalido check (telefone is null or telefone ~ '^\+[0-9]{12,13}$'),
  email text constraint email_invalido check (email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  obs text,
  demo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists fornecedor_documento_duplicado on public.fornecedor (oficina_id, documento) where documento is not null;

-- ---------------------------------------------------------------- pagador (quem paga o título)

create table if not exists public.pagador (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  nome text not null constraint nome_obrigatorio check (btrim(nome) <> ''),
  tipo text not null check (tipo in ('seguradora', 'maxpar', 'cliente', 'outro')),
  prazo_dias integer not null default 0 check (prazo_dias >= 0),
  prazo_base text not null default 'entrega' check (prazo_base in ('nf', 'entrega', 'servico_realizado')),
  prazo_dias_uteis boolean not null default false,
  prazo_provisorio boolean not null default true,
  desconta_franquia boolean, -- null = true (provisório, a confirmar)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);

-- ---------------------------------------------------------------- categoria financeira

create table if not exists public.categoria_financeira (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  nome text not null constraint nome_obrigatorio check (btrim(nome) <> ''),
  tipo text not null constraint categoria_invalida check (tipo in ('receita', 'despesa')),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists categoria_duplicada on public.categoria_financeira (oficina_id, tipo, public._chave(nome));

-- ---------------------------------------------------------------- tipo de reparo (categoria de serviço)
-- etapas: lista de ModeloEtapaItem do TS (camelCase): [{ordem, nome, prazoPadraoHoras, dispensavel, exigeFoto, exigeContagemPecas}]
-- Escrita só por salvar_tipo_reparo / arquivar_tipo_reparo (validam como validarTipoReparo/usoTipoReparo).

create table if not exists public.tipo_reparo (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  nome text not null constraint nome_obrigatorio check (btrim(nome) <> '' and length(nome) <= 60),
  etapas jsonb not null default '[]' constraint sem_etapas check (jsonb_typeof(etapas) = 'array' and jsonb_array_length(etapas) between 1 and 20),
  provisorio boolean not null default true,
  ativo boolean not null default true,
  ordem integer not null default 0, -- posição na escolha do serviço
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists nome_duplicado on public.tipo_reparo (oficina_id, public._chave(nome));

-- ---------------------------------------------------------------- material (estoque)
-- saldo_estimado e custo_medio só mudam por movimento (movimentar_estoque / lancar_custo / remover_custo):
-- o trigger abaixo recusa a mudança direta vinda da API.

create table if not exists public.material (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  nome text not null constraint nome_obrigatorio check (btrim(nome) <> ''),
  codigo text,
  marca text,
  categoria text not null default 'Outros',
  unidade text not null constraint unidade_obrigatoria check (btrim(unidade) <> ''),
  saldo_estimado numeric(14, 3) not null default 0 constraint saldo_insuficiente check (saldo_estimado >= 0),
  saldo_minimo numeric(14, 3) not null default 0 constraint quantidade_invalida check (saldo_minimo >= 0),
  ultima_conferencia_em date,
  custo_medio bigint not null default 0 check (custo_medio >= 0),
  fornecedor_id uuid references public.fornecedor (id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);

create or replace function public._guarda_saldo_material() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- dentro das funções (security definer) current_user é o dono da função; da API é "authenticated"
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.saldo_estimado := 0;
    elsif new.saldo_estimado is distinct from old.saldo_estimado or new.custo_medio is distinct from old.custo_medio then
      raise exception 'saldo_so_por_movimento' using errcode = 'DD001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists material_guarda_saldo on public.material;
create trigger material_guarda_saldo before insert or update on public.material
  for each row execute function public._guarda_saldo_material();

-- ---------------------------------------------------------------- regra de comissão (Ajustes → Comissões)
-- Alvo: etapa_nome, tipo_reparo_id ou os dois; a mais específica vence (comissoesDoPeriodo). Só o dono edita.

create table if not exists public.regra_comissao (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  etapa_nome text,
  tipo_reparo_id uuid references public.tipo_reparo (id) on delete cascade,
  valor bigint not null constraint valor_invalido check (valor between 0 and 10000000),
  ativa boolean not null default true,
  descricao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id(),
  constraint alvo_obrigatorio check (nullif(btrim(etapa_nome), '') is not null or tipo_reparo_id is not null)
);
create unique index if not exists regra_duplicada on public.regra_comissao
  (oficina_id, coalesce(tipo_reparo_id, '00000000-0000-0000-0000-000000000000'::uuid), public._chave(etapa_nome)) where ativa;

-- ---------------------------------------------------------------- RLS e triggers

select public._preparar_tabela(t) from unnest(array['cliente', 'veiculo', 'fornecedor', 'pagador', 'categoria_financeira', 'tipo_reparo', 'material', 'regra_comissao']) t;

-- clientes e veículos: operação lê e edita; financeiro lê; só o dono apaga.
select public._politicas('cliente', '{dono,gestor,recepcao,financeiro}', '{dono,gestor,recepcao}', '{dono,gestor,recepcao}', '{dono}');
select public._politicas('veiculo', '{dono,gestor,recepcao,financeiro}', '{dono,gestor,recepcao}', '{dono,gestor,recepcao}', '{dono}');
-- fornecedores: estoque (dono e gerente editam; financeiro lê).
select public._politicas('fornecedor', '{dono,gestor,financeiro}', '{dono,gestor}', '{dono,gestor}', '{dono}');
-- pagadores: dinheiro (dono e financeiro editam); a recepção lê (cobra no balcão: vePagamentosOS).
select public._politicas('pagador', '{dono,financeiro,recepcao}', '{dono,financeiro}', '{dono,financeiro}', '{dono}');
-- categorias: dinheiro (dono e financeiro).
select public._politicas('categoria_financeira', '{dono,financeiro}', '{dono,financeiro}', '{dono,financeiro}', null);
-- tipos de reparo: todos leem (sem valor); escrita só pelas funções.
select public._politicas('tipo_reparo', '{dono,gestor,recepcao,producao,financeiro,dispositivo}', null, null, null);
-- material: a tabela (com custo médio) só para dono e financeiro; o gerente lê vw_material (sem custo).
select public._politicas('material', '{dono,financeiro}', null, null, null);
-- comissões: dono edita; dono e financeiro leem (a folha usa).
select public._politicas('regra_comissao', '{dono,financeiro}', '{dono}', '{dono}', '{dono}');

-- renomear categoria acompanha nas despesas (despesa.categoria guarda o nome por compatibilidade)
create or replace function public._categoria_renomeada() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.nome is distinct from old.nome then
    update public.despesa set categoria = new.nome where categoria_id = new.id;
  end if;
  return null;
end $$;
