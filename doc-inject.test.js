// ═══════════════════════════════════════════════════════════════════════
// Tests d'intégration de doc-inject.js (LA PORTE — spawn réel, corpus tmpdir).
// ⚠️ Ne touche JAMAIS le vrai parc : corpus/config/state isolés par env vars.
// ═══════════════════════════════════════════════════════════════════════

import { test, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOOK = path.join(__dirname, 'doc-inject.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'porte-test-'));
const DOCS = path.join(TMP, 'docs');
const STATE = path.join(TMP, 'state');
const CONFIG = path.join(TMP, 'config.json');

function writeDoc(rel, text) {
  const full = path.join(DOCS, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function run(payload, { raw, env } = {}) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [HOOK], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MCP_DOC_FILEDOCS_DIR: DOCS,
        MCP_DOC_STATE_DIR: STATE,
        MCP_DOC_CONFIG_PATH: CONFIG,
        ...env,
      },
    }, (err, stdout) => resolve({ code: err ? err.code : 0, stdout }));
    child.stdin.end(raw !== undefined ? raw : JSON.stringify(payload));
  });
}

function parseOut(stdout) {
  return stdout.trim() === '' ? null : JSON.parse(stdout);
}

beforeEach(() => {
  fs.rmSync(DOCS, { recursive: true, force: true });
  fs.rmSync(STATE, { recursive: true, force: true });
  fs.rmSync(CONFIG, { force: true });
  fs.mkdirSync(DOCS, { recursive: true });
});

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('ALLOW : lecture d\'un fichier documenté → doc injectée, format protect-files', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\nconfirm: true\n---\n# Piège serveur\nNE PAS toucher X.\n');
  const { code, stdout } = await run({ tool_name: 'Read', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 's1' });
  assert.strictEqual(code, 0);
  const out = parseOut(stdout);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.strictEqual(out.hookSpecificOutput.additionalContext, '# Piège serveur\nNE PAS toucher X.\n[source: .claude/hooks/docs/piege.md]');
  assert.strictEqual(out.systemMessage, '📄 doc: piege');
});

test('ASK : écriture (Edit) sur doc confirm: true → permissionDecision ask', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\nconfirm: true\n---\ncontenu\n');
  const { stdout } = await run({ tool_name: 'Edit', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 's1' });
  const out = parseOut(stdout);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask');
  assert.ok(out.hookSpecificOutput.permissionDecisionReason.startsWith('[FICHIER DOCUMENTE — MODIFICATION] Confirmer avant de modifier.\n\n'));
});

test('RUSH via config : confirm=false → allow sur Edit, doc quand même injectée', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\nconfirm: true\n---\ncontenu\n');
  fs.writeFileSync(CONFIG, JSON.stringify({ confirm: false }));
  const { stdout } = await run({ tool_name: 'Edit', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 's1' });
  const out = parseOut(stdout);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.ok(out.hookSpecificOutput.additionalContext.includes('contenu'));
});

test('SILENCE : aucun match → stdout vide, exit 0', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\n---\ncontenu\n');
  const { code, stdout } = await run({ tool_name: 'Read', tool_input: { file_path: 'C:/proj/autre.js' }, session_id: 's1' });
  assert.strictEqual(code, 0);
  assert.strictEqual(stdout.trim(), '');
});

test('DÉDUP smart : 1er appel injecte, rappel immédiat silencieux (état par session)', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: smart\n---\ncontenu\n');
  const payload = { tool_name: 'Read', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 'dedup' };
  const r1 = await run(payload);
  assert.ok(parseOut(r1.stdout), 'le 1er appel doit injecter');
  const r2 = await run(payload);
  assert.strictEqual(r2.stdout.trim(), '', 'le 2e appel immédiat doit se taire (dédup par doc)');
});

test('PARITÉ perf : corpus 100% dumb → AUCUN fichier d\'état écrit', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\nconfirm: true\n---\ncontenu\n');
  await run({ tool_name: 'Read', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 'perf' });
  const files = fs.existsSync(STATE) ? fs.readdirSync(STATE).filter((f) => f.startsWith('doc-seen-')) : [];
  assert.deepStrictEqual(files, []);
});

test('PARITÉ : doc au corps vide = inexistante (pas d\'injection, pas d\'ask)', async () => {
  writeDoc('vide.md', '---\nmatch: server.js\nmode: dumb\nconfirm: true\n---\n');
  const { stdout } = await run({ tool_name: 'Edit', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 's1' });
  assert.strictEqual(stdout.trim(), '');
});

test('enabled: false → silence total même sur match', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\n---\ncontenu\n');
  fs.writeFileSync(CONFIG, JSON.stringify({ enabled: false }));
  const { stdout } = await run({ tool_name: 'Read', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 's1' });
  assert.strictEqual(stdout.trim(), '');
});

test('FAIL-OPEN : stdin poubelle et corpus absent → exit 0, stdout vide', async () => {
  fs.rmSync(DOCS, { recursive: true, force: true });
  const r1 = await run(null, { raw: '{pas du json' });
  assert.strictEqual(r1.code, 0);
  assert.strictEqual(r1.stdout.trim(), '');
  const r2 = await run({ tool_name: 'Read', tool_input: { file_path: 'x' }, session_id: 's1' });
  assert.strictEqual(r2.code, 0);
  assert.strictEqual(r2.stdout.trim(), '');
});

// ⚠️ `retry: 2` — PAS un cache-misère : sous charge extrême (CI saturée), le
//    timeout du lock (2 s) peut légitimement déclencher le FAIL-OPEN contractuel
//    (décider sans état > bloquer le hook) → 1 incrément non écrit = comportement
//    VOULU, pas un bug (flakes mesurés : local 18/07 + CI windows 18/07). Un VRAI
//    bug de lock (write non atomique) perd des incréments à CHAQUE run → échoue
//    les 3 tentatives → le test mord toujours. NE JAMAIS élargir ce retry aux
//    autres tests ni toucher au timeout du lock pour « stabiliser » (latence prod).
test('CONCURRENCE réelle : 10 appels parallèles étrangers → AUCUN incrément perdu (lock)', { retry: 2, timeout: 60000 }, async () => {
  writeDoc('a.md', '---\nmatch: aaa.js\nmode: smart\n---\ndoc A\n');
  writeDoc('b.md', '---\nmatch: bbb.js\nmode: smart\n---\ndoc B\n');
  const sid = 'conc';
  // ⚠️ Timeout de lock RELEVÉ (env test, cf lock.js) : on prouve l'ATOMICITÉ,
  //    pas la disponibilité — 2 s expirent légitimement sous charge (fail-open).
  const env = { MCP_DOC_LOCK_TIMEOUT_MS: '20000' };
  // 1er appel : A devient "vue" (compteur 0).
  await run({ tool_name: 'Read', tool_input: { file_path: 'C:/p/aaa.js' }, session_id: sid }, { env });
  // 10 appels PARALLÈLES matchant B = 10 outils étrangers pour A.
  await Promise.all(Array.from({ length: 10 }, () =>
    run({ tool_name: 'Read', tool_input: { file_path: 'C:/p/bbb.js' }, session_id: sid }, { env })));
  const state = JSON.parse(fs.readFileSync(path.join(STATE, 'doc-seen-conc.json'), 'utf8'));
  assert.strictEqual(state['docs/a.md'].sinceLastCall, 10, 'écriture perdue sous concurrence = lock cassé');
});

test('Bash git : jamais d\'injection (faux positifs des messages de commit)', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\n---\ncontenu\n');
  const { stdout } = await run({ tool_name: 'Bash', tool_input: { command: 'git commit -m "fix server.js"' }, session_id: 's1' });
  assert.strictEqual(stdout.trim(), '');
});

// ── MCP : le frontmatter de LA doc écrase la cadence globale (contrat de
//    frontière adaptateur→declFor — décision mainteneur 17/07/2026, JSON = global only) ──
test('MCP : frontmatter `mode: dumb` → réinjecté à CHAQUE appel malgré global `once`', async () => {
  const MCPDOCS = path.join(TMP, 'mcpdocs');
  fs.rmSync(MCPDOCS, { recursive: true, force: true });
  fs.mkdirSync(MCPDOCS, { recursive: true });
  fs.writeFileSync(path.join(MCPDOCS, 'srv.md'), '---\nmode: dumb\n---\nPIEGE-SRV\n');
  fs.writeFileSync(path.join(MCPDOCS, 'ctrl.md'), 'PIEGE-CTRL\n');
  fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'once', defaultThreshold: 4 }));
  const env = { MCP_DOC_DOCS_DIR: MCPDOCS };

  const p1 = { tool_name: 'mcp__srv__ping', tool_input: {}, session_id: 'fm-mcp' };
  const r1 = await run(p1, { env });
  const c1 = parseOut(r1.stdout).hookSpecificOutput.additionalContext;
  assert.ok(c1.includes('PIEGE-SRV'), '1er appel : doc frontmatter injectée');

  const r2 = await run(p1, { env });
  const out2 = parseOut(r2.stdout);
  const c2 = out2 ? out2.hookSpecificOutput.additionalContext : '';
  assert.ok(c2.includes('PIEGE-SRV'), '2e appel : dumb (frontmatter) réinjecte malgré global once');

  const rc1 = await run({ tool_name: 'mcp__ctrl__ping', tool_input: {}, session_id: 'fm-mcp' }, { env });
  assert.ok(parseOut(rc1.stdout).hookSpecificOutput.additionalContext.includes('PIEGE-CTRL'), 'contrôle : 1er appel injecte');
  const rc2 = await run({ tool_name: 'mcp__ctrl__ping', tool_input: {}, session_id: 'fm-mcp' }, { env });
  const oc2 = parseOut(rc2.stdout);
  assert.ok(!oc2 || !String(oc2.hookSpecificOutput.additionalContext || '').includes('PIEGE-CTRL'),
    'contrôle : doc SANS frontmatter suit le global once (pas de réinjection)');
});

// ── driftUnit turn — BOUT-EN-BOUT (18/07/2026) : skill smart/turn, compteur
//    de tours alimenté par turn-count.js, réinjection APRÈS N tours, jamais
//    par les appels d'outils. C'est le test de FRONTIÈRE des 3 portes
//    (turn-count → store → doc-inject/gate). ──
test('TURN : skill smart driftUnit turn — réinjecté après N TOURS, insensible aux outils', async () => {
  fs.writeFileSync(CONFIG, JSON.stringify({
    skills: { turnskill: { match: ['proj-turn'], mode: 'smart', threshold: 1, driftUnit: 'turn' } },
  }));
  const payload = { tool_name: 'Read', tool_input: { file_path: 'C:/proj-turn/x.js' }, session_id: 'sturn' };
  const env = { MCP_DOC_FILEDOCS_DIR: DOCS, MCP_DOC_STATE_DIR: STATE, MCP_DOC_CONFIG_PATH: CONFIG };

  // Tour 0 : 1er match → pointeur injecté.
  const r1 = parseOut((await run(payload)).stdout);
  assert.ok(r1.hookSpecificOutput.additionalContext.includes('turnskill'));
  // Re-match au même tour + outils étrangers : SILENCE (l'unité est le tour).
  assert.strictEqual(parseOut((await run(payload)).stdout), null);
  await run({ tool_name: 'Bash', tool_input: { command: 'ls' }, session_id: 'sturn' });
  assert.strictEqual(parseOut((await run(payload)).stdout), null);

  // Un TOUR s'écoule (spawn réel de turn-count.js — la vraie porte, pas un
  // faux state écrit à la main : test de frontière, jamais de doublon de format).
  const rt = await new Promise((resolve) => {
    const child = execFile(process.execPath, [path.join(__dirname, 'turn-count.js')], {
      encoding: 'utf8', env: { ...process.env, ...env },
    }, (err, stdout) => resolve({ code: err ? err.code : 0, stdout }));
    child.stdin.end(JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'sturn', prompt: 'x' }));
  });
  assert.strictEqual(rt.code, 0);
  assert.strictEqual(rt.stdout.trim(), '');

  // threshold 1, 1 tour écoulé → RÉINJECTION.
  const r2 = parseOut((await run(payload)).stdout);
  assert.ok(r2 && r2.hookSpecificOutput.additionalContext.includes('turnskill'));
  // Et le rappel réarme : silence à nouveau au même tour.
  assert.strictEqual(parseOut((await run(payload)).stdout), null);
});

// ── CORPS DU SKILL injecté (décision mainteneur 18/07/2026 — plus un pointeur) ──
test('SKILL : le CONTENU du skill est injecté (lu en direct, frontmatter strippé) ; fichier absent = fallback pointeur', async () => {
  const skillsDir = path.join(TMP, 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.writeFileSync(path.join(skillsDir, 'monprojet.md'),
    '---\ndescription: meta harnais\n---\n# Skill monprojet\nINVARIANT_DU_SKILL ici.\n');
  fs.writeFileSync(CONFIG, JSON.stringify({
    skills: {
      monprojet: { match: ['proj-corps'], mode: 'dumb' },
      fantome: { match: ['proj-fantome'], mode: 'dumb' },
    },
  }));
  const env = { MCP_DOC_SKILLS_DIR: skillsDir };
  // Skill existant → son CORPS (sans le frontmatter du harnais), pas un pointeur.
  const r1 = parseOut((await run({ tool_name: 'Read', tool_input: { file_path: 'C:/proj-corps/x.js' }, session_id: 'sk1' }, { env })).stdout);
  assert.ok(r1.hookSpecificOutput.additionalContext.includes('INVARIANT_DU_SKILL'));
  assert.ok(!r1.hookSpecificOutput.additionalContext.includes('description: meta harnais'));
  assert.ok(!r1.hookSpecificOutput.additionalContext.includes('charge-le via l\'outil Skill'));
  // Fichier de skill ABSENT → fallback pointeur (le périmètre signale quand même).
  const r2 = parseOut((await run({ tool_name: 'Read', tool_input: { file_path: 'C:/proj-fantome/x.js' }, session_id: 'sk1' }, { env })).stdout);
  assert.ok(r2.hookSpecificOutput.additionalContext.includes('fantome'));
  assert.ok(r2.hookSpecificOutput.additionalContext.includes('Skill'));
});

// ── DÉCLENCHEUR `tool:` (19/07/2026) — outils natifs sans chemin ni mcp__ ──
// Angle mort prouvé par spawn : WebFetch/WebSearch = silence total avant.
test('TOOL : doc `tool: WebFetch` injectée sur WebFetch, silencieuse sur Read', async () => {
  writeDoc('web-recherche.md', '---\ntool: [WebFetch, WebSearch]\nmode: dumb\n---\nCONSIGNE_WEB_2026\n');
  const r1 = parseOut((await run({ tool_name: 'WebFetch', tool_input: { url: 'https://docs.x.ai', prompt: 'x' }, session_id: 'st1' })).stdout);
  assert.ok(r1.hookSpecificOutput.additionalContext.includes('CONSIGNE_WEB_2026'));
  assert.ok(r1.hookSpecificOutput.additionalContext.includes('[source: .claude/hooks/docs/web-recherche.md]'));
  const r2 = parseOut((await run({ tool_name: 'WebSearch', tool_input: { query: 'q' }, session_id: 'st1' })).stdout);
  assert.ok(r2.hookSpecificOutput.additionalContext.includes('CONSIGNE_WEB_2026'));
  // Nom d'outil ≠ liste → silence (match EXACT, jamais substring).
  assert.strictEqual(parseOut((await run({ tool_name: 'Read', tool_input: { file_path: 'C:/x/WebFetch.js' }, session_id: 'st1' })).stdout), null);
});

test('TOOL : dédup docId — une doc `match`+`tool` matchée par les 2 sources = injectée UNE fois', async () => {
  writeDoc('mixte.md', '---\nmatch: server.js\ntool: [Read]\nmode: dumb\n---\nCORPS_MIXTE\n');
  const out = parseOut((await run({ tool_name: 'Read', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 'st2' })).stdout);
  const occurrences = out.hookSpecificOutput.additionalContext.split('CORPS_MIXTE').length - 1;
  assert.strictEqual(occurrences, 1);
});

// ── SCOPE PAR AGENT (19/07/2026) — chaque agent = un contexte = un état ──
// Trou prouvé le 19/07/2026 : état `once` keyé session_id seul + session_id
// PARTAGÉ maître/sous-agents (contrat harnais) ⇒ le maître consommait le
// skill et les sous-agents ne recevaient RIEN, en silence. Ces tests scellent
// la séparation ; les retirer = rouvrir le trou.
test('SOUS-AGENT : le `once` consommé par le maître N\'ÉTEINT PAS le sous-agent (états séparés)', async () => {
  writeDoc('unique.md', '---\nmatch: server.js\nmode: once\n---\nCONTENU_ONCE\n');
  const base = { tool_name: 'Read', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 'sagent' };
  // Maître : 1re injection puis silence (once).
  assert.ok(parseOut((await run(base)).stdout).hookSpecificOutput.additionalContext.includes('CONTENU_ONCE'));
  assert.strictEqual(parseOut((await run(base)).stdout), null);
  // Sous-agent A (agent_id présent, MÊME session_id) : état VIERGE → injection.
  const subA = { ...base, agent_id: 'aaa111', agent_type: 'Explore' };
  assert.ok(parseOut((await run(subA)).stdout).hookSpecificOutput.additionalContext.includes('CONTENU_ONCE'));
  assert.strictEqual(parseOut((await run(subA)).stdout), null); // once respecté DANS l'agent A
  // Sous-agent B distinct : état vierge aussi.
  const subB = { ...base, agent_id: 'bbb222', agent_type: 'general-purpose' };
  assert.ok(parseOut((await run(subB)).stdout).hookSpecificOutput.additionalContext.includes('CONTENU_ONCE'));
  // Et le maître reste éteint (le sous-agent n'a pas pollué son état).
  assert.strictEqual(parseOut((await run(base)).stdout), null);
});

test('SOUS-AGENT : PreCompact maître purge le store du maître ET ceux des sous-agents ; PreCompact sous-agent = purge ciblée', async () => {
  writeDoc('unique.md', '---\nmatch: server.js\nmode: once\n---\nCONTENU_ONCE\n');
  const base = { tool_name: 'Read', tool_input: { file_path: 'C:/proj/server.js' }, session_id: 'sreset' };
  const sub = { ...base, agent_id: 'ccc333', agent_type: 'Explore' };
  await run(base); await run(sub); // les deux états consommés
  const reset = (payload) => new Promise((resolve) => {
    const child = execFile(process.execPath, [path.join(__dirname, 'mcp-doc-reset.js')], {
      encoding: 'utf8', env: { ...process.env, MCP_DOC_STATE_DIR: STATE, MCP_DOC_CONFIG_PATH: CONFIG },
    }, (err) => resolve(err ? err.code : 0));
    child.stdin.end(JSON.stringify(payload));
  });
  // Compaction DANS le sous-agent → SON état seul est purgé.
  assert.strictEqual(await reset({ hook_event_name: 'PreCompact', session_id: 'sreset', agent_id: 'ccc333' }), 0);
  assert.ok(parseOut((await run(sub)).stdout).hookSpecificOutput.additionalContext.includes('CONTENU_ONCE'));
  assert.strictEqual(parseOut((await run(base)).stdout), null); // maître toujours éteint
  // Compaction MAÎTRE → purge par préfixe : maître ET sous-agents réarmés.
  assert.strictEqual(await reset({ hook_event_name: 'PreCompact', session_id: 'sreset' }), 0);
  assert.ok(parseOut((await run(base)).stdout).hookSpecificOutput.additionalContext.includes('CONTENU_ONCE'));
  assert.ok(parseOut((await run(sub)).stdout).hookSpecificOutput.additionalContext.includes('CONTENU_ONCE'));
});
