// Aplica o banco num projeto Supabase: migrations em ordem, seed padrão, (no teste) seed de exemplo, e roda as checagens.
// A senha do banco é digitada por quem roda, escondida, e não é salva em lugar nenhum.
// Uso (de codigo/supabase):  node scripts/aplicar.mjs teste      |  node scripts/aplicar.mjs oficial
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const PROJETOS = {
  teste: { ref: "mogpmpypunsxxsbpeaef", host: "aws-1-sa-east-1.pooler.supabase.com", seedTeste: true },
  oficial: { ref: "pihmssohyyfcneeutbfq", host: "aws-1-sa-east-1.pooler.supabase.com", seedTeste: false },
};

const alvo = process.argv[2];
const projeto = PROJETOS[alvo];
if (!projeto) {
  console.error("Diga onde aplicar: node scripts/aplicar.mjs teste   (ou oficial)");
  process.exit(2);
}

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (arquivo) => readFileSync(join(raiz, arquivo), "utf8");

function perguntarEscondido(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(pergunta)) rl.output.write(s);
    };
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stdout.write("\n");
      resolve(resposta);
    });
  });
}

function perguntar(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pergunta, (r) => {
      rl.close();
      resolve(r.trim());
    });
  });
}

if (alvo === "oficial") {
  const ok = await perguntar('Isto aplica no banco OFICIAL (ddoctor), sem dados de exemplo. Digite "oficial" para continuar: ');
  if (ok !== "oficial") {
    console.log("Cancelado.");
    process.exit(0);
  }
}

const senha = await perguntarEscondido(`Senha do banco do projeto ${alvo === "teste" ? "ddoctor-teste" : "ddoctor"} (não aparece ao digitar): `);
if (!senha) {
  console.error("Sem senha, nada foi feito.");
  process.exit(2);
}

const sql = postgres({
  host: projeto.host,
  port: 5432,
  database: "postgres",
  username: `postgres.${projeto.ref}`,
  password: senha,
  ssl: "require",
  max: 1,
  prepare: false,
  onnotice: () => {},
  connect_timeout: 20,
});

let etapa = "conexão";
try {
  await sql`select 1`;
  console.log(`✔ conectado ao ${alvo}`);

  const migrations = readdirSync(join(raiz, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const arquivo of migrations) {
    etapa = arquivo;
    await sql.unsafe(ler(join("migrations", arquivo)));
    console.log(`✔ ${arquivo}`);
  }

  etapa = "seed/producao.sql";
  await sql.unsafe(ler("seed/producao.sql"));
  console.log("✔ seed padrão (tipos de serviço, checklist, categorias, configuração)");

  if (projeto.seedTeste) {
    etapa = "seed/teste.sql";
    await sql.unsafe(ler("seed/teste.sql"));
    console.log("✔ dados de exemplo (só no teste)");
  }

  etapa = "checagens.sql";
  const resultados = await sql.unsafe(ler("checagens.sql"));
  const linhas = (Array.isArray(resultados.at?.(-1)) ? resultados.at(-1) : resultados).filter((l) => l && "ok" in l);
  const falhas = linhas.filter((l) => l.ok !== true);
  for (const l of falhas) console.log(`  ✘ [${l.secao}] ${l.teste}${l.detalhe ? ` — ${l.detalhe}` : ""}`);
  console.log(`\n${linhas.length - falhas.length} de ${linhas.length} checagens ok${falhas.length ? `, ${falhas.length} FALHARAM` : ""}.`);
  if (falhas.length) process.exitCode = 1;
  else console.log("Pronto. Pode avisar no chat.");
} catch (e) {
  const msg = String(e.message || e).replaceAll(senha, "***");
  console.error(`\n✘ Parou em ${etapa}: ${msg}${e.where ? `\n  onde: ${e.where}` : ""}`);
  if (/password authentication failed/i.test(msg)) console.error("  A senha não confere. Rode de novo com a senha do banco (Settings → Database).");
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
