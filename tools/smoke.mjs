// Smoke test de renderizado: lanza Chrome headless, carga la app, espera a que
// React monte las 9 secciones y reporta errores de consola no triviales.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:4188/";
const PORT = 9333;

const ud = mkdtempSync(join(tmpdir(), "chrome-cdp-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox",
  `--user-data-dir=${ud}`, "--remote-debugging-port=" + PORT, "--allow-file-access", URL,
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTargets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return r.json();
}

async function main() {
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await getTargets(); if (targets.some((t) => t.type === "page")) break; } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pend = new Map();
  const errores = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pend.has(msg.id)) { pend.get(msg.id)(msg); pend.delete(msg.id); }
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      const txt = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(" ");
      errores.push(`[console.${msg.params.type}] ${txt}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errores.push(`[exception] ${d.exception?.description ?? d.text}`);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => { const mid = ++id; pend.set(mid, resolve); ws.send(JSON.stringify({ id: mid, method, params })); });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: URL });
  await sleep(9000); // carga + fetch de datos + pintado

  const evalJs = async (expr) => {
    const m = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return m.result?.result?.value;
  };

  const info = await evalJs(`(() => {
    const secs = ["inicio","dataset","pipeline","arquitectura","curvas","resultados","representaciones","demo","dificultades"];
    const found = secs.filter(id => document.getElementById(id));
    return JSON.stringify({
      found,
      navChips: document.querySelectorAll(".nav-chip").length,
      carousels: document.querySelectorAll(".carrusel").length,
      theoryBtns: document.querySelectorAll(".btn-teoria").length,
      svgs: document.querySelectorAll("svg").length,
      covers: document.querySelectorAll("img").length,
      bodyLen: document.body.innerText.length,
      ndcgMentions: (document.body.innerText.match(/0,04/g) || []).length,
      loading: document.body.innerText.includes("ABRIFIENDO"),
    });
  })()`);

  console.log("RENDER:", info);
  const filtered = errores.filter((e) => !/favicon|DevTools|Download the React/i.test(e));
  console.log("ERRORES:", filtered.length ? filtered.slice(0, 10).join("\n") : "ninguno");
  ws.close();
  chrome.kill();
  process.exit(filtered.length ? 1 : 0);
}

main().catch((e) => { console.error("FALLO SMOKE:", e.message); chrome.kill(); process.exit(2); });
