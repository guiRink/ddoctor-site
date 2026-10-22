-- 0010_funcoes_cadastros.sql — tipos de reparo, fotos, equipe (funcionários) e o primeiro dono.

-- ---------------------------------------------------------------- tipos de reparo (validarTipoReparo / usoTipoReparo)
-- p_tipo = TipoReparoEntrada: {id?, nome, etapas: ModeloEtapaItem[]}. Criado/revisto por quem cuida da oficina deixa
-- de ser provisório. As OS que já entraram mantêm as etapas geradas na entrada.

create or replace function public.salvar_tipo_reparo(p_tipo jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_id uuid := nullif(p_tipo ->> 'id', '')::uuid;
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
  for e in select x from jsonb_array_elements(p_tipo -> 'etapas') x order by (x ->> 'ordem')::numeric nulls last loop
    v_i := v_i + 1;
    if jsonb_typeof(e -> 'ordem') <> 'number' or (e ->> 'ordem')::numeric <> v_i then perform public._erro('ordem_invalida'); end if;
    v_en := btrim(regexp_replace(coalesce(e ->> 'nome', ''), '\s+', ' ', 'g'));
    if v_en = '' or length(v_en) > 60 then perform public._erro('etapa_invalida'); end if;
    if jsonb_typeof(e -> 'prazoPadraoHoras') <> 'number' then perform public._erro('prazo_invalido'); end if;
    v_prazo := (e ->> 'prazoPadraoHoras')::numeric;
    if v_prazo <= 0 or v_prazo > 200 then perform public._erro('prazo_invalido'); end if;
    v_etapas := v_etapas || jsonb_build_array(jsonb_build_object(
      'ordem', v_i, 'nome', v_en, 'prazoPadraoHoras', v_prazo,
      'dispensavel', coalesce((e ->> 'dispensavel')::boolean, false),
      'exigeFoto', coalesce((e ->> 'exigeFoto')::boolean, false),
      'exigeContagemPecas', coalesce((e ->> 'exigeContagemPecas')::boolean, false)));
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
end $$;

create or replace function public.arquivar_tipo_reparo(p_id uuid, p_arquivar boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  t public.tipo_reparo;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao}');
  select * into t from public.tipo_reparo where id = p_id and oficina_id = v_of for update;
  if not found then perform public._erro('tipo_nao_encontrado'); end if;
  if p_arquivar and exists (
    select 1 from public.os o where o.tipo_reparo_id = p_id and o.estado not in ('entregue', 'encerrada', 'cancelada')) then
    perform public._erro('tipo_em_uso');
  end if;
  if t.ativo = not p_arquivar then return public._ok(p_id); end if;
  update public.tipo_reparo set ativo = not p_arquivar where id = p_id;
  perform public._auditar('editar', 'tipo_reparo', p_id, format('Tipo de reparo %s %s', t.nome, case when p_arquivar then 'arquivado' else 'reativado' end));
  return public._ok(p_id);
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- fotos
-- Fluxo: o aparelho comprime, gera o id (uuid), sobe <oficina_id>/<os_id>/<id>.webp e <id>.min.webp no bucket
-- "fotos" e chama adicionar_foto com os caminhos. p_foto = {id, fase, etapaId?, legenda?, caminho, caminhoMiniatura?,
-- bytes?, largura?, altura?}. Produção: só OS do quadro e só etapa própria.

create or replace function public.adicionar_foto(p_os uuid, p_foto jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_os public.os;
  v_id uuid := nullif(p_foto ->> 'id', '')::uuid;
  v_fase text := p_foto ->> 'fase';
  v_etapa public.etapa_os;
  v_caminho text := p_foto ->> 'caminho';
  v_mini text := nullif(p_foto ->> 'caminhoMiniatura', '');
  v_prefixo text;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao,producao}');
  select * into v_os from public.os where id = p_os and oficina_id = v_of;
  if not found then perform public._erro('os_nao_encontrada'); end if;
  if public.meu_papel() = 'producao' and not public._os_no_quadro(p_os) then perform public._erro('os_nao_encontrada'); end if;
  if v_os.estado = 'cancelada' then perform public._erro('transicao_invalida'); end if;
  if v_fase is null or v_fase not in ('entrada', 'durante', 'final') then perform public._erro('fase_invalida'); end if;
  if nullif(p_foto ->> 'etapaId', '') is not null then
    select * into v_etapa from public.etapa_os where id = (p_foto ->> 'etapaId')::uuid and os_id = p_os;
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
end $$;

-- Marca a foto como removida e devolve os caminhos para o aparelho apagar no Storage ({ok, id, caminhos}).
create or replace function public.remover_foto(p_foto uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  f public.foto;
  e public.etapa_os;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor,recepcao,producao}');
  select * into f from public.foto where id = p_foto and oficina_id = v_of and removida_em is null for update;
  if not found then perform public._erro('foto_nao_encontrada'); end if;
  if f.origem = 'maxpar' then perform public._erro('foto_externa'); end if;
  if public.meu_papel() = 'producao' and f.autor_id is distinct from public.meu_perfil_id() then perform public._erro('nao_responsavel'); end if;
  if f.etapa_id is not null then
    select * into e from public.etapa_os where id = f.etapa_id;
    -- a única foto que comprova uma etapa já concluída fica
    if e.exige_foto and e.estado = 'concluida' and (
      select count(*) from public.foto x
       where x.os_id = f.os_id and x.etapa_id = e.id and x.fase in ('durante', 'final') and x.removida_em is null) <= 1 then
      perform public._erro('foto_em_uso');
    end if;
  end if;
  update public.foto set removida_em = now() where id = p_foto;
  update public.os set atualizado_em = now() where id = f.os_id;
  perform public._auditar('remover_foto', 'foto', p_foto, format('Foto (%s) removida da %s', f.fase, public._rotulo_os(f.os_id)));
  return public._ok(p_foto, jsonb_build_object('caminhos', to_jsonb(array_remove(array[f.caminho, f.caminho_miniatura], null))));
exception
  when sqlstate 'DD001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    return public._falha(v_msg, v_det);
end $$;

-- ---------------------------------------------------------------- equipe (salvarFuncionario)
-- p = FuncionarioEntrada já validada no TS (validarFuncionario): {id?, nome, papel, funcao?, usuario?, email?, telefone?,
-- salarioMensal?, admitidoEm?, ativo?, usaTerminal?}. Dono e gerente gerenciam a equipe; trocar `papel` e mexer no
-- salário só o dono (sem_permissao); o gerente não cria dono, gerente nem financeiro. Usuário de quem já tem login
-- só muda pela Edge Function equipe-login (o e-mail técnico do Auth acompanha). Último dono ativo: ultimo_dono.

create or replace function public.salvar_funcionario(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_dono boolean;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_antes public.perfil;
  v_papel text := p ->> 'papel';
  v_nome text := btrim(regexp_replace(coalesce(p ->> 'nome', ''), '\s+', ' ', 'g'));
  v_adm date;
  v_sal bigint;
  v_msg text;
  v_det text;
begin
  v_of := public._exigir('{dono,gestor}');
  v_dono := public.tem_papel('{dono}');
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
    if v_papel <> v_antes.papel and not v_dono then perform public._erro('sem_permissao', 'papel'); end if;
    if v_antes.papel = 'dono' and not v_dono then perform public._erro('sem_permissao'); end if;
    update public.perfil
       set nome = v_nome, papel = v_papel, funcao = nullif(btrim(p ->> 'funcao'), ''),
           usuario = case when auth_user_id is null then nullif(btrim(p ->> 'usuario'), '') else usuario end,
           email = nullif(lower(btrim(p ->> 'email')), ''), telefone = nullif(btrim(p ->> 'telefone'), ''),
           admitido_em = v_adm, ativo = coalesce((p ->> 'ativo')::boolean, ativo),
           usa_terminal = coalesce((p ->> 'usaTerminal')::boolean, usa_terminal)
     where id = v_id;
    perform public._auditar('editar', 'perfil', v_id,
      format('Cadastro de %s atualizado%s', v_nome,
             case when v_papel <> v_antes.papel then format(' (permissão %s → %s)', v_antes.papel, v_papel) else '' end
             || case when coalesce((p ->> 'ativo')::boolean, v_antes.ativo) <> v_antes.ativo
                     then case when v_antes.ativo then ' (desativado)' else ' (reativado)' end else '' end), v_id);
  else
    if not v_dono and v_papel in ('dono', 'gestor', 'financeiro') then perform public._erro('sem_permissao', 'papel'); end if;
    insert into public.perfil (oficina_id, nome, papel, funcao, usuario, email, telefone, admitido_em, ativo, usa_terminal)
    values (v_of, v_nome, v_papel, nullif(btrim(p ->> 'funcao'), ''), nullif(btrim(p ->> 'usuario'), ''), nullif(lower(btrim(p ->> 'email')), ''),
            nullif(btrim(p ->> 'telefone'), ''), v_adm, coalesce((p ->> 'ativo')::boolean, true), coalesce((p ->> 'usaTerminal')::boolean, false))
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

-- ---------------------------------------------------------------- primeiro dono (rodar no SQL Editor)
-- 1) Authentication → Add user (e-mail + senha, "Auto Confirm User"); 2) select public.definir_primeiro_dono('email', 'Nome').
-- Só funciona enquanto nenhum dono tem login. Liga ao perfil que já tem esse e-mail ou cria um perfil dono novo.
-- NÃO fica exposta à API (sem grant para anon/authenticated).

create or replace function public.definir_primeiro_dono(p_email text, p_nome text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_of uuid;
  v_user uuid;
  v_perfil uuid;
begin
  if (select count(*) from public.oficina) <> 1 then
    raise exception 'precisa existir exatamente uma oficina (rode seed/producao.sql antes)';
  end if;
  select id into v_of from public.oficina;
  if exists (select 1 from public.perfil p where p.oficina_id = v_of and p.papel = 'dono' and p.auth_user_id is not null) then
    raise exception 'já existe dono com login: crie os outros logins pela Equipe no painel';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'usuário % não existe em Authentication → Users', p_email;
  end if;
  select p.id into v_perfil from public.perfil p where p.oficina_id = v_of and (p.auth_user_id = v_user or lower(p.email) = lower(btrim(p_email))) limit 1;
  if v_perfil is not null then
    update public.perfil set auth_user_id = v_user, papel = 'dono', ativo = true, login_desativado_em = null where id = v_perfil;
  else
    insert into public.perfil (oficina_id, auth_user_id, nome, papel, funcao, email, ativo)
    values (v_of, v_user, coalesce(nullif(btrim(p_nome), ''), split_part(p_email, '@', 1)), 'dono', 'Dono', lower(btrim(p_email)), true)
    returning id into v_perfil;
  end if;
  insert into public.evento_auditoria (oficina_id, tabela, registro_id, acao, resumo, perfil_id, origem)
  values (v_of, 'perfil', v_perfil, 'primeiro_dono', format('Primeiro dono definido: %s', p_email), v_perfil, 'app');
  return format('ok: %s agora é dono (perfil %s)', p_email, v_perfil);
end $$;
