import type { Id } from "@compartilhado/tipos";

/**
 * Armazém das fotos do repositório em memória (demo): IndexedDB nativo, banco `ddoctor-fotos`, store `fotos`
 * (chave = id da foto, valor = { arquivo, miniatura }). Sem IndexedDB (modo privado, jsdom) as fotos ficam
 * só na memória desta aba. No S1/S3 as fotos vão para a Cloudflare R2 (L37) e este arquivo sai de cena.
 */
export interface BlobsFoto {
  arquivo: Blob;
  miniatura: Blob;
}

const BANCO = "ddoctor-fotos";
const STORE = "fotos";

let conexao: Promise<IDBDatabase | null> | null = null;
/** Cópia da sessão: leitura rápida e plano B quando o IndexedDB falha. */
const sessao = new Map<Id, BlobsFoto>();

function abrir(): Promise<IDBDatabase | null> {
  if (!conexao) {
    conexao = new Promise((ok) => {
      try {
        if (typeof indexedDB === "undefined") return ok(null);
        const req = indexedDB.open(BANCO, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => ok(req.result);
        req.onerror = () => ok(null);
        req.onblocked = () => ok(null);
      } catch {
        ok(null);
      }
    });
  }
  return conexao;
}

function pedido<T>(db: IDBDatabase, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((ok, erro) => {
    const tx = db.transaction(STORE, modo);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => ok(req.result);
    tx.onerror = () => erro(tx.error);
    tx.onabort = () => erro(tx.error);
  });
}

/** Guarda os blobs. `persistente: false` = ficou só na memória da aba (aviso fotos_temporarias). */
export async function guardarBlobs(id: Id, blobs: BlobsFoto): Promise<{ persistente: boolean }> {
  sessao.set(id, blobs);
  const db = await abrir();
  if (!db) return { persistente: false };
  try {
    await pedido(db, "readwrite", (s) => s.put(blobs, id));
    return { persistente: true };
  } catch {
    return { persistente: false }; // cota cheia ou modo privado
  }
}

/** Blobs da foto (sessão primeiro, depois IndexedDB); undefined = perdidos. */
export async function lerBlobs(id: Id): Promise<BlobsFoto | undefined> {
  const daSessao = sessao.get(id);
  if (daSessao) return daSessao;
  const db = await abrir();
  if (!db) return undefined;
  try {
    const salvo = await pedido<BlobsFoto | undefined>(db, "readonly", (s) => s.get(id) as IDBRequest<BlobsFoto | undefined>);
    if (salvo) sessao.set(id, salvo);
    return salvo;
  } catch {
    return undefined;
  }
}

export async function apagarBlobs(id: Id): Promise<void> {
  sessao.delete(id);
  const db = await abrir();
  if (!db) return;
  try {
    await pedido(db, "readwrite", (s) => s.delete(id));
  } catch {
    /* segue: a referência já saiu do estado */
  }
}

/** Apaga do IndexedDB o que não está mais no estado (demo regerado em outro dia, foto removida noutra aba). */
export async function apagarOrfaos(manter: ReadonlySet<Id>): Promise<void> {
  const db = await abrir();
  if (!db) return;
  try {
    const chaves = await pedido(db, "readonly", (s) => s.getAllKeys());
    for (const k of chaves) if (typeof k === "string" && !manter.has(k)) await apagarBlobs(k);
  } catch {
    /* sem limpeza desta vez */
  }
}

/** Esvazia tudo (restaurarDemo). */
export async function limparBlobs(): Promise<void> {
  sessao.clear();
  const db = await abrir();
  if (!db) return;
  try {
    await pedido(db, "readwrite", (s) => s.clear());
  } catch {
    /* nada a fazer */
  }
}
