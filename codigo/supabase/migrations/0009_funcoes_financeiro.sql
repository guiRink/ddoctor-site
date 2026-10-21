-- 0009_funcoes_financeiro.sql — baixas e pagamentos, despesas, caixa, custos da OS, estoque e folha.
-- Dinheiro em centavos (bigint). Caixa fechado trava lançamento em dinheiro com a data daquele dia (caixa_ja_fechado).
-- Quem: dinheiro = dono e financeiro (veFinanceiro); estoque = dono e gerente (o gerente lança mas não lê custo).

-- Data AAAA-MM-DD real (validarDataRealizada/validarDataPrevista): texto inválido → data_invalida.
create or replace function public._data(p text) returns date
language plpgsql immutable set search_path = '' as $$
declare
  v date;
begin
  if p is null or p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then perform public._erro('data_invalida'); end if;
  begin
    v := p::date;
  exception when others then
    perform public._erro('data_invalida');
  end;
  if to_char(v, 'YYYY-MM-DD') <> p then perform public._erro('data_invalida'); end if;
  return v;
end $$;

-- Inteiro de um campo jsonb (null se ausente; erro `codigo` se não for inteiro).
create or replace function public._inteiro(p jsonb, p_codigo text) returns bigint
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) <> 'number' or (p #>> '{}')::numeric <> trunc((p #>> '{}')::numeric) then perform public._erro(p_codigo); end if;
  return (p #>> '{}')::bigint;
end $$;

-- Aplica a baixa no título travado (aplicarBaixa do TS): parcial se sobra saldo, recebido se zera, nunca acima.
create or replace function public._baixar(p_titulo uuid, p_valor bigint, p_recebido date, p_forma text, p_parcelas int, p_obs text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.titulo_receber;
  v_saldo bigint;
  v_id uuid;
begin
  select * into t from public.titulo_receber where id = p_titulo for update;
  if t.estado in ('recebido', 'cancelado') then perform public._erro('transicao_invalida'); end if;
  if p_valor is null or p_valor <= 0 then perform public._erro('valor_invalido'); end if;
  v_saldo := t.valor - coalesce((select sum(b.valor) from public.baixa b where b.titulo_id = t.id), 0);
  if p_valor > v_saldo then perform public._erro('baixa_maior_que_saldo'); end if;
  insert into public.baixa (oficina_id, titulo_id, valor, recebido_em, forma, parcelas, obs)
  values (t.oficina_id, t.id, p_valor, p_recebido, p_forma, p_parcelas, nullif(btrim(p_obs), ''))
  returning id into v_id;
  update public.titulo_receber set estado = case when p_valor = v_saldo then 'recebido' else 'parcial' end where id = t.id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- baixa num título (A receber)
-- p_baixa = Omit<Baixa,"id">: {valor, recebidoEm, forma, parcelas?, obs?}

create or replace function public.aplicar_baixa(p_titulo uuid, p_baixa jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  t public.titulo_receber;
  v_data date;
  v_valor bigint;
  v_os int;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,financeiro}');
  select * into t from public.titulo_receber where id = p_titulo and oficina_id = v_of;
  if not found then perform public._erro('transicao_invalida'); end if;
  v_data := public._data(p_baixa ->> 'recebidoEm');
  if v_data > public._dia(now(), public._fuso(v_of)) then perform public._erro('data_futura'); end if;
  perform public._checar_caixa(v_of, p_baixa ->> 'forma', v_data);
  v_valor := public._inteiro(p_baixa -> 'valor', 'valor_invalido');
  perform public._baixar(p_titulo, v_valor, v_data, coalesce(p_baixa ->> 'forma', ''),
                         public._inteiro(p_baixa -> 'parcelas', 'parcelas_invalidas')::int, p_baixa ->> 'obs');
  select o.numero into v_os from public.os o where o.id = t.os_id;
  perform public._auditar('baixa', 'titulo_receber', p_titulo, format('Baixa de %s em "%s" (OS #%s)', public._reais(v_valor), t.descricao, v_os));
  return public._ok(p_titulo);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
  when check_violation then
    get stacked diagnostics v_msg = constraint_name;
    return public._falha(v_msg);
end $$;

-- ---------------------------------------------------------------- pagamento do cliente na OS
-- Baixa no título do cliente em aberto (vencimento mais antigo); sem nenhum, cria "Particular/franquia" com o saldo
-- ainda não cobrado (saldoACobrarCliente: particular = valor aprovado; seguradora = franquia + complemento).

create or replace function public.registrar_pagamento_os(p_os uuid, p_pagamento jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_valor bigint;
  v_forma text := p_pagamento ->> 'forma';
  v_parcelas int;
  v_data date;
  v_pagador uuid;
  v_titulo uuid;
  v_versao public.orcamento_versao;
  v_esperado bigint := 0;
  v_cobrado bigint;
  v_msg text;
  v_det text;
begin
  -- a recepção cobra franquia/particular no balcão (vePagamentosOS)
  v_of := public._exigir('{dono,financeiro,recepcao}');
  select * into v_os from public.os where id = p_os and oficina_id = v_of;
  if not found then perform public._erro('os_nao_encontrada'); end if;
  if v_os.estado = 'cancelada' then perform public._erro('transicao_invalida'); end if;
  v_valor := public._inteiro(p_pagamento -> 'valor', 'valor_invalido');
  if v_valor is null or v_valor <= 0 then perform public._erro('valor_invalido'); end if;
  if v_forma is null or v_forma not in ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'seguradora') then
    perform public._erro('forma_invalida');
  end if;
  v_parcelas := public._inteiro(p_pagamento -> 'parcelas', 'parcelas_invalidas');
  if v_parcelas is not null and v_parcelas < 1 then perform public._erro('parcelas_invalidas'); end if;
  v_data := public._data(p_pagamento ->> 'recebidoEm');
  if v_data > public._dia(now(), public._fuso(v_of)) then perform public._erro('data_futura'); end if;
  perform public._checar_caixa(v_of, v_forma, v_data);
  select p.id into v_pagador from public.pagador p where p.oficina_id = v_of and p.tipo = 'cliente' order by p.criado_em limit 1;
  if v_pagador is null then perform public._erro('sem_pagador'); end if;

  select t.id into v_titulo
    from public.titulo_receber t
   where t.os_id = p_os and t.pagador_id = v_pagador and t.estado not in ('recebido', 'cancelado')
     and t.valor - coalesce((select sum(b.valor) from public.baixa b where b.titulo_id = t.id), 0) > 0
   order by t.vencimento
   limit 1;
  if v_titulo is null then
    select * into v_versao from public.orcamento_versao v where v.os_id = p_os order by v.numero_versao desc limit 1;
    if found then
      if v_os.origem = 'particular' then
        select coalesce(sum(i.valor), 0) into v_esperado from public.item_orcamento i
         where i.versao_id = v_versao.id
           and case when v_versao.tipo = 'interno' then i.status_item not in ('negado', 'dispensado') else i.status_item = 'autorizado' end;
      else
        v_esperado := greatest(0, coalesce(v_versao.franquia, 0)) + greatest(0, coalesce(v_versao.complemento_particular, 0));
      end if;
    end if;
    select coalesce(sum(t.valor), 0) into v_cobrado from public.titulo_receber t
     where t.os_id = p_os and t.pagador_id = v_pagador and t.estado <> 'cancelado';
    if v_esperado - v_cobrado <= 0 then perform public._erro('os_quitada'); end if;
    insert into public.titulo_receber (oficina_id, os_id, pagador_id, descricao, valor, vencimento, estado)
    values (v_of, p_os, v_pagador, 'Particular/franquia', v_esperado - v_cobrado, v_data, 'emitido')
    returning id into v_titulo;
  end if;
  perform public._baixar(v_titulo, v_valor, v_data, v_forma, v_parcelas, p_pagamento ->> 'obs');
  perform public._auditar('baixa', 'titulo_receber', v_titulo,
    format('Pagamento de %s (%s%s) na OS #%s', public._reais(v_valor), v_forma,
           case when v_parcelas > 1 then ' em ' || v_parcelas || 'x' else '' end, v_os.numero));
  return public._ok(v_titulo);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- despesas
-- p_despesa = DespesaEntrada: {categoriaId?, categoria?, descricao, fornecedor?, valorPrevisto, vencimento, pagoEm?, valorPago?, formaPagamento?, obs?}

create or replace function public.criar_despesa(p_despesa jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_desc text := nullif(btrim(p_despesa ->> 'descricao'), '');
  v_valor bigint;
  v_cat text := nullif(btrim(p_despesa ->> 'categoria'), '');
  v_cat_id uuid;
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
  if nullif(p_despesa ->> 'categoriaId', '') is not null then
    select c.id, c.nome into v_cat_id, v_cat from public.categoria_financeira c
     where c.id = (p_despesa ->> 'categoriaId')::uuid and c.oficina_id = v_of and c.tipo = 'despesa';
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
end $$;

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
  if p_valor is null or p_valor <= 0 then perform public._erro('valor_invalido'); end if;
  if p_forma is not null and p_forma not in ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'seguradora') then
    perform public._erro('forma_invalida');
  end if;
  v_pago := public._data(p_pago_em);
  if v_pago > public._dia(now(), public._fuso(v_of)) then perform public._erro('data_futura'); end if;
  perform public._checar_caixa(v_of, coalesce(p_forma, d.forma_pagamento), v_pago);
  -- a despesa já paga em dinheiro num dia fechado também não muda (a saída já foi conferida na gaveta)
  if d.pago_em is not null and d.pago_em <> v_pago then
    perform public._checar_caixa(v_of, d.forma_pagamento, d.pago_em);
  end if;
  update public.despesa set pago_em = v_pago, valor_pago = p_valor, forma_pagamento = coalesce(p_forma, forma_pagamento) where id = p_despesa;
  perform public._auditar('pagar', 'despesa', p_despesa, format('Despesa paga: %s, %s', d.descricao, public._reais(p_valor)));
  return public._ok(p_despesa);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- fechamento de caixa (só dinheiro em espécie)
-- p_dados = FechamentoEntrada: {data, contado, saldoInicial?, obs?}. saldoInicial ausente = contado do último fechamento anterior.

create or replace function public.fechar_caixa(p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_data date;
  v_contado bigint;
  v_inicial bigint;
  v_entradas bigint;
  v_saidas bigint;
  v_esperado bigint;
  v_id uuid;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,financeiro}');
  v_data := public._data(p_dados ->> 'data');
  if v_data > public._dia(now(), public._fuso(v_of)) then perform public._erro('data_futura'); end if;
  v_contado := public._inteiro(p_dados -> 'contado', 'valor_invalido');
  if v_contado is null or v_contado < 0 then perform public._erro('valor_invalido'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_of::text || '|caixa|' || v_data::text, 0));
  if exists (select 1 from public.fechamento_caixa f where f.oficina_id = v_of and f.data = v_data) then perform public._erro('caixa_ja_fechado'); end if;
  v_inicial := public._inteiro(p_dados -> 'saldoInicial', 'valor_invalido');
  if v_inicial is null then
    select f.contado into v_inicial from public.fechamento_caixa f where f.oficina_id = v_of and f.data < v_data order by f.data desc limit 1;
    v_inicial := coalesce(v_inicial, 0);
  end if;
  if v_inicial < 0 then perform public._erro('valor_invalido'); end if;
  select coalesce(sum(b.valor), 0) into v_entradas
    from public.baixa b join public.titulo_receber t on t.id = b.titulo_id
   where b.oficina_id = v_of and t.estado <> 'cancelado' and b.recebido_em = v_data and public._forma(b.forma) = 'dinheiro';
  select coalesce(sum(coalesce(d.valor_pago, d.valor_previsto)), 0) into v_saidas
    from public.despesa d
   where d.oficina_id = v_of and d.pago_em = v_data and d.forma_pagamento = 'dinheiro';
  v_esperado := v_inicial + v_entradas - v_saidas;
  insert into public.fechamento_caixa (oficina_id, data, saldo_inicial, contado, entradas_dinheiro, saidas_dinheiro, esperado, diferenca, obs, fechado_por, fechado_em)
  values (v_of, v_data, v_inicial, v_contado, v_entradas, v_saidas, v_esperado, v_contado - v_esperado, nullif(btrim(p_dados ->> 'obs'), ''), public.meu_perfil_id(), now())
  returning id into v_id;
  perform public._auditar('fechar_caixa', 'fechamento_caixa', v_id,
    format('Fechamento de caixa de %s %s', to_char(v_data, 'DD/MM/YYYY'),
           case when v_contado = v_esperado then 'sem diferença'
                when v_contado < v_esperado then 'com falta de ' || public._reais(v_esperado - v_contado)
                else 'com sobra de ' || public._reais(v_contado - v_esperado) end));
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- estoque

-- Aplica um movimento ao material travado (aplicarMovimento do TS) e grava o movimento. Devolve o id do movimento.
create or replace function public._movimentar(p_material uuid, p_tipo text, p_qtd numeric, p_sentido text, p_custo bigint,
  p_os uuid, p_perfil uuid, p_fornecedor uuid, p_obs text, p_em timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  m public.material;
  v_saldo numeric;
  v_cm bigint;
  v_id uuid;
begin
  select * into m from public.material where id = p_material for update;
  if p_qtd is null or p_qtd <= 0 then perform public._erro('quantidade_invalida'); end if;
  if p_tipo = 'ajuste' then
    if p_sentido is null or p_sentido not in ('mais', 'menos') then perform public._erro('sentido_obrigatorio'); end if;
    if nullif(btrim(p_obs), '') is null then perform public._erro('motivo_obrigatorio'); end if;
  end if;
  v_cm := m.custo_medio;
  if p_tipo = 'entrada_compra' then
    if p_custo is null or p_custo < 0 then perform public._erro('custo_obrigatorio'); end if;
    -- custo médio ponderado; saldo ≤ 0 não pesa
    v_cm := round((greatest(0, m.saldo_estimado) * m.custo_medio + p_qtd * p_custo) / (greatest(0, m.saldo_estimado) + p_qtd));
    v_saldo := round(m.saldo_estimado + p_qtd, 3);
  elsif p_tipo in ('saida_os', 'consumo_interno') or (p_tipo = 'ajuste' and p_sentido = 'menos') then
    if p_tipo in ('saida_os', 'consumo_interno') and not m.ativo then perform public._erro('material_inativo'); end if;
    if round(p_qtd, 3) > round(m.saldo_estimado, 3) then perform public._erro('saldo_insuficiente'); end if;
    v_saldo := round(m.saldo_estimado - p_qtd, 3);
  else
    v_saldo := round(m.saldo_estimado + p_qtd, 3);
  end if;
  update public.material set saldo_estimado = v_saldo, custo_medio = v_cm where id = m.id;
  insert into public.movimento_estoque (oficina_id, material_id, tipo, quantidade, sentido, custo_unitario, os_id, perfil_id, fornecedor_id, obs, em)
  values (m.oficina_id, m.id, p_tipo, p_qtd, case when p_tipo = 'ajuste' then p_sentido end, p_custo, p_os, p_perfil, p_fornecedor,
          nullif(btrim(p_obs), ''), coalesce(p_em, now()))
  returning id into v_id;
  return v_id;
end $$;

-- p_mov = MovimentoEntrada: {materialId, tipo: entrada_compra|consumo_interno|ajuste, quantidade, sentido?, custoUnitario?, perfilId?, fornecedorId?, osId?, obs?, em?}
create or replace function public.movimentar_estoque(p_mov jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  m public.material;
  v_tipo text := p_mov ->> 'tipo';
  v_qtd numeric;
  v_forn uuid := nullif(p_mov ->> 'fornecedorId', '')::uuid;
  v_id uuid;
  v_q text;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor}');
  if v_tipo is null or v_tipo not in ('entrada_compra', 'consumo_interno', 'ajuste') then perform public._erro('tipo_invalido'); end if;
  select * into m from public.material where id = nullif(p_mov ->> 'materialId', '')::uuid and oficina_id = v_of;
  if not found then perform public._erro('material_nao_encontrado'); end if;
  if v_forn is not null and not exists (select 1 from public.fornecedor f where f.id = v_forn and f.oficina_id = v_of) then
    perform public._erro('fornecedor_nao_encontrado');
  end if;
  if jsonb_typeof(p_mov -> 'quantidade') <> 'number' then perform public._erro('quantidade_invalida'); end if;
  v_qtd := (p_mov ->> 'quantidade')::numeric;
  v_id := public._movimentar(m.id, v_tipo, v_qtd, p_mov ->> 'sentido', public._inteiro(p_mov -> 'custoUnitario', 'custo_obrigatorio'),
                             nullif(p_mov ->> 'osId', '')::uuid, nullif(p_mov ->> 'perfilId', '')::uuid, v_forn, p_mov ->> 'obs',
                             nullif(p_mov ->> 'em', '')::timestamptz);
  v_q := trim(trailing '.' from trim(trailing '0' from v_qtd::text)) || ' ' || m.unidade;
  perform public._auditar(v_tipo, 'material', m.id,
    case v_tipo
      when 'entrada_compra' then format('Entrada de %s de %s a %s cada', v_q, m.nome, public._reais((p_mov ->> 'custoUnitario')::bigint))
      when 'consumo_interno' then format('Consumo interno de %s de %s', v_q, m.nome)
      else format('Ajuste de estoque (%s%s) em %s: %s', case when p_mov ->> 'sentido' = 'mais' then '+' else '−' end, v_q, m.nome, btrim(p_mov ->> 'obs'))
    end);
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- p_material = MaterialEntrada: {id?, nome, codigo?, marca?, categoria, unidade, saldoMinimo, ultimaConferenciaEm?, fornecedorId?, ativo?,
--   saldoEstimado? (só no cadastro: vira ajuste "Saldo inicial"), custoMedio? (só no cadastro)}
create or replace function public.salvar_material(p_material jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_id uuid := nullif(p_material ->> 'id', '')::uuid;
  v_nome text := nullif(btrim(p_material ->> 'nome'), '');
  v_un text := nullif(btrim(p_material ->> 'unidade'), '');
  v_min numeric;
  v_forn uuid := nullif(p_material ->> 'fornecedorId', '')::uuid;
  v_saldo numeric;
  v_custo numeric;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor}');
  if v_nome is null then perform public._erro('nome_obrigatorio'); end if;
  if v_un is null then perform public._erro('unidade_obrigatoria'); end if;
  if jsonb_typeof(p_material -> 'saldoMinimo') <> 'number' or (p_material ->> 'saldoMinimo')::numeric < 0 then perform public._erro('quantidade_invalida'); end if;
  v_min := (p_material ->> 'saldoMinimo')::numeric;
  if v_forn is not null and not exists (select 1 from public.fornecedor f where f.id = v_forn and f.oficina_id = v_of) then
    perform public._erro('fornecedor_nao_encontrado');
  end if;
  if v_id is not null then
    -- saldo e custo médio só mudam por movimentação
    update public.material
       set nome = v_nome, codigo = nullif(btrim(p_material ->> 'codigo'), ''), marca = nullif(btrim(p_material ->> 'marca'), ''),
           categoria = coalesce(nullif(btrim(p_material ->> 'categoria'), ''), 'Outros'), unidade = v_un, saldo_minimo = v_min,
           ultima_conferencia_em = nullif(p_material ->> 'ultimaConferenciaEm', '')::date, fornecedor_id = v_forn,
           ativo = coalesce((p_material ->> 'ativo')::boolean, true)
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
          coalesce(nullif(btrim(p_material ->> 'categoria'), ''), 'Outros'), v_un, 0, v_min, nullif(p_material ->> 'ultimaConferenciaEm', '')::date,
          round(v_custo), v_forn, coalesce((p_material ->> 'ativo')::boolean, true))
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
end $$;

-- ---------------------------------------------------------------- custos da OS (dono e financeiro)
-- p_custo = NovoCustoOS do TS:
--   {tipo:"insumo", materialId, quantidade, perfilId?, descricao?}  → retira do estoque (saida_os) pelo custo médio
--   {tipo:"mao_de_obra", descricao, perfilId?, modo: hora|minuto|fixo, minutos, valorUnitario}
--   {tipo:"terceiro"|"outro", descricao, quantidade?, unidade?, custoUnitario, fornecedor?, perfilId?}

create or replace function public.lancar_custo(p_os uuid, p_custo jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_tipo text := p_custo ->> 'tipo';
  v_perfil uuid := nullif(p_custo ->> 'perfilId', '')::uuid;
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
  if v_tipo = 'insumo' then
    select * into m from public.material where id = nullif(p_custo ->> 'materialId', '')::uuid and oficina_id = v_of;
    if not found then perform public._erro('material_nao_encontrado'); end if;
    if jsonb_typeof(p_custo -> 'quantidade') <> 'number' then perform public._erro('quantidade_invalida'); end if;
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
    if v_modo not in ('hora', 'minuto', 'fixo') then perform public._erro('tipo_invalido'); end if;
    if v_modo <> 'fixo' then
      if jsonb_typeof(p_custo -> 'minutos') <> 'number' or (p_custo ->> 'minutos')::numeric <= 0 then perform public._erro('minutos_invalidos'); end if;
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
end $$;

-- Remove o custo; insumo volta ao estoque com um movimento NOVO (ajuste "mais" ligado à OS = devolução).
create or replace function public.remover_custo(p_custo uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  c public.custo_os;
  v_num int;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,financeiro}');
  select * into c from public.custo_os where id = p_custo and oficina_id = v_of for update;
  if not found then perform public._erro('custo_nao_encontrado'); end if;
  select o.numero into v_num from public.os o where o.id = c.os_id;
  if c.tipo = 'insumo' and c.material_id is not null then
    perform public._movimentar(c.material_id, 'ajuste', c.quantidade, 'mais', c.custo_unitario, c.os_id, c.perfil_id, null,
                               'Devolução do insumo da OS nº ' || v_num, now());
  end if;
  delete from public.custo_os where id = p_custo;
  update public.os set atualizado_em = now() where id = c.os_id;
  perform public._auditar('remover_custo', 'custo_os', p_custo,
    case when c.tipo = 'insumo'
      then format('Custo removido da OS #%s: %s; %s %s devolvido(s) ao estoque', v_num, c.descricao, trim(trailing '.' from trim(trailing '0' from c.quantidade::text)), coalesce(c.unidade, ''))
      else format('Custo removido da OS #%s: %s, %s', v_num, c.descricao, public._reais(c.total)) end);
  return public._ok(p_custo);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- comissões e folha (dominio/comissoes.ts e folha.ts)

-- Linhas de comissão do mês: etapa CONCLUÍDA no mês (fuso da oficina), com responsável, de OS não cancelada;
-- regra ativa mais específica (tipo+etapa > etapa > tipo); valor 0 anula (linha não sai).
create or replace function public._linhas_comissao(p_oficina uuid, p_mes text)
returns table (perfil_id uuid, os_id uuid, placa text, etapa_id uuid, etapa text, concluida_em timestamptz, valor bigint, regra_id uuid)
language sql stable security definer set search_path = '' as $$
  select e.responsavel_id, o.id, v.placa, e.id, e.nome, e.concluida_em, r.valor, r.id
    from public.etapa_os e
    join public.os o on o.id = e.os_id
    left join public.veiculo v on v.id = o.veiculo_id
    join lateral (
      select r.id, r.valor
        from public.regra_comissao r
       where r.oficina_id = o.oficina_id and r.ativa
         and (nullif(btrim(r.etapa_nome), '') is null or public._chave(r.etapa_nome) = public._chave(e.nome))
         and (r.tipo_reparo_id is null or r.tipo_reparo_id = o.tipo_reparo_id)
       order by (case when nullif(btrim(r.etapa_nome), '') is not null then 2 else 0 end + case when r.tipo_reparo_id is not null then 1 else 0 end) desc,
                r.criado_em
       limit 1
    ) r on true
   where o.oficina_id = p_oficina and o.estado <> 'cancelada' and e.estado = 'concluida'
     and e.responsavel_id is not null and e.concluida_em is not null
     and to_char(e.concluida_em at time zone public._fuso(p_oficina), 'YYYY-MM') = p_mes
     and r.valor > 0
   order by e.concluida_em desc
$$;

-- Para a folha (dono e financeiro): as comissões do mês, linha a linha (LinhaComissao do TS).
create or replace function public.comissoes_do_mes(p_mes text)
returns table (perfil_id uuid, os_id uuid, placa text, etapa_id uuid, etapa text, concluida_em timestamptz, valor bigint, regra_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_of uuid := public.minha_oficina();
begin
  if v_of is null or not public.tem_papel('{dono,financeiro}') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return query select * from public._linhas_comissao(v_of, p_mes);
end $$;

-- Ajuste do mês (vale, desconto negativo, extra positivo) antes de pagar: rascunho sem pago_em. Só o dono.
create or replace function public.salvar_ajuste_folha(p_perfil uuid, p_mes text, p_ajustes bigint, p_obs text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_id uuid;
  v_pago date;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono}');
  if p_mes is null or p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then perform public._erro('data_invalida'); end if;
  if not exists (select 1 from public.perfil p where p.id = p_perfil and p.oficina_id = v_of) then perform public._erro('perfil_inexistente'); end if;
  select f.id, f.pago_em into v_id, v_pago from public.pagamento_folha f where f.perfil_id = p_perfil and f.mes = p_mes for update;
  if v_pago is not null then perform public._erro('ja_pago'); end if;
  if v_id is null then
    insert into public.pagamento_folha (oficina_id, perfil_id, mes, salario, comissoes, ajustes, total, obs)
    values (v_of, p_perfil, p_mes, 0, 0, coalesce(p_ajustes, 0), coalesce(p_ajustes, 0), nullif(btrim(p_obs), ''))
    returning id into v_id;
  else
    update public.pagamento_folha set ajustes = coalesce(p_ajustes, 0), total = coalesce(p_ajustes, 0), obs = nullif(btrim(p_obs), '') where id = v_id;
  end if;
  perform public._auditar('ajuste_folha', 'pagamento_folha', v_id, format('Ajuste da folha %s: %s', p_mes, public._reais(coalesce(p_ajustes, 0))), p_perfil);
  return public._ok(v_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- Marca a folha do mês como paga (pagarLinhaFolha) e lança a despesa paga na categoria de salários ("Salários e
-- pró-labore" do padrão; a primeira categoria de despesa ativa cujo nome começa por "Salário").
-- Salário: o mensal se ativo (inteiro mesmo admitido no meio do mês — provisório); desligado = 0.
-- Ajuste diferente do que o dono salvou: só o dono.
create or replace function public.pagar_folha(p_perfil uuid, p_mes text, p_pago_em text, p_ajustes bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  p public.perfil;
  v_row public.pagamento_folha;
  v_pago date;
  v_sal bigint;
  v_com bigint;
  v_aj bigint;
  v_total bigint;
  v_cat uuid;
  v_cat_nome text;
  v_desp uuid;
  v_id uuid;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,financeiro}');
  if p_mes is null or p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then perform public._erro('data_invalida'); end if;
  v_pago := public._data(p_pago_em);
  select * into p from public.perfil where id = p_perfil and oficina_id = v_of;
  if not found then perform public._erro('perfil_inexistente'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_perfil::text || '|folha|' || p_mes, 0));
  select * into v_row from public.pagamento_folha f where f.perfil_id = p_perfil and f.mes = p_mes for update;
  if v_row.pago_em is not null then perform public._erro('ja_pago'); end if;
  if p_ajustes is not null and p_ajustes <> coalesce(v_row.ajustes, 0) and not public.tem_papel('{dono}') then
    perform public._erro('sem_permissao');
  end if;
  v_aj := coalesce(p_ajustes, v_row.ajustes, 0);
  v_sal := case when p.ativo then coalesce((select s.salario_mensal from public.perfil_salario s where s.perfil_id = p.id), 0) else 0 end;
  select coalesce(sum(l.valor), 0) into v_com from public._linhas_comissao(v_of, p_mes) l where l.perfil_id = p.id;
  v_total := v_sal + v_com + v_aj;
  if v_total < 0 then perform public._erro('total_invalido'); end if;
  if v_total > 0 then
    select c.id, c.nome into v_cat, v_cat_nome from public.categoria_financeira c
     where c.oficina_id = v_of and c.tipo = 'despesa' and c.ativa and public._chave(c.nome) like 'salario%'
     order by c.criado_em limit 1;
    insert into public.despesa (oficina_id, categoria_id, categoria, descricao, valor_previsto, vencimento, pago_em, valor_pago)
    values (v_of, v_cat, coalesce(v_cat_nome, 'Salários e pró-labore'), format('Folha %s/%s · %s', substr(p_mes, 6, 2), substr(p_mes, 1, 4), p.nome), v_total, v_pago, v_pago, v_total)
    returning id into v_desp;
  end if;
  if v_row.id is null then
    insert into public.pagamento_folha (oficina_id, perfil_id, mes, salario, comissoes, ajustes, total, pago_em, despesa_id)
    values (v_of, p.id, p_mes, v_sal, v_com, nullif(v_aj, 0), v_total, v_pago, v_desp)
    returning id into v_id;
  else
    update public.pagamento_folha
       set salario = v_sal, comissoes = v_com, ajustes = nullif(v_aj, 0), total = v_total, pago_em = v_pago, despesa_id = v_desp
     where id = v_row.id;
    v_id := v_row.id;
  end if;
  perform public._auditar('pagar_folha', 'pagamento_folha', v_id,
    format('Folha %s/%s de %s paga: %s', substr(p_mes, 6, 2), substr(p_mes, 1, 4), p.nome, public._reais(v_total)), p.id);
  return public._ok(v_id, jsonb_build_object('despesaId', v_desp));
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;
