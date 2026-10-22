# Sprint S1 — banco de dados real (Supabase) + Equipe, folha e comissões

Branch `sprint/s1-supabase`. Pedido do Guilherme em 22/10/2026: "deixar o Supabase funcionando certinho" com todas as funcionalidades do painel; projeto de **teste** com dados de exemplo para visualizar; o **oficial** zerado para o dono começar a usar.

Projetos (org D Doctor, sa-east-1, plano grátis): `ddoctor-teste` (ref `mogpmpypunsxxsbpeaef`) e `ddoctor` (ref `pihmssohyyfcneeutbfq`). URL: `https://<ref>.supabase.co`. Só a chave pública (publishable/anon) vai para o painel, via `.env.local` (fora do git) e variável do build; a secreta nunca.

## Pedidos novos que entram neste sprint
- **Equipe** (aba própria, para o dono): lista de funcionários, cadastrar, **dar login** (usuário e senha que o dono passa ao funcionário), **editar a função/permissão** (pintor, funileiro, recepção, gerente, financeiro, dono…), histórico de cada um ("Diego concluiu Pintura do RKP1L34").
- **Permissões**: gerente vê quase tudo **menos o financeiro**; financeiro (A receber, Financeiro, Relatórios, folha, custos e margem) só o **dono** e quem tem a função **financeiro**.
- **Folha de pagamento** na Equipe: salário de cada um + **comissões por serviço** (ex.: pintura concluída = R$ 40), a receber no mês; marcar como pago (vira despesa "Salários").
- **Comissões** editáveis em Ajustes: quais serviços/etapas são comissionados e o valor.
- **Fotos**: ~1.000/mês ≈ 220 MB/mês comprimidas → 1 GB grátis dura ~4 meses; começar no Storage privado do Supabase, com aviso de uso e troca para a Cloudflare R2 preparada.

## Checklist
- [x] Regras e tipos: equipe, papéis, folha, comissões, matriz de permissões (gerente sem financeiro)
- [x] Telas: Equipe (funcionários, login, função, histórico, folha) e Ajustes → Comissões
- [x] Banco: migrations 0001–0015 do modelo inteiro, RLS por papel, funções atômicas, views só leitura, Storage de fotos (2 MB), auditoria, tempo real, `oficina_tem_dono`, correções da revisão QA; seed padrão (`producao.sql`) e seed de exemplo (`teste.sql`); 235 checagens (`checagens.sql`); `scripts/aplicar.mjs`
- [x] Função (Edge Function) `equipe-login` para o dono criar, tirar e sincronizar o login do funcionário
- [x] `RepositorioSupabase` + login por usuário/e-mail e senha + modo demonstração `?demo=1`
- [x] Aplicar no `ddoctor-teste`, conferir RLS e telas (235/235; dono definido; Edge Function publicada; cadastro aberto desligado; gravação testada)
- [ ] Publicação no domínio do dono (ddoctorauto.com.br, Cloudflare Pages): conta Cloudflare, domínio, nameservers no Registro.br
- [ ] Aplicar no `ddoctor` oficial zerado: `aplicar.mjs oficial` (sem dados de exemplo), Edge Function, desligar cadastro aberto, Site URL = https://ddoctorauto.com.br, usuário do dono + `definir_primeiro_dono`, chave anon do oficial no build

## Registro (22/10/2026)
Feito na branch; detalhes e decisões L64–L71 em `notas/mapa.md`. Em aberto: tudo que depende do dono (Cloudflare e nameservers) e o banco oficial, que o Guilherme aplica à mão.
