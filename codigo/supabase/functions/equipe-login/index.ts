// Edge Function equipe-login (Deno) — o DONO dá, troca e tira o login de um funcionário (aba Equipe).
// A service_role vem do ambiente da função (SUPABASE_SERVICE_ROLE_KEY, injetada pelo Supabase): nunca no front,
// no repositório, no chat ou em log. A senha nunca é gravada no banco nem na auditoria.
//
// POST /functions/v1/equipe-login   Authorization: Bearer <JWT do usuário logado>
//   { "acao": "definir",     "perfilId": "...", "usuario": "diego", "senha": "********" }  → cria ou troca usuário/senha
//   { "acao": "remover",     "perfilId": "..." }                                           → apaga o usuário do Auth (cadastro fica)
//   { "acao": "sincronizar", "perfilId": "..." }                                           → perfil inativo = login bloqueado (ban)
// Resposta: { ok: true, usuario?, email? } | { ok: false, codigo } (códigos de rotulos.ts → ERRO).
// definir/remover: só o dono. sincronizar: dono e gerente (só espelha perfil.ativo no Auth; chamada depois de
// salvarFuncionario mudar "ativo"). E-mail técnico: <usuario>@equipe.ddoctor.app (emailDeLogin, dominio/equipe.ts).
//
// Deploy (feito pelo Guilherme, à mão): supabase functions deploy equipe-login --project-ref <ref>
// Variável opcional: PAINEL_ORIGENS="https://guirink.github.io,http://localhost:5173" (CORS).
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMINIO_LOGIN = "equipe.ddoctor.app";
const SENHA = { min: 8, max: 72 };
const BANIDO = "876000h"; // ~100 anos
const ORIGENS = (Deno.env.get("PAINEL_ORIGENS") ?? "https://guirink.github.io,http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function cors(origem: string | null): Record<string, string> {
  const permitida = origem && ORIGENS.includes(origem) ? origem : ORIGENS[0];
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function resposta(corpo: Record<string, unknown>, status: number, origem: string | null): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors(origem), "Content-Type": "application/json" } });
}

/** normalizarUsuario + validarUsuario do TS (dominio/equipe.ts), sem a checagem de "em uso" (feita no banco). */
function validarUsuario(texto: unknown): { ok: true; usuario: string } | { ok: false; codigo: string } {
  const usuario = String(texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!usuario) return { ok: false, codigo: "usuario_obrigatorio" };
  if (usuario.length < 3) return { ok: false, codigo: "usuario_curto" };
  if (usuario.length > 30) return { ok: false, codigo: "usuario_longo" };
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(usuario) || usuario.includes("..")) return { ok: false, codigo: "usuario_invalido" };
  return { ok: true, usuario };
}

Deno.serve(async (req) => {
  const origem = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origem) });
  if (req.method !== "POST") return resposta({ ok: false, codigo: "metodo_invalido" }, 405, origem);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const jwt = req.headers.get("Authorization") ?? "";
  if (!jwt.startsWith("Bearer ")) return resposta({ ok: false, codigo: "sem_permissao" }, 401, origem);

  // quem chama (JWT validado pelo Auth)
  const comoUsuario = createClient(url, anon, { global: { headers: { Authorization: jwt } }, auth: { persistSession: false } });
  const { data: quem, error: erroQuem } = await comoUsuario.auth.getUser(jwt.slice(7));
  if (erroQuem || !quem?.user) return resposta({ ok: false, codigo: "sem_permissao" }, 401, origem);

  const admin = createClient(url, servico, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: chamador } = await admin
    .from("perfil")
    .select("id, oficina_id, papel, ativo, login_desativado_em")
    .eq("auth_user_id", quem.user.id)
    .maybeSingle();
  if (!chamador || !chamador.ativo || chamador.login_desativado_em) return resposta({ ok: false, codigo: "sem_permissao" }, 403, origem);

  let corpo: { acao?: string; perfilId?: string; usuario?: string; senha?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ ok: false, codigo: "pedido_invalido" }, 400, origem);
  }
  const acao = corpo.acao;
  const podeAgir = chamador.papel === "dono" || (acao === "sincronizar" && chamador.papel === "gestor");
  if (!podeAgir) return resposta({ ok: false, codigo: "sem_permissao" }, 403, origem);

  const { data: alvo } = await admin
    .from("perfil")
    .select("id, oficina_id, nome, papel, ativo, usuario, auth_user_id")
    .eq("id", corpo.perfilId ?? "")
    .eq("oficina_id", chamador.oficina_id)
    .maybeSingle();
  if (!alvo) return resposta({ ok: false, codigo: "perfil_inexistente" }, 404, origem);

  const auditar = (acaoAud: string, resumo: string) =>
    admin.from("evento_auditoria").insert({
      oficina_id: chamador.oficina_id,
      tabela: "perfil",
      registro_id: alvo.id,
      acao: acaoAud,
      resumo,
      perfil_id: chamador.id,
      envolvido_id: alvo.id,
      auth_user_id: quem.user.id,
      origem: "app",
    });

  if (acao === "definir") {
    const u = validarUsuario(corpo.usuario);
    if (!u.ok) return resposta({ ok: false, codigo: u.codigo }, 400, origem);
    const senha = String(corpo.senha ?? "");
    if (senha.length < SENHA.min) return resposta({ ok: false, codigo: "senha_curta" }, 400, origem);
    if (senha.length > SENHA.max) return resposta({ ok: false, codigo: "senha_longa" }, 400, origem);
    const { data: outro } = await admin
      .from("perfil")
      .select("id")
      .eq("oficina_id", chamador.oficina_id)
      .eq("usuario", u.usuario)
      .neq("id", alvo.id)
      .maybeSingle();
    if (outro) return resposta({ ok: false, codigo: "usuario_em_uso" }, 409, origem);
    const email = `${u.usuario}@${DOMINIO_LOGIN}`;
    let authId = alvo.auth_user_id as string | null;
    const criou = !authId;
    if (authId) {
      const { error } = await admin.auth.admin.updateUserById(authId, {
        email,
        password: senha,
        email_confirm: true,
        ban_duration: alvo.ativo ? "none" : BANIDO,
      });
      if (error) return resposta({ ok: false, codigo: /already|exists|registered/i.test(error.message) ? "usuario_em_uso" : "falha_auth" }, 400, origem);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { perfil_id: alvo.id, nome: alvo.nome },
        ...(alvo.ativo ? {} : { ban_duration: BANIDO }),
      });
      if (error || !data.user) return resposta({ ok: false, codigo: error && /already|exists|registered/i.test(error.message) ? "usuario_em_uso" : "falha_auth" }, 400, origem);
      authId = data.user.id;
    }
    const { error: erroPerfil } = await admin
      .from("perfil")
      .update({ auth_user_id: authId, usuario: u.usuario, login_desativado_em: null })
      .eq("id", alvo.id);
    if (erroPerfil) {
      if (criou) await admin.auth.admin.deleteUser(authId!); // não deixa usuário do Auth solto
      return resposta({ ok: false, codigo: erroPerfil.code === "23505" ? "usuario_em_uso" : "falha_banco" }, 400, origem);
    }
    await auditar(criou ? "criar_login" : "trocar_senha", criou ? `Login "${u.usuario}" dado a ${alvo.nome}` : `Login de ${alvo.nome} redefinido ("${u.usuario}")`);
    return resposta({ ok: true, usuario: u.usuario, email }, 200, origem);
  }

  if (acao === "remover") {
    if (alvo.id === chamador.id) return resposta({ ok: false, codigo: "proprio_login" }, 400, origem);
    if (alvo.auth_user_id) {
      const { error } = await admin.auth.admin.deleteUser(alvo.auth_user_id);
      if (error && !/not.?found/i.test(error.message)) return resposta({ ok: false, codigo: "falha_auth" }, 400, origem);
    }
    const { error: erroPerfil } = await admin.from("perfil").update({ auth_user_id: null }).eq("id", alvo.id);
    if (erroPerfil) return resposta({ ok: false, codigo: "falha_banco" }, 400, origem);
    await auditar("tirar_login", `Login de ${alvo.nome} retirado`);
    return resposta({ ok: true }, 200, origem);
  }

  if (acao === "sincronizar") {
    if (alvo.auth_user_id) {
      const { error } = await admin.auth.admin.updateUserById(alvo.auth_user_id, { ban_duration: alvo.ativo ? "none" : BANIDO });
      if (error) return resposta({ ok: false, codigo: "falha_auth" }, 400, origem);
    }
    return resposta({ ok: true }, 200, origem);
  }

  return resposta({ ok: false, codigo: "acao_invalida" }, 400, origem);
});
