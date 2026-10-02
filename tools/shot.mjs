// Captura de tela via Chrome DevTools Protocol (sem dependências).
// uso: node tools/shot.mjs <out.png> <url> <width> <height> [waitMs]
import { spawn } from "node:child_process";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";

const [out, url, w = "1440", h = "900", waitMs = "6000"] = process.argv.slice(2);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9222 + Math.floor(Math.random() * 500);
const profile = `/tmp/shot-profile-${port}`;
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${w},${h}`, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
    await sleep(200);
  }
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 780 });
  await send("Page.enable");
  await send("Page.navigate", { url });
  await sleep(+waitMs);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(shot.data, "base64"));
  console.log("ok", out);
} finally {
  ws?.close(); chrome.kill(); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
