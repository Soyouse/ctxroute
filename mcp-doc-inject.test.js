#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Tests mcp-doc-inject.js + mcp-doc-reset.js — Harness Node natif (zéro dep).
//
// Spawn les hooks en child process, feed stdin JSON (format Claude Code hooks
// vérifié contre la doc officielle : session_id, tool_name, tool_input,
// hook_event_name), parse stdout JSON, assert. Chaque cas = session_id
// JETABLE isolé → state/mcp-doc-seen-<id>.json nettoyé en fin de run.
//
// Couvre : extraction serverName, mode once/smart/dumb, seuil par défaut
// et par serveur, reset PreCompact, doc absente = silence, outil non-MCP
// ignoré, isolation par session.
//
// Run : `node mcp-doc-inject.test.js` depuis ~/.claude/hooks/
// Exit 0 si tous tests pass. Exit 1 si au moins un fail.
// ═══════════════════════════════════════════════════════════════════════

const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const HOOK = path.join(__dirname, 'mcp-doc-inject.js');
const RESET_HOOK = path.join(__dirname, 'mcp-doc-reset.js');
const STATE_DIR = path.join(__dirname, 'state');
const CONFIG_PATH = path.join(__dirname, 'mcp-doc-config.json');
const DOCS_DIR = path.join(__dirname, 'docs', 'mcp');

let pass = 0, fail = 0;
const sessions = new Set();

function run(hook, payload, env = {}) {
  if (payload.session_id) sessions.add(payload.session_id);
  const r = spawnSync('node', [hook], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { stdout: (r.stdout || '').trim(), status: r.status };
}

function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function callMcp(sessionId, server, tool = 'do_thing', toolInput = {}, env = {}) {
  return run(HOOK, {
    hook_event_name: 'PreToolUse',
    tool_name: `mcp__${server}__${tool}`,
    session_id: sessionId,
    tool_input: toolInput,
  }, env);
}

function callNonMcp(sessionId, toolName = 'Read') {
  return run(HOOK, {
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    session_id: sessionId,
    tool_input: { file_path: '/tmp/x' },
  });
}

function precompact(sessionId) {
  return run(RESET_HOOK, { hook_event_name: 'PreCompact', session_id: sessionId, trigger: 'auto' });
}

const isAllow = (res) => res.stdout.includes('"permissionDecision":"allow"') || res.stdout.includes('"permissionDecision": "allow"');
const wasInjected = (res) => isAllow(res) && res.stdout.includes('additionalContext');

// ── Fixture : doc de test temporaire pour un serveur bidon ──
// ⚠️ Le nom NE DOIT PAS commencer/finir par "_" : serverName() exige un
// premier caractère non-underscore (même contrainte que les vrais noms
// mcp__stripe__..., mcp__plugin_discord_discord__...). Un nom du type
// "__test__" casse la regex — c'est un piège de FIXTURE, pas un bug du hook.
const TEST_SERVER = 'testserver999';
const TEST_DOC_PATH = path.join(DOCS_DIR, `${TEST_SERVER}.md`);
const CROSS_A_PATH = path.join(DOCS_DIR, 'servera.md');
const CROSS_B_PATH = path.join(DOCS_DIR, 'serverb.md');
fs.mkdirSync(DOCS_DIR, { recursive: true });
fs.writeFileSync(TEST_DOC_PATH, '# Doc de test\nInvariant bidon pour les tests.\n');
fs.writeFileSync(CROSS_A_PATH, '# Doc serverA\nInvariant bidon A.\n');
fs.writeFileSync(CROSS_B_PATH, '# Doc serverB\nInvariant bidon B.\n');

// ── Fixture : config de test isolée (override temporaire du fichier réel) ──
const ORIGINAL_CONFIG = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : null;
function setConfig(obj) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(obj));
}

console.log('mcp-doc-inject.test.js\n');

// ── Test 1 — 1er appel MCP → injecte (tous modes) ──
{
  setConfig({ mode: 'smart', defaultThreshold: 4, servers: {} });
  const s = 'test-first-1';
  ok('1er appel mcp__server__tool → injecté', wasInjected(callMcp(s, TEST_SERVER)));
}

// ── Test 2 — mode "once" : 2e appel immédiat → PAS réinjecté ──
{
  setConfig({ mode: 'once', defaultThreshold: 4, servers: {} });
  const s = 'test-once-2';
  callMcp(s, TEST_SERVER);
  const second = callMcp(s, TEST_SERVER);
  ok('mode once : 2e appel immédiat → pas réinjecté', !wasInjected(second));
}

// ── Test 3 — mode "dumb" : CHAQUE appel réinjecte ──
{
  setConfig({ mode: 'dumb', defaultThreshold: 4, servers: {} });
  const s = 'test-dumb-3';
  callMcp(s, TEST_SERVER);
  const second = callMcp(s, TEST_SERVER);
  const third = callMcp(s, TEST_SERVER);
  ok('mode dumb : 2e appel réinjecte', wasInjected(second));
  ok('mode dumb : 3e appel réinjecte aussi', wasInjected(third));
}

// ── Test 4 — mode "smart" : sous le seuil → pas réinjecté ──
{
  setConfig({ mode: 'smart', defaultThreshold: 4, servers: {} });
  const s = 'test-smart-under-4';
  callMcp(s, TEST_SERVER); // injecte, sinceLastCall=0
  callNonMcp(s); callNonMcp(s); // 2 appels non-MCP (< seuil 4)
  const again = callMcp(s, TEST_SERVER);
  ok('mode smart : 2 appels non-MCP < seuil 4 → pas réinjecté', !wasInjected(again));
}

// ── Test 5 — mode "smart" : au-dessus du seuil → réinjecté ──
{
  setConfig({ mode: 'smart', defaultThreshold: 3, servers: {} });
  const s = 'test-smart-over-5';
  callMcp(s, TEST_SERVER); // injecte, sinceLastCall=0
  callNonMcp(s); callNonMcp(s); callNonMcp(s); // 3 appels non-MCP ≥ seuil 3
  const again = callMcp(s, TEST_SERVER);
  ok('mode smart : 3 appels non-MCP ≥ seuil 3 → réinjecté', wasInjected(again));
}

// ── Test 6 — mode "smart" : compteur remis à 0 après réinjection ──
{
  setConfig({ mode: 'smart', defaultThreshold: 2, servers: {} });
  const s = 'test-smart-reset-6';
  callMcp(s, TEST_SERVER);
  callNonMcp(s); callNonMcp(s);
  const reinjected = callMcp(s, TEST_SERVER); // réinjecte (2 ≥ seuil 2), compteur repart à 0
  callNonMcp(s); // 1 seul appel non-MCP (< seuil 2)
  const notYet = callMcp(s, TEST_SERVER);
  ok('smart : réinjection au seuil OK', wasInjected(reinjected));
  ok('smart : compteur repart à 0 après réinjection → pas réinjecté au 1er appel suivant', !wasInjected(notYet));
}

// ── Test 7 — seuil par serveur (override) prime sur defaultThreshold ──
{
  setConfig({ mode: 'smart', defaultThreshold: 10, servers: { [TEST_SERVER]: { threshold: 1 } } });
  const s = 'test-override-7';
  callMcp(s, TEST_SERVER);
  callNonMcp(s); // 1 appel non-MCP ≥ seuil serveur (1), très en dessous de defaultThreshold (10)
  const again = callMcp(s, TEST_SERVER);
  ok('override threshold serveur=1 prime sur defaultThreshold=10 → réinjecté', wasInjected(again));
}

// ── Test 7b — compteurs INDÉPENDANTS entre serveurs : appeler un AUTRE MCP
// fait avancer le compteur du serveur courant (pas seulement les outils natifs).
{
  setConfig({ mode: 'smart', defaultThreshold: 2, servers: {} });
  const s = 'test-cross-mcp-7b';
  callMcp(s, 'servera'); // injecte A, sinceLastCall(A)=0
  callMcp(s, 'serverb'); // B est "étranger" à A → sinceLastCall(A)=1 ; injecte B (1er appel), sinceLastCall(B)=0
  const stillUnder = callMcp(s, 'servera'); // sinceLastCall(A) était 1 < seuil 2 → pas réinjecté ; reset à 0
  ok('appel à un AUTRE MCP fait avancer le compteur du serveur courant, mais 1 < seuil 2 → pas encore réinjecté', !wasInjected(stillUnder));

  callMcp(s, 'serverb'); // B étranger à A → sinceLastCall(A)=1
  callMcp(s, 'serverb'); // rappeler B (déjà vu) : B étranger à A → sinceLastCall(A)=2 ≥ seuil 2
  const reinjectedA = callMcp(s, 'servera');
  ok('2 appels à un AUTRE serveur (B) ≥ seuil 2 → A réinjecté', wasInjected(reinjectedA));
}

// ── Test 7c — appeler un serveur NE fait PAS avancer son PROPRE compteur ──
// (un appel à Stripe ne doit jamais compter comme "étranger à Stripe" lui-même).
{
  setConfig({ mode: 'smart', defaultThreshold: 2, servers: {} });
  const s = 'test-self-not-foreign-7c';
  callMcp(s, TEST_SERVER); // injecte, sinceLastCall=0
  callMcp(s, TEST_SERVER); // rappel de LUI-MÊME : ne doit pas s'auto-incrémenter
  callMcp(s, TEST_SERVER); // idem
  const stillNotInjected = callMcp(s, TEST_SERVER);
  ok('un serveur rappelé en boucle ne s\'auto-incrémente jamais → jamais réinjecté (seuil non atteint par lui-même)', !wasInjected(stillNotInjected));
}

// ── Test 7d — filterMode "whitelist" : seul un serveur listé est couvert ──
{
  setConfig({ mode: 'dumb', defaultThreshold: 4, filterMode: 'whitelist', filterList: [TEST_SERVER], servers: {} });
  const s = 'test-whitelist-7d';
  const inList = callMcp(s, TEST_SERVER);
  const outOfList = callMcp(s, 'servera');
  ok('whitelist : serveur listé → injecté', wasInjected(inList));
  ok('whitelist : serveur NON listé → jamais injecté (exclu)', !wasInjected(outOfList) && outOfList.status === 0);
}

// ── Test 7e — filterMode "blacklist" : tout couvert SAUF les serveurs listés ──
{
  setConfig({ mode: 'dumb', defaultThreshold: 4, filterMode: 'blacklist', filterList: [TEST_SERVER], servers: {} });
  const s = 'test-blacklist-7e';
  const blacklisted = callMcp(s, TEST_SERVER);
  const stillCovered = callMcp(s, 'servera');
  ok('blacklist : serveur listé → jamais injecté (exclu)', !wasInjected(blacklisted) && blacklisted.status === 0);
  ok('blacklist : serveur NON listé → toujours couvert/injecté', wasInjected(stillCovered));
}

// ── Test 7f — serveur exclu par le filtre compte quand même comme "étranger" pour les autres ──
{
  setConfig({ mode: 'smart', defaultThreshold: 1, filterMode: 'blacklist', filterList: ['serverb'], servers: {} });
  const s = 'test-filtered-foreign-7f';
  callMcp(s, 'servera'); // injecte A, sinceLastCall(A)=0
  callMcp(s, 'serverb'); // B exclu par blacklist : pas d'injection/état pour B, MAIS compte comme étranger pour A
  const reinjected = callMcp(s, 'servera'); // sinceLastCall(A) doit être 1 ≥ seuil 1
  ok('appel à un serveur EXCLU par le filtre fait quand même avancer le compteur des serveurs actifs', wasInjected(reinjected));
}

// ── Test 7g — mode PAR SERVEUR écrase le mode global ──
{
  setConfig({ mode: 'once', defaultThreshold: 4, servers: { [TEST_SERVER]: { mode: 'dumb' } } });
  const s = 'test-permode-7g';
  callMcp(s, TEST_SERVER); // 1er appel
  const second = callMcp(s, TEST_SERVER); // mode global = once (n'aurait pas réinjecté), mais override serveur = dumb
  const otherServerSecond = (() => { // un AUTRE serveur, sans override, doit respecter le mode global "once"
    callMcp(s, 'servera');
    return callMcp(s, 'servera');
  })();
  ok('mode par serveur "dumb" écrase le mode global "once" pour CE serveur', wasInjected(second));
  ok('un serveur sans override reste sur le mode global "once" → pas réinjecté', !wasInjected(otherServerSecond));
}

// ── Test 8 — PreCompact reset : après reset, réinjecte comme un 1er appel ──
{
  setConfig({ mode: 'once', defaultThreshold: 4, servers: {} });
  const s = 'test-precompact-8';
  callMcp(s, TEST_SERVER);
  const beforeReset = callMcp(s, TEST_SERVER);
  precompact(s);
  const afterReset = callMcp(s, TEST_SERVER);
  ok('mode once avant compaction : pas réinjecté', !wasInjected(beforeReset));
  ok('après PreCompact : réinjecté comme un contexte neuf', wasInjected(afterReset));
}

// ── Test 9 — serveur sans doc.md → jamais d'injection, jamais d'erreur ──
{
  setConfig({ mode: 'dumb', defaultThreshold: 4, servers: {} });
  const s = 'test-nodoc-9';
  const res = callMcp(s, 'serversansdoc');
  ok('serveur sans docs/mcp/*.md → pas d\'injection, exit propre', !wasInjected(res) && res.status === 0);
}

// ── Test 10 — outil non-MCP (pas de préfixe mcp__) → ignoré silencieusement ──
{
  const s = 'test-nonmcp-10';
  const res = callNonMcp(s, 'Bash');
  ok('outil non-MCP (Bash) → exit propre, aucune sortie de décision', res.status === 0 && !res.stdout.includes('permissionDecision'));
}

// ── Test 11 — isolation par session : compteur/état d'une session invisible dans une autre ──
{
  setConfig({ mode: 'once', defaultThreshold: 4, servers: {} });
  const a = 'test-iso-A-11', b = 'test-iso-B-11';
  callMcp(a, TEST_SERVER); // injecté + marqué vu en A
  const firstInB = callMcp(b, TEST_SERVER); // toujours "1er appel" en B
  ok('session B voit un 1er appel indépendant de la session A → injecté', wasInjected(firstInB));
}

// ── Test 12 — granularité OUTIL : docs/mcp/{server}/{tool}.md, en PLUS du serveur ──
{
  setConfig({ mode: 'dumb', defaultThreshold: 4, servers: {} });
  const s = 'test-tool-granularity-12';
  const toolDir = path.join(DOCS_DIR, TEST_SERVER);
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(path.join(toolDir, 'special_action.md'), '# Doc spécifique à special_action\n');
  const specific = callMcp(s, TEST_SERVER, 'special_action');
  const generic = callMcp(s, TEST_SERVER, 'other_action');
  ok('outil "special_action" → doc serveur ET doc outil concaténées', wasInjected(specific) && specific.stdout.includes('spécifique à special_action') && specific.stdout.includes('Doc de test'));
  ok('outil "other_action" (pas de doc dédiée) → SEULE la doc serveur', wasInjected(generic) && !generic.stdout.includes('spécifique à special_action'));
  fs.rmSync(toolDir, { recursive: true, force: true });
}

// ── Test 13 — granularité PARAMÈTRE (proxy MCP type Odoo) : subToolParam ──
{
  setConfig({ mode: 'dumb', defaultThreshold: 4, servers: { [TEST_SERVER]: { subToolParam: 'args.tool' } } });
  const s = 'test-subtool-13';
  const toolDir = path.join(DOCS_DIR, TEST_SERVER);
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(path.join(toolDir, 'delete_record.md'), '# Doc spécifique à delete_record\nDANGER suppression.\n');
  const dangerous = callMcp(s, TEST_SERVER, 'odoo_call', { args: { tool: 'delete_record', model: 'res.partner' } });
  const safe = callMcp(s, TEST_SERVER, 'odoo_call', { args: { tool: 'search_records', model: 'res.partner' } });
  ok('sous-outil "delete_record" (paramètre) → doc ciblée injectée', wasInjected(dangerous) && dangerous.stdout.includes('DANGER suppression'));
  ok('sous-outil "search_records" (pas de doc dédiée) → pas de doc DANGER', wasInjected(safe) && !safe.stdout.includes('DANGER suppression'));
  fs.rmSync(toolDir, { recursive: true, force: true });
}

// ── Test 14 — sans subToolParam configuré, le paramètre est ignoré (rétro-compat) ──
{
  setConfig({ mode: 'dumb', defaultThreshold: 4, servers: {} }); // pas de subToolParam
  const s = 'test-no-subtool-config-14';
  const toolDir = path.join(DOCS_DIR, TEST_SERVER);
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(path.join(toolDir, 'delete_record.md'), '# Ne doit jamais apparaître sans config\n');
  const res = callMcp(s, TEST_SERVER, 'odoo_call', { args: { tool: 'delete_record' } });
  ok('sans subToolParam configuré → le paramètre args.tool est ignoré (pas de faux positif)', wasInjected(res) && !res.stdout.includes('Ne doit jamais apparaître'));
  fs.rmSync(toolDir, { recursive: true, force: true });
}

// ── Test 15 — config.json CASSÉ (JSON invalide) → fail-open sur les défauts, jamais de crash ──
{
  const s = 'test-broken-config-15';
  fs.writeFileSync(CONFIG_PATH, '{ this is not valid json !!!');
  const res = callMcp(s, TEST_SERVER);
  ok('config.json invalide → fail-open (défauts appliqués), pas de crash', res.status === 0 && wasInjected(res));
}

// ── Test 16 — doc.md existante mais VIDE (0 octet après trim) → aucune injection pour ce niveau ──
{
  setConfig({ mode: 'dumb', defaultThreshold: 4, servers: {} });
  const s = 'test-empty-doc-16';
  const emptyServer = 'emptyserver1';
  const emptyPath = path.join(DOCS_DIR, `${emptyServer}.md`);
  fs.writeFileSync(emptyPath, '   \n\n  '); // que du whitespace → trim() = ''
  const res = callMcp(s, emptyServer);
  ok('doc.md vide (whitespace only) → traité comme absente, pas d\'injection, pas de crash', res.status === 0 && !wasInjected(res));
  fs.unlinkSync(emptyPath);
}

// ── Test 17 — purge des state/ périmés : fichier ancien (mtime > TTL) supprimé, récent conservé ──
{
  const s = 'test-gc-old-17', keep = 'test-gc-keep-17';
  setConfig({ mode: 'once', defaultThreshold: 4, servers: {} });
  callMcp(s, TEST_SERVER);    // crée state/mcp-doc-seen-test-gc-old-17.json
  callMcp(keep, TEST_SERVER); // crée state/mcp-doc-seen-test-gc-keep-17.json (restera récent)

  const oldFile = path.join(STATE_DIR, 'mcp-doc-seen-test-gc-old-17.json');
  const oldMtime = (Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000; // 60 jours dans le passé
  fs.utimesSync(oldFile, oldMtime, oldMtime);

  // TTL forcé à 30 jours, probabilité forcée à 1 (déterministe pour le test) via env.
  callMcp('test-gc-trigger-17', TEST_SERVER, 'do_thing', {}, {
    MCP_DOC_GC_PROBABILITY: '1',
    MCP_DOC_GC_TTL_MS: String(30 * 24 * 60 * 60 * 1000),
  });

  ok('fichier state périmé (60j > TTL 30j) → supprimé par la purge', !fs.existsSync(oldFile));
  ok('fichier state récent → conservé par la purge', fs.existsSync(path.join(STATE_DIR, `mcp-doc-seen-${keep}.json`)));
  sessions.add('test-gc-trigger-17');
}

// ── Test 18 — CONCURRENCE RÉELLE : N invocations PARALLÈLES du hook sur la
// MÊME session_id ne doivent perdre AUCUNE écriture (preuve empirique du lock
// cross-process de lock.js, pas juste une lecture de code). ──
function callMcpAsync(sessionId, server, tool = 'do_thing') {
  return new Promise((resolve) => {
    const p = spawn('node', [HOOK]);
    let out = '';
    p.stdout.on('data', (c) => (out += c));
    p.stdin.write(JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: `mcp__${server}__${tool}`,
      session_id: sessionId,
      tool_input: {},
    }));
    p.stdin.end();
    p.on('close', () => resolve(out));
  });
}

async function runConcurrencyTest() {
  setConfig({ mode: 'dumb', defaultThreshold: 4, servers: {} });
  const s = 'test-concurrency-18';
  sessions.add(s);
  const N_SERVERS = 5, N_CALLS = 20;
  const dirs = [];
  for (let i = 0; i < N_SERVERS; i++) {
    const d = path.join(DOCS_DIR, `concserver${i}`);
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.writeFileSync(`${d}.md`, `# doc concserver${i}\n`);
    dirs.push(`${d}.md`);
  }
  const calls = [];
  for (let i = 0; i < N_CALLS; i++) calls.push(callMcpAsync(s, `concserver${i % N_SERVERS}`));
  await Promise.all(calls);

  const stateFile = path.join(STATE_DIR, `mcp-doc-seen-${s}.json`);
  let seenCount = 0;
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    seenCount = Object.keys(state).filter((k) => state[k] && state[k].seen).length;
  } catch { /* seenCount reste 0 → test échoue proprement */ }

  ok(`concurrence : ${N_CALLS} appels parallèles sur ${N_SERVERS} serveurs → AUCUNE écriture perdue (lock cross-process)`, seenCount === N_SERVERS);

  for (const d of dirs) { try { fs.unlinkSync(d); } catch {} }
}

// ── Cleanup synchrone (avant la partie async) ──
try { fs.unlinkSync(TEST_DOC_PATH); } catch {}
try { fs.unlinkSync(CROSS_A_PATH); } catch {}
try { fs.unlinkSync(CROSS_B_PATH); } catch {}

(async () => {
  await runConcurrencyTest();

  if (ORIGINAL_CONFIG !== null) fs.writeFileSync(CONFIG_PATH, ORIGINAL_CONFIG);
  else { try { fs.unlinkSync(CONFIG_PATH); } catch {} }
  for (const s of sessions) {
    const safe = String(s).replace(/[^a-zA-Z0-9_-]/g, '');
    const f = path.join(STATE_DIR, `mcp-doc-seen-${safe}.json`);
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    const lockDir = path.join(STATE_DIR, `.lock-${safe}`);
    try { if (fs.existsSync(lockDir)) fs.rmdirSync(lockDir); } catch {}
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})();
