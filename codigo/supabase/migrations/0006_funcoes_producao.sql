-- 0006_funcoes_producao.sql — máquina de estados da etapa (arq. §7.2; dominio/os.ts):
--   na_fila → em_execucao (Iniciar, exige responsável) → concluida (exige foto/contagem se o modelo pedir)
--   em_execucao → bloqueada (motivo) → em_execucao (Retomar); aguardando|na_fila → dispensada (motivo).
-- Concluir/dispensar libera a próxima etapa não dispensada (aguardando → na_fila) na mesma transação; sem etapa
-- aberta, a OS na oficina vira "pronta". Produção só mexe nas PRÓPRIAS etapas (nao_responsavel).
-- Auditoria: acao iniciar_etapa | concluir_etapa | bloquear_etapa | retomar_etapa | dispensar_etapa | atribuir,
-- tabela etapa_os, registro = id da etapa, perfil = quem fez, envolvido = responsável (historicoFuncionario).

-- "OS #1042 · RKP1L34"
create or replace function public._rotulo_os(p_os uuid) returns text
language sql stable security definer set search_path = '' as $$
  select 'OS #' || o.numero || coalesce(' · ' || v.placa, '')
    from public.os o left join public.veiculo v on v.id = o.veiculo_id
   where o.id = p_os
$$;

-- Próxima etapa da OS (por ordem) que não foi dispensada: aguardando → na_fila.
create or replace function public._liberar_proxima(p_os uuid, p_ordem int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_estado text;
begin
  select e.id, e.estado into v_id, v_estado
    from public.etapa_os e
   where e.os_id = p_os and e.ordem > p_ordem and e.estado <> 'dispensada'
   order by e.ordem
   limit 1;
  if v_estado = 'aguardando' then
    update public.etapa_os set estado = 'na_fila', entrou_fila_em = now() where id = v_id;
  end if;
end $$;

-- Sem etapa aberta e OS na oficina → pronta (transicaoOS na_oficina → pronta: etapas ≥ 1, todas fechadas).
create or replace function public._fechar_os_se_pronta(p_os uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.etapa_os e where e.os_id = p_os)
     and not exists (select 1 from public.etapa_os e where e.os_id = p_os and e.estado not in ('concluida', 'dispensada')) then
    update public.os set estado = 'pronta', pronta_em = now() where id = p_os and estado = 'na_oficina';
  else
    update public.os set atualizado_em = now() where id = p_os;
  end if;
end $$;

-- Carrega a etapa travada e confere oficina, OS na oficina e (para a produção) o responsável.
create or replace function public._etapa_para_mudar(p_etapa uuid, p_oficina uuid, p_exigir_responsavel boolean)
returns public.etapa_os
language plpgsql security definer set search_path = '' as $$
declare
  e public.etapa_os;
  v_estado_os text;
begin
  select * into e from public.etapa_os where id = p_etapa and oficina_id = p_oficina for update;
  if not found then perform public._erro('etapa_nao_encontrada'); end if;
  select o.estado into v_estado_os from public.os o where o.id = e.os_id for update;
  if v_estado_os <> 'na_oficina' then perform public._erro('transicao_invalida'); end if;
  if p_exigir_responsavel and public.meu_papel() = 'producao' and e.responsavel_id is distinct from public.meu_perfil_id() then
    perform public._erro('nao_responsavel');
  end if;
  return e;
end $$;

-- ---------------------------------------------------------------- iniciar

create or replace function public.iniciar_etapa(p_etapa uuid, p_responsavel uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  e public.etapa_os;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,producao}');
  select * into e from public.etapa_os where id = p_etapa and oficina_id = v_of for update;
  if not found then perform public._erro('etapa_nao_encontrada'); end if;
  if (select o.estado from public.os o where o.id = e.os_id) <> 'na_oficina' then perform public._erro('transicao_invalida'); end if;
  if e.estado <> 'na_fila' then perform public._erro('transicao_invalida'); end if;
  if p_responsavel is null or not exists (
       select 1 from public.perfil p where p.id = p_responsavel and p.oficina_id = v_of and p.ativo) then
    perform public._erro('sem_responsavel');
  end if;
  -- produção inicia só para si e só a etapa livre ou já sua
  if public.meu_papel() = 'producao'
     and (p_responsavel <> public.meu_perfil_id() or (e.responsavel_id is not null and e.responsavel_id <> public.meu_perfil_id())) then
    perform public._erro('nao_responsavel');
  end if;
  update public.etapa_os set estado = 'em_execucao', responsavel_id = p_responsavel, iniciada_em = now() where id = e.id;
  update public.os set atualizado_em = now() where id = e.os_id;
  perform public._auditar('iniciar_etapa', 'etapa_os', e.id,
    format('Etapa "%s" iniciada (%s)', e.nome, public._rotulo_os(e.os_id)), p_responsavel);
  return public._ok(e.id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- concluir

create or replace function public.concluir_etapa(p_etapa uuid, p_pecas_feitas integer default null, p_foto_ids uuid[] default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  e public.etapa_os;
  v_ligar uuid[];
  v_tem_foto boolean;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,producao}');
  e := public._etapa_para_mudar(p_etapa, v_of, true);
  if e.estado <> 'em_execucao' then perform public._erro('transicao_invalida'); end if;
  -- fotos indicadas: da mesma OS; as "durante"/"final" sem etapa (ou já desta) passam a comprovar a etapa
  if coalesce(cardinality(p_foto_ids), 0) > 0 then
    if exists (
      select 1 from unnest(p_foto_ids) fid
       where not exists (select 1 from public.foto f where f.id = fid and f.os_id = e.os_id and f.removida_em is null)) then
      perform public._erro('foto_nao_encontrada');
    end if;
    select array_agg(f.id) into v_ligar
      from public.foto f
     where f.id = any (p_foto_ids) and f.fase in ('durante', 'final') and (f.etapa_id is null or f.etapa_id = e.id);
  end if;
  v_tem_foto := coalesce(cardinality(v_ligar), 0) > 0 or exists (
    select 1 from public.foto f
     where f.os_id = e.os_id and f.etapa_id = e.id and f.fase in ('durante', 'final') and f.removida_em is null);
  if e.exige_foto and not v_tem_foto then perform public._erro('foto_obrigatoria'); end if;
  if e.exige_contagem_pecas and (p_pecas_feitas is null or p_pecas_feitas < 0) then perform public._erro('contagem_obrigatoria'); end if;
  if p_pecas_feitas is not null and p_pecas_feitas < 0 then perform public._erro('contagem_obrigatoria'); end if;

  update public.etapa_os
     set estado = 'concluida', concluida_em = now(), pecas_feitas = coalesce(p_pecas_feitas, pecas_feitas)
   where id = e.id;
  if v_ligar is not null then
    update public.foto set etapa_id = e.id where id = any (v_ligar);
  end if;
  perform public._liberar_proxima(e.os_id, e.ordem);
  perform public._fechar_os_se_pronta(e.os_id);
  perform public._auditar('concluir_etapa', 'etapa_os', e.id,
    format('Etapa "%s" concluída (%s)', e.nome, public._rotulo_os(e.os_id)), e.responsavel_id);
  return public._ok(e.id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- impedimento (bloquear / retomar)

create or replace function public.bloquear_etapa(p_etapa uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  e public.etapa_os;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,producao}');
  e := public._etapa_para_mudar(p_etapa, v_of, true);
  if e.estado <> 'em_execucao' then perform public._erro('transicao_invalida'); end if;
  if nullif(btrim(p_motivo), '') is null then perform public._erro('motivo_obrigatorio'); end if;
  update public.etapa_os set estado = 'bloqueada' where id = e.id;
  insert into public.bloqueio_etapa (oficina_id, etapa_id, inicio_em, motivo, registrado_por)
  values (v_of, e.id, now(), btrim(p_motivo), public.meu_perfil_id());
  update public.os set atualizado_em = now() where id = e.os_id;
  perform public._auditar('bloquear_etapa', 'etapa_os', e.id,
    format('Etapa "%s" parada: %s (%s)', e.nome, btrim(p_motivo), public._rotulo_os(e.os_id)), e.responsavel_id);
  return public._ok(e.id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

create or replace function public.retomar_etapa(p_etapa uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  e public.etapa_os;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,producao}');
  e := public._etapa_para_mudar(p_etapa, v_of, true);
  if e.estado <> 'bloqueada' then perform public._erro('transicao_invalida'); end if;
  update public.etapa_os set estado = 'em_execucao' where id = e.id;
  update public.bloqueio_etapa set fim_em = now() where etapa_id = e.id and fim_em is null;
  update public.os set atualizado_em = now() where id = e.os_id;
  perform public._auditar('retomar_etapa', 'etapa_os', e.id,
    format('Etapa "%s" retomada (%s)', e.nome, public._rotulo_os(e.os_id)), e.responsavel_id);
  return public._ok(e.id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- dispensar e atribuir (dono e gerente)

create or replace function public.dispensar_etapa(p_etapa uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  e public.etapa_os;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor}');
  e := public._etapa_para_mudar(p_etapa, v_of, false);
  if e.estado not in ('aguardando', 'na_fila') then perform public._erro('transicao_invalida'); end if;
  if nullif(btrim(p_motivo), '') is null then perform public._erro('motivo_obrigatorio'); end if;
  update public.etapa_os set estado = 'dispensada', motivo_dispensa = btrim(p_motivo) where id = e.id;
  if e.estado = 'na_fila' then
    perform public._liberar_proxima(e.os_id, e.ordem);
  end if;
  perform public._fechar_os_se_pronta(e.os_id);
  perform public._auditar('dispensar_etapa', 'etapa_os', e.id,
    format('Etapa "%s" dispensada: %s (%s)', e.nome, btrim(p_motivo), public._rotulo_os(e.os_id)), e.responsavel_id);
  return public._ok(e.id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

create or replace function public.atribuir_responsavel(p_etapa uuid, p_perfil uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  e public.etapa_os;
  v_nome text;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor}');
  select * into e from public.etapa_os where id = p_etapa and oficina_id = v_of for update;
  if not found then perform public._erro('etapa_nao_encontrada'); end if;
  if e.estado in ('concluida', 'dispensada') then perform public._erro('transicao_invalida'); end if;
  select p.nome into v_nome from public.perfil p where p.id = p_perfil and p.oficina_id = v_of and p.ativo;
  if v_nome is null then perform public._erro('sem_responsavel'); end if;
  update public.etapa_os set responsavel_id = p_perfil where id = e.id;
  update public.os set atualizado_em = now() where id = e.os_id;
  perform public._auditar('atribuir', 'etapa_os', e.id,
    format('Etapa "%s" atribuída a %s (%s)', e.nome, v_nome, public._rotulo_os(e.os_id)), p_perfil);
  return public._ok(e.id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;
