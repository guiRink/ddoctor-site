-- 0003_os.sql — atendimento externo, OS, orçamento, produção (etapas), agenda, pendências, fotos, custos e estoque.
-- Escritas de estado (OS, etapa, agendamento, aprovação, custo, movimento) só pelas funções de 0006–0009
-- (security definer). A API escreve direto apenas o que é cadastro (box/observações da OS, capacidade do dia).

-- ---------------------------------------------------------------- atendimento externo (Maxpar / seguradora)
-- Campos ainda hipotéticos da Maxpar (H) ficam em dados_brutos até docs/maxpar-g1.md.

create table if not exists public.atendimento_externo (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  fonte text not null default 'manual' check (fonte in ('maxpar_portal', 'maxpar_arquivo', 'manual', 'api')),
  seguradora text not null,
  id_externo text,
  numero_sinistro text,
  produto text,
  status_bruto text,
  status_normalizado text not null default 'desconhecido' check (status_normalizado in (
    'aguardando_autorizacao', 'autorizado', 'parcialmente_autorizado', 'negado', 'aguardando_peca',
    'servico_realizado', 'pago', 'cancelado', 'desconhecido')),
  abertura_em date,
  limite_vistoria_em date,
  previsao_portal date,
  lido_em timestamptz,
  estado_conciliacao text not null default 'ok' check (estado_conciliacao in ('ok', 'pendente', 'conflito')),
  dados_brutos jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists protocolo_duplicado on public.atendimento_externo (oficina_id, seguradora, btrim(id_externo)) where id_externo is not null;

-- ---------------------------------------------------------------- OS

create table if not exists public.os (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  numero integer not null,
  veiculo_id uuid not null references public.veiculo (id),
  cliente_id uuid not null references public.cliente (id),
  tipo_reparo_id uuid references public.tipo_reparo (id),
  origem text not null check (origem in ('maxpar', 'seguradora_direta', 'particular', 'misto')),
  estado text not null default 'rascunho' check (estado in (
    'rascunho', 'aguardando_aprovacao', 'aguardando_agendamento', 'agendada', 'na_oficina', 'pronta', 'entregue', 'encerrada', 'cancelada')),
  prioridade smallint not null default 0 check (prioridade between 0 and 2),
  previsao_entrega date,
  entrada_real_em timestamptz,
  pronta_em timestamptz,
  entregue_em timestamptz,
  box text,
  observacoes text,
  motivo_cancelamento text,
  recepcao jsonb check (recepcao is null or jsonb_typeof(recepcao) = 'object'), -- RecepcaoVeiculo (TS)
  alerta jsonb check (alerta is null or jsonb_typeof(alerta) = 'object'), -- AlertaOS (TS)
  demo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create unique index if not exists os_numero_unico on public.os (oficina_id, numero);
create index if not exists os_estado_idx on public.os (oficina_id, estado);
create index if not exists os_cliente_idx on public.os (cliente_id);
create index if not exists os_veiculo_idx on public.os (veiculo_id);

-- Da API só mudam box, observações e previsão; estado, marcos, número, recepção e alerta só pelas funções.
create or replace function public._guarda_os() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      raise exception 'use_a_funcao: criar_atendimento_rapido' using errcode = 'DD001';
    end if;
    if new.estado is distinct from old.estado or new.numero is distinct from old.numero
       or new.oficina_id is distinct from old.oficina_id or new.entrada_real_em is distinct from old.entrada_real_em
       or new.pronta_em is distinct from old.pronta_em or new.entregue_em is distinct from old.entregue_em
       or new.recepcao is distinct from old.recepcao or new.alerta is distinct from old.alerta
       or new.prioridade is distinct from old.prioridade or new.tipo_reparo_id is distinct from old.tipo_reparo_id then
      raise exception 'transicao_invalida' using errcode = 'DD001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists os_guarda on public.os;
create trigger os_guarda before insert or update on public.os for each row execute function public._guarda_os();

create table if not exists public.os_atendimento_externo (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  os_id uuid not null references public.os (id) on delete cascade,
  atendimento_externo_id uuid not null references public.atendimento_externo (id) on delete cascade,
  papel text not null default 'principal' check (papel in ('principal', 'complementar')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id(),
  unique (os_id, atendimento_externo_id)
);

-- ---------------------------------------------------------------- orçamento (versões e itens)
-- Conteúdo da versão (valores, itens) é imutável depois de criado; mudam só estado, aprovação e status do item.

create table if not exists public.orcamento_versao (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  os_id uuid not null references public.os (id) on delete cascade,
  tipo text not null check (tipo in ('externo', 'interno')),
  numero_versao integer not null check (numero_versao >= 1),
  fonte text not null default 'manual' check (fonte in ('maxpar_portal', 'maxpar_arquivo', 'manual', 'api')),
  estado text not null default 'rascunho' check (estado in ('rascunho', 'enviado', 'aprovado', 'recusado', 'substituido')),
  teto_cobertura bigint check (teto_cobertura >= 0),
  franquia bigint check (franquia >= 0),
  complemento_particular bigint check (complemento_particular >= 0),
  aprovacao_tipo text check (aprovacao_tipo in ('externa', 'interna', 'cliente')),
  aprovado_em timestamptz,
  evidencia text,
  confiavel boolean,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id(),
  unique (os_id, numero_versao)
);

create table if not exists public.item_orcamento (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  versao_id uuid not null references public.orcamento_versao (id) on delete cascade,
  ordem integer not null default 0,
  peca text not null check (btrim(peca) <> ''),
  tecnica text not null check (tecnica in ('sra', 'martelinho', 'pintura', 'funilaria', 'polimento', 'outro')),
  descricao text,
  valor bigint not null default 0 check (valor >= 0),
  status_item text not null default 'solicitado' check (status_item in ('solicitado', 'autorizado', 'negado', 'reanalise', 'dispensado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists item_orcamento_versao_idx on public.item_orcamento (versao_id);

create or replace function public._guarda_versao() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'orcamento_versao' then
    if new.os_id is distinct from old.os_id or new.tipo is distinct from old.tipo or new.numero_versao is distinct from old.numero_versao
       or new.teto_cobertura is distinct from old.teto_cobertura or new.franquia is distinct from old.franquia
       or new.complemento_particular is distinct from old.complemento_particular then
      raise exception 'registro_imutavel: conteúdo da versão do orçamento' using errcode = 'DD002';
    end if;
  elsif new.versao_id is distinct from old.versao_id or new.peca is distinct from old.peca or new.tecnica is distinct from old.tecnica
     or new.valor is distinct from old.valor then
    raise exception 'registro_imutavel: item do orçamento' using errcode = 'DD002';
  end if;
  return new;
end $$;
drop trigger if exists orcamento_versao_guarda on public.orcamento_versao;
create trigger orcamento_versao_guarda before update on public.orcamento_versao for each row execute function public._guarda_versao();
drop trigger if exists item_orcamento_guarda on public.item_orcamento;
create trigger item_orcamento_guarda before update on public.item_orcamento for each row execute function public._guarda_versao();

-- ---------------------------------------------------------------- produção: etapas e bloqueios

create table if not exists public.etapa_os (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  os_id uuid not null references public.os (id) on delete cascade,
  ordem integer not null,
  nome text not null,
  estado text not null default 'aguardando' check (estado in ('aguardando', 'na_fila', 'em_execucao', 'bloqueada', 'concluida', 'dispensada')),
  responsavel_id uuid references public.perfil (id) on delete set null,
  prazo_horas numeric(7, 2) not null default 0 check (prazo_horas >= 0),
  prazo_em timestamptz,
  entrou_fila_em timestamptz,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  pecas_previstas integer check (pecas_previstas >= 0),
  pecas_feitas integer check (pecas_feitas >= 0),
  motivo_dispensa text,
  exige_foto boolean not null default false,
  exige_contagem_pecas boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id(),
  unique (os_id, ordem)
);
create index if not exists etapa_os_responsavel_idx on public.etapa_os (responsavel_id, estado);

create table if not exists public.bloqueio_etapa (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  etapa_id uuid not null references public.etapa_os (id) on delete cascade,
  inicio_em timestamptz not null default now(),
  fim_em timestamptz,
  motivo text not null check (btrim(motivo) <> ''),
  registrado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists bloqueio_etapa_idx on public.bloqueio_etapa (etapa_id);

-- ---------------------------------------------------------------- agenda

create table if not exists public.agendamento (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  os_id uuid not null references public.os (id) on delete cascade,
  data date not null,
  janela text not null check (janela in ('manha', 'tarde')),
  estado text not null check (estado in ('pendente', 'contatando', 'proposto', 'confirmado', 'cancelado', 'nao_compareceu', 'realizado')),
  origem text not null default 'recepcao' check (origem in ('recepcao', 'calia', 'cliente')),
  expira_em timestamptz,
  substitui_id uuid references public.agendamento (id),
  motivo_cancelamento text,
  encaixe boolean not null default false, -- passou da capacidade com confirmação da recepção
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists agendamento_data_idx on public.agendamento (oficina_id, data, estado);
create index if not exists agendamento_os_idx on public.agendamento (os_id);

create table if not exists public.capacidade_dia (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  data date not null,
  vagas_entrada integer not null check (vagas_entrada >= 0),
  carros_simultaneos_max integer check (carros_simultaneos_max >= 0),
  bloqueado text, -- motivo, se o dia está bloqueado
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id(),
  unique (oficina_id, data)
);

-- ---------------------------------------------------------------- pendências externas (ações no portal)

create table if not exists public.pendencia_externa (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  os_id uuid not null references public.os (id) on delete cascade,
  atendimento_externo_id uuid references public.atendimento_externo (id) on delete set null,
  tipo text not null check (tipo in ('encerrar_portal', 'enviar_documentacao', 'reenviar_documentacao', 'solicitar_reanalise', 'atualizar_previsao', 'outro')),
  descricao text not null,
  estado text not null default 'aberta' check (estado in ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  responsavel_id uuid references public.perfil (id) on delete set null,
  criada_em timestamptz not null default now(),
  concluida_em timestamptz,
  confirmado_por uuid,
  evidencia text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists pendencia_os_idx on public.pendencia_externa (os_id);

-- ---------------------------------------------------------------- fotos
-- Arquivo no Storage (bucket privado "fotos"): <oficina_id>/<os_id>/<foto_id>.webp e <foto_id>.min.webp.
-- url_externa: foto pública (demo) ou da vistoria da Maxpar. removida_em: removida no painel; o arquivo é
-- apagado do Storage pelo aparelho logo depois (política "fotos_apagar") e, se falhar, pela limpeza do worker.

create table if not exists public.foto (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  os_id uuid not null references public.os (id) on delete cascade,
  etapa_id uuid references public.etapa_os (id) on delete set null,
  fase text not null check (fase in ('entrada', 'durante', 'final', 'externa')),
  legenda text check (length(legenda) <= 120),
  caminho text,
  caminho_miniatura text,
  url_externa text,
  bytes integer check (bytes >= 0),
  largura integer check (largura > 0),
  altura integer check (altura > 0),
  autor_id uuid references public.perfil (id) on delete set null,
  origem text not null default 'interna' check (origem in ('interna', 'maxpar')),
  tirada_em timestamptz not null default now(),
  removida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id(),
  constraint foto_sem_arquivo check (caminho is not null or url_externa is not null)
);
create index if not exists foto_os_idx on public.foto (os_id) where removida_em is null;
create unique index if not exists foto_caminho_unico on public.foto (caminho) where caminho is not null;

-- ---------------------------------------------------------------- estoque: movimentos (imutáveis)

create table if not exists public.movimento_estoque (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  material_id uuid not null references public.material (id),
  tipo text not null constraint tipo_invalido check (tipo in ('entrada_compra', 'saida_os', 'consumo_interno', 'ajuste')),
  quantidade numeric(14, 3) not null constraint quantidade_invalida check (quantidade > 0),
  sentido text constraint sentido_obrigatorio check ((tipo = 'ajuste') = (sentido is not null) and (sentido is null or sentido in ('mais', 'menos'))),
  custo_unitario bigint check (custo_unitario >= 0),
  os_id uuid references public.os (id) on delete set null,
  perfil_id uuid references public.perfil (id) on delete set null,
  fornecedor_id uuid references public.fornecedor (id) on delete set null,
  obs text,
  em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists movimento_material_idx on public.movimento_estoque (material_id, em desc);
create index if not exists movimento_em_idx on public.movimento_estoque (oficina_id, em desc);
drop trigger if exists movimento_estoque_imutavel on public.movimento_estoque;
create trigger movimento_estoque_imutavel before update or delete on public.movimento_estoque
  for each row execute function public._imutavel();

-- ---------------------------------------------------------------- custos da OS (financeiro: dono e financeiro)

create table if not exists public.custo_os (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null default public.minha_oficina() references public.oficina (id) on delete cascade,
  os_id uuid not null references public.os (id) on delete cascade,
  tipo text not null check (tipo in ('insumo', 'mao_de_obra', 'terceiro', 'outro')),
  descricao text not null constraint descricao_obrigatoria check (btrim(descricao) <> ''),
  quantidade numeric(14, 3) not null constraint quantidade_invalida check (quantidade > 0),
  unidade text,
  custo_unitario bigint not null check (custo_unitario >= 0),
  total bigint not null check (total >= 0),
  material_id uuid references public.material (id) on delete set null,
  movimento_id uuid references public.movimento_estoque (id) on delete set null, -- a saída do estoque deste insumo
  perfil_id uuid references public.perfil (id) on delete set null,
  minutos integer check (minutos > 0),
  fornecedor text,
  lancado_em timestamptz not null default now(),
  lancado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default public.meu_perfil_id()
);
create index if not exists custo_os_idx on public.custo_os (os_id);

-- ---------------------------------------------------------------- RLS e triggers

select public._preparar_tabela(t) from unnest(array[
  'atendimento_externo', 'os', 'os_atendimento_externo', 'orcamento_versao', 'item_orcamento', 'etapa_os', 'bloqueio_etapa',
  'agendamento', 'capacidade_dia', 'pendencia_externa', 'foto', 'movimento_estoque', 'custo_os']) t;

-- Operação (dono, gerente, recepção) e financeiro leem; produção e TV NÃO leem estas tabelas: usam vw_producao
-- (sem cliente, telefone, documento, valor nem seguradora). Escrita de estado só pelas funções.
select public._politicas(t, '{dono,gestor,recepcao,financeiro}', null, null, null)
  from unnest(array['atendimento_externo', 'os_atendimento_externo', 'orcamento_versao', 'item_orcamento', 'etapa_os', 'bloqueio_etapa', 'pendencia_externa']) t;
-- OS: box, observações e previsão podem ser editados direto pela operação (o trigger _guarda_os segura o resto).
select public._politicas('os', '{dono,gestor,recepcao,financeiro}', null, '{dono,gestor,recepcao}', null);
-- agenda: o financeiro não usa.
select public._politicas('agendamento', '{dono,gestor,recepcao}', null, null, null);
select public._politicas('capacidade_dia', '{dono,gestor,recepcao}', '{dono,gestor,recepcao}', '{dono,gestor,recepcao}', '{dono,gestor,recepcao}');
-- fotos: operação e financeiro leem; a produção lê as fotos das OS do quadro (agendada, na oficina, pronta).
select public._politicas('foto', '{dono,gestor,recepcao,financeiro}', null, null, null);
-- estoque e custos: tabelas com valores só para dono e financeiro; o gerente usa vw_material/vw_movimento_estoque.
select public._politicas('movimento_estoque', '{dono,financeiro}', null, null, null);
select public._politicas('custo_os', '{dono,financeiro}', null, null, null);

-- OS visível para a produção (quadro da oficina).
create or replace function public._os_no_quadro(p_os uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.os o
     where o.id = p_os and o.oficina_id = public.minha_oficina() and o.estado in ('agendada', 'na_oficina', 'pronta')
  )
$$;

drop policy if exists foto_ler_producao on public.foto;
create policy foto_ler_producao on public.foto for select to authenticated using (
  oficina_id = (select public.minha_oficina()) and (select public.tem_papel('{producao}'))
  and removida_em is null and public._os_no_quadro(os_id)
);

revoke update, delete, truncate on public.movimento_estoque from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on public.movimento_estoque from %I', r);
    end if;
  end loop;
end $$;
