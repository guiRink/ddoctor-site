-- 0012_storage.sql — bucket privado "fotos" (L37/L38: comprimidas no aparelho, ~200 KB; miniatura ~20 KB).
-- Caminho: <oficina_id>/<os_id>/<foto_id>.webp e <foto_id>.min.webp. Leitura por URL assinada (createSignedUrl).
-- Limite 2 MB por arquivo; só image/webp e image/jpeg.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public._uuid_ou_nulo(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- A OS do caminho é da minha oficina e não foi cancelada? (para gravar)
create or replace function public._foto_os_gravavel(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.os o
     where o.id = public._uuid_ou_nulo(split_part(p_nome, '/', 2))
       and o.oficina_id = public.minha_oficina()
       and split_part(p_nome, '/', 1) = public.minha_oficina()::text
       and o.estado <> 'cancelada'
       and (public.tem_papel('{dono,gestor,recepcao}') or (public.tem_papel('{producao}') and o.estado in ('agendada', 'na_oficina', 'pronta')))
  )
$$;

-- Posso ler o arquivo? Operação e financeiro: qualquer foto da oficina; produção: das OS do quadro.
create or replace function public._foto_legivel(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(p_nome, '/', 1) = public.minha_oficina()::text
     and (public.tem_papel('{dono,gestor,recepcao,financeiro}')
          or (public.tem_papel('{producao}') and public._os_no_quadro(public._uuid_ou_nulo(split_part(p_nome, '/', 2)))))
$$;

-- Posso apagar o arquivo? Só depois de remover_foto (removida_em) — operação qualquer uma, produção a que tirou —
-- ou arquivo órfão (subiu mas adicionar_foto falhou) de quem pode gravar naquela OS.
create or replace function public._foto_apagavel(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(p_nome, '/', 1) = public.minha_oficina()::text
     and (
       exists (
         select 1 from public.foto f
          where (f.caminho = p_nome or f.caminho_miniatura = p_nome) and f.oficina_id = public.minha_oficina()
            and f.removida_em is not null
            and (public.tem_papel('{dono,gestor,recepcao}') or f.autor_id = public.meu_perfil_id()))
       or (not exists (select 1 from public.foto f where f.caminho = p_nome or f.caminho_miniatura = p_nome)
           and public._foto_os_gravavel(p_nome))
     )
$$;

drop policy if exists fotos_ler on storage.objects;
create policy fotos_ler on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public._foto_legivel(name));

drop policy if exists fotos_gravar on storage.objects;
create policy fotos_gravar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public._foto_os_gravavel(name));

drop policy if exists fotos_apagar on storage.objects;
create policy fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public._foto_apagavel(name));
