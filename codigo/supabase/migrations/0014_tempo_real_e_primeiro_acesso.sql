-- 0014 — tempo real para o painel (TV e celulares atualizam sozinhos) e checagem de primeiro acesso no login.
-- Idempotente. Rodar depois das anteriores.

-- Tabelas da operação na publicação do Realtime (a RLS de cada tabela continua decidindo quem recebe o evento).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['os', 'etapa_os', 'bloqueio_etapa', 'agendamento', 'capacidade_dia', 'foto',
                             'pendencia_externa', 'orcamento_versao', 'item_orcamento', 'titulo_receber', 'baixa']
    loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- A tela de login precisa saber, sem estar logada, se a oficina já tem um dono com login
-- (para mostrar o passo a passo do primeiro acesso). Devolve só verdadeiro/falso.
create or replace function public.oficina_tem_dono()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfil
    where papel = 'dono' and ativo and auth_user_id is not null and login_desativado_em is null
  );
$$;
revoke all on function public.oficina_tem_dono() from public;
grant execute on function public.oficina_tem_dono() to anon, authenticated;
