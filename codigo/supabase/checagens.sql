-- checagens.sql — confere o banco depois de aplicar migrations + seed (SQL Editor do Supabase ou scripts/testar-local.mjs).
-- Não deixa rastro: tudo que os testes escrevem roda num bloco que termina com ROLLBACK (exceção DDTST).
-- Simula cada papel com usuários de teste temporários: set_config('request.jwt.claims') + set_config('role','authenticated').
-- Resultado: a última consulta lista cada checagem com ok = true/false. Esperado: todas true.
-- Serve no ddoctor-teste (com o exemplo) e no ddoctor oficial (só o padrão): os testes criam os próprios dados.

drop table if exists pg_temp._resultado;
create temp table _resultado (n serial, secao text, teste text, ok boolean, detalhe text);

create or replace function pg_temp.como(p_sub text) returns void language plpgsql as $f$
begin
  if p_sub is null then
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $f$;

-- acrescenta uma checagem à lista (jsonb) que o bloco grava no fim
create or replace function pg_temp.chk(a jsonb, s text, t text, ok boolean, d text default null) returns jsonb language sql as $f$
  select a || jsonb_build_array(jsonb_build_object('s', s, 't', t, 'ok', coalesce(ok, false), 'd', case when coalesce(ok, false) then null else d end))
$f$;

-- confere o resultado de uma função do painel: esperado null = ok; senão o código de erro
create or replace function pg_temp.esp(a jsonb, s text, t text, r jsonb, esperado text default null) returns jsonb language sql as $f$
  select pg_temp.chk(a, s, t,
    case when esperado is null then (r ->> 'ok')::boolean else (r ->> 'ok') = 'false' and (r ->> 'codigo') = esperado end,
    coalesce(r::text, 'null'))
$f$;

-- ---------------------------------------------------------------- 1. estrutura

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'RLS ligada em todas as tabelas de public', bool_and(c.relrowsecurity), string_agg(c.relname, ', ') filter (where not c.relrowsecurity)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r';

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'toda tabela tem ao menos uma política (sem política = ninguém lê)', count(*) = 0, string_agg(c.relname, ', ')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'políticas por tabela (informativo)', true, string_agg(format('%s:%s', tablename, n), ' ')
  from (select tablename, count(*) n from pg_policies where schemaname = 'public' group by tablename order by tablename) x;

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'imutáveis sem UPDATE/DELETE para authenticated e service_role', bool_and(not ok), string_agg(t, ', ') filter (where ok)
  from (select t, has_table_privilege(r, 'public.' || t, 'UPDATE') or has_table_privilege(r, 'public.' || t, 'DELETE') as ok
          from unnest(array['evento_auditoria', 'movimento_estoque', 'baixa', 'fechamento_caixa']) t,
               unnest(array['authenticated', 'service_role']) r) x;

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'anon (sem login) não lê nenhuma tabela nem view', bool_and(not has_table_privilege('anon', c.oid, 'SELECT')),
       string_agg(c.relname, ', ') filter (where has_table_privilege('anon', c.oid, 'SELECT'))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'v');

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'funções internas e definir_primeiro_dono fora da API', bool_and(not has_function_privilege('authenticated', p.oid, 'EXECUTE')),
       string_agg(p.proname, ', ') filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('_auditar', '_baixar', '_movimentar', '_reservar', '_linhas_comissao', 'definir_primeiro_dono');

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'views só leitura: nenhuma view com INSERT/UPDATE/DELETE/TRUNCATE para anon ou authenticated',
       count(*) = 0, string_agg(distinct c.relname, ', ')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace, unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) pr
 where n.nspname = 'public' and c.relkind in ('v', 'm') and has_table_privilege(r, c.oid, pr);

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'authenticated sem TRUNCATE (passa por cima da RLS) em tabela de public', count(*) = 0, string_agg(c.relname, ', ')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'TRUNCATE');

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'anon (sem login) executa só oficina_tem_dono()',
       count(*) filter (where p.proname <> 'oficina_tem_dono') = 0 and count(*) filter (where p.proname = 'oficina_tem_dono') = 1,
       string_agg(p.proname, ', ')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'grants e guardas internas fora da API (_aplicar_permissoes, _guarda_config, _responsavel_valido)',
       bool_and(not has_function_privilege('authenticated', p.oid, 'EXECUTE')),
       string_agg(p.proname, ', ') filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('_aplicar_permissoes', '_guarda_config', '_responsavel_valido');

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'funções security definer com search_path fixo', count(*) = 0, string_agg(p.proname, ', ')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');

insert into _resultado (secao, teste, ok, detalhe)
select 'estrutura', 'bucket "fotos" privado, 2 MB, webp/jpeg', count(*) = 1, null
  from storage.buckets b
 where b.id = 'fotos' and not b.public and b.file_size_limit = 2097152 and b.allowed_mime_types @> array['image/webp', 'image/jpeg'];

insert into _resultado (secao, teste, ok, detalhe)
select 'seed', 'uma oficina com configuração provisória', (select count(*) from public.oficina) = 1
       and exists (select 1 from public.config_oficina c where c.provisorio), null;
insert into _resultado (secao, teste, ok, detalhe)
select 'seed', 'tipos de reparo padrão (Martelinho, Funilaria e pintura, Pintura, SRA, Polimento)', count(*) >= 5, string_agg(nome, ', ')
  from public.tipo_reparo;
insert into _resultado (secao, teste, ok, detalhe)
select 'seed', 'categorias financeiras e pagador "cliente" padrão',
       (select count(*) from public.categoria_financeira) >= 16 and exists (select 1 from public.pagador where tipo = 'cliente'), null;
insert into _resultado (secao, teste, ok, detalhe)
select 'seed', 'calendário: 4 h úteis de sexta 16:00 = sábado 10:00 (expediente padrão provisório)',
       public._somar_horas_uteis('2026-10-23 16:00-03'::timestamptz, 4, c.expediente, 'America/Sao_Paulo') = '2026-10-24 10:00-03'::timestamptz,
       public._somar_horas_uteis('2026-10-23 16:00-03'::timestamptz, 4, c.expediente, 'America/Sao_Paulo')::text
  from public.config_oficina c limit 1;
insert into _resultado (secao, teste, ok, detalhe)
select 'seed', 'calendário: 10 dias úteis desde quarta 21/10/2026 (seg–sáb) = 02/11/2026',
       public._entrega_por_dias_uteis('2026-10-21', 10, c.expediente) = '2026-11-02'::date,
       public._entrega_por_dias_uteis('2026-10-21', 10, c.expediente)::text
  from public.config_oficina c limit 1;

-- ---------------------------------------------------------------- 2. papéis, RLS e funções (tudo desfeito no fim)

do $$
declare
  res jsonb := '[]';
  v_of uuid := (select id from public.oficina order by criado_em limit 1);
  v_exp jsonb := (select expediente from public.config_oficina where oficina_id = (select id from public.oficina order by criado_em limit 1));
  v_fuso text := 'America/Sao_Paulo';
  au jsonb := '{}'; -- papel → auth uid
  pf jsonb := '{}'; -- papel → perfil id
  v_papel text;
  v_uid uuid;
  v_pid uuid;
  r jsonb;
  v_hoje date;
  d1 date;
  d2 date;
  d3 date;
  v_os1 uuid;
  v_os2 uuid;
  v_os3 uuid;
  v_ag uuid;
  v_tipo uuid;
  e1 uuid;
  e2 uuid;
  e3 uuid;
  e4 uuid;
  v_foto uuid;
  v_mat uuid;
  v_custo uuid;
  v_n bigint;
  v_custo_esperado bigint;
  v_t text;
  v_b boolean;
  v_foto2 uuid;
  v_desp uuid;
  v_outra uuid;
  v_outro_perfil uuid;
  v_outra_os uuid;
  v_view text;
  v_op text;
  v_neg int;
  v_cfg public.config_oficina;
begin
  begin
    v_hoje := public._dia(now(), v_fuso);
    d1 := public._proximo_dia_util(v_hoje + 1, v_exp);
    d2 := public._proximo_dia_util(d1 + 1, v_exp);
    d3 := public._proximo_dia_util(d2 + 1, v_exp);

    -- usuários de teste (um por papel; producao2 = colega)
    foreach v_papel in array array['dono', 'gestor', 'gestor2', 'recepcao', 'producao', 'producao2', 'financeiro', 'dispositivo'] loop
      v_uid := gen_random_uuid();
      insert into auth.users (id, email) values (v_uid, 'checagem-' || v_papel || '-' || left(v_uid::text, 8) || '@teste.invalid');
      insert into public.perfil (oficina_id, auth_user_id, nome, papel)
      values (v_of, v_uid, 'Checagem ' || v_papel, case v_papel when 'producao2' then 'producao' when 'gestor2' then 'gestor' else v_papel end)
      returning id into v_pid;
      au := au || jsonb_build_object(v_papel, v_uid);
      pf := pf || jsonb_build_object(v_papel, v_pid);
    end loop;
    select t.id into v_tipo from public.tipo_reparo t where t.oficina_id = v_of and public._chave(t.nome) = 'martelinho';

    -- ------------------------------------------------ abrir atendimento
    perform pg_temp.como(au ->> 'producao');
    r := public.criar_atendimento_rapido('{"placa":"ZZZ9Z98","clienteNome":"X","origem":"particular","pecas":[{"peca":"Capô","tecnica":"martelinho"}]}');
    res := pg_temp.esp(res, 'os', 'produção não abre atendimento (sem_permissao)', r, 'sem_permissao');
    perform pg_temp.como(au ->> 'recepcao');
    r := public.criar_atendimento_rapido('{"placa":"ZZ-9","clienteNome":"X","origem":"particular","pecas":[{"peca":"Capô","tecnica":"martelinho"}]}');
    res := pg_temp.esp(res, 'os', 'placa inválida', r, 'placa_invalida');
    r := public.criar_atendimento_rapido('{"placa":"ZZZ9Z98","clienteNome":"X","origem":"particular","pecas":[]}');
    res := pg_temp.esp(res, 'os', 'sem peças (sem_itens)', r, 'sem_itens');
    r := public.criar_atendimento_rapido('{"placa":"ZZZ9Z98","clienteNome":"X","documento":"111.111.111-11","origem":"particular","pecas":[{"peca":"Capô","tecnica":"martelinho"}]}');
    res := pg_temp.esp(res, 'os', 'CPF inválido', r, 'documento_invalido');
    r := public.criar_atendimento_rapido('{"placa":"zzz9z98","clienteNome":"Cliente Checagem","telefone":"(41) 99999-0000","origem":"particular","pecas":[{"peca":"Capô","tecnica":"martelinho","valor":50000}]}');
    res := pg_temp.esp(res, 'os', 'recepção abre atendimento particular', r);
    v_os1 := (r ->> 'osId')::uuid;
    select c.telefone into v_t from public.cliente c join public.os o on o.cliente_id = c.id where o.id = v_os1;
    res := pg_temp.chk(res, 'os', 'telefone normalizado para E.164', v_t = '+5541999990000', v_t);
    r := public.criar_atendimento_rapido('{"placa":"ZZZ9Z97","clienteNome":"Cliente Dois","origem":"maxpar","seguradora":"Seguradora Checagem","protocolo":"CHK-1","pecas":[{"peca":"Porta","tecnica":"martelinho","valor":30000}]}');
    res := pg_temp.esp(res, 'os', 'recepção abre atendimento Maxpar', r);
    v_os2 := (r ->> 'osId')::uuid;
    r := public.criar_atendimento_rapido('{"placa":"ZZZ9Z96","clienteNome":"Cliente Três","origem":"maxpar","seguradora":"Seguradora Checagem","protocolo":" CHK-1 ","pecas":[{"peca":"Teto","tecnica":"martelinho"}]}');
    res := pg_temp.esp(res, 'os', 'protocolo repetido na mesma seguradora', r, 'protocolo_duplicado');
    res := pg_temp.chk(res, 'os', 'protocolo repetido devolve a OS existente', (r ->> 'osId')::uuid = v_os2, r::text);
    r := public.criar_atendimento_rapido('{"placa":"ZZZ9Z96","clienteNome":"Cliente Três","origem":"particular","pecas":[{"peca":"Teto","tecnica":"sra","valor":10000}]}');
    v_os3 := (r ->> 'osId')::uuid;

    -- ------------------------------------------------ aprovação
    r := public.registrar_aprovacao(v_os1, '  ');
    res := pg_temp.esp(res, 'os', 'aprovação sem evidência', r, 'motivo_obrigatorio');
    r := public.registrar_aprovacao(v_os1, 'Aprovado no balcão');
    res := pg_temp.esp(res, 'os', 'aprovação registrada', r);
    r := public.registrar_aprovacao(v_os1, 'de novo');
    res := pg_temp.esp(res, 'os', 'aprovar duas vezes', r, 'transicao_invalida');
    perform public.registrar_aprovacao(v_os2, 'Autorização vista no portal');
    perform public.registrar_aprovacao(v_os3, 'Aprovado');

    -- ------------------------------------------------ agenda (capacidade atômica)
    insert into public.capacidade_dia (data, vagas_entrada) values (d1, 1)
      on conflict (oficina_id, data) do update set vagas_entrada = 1, bloqueado = null;
    insert into public.capacidade_dia (data, vagas_entrada, bloqueado) values (d2, 3, 'Feriado (checagem)')
      on conflict (oficina_id, data) do update set bloqueado = 'Feriado (checagem)';
    delete from public.capacidade_dia where data = d3;
    r := public.agendar(v_os1, v_hoje - 1, 'manha');
    res := pg_temp.esp(res, 'agenda', 'data passada', r, 'data_passada');
    r := public.agendar(v_os1, d2, 'manha');
    res := pg_temp.esp(res, 'agenda', 'dia bloqueado', r, 'dia_bloqueado');
    -- outros agendamentos já existentes no dia contam (seed de exemplo): reservar a última vaga é o que importa
    perform pg_temp.como(null);
    select public._vagas_ocupadas(v_of, d1, null) into v_n;
    update public.capacidade_dia set vagas_entrada = v_n + 1 where oficina_id = v_of and data = d1;
    perform pg_temp.como(au ->> 'recepcao');
    r := public.agendar(v_os1, d1, 'manha');
    res := pg_temp.esp(res, 'agenda', 'agendar na última vaga do dia', r);
    v_ag := (r ->> 'id')::uuid;
    r := public.agendar(v_os2, d1, 'tarde');
    res := pg_temp.esp(res, 'agenda', 'segunda reserva na mesma última vaga (sem_vaga)', r, 'sem_vaga');
    r := public.agendar(v_os2, d1, 'tarde', true);
    res := pg_temp.esp(res, 'agenda', 'encaixe confirmado passa da capacidade', r);
    select a.encaixe into v_b from public.agendamento a where a.id = (r ->> 'id')::uuid;
    res := pg_temp.chk(res, 'agenda', 'agendamento marcado como encaixe', v_b, v_b::text);
    r := public.marcar_nao_compareceu((r ->> 'id')::uuid);
    res := pg_temp.esp(res, 'agenda', 'cliente não compareceu', r);
    select estado into v_t from public.os where id = v_os2;
    res := pg_temp.chk(res, 'agenda', 'não compareceu devolve a OS para a fila', v_t = 'aguardando_agendamento', v_t);
    r := public.reagendar(v_ag, d3, 'manha');
    res := pg_temp.esp(res, 'agenda', 'reagendar (novo registro, anterior cancelado)', r);
    select count(*) into v_n from public.agendamento a where a.id = v_ag and a.estado = 'cancelado';
    res := pg_temp.chk(res, 'agenda', 'reagendar cancela o anterior', v_n = 1, v_n::text);
    select count(*) into v_n from public.agendamento a where a.id = (r ->> 'id')::uuid and a.substitui_id = v_ag and a.estado = 'confirmado';
    res := pg_temp.chk(res, 'agenda', 'novo agendamento aponta o anterior (substitui_id)', v_n = 1, v_n::text);
    v_ag := (r ->> 'id')::uuid;
    r := public.cancelar_agendamento(v_ag, '');
    res := pg_temp.esp(res, 'agenda', 'cancelar sem motivo', r, 'motivo_obrigatorio');
    perform pg_temp.como(au ->> 'financeiro');
    select count(*) into v_n from public.agendamento;
    res := pg_temp.chk(res, 'rls', 'financeiro não lê a agenda', v_n = 0, v_n::text);
    perform pg_temp.como(au ->> 'recepcao');

    -- ------------------------------------------------ entrada real
    r := public.registrar_entrada(v_os1, gen_random_uuid());
    res := pg_temp.esp(res, 'os', 'entrada sem tipo de reparo válido', r, 'sem_tipo_reparo');
    r := public.registrar_entrada(v_os1, v_tipo, '{"km":-5,"checklist":{},"avarias":[]}');
    res := pg_temp.esp(res, 'os', 'recepção com km negativo', r, 'km_invalido');
    r := public.registrar_entrada(v_os1, v_tipo, '{"km":12345,"combustivel":"1/2","checklist":{"estepe":true},"avarias":[{"vista":"frente","x":0.5,"y":0.4,"tipo":"amassado","tamanho":"m"}],"registradaEm":"2000-01-01T00:00:00-03:00"}');
    res := pg_temp.esp(res, 'os', 'entrada do carro (gera etapas)', r);
    select count(*), min(estado) filter (where ordem = 1) into v_n, v_t from public.etapa_os where os_id = v_os1;
    res := pg_temp.chk(res, 'os', 'etapas geradas do modelo, a 1ª na fila', v_n = 4 and v_t = 'na_fila', format('%s etapas, 1ª %s', v_n, v_t));
    select (recepcao ->> 'registradaEm') <> '2000-01-01T00:00:00-03:00' and recepcao ? 'registradaPor' and previsao_entrega is not null
      into v_b from public.os where id = v_os1;
    res := pg_temp.chk(res, 'os', 'recepção carimbada no servidor e previsão sugerida', v_b, null);
    select estado into v_t from public.agendamento where id = v_ag;
    res := pg_temp.chk(res, 'os', 'agendamento confirmado vira realizado na entrada', v_t = 'realizado', v_t);
    r := public.registrar_entrada(v_os1, v_tipo);
    res := pg_temp.esp(res, 'os', 'entrada duas vezes', r, 'transicao_invalida');
    select id into e1 from public.etapa_os where os_id = v_os1 and ordem = 1;
    select id into e2 from public.etapa_os where os_id = v_os1 and ordem = 2;
    select id into e3 from public.etapa_os where os_id = v_os1 and ordem = 3;
    select id into e4 from public.etapa_os where os_id = v_os1 and ordem = 4;

    -- ------------------------------------------------ leitura por papel (RLS e views)
    perform pg_temp.como(au ->> 'producao');
    select count(*) into v_n from public.cliente;
    res := pg_temp.chk(res, 'rls', 'produção não lê clientes', v_n = 0, v_n::text);
    select count(*) into v_n from public.os;
    res := pg_temp.chk(res, 'rls', 'produção não lê a tabela os', v_n = 0, v_n::text);
    select count(*) into v_n from public.item_orcamento;
    res := pg_temp.chk(res, 'rls', 'produção não lê valores do orçamento', v_n = 0, v_n::text);
    select count(*) into v_n from public.vw_producao where id = v_os1;
    res := pg_temp.chk(res, 'rls', 'produção vê o carro no quadro (vw_producao)', v_n = 1, v_n::text);
    select bool_and(not (x ? 'valor')) into v_b from public.vw_producao p, jsonb_array_elements(p.pecas) x where p.id = v_os1;
    res := pg_temp.chk(res, 'rls', 'vw_producao sem valor das peças', v_b, null);
    select count(*) into v_n from public.vw_equipe where salario_mensal is not null or telefone is not null;
    res := pg_temp.chk(res, 'rls', 'produção vê a equipe sem salário nem telefone', v_n = 0, v_n::text);
    perform pg_temp.como(au ->> 'dispositivo');
    select count(*) into v_n from public.vw_producao where id = v_os1;
    res := pg_temp.chk(res, 'rls', 'TV vê o quadro', v_n = 1, v_n::text);
    select (select count(*) from public.cliente) + (select count(*) from public.etapa_os) + (select count(*) from public.foto) into v_n;
    res := pg_temp.chk(res, 'rls', 'TV não lê tabelas (cliente, etapa, foto)', v_n = 0, v_n::text);
    perform pg_temp.como(au ->> 'gestor');
    select count(*) into v_n from public.cliente;
    res := pg_temp.chk(res, 'rls', 'gerente lê clientes', v_n > 0, v_n::text);
    select (select count(*) from public.titulo_receber) + (select count(*) from public.despesa) + (select count(*) from public.custo_os)
         + (select count(*) from public.perfil_salario) + (select count(*) from public.fechamento_caixa) + (select count(*) from public.material)
      into v_n;
    res := pg_temp.chk(res, 'rls', 'gerente não lê financeiro (títulos, despesas, custos, salários, caixa, custo de material)', v_n = 0, v_n::text);
    perform pg_temp.como(au ->> 'recepcao');
    select (select count(*) from public.despesa) + (select count(*) from public.fechamento_caixa) + (select count(*) from public.custo_os)
         + (select count(*) from public.pagamento_folha) into v_n;
    res := pg_temp.chk(res, 'rls', 'recepção não lê despesas, caixa, custos nem folha', v_n = 0, v_n::text);
    perform pg_temp.como(null);
    begin
      perform set_config('role', 'anon', true);
      select count(*) into v_n from public.cliente;
      res := pg_temp.chk(res, 'rls', 'anon barrado em cliente', false, 'leu ' || v_n);
    exception when insufficient_privilege then
      res := pg_temp.chk(res, 'rls', 'anon barrado em cliente', true);
    end;
    perform pg_temp.como(null);

    -- ------------------------------------------------ produção: etapas
    perform pg_temp.como(au ->> 'gestor');
    r := public.iniciar_etapa(e1, (pf ->> 'recepcao')::uuid);
    res := pg_temp.esp(res, 'segurança', 'iniciar etapa com responsável da recepção', r, 'sem_responsavel');
    perform pg_temp.como(au ->> 'producao2');
    r := public.iniciar_etapa(e1, (pf ->> 'producao')::uuid);
    res := pg_temp.esp(res, 'producao', 'produção não inicia para outra pessoa', r, 'nao_responsavel');
    perform pg_temp.como(au ->> 'producao');
    r := public.iniciar_etapa(e2, (pf ->> 'producao')::uuid);
    res := pg_temp.esp(res, 'producao', 'iniciar etapa que não está na fila', r, 'transicao_invalida');
    r := public.iniciar_etapa(e1, (pf ->> 'producao')::uuid);
    res := pg_temp.esp(res, 'producao', 'produção inicia a própria etapa', r);
    perform pg_temp.como(au ->> 'producao2');
    r := public.concluir_etapa(e1);
    res := pg_temp.esp(res, 'producao', 'colega não conclui etapa alheia', r, 'nao_responsavel');
    perform pg_temp.como(au ->> 'producao');
    r := public.bloquear_etapa(e1, ' ');
    res := pg_temp.esp(res, 'producao', 'impedimento sem motivo', r, 'motivo_obrigatorio');
    r := public.bloquear_etapa(e1, 'Falta peça (checagem)');
    res := pg_temp.esp(res, 'producao', 'impedimento registrado', r);
    r := public.concluir_etapa(e1);
    res := pg_temp.esp(res, 'producao', 'concluir etapa parada', r, 'transicao_invalida');
    r := public.retomar_etapa(e1);
    res := pg_temp.esp(res, 'producao', 'retomar', r);
    perform pg_temp.como(null);
    select count(*) into v_n from public.bloqueio_etapa where etapa_id = e1 and fim_em is not null;
    res := pg_temp.chk(res, 'producao', 'retomar fecha o bloqueio', v_n = 1, v_n::text);
    perform pg_temp.como(au ->> 'producao');
    r := public.concluir_etapa(e1);
    res := pg_temp.esp(res, 'producao', 'concluir etapa sem foto exigida', r);
    select e ->> 'estado' into v_t from public.vw_producao p, jsonb_array_elements(p.etapas) e where p.id = v_os1 and (e ->> 'id')::uuid = e2;
    res := pg_temp.chk(res, 'producao', 'concluir libera a próxima (na_fila; lida pela vw_producao)', v_t = 'na_fila', v_t);
    r := public.iniciar_etapa(e2, (pf ->> 'producao')::uuid);
    r := public.concluir_etapa(e2, 2);
    res := pg_temp.esp(res, 'producao', 'etapa que exige foto, sem foto', r, 'foto_obrigatoria');
    -- foto: sobe o arquivo (política do Storage) e registra
    v_foto := gen_random_uuid();
    insert into storage.objects (bucket_id, name, owner) values ('fotos', v_of || '/' || v_os1 || '/' || v_foto || '.webp', (au ->> 'producao')::uuid);
    r := public.adicionar_foto(v_os1, jsonb_build_object('id', v_foto, 'fase', 'entrada', 'etapaId', e2, 'caminho', v_of || '/' || v_os1 || '/' || v_foto || '.webp'));
    res := pg_temp.esp(res, 'fotos', 'foto de etapa na fase entrada', r, 'fase_invalida');
    r := public.adicionar_foto(v_os1, jsonb_build_object('id', v_foto, 'fase', 'durante', 'caminho', v_of || '/outra/' || v_foto || '.webp'));
    res := pg_temp.esp(res, 'fotos', 'caminho fora da OS', r, 'arquivo_invalido');
    r := public.adicionar_foto(v_os1, jsonb_build_object('id', v_foto, 'fase', 'durante', 'legenda', 'Capô', 'caminho', v_of || '/' || v_os1 || '/' || v_foto || '.webp', 'bytes', 180000, 'largura', 1600, 'altura', 1200));
    res := pg_temp.esp(res, 'fotos', 'produção adiciona foto (Storage + registro)', r);
    select count(*) into v_n from public.foto where id = v_foto;
    res := pg_temp.chk(res, 'segurança', 'fotos: produção com etapa aberta na OS vê a foto (tabela)', v_n = 1, v_n::text);
    select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name = v_of || '/' || v_os1 || '/' || v_foto || '.webp';
    res := pg_temp.chk(res, 'segurança', 'fotos: produção com etapa aberta na OS lê o arquivo', v_n = 1, v_n::text);
    perform pg_temp.como(au ->> 'producao2');
    select (select count(*) from public.foto where os_id = v_os1)
         + (select count(*) from storage.objects where bucket_id = 'fotos' and name like v_of || '/' || v_os1 || '/%') into v_n;
    res := pg_temp.chk(res, 'segurança', 'fotos: colega sem etapa aberta na OS não vê foto nem arquivo', v_n = 0, v_n::text);
    -- foto da vistoria (externa) na mesma OS
    perform pg_temp.como(null);
    v_foto2 := gen_random_uuid();
    insert into storage.objects (bucket_id, name) values ('fotos', v_of || '/' || v_os1 || '/' || v_foto2 || '.webp');
    insert into public.foto (id, oficina_id, os_id, fase, caminho, origem)
    values (v_foto2, v_of, v_os1, 'externa', v_of || '/' || v_os1 || '/' || v_foto2 || '.webp', 'maxpar');
    perform pg_temp.como(au ->> 'producao');
    select count(*) into v_n from public.foto where id = v_foto2;
    res := pg_temp.chk(res, 'segurança', 'fotos: produção nunca vê a foto da vistoria (externa) — tabela', v_n = 0, v_n::text);
    select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name = v_of || '/' || v_os1 || '/' || v_foto2 || '.webp';
    res := pg_temp.chk(res, 'segurança', 'fotos: produção nunca lê o arquivo da vistoria (externa)', v_n = 0, v_n::text);
    perform pg_temp.como(au ->> 'recepcao');
    select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name = v_of || '/' || v_os1 || '/' || v_foto2 || '.webp';
    res := pg_temp.chk(res, 'segurança', 'fotos: recepção lê o arquivo da vistoria', v_n = 1, v_n::text);
    perform pg_temp.como(null);
    delete from public.foto where id = v_foto2;
    -- (o arquivo de teste some no rollback do fim; o Supabase não deixa apagar de storage.objects direto)
    perform pg_temp.como(au ->> 'producao');
    r := public.concluir_etapa(e2, null, array[v_foto]);
    res := pg_temp.esp(res, 'producao', 'etapa com contagem, sem contagem', r, 'contagem_obrigatoria');
    r := public.concluir_etapa(e2, 1, array[v_foto]);
    res := pg_temp.esp(res, 'producao', 'concluir com foto e contagem', r);
    select count(*) into v_n from public.foto where id = v_foto;
    res := pg_temp.chk(res, 'segurança', 'fotos: sem etapa aberta na OS, a produção deixa de ver a foto (tabela)', v_n = 0, v_n::text);
    select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name like v_of || '/' || v_os1 || '/%';
    res := pg_temp.chk(res, 'segurança', 'fotos: sem etapa aberta na OS, a produção deixa de ver o arquivo', v_n = 0, v_n::text);
    perform pg_temp.como(null);
    select etapa_id into v_pid from public.foto where id = v_foto;
    perform pg_temp.como(au ->> 'producao');
    res := pg_temp.chk(res, 'fotos', 'foto indicada passa a comprovar a etapa', v_pid = e2, v_pid::text);
    r := public.remover_foto(v_foto);
    res := pg_temp.esp(res, 'fotos', 'única foto de etapa concluída não sai', r, 'foto_em_uso');
    perform pg_temp.como(au ->> 'dispositivo');
    select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name like v_of || '/' || v_os1 || '/%';
    res := pg_temp.chk(res, 'fotos', 'TV não lê arquivos de foto', v_n = 0, v_n::text);
    perform pg_temp.como(au ->> 'financeiro');
    select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name = v_of || '/' || v_os1 || '/' || v_foto || '.webp';
    res := pg_temp.chk(res, 'fotos', 'financeiro lê arquivos de foto', v_n = 1, v_n::text);
    perform pg_temp.como(au ->> 'producao');
    r := public.dispensar_etapa(e3, 'não precisou');
    res := pg_temp.esp(res, 'producao', 'produção não dispensa etapa', r, 'sem_permissao');
    perform pg_temp.como(au ->> 'gestor');
    r := public.dispensar_etapa(e3, '');
    res := pg_temp.esp(res, 'producao', 'dispensar sem motivo', r, 'motivo_obrigatorio');
    r := public.dispensar_etapa(e3, 'Não precisou polir (checagem)');
    res := pg_temp.esp(res, 'producao', 'gerente dispensa etapa', r);
    r := public.atribuir_responsavel(e4, (pf ->> 'dispositivo')::uuid);
    res := pg_temp.esp(res, 'segurança', 'atribuir etapa à TV (dispositivo)', r, 'sem_responsavel');
    r := public.atribuir_responsavel(e4, (pf ->> 'financeiro')::uuid);
    res := pg_temp.esp(res, 'segurança', 'atribuir etapa ao financeiro', r, 'sem_responsavel');
    r := public.atribuir_responsavel(e4, (pf ->> 'producao2')::uuid);
    res := pg_temp.esp(res, 'producao', 'gerente atribui responsável', r);
    r := public.dispensar_etapa(e4, 'Revisão feita junto (checagem)');
    select estado into v_t from public.os where id = v_os1;
    res := pg_temp.chk(res, 'producao', 'sem etapa aberta a OS fica pronta', v_t = 'pronta', v_t);

    -- auditoria do histórico do funcionário
    select count(*) into v_n from public.evento_auditoria a
     where a.acao = 'concluir_etapa' and a.registro_id = e1 and a.perfil_id = (pf ->> 'producao')::uuid and a.envolvido_id = (pf ->> 'producao')::uuid;
    res := pg_temp.chk(res, 'auditoria', 'concluir_etapa gravada com etapa e perfil', v_n = 1, v_n::text);
    select count(*) into v_n from public.evento_auditoria a
     where a.registro_id = e1 and a.acao in ('iniciar_etapa', 'bloquear_etapa', 'retomar_etapa');
    res := pg_temp.chk(res, 'auditoria', 'iniciar/bloquear/retomar gravadas', v_n = 3, v_n::text);
    perform pg_temp.como(au ->> 'dono');
    select resumo into v_t from public.vw_auditoria where entidade_id = e1 and acao = 'concluir_etapa';
    res := pg_temp.chk(res, 'auditoria', 'vw_auditoria traz a frase legível', v_t like 'Etapa "%" concluída (OS #% · ZZZ9Z98)', v_t);
    select count(*) into v_n from public.vw_auditoria where entidade_id = e1 and acao = 'editar';
    res := pg_temp.chk(res, 'auditoria', 'linhas de trigger da mesma ação ficam escondidas', v_n = 0, v_n::text);
    perform pg_temp.como(au ->> 'gestor');
    select count(*) into v_n from public.evento_auditoria where public._tabela_financeira(tabela);
    res := pg_temp.chk(res, 'auditoria', 'gerente não vê auditoria financeira', v_n = 0, v_n::text);
    perform pg_temp.como(null);
    begin
      update public.evento_auditoria set resumo = 'x' where registro_id = e1;
      res := pg_temp.chk(res, 'auditoria', 'auditoria imutável (nem o dono da tabela altera)', false, 'alterou');
    exception when sqlstate 'DD002' then
      res := pg_temp.chk(res, 'auditoria', 'auditoria imutável (nem o dono da tabela altera)', true);
    end;

    -- ------------------------------------------------ entrega e dinheiro
    perform pg_temp.como(au ->> 'recepcao');
    r := public.registrar_entrega(v_os1);
    res := pg_temp.esp(res, 'os', 'entrega do carro pronto', r);
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 10000, 'forma', 'pix', 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'recepção cobra no balcão (vePagamentosOS)', r);
    select count(*) into v_n from public.titulo_receber where os_id = v_os1;
    res := pg_temp.chk(res, 'rls', 'recepção lê o título da OS', v_n = 1, v_n::text);
    perform pg_temp.como(au ->> 'gestor');
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 10000, 'forma', 'pix', 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'gerente não registra pagamento', r, 'sem_permissao');
    perform pg_temp.como(au ->> 'financeiro');
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 10000, 'forma', 'pix', 'recebidoEm', v_hoje + 1));
    res := pg_temp.esp(res, 'financeiro', 'pagamento com data futura', r, 'data_futura');
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 10000, 'forma', 'cheque', 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'forma de pagamento inválida', r, 'forma_invalida');
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 20000, 'forma', 'pix', 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'segundo pagamento usa o título em aberto', r);
    select valor into v_n from public.titulo_receber where id = (r ->> 'id')::uuid;
    res := pg_temp.chk(res, 'financeiro', 'título nasce com o valor aprovado (R$ 500,00)', v_n = 50000, v_n::text);
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 40000, 'forma', 'pix', 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'pagamento acima do saldo', r, 'baixa_maior_que_saldo');
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 10000, 'forma', 'dinheiro', 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'pagamento em dinheiro', r);
    r := public.fechar_caixa(jsonb_build_object('data', v_hoje + 1, 'contado', 0));
    res := pg_temp.esp(res, 'financeiro', 'fechar caixa de amanhã', r, 'data_futura');
    r := public.fechar_caixa(jsonb_build_object('data', v_hoje, 'contado', 999999));
    res := pg_temp.esp(res, 'financeiro', 'fechar o caixa de hoje', r);
    r := public.fechar_caixa(jsonb_build_object('data', v_hoje, 'contado', 0));
    res := pg_temp.esp(res, 'financeiro', 'fechar o mesmo dia duas vezes', r, 'caixa_ja_fechado');
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 1000, 'forma', 'dinheiro', 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'dinheiro em dia de caixa fechado', r, 'caixa_ja_fechado');
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 10000, 'forma', 'credito', 'parcelas', 2, 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'quita o resto no crédito em 2x', r);
    r := public.registrar_pagamento_os(v_os1, jsonb_build_object('valor', 1000, 'forma', 'pix', 'recebidoEm', v_hoje));
    res := pg_temp.esp(res, 'financeiro', 'OS já quitada', r, 'os_quitada');
    begin
      update public.baixa set valor = 1 where titulo_id = (select id from public.titulo_receber where os_id = v_os1 limit 1);
      res := pg_temp.chk(res, 'financeiro', 'baixa imutável pela API', false, 'alterou');
    exception when insufficient_privilege then
      res := pg_temp.chk(res, 'financeiro', 'baixa imutável pela API', true);
    end;
    r := public.criar_despesa(jsonb_build_object('descricao', 'Despesa checagem', 'categoria', 'Outras despesas', 'valorPrevisto', 1500, 'vencimento', v_hoje, 'pagoEm', v_hoje, 'formaPagamento', 'dinheiro'));
    res := pg_temp.esp(res, 'financeiro', 'despesa paga em dinheiro em dia fechado', r, 'caixa_ja_fechado');
    r := public.criar_despesa(jsonb_build_object('descricao', 'Despesa checagem', 'categoria', 'Outras despesas', 'valorPrevisto', 1500, 'vencimento', '2026-02-30'));
    res := pg_temp.esp(res, 'financeiro', 'vencimento que não existe', r, 'data_invalida');
    r := public.criar_despesa(jsonb_build_object('descricao', 'Despesa checagem', 'categoria', 'Outras despesas', 'valorPrevisto', 1500, 'vencimento', v_hoje + 10));
    res := pg_temp.esp(res, 'financeiro', 'despesa a pagar', r);
    v_desp := (r ->> 'id')::uuid;
    r := public.pagar_despesa(v_desp, 1500, (v_hoje - 0)::text, 'pix');
    res := pg_temp.esp(res, 'financeiro', 'pagar despesa', r);
    r := public.pagar_despesa(v_desp, 1500, (v_hoje - 0)::text, 'pix');
    res := pg_temp.esp(res, 'segurança', 'pagar de novo despesa já paga', r, 'ja_pago');

    -- ------------------------------------------------ estoque e custos
    perform pg_temp.como(au ->> 'gestor');
    r := public.salvar_material('{"nome":"Material checagem","unidade":"L","categoria":"Teste","saldoMinimo":1,"saldoEstimado":2,"custoMedio":1000}');
    res := pg_temp.esp(res, 'estoque', 'gerente cadastra material com saldo inicial', r);
    v_mat := (r ->> 'id')::uuid;
    select custo_medio is null and saldo_estimado = 2 into v_b from public.vw_material where id = v_mat;
    res := pg_temp.chk(res, 'estoque', 'gerente vê saldo sem custo médio (vw_material)', v_b, null);
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'entrada_compra', 'quantidade', 2));
    res := pg_temp.esp(res, 'estoque', 'compra sem custo unitário', r, 'custo_obrigatorio');
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'entrada_compra', 'quantidade', 2, 'custoUnitario', 2000));
    res := pg_temp.esp(res, 'estoque', 'compra', r);
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'ajuste', 'quantidade', 1));
    res := pg_temp.esp(res, 'estoque', 'ajuste sem sentido', r, 'sentido_obrigatorio');
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'saida_os', 'quantidade', 1));
    res := pg_temp.esp(res, 'estoque', 'retirada para OS só pelo custo', r, 'tipo_invalido');
    r := public.lancar_custo(v_os1, jsonb_build_object('tipo', 'insumo', 'materialId', v_mat, 'quantidade', 1));
    res := pg_temp.esp(res, 'estoque', 'gerente não lança custo na OS', r, 'sem_permissao');
    begin
      update public.material set saldo_estimado = 99 where id = v_mat;
      select saldo_estimado into v_t from public.vw_material where id = v_mat;
      res := pg_temp.chk(res, 'estoque', 'saldo não muda por UPDATE direto', v_t::numeric = 4, v_t);
    exception when sqlstate 'DD001' or insufficient_privilege then
      res := pg_temp.chk(res, 'estoque', 'saldo não muda por UPDATE direto', true);
    end;
    perform pg_temp.como(au ->> 'financeiro');
    select custo_medio into v_n from public.material where id = v_mat;
    res := pg_temp.chk(res, 'estoque', 'custo médio ponderado (2×10,00 + 2×20,00 = 15,00)', v_n = 1500, v_n::text);
    r := public.lancar_custo(v_os1, jsonb_build_object('tipo', 'insumo', 'materialId', v_mat, 'quantidade', 9));
    res := pg_temp.esp(res, 'custos', 'retirada acima do saldo', r, 'saldo_insuficiente');
    r := public.lancar_custo(v_os1, jsonb_build_object('tipo', 'insumo', 'materialId', v_mat, 'quantidade', 1.5, 'perfilId', pf ->> 'producao'));
    res := pg_temp.esp(res, 'custos', 'retirada de insumo para a OS', r);
    v_custo := (r ->> 'id')::uuid;
    select total into v_n from public.custo_os where id = v_custo;
    res := pg_temp.chk(res, 'custos', 'total do insumo = 1,5 × 15,00', v_n = 2250, v_n::text);
    r := public.lancar_custo(v_os1, '{"tipo":"mao_de_obra","descricao":"Mão de obra","modo":"hora","minutos":90,"valorUnitario":2800}');
    res := pg_temp.esp(res, 'custos', 'mão de obra por hora', r);
    select total into v_n from public.custo_os where id = (r ->> 'id')::uuid;
    res := pg_temp.chk(res, 'custos', 'mão de obra 90 min × R$ 28/h = R$ 42,00', v_n = 4200, v_n::text);
    r := public.lancar_custo(v_os1, '{"tipo":"terceiro","descricao":" ","custoUnitario":100}');
    res := pg_temp.esp(res, 'custos', 'terceiro sem descrição', r, 'descricao_obrigatoria');
    r := public.remover_custo(v_custo);
    res := pg_temp.esp(res, 'custos', 'remover insumo devolve ao estoque', r);
    select saldo_estimado into v_t from public.material where id = v_mat;
    res := pg_temp.chk(res, 'custos', 'saldo voltou a 4', v_t::numeric = 4, v_t);

    -- ------------------------------------------------ equipe, comissões e folha
    perform pg_temp.como(au ->> 'gestor');
    r := public.salvar_funcionario('{"nome":"Novo financeiro","papel":"financeiro"}');
    res := pg_temp.esp(res, 'equipe', 'gerente não cria financeiro', r, 'sem_permissao');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'producao', 'nome', 'Checagem producao', 'papel', 'gestor'));
    res := pg_temp.esp(res, 'equipe', 'gerente não troca permissão', r, 'sem_permissao');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'producao', 'nome', 'Checagem producao', 'papel', 'producao', 'salarioMensal', 100));
    res := pg_temp.esp(res, 'equipe', 'gerente não mexe em salário', r, 'sem_permissao');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'producao', 'nome', 'Checagem Produção', 'papel', 'producao', 'funcao', 'Pintor', 'telefone', '+5541988887777'));
    res := pg_temp.esp(res, 'equipe', 'gerente edita nome, função e telefone', r);
    begin
      insert into public.regra_comissao (etapa_nome, valor) values ('Desmontagem', 1);
      res := pg_temp.chk(res, 'equipe', 'gerente não cria comissão', false, 'criou');
    exception when insufficient_privilege then
      res := pg_temp.chk(res, 'equipe', 'gerente não cria comissão', true);
    end;
    perform pg_temp.como(au ->> 'dono');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'producao', 'nome', 'Checagem Produção', 'papel', 'producao', 'salarioMensal', 300000, 'usuario', 'checagem.prod'));
    res := pg_temp.esp(res, 'equipe', 'dono define salário', r);
    r := public.salvar_funcionario('{"nome":"Checagem sem login","papel":"producao","usuario":"checagem.sl"}');
    res := pg_temp.esp(res, 'equipe', 'dono cadastra funcionário sem login', r);
    r := public.salvar_funcionario('{"nome":"Checagem sem login 2","papel":"producao","usuario":"checagem.sl"}');
    res := pg_temp.esp(res, 'equipe', 'usuário repetido', r, 'usuario_em_uso');
    insert into public.regra_comissao (etapa_nome, valor) values ('Desmontagem', 4000);
    insert into public.regra_comissao (etapa_nome, tipo_reparo_id, valor) values ('Desmontagem', v_tipo, 4500);
    perform pg_temp.como(au ->> 'gestor');
    select count(*) filter (where valor is not null) into v_n from public.vw_regra_comissao;
    res := pg_temp.chk(res, 'equipe', 'gerente vê as comissões sem R$', v_n = 0, v_n::text);
    select count(*) into v_n from public.vw_equipe where salario_mensal is not null;
    res := pg_temp.chk(res, 'equipe', 'gerente vê a equipe sem salário', v_n = 0, v_n::text);
    r := public.pagar_folha((pf ->> 'producao')::uuid, to_char(v_hoje, 'YYYY-MM'), v_hoje::text);
    res := pg_temp.esp(res, 'folha', 'gerente não paga folha', r, 'sem_permissao');
    perform pg_temp.como(au ->> 'financeiro');
    select count(*) into v_n from public.vw_equipe where id = (pf ->> 'producao')::uuid and salario_mensal = 300000;
    res := pg_temp.chk(res, 'folha', 'financeiro vê o salário', v_n = 1, v_n::text);
    select coalesce(sum(valor), 0) into v_n from public.comissoes_do_mes(to_char(v_hoje, 'YYYY-MM')) where etapa_id = e1;
    res := pg_temp.chk(res, 'folha', 'comissão: regra tipo+etapa vence a só-etapa (R$ 45,00)', v_n = 4500, v_n::text);
    select 300000 + coalesce(sum(valor), 0) into v_custo_esperado from public.comissoes_do_mes(to_char(v_hoje, 'YYYY-MM')) where perfil_id = (pf ->> 'producao')::uuid;
    r := public.pagar_folha((pf ->> 'producao')::uuid, to_char(v_hoje, 'YYYY-MM'), v_hoje::text, -100);
    res := pg_temp.esp(res, 'folha', 'financeiro não muda o ajuste do dono', r, 'sem_permissao');
    r := public.pagar_folha((pf ->> 'producao')::uuid, to_char(v_hoje, 'YYYY-MM'), v_hoje::text);
    res := pg_temp.esp(res, 'folha', 'financeiro paga a folha (vira despesa Salários)', r);
    v_desp := (r ->> 'despesaId')::uuid;
    select d.valor_pago, d.categoria into v_n, v_t from public.despesa d where d.id = (r ->> 'despesaId')::uuid;
    res := pg_temp.chk(res, 'folha', 'despesa = salário + comissões do mês, em "Salários e pró-labore"', v_n = v_custo_esperado and v_t = 'Salários e pró-labore',
                       format('%s (esperado %s) %s', v_n, v_custo_esperado, v_t));
    r := public.pagar_folha((pf ->> 'producao')::uuid, to_char(v_hoje, 'YYYY-MM'), v_hoje::text);
    res := pg_temp.esp(res, 'folha', 'pagar duas vezes', r, 'ja_pago');
    r := public.pagar_despesa(v_desp, 1, v_hoje::text, 'pix');
    res := pg_temp.esp(res, 'segurança', 'pagar de novo a despesa da folha', r, 'ja_pago');

    -- o último dono ativo não sai (validarMudancaPapel)
    perform pg_temp.como(null);
    update public.perfil set ativo = false where oficina_id = v_of and papel = 'dono' and id <> (pf ->> 'dono')::uuid;
    perform pg_temp.como(au ->> 'dono');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'dono', 'nome', 'Checagem dono', 'papel', 'gestor'));
    res := pg_temp.esp(res, 'equipe', 'o último dono não vira gerente', r, 'ultimo_dono');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'dono', 'nome', 'Checagem dono', 'papel', 'dono', 'ativo', false));
    res := pg_temp.esp(res, 'equipe', 'o último dono não é desativado', r, 'ultimo_dono');

    -- ------------------------------------------------ tipos de reparo
    perform pg_temp.como(au ->> 'recepcao');
    r := public.salvar_tipo_reparo('{"nome":"  martelinho ","etapas":[{"ordem":1,"nome":"X","prazoPadraoHoras":1}]}');
    res := pg_temp.esp(res, 'tipos', 'nome repetido (sem acento/caixa)', r, 'nome_duplicado');
    r := public.salvar_tipo_reparo('{"nome":"Checagem","etapas":[{"ordem":1,"nome":"A","prazoPadraoHoras":1},{"ordem":3,"nome":"B","prazoPadraoHoras":1}]}');
    res := pg_temp.esp(res, 'tipos', 'ordem com buraco', r, 'ordem_invalida');
    r := public.salvar_tipo_reparo('{"nome":"Checagem","etapas":[{"ordem":1,"nome":"A","prazoPadraoHoras":0}]}');
    res := pg_temp.esp(res, 'tipos', 'prazo zero', r, 'prazo_invalido');
    r := public.salvar_tipo_reparo('{"nome":"Checagem","etapas":[{"ordem":1,"nome":"Lavar","prazoPadraoHoras":1.5,"exigeFoto":true}]}');
    res := pg_temp.esp(res, 'tipos', 'recepção cria tipo de reparo', r);
    perform public.criar_atendimento_rapido('{"placa":"ZZZ9Z95","clienteNome":"Cliente Quatro","origem":"particular","pecas":[{"peca":"Para-choque","tecnica":"sra","valor":1000}]}');
    v_os2 := (select o.id from public.os o join public.veiculo v on v.id = o.veiculo_id where v.placa = 'ZZZ9Z95');
    perform public.registrar_aprovacao(v_os2, 'ok');
    r := public.registrar_entrada(v_os2, (r ->> 'id')::uuid);
    res := pg_temp.esp(res, 'tipos', 'entrada com o tipo novo', r);
    select tipo_reparo_id into v_pid from public.os where id = v_os2;
    r := public.arquivar_tipo_reparo(v_pid, true);
    res := pg_temp.esp(res, 'tipos', 'não arquiva tipo com carro em aberto', r, 'tipo_em_uso');

    -- ------------------------------------------------ alerta do carro
    r := public.salvar_alerta_os(v_os2, '{"prazoDiasUteis":61}');
    res := pg_temp.esp(res, 'alerta', 'prazo acima de 60', r, 'valor_invalido');
    res := pg_temp.chk(res, 'alerta', 'erro traz o campo', r ->> 'campo' = 'prazoDiasUteis', r::text);
    r := public.salvar_alerta_os(v_os2, '{}');
    res := pg_temp.esp(res, 'alerta', 'nada a salvar', r, 'nada_a_salvar');
    r := public.salvar_alerta_os(v_os2, '{"prazoDiasUteis":10,"laranjaDiasAntes":3,"urgente":true}');
    res := pg_temp.esp(res, 'alerta', 'prazo de 10 dias úteis e urgente', r);
    select prioridade = 2 and previsao_entrega = public._entrega_por_dias_uteis(public._dia(entrada_real_em, v_fuso), 10, v_exp) and alerta ->> 'laranjaDiasAntes' = '3'
      into v_b from public.os where id = v_os2;
    res := pg_temp.chk(res, 'alerta', 'entrega recalculada, prioridade 2', v_b, null);
    r := public.salvar_alerta_os(v_os2, '{"prazoDiasUteis":null,"laranjaDiasAntes":null}');
    select alerta is null into v_b from public.os where id = v_os2;
    res := pg_temp.chk(res, 'alerta', 'null volta para a base', v_b, null);

    -- ------------------------------------------------ segurança (revisão do S1, migration 0015)

    -- views só leitura: gerente e financeiro tentam insert/update/delete em cada view
    foreach v_papel in array array['gestor', 'financeiro'] loop
      perform pg_temp.como(au ->> v_papel);
      for v_view in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relkind = 'v' order by c.relname loop
        v_neg := 0;
        foreach v_op in array array[
          format('insert into public.%I (id) select gen_random_uuid() where false', v_view),
          format('update public.%I set id = id where false', v_view),
          format('delete from public.%I where false', v_view)] loop
          begin
            execute v_op;
          exception when insufficient_privilege or object_not_in_prerequisite_state or feature_not_supported then
            v_neg := v_neg + 1;
          end;
        end loop;
        res := pg_temp.chk(res, 'segurança', format('%s não grava em %s (insert/update/delete negados)', v_papel, v_view), v_neg = 3,
                           format('%s de 3 negados', v_neg));
      end loop;
    end loop;
    perform pg_temp.como(au ->> 'gestor');
    begin
      update public.vw_material set nome = 'Material alterado pela view' where id = v_mat;
      res := pg_temp.chk(res, 'segurança', 'gerente não altera material pela vw_material', false, 'alterou');
    exception when insufficient_privilege then
      res := pg_temp.chk(res, 'segurança', 'gerente não altera material pela vw_material', true);
    end;
    begin
      update public.vw_regra_comissao set ativa = false, etapa_nome = 'Desligada pela view';
      res := pg_temp.chk(res, 'segurança', 'gerente não desliga comissões pela vw_regra_comissao', false, 'alterou');
    exception when insufficient_privilege then
      res := pg_temp.chk(res, 'segurança', 'gerente não desliga comissões pela vw_regra_comissao', true);
    end;

    -- OS: da API só box, observações e previsão
    perform pg_temp.como(au ->> 'recepcao');
    foreach v_op in array array[
      'origem = ''misto''', 'cliente_id = (select c.id from public.cliente c where c.id <> cliente_id limit 1)',
      'veiculo_id = (select v.id from public.veiculo v where v.id <> veiculo_id limit 1)', 'motivo_cancelamento = ''x''',
      'demo = not demo', 'criado_em = now() - interval ''1 day''', 'criado_por = null'] loop
      begin
        execute format('update public.os set %s where id = %L', v_op, v_os3);
        res := pg_temp.chk(res, 'segurança', format('OS: recepção não muda direto (%s)', split_part(v_op, ' ', 1)), false, 'mudou');
      exception when sqlstate 'DD001' then
        res := pg_temp.chk(res, 'segurança', format('OS: recepção não muda direto (%s)', split_part(v_op, ' ', 1)), true);
      end;
    end loop;
    begin
      update public.os set box = 'Box checagem', observacoes = 'obs checagem', previsao_entrega = v_hoje + 7 where id = v_os3;
      select count(*) into v_n from public.os where id = v_os3 and box = 'Box checagem' and previsao_entrega = v_hoje + 7;
      res := pg_temp.chk(res, 'segurança', 'OS: recepção muda box, observações e previsão', v_n = 1, v_n::text);
    exception when others then
      res := pg_temp.chk(res, 'segurança', 'OS: recepção muda box, observações e previsão', false, sqlerrm);
    end;

    -- equipe: quem não é dono não mexe em dono, gerente nem financeiro
    perform pg_temp.como(au ->> 'gestor');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'gestor2', 'nome', 'Checagem gestor2', 'papel', 'gestor', 'ativo', false));
    res := pg_temp.esp(res, 'segurança', 'gerente não desativa outro gerente', r, 'sem_permissao');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'financeiro', 'nome', 'Checagem financeiro', 'papel', 'financeiro', 'ativo', false));
    res := pg_temp.esp(res, 'segurança', 'gerente não desativa o financeiro', r, 'sem_permissao');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'dono', 'nome', 'Checagem dono', 'papel', 'dono', 'telefone', '+5541900000000'));
    res := pg_temp.esp(res, 'segurança', 'gerente não edita o dono', r, 'sem_permissao');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'gestor', 'nome', 'Checagem gestor renomeado', 'papel', 'gestor'));
    res := pg_temp.esp(res, 'segurança', 'gerente não edita o próprio cadastro de gerente', r, 'sem_permissao');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'producao2', 'nome', 'Checagem producao2', 'papel', 'producao', 'ativo', false));
    res := pg_temp.esp(res, 'segurança', 'gerente desativa funcionário da produção', r);
    perform pg_temp.como(au ->> 'dono');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'gestor2', 'nome', 'Checagem gestor2', 'papel', 'gestor', 'funcao', 'Gerente'));
    res := pg_temp.esp(res, 'segurança', 'dono edita gerente', r);

    -- configuração: banco valida; gerente não confirma o provisório
    perform pg_temp.como(null);
    select * into v_cfg from public.config_oficina where oficina_id = v_of;
    perform pg_temp.como(au ->> 'gestor');
    begin
      update public.config_oficina
         set provisorio = not v_cfg.provisorio, confirmado = '{"expediente":true,"semaforo":true}',
             semaforo = v_cfg.semaforo || '{"laranjaAntesHoras":9}'
       where oficina_id = v_of;
    exception when others then
      res := pg_temp.chk(res, 'segurança', 'config: gerente salva valores', false, sqlerrm);
    end;
    perform pg_temp.como(null);
    select (c.semaforo ->> 'laranjaAntesHoras') = '9' and c.provisorio = v_cfg.provisorio and c.confirmado = v_cfg.confirmado
      into v_b from public.config_oficina c where c.oficina_id = v_of;
    res := pg_temp.chk(res, 'segurança', 'config: gerente salva valores, mas provisorio/confirmado ficam como estavam', v_b, null);
    perform pg_temp.como(au ->> 'dono');
    foreach v_op in array array[
      '{"diasSemana":[],"inicio":"08:00","fim":"18:00"}', '{"diasSemana":[1,2,2],"inicio":"08:00","fim":"18:00"}',
      '{"diasSemana":[1,7],"inicio":"08:00","fim":"18:00"}', '{"diasSemana":[1,2],"inicio":"18:00","fim":"08:00"}',
      '{"diasSemana":[1,2],"inicio":"8h","fim":"18:00"}', '{"diasSemana":[1,6],"inicio":"08:00","fim":"18:00","sabadoFim":"07:00"}'] loop
      begin
        update public.config_oficina set expediente = v_op::jsonb where oficina_id = v_of;
        res := pg_temp.chk(res, 'segurança', 'config: expediente inválido recusado ' || v_op, false, 'aceitou');
      exception when sqlstate 'DD001' then
        get stacked diagnostics v_t = message_text;
        res := pg_temp.chk(res, 'segurança', 'config: expediente inválido recusado ' || v_op, v_t = 'config_invalida', v_t);
      end;
    end loop;
    begin
      update public.config_oficina set semaforo = '{"laranjaAntesHoras":-1,"vermelhoBloqueioHoras":4,"laranjaFracao":0.8}' where oficina_id = v_of;
      res := pg_temp.chk(res, 'segurança', 'config: semáforo negativo recusado', false, 'aceitou');
    exception when sqlstate 'DD001' then
      res := pg_temp.chk(res, 'segurança', 'config: semáforo negativo recusado', true);
    end;
    update public.config_oficina set provisorio = false, confirmado = '{"expediente":true}' where oficina_id = v_of;
    select not c.provisorio and c.confirmado = '{"expediente":true}' into v_b from public.config_oficina c where c.oficina_id = v_of;
    res := pg_temp.chk(res, 'segurança', 'config: dono confirma (provisorio=false)', v_b, null);

    -- estoque e custos: perfil e OS de outra oficina
    perform pg_temp.como(null);
    insert into public.oficina (nome) values ('Checagem outra oficina') returning id into v_outra;
    insert into public.perfil (oficina_id, nome, papel) values (v_outra, 'Checagem outra', 'producao') returning id into v_outro_perfil;
    insert into public.cliente (oficina_id, nome) values (v_outra, 'Checagem outro cliente') returning id into v_pid;
    insert into public.veiculo (oficina_id, cliente_id, placa) values (v_outra, v_pid, 'ZZZ9Z90') returning id into v_uid;
    insert into public.os (oficina_id, numero, veiculo_id, cliente_id, origem) values (v_outra, 1, v_uid, v_pid, 'particular') returning id into v_outra_os;
    perform pg_temp.como(au ->> 'gestor');
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'consumo_interno', 'quantidade', 1, 'perfilId', v_outro_perfil));
    res := pg_temp.esp(res, 'segurança', 'estoque: perfil de outra oficina', r, 'perfil_inexistente');
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'consumo_interno', 'quantidade', 1, 'osId', v_outra_os));
    res := pg_temp.esp(res, 'segurança', 'estoque: OS de outra oficina', r, 'os_nao_encontrada');
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'consumo_interno', 'quantidade', 1, 'osId', v_os1, 'perfilId', pf ->> 'producao'));
    res := pg_temp.esp(res, 'segurança', 'estoque: perfil e OS da oficina', r);
    perform pg_temp.como(au ->> 'financeiro');
    r := public.lancar_custo(v_os1, jsonb_build_object('tipo', 'terceiro', 'descricao', 'Checagem', 'custoUnitario', 100, 'perfilId', v_outro_perfil));
    res := pg_temp.esp(res, 'segurança', 'custo: perfil de outra oficina', r, 'perfil_inexistente');
    r := public.lancar_custo(v_outra_os, jsonb_build_object('tipo', 'terceiro', 'descricao', 'Checagem', 'custoUnitario', 100));
    res := pg_temp.esp(res, 'segurança', 'custo: OS de outra oficina', r, 'os_nao_encontrada');

    -- entradas inválidas viram valor_invalido (sem erro cru do Postgres)
    r := public.lancar_custo(v_os1, '{"tipo":"insumo","materialId":"nao-e-uuid","quantidade":1}');
    res := pg_temp.esp(res, 'segurança', 'entrada: materialId inválido (lancar_custo)', r, 'valor_invalido');
    r := public.criar_despesa(jsonb_build_object('descricao', 'X', 'categoriaId', 'abc', 'valorPrevisto', 100, 'vencimento', v_hoje));
    res := pg_temp.esp(res, 'segurança', 'entrada: categoriaId inválido (criar_despesa)', r, 'valor_invalido');
    perform pg_temp.como(au ->> 'gestor');
    r := public.movimentar_estoque('{"materialId":"xyz","tipo":"consumo_interno","quantidade":1}');
    res := pg_temp.esp(res, 'segurança', 'entrada: materialId inválido (movimentar_estoque)', r, 'valor_invalido');
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'ajuste', 'sentido', 'mais', 'quantidade', 1, 'obs', 'x', 'em', 'ontem à tarde'));
    res := pg_temp.esp(res, 'segurança', 'entrada: marco "em" inválido (movimentar_estoque)', r, 'valor_invalido');
    r := public.movimentar_estoque(jsonb_build_object('materialId', v_mat, 'tipo', 'ajuste', 'sentido', 'mais', 'quantidade', 1e20, 'obs', 'x'));
    res := pg_temp.esp(res, 'segurança', 'entrada: quantidade fora do limite (movimentar_estoque)', r, 'valor_invalido');
    r := public.salvar_material(jsonb_build_object('id', v_mat, 'nome', 'Material checagem', 'unidade', 'L', 'saldoMinimo', 1, 'ultimaConferenciaEm', '2026-13-40'));
    res := pg_temp.esp(res, 'segurança', 'entrada: data inválida (salvar_material)', r, 'data_invalida');
    r := public.salvar_material(jsonb_build_object('id', 'x1', 'nome', 'Material checagem', 'unidade', 'L', 'saldoMinimo', 1));
    res := pg_temp.esp(res, 'segurança', 'entrada: id inválido (salvar_material)', r, 'valor_invalido');
    r := public.salvar_material(jsonb_build_object('id', v_mat, 'nome', 'Material checagem', 'unidade', 'L', 'saldoMinimo', 1, 'ativo', 'talvez'));
    res := pg_temp.esp(res, 'segurança', 'entrada: booleano inválido (salvar_material)', r, 'valor_invalido');
    r := public.salvar_funcionario('{"id":"nao-e-uuid","nome":"X","papel":"producao"}');
    res := pg_temp.esp(res, 'segurança', 'entrada: id inválido (salvar_funcionario)', r, 'valor_invalido');
    r := public.salvar_funcionario(jsonb_build_object('id', pf ->> 'producao', 'nome', 'Checagem Produção', 'papel', 'producao', 'ativo', 'sim'));
    res := pg_temp.esp(res, 'segurança', 'entrada: ativo inválido (salvar_funcionario)', r, 'valor_invalido');
    perform pg_temp.como(au ->> 'recepcao');
    r := public.criar_atendimento_rapido('{"placa":"ZZZ9Z94","clienteId":"123","origem":"particular","pecas":[{"peca":"Capô","tecnica":"martelinho"}]}');
    res := pg_temp.esp(res, 'segurança', 'entrada: clienteId inválido (criar_atendimento_rapido)', r, 'valor_invalido');
    r := public.criar_atendimento_rapido('{"placa":"ZZZ9Z94","clienteNome":"X","origem":"particular","pecas":[{"peca":"Capô","tecnica":"martelinho","valor":1e40}]}');
    res := pg_temp.esp(res, 'segurança', 'entrada: valor gigante (criar_atendimento_rapido)', r, 'valor_invalido');
    r := public.salvar_tipo_reparo('{"nome":"Checagem bool","etapas":[{"ordem":1,"nome":"A","prazoPadraoHoras":1,"exigeFoto":"sim"}]}');
    res := pg_temp.esp(res, 'segurança', 'entrada: booleano inválido (salvar_tipo_reparo)', r, 'valor_invalido');
    r := public.salvar_tipo_reparo('{"id":"zz","nome":"Checagem id","etapas":[{"ordem":1,"nome":"A","prazoPadraoHoras":1}]}');
    res := pg_temp.esp(res, 'segurança', 'entrada: id inválido (salvar_tipo_reparo)', r, 'valor_invalido');
    r := public.adicionar_foto(v_os3, '{"id":"nao-e-uuid","fase":"entrada","caminho":"x"}');
    res := pg_temp.esp(res, 'segurança', 'entrada: id inválido (adicionar_foto)', r, 'valor_invalido');
    r := public.adicionar_foto(v_os3, jsonb_build_object('id', gen_random_uuid(), 'fase', 'durante', 'etapaId', 'e-1', 'caminho', 'x'));
    res := pg_temp.esp(res, 'segurança', 'entrada: etapaId inválido (adicionar_foto)', r, 'valor_invalido');

    perform pg_temp.como(null);
    raise exception using errcode = 'DDTST';
  exception
    when sqlstate 'DDTST' then null;
    when others then
      perform pg_temp.como(null);
      res := pg_temp.chk(res, 'erro', 'bloco de testes parou com erro inesperado', false, sqlerrm);
  end;
  perform pg_temp.como(null);
  insert into pg_temp._resultado (secao, teste, ok, detalhe)
  select x ->> 's', x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(res) x;
end $$;

insert into _resultado (secao, teste, ok, detalhe)
values ('agenda', 'concorrência real (duas sessões na última vaga) — rodar no ddoctor-teste com scripts/concorrencia.mjs (README)', true, null);
insert into _resultado (secao, teste, ok, detalhe)
select 'limpeza', 'testes não deixaram rastro (usuários de checagem)', count(*) = 0, count(*)::text
  from public.perfil where nome like 'Checagem %';

select secao, teste, ok, detalhe from _resultado order by n;
