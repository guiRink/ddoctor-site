# Atualização noturna — 20/10/2026

## Precisa de você
- [L39] Validade do orçamento (15 dias?) — fica fora do PDF até você confirmar (provisório em uso: 15 dias, oculto)
- [L40] Gestor também edita a capacidade (o pedido era "só o dono") — confirmar ou restringir (provisório em uso: gestor edita)
- [L41–L44] Recepção cria categoria de serviço; tema padrão automático; peças fora do cartão da TV; PDF de seguradora com o total autorizado — confirmar
- Mandar o link ao irmão (checkpoint); domínio (hospedagem Cloudflare Pages) e conta Supabase do dono; instalar OrbStack — trava o Sprint 1
- [L09] Tipos de reparo e etapas — trava o Sprint 3 · [L34] CPF/CNPJ antes de o S1 criar a coluna

## Onde estamos
Fase 0 · Sprint SF — 7 de 7 tarefas (merge e publicação em 20/10/2026) · Portões: G1 ❌ · G2 ❌ · G3 ❌ · G4 ❌

## O que mudou
- Pedidos do dono atendidos: modo escuro (Claro/Escuro/Automático), orçamento em PDF para compartilhar no WhatsApp, foto real ao concluir etapa e nas Vistorias, nova categoria de serviço com etapas, Agenda e capacidade editável em Ajustes.
- Produção e TV refeitas: todas as etapas na tela, Quadro/Lista, abas por etapa no celular, TV com cartões que se ajustam e paginação por coluna.
- QA sem bloqueios; 4 importantes corrigidos. 329 testes, lint 0 erros, build ok.

## Decisões que eu tomei sozinho (provisórias, a confirmar)
- Validade do orçamento de 15 dias fora do PDF — porquê: o prazo ainda não foi confirmado (L39).
- Gestor edita a capacidade — porquê: segui a matriz de permissões (L40).
- Recepção cria categoria; tema padrão automático; peças fora da TV; total autorizado no PDF de seguradora — porquê: ponto de partida editável (L41–L44).

## O que ficou pela metade
- Para o S1: permissões no banco para fotos, configuração e tipos de serviço (RLS + pgTAP); fotos no R2 (hoje ficam no aparelho, no demo).

---
Detalhe completo: [[mapa]] · histórico: [[historico]]
