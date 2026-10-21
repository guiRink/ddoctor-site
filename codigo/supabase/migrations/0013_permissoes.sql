-- 0013_permissoes.sql — grants finais (rodar por último; idempotente). A barreira é a RLS; os grants só abrem a porta.
--   * anon (sem login): nada no schema public.
--   * authenticated: tabelas/views (a RLS e o recorte das views decidem as linhas); funções do painel (RPC).
--   * Imutáveis: sem UPDATE/DELETE para ninguém (evento_auditoria, movimento_estoque, baixa, fechamento_caixa).
--   * Funções internas (prefixo "_") que escrevem ou vazam dados: só o dono das funções (chamadas por dentro).

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on all tables in schema public to service_role';
    execute 'revoke update, delete, truncate on public.evento_auditoria, public.movimento_estoque, public.baixa, public.fechamento_caixa from service_role';
  end if;
end $$;
revoke update, delete, truncate on public.evento_auditoria, public.movimento_estoque, public.baixa, public.fechamento_caixa from authenticated;
-- auditoria: só leitura pela API
revoke insert on public.evento_auditoria from authenticated;

-- funções: ninguém por padrão; o painel chama as públicas
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;

-- internas que escrevem, contornam a RLS ou expõem dados de outros papéis: fora da API
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         '_auditar', '_auditoria_trigger', '_baixar', '_movimentar', '_liberar_proxima', '_fechar_os_se_pronta',
         '_etapa_para_mudar', '_reservar', '_vagas_do_dia', '_vagas_ocupadas', '_checar_caixa', '_linhas_comissao',
         '_rotulo_os', '_fuso', '_exigir', '_preparar_tabela', '_politicas', '_categoria_renomeada', '_guarda_saldo_material',
         '_guarda_os', '_guarda_versao', '_guarda_folha_paga', '_guarda_ultimo_dono', '_imutavel', '_tocar_atualizado_em',
         'definir_primeiro_dono')
  loop
    execute format('revoke execute on function %s from authenticated', f.assinatura);
  end loop;
end $$;
