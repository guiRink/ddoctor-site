-- 0008_funcoes_agenda.sql — agenda com reserva atômica de vaga (arq. §7.3; dominio/agenda.ts).
-- Ocupam vaga: confirmado e proposto não expirado (proposto sem expira_em ocupa até alguém resolver).
-- Reserva: pg_advisory_xact_lock por (oficina, data) serializa quem disputa a última vaga do dia — duas
-- reservas simultâneas na última vaga: a segunda espera a primeira terminar, recontando, e recebe sem_vaga.
-- `encaixe` = a recepção confirmou passar da capacidade: só a falta de vaga deixa de barrar.

create or replace function public._vagas_do_dia(p_oficina uuid, p_data date, out vagas int, out bloqueado text)
language plpgsql stable security definer set search_path = '' as $$
begin
  select c.vagas_entrada, c.bloqueado into vagas, bloqueado
    from public.capacidade_dia c where c.oficina_id = p_oficina and c.data = p_data;
  if not found then
    select coalesce((c.capacidade_padrao ->> 'vagasEntrada')::int, 0) into vagas
      from public.config_oficina c where c.oficina_id = p_oficina;
    bloqueado := null;
  end if;
end $$;

create or replace function public._vagas_ocupadas(p_oficina uuid, p_data date, p_ignorar uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.agendamento a
   where a.oficina_id = p_oficina and a.data = p_data and a.id is distinct from p_ignorar
     and (a.estado = 'confirmado' or (a.estado = 'proposto' and (a.expira_em is null or a.expira_em > now())))
$$;

-- Data agendável (hoje em diante, dia e período em que a oficina abre) e vaga, com a trava do dia.
-- Devolve true se precisou de encaixe.
create or replace function public._reservar(p_oficina uuid, p_data date, p_janela text, p_ignorar uuid, p_encaixe boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_fuso text := public._fuso(p_oficina);
  v_exp jsonb;
  j record;
  v_cap record;
begin
  select c.expediente into v_exp from public.config_oficina c where c.oficina_id = p_oficina;
  if p_data is null or p_janela is null or p_janela not in ('manha', 'tarde') then perform public._erro('dia_fechado'); end if;
  if p_data < public._dia(now(), v_fuso) then perform public._erro('data_passada'); end if;
  select * into j from public._janela(v_exp, p_data);
  if j.inicio is null or (p_janela = 'tarde' and j.fim <= 12 * 60) then perform public._erro('dia_fechado'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_oficina::text || '|' || p_data::text, 0));
  select * into v_cap from public._vagas_do_dia(p_oficina, p_data);
  if v_cap.bloqueado is not null then perform public._erro('dia_bloqueado'); end if;
  if public._vagas_ocupadas(p_oficina, p_data, p_ignorar) >= v_cap.vagas then
    if not p_encaixe then perform public._erro('sem_vaga'); end if;
    return true;
  end if;
  return false;
end $$;

create or replace function public.agendar(p_os uuid, p_data date, p_janela text, p_encaixe boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_propria uuid;
  v_encaixe boolean;
  v_id uuid;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  select * into v_os from public.os where id = p_os and oficina_id = v_of for update;
  if not found or v_os.estado <> 'aguardando_agendamento' then perform public._erro('transicao_invalida'); end if;
  -- a proposta da própria OS (Calia) nessa data não conta como vaga ocupada ao confirmar
  select a.id into v_propria from public.agendamento a
   where a.os_id = p_os and a.estado = 'proposto' and a.data = p_data order by a.criado_em limit 1;
  v_encaixe := public._reservar(v_of, p_data, p_janela, v_propria, coalesce(p_encaixe, false));
  update public.agendamento set estado = 'cancelado', motivo_cancelamento = 'Substituído por agendamento da recepção'
   where os_id = p_os and estado = 'proposto';
  insert into public.agendamento (oficina_id, os_id, data, janela, estado, origem, encaixe)
  values (v_of, p_os, p_data, p_janela, 'confirmado', 'recepcao', v_encaixe)
  returning id into v_id;
  update public.os set estado = 'agendada' where id = p_os;
  perform public._auditar('agendar', 'agendamento', v_id,
    format('OS #%s agendada para %s (%s)%s', v_os.numero, to_char(p_data, 'DD/MM/YYYY'),
           case when p_janela = 'manha' then 'manhã' else 'tarde' end, case when v_encaixe then ' — encaixe' else '' end));
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- Reagendar = novo registro com substitui_id e o anterior "cancelado" (libera a vaga) na mesma transação.
-- O novo herda estado e origem; proposta mantém o expira_em que tinha.
create or replace function public.reagendar(p_agendamento uuid, p_data date, p_janela text, p_encaixe boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_ag public.agendamento;
  v_encaixe boolean;
  v_id uuid;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  select * into v_ag from public.agendamento where id = p_agendamento and oficina_id = v_of for update;
  if not found then perform public._erro('agendamento_nao_encontrado'); end if;
  if v_ag.estado not in ('proposto', 'confirmado') then perform public._erro('transicao_invalida'); end if;
  v_encaixe := public._reservar(v_of, p_data, p_janela, p_agendamento, coalesce(p_encaixe, false));
  update public.agendamento set estado = 'cancelado', motivo_cancelamento = 'reagendado' where id = p_agendamento;
  insert into public.agendamento (oficina_id, os_id, data, janela, estado, origem, expira_em, substitui_id, encaixe)
  values (v_of, v_ag.os_id, p_data, p_janela, v_ag.estado, v_ag.origem,
          case when v_ag.estado = 'proposto' then v_ag.expira_em end, v_ag.id, v_encaixe)
  returning id into v_id;
  perform public._auditar('reagendar', 'agendamento', v_id,
    format('Agendamento movido para %s (%s)%s (%s)', to_char(p_data, 'DD/MM/YYYY'),
           case when p_janela = 'manha' then 'manhã' else 'tarde' end, case when v_encaixe then ' — encaixe' else '' end,
           public._rotulo_os(v_ag.os_id)));
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

create or replace function public.cancelar_agendamento(p_agendamento uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_ag public.agendamento;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  if nullif(btrim(p_motivo), '') is null then perform public._erro('motivo_obrigatorio'); end if;
  select * into v_ag from public.agendamento where id = p_agendamento and oficina_id = v_of for update;
  if not found or v_ag.estado not in ('confirmado', 'proposto', 'pendente', 'contatando') then perform public._erro('transicao_invalida'); end if;
  update public.agendamento set estado = 'cancelado', motivo_cancelamento = btrim(p_motivo) where id = p_agendamento;
  -- só uma OS agendada volta para a fila; OS já na oficina (ou além) não é tocada
  if v_ag.estado = 'confirmado' then
    update public.os set estado = 'aguardando_agendamento' where id = v_ag.os_id and estado = 'agendada';
  end if;
  perform public._auditar('cancelar', 'agendamento', p_agendamento,
    format('Agendamento cancelado (%s): %s', public._rotulo_os(v_ag.os_id), btrim(p_motivo)));
  return public._ok(p_agendamento);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

create or replace function public.marcar_nao_compareceu(p_agendamento uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_ag public.agendamento;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  select * into v_ag from public.agendamento where id = p_agendamento and oficina_id = v_of for update;
  if not found or v_ag.estado <> 'confirmado' then perform public._erro('transicao_invalida'); end if;
  update public.agendamento set estado = 'nao_compareceu' where id = p_agendamento;
  update public.os set estado = 'aguardando_agendamento' where id = v_ag.os_id and estado = 'agendada';
  perform public._auditar('nao_compareceu', 'agendamento', p_agendamento, format('Cliente não compareceu (%s)', public._rotulo_os(v_ag.os_id)));
  return public._ok(p_agendamento);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;
