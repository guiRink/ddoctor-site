// Teste local SEM Docker: aplica stub do Supabase + migrations (duas vezes, para provar a idempotência) + seeds
// no PGlite (Postgres 18 em WASM) e roda checagens.sql. Uso (de codigo/supabase):
//   npm_config_cache=/tmp/npm-cache npm install   (uma vez)
//   node scripts/testar-local.mjs [--sem-teste]    (--sem-teste = só seed/producao.sql, como o projeto oficial)
// Não substitui o teste no ddoctor-teste: o PGlite tem uma conexão só (sem concorrência real) e o stub imita auth/storage.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const semTeste = process.argv.includes("--sem-teste");

const db = new PGlite();
async function rodar(nome, sql) {
  try {
    await db.exec(sql);
    console.log(`ok   ${nome}`);
  } catch (e) {
    console.error(`ERRO ${nome}: ${e.message}${e.position ? ` (posição ${e.position})` : ""}`);
    if (e.position) {
      const p = Number(e.position);
      console.error("  …" + sql.slice(Math.max(0, p - 200), p) + " ⟵ AQUI ⟶ " + sql.slice(p, p + 120) + "…");
    }
    if (e.where) console.error("  onde: " + e.where);
    process.exit(1);
  }
}

await rodar("stub-supabase.sql", ler("scripts/stub-supabase.sql"));
const migrations = readdirSync(join(raiz, "migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const rodada of [1, 2]) for (const m of migrations) await rodar(`migrations/${m} (rodada ${rodada})`, ler(`migrations/${m}`));
await rodar("seed/producao.sql", ler("seed/producao.sql"));
await rodar("seed/producao.sql (de novo)", ler("seed/producao.sql"));
if (!semTeste && existsSync(join(raiz, "seed/teste.sql"))) await rodar("seed/teste.sql", ler("seed/teste.sql"));

const r = await db.query(`select 1`);
void r;
try {
  const res = await db.exec(ler("checagens.sql"));
  const ultimo = res.at(-1);
  let falhas = 0;
  for (const linha of ultimo.rows) {
    const ok = linha.ok === true;
    if (!ok) falhas++;
    console.log(`${ok ? "  ✔" : "  ✘"} [${linha.secao}] ${linha.teste}${linha.detalhe ? ` — ${linha.detalhe}` : ""}`);
  }
  console.log(`\n${ultimo.rows.length - falhas} de ${ultimo.rows.length} checagens ok${falhas ? `, ${falhas} FALHARAM` : ""}.`);
  process.exit(falhas ? 1 : 0);
} catch (e) {
  console.error(`ERRO checagens.sql: ${e.message}${e.where ? `\n  onde: ${e.where}` : ""}`);
  process.exit(1);
}
