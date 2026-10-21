-- 0011_views.sql — views de leitura.
-- Views "de recorte" (vw_producao, vw_equipe, vw_material, vw_movimento_estoque, vw_regra_comissao) rodam com os
-- direitos do dono da view e filtram SOZINHAS pela oficina e pelo papel (minha_oficina/tem_papel): é assim que a
-- produção e a TV veem o quadro sem ler as tabelas com cliente, telefone, documento, valor e seguradora, e que o
-- gerente vê o estoque sem custo. vw_auditoria usa security_invoker (vale a RLS de evento_auditoria).
-- A OSVisao completa NÃO é view: o RepositorioSupabase faz um select com embedding do PostgREST (ver mapeamento.ts),
-- e a RLS de cada tabela embutida decide o que vem (custos/títulos vêm vazios para quem não pode).

-- ---------------------------------------------------------------- quadro da produção e TV

create or replace view public.vw_producao with (security_barrier = true) as
select
  o.id,
  o.oficina_id,
  o.numero,
  o.estado,
  o.origem,
  o.prioridade,
  o.previsao_entrega,
  o.entrada_real_em,
  o.pronta_em,
  o.box,
  o.alerta,
  o.tipo_reparo_id,
  tr.nome as tipo_reparo_nome,
  o.veiculo_id,
  v.placa,
  v.marca,
  v.modelo,
  v.cor,
  ag.data as agendada_para,
  ag.janela as agendada_janela,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'osId', e.os_id, 'ordem', e.ordem, 'nome', e.nome, 'estado', e.estado, 'responsavelId', e.responsavel_id,
      'prazoHoras', e.prazo_horas, 'prazoEm', e.prazo_em, 'entrouFilaEm', e.entrou_fila_em, 'iniciadaEm', e.iniciada_em,
      'concluidaEm', e.concluida_em, 'pecasPrevistas', e.pecas_previstas, 'pecasFeitas', e.pecas_feitas,
      'motivoDispensa', e.motivo_dispensa, 'exigeFoto', e.exige_foto, 'exigeContagemPecas', e.exige_contagem_pecas,
      'bloqueios', coalesce((
        select jsonb_agg(jsonb_build_object('inicioEm', b.inicio_em, 'fimEm', b.fim_em, 'motivo', b.motivo) order by b.inicio_em)
          from public.bloqueio_etapa b where b.etapa_id = e.id), '[]'::jsonb)
    ) order by e.ordem)
      from public.etapa_os e where e.os_id = o.id), '[]'::jsonb) as etapas,
  -- peças da versão vigente SEM valor (o que fazer, não quanto custa)
  coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'peca', i.peca, 'tecnica', i.tecnica, 'statusItem', i.status_item) order by i.ordem)
      from public.item_orcamento i
     where i.versao_id = (select ov.id from public.orcamento_versao ov where ov.os_id = o.id order by ov.numero_versao desc limit 1)
  ), '[]'::jsonb) as pecas,
  o.criado_em,
  o.atualizado_em
from public.os o
join public.veiculo v on v.id = o.veiculo_id
left join public.tipo_reparo tr on tr.id = o.tipo_reparo_id
left join lateral (
  select a.data, a.janela from public.agendamento a
   where a.os_id = o.id and a.estado = 'confirmado' order by a.data limit 1
) ag on true
where o.oficina_id = public.minha_oficina()
  and o.estado in ('agendada', 'na_oficina', 'pronta');

-- ---------------------------------------------------------------- equipe (listarPerfis)
-- Todos veem nome, papel e função (responsáveis das etapas, TV). Contato e login: dono e gerente. Salário: dono e financeiro.

create or replace view public.vw_equipe with (security_barrier = true) as
select
  p.id,
  p.oficina_id,
  p.nome,
  p.papel,
  p.funcao,
  p.especialidade,
  p.ativo,
  p.usa_terminal,
  (p.auth_user_id is not null and p.login_desativado_em is null) as tem_login,
  case when public.tem_papel('{dono,gestor}') then p.usuario end as usuario,
  case when public.tem_papel('{dono,gestor}') then p.email end as email,
  case when public.tem_papel('{dono,gestor}') then p.telefone end as telefone,
  case when public.tem_papel('{dono,gestor,financeiro}') then p.admitido_em end as admitido_em,
  case when public.tem_papel('{dono,financeiro}') then s.salario_mensal end as salario_mensal,
  p.criado_em,
  p.atualizado_em
from public.perfil p
left join public.perfil_salario s on s.perfil_id = p.id
where p.oficina_id = public.minha_oficina();

-- ---------------------------------------------------------------- estoque sem custo para o gerente (veCustosOS)

create or replace view public.vw_material with (security_barrier = true) as
select
  m.id, m.oficina_id, m.nome, m.codigo, m.marca, m.categoria, m.unidade, m.saldo_estimado, m.saldo_minimo,
  m.ultima_conferencia_em,
  case when public.tem_papel('{dono,financeiro}') then m.custo_medio end as custo_medio,
  m.fornecedor_id, m.ativo, m.criado_em, m.atualizado_em
from public.material m
where m.oficina_id = public.minha_oficina() and public.tem_papel('{dono,gestor,financeiro}');

create or replace view public.vw_movimento_estoque with (security_barrier = true) as
select
  mv.id, mv.oficina_id, mv.material_id, mv.tipo, mv.quantidade, mv.sentido,
  case when public.tem_papel('{dono,financeiro}') then mv.custo_unitario end as custo_unitario,
  mv.os_id, mv.perfil_id, mv.fornecedor_id, mv.obs, mv.em
from public.movimento_estoque mv
where mv.oficina_id = public.minha_oficina() and public.tem_papel('{dono,gestor,financeiro}');

-- ---------------------------------------------------------------- comissões (o gerente vê as etapas, não o R$)

create or replace view public.vw_regra_comissao with (security_barrier = true) as
select
  r.id, r.oficina_id, r.etapa_nome, r.tipo_reparo_id,
  case when public.tem_papel('{dono,financeiro}') then r.valor end as valor,
  r.ativa, r.descricao, r.criado_em, r.atualizado_em
from public.regra_comissao r
where r.oficina_id = public.minha_oficina() and public.tem_papel('{dono,gestor,financeiro}');

-- ---------------------------------------------------------------- auditoria legível (RegistroAuditoria)
-- Linhas 'app' (frase da função) + linhas 'trigger' de transações sem frase (edição direta: cliente, veículo...).

create or replace function public._resumo_auditoria(p_tabela text, p_acao text, p_rotulo text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(case p_tabela
      when 'cliente' then 'Cliente' when 'veiculo' then 'Veículo' when 'fornecedor' then 'Fornecedor'
      when 'categoria_financeira' then 'Categoria' when 'config_oficina' then 'Configuração da oficina'
      when 'capacidade_dia' then 'Capacidade do dia' when 'regra_comissao' then 'Regra de comissão'
      when 'pagador' then 'Pagador' when 'os' then 'OS' when 'perfil' then 'Funcionário' when 'oficina' then 'Oficina'
      when 'material' then 'Material' when 'tipo_reparo' then 'Tipo de reparo'
    end, initcap(replace(p_tabela, '_', ' ')))
    || coalesce(' ' || p_rotulo, '')
    || case p_acao when 'criar' then ' cadastrado' when 'editar' then ' atualizado' when 'remover' then ' removido' else ' (' || p_acao || ')' end
$$;

create or replace view public.vw_auditoria with (security_invoker = true) as
select
  a.id,
  a.oficina_id,
  a.em,
  a.perfil_id,
  a.envolvido_id,
  a.acao,
  a.tabela as entidade,
  a.registro_id as entidade_id,
  coalesce(a.resumo, public._resumo_auditoria(a.tabela, a.acao, a.rotulo)) as resumo,
  a.origem
from public.evento_auditoria a
where a.origem <> 'trigger'
   or not exists (select 1 from public.evento_auditoria b where b.transacao = a.transacao and b.origem = 'app');
