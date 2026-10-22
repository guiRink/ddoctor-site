-- 0007_funcoes_os.sql — ciclo da OS (arq. §7.2; dominio/os.ts TRANSICOES_OS), recepção, alerta do carro e pendências.
-- Tabela de transições da OS (igual a TRANSICOES_OS do TS; "cancelada" sai de qualquer estado não terminal):
--   rascunho → aguardando_aprovacao | cancelada
--   aguardando_aprovacao → aguardando_agendamento (aprovação confiável, sem conflito) | cancelada
--   aguardando_agendamento → agendada (vaga reservada) | na_oficina (entrada com tipo de reparo) | cancelada
--   agendada → na_oficina | aguardando_agendamento (agendamento cancelado / não compareceu, com motivo) | cancelada
--   na_oficina → pronta (todas as etapas fechadas) | cancelada
--   pronta → entregue | cancelada;  entregue → encerrada (sem pendência nem título aberto) | cancelada

create or replace function public._transicao_os_valida(p_de text, p_para text) returns boolean
language sql immutable set search_path = '' as $$
  select case p_de
    when 'rascunho' then p_para in ('aguardando_aprovacao', 'cancelada')
    when 'aguardando_aprovacao' then p_para in ('aguardando_agendamento', 'cancelada')
    when 'aguardando_agendamento' then p_para in ('agendada', 'na_oficina', 'cancelada')
    when 'agendada' then p_para in ('na_oficina', 'aguardando_agendamento', 'cancelada')
    when 'na_oficina' then p_para in ('pronta', 'cancelada')
    when 'pronta' then p_para in ('entregue', 'cancelada')
    when 'entregue' then p_para in ('encerrada', 'cancelada')
    else false
  end
$$;

-- ---------------------------------------------------------------- abrir atendimento (balcão)
-- p_dados = NovoAtendimentoRapido do TS (camelCase). Devolve {ok, id, osId}; protocolo repetido → {ok:false, codigo, osId}.

create or replace function public.criar_atendimento_rapido(p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_fuso text;
  v_eu uuid;
  v_placa text;
  v_origem text := p_dados ->> 'origem';
  v_seg text := nullif(btrim(p_dados ->> 'seguradora'), '');
  v_prot text := nullif(btrim(p_dados ->> 'protocolo'), '');
  v_pecas jsonb := p_dados -> 'pecas';
  v_rec jsonb;
  v_cliente uuid;
  v_doc text;
  v_tel text;
  v_whats text;
  v_email text;
  v_veiculo uuid;
  v_at uuid;
  v_os uuid;
  v_os_existente uuid;
  v_numero int;
  v_versao uuid;
  v_item jsonb;
  v_ordem int := 0;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  v_fuso := public._fuso(v_of);
  v_eu := public.meu_perfil_id();
  v_placa := regexp_replace(upper(coalesce(p_dados ->> 'placa', '')), '[^A-Z0-9]', '', 'g');
  if v_placa !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then perform public._erro('placa_invalida'); end if;
  if jsonb_typeof(v_pecas) is distinct from 'array' or jsonb_array_length(v_pecas) = 0 then perform public._erro('sem_itens'); end if;
  if v_origem is null or v_origem not in ('maxpar', 'seguradora_direta', 'particular', 'misto') then perform public._erro('origem_invalida'); end if;
  for v_item in select x from jsonb_array_elements(v_pecas) x loop
    if nullif(btrim(v_item ->> 'peca'), '') is null
       or coalesce(v_item ->> 'tecnica', '') not in ('sra', 'martelinho', 'pintura', 'funilaria', 'polimento', 'outro') then
      perform public._erro('sem_itens');
    end if;
    if jsonb_typeof(v_item -> 'valor') = 'number' and ((v_item ->> 'valor')::numeric < 0 or (v_item ->> 'valor')::numeric <> trunc((v_item ->> 'valor')::numeric)) then
      perform public._erro('valor_invalido');
    end if;
  end loop;

  -- chave única do atendimento externo: oficina + seguradora + protocolo (arq. §6.2)
  if v_seg is not null and v_prot is not null then
    select a.id into v_at from public.atendimento_externo a
     where a.oficina_id = v_of and a.seguradora = v_seg and btrim(a.id_externo) = v_prot;
    if v_at is not null then
      select oa.os_id into v_os_existente from public.os_atendimento_externo oa where oa.atendimento_externo_id = v_at limit 1;
      return public._falha('protocolo_duplicado') || jsonb_build_object('osId', v_os_existente);
    end if;
  end if;

  if p_dados ? 'recepcao' and jsonb_typeof(p_dados -> 'recepcao') = 'object' then
    v_rec := public._preparar_recepcao(p_dados -> 'recepcao', null, now(), v_eu, v_fuso);
  end if;

  -- cliente: o escolhido, o que já tem esse documento, ou um novo
  if nullif(p_dados ->> 'clienteId', '') is not null then
    select c.id into v_cliente from public.cliente c where c.id = (p_dados ->> 'clienteId')::uuid and c.oficina_id = v_of;
    if v_cliente is null then perform public._erro('cliente_nao_encontrado'); end if;
  else
    v_doc := nullif(regexp_replace(upper(coalesce(p_dados ->> 'documento', '')), '[^0-9A-Z]', '', 'g'), '');
    if v_doc is not null then
      select c.id into v_cliente from public.cliente c where c.oficina_id = v_of and c.documento = v_doc;
    end if;
    if v_cliente is null then
      if nullif(btrim(p_dados ->> 'clienteNome'), '') is null then perform public._erro('nome_obrigatorio'); end if;
      if v_doc is not null and not public._documento_valido(v_doc) then perform public._erro('documento_invalido'); end if;
      v_tel := public._telefone(p_dados ->> 'telefone');
      v_whats := public._telefone(p_dados ->> 'whatsapp');
      if v_tel = '!' or v_whats = '!' then perform public._erro('telefone_invalido'); end if;
      v_email := nullif(btrim(p_dados ->> 'email'), '');
      if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then perform public._erro('email_invalido'); end if;
      insert into public.cliente (oficina_id, nome, tipo_pessoa, documento, telefone, whatsapp, email)
      values (v_of, btrim(p_dados ->> 'clienteNome'),
              case when v_doc ~ '^[0-9]{11}$' then 'pf' when v_doc is not null then 'pj' end,
              v_doc, v_tel, v_whats, v_email)
      returning id into v_cliente;
    end if;
  end if;

  -- veículo: a placa é única na oficina; se já existe, reaproveita completando o que faltar
  select v.id into v_veiculo from public.veiculo v where v.oficina_id = v_of and v.placa = v_placa for update;
  if v_veiculo is not null then
    update public.veiculo
       set cliente_id = coalesce(cliente_id, v_cliente),
           marca = coalesce(marca, nullif(btrim(p_dados ->> 'marca'), '')),
           modelo = coalesce(modelo, nullif(btrim(p_dados ->> 'modelo'), '')),
           cor = coalesce(cor, nullif(btrim(p_dados ->> 'cor'), ''))
     where id = v_veiculo;
  else
    insert into public.veiculo (oficina_id, cliente_id, placa, marca, modelo, cor)
    values (v_of, v_cliente, v_placa, nullif(btrim(p_dados ->> 'marca'), ''), nullif(btrim(p_dados ->> 'modelo'), ''), nullif(btrim(p_dados ->> 'cor'), ''))
    returning id into v_veiculo;
  end if;

  update public.oficina set ultimo_numero_os = ultimo_numero_os + 1 where id = v_of returning ultimo_numero_os into v_numero;
  insert into public.os (oficina_id, numero, veiculo_id, cliente_id, origem, estado, prioridade, observacoes, recepcao)
  values (v_of, v_numero, v_veiculo, v_cliente, v_origem, 'aguardando_aprovacao', 0, nullif(btrim(p_dados ->> 'observacoes'), ''), v_rec)
  returning id into v_os;

  if v_seg is not null and v_prot is not null then
    insert into public.atendimento_externo (oficina_id, fonte, seguradora, id_externo, status_normalizado, abertura_em, lido_em, estado_conciliacao)
    values (v_of, 'manual', v_seg, v_prot, 'aguardando_autorizacao', public._dia(now(), v_fuso), now(), 'ok')
    returning id into v_at;
    insert into public.os_atendimento_externo (oficina_id, os_id, atendimento_externo_id) values (v_of, v_os, v_at);
  end if;

  insert into public.orcamento_versao (oficina_id, os_id, tipo, numero_versao, fonte, estado)
  values (v_of, v_os, case when v_origem = 'particular' then 'interno' else 'externo' end, 1, 'manual', 'enviado')
  returning id into v_versao;
  for v_item in select x from jsonb_array_elements(v_pecas) x loop
    v_ordem := v_ordem + 1;
    insert into public.item_orcamento (oficina_id, versao_id, ordem, peca, tecnica, valor, status_item)
    values (v_of, v_versao, v_ordem, btrim(v_item ->> 'peca'), v_item ->> 'tecnica',
            coalesce(case when jsonb_typeof(v_item -> 'valor') = 'number' then (v_item ->> 'valor')::bigint end, 0), 'solicitado');
  end loop;

  perform public._auditar('criar', 'os', v_os, format('OS #%s aberta para %s', v_numero, v_placa));
  return public._ok(v_os, jsonb_build_object('osId', v_os));
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when unique_violation or check_violation then
    get stacked diagnostics v_msg = constraint_name;
    return public._falha(v_msg);
end $$;

-- ---------------------------------------------------------------- aprovação

create or replace function public.registrar_aprovacao(p_os uuid, p_evidencia text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_versao public.orcamento_versao;
  v_conflitos int;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  select * into v_os from public.os where id = p_os and oficina_id = v_of for update;
  if not found or v_os.estado <> 'aguardando_aprovacao' then perform public._erro('transicao_invalida'); end if;
  if nullif(btrim(p_evidencia), '') is null then perform public._erro('motivo_obrigatorio'); end if;
  select * into v_versao from public.orcamento_versao where os_id = p_os order by numero_versao desc limit 1 for update;
  if not found then perform public._erro('sem_itens'); end if;
  select count(*) into v_conflitos
    from public.os_atendimento_externo oa join public.atendimento_externo a on a.id = oa.atendimento_externo_id
   where oa.os_id = p_os and a.estado_conciliacao = 'conflito';
  if v_conflitos > 0 then perform public._erro('conflito_aberto'); end if;

  update public.orcamento_versao
     set estado = 'aprovado', aprovacao_tipo = case when tipo = 'interno' then 'cliente' else 'externa' end,
         aprovado_em = now(), evidencia = btrim(p_evidencia), confiavel = true
   where id = v_versao.id;
  update public.item_orcamento set status_item = 'autorizado' where versao_id = v_versao.id and status_item = 'solicitado';
  update public.atendimento_externo a set status_normalizado = 'autorizado'
    from public.os_atendimento_externo oa
   where oa.atendimento_externo_id = a.id and oa.os_id = p_os;
  update public.os set estado = 'aguardando_agendamento' where id = p_os;
  perform public._auditar('aprovar', 'os', p_os, format('Aprovação registrada na OS #%s: %s', v_os.numero, btrim(p_evidencia)));
  return public._ok(p_os);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- entrada real do carro
-- Gera as etapas do tipo de reparo (primeira na fila; prazos encadeados em horas úteis), grava a recepção,
-- fecha o agendamento (confirmado → realizado; propostas/pendentes → cancelado) e sugere a previsão de entrega.

create or replace function public.registrar_entrada(p_os uuid, p_tipo_reparo uuid, p_recepcao jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_fuso text;
  v_exp jsonb;
  v_os public.os;
  v_tipo public.tipo_reparo;
  v_rec jsonb;
  v_agora timestamptz := now();
  v_cursor timestamptz;
  v_prazo timestamptz;
  v_pecas int;
  v_i int := 0;
  m record;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  v_fuso := public._fuso(v_of);
  select c.expediente into v_exp from public.config_oficina c where c.oficina_id = v_of;
  select * into v_os from public.os where id = p_os and oficina_id = v_of for update;
  if not found then perform public._erro('transicao_invalida'); end if;
  select * into v_tipo from public.tipo_reparo where id = p_tipo_reparo and oficina_id = v_of;
  -- arquivada só vale para a OS que já estava com ela
  if not found or (not v_tipo.ativo and v_os.tipo_reparo_id is distinct from v_tipo.id) then perform public._erro('sem_tipo_reparo'); end if;
  if not public._transicao_os_valida(v_os.estado, 'na_oficina') then perform public._erro('transicao_invalida'); end if;
  v_rec := v_os.recepcao;
  if p_recepcao is not null and jsonb_typeof(p_recepcao) = 'object' then
    v_rec := public._preparar_recepcao(p_recepcao, v_os.recepcao, v_agora, public.meu_perfil_id(), v_fuso);
  end if;

  -- peças previstas = itens autorizados da versão vigente (para as etapas com contagem)
  select count(*) into v_pecas from public.item_orcamento i
   where i.versao_id = (select v.id from public.orcamento_versao v where v.os_id = p_os order by v.numero_versao desc limit 1)
     and i.status_item = 'autorizado';

  delete from public.etapa_os where os_id = p_os;
  v_cursor := v_agora;
  for m in
    select * from jsonb_to_recordset(v_tipo.etapas)
      as x(ordem int, nome text, "prazoPadraoHoras" numeric, dispensavel boolean, "exigeFoto" boolean, "exigeContagemPecas" boolean)
     order by ordem
  loop
    v_prazo := public._somar_horas_uteis(v_cursor, m."prazoPadraoHoras", v_exp, v_fuso);
    v_cursor := v_prazo;
    insert into public.etapa_os (oficina_id, os_id, ordem, nome, estado, prazo_horas, prazo_em, entrou_fila_em,
                                 exige_foto, exige_contagem_pecas, pecas_previstas)
    values (v_of, p_os, m.ordem, m.nome, case when v_i = 0 then 'na_fila' else 'aguardando' end, m."prazoPadraoHoras", v_prazo,
            case when v_i = 0 then v_agora end, coalesce(m."exigeFoto", false), coalesce(m."exigeContagemPecas", false),
            case when coalesce(m."exigeContagemPecas", false) and v_pecas > 0 then v_pecas end);
    v_i := v_i + 1;
  end loop;

  update public.agendamento
     set estado = case when estado = 'confirmado' then 'realizado' else 'cancelado' end,
         motivo_cancelamento = case when estado = 'confirmado' then motivo_cancelamento else 'Carro entrou na oficina' end
   where os_id = p_os and estado in ('confirmado', 'proposto', 'pendente', 'contatando');

  update public.os
     set estado = 'na_oficina', tipo_reparo_id = p_tipo_reparo, entrada_real_em = v_agora,
         previsao_entrega = coalesce(previsao_entrega, public._previsao_sugerida(v_tipo.etapas, v_agora, v_exp, v_fuso)),
         recepcao = v_rec
   where id = p_os;
  perform public._auditar('entrada', 'os', p_os, format('Entrada do carro registrada na %s (%s)', public._rotulo_os(p_os), v_tipo.nome));
  return public._ok(p_os);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- entrega

create or replace function public.registrar_entrega(p_os uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_at uuid;
  v_resp uuid;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  select * into v_os from public.os where id = p_os and oficina_id = v_of for update;
  if not found or v_os.estado <> 'pronta' then perform public._erro('transicao_invalida'); end if;
  update public.os set estado = 'entregue', entregue_em = now() where id = p_os;
  select oa.atendimento_externo_id into v_at from public.os_atendimento_externo oa where oa.os_id = p_os order by oa.criado_em limit 1;
  if v_at is not null then
    -- ação no portal fica para a recepção (a primeira ativa; provisório)
    select p.id into v_resp from public.perfil p where p.oficina_id = v_of and p.papel = 'recepcao' and p.ativo order by p.criado_em limit 1;
    insert into public.pendencia_externa (oficina_id, os_id, atendimento_externo_id, tipo, descricao, estado, responsavel_id, criada_em)
    values (v_of, p_os, v_at, 'encerrar_portal', 'Marcar Serviço Realizado e enviar fotos, PDF e assinatura no portal', 'aberta', v_resp, now());
  end if;
  perform public._auditar('entrega', 'os', p_os, format('Carro entregue (%s)', public._rotulo_os(p_os)));
  return public._ok(p_os);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- recepção do veículo (regravação)

create or replace function public.salvar_recepcao(p_os uuid, p_recepcao jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_rec jsonb;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  select * into v_os from public.os where id = p_os and oficina_id = v_of for update;
  if not found then perform public._erro('os_nao_encontrada'); end if;
  if v_os.estado in ('entregue', 'encerrada', 'cancelada') then perform public._erro('os_fechada'); end if;
  v_rec := public._preparar_recepcao(p_recepcao, v_os.recepcao, now(), public.meu_perfil_id(), public._fuso(v_of));
  update public.os set recepcao = v_rec where id = p_os;
  perform public._auditar('recepcao', 'os', p_os,
    format('Recepção do veículo %s na OS #%s (%s avaria(s))',
           case when v_os.recepcao ? 'registradaEm' then 'atualizada' else 'registrada' end, v_os.numero, jsonb_array_length(v_rec -> 'avarias')));
  return public._ok(p_os);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- alerta do carro (aplicarAlertaOS)
-- p_alerta = EntradaAlertaOS: {prazoDiasUteis?, laranjaDiasAntes?, vermelhoSemEtapaDiasAntes?: int 0–60 | null, urgente?: bool}

create or replace function public.salvar_alerta_os(p_os uuid, p_alerta jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_exp jsonb;
  v_fuso text;
  v_alerta jsonb;
  v_partes text[] := '{}';
  v_campo text;
  v_val jsonb;
  v_prev date;
  v_prio smallint;
  v_rotulo text;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  v_fuso := public._fuso(v_of);
  select c.expediente into v_exp from public.config_oficina c where c.oficina_id = v_of;
  select * into v_os from public.os where id = p_os and oficina_id = v_of for update;
  if not found then perform public._erro('os_nao_encontrada'); end if;
  if v_os.estado in ('entregue', 'encerrada', 'cancelada') then perform public._erro('transicao_invalida'); end if;
  v_alerta := coalesce(v_os.alerta, '{}'::jsonb);
  foreach v_campo in array array['prazoDiasUteis', 'laranjaDiasAntes', 'vermelhoSemEtapaDiasAntes'] loop
    continue when not (coalesce(p_alerta, '{}'::jsonb) ? v_campo);
    v_val := p_alerta -> v_campo;
    v_rotulo := case v_campo when 'prazoDiasUteis' then 'prazo' when 'laranjaDiasAntes' then 'laranja a' else 'vermelho sem etapa a' end;
    if jsonb_typeof(v_val) = 'null' then
      v_alerta := v_alerta - v_campo;
      v_partes := v_partes || (v_rotulo || ' pela base');
      continue;
    end if;
    if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric <> trunc((v_val #>> '{}')::numeric)
       or (v_val #>> '{}')::numeric not between 0 and 60 then
      perform public._erro('valor_invalido', v_campo);
    end if;
    v_alerta := v_alerta || jsonb_build_object(v_campo, (v_val #>> '{}')::int);
    v_partes := v_partes || (v_rotulo || ' ' || (v_val #>> '{}') || case when (v_val #>> '{}')::int = 1 then ' dia útil' else ' dias úteis' end);
  end loop;
  if p_alerta ? 'urgente' and jsonb_typeof(p_alerta -> 'urgente') <> 'boolean' then perform public._erro('valor_invalido', 'urgente'); end if;
  if cardinality(v_partes) = 0 and not (p_alerta ? 'urgente') then perform public._erro('nada_a_salvar'); end if;

  v_prev := v_os.previsao_entrega;
  if jsonb_typeof(p_alerta -> 'prazoDiasUteis') = 'number' then
    v_prev := public._entrega_por_dias_uteis(public._dia(coalesce(v_os.entrada_real_em, now()), v_fuso), (p_alerta ->> 'prazoDiasUteis')::int, v_exp);
    v_partes := v_partes || ('entrega ' || v_prev::text);
  end if;
  v_prio := v_os.prioridade;
  if p_alerta ? 'urgente' then
    if (p_alerta ->> 'urgente')::boolean then v_prio := 2; elsif v_prio = 2 then v_prio := 0; end if;
    v_partes := v_partes || case when (p_alerta ->> 'urgente')::boolean then 'urgente' else 'sem urgência' end;
  end if;
  update public.os
     set alerta = case when v_alerta = '{}'::jsonb then null else v_alerta end, prioridade = v_prio, previsao_entrega = v_prev
   where id = p_os;
  perform public._auditar('alerta', 'os', p_os, format('Alerta do carro ajustado na OS #%s: %s', v_os.numero, array_to_string(v_partes, ', ')));
  return public._ok(p_os);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- pendência no portal

create or replace function public.concluir_pendencia(p_pendencia uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_pd public.pendencia_externa;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  select * into v_pd from public.pendencia_externa where id = p_pendencia and oficina_id = v_of for update;
  if not found then perform public._erro('pendencia_nao_encontrada'); end if;
  if v_pd.estado in ('concluida', 'cancelada') then return public._ok(p_pendencia); end if;
  update public.pendencia_externa set estado = 'concluida', concluida_em = now(), confirmado_por = public.meu_perfil_id() where id = p_pendencia;
  perform public._auditar('concluir', 'pendencia_externa', p_pendencia, format('Pendência no portal concluída (%s)', public._rotulo_os(v_pd.os_id)));
  return public._ok(p_pendencia);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;
