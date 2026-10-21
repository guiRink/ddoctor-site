-- 0005_funcoes_base.sql — base das funções do painel: resultado {ok, codigo, id}, contexto/permissão,
-- datas no fuso da oficina e horas úteis pelo expediente (iguais a dominio/expediente.ts e corCarro.ts).
--
-- Padrão das funções que mudam estado (0007–0010):
--   * security definer, set search_path = '', validam oficina + papel (+ responsável) logo no início;
--   * erro de regra = perform public._erro('codigo'[, 'campo']) → o bloco EXCEPTION desfaz o que já foi escrito
--     e a função devolve {"ok": false, "codigo": "...", "campo": "..."} (os mesmos códigos do repositório/rotulos.ts);
--   * sucesso = {"ok": true, "id": "..."} (às vezes com "codigo" de aviso).

create or replace function public._erro(p_codigo text, p_campo text default null) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'DD001', message = p_codigo, detail = coalesce(p_campo, '');
end $$;

create or replace function public._falha(p_codigo text, p_campo text default null) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', false, 'codigo', p_codigo)
         || case when nullif(p_campo, '') is not null then jsonb_build_object('campo', p_campo) else '{}'::jsonb end
$$;

create or replace function public._ok(p_id uuid default null, p_extra jsonb default null) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', true)
         || case when p_id is not null then jsonb_build_object('id', p_id) else '{}'::jsonb end
         || coalesce(p_extra, '{}'::jsonb)
$$;

-- Exige login com um dos papéis; devolve a oficina. Sem perfil → sem_permissao.
create or replace function public._exigir(p_papeis text[]) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_of uuid := public.minha_oficina();
begin
  if v_of is null or not public.tem_papel(p_papeis) then
    perform public._erro('sem_permissao');
  end if;
  return v_of;
end $$;

create or replace function public._fuso(p_oficina uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select o.fuso from public.oficina o where o.id = p_oficina), 'America/Sao_Paulo')
$$;

-- Data de negócio de um marco no fuso da oficina.
create or replace function public._dia(p_t timestamptz, p_fuso text) returns date
language sql stable set search_path = '' as $$
  select (p_t at time zone p_fuso)::date
$$;

-- Marco no formato do painel: "2026-10-12T14:30:00-03:00" (fuso da oficina).
create or replace function public._marco(p_t timestamptz, p_fuso text) returns text
language plpgsql stable set search_path = '' as $$
declare
  v_off int;
begin
  if p_t is null then return null; end if;
  v_off := round(extract(epoch from ((p_t at time zone p_fuso) - (p_t at time zone 'UTC'))) / 60)::int;
  return to_char(p_t at time zone p_fuso, 'YYYY-MM-DD"T"HH24:MI:SS')
         || case when v_off < 0 then '-' else '+' end
         || lpad((abs(v_off) / 60)::text, 2, '0') || ':' || lpad((abs(v_off) % 60)::text, 2, '0');
end $$;

-- "08:30" → 510
create or replace function public._minutos(p_hhmm text) returns int
language sql immutable set search_path = '' as $$
  select split_part(p_hhmm, ':', 1)::int * 60 + split_part(p_hhmm, ':', 2)::int
$$;

-- Instante de um horário de parede (minutos desde a meia-noite) no fuso.
create or replace function public._local(p_dia date, p_min int, p_fuso text) returns timestamptz
language sql stable set search_path = '' as $$
  select (p_dia::timestamp + make_interval(mins => p_min)) at time zone p_fuso
$$;

-- janelaDoDia: expediente do dia em minutos, ou nulls se o dia não é útil (sábado termina em sabadoFim).
create or replace function public._janela(p_exp jsonb, p_dia date, out inicio int, out fim int)
language plpgsql immutable set search_path = '' as $$
declare
  v_ds int := extract(dow from p_dia)::int;
begin
  inicio := null;
  fim := null;
  if not coalesce((p_exp -> 'diasSemana') @> to_jsonb(v_ds), false) then return; end if;
  inicio := public._minutos(p_exp ->> 'inicio');
  fim := public._minutos(case when v_ds = 6 and nullif(p_exp ->> 'sabadoFim', '') is not null then p_exp ->> 'sabadoFim' else p_exp ->> 'fim' end);
  if fim <= inicio then
    inicio := null;
    fim := null;
  end if;
end $$;

-- proximoDiaUtil (inclusive).
create or replace function public._proximo_dia_util(p_dia date, p_exp jsonb) returns date
language plpgsql immutable set search_path = '' as $$
declare
  d date := p_dia;
begin
  for n in 0 .. 3660 loop
    if (public._janela(p_exp, d)).inicio is not null then return d; end if;
    d := d + 1;
  end loop;
  raise exception 'expediente_sem_dias_uteis';
end $$;

-- somarHorasUteis: começa fora do expediente → conta da próxima abertura.
create or replace function public._somar_horas_uteis(p_inicio timestamptz, p_horas numeric, p_exp jsonb, p_fuso text) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  v_resta numeric := p_horas * 3600; -- segundos
  v_cursor timestamptz := p_inicio;
  d date := (p_inicio at time zone p_fuso)::date;
  j record;
  s timestamptz;
  e timestamptz;
  v_seg numeric;
begin
  if p_horas is null or p_horas < 0 then raise exception 'horas_invalidas'; end if;
  for n in 0 .. 3660 loop
    j := public._janela(p_exp, d);
    if j.inicio is not null then
      s := greatest(v_cursor, public._local(d, j.inicio, p_fuso));
      e := public._local(d, j.fim, p_fuso);
      if s < e then
        v_seg := extract(epoch from (e - s));
        if v_resta <= v_seg then
          return s + make_interval(secs => v_resta::double precision);
        end if;
        v_resta := v_resta - v_seg;
      end if;
    end if;
    v_cursor := '-infinity';
    d := d + 1;
  end loop;
  raise exception 'expediente_sem_dias_uteis';
end $$;

-- entregaPorDiasUteis: dia 0 = entrada; dias = 0 → próximo dia útil.
create or replace function public._entrega_por_dias_uteis(p_base date, p_dias int, p_exp jsonb) returns date
language plpgsql immutable set search_path = '' as $$
declare
  d date := p_base;
  v_falta int := p_dias;
begin
  if p_dias is null or p_dias < 0 then raise exception 'dias_invalidos'; end if;
  if p_dias = 0 then return public._proximo_dia_util(p_base, p_exp); end if;
  for n in 0 .. 3660 loop
    exit when v_falta <= 0;
    d := d + 1;
    if (public._janela(p_exp, d)).inicio is not null then v_falta := v_falta - 1; end if;
  end loop;
  if v_falta > 0 then raise exception 'expediente_sem_dias_uteis'; end if;
  return d;
end $$;

-- previsaoEntregaSugerida: soma dos prazos do modelo + 20 % de folga (provisório), fim do dia útil em que cai.
create or replace function public._previsao_sugerida(p_etapas jsonb, p_entrada timestamptz, p_exp jsonb, p_fuso text) returns date
language plpgsql stable set search_path = '' as $$
declare
  v_horas numeric;
  v_fim timestamptz;
  v_dia date;
  j record;
  v_min numeric;
begin
  select coalesce(sum((x ->> 'prazoPadraoHoras')::numeric), 0) * 1.2 into v_horas from jsonb_array_elements(p_etapas) x;
  v_fim := public._somar_horas_uteis(p_entrada, v_horas, p_exp, p_fuso);
  v_dia := (v_fim at time zone p_fuso)::date;
  j := public._janela(p_exp, v_dia);
  v_min := extract(epoch from ((v_fim at time zone p_fuso) - v_dia::timestamp)) / 60;
  if j.inicio is null or v_min > j.fim then
    v_dia := public._proximo_dia_util(v_dia + 1, p_exp);
  end if;
  return v_dia;
end $$;

-- Recepção do veículo: valida (km ≥ 0; avaria dentro do desenho) e carimba (carimbarRecepcao: a primeira gravação
-- fica em registradaEm/Por; regravação vira atualizadaEm/Por; carimbos vindos do aparelho são ignorados).
create or replace function public._preparar_recepcao(p_nova jsonb, p_anterior jsonb, p_quando timestamptz, p_eu uuid, p_fuso text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v jsonb := coalesce(p_nova, '{}'::jsonb) - 'registradaEm' - 'registradaPor' - 'atualizadaEm' - 'atualizadaPor';
  v_av jsonb := '[]'::jsonb;
  a jsonb;
begin
  if jsonb_typeof(v) <> 'object' then perform public._erro('km_invalido'); end if;
  if v ? 'km' and jsonb_typeof(v -> 'km') <> 'null' then
    if jsonb_typeof(v -> 'km') <> 'number' or (v ->> 'km')::numeric < 0 then perform public._erro('km_invalido'); end if;
  end if;
  for a in select x from jsonb_array_elements(coalesce(v -> 'avarias', '[]'::jsonb)) x loop
    if jsonb_typeof(a -> 'x') <> 'number' or jsonb_typeof(a -> 'y') <> 'number'
       or (a ->> 'x')::numeric not between 0 and 1 or (a ->> 'y')::numeric not between 0 and 1 then
      perform public._erro('posicao_invalida');
    end if;
    if coalesce(a ->> 'id', '') = '' then a := a || jsonb_build_object('id', gen_random_uuid()::text); end if;
    v_av := v_av || jsonb_build_array(a);
  end loop;
  v := v || jsonb_build_object('avarias', v_av, 'checklist', coalesce(v -> 'checklist', '{}'::jsonb));
  if p_anterior ? 'registradaEm' then
    v := v || jsonb_build_object('registradaEm', p_anterior -> 'registradaEm', 'registradaPor', p_anterior -> 'registradaPor',
                                 'atualizadaEm', public._marco(p_quando, p_fuso), 'atualizadaPor', p_eu);
  else
    v := v || jsonb_build_object('registradaEm', public._marco(p_quando, p_fuso), 'registradaPor', p_eu);
  end if;
  return jsonb_strip_nulls(v);
end $$;

-- Reais para as frases da auditoria: 30000 → "R$ 300,00".
create or replace function public._reais(p_centavos bigint) returns text
language sql immutable set search_path = '' as $$
  select case when p_centavos < 0 then '−' else '' end || 'R$ '
         || replace(to_char(abs(p_centavos) / 100, 'FM999G999G990'), ',', '.')
         || ',' || lpad((abs(p_centavos) % 100)::text, 2, '0')
$$;

-- Normaliza a forma de pagamento (normalizarFormaPagamento): "Pix", "Espécie", "Cartão de crédito" → forma canônica.
create or replace function public._forma(p text) returns text
language sql immutable set search_path = '' as $$
  select case public._chave(p)
    when 'pix' then 'pix' when 'dinheiro' then 'dinheiro' when 'especie' then 'dinheiro'
    when 'debito' then 'debito' when 'cartao de debito' then 'debito'
    when 'credito' then 'credito' when 'cartao de credito' then 'credito'
    when 'boleto' then 'boleto' when 'transferencia' then 'transferencia' when 'ted' then 'transferencia'
    when 'doc' then 'transferencia' when 'seguradora' then 'seguradora' end
$$;

-- checarCaixaAberto: dinheiro com data de dia já fechado → caixa_ja_fechado.
create or replace function public._checar_caixa(p_oficina uuid, p_forma text, p_data date) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_data is not null and public._forma(p_forma) = 'dinheiro'
     and exists (select 1 from public.fechamento_caixa f where f.oficina_id = p_oficina and f.data = p_data) then
    perform public._erro('caixa_ja_fechado');
  end if;
end $$;
