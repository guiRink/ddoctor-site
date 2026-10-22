-- 0004_financeiro.sql — títulos a receber, baixas, despesas, fechamento de caixa e folha de pagamento.
-- Dinheiro da oficina: dono e financeiro (veFinanceiro); títulos/baixas da OS também a recepção (vePagamentosOS).
-- O gerente não vê nada daqui (S1).
-- Imutáveis: baixa, fechamento_caixa e pagamento_folha já pago (correção = novo registro).

create table if not exists public.titulo_receber (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  os_id uuid not null references public.os (id) on delete cascade,
  pagador_id uuid not null references public.pagador (id),
  descricao text not null constraint descricao_obrigatoria check (btrim(descricao) <> ''),
  valor bigint not null constraint valor_invalido check (valor >= 0),
  nf_numero text,
  nf_emitida_em date,
  vencimento date not null,
  -- "vencido" é derivado (vencimento < hoje e não recebido/cancelado), nunca gravado
  estado text not null default 'emitido' check (estado in ('previsto', 'emitido', 'parcial', 'recebido', 'cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists titulo_os_idx on public.titulo_receber (os_id);
create index if not exists titulo_vencimento_idx on public.titulo_receber (oficina_id, vencimento);

create table if not exists public.baixa (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  titulo_id uuid not null references public.titulo_receber (id) on delete cascade,
  valor bigint not null constraint valor_invalido check (valor > 0),
  recebido_em date not null,
  forma text not null, -- FormaPagamento; texto livre antigo aceito (normalizarFormaPagamento)
  parcelas integer constraint parcelas_invalidas check (parcelas is null or parcelas >= 1),
  obs text,
  comprovante_path text,
  criado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists baixa_titulo_idx on public.baixa (titulo_id);
create index if not exists baixa_recebido_idx on public.baixa (oficina_id, recebido_em);

create table if not exists public.despesa (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  categoria_id uuid references public.categoria_financeira (id) on delete set null,
  categoria text not null constraint categoria_invalida check (btrim(categoria) <> ''), -- nome (compatibilidade)
  descricao text not null constraint descricao_obrigatoria check (btrim(descricao) <> ''),
  fornecedor text,
  valor_previsto bigint not null constraint valor_invalido check (valor_previsto > 0),
  vencimento date not null,
  pago_em date,
  valor_pago bigint check (valor_pago > 0),
  forma_pagamento text constraint forma_invalida check (forma_pagamento is null or forma_pagamento in ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'seguradora')),
  obs text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists despesa_vencimento_idx on public.despesa (oficina_id, vencimento);
create index if not exists despesa_pago_idx on public.despesa (oficina_id, pago_em);

create table if not exists public.fechamento_caixa (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  data date not null,
  saldo_inicial bigint not null check (saldo_inicial >= 0),
  contado bigint not null check (contado >= 0),
  entradas_dinheiro bigint not null default 0,
  saidas_dinheiro bigint not null default 0,
  esperado bigint not null, -- saldo_inicial + entradas − saídas (só dinheiro)
  diferenca bigint not null, -- contado − esperado (negativo = falta)
  obs text,
  fechado_por uuid,
  fechado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists caixa_ja_fechado on public.fechamento_caixa (oficina_id, data);

create table if not exists public.pagamento_folha (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  perfil_id uuid not null references public.perfil (id),
  mes text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  salario bigint not null default 0 check (salario >= 0),
  comissoes bigint not null default 0 check (comissoes >= 0),
  ajustes bigint, -- vales/descontos (negativo) ou extras (positivo)
  -- paga: total = salario + comissoes + ajustes, ≥ 0; rascunho (só o ajuste do dono, sem pago_em) pode ser negativo
  total bigint not null constraint total_invalido check (total = salario + comissoes + coalesce(ajustes, 0) and (pago_em is null or total >= 0)),
  pago_em date,
  despesa_id uuid references public.despesa (id) on delete set null,
  obs text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists ja_pago on public.pagamento_folha (perfil_id, mes);

create or replace function public._guarda_folha_paga() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.pago_em is not null then
    raise exception 'ja_pago' using errcode = 'DD001';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists pagamento_folha_guarda on public.pagamento_folha;
create trigger pagamento_folha_guarda before update or delete on public.pagamento_folha
  for each row execute function public._guarda_folha_paga();

drop trigger if exists baixa_imutavel on public.baixa;
create trigger baixa_imutavel before update or delete on public.baixa for each row execute function public._imutavel();
drop trigger if exists fechamento_caixa_imutavel on public.fechamento_caixa;
create trigger fechamento_caixa_imutavel before update or delete on public.fechamento_caixa for each row execute function public._imutavel();

-- renomear categoria acompanha nas despesas (função em 0002)
drop trigger if exists categoria_financeira_renomeada on public.categoria_financeira;
create trigger categoria_financeira_renomeada after update on public.categoria_financeira
  for each row execute function public._categoria_renomeada();

-- ---------------------------------------------------------------- RLS e triggers

select public._preparar_tabela(t) from unnest(array['titulo_receber', 'baixa', 'despesa', 'fechamento_caixa', 'pagamento_folha']) t;

-- Tudo dinheiro: dono e financeiro leem; escrita pelas funções (aplicar_baixa, criar_despesa, fechar_caixa...).
-- Títulos e baixas da OS: também a recepção, que cobra no balcão (vePagamentosOS). O gerente não vê nada daqui.
select public._politicas(t, '{dono,financeiro,recepcao}', null, null, null)
  from unnest(array['titulo_receber', 'baixa']) t;
select public._politicas(t, '{dono,financeiro}', null, null, null)
  from unnest(array['despesa', 'fechamento_caixa', 'pagamento_folha']) t;

revoke update, delete, truncate on public.baixa, public.fechamento_caixa from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on public.baixa, public.fechamento_caixa from %I', r);
    end if;
  end loop;
end $$;
