# Atualização noturna — 22/10/2026

## Precisa de você
- Conta Cloudflare + adicionar ddoctorauto.com.br + trocar os nameservers no Registro.br (e dizer se há e-mail no domínio) — trava a publicação no domínio
- [L66] A produção pode ver as fotos de entrada de carros que ainda não pegou? (provisório em uso: regra do banco, a confirmar)
- [L67 a L70] Gerente cadastra funcionário só de recepção/produção/TV? Comissão por tipo paga cada etapa? Admissão no meio do mês = salário inteiro? Feriados fora dos dias úteis?
- [L34] CPF/CNPJ do cliente (LGPD) antes de o banco oficial receber dados reais
- Herdados: salvar as cores em Ajustes (L56–L63) · [L52–L55] · [L09] trava o Sprint 3

## Onde estamos
Fase 1 · Sprint S1 — banco, Equipe, Folha e Comissões feitos; publicação no domínio e banco oficial em aberto · Portões: G1 ❌ · G2 🔧 (teste ok, oficial pendente) · G3 ❌ · G4 ❌

## O que mudou
- Banco Supabase completo (migrations 0001–0015, RLS por papel, Storage privado de fotos, auditoria, tempo real), 235 checagens, aplicado e testado no `ddoctor-teste` (235/235).
- Painel com `RepositorioSupabase`, login por usuário ou e-mail, `?demo=1`, Equipe, Folha (pagar gera despesa) e Ajustes → Comissões; Edge Function `equipe-login` publicada no teste.
- Gerente sem financeiro, custos e salários; financeiro e folha só para o dono e a função financeiro. Cadastro aberto desligado no teste.

## Decisões que eu tomei sozinho (provisórias, a confirmar)
- Fotos no Storage do Supabase (~220 MB/mês, 1 GB dura ~4 meses), depois R2 — porquê: custo zero e troca preparada.
- Comissão paga a cada etapa; admissão no meio do mês = salário inteiro; feriados fora dos dias úteis — porquê: pontos de partida para a folha.
- Gerente cadastra só recepção, produção e TV — porquê: não pode criar quem tem mais poder que ele.

## O que ficou pela metade
- Publicar no domínio (Cloudflare Pages) e aplicar no `ddoctor` oficial: `aplicar.mjs oficial`, Edge Function, desligar cadastro aberto, Site URL, usuário do dono + `definir_primeiro_dono`, chave anon no build.

---
Detalhe completo: [[mapa]] · histórico: [[historico]]
