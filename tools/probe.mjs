// Executa uma expressão JS (async) numa página em Chrome headless e imprime o resultado.
// uso: node tools/probe.mjs <url> <width> <height> <waitMs> "<expressão>"
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
const [url, w = "1440", h = "900", waitMs = "6000", expr = "1"] = process.argv.slice(2);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9800 + Math.floor(Math.random() * 400);
const profile = `/tmp/probe-profile-${port}`;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
  ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 780 });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url });
  await sleep(+waitMs);
  const res = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout: 120000 });
  console.log(JSON.stringify(res.result?.result?.value ?? res.result, null, 1));
} finally { ws?.close(); chrome.kill(); await rm(profile, { recursive: true, force: true }).catch(() => {}); }
