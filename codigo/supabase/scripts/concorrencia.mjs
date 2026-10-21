// Duas reservas SIMULTÂNEAS na última vaga do dia: exatamente uma passa, a outra recebe sem_vaga (arq. §7.3).
// Precisa de duas conexões reais, então roda contra o ddoctor-teste (não no PGlite). Uso (de codigo/supabase):
//   npm_config_cache=/tmp/npm-cache npm install
//   DATABASE_URL='postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' node scripts/concorrencia.mjs
// A URL vem de Project Settings → Database (Session pooler). Não salve a senha em arquivo nem cole no chat.
// O teste cria um usuário/perfil "Checagem concorrência" e duas OS ZZZ9Y98/ZZZ9Y97 e apaga tudo no fim
// (as linhas de auditoria ficam: são imutáveis por desenho).
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (ver o cabeçalho do arquivo).");
  process.exit(2);
}
const opcoes = { max: 1, prepare: false, onnotice: () => {} };
const admin = postgres(url, opcoes);
const a = postgres(url, opcoes);
const b = postgres(url, opcoes);

const uid = crypto.randomUUID();
let falhou = false;
try {
  const [{ id: of }] = await admin`select id from public.oficina order by criado_em limit 1`;
  await admin`insert into auth.users (id, email, aud, role) values (${uid}, ${`checagem-concorrencia-${uid.slice(0, 8)}@teste.invalid`}, 'authenticated', 'authenticated')`;
  await admin`insert into public.perfil (oficina_id, auth_user_id, nome, papel) values (${of}, ${uid}, 'Checagem concorrência', 'recepcao')`;
  const claims = JSON.stringify({ sub: uid, role: "authenticated" });
  const comoRecepcao = async (sql, fn) =>
    sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true)`;
      return fn(tx);
    });
  const abrir = (placa) =>
    comoRecepcao(admin, async (tx) => {
      const [{ r }] = await tx`select public.criar_atendimento_rapido(${{ placa, clienteNome: "Checagem concorrência", origem: "particular", pecas: [{ peca: "Capô", tecnica: "sra", valor: 1000 }] }}::jsonb) as r`;
      await tx`select public.registrar_aprovacao(${r.osId}, 'checagem')`;
      return r.osId;
    });
  const os1 = await abrir("ZZZ9Y98");
  const os2 = await abrir("ZZZ9Y97");
  // um dia útil à frente, com vagas = ocupadas + 1 (sobra exatamente uma)
  const [{ dia }] = await admin`select public._proximo_dia_util(public._dia(now(), 'America/Sao_Paulo') + 7, c.expediente) as dia from public.config_oficina c where c.oficina_id = ${of}`;
  const [{ n }] = await admin`select public._vagas_ocupadas(${of}, ${dia}, null) as n`;
  await admin`insert into public.capacidade_dia (oficina_id, data, vagas_entrada) values (${of}, ${dia}, ${n + 1})
              on conflict (oficina_id, data) do update set vagas_entrada = excluded.vagas_entrada, bloqueado = null`;

  // A reserva e segura a transação 1,5 s; B tenta no meio: espera a trava do dia e reconta
  const pa = comoRecepcao(a, async (tx) => {
    const [{ r }] = await tx`select public.agendar(${os1}, ${dia}, 'manha') as r`;
    await tx`select pg_sleep(1.5)`;
    return r;
  });
  await new Promise((ok) => setTimeout(ok, 300));
  const pb = comoRecepcao(b, async (tx) => (await tx`select public.agendar(${os2}, ${dia}, 'manha') as r`)[0].r);
  const [ra, rb] = await Promise.all([pa, pb]);
  const oks = [ra, rb].filter((r) => r.ok).length;
  const semVaga = [ra, rb].filter((r) => r.codigo === "sem_vaga").length;
  console.log("A:", JSON.stringify(ra), "\nB:", JSON.stringify(rb));
  if (oks === 1 && semVaga === 1) console.log("✔ exatamente uma reserva passou; a outra recebeu sem_vaga");
  else {
    console.log("✘ esperado 1 ok + 1 sem_vaga");
    falhou = true;
  }
} catch (e) {
  console.error("erro:", e.message);
  falhou = true;
} finally {
  // limpeza (dados de checagem); auditoria fica por ser imutável
  await admin`delete from public.os where veiculo_id in (select id from public.veiculo where placa in ('ZZZ9Y98', 'ZZZ9Y97'))`.catch(() => {});
  await admin`delete from public.veiculo where placa in ('ZZZ9Y98', 'ZZZ9Y97')`.catch(() => {});
  await admin`delete from public.cliente where nome = 'Checagem concorrência'`.catch(() => {});
  await admin`delete from public.perfil where auth_user_id = ${uid}`.catch(() => {});
  await admin`delete from auth.users where id = ${uid}`.catch(() => {});
  await Promise.all([admin.end(), a.end(), b.end()]);
}
process.exit(falhou ? 1 : 0);
