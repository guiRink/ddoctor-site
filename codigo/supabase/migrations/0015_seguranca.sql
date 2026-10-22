-- 0015_seguranca.sql — correções da revisão de segurança do S1. Idempotente; rodar depois de 0001…0014 (o aplicar.mjs
-- roda todas em ordem a cada vez). Não edita nada das anteriores: redefine o que precisa (create or replace).
--
--   1. Views só de leitura: revoke insert/update/delete/truncate de anon/authenticated em TODAS as views de public.
--      As views de recorte (vw_producao, vw_equipe, vw_material, vw_movimento_estoque, vw_regra_comissao) continuam
--      com os direitos do dono (é assim que a produção e a TV leem o quadro sem ler as tabelas, e o gerente vê o
--      estoque sem custo); por isso NÃO viram security_invoker — e por isso mesmo não podem ser graváveis
--      (uma view simples é auto-atualizável e escreveria na tabela como o dono, por cima da RLS).
--      Os grants finais passam a morar em public._aplicar_permissoes(): toda migration nova termina chamando-a.
--   2. _guarda_os: da API só mudam box, observacoes e previsao_entrega; o resto (origem, cliente, veículo, motivo,
--      demo, criado_em, criado_por, e qualquer coluna futura) só pelas funções.
--   3. salvar_funcionario: quem não é dono não edita perfil de dono, gerente ou financeiro.
--   4. pagar_despesa: despesa já paga (ou ligada a uma folha paga) → ja_pago.
--   5. Fotos da produção: só das OS em que a pessoa é responsável por alguma etapa aberta, e nunca a fase
--      "externa" (vistoria da seguradora) — tabela foto (foto_ler_producao) e arquivos (_foto_legivel).
--   6. config_oficina: banco valida expediente/semáforo/capacidade (config_invalida); só o dono muda
--      provisorio/confirmado (o gerente salva os valores, mas a marca de "confirmado" fica como estava).
--   7. movimentar_estoque / lancar_custo: perfilId e osId da mesma oficina; iniciar_etapa / atribuir_responsavel:
--      responsável ativo com papel produção, gerente ou dono.
--   8. Entradas do usuário (uuid, data, marco, booleano, número) inválidas → {ok:false, codigo:'valor_invalido'}
--      (datas AAAA-MM-DD continuam com data_invalida), em vez de erro cru do Postgres.
--   9. oficina_tem_dono(): execução para anon garantida depois de qualquer revoke geral.

-- ---------------------------------------------------------------- 8. leitura segura de entradas (jsonb/texto)

-- uuid de um campo de texto: vazio/nulo → null; inválido → valor_invalido (com o campo).
create or replace function public._uuid_entrada(p text, p_campo text default null) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  if nullif(btrim(p), '') is null then return null; end if;
  begin
    return btrim(p)::uuid;
  exception when others then
    perform public._erro('valor_invalido', p_campo);
  end;
  return null;
end $$;

-- booleano de um campo jsonb: ausente/null → null; true/false (ou "true"/"false") → valor; resto → valor_invalido.
create or replace function public._bool_entrada(p jsonb, p_campo text default null) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) = 'boolean' then return (p #>> '{}')::boolean; end if;
  if jsonb_typeof(p) = 'string' and lower(p #>> '{}') in ('true', 'false') then return lower(p #>> '{}')::boolean; end if;
  perform public._erro('valor_invalido', p_campo);
  return null;
end $$;

-- marco (timestamptz) de um campo de texto: vazio/nulo → null; inválido → valor_invalido.
create or replace function public._marco_entrada(p text, p_campo text default null) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  if nullif(btrim(p), '') is null then return null; end if;
  begin
    return btrim(p)::timestamptz;
  exception when others then
    perform public._erro('valor_invalido', p_campo);
  end;
  return null;
end $$;

-- ---------------------------------------------------------------- 2. OS: só box, observações e previsão pela API

create or replace function public._guarda_os() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      raise exception 'use_a_funcao: criar_atendimento_rapido' using errcode = 'DD001';
    end if;
    -- compara a linha inteira menos o que a API pode mudar (coluna nova nasce protegida)
    if (to_jsonb(new) - array['box', 'observacoes', 'previsao_entrega', 'atualizado_em'])
       is distinct from (to_jsonb(old) - array['box', 'observacoes', 'previsao_entrega', 'atualizado_em']) then
      raise exception 'transicao_invalida' using errcode = 'DD001';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- 5. fotos da produção

-- A pessoa (produção) é responsável por alguma etapa aberta desta OS, e a OS está no quadro?
create or replace function public._producao_na_os(p_os uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public._os_no_quadro(p_os)
     and exists (
       select 1 from public.etapa_os e
        where e.os_id = p_os and e.oficina_id = public.minha_oficina()
          and e.responsavel_id = public.meu_perfil_id()
          and e.estado not in ('concluida', 'dispensada'))
$$;

drop policy if exists foto_ler_producao on public.foto;
create policy foto_ler_producao on public.foto for select to authenticated using (
  oficina_id = (select public.minha_oficina()) and (select public.tem_papel('{producao}'))
  and removida_em is null and fase <> 'externa' and public._producao_na_os(os_id)
);

-- Arquivo: operação e financeiro leem qualquer foto da oficina; a produção só o arquivo de uma foto registrada,
-- não removida, que não é da vistoria (externa), de OS em que tem etapa aberta.
create or replace function public._foto_legivel(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(p_nome, '/', 1) = public.minha_oficina()::text
     and (public.tem_papel('{dono,gestor,recepcao,financeiro}')
          or (public.tem_papel('{producao}') and exists (
                select 1 from public.foto f
                 where (f.caminho = p_nome or f.caminho_miniatura = p_nome)
                   and f.oficina_id = public.minha_oficina()
                   and f.removida_em is null and f.fase <> 'externa'
                   and public._producao_na_os(f.os_id))))
$$;

-- ---------------------------------------------------------------- 6. configuração da oficina

-- Expediente válido (igual a aplicarConfig do TS): dias 0–6 sem repetir (≥ 1), "HH:MM", início < fim, sábado > início.
create or replace function public._expediente_valido(p jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v_hhmm text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  v_dias jsonb;
  v_sab text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  v_dias := p -> 'diasSemana';
  if jsonb_typeof(v_dias) is distinct from 'array' or jsonb_array_length(v_dias) = 0 then return false; end if;
  if exists (select 1 from jsonb_array_elements(v_dias) d where jsonb_typeof(d) <> 'number' or (d #>> '{}') !~ '^[0-6]$') then
    return false;
  end if;
  if (select count(distinct d #>> '{}') from jsonb_array_elements(v_dias) d) <> jsonb_array_length(v_dias) then return false; end if;
  if coalesce(p ->> 'inicio', '') !~ v_hhmm or coalesce(p ->> 'fim', '') !~ v_hhmm then return false; end if;
  if public._minutos(p ->> 'inicio') >= public._minutos(p ->> 'fim') then return false; end if;
  v_sab := nullif(p ->> 'sabadoFim', '');
  if v_sab is not null and (v_sab !~ v_hhmm or public._minutos(v_sab) <= public._minutos(p ->> 'inicio')) then return false; end if;
  return true;
end $$;

-- Os campos numéricos presentes são números ≥ 0 (os limites finos ficam no TS: LIMITES_CONFIG).
create or replace function public._numeros_validos(p jsonb, p_campos text[]) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
     and not exists (
       select 1 from unnest(p_campos) c
        where p ? c and jsonb_typeof(p -> c) <> 'null'
          and (jsonb_typeof(p -> c) <> 'number' or (p ->> c)::numeric < 0))
$$;

create or replace function public._guarda_config() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public._expediente_valido(new.expediente) then
    raise exception 'config_invalida' using errcode = 'DD001', detail = 'expediente';
  end if;
  if not public._numeros_validos(new.semaforo, array['laranjaAntesHoras', 'vermelhoBloqueioHoras', 'laranjaFracao']) then
    raise exception 'config_invalida' using errcode = 'DD001', detail = 'semaforo';
  end if;
  if not public._numeros_validos(new.capacidade_padrao, array['vagasEntrada', 'carrosSimultaneos', 'pecasDia']) then
    raise exception 'config_invalida' using errcode = 'DD001', detail = 'capacidadePadrao';
  end if;
  -- "provisório — a confirmar": só o dono confirma; da API, o gerente salva os valores e a marca fica como estava
  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') and not public.tem_papel('{dono}') then
    new.provisorio := old.provisorio;
    new.confirmado := old.confirmado;
  end if;
  return new;
end $$;
drop trigger if exists config_oficina_guarda on public.config_oficina;
create trigger config_oficina_guarda before insert or update on public.config_oficina
  for each row execute function public._guarda_config();

-- ---------------------------------------------------------------- 7. responsável de etapa

-- Responsável válido: perfil ativo da oficina com papel de quem executa (produção) ou cuida da oficina.
create or replace function public._responsavel_valido(p_perfil uuid, p_oficina uuid) returns text
language sql stable security definer set search_path = '' as $$
  select p.nome from public.perfil p
   where p.id = p_perfil and p.oficina_id = p_oficina and p.ativo and p.papel in ('producao', 'gestor', 'dono')
$$;

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
  if p_responsavel is null or public._responsavel_valido(p_responsavel, v_of) is null then
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
  v_nome := public._responsavel_valido(p_perfil, v_of);
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

-- ---------------------------------------------------------------- 8. abrir atendimento (clienteId e valores)

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
  v_cliente_pedido uuid;
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
    if jsonb_typeof(v_item -> 'valor') = 'number' and ((v_item ->> 'valor')::numeric < 0 or (v_item ->> 'valor')::numeric <> trunc((v_item ->> 'valor')::numeric)
       or (v_item ->> 'valor')::numeric > 100000000000) then
      perform public._erro('valor_invalido');
    end if;
  end loop;
  v_cliente_pedido := public._uuid_entrada(p_dados ->> 'clienteId', 'clienteId');

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
  if v_cliente_pedido is not null then
    select c.id into v_cliente from public.cliente c where c.id = v_cliente_pedido and c.oficina_id = v_of;
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
  when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
    return public._falha('valor_invalido');
end $$;

-- ---------------------------------------------------------------- 4 e 8. despesas

create or replace function public.criar_despesa(p_despesa jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_desc text := nullif(btrim(p_despesa ->> 'descricao'), '');
  v_valor bigint;
  v_cat text := nullif(btrim(p_despesa ->> 'categoria'), '');
  v_cat_id uuid;
  v_cat_pedida uuid;
  v_forma text := nullif(p_despesa ->> 'formaPagamento', '');
  v_venc date;
  v_pago date;
  v_valor_pago bigint;
  v_id uuid;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,financeiro}');
  if v_desc is null then perform public._erro('descricao_obrigatoria'); end if;
  v_valor := public._inteiro(p_despesa -> 'valorPrevisto', 'valor_invalido');
  if v_valor is null or v_valor <= 0 then perform public._erro('valor_invalido'); end if;
  v_cat_pedida := public._uuid_entrada(p_despesa ->> 'categoriaId', 'categoriaId');
  if v_cat_pedida is not null then
    select c.id, c.nome into v_cat_id, v_cat from public.categoria_financeira c
     where c.id = v_cat_pedida and c.oficina_id = v_of and c.tipo = 'despesa';
    if v_cat_id is null then perform public._erro('categoria_invalida'); end if;
  end if;
  if v_cat is null then perform public._erro('categoria_invalida'); end if;
  if v_forma is not null and v_forma not in ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'seguradora') then
    perform public._erro('forma_invalida');
  end if;
  v_venc := public._data(p_despesa ->> 'vencimento');
  if p_despesa ? 'pagoEm' and jsonb_typeof(p_despesa -> 'pagoEm') <> 'null' then
    v_pago := public._data(p_despesa ->> 'pagoEm');
    if v_pago > public._dia(now(), public._fuso(v_of)) then perform public._erro('data_futura'); end if;
    perform public._checar_caixa(v_of, v_forma, v_pago);
    v_valor_pago := coalesce(public._inteiro(p_despesa -> 'valorPago', 'valor_invalido'), v_valor);
    if v_valor_pago <= 0 then perform public._erro('valor_invalido'); end if;
  end if;
  insert into public.despesa (oficina_id, categoria_id, categoria, descricao, fornecedor, valor_previsto, vencimento, pago_em, valor_pago, forma_pagamento, obs)
  values (v_of, v_cat_id, v_cat, v_desc, nullif(btrim(p_despesa ->> 'fornecedor'), ''), v_valor, v_venc, v_pago, v_valor_pago, v_forma,
          nullif(btrim(p_despesa ->> 'obs'), ''))
  returning id into v_id;
  perform public._auditar('criar', 'despesa', v_id,
    format('Despesa lançada: %s, %s%s', v_desc, public._reais(v_valor), case when v_pago is not null then ' (paga)' else '' end));
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
    return public._falha('valor_invalido');
end $$;

-- Pagar uma despesa A PAGAR. Já paga (pago_em) ou ligada a uma folha → ja_pago (correção: estorno/novo lançamento).
create or replace function public.pagar_despesa(p_despesa uuid, p_valor bigint, p_pago_em text, p_forma text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  d public.despesa;
  v_pago date;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,financeiro}');
  select * into d from public.despesa where id = p_despesa and oficina_id = v_of for update;
  if not found then perform public._erro('despesa_nao_encontrada'); end if;
  if d.pago_em is not null or exists (select 1 from public.pagamento_folha f where f.despesa_id = d.id) then
    perform public._erro('ja_pago');
  end if;
  if p_valor is null or p_valor <= 0 then perform public._erro('valor_invalido'); end if;
  if p_forma is not null and p_forma not in ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'seguradora') then
    perform public._erro('forma_invalida');
  end if;
  v_pago := public._data(p_pago_em);
  if v_pago > public._dia(now(), public._fuso(v_of)) then perform public._erro('data_futura'); end if;
  perform public._checar_caixa(v_of, coalesce(p_forma, d.forma_pagamento), v_pago);
  update public.despesa set pago_em = v_pago, valor_pago = p_valor, forma_pagamento = coalesce(p_forma, forma_pagamento) where id = p_despesa;
  perform public._auditar('pagar', 'despesa', p_despesa, format('Despesa paga: %s, %s', d.descricao, public._reais(p_valor)));
  return public._ok(p_despesa);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- 7 e 8. estoque e custos

create or replace function public.movimentar_estoque(p_mov jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  m public.material;
  v_tipo text := p_mov ->> 'tipo';
  v_qtd numeric;
  v_mat uuid;
  v_forn uuid;
  v_os uuid;
  v_perfil uuid;
  v_em timestamptz;
  v_id uuid;
  v_q text;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor}');
  if v_tipo is null or v_tipo not in ('entrada_compra', 'consumo_interno', 'ajuste') then perform public._erro('tipo_invalido'); end if;
  v_mat := public._uuid_entrada(p_mov ->> 'materialId', 'materialId');
  v_forn := public._uuid_entrada(p_mov ->> 'fornecedorId', 'fornecedorId');
  v_os := public._uuid_entrada(p_mov ->> 'osId', 'osId');
  v_perfil := public._uuid_entrada(p_mov ->> 'perfilId', 'perfilId');
  v_em := public._marco_entrada(p_mov ->> 'em', 'em');
  select * into m from public.material where id = v_mat and oficina_id = v_of;
  if not found then perform public._erro('material_nao_encontrado'); end if;
  if v_forn is not null and not exists (select 1 from public.fornecedor f where f.id = v_forn and f.oficina_id = v_of) then
    perform public._erro('fornecedor_nao_encontrado');
  end if;
  if v_os is not null and not exists (select 1 from public.os o where o.id = v_os and o.oficina_id = v_of) then
    perform public._erro('os_nao_encontrada');
  end if;
  if v_perfil is not null and not exists (select 1 from public.perfil p where p.id = v_perfil and p.oficina_id = v_of) then
    perform public._erro('perfil_inexistente');
  end if;
  if jsonb_typeof(p_mov -> 'quantidade') is distinct from 'number' then perform public._erro('quantidade_invalida'); end if;
  v_qtd := (p_mov ->> 'quantidade')::numeric;
  v_id := public._movimentar(m.id, v_tipo, v_qtd, p_mov ->> 'sentido', public._inteiro(p_mov -> 'custoUnitario', 'custo_obrigatorio'),
                             v_os, v_perfil, v_forn, p_mov ->> 'obs', v_em);
  v_q := trim(trailing '.' from trim(trailing '0' from v_qtd::text)) || ' ' || m.unidade;
  perform public._auditar(v_tipo, 'material', m.id,
    case v_tipo
      when 'entrada_compra' then format('Entrada de %s de %s a %s cada', v_q, m.nome, public._reais(public._inteiro(p_mov -> 'custoUnitario', 'custo_obrigatorio')))
      when 'consumo_interno' then format('Consumo interno de %s de %s', v_q, m.nome)
      else format('Ajuste de estoque (%s%s) em %s: %s', case when p_mov ->> 'sentido' = 'mais' then '+' else '−' end, v_q, m.nome, btrim(p_mov ->> 'obs'))
    end);
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
    return public._falha('valor_invalido');
end $$;

create or replace function public.salvar_material(p_material jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_id uuid;
  v_nome text := nullif(btrim(p_material ->> 'nome'), '');
  v_un text := nullif(btrim(p_material ->> 'unidade'), '');
  v_min numeric;
  v_forn uuid;
  v_conf date;
  v_ativo boolean;
  v_saldo numeric;
  v_custo numeric;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor}');
  v_id := public._uuid_entrada(p_material ->> 'id', 'id');
  v_forn := public._uuid_entrada(p_material ->> 'fornecedorId', 'fornecedorId');
  v_ativo := public._bool_entrada(p_material -> 'ativo', 'ativo');
  if nullif(btrim(p_material ->> 'ultimaConferenciaEm'), '') is not null then
    v_conf := public._data(btrim(p_material ->> 'ultimaConferenciaEm'));
  end if;
  if v_nome is null then perform public._erro('nome_obrigatorio'); end if;
  if v_un is null then perform public._erro('unidade_obrigatoria'); end if;
  if jsonb_typeof(p_material -> 'saldoMinimo') is distinct from 'number' or (p_material ->> 'saldoMinimo')::numeric < 0 then perform public._erro('quantidade_invalida'); end if;
  v_min := (p_material ->> 'saldoMinimo')::numeric;
  if v_forn is not null and not exists (select 1 from public.fornecedor f where f.id = v_forn and f.oficina_id = v_of) then
    perform public._erro('fornecedor_nao_encontrado');
  end if;
  if v_id is not null then
    -- saldo e custo médio só mudam por movimentação
    update public.material
       set nome = v_nome, codigo = nullif(btrim(p_material ->> 'codigo'), ''), marca = nullif(btrim(p_material ->> 'marca'), ''),
           categoria = coalesce(nullif(btrim(p_material ->> 'categoria'), ''), 'Outros'), unidade = v_un, saldo_minimo = v_min,
           ultima_conferencia_em = v_conf, fornecedor_id = v_forn, ativo = coalesce(v_ativo, true)
     where id = v_id and oficina_id = v_of;
    if not found then perform public._erro('material_nao_encontrado'); end if;
    perform public._auditar('editar', 'material', v_id, format('Material %s atualizado', v_nome));
    return public._ok(v_id);
  end if;
  v_saldo := coalesce(case when jsonb_typeof(p_material -> 'saldoEstimado') = 'number' then (p_material ->> 'saldoEstimado')::numeric end, 0);
  v_custo := coalesce(case when jsonb_typeof(p_material -> 'custoMedio') = 'number' then (p_material ->> 'custoMedio')::numeric end, 0);
  if v_saldo < 0 or v_custo < 0 then perform public._erro('quantidade_invalida'); end if;
  insert into public.material (oficina_id, nome, codigo, marca, categoria, unidade, saldo_estimado, saldo_minimo, ultima_conferencia_em, custo_medio, fornecedor_id, ativo)
  values (v_of, v_nome, nullif(btrim(p_material ->> 'codigo'), ''), nullif(btrim(p_material ->> 'marca'), ''),
          coalesce(nullif(btrim(p_material ->> 'categoria'), ''), 'Outros'), v_un, 0, v_min, v_conf,
          round(v_custo), v_forn, coalesce(v_ativo, true))
  returning id into v_id;
  if v_saldo > 0 then
    perform public._movimentar(v_id, 'ajuste', v_saldo, 'mais', null, null, null, null, 'Saldo inicial no cadastro', now());
  end if;
  perform public._auditar('criar', 'material', v_id, format('Material %s cadastrado', v_nome));
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when check_violation then
    get stacked diagnostics v_msg = constraint_name;
    return public._falha(v_msg);
  when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
    return public._falha('valor_invalido');
end $$;

create or replace function public.lancar_custo(p_os uuid, p_custo jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_tipo text := p_custo ->> 'tipo';
  v_perfil uuid;
  v_desc text := nullif(btrim(p_custo ->> 'descricao'), '');
  m public.material;
  v_qtd numeric;
  v_cu bigint;
  v_total bigint;
  v_min int;
  v_modo text;
  v_un text;
  v_mov uuid;
  v_id uuid;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,financeiro}');
  select * into v_os from public.os where id = p_os and oficina_id = v_of;
  if not found then perform public._erro('os_nao_encontrada'); end if;
  if v_os.estado = 'cancelada' then perform public._erro('transicao_invalida'); end if;
  v_perfil := public._uuid_entrada(p_custo ->> 'perfilId', 'perfilId');
  if v_perfil is not null and not exists (select 1 from public.perfil p where p.id = v_perfil and p.oficina_id = v_of) then
    perform public._erro('perfil_inexistente');
  end if;
  if v_tipo = 'insumo' then
    select * into m from public.material where id = public._uuid_entrada(p_custo ->> 'materialId', 'materialId') and oficina_id = v_of;
    if not found then perform public._erro('material_nao_encontrado'); end if;
    if jsonb_typeof(p_custo -> 'quantidade') is distinct from 'number' then perform public._erro('quantidade_invalida'); end if;
    v_qtd := (p_custo ->> 'quantidade')::numeric;
    v_cu := m.custo_medio;
    v_mov := public._movimentar(m.id, 'saida_os', v_qtd, null, v_cu, p_os, v_perfil, null, null, now());
    v_desc := coalesce(v_desc, m.nome);
    v_un := m.unidade;
    v_total := round(v_qtd * v_cu);
  elsif v_tipo = 'mao_de_obra' then
    if v_desc is null then perform public._erro('descricao_obrigatoria'); end if;
    v_modo := p_custo ->> 'modo';
    v_cu := public._inteiro(p_custo -> 'valorUnitario', 'valor_invalido');
    if v_cu is null or v_cu <= 0 then perform public._erro('valor_invalido'); end if;
    if v_modo is null or v_modo not in ('hora', 'minuto', 'fixo') then perform public._erro('tipo_invalido'); end if;
    if v_modo <> 'fixo' then
      if jsonb_typeof(p_custo -> 'minutos') is distinct from 'number' or (p_custo ->> 'minutos')::numeric <= 0 then perform public._erro('minutos_invalidos'); end if;
      v_min := round((p_custo ->> 'minutos')::numeric);
    end if;
    v_total := case v_modo when 'hora' then round((p_custo ->> 'minutos')::numeric * v_cu / 60)
                           when 'minuto' then round((p_custo ->> 'minutos')::numeric * v_cu) else v_cu end;
    if v_total <= 0 then perform public._erro('valor_invalido'); end if;
    v_qtd := case v_modo when 'hora' then round((p_custo ->> 'minutos')::numeric / 60, 2) when 'minuto' then (p_custo ->> 'minutos')::numeric else 1 end;
    v_un := case v_modo when 'hora' then 'h' when 'minuto' then 'min' end;
  elsif v_tipo in ('terceiro', 'outro') then
    if v_desc is null then perform public._erro('descricao_obrigatoria'); end if;
    v_qtd := coalesce(case when jsonb_typeof(p_custo -> 'quantidade') = 'number' then (p_custo ->> 'quantidade')::numeric end, 1);
    if v_qtd <= 0 then perform public._erro('quantidade_invalida'); end if;
    v_cu := public._inteiro(p_custo -> 'custoUnitario', 'valor_invalido');
    if v_cu is null or v_cu <= 0 then perform public._erro('valor_invalido'); end if;
    v_total := round(v_qtd * v_cu);
    v_un := nullif(btrim(p_custo ->> 'unidade'), '');
  else
    perform public._erro('tipo_invalido');
  end if;
  insert into public.custo_os (oficina_id, os_id, tipo, descricao, quantidade, unidade, custo_unitario, total, material_id, movimento_id,
                               perfil_id, minutos, fornecedor, lancado_em, lancado_por)
  values (v_of, p_os, v_tipo, v_desc, v_qtd, v_un, v_cu, v_total, m.id, v_mov, v_perfil, v_min,
          case when v_tipo in ('terceiro', 'outro') then nullif(btrim(p_custo ->> 'fornecedor'), '') end, now(), public.meu_perfil_id())
  returning id into v_id;
  update public.os set atualizado_em = now() where id = p_os;
  perform public._auditar('lancar_custo', 'custo_os', v_id,
    case when v_tipo = 'insumo'
      then format('Retirada de %s %s de %s para a OS #%s (%s)', trim(trailing '.' from trim(trailing '0' from v_qtd::text)), v_un, v_desc, v_os.numero, public._reais(v_total))
      else format('Custo lançado na OS #%s: %s, %s', v_os.numero, v_desc, public._reais(v_total)) end);
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when check_violation then
    get stacked diagnostics v_msg = constraint_name;
    return public._falha(v_msg);
  when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
    return public._falha('valor_invalido');
end $$;

-- ---------------------------------------------------------------- 8. tipos de reparo e fotos

create or replace function public.salvar_tipo_reparo(p_tipo jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_id uuid;
  v_nome text := btrim(regexp_replace(coalesce(p_tipo ->> 'nome', ''), '\s+', ' ', 'g'));
  v_etapas jsonb := '[]'::jsonb;
  v_n int;
  v_i int := 0;
  e jsonb;
  v_en text;
  v_prazo numeric;
  v_nomes text;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  v_id := public._uuid_entrada(p_tipo ->> 'id', 'id');
  if v_id is not null and not exists (select 1 from public.tipo_reparo t where t.id = v_id and t.oficina_id = v_of) then
    perform public._erro('tipo_nao_encontrado');
  end if;
  if v_nome = '' or length(v_nome) > 60 then perform public._erro('nome_obrigatorio'); end if;
  if exists (select 1 from public.tipo_reparo t where t.oficina_id = v_of and t.id is distinct from v_id and public._chave(t.nome) = public._chave(v_nome)) then
    perform public._erro('nome_duplicado');
  end if;
  if jsonb_typeof(p_tipo -> 'etapas') is distinct from 'array' or jsonb_array_length(p_tipo -> 'etapas') = 0 then perform public._erro('sem_etapas'); end if;
  v_n := jsonb_array_length(p_tipo -> 'etapas');
  if v_n > 20 then perform public._erro('etapa_invalida'); end if;
  if exists (select 1 from jsonb_array_elements(p_tipo -> 'etapas') x where jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'ordem') is distinct from 'number') then
    perform public._erro('ordem_invalida');
  end if;
  for e in select x from jsonb_array_elements(p_tipo -> 'etapas') x order by (x ->> 'ordem')::numeric nulls last loop
    v_i := v_i + 1;
    if (e ->> 'ordem')::numeric <> v_i then perform public._erro('ordem_invalida'); end if;
    v_en := btrim(regexp_replace(coalesce(e ->> 'nome', ''), '\s+', ' ', 'g'));
    if v_en = '' or length(v_en) > 60 then perform public._erro('etapa_invalida'); end if;
    if jsonb_typeof(e -> 'prazoPadraoHoras') is distinct from 'number' then perform public._erro('prazo_invalido'); end if;
    v_prazo := (e ->> 'prazoPadraoHoras')::numeric;
    if v_prazo <= 0 or v_prazo > 200 then perform public._erro('prazo_invalido'); end if;
    v_etapas := v_etapas || jsonb_build_array(jsonb_build_object(
      'ordem', v_i, 'nome', v_en, 'prazoPadraoHoras', v_prazo,
      'dispensavel', coalesce(public._bool_entrada(e -> 'dispensavel', 'dispensavel'), false),
      'exigeFoto', coalesce(public._bool_entrada(e -> 'exigeFoto', 'exigeFoto'), false),
      'exigeContagemPecas', coalesce(public._bool_entrada(e -> 'exigeContagemPecas', 'exigeContagemPecas'), false)));
  end loop;
  select string_agg(x ->> 'nome', ', ' order by (x ->> 'ordem')::int) into v_nomes from jsonb_array_elements(v_etapas) x;
  if v_id is not null then
    update public.tipo_reparo set nome = v_nome, etapas = v_etapas, provisorio = false where id = v_id;
    perform public._auditar('editar', 'tipo_reparo', v_id, format('Tipo de reparo %s atualizado (%s etapas)', v_nome, v_n));
  else
    insert into public.tipo_reparo (oficina_id, nome, etapas, provisorio, ativo, ordem)
    values (v_of, v_nome, v_etapas, false, true, coalesce((select max(t.ordem) + 1 from public.tipo_reparo t where t.oficina_id = v_of), 1))
    returning id into v_id;
    perform public._auditar('criar', 'tipo_reparo', v_id, format('Tipo de reparo %s criado (%s)', v_nome, v_nomes));
  end if;
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when unique_violation or check_violation then
    get stacked diagnostics v_msg = constraint_name;
    return public._falha(v_msg);
  when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
    return public._falha('valor_invalido');
end $$;

create or replace function public.adicionar_foto(p_os uuid, p_foto jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_id uuid;
  v_etapa_id uuid;
  v_fase text := p_foto ->> 'fase';
  v_etapa public.etapa_os;
  v_caminho text := p_foto ->> 'caminho';
  v_mini text := nullif(p_foto ->> 'caminhoMiniatura', '');
  v_prefixo text;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao,producao}');
  v_id := public._uuid_entrada(p_foto ->> 'id', 'id');
  v_etapa_id := public._uuid_entrada(p_foto ->> 'etapaId', 'etapaId');
  select * into v_os from public.os where id = p_os and oficina_id = v_of;
  if not found then perform public._erro('os_nao_encontrada'); end if;
  if public.meu_papel() = 'producao' and not public._os_no_quadro(p_os) then perform public._erro('os_nao_encontrada'); end if;
  if v_os.estado = 'cancelada' then perform public._erro('transicao_invalida'); end if;
  if v_fase is null or v_fase not in ('entrada', 'durante', 'final') then perform public._erro('fase_invalida'); end if;
  if v_etapa_id is not null then
    select * into v_etapa from public.etapa_os where id = v_etapa_id and os_id = p_os;
    if not found then perform public._erro('etapa_nao_encontrada'); end if;
    if v_fase not in ('durante', 'final') then perform public._erro('fase_invalida'); end if;
    if public.meu_papel() = 'producao' and v_etapa.responsavel_id is distinct from public.meu_perfil_id() then
      perform public._erro('nao_responsavel');
    end if;
  end if;
  v_prefixo := v_of::text || '/' || p_os::text || '/' || coalesce(v_id::text, '?') || '.';
  if v_id is null or v_caminho is null or left(v_caminho, length(v_prefixo)) <> v_prefixo
     or (v_mini is not null and left(v_mini, length(v_prefixo)) <> v_prefixo) then
    perform public._erro('arquivo_invalido');
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = v_caminho) then
    perform public._erro('arquivo_invalido');
  end if;
  insert into public.foto (id, oficina_id, os_id, etapa_id, fase, legenda, caminho, caminho_miniatura, bytes, largura, altura, autor_id, origem, tirada_em)
  values (v_id, v_of, p_os, v_etapa.id, v_fase, left(nullif(btrim(p_foto ->> 'legenda'), ''), 120), v_caminho, v_mini,
          case when jsonb_typeof(p_foto -> 'bytes') = 'number' then (p_foto ->> 'bytes')::int end,
          case when jsonb_typeof(p_foto -> 'largura') = 'number' and (p_foto ->> 'largura')::numeric > 0 then (p_foto ->> 'largura')::int end,
          case when jsonb_typeof(p_foto -> 'altura') = 'number' and (p_foto ->> 'altura')::numeric > 0 then (p_foto ->> 'altura')::int end,
          public.meu_perfil_id(), 'interna', now());
  update public.os set atualizado_em = now() where id = p_os;
  perform public._auditar('adicionar_foto', 'foto', v_id,
    format('Foto (%s%s) adicionada à %s', v_fase, coalesce(', ' || v_etapa.nome, ''), public._rotulo_os(p_os)), public.meu_perfil_id());
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when unique_violation then
    return public._falha('arquivo_invalido');
  when check_violation or invalid_text_representation or numeric_value_out_of_range then
    return public._falha('valor_invalido');
end $$;

-- ---------------------------------------------------------------- 3 e 8. equipe

-- Dono e gerente gerenciam a equipe; trocar `papel` e mexer no salário só o dono; quem não é dono não cria nem
-- edita (nome, função, contato, ativo) perfil de dono, gerente ou financeiro — nem o próprio (sem_permissao).
create or replace function public.salvar_funcionario(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_dono boolean;
  v_id uuid;
  v_antes public.perfil;
  v_papel text := p ->> 'papel';
  v_nome text := btrim(regexp_replace(coalesce(p ->> 'nome', ''), '\s+', ' ', 'g'));
  v_ativo boolean;
  v_terminal boolean;
  v_adm date;
  v_sal bigint;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor}');
  v_dono := public.tem_papel('{dono}');
  v_id := public._uuid_entrada(p ->> 'id', 'id');
  v_ativo := public._bool_entrada(p -> 'ativo', 'ativo');
  v_terminal := public._bool_entrada(p -> 'usaTerminal', 'usaTerminal');
  if v_nome = '' then perform public._erro('nome_obrigatorio', 'nome'); end if;
  if v_papel is null or v_papel not in ('dono', 'gestor', 'recepcao', 'producao', 'financeiro', 'dispositivo') then
    perform public._erro('papel_invalido', 'papel');
  end if;
  if nullif(p ->> 'admitidoEm', '') is not null then v_adm := public._data(p ->> 'admitidoEm'); end if;
  if p ? 'salarioMensal' and jsonb_typeof(p -> 'salarioMensal') <> 'null' then
    if not v_dono then perform public._erro('sem_permissao', 'salarioMensal'); end if;
    v_sal := public._inteiro(p -> 'salarioMensal', 'salario_invalido');
  end if;
  if v_id is not null then
    select * into v_antes from public.perfil where id = v_id and oficina_id = v_of for update;
    if not found then perform public._erro('perfil_inexistente'); end if;
    if not v_dono and v_antes.papel in ('dono', 'gestor', 'financeiro') then perform public._erro('sem_permissao'); end if;
    if v_papel <> v_antes.papel and not v_dono then perform public._erro('sem_permissao', 'papel'); end if;
    update public.perfil
       set nome = v_nome, papel = v_papel, funcao = nullif(btrim(p ->> 'funcao'), ''),
           usuario = case when auth_user_id is null then nullif(btrim(p ->> 'usuario'), '') else usuario end,
           email = nullif(lower(btrim(p ->> 'email')), ''), telefone = nullif(btrim(p ->> 'telefone'), ''),
           admitido_em = v_adm, ativo = coalesce(v_ativo, ativo),
           usa_terminal = coalesce(v_terminal, usa_terminal)
     where id = v_id;
    perform public._auditar('editar', 'perfil', v_id,
      format('Cadastro de %s atualizado%s', v_nome,
             case when v_papel <> v_antes.papel then format(' (permissão %s → %s)', v_antes.papel, v_papel) else '' end
             || case when coalesce(v_ativo, v_antes.ativo) <> v_antes.ativo
                     then case when v_antes.ativo then ' (desativado)' else ' (reativado)' end else '' end), v_id);
  else
    if not v_dono and v_papel in ('dono', 'gestor', 'financeiro') then perform public._erro('sem_permissao', 'papel'); end if;
    insert into public.perfil (oficina_id, nome, papel, funcao, usuario, email, telefone, admitido_em, ativo, usa_terminal)
    values (v_of, v_nome, v_papel, nullif(btrim(p ->> 'funcao'), ''), nullif(btrim(p ->> 'usuario'), ''), nullif(lower(btrim(p ->> 'email')), ''),
            nullif(btrim(p ->> 'telefone'), ''), v_adm, coalesce(v_ativo, true), coalesce(v_terminal, false))
    returning id into v_id;
    perform public._auditar('criar', 'perfil', v_id, format('Funcionário %s cadastrado (%s)', v_nome, v_papel), v_id);
  end if;
  if v_dono and p ? 'salarioMensal' then
    insert into public.perfil_salario (oficina_id, perfil_id, salario_mensal) values (v_of, v_id, v_sal)
    on conflict (perfil_id) do update set salario_mensal = excluded.salario_mensal;
  end if;
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when unique_violation or check_violation then
    get stacked diagnostics v_msg = constraint_name;
    return public._falha(v_msg);
end $$;

-- ---------------------------------------------------------------- 1 e 9. grants finais (fonte única daqui em diante)
-- Refaz tudo o que 0013 fazia e acrescenta: views sem escrita, TRUNCATE/REFERENCES/TRIGGER fora da API e o
-- execute de oficina_tem_dono para anon DEPOIS do revoke geral. Toda migration nova termina com
--   select public._aplicar_permissoes();
-- (o Supabase dá ALL a anon/authenticated em todo objeto novo de public por default privileges).

create or replace function public._aplicar_permissoes() returns void
language plpgsql set search_path = '' as $$
declare
  v record;
  f record;
  r text;
begin
  -- tabelas: authenticated lê/escreve sob RLS; nada de TRUNCATE (passa por cima da RLS), REFERENCES ou TRIGGER
  execute 'grant usage on schema public to authenticated';
  execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
  execute 'revoke truncate, references, trigger on all tables in schema public from authenticated';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on all tables in schema public to service_role';
  end if;

  -- imutáveis: ninguém altera nem apaga; auditoria só leitura pela API
  foreach r in array array['authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on public.evento_auditoria, public.movimento_estoque, public.baixa, public.fechamento_caixa from %I', r);
    end if;
  end loop;
  execute 'revoke insert on public.evento_auditoria from authenticated';

  -- views: SÓ LEITURA para todos da API (as de recorte rodam como o dono e escreveriam por cima da RLS)
  for v in
    select c.oid::regclass as rel from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on %s from public', v.rel);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke insert, update, delete, truncate, references, trigger on %s from %I', v.rel, r);
      end if;
    end loop;
  end loop;

  -- funções: ninguém por padrão; o painel (authenticated) chama as públicas
  execute 'revoke execute on all functions in schema public from public';
  execute 'grant execute on all functions in schema public to authenticated';
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         '_auditar', '_auditoria_trigger', '_baixar', '_movimentar', '_liberar_proxima', '_fechar_os_se_pronta',
         '_etapa_para_mudar', '_reservar', '_vagas_do_dia', '_vagas_ocupadas', '_checar_caixa', '_linhas_comissao',
         '_rotulo_os', '_fuso', '_exigir', '_preparar_tabela', '_politicas', '_categoria_renomeada', '_guarda_saldo_material',
         '_guarda_os', '_guarda_versao', '_guarda_folha_paga', '_guarda_ultimo_dono', '_imutavel', '_tocar_atualizado_em',
         '_guarda_config', '_responsavel_valido', '_aplicar_permissoes', 'definir_primeiro_dono')
  loop
    execute format('revoke execute on function %s from authenticated', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f.assinatura);
    end if;
  end loop;

  -- a tela de login (sem sessão) só pergunta se já existe dono com login
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.oficina_tem_dono() to anon';
  end if;
  execute 'grant execute on function public.oficina_tem_dono() to authenticated';
end $$;

select public._aplicar_permissoes();
