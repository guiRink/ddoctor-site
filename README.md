# GusPainel — D doctor (martelinho de ouro)

Site e painel de gestão da oficina D doctor, em Curitiba.

- **Landing page** (publicada): https://guirink.github.io/ddoctor-site/ — código em `codigo/site/`.
- **Painel de gestão** (em construção): `codigo/painel/`, publicado em `/painel/` pelo mesmo workflow.

Comece por `CLAUDE.md` (regras e comandos), `notas/mapa.md` (estado atual) e `docs/painel-plano.md` (plano e sprints). Contexto do negócio em `PRODUCT.md` e `docs/maxpar-estudo.md`; identidade visual em `DESIGN.md`.

```bash
node codigo/tools/serve.mjs codigo/site 8765   # landing local
cd codigo/painel && npm install && npm run dev   # painel local
```
