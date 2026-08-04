// ═══════════════════════════════════════════════════════════════════════
// Tests d'intégration de codex-doc-inject.js (coquille Codex — spawn réel).
// ⚠️ Ne touche JAMAIS le vrai parc : corpus/config/state isolés par env vars.
// ⚠️ Ne re-teste PAS l'orchestration (couverte par doc-inject.test.js via
//    porte-core partagé) — teste UNIQUEMENT le dialecte Codex : dégradation
//    ask, absence de permissionDecision, payload sans agent_id.
// ═══════════════════════════════════════════════════════════════════════

import { test, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOOK = path.join(__dirname, 'codex-doc-inject.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-porte-test-'));
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
        CTXROUTE_FILEDOCS_DIR: DOCS,
        CTXROUTE_STATE_DIR: STATE,
        CTXROUTE_CONFIG_PATH: CONFIG,
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

// Payload Codex réaliste : outils natifs Codex (Bash/apply_patch), pas d'agent_id.
test('DIALECTE : match sur commande Bash Codex → additionalContext SANS permissionDecision', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\nconfirm: true\n---\n# Piège serveur\nNE PAS toucher X.\n');
  const { code, stdout } = await run({ tool_name: 'Bash', tool_input: { command: 'cat C:/proj/server.js' }, session_id: 'cx1', cwd: 'C:/proj' });
  assert.strictEqual(code, 0);
  const out = parseOut(stdout);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  // ⚠️ CONTRAT : jamais de permissionDecision côté Codex (on informe, on ne décide pas).
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, undefined);
  assert.strictEqual(out.hookSpecificOutput.additionalContext, '# Piège serveur\nNE PAS toucher X.\n[source: .claude/hooks/docs/piege.md]');
  assert.strictEqual(out.systemMessage, '📄 doc: piege');
});

test('ASK DÉGRADÉ : écriture apply_patch sur doc confirm → additionalContext préfixé, PAS de ask', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\nconfirm: true\n---\ncontenu\n');
  const { stdout } = await run({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: C:/proj/server.js\n@@\n*** End Patch' }, session_id: 'cx1' });
  const out = parseOut(stdout);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, undefined);
  assert.ok(out.hookSpecificOutput.additionalContext.startsWith('[FICHIER DOCUMENTE — MODIFICATION] Confirmer avant de modifier.\n\n'));
  assert.ok(out.hookSpecificOutput.additionalContext.includes('contenu'));
});

test('SILENCE : aucun match → stdout vide, exit 0', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\n---\ncontenu\n');
  const { code, stdout } = await run({ tool_name: 'Bash', tool_input: { command: 'ls C:/proj/autre' }, session_id: 'cx1' });
  assert.strictEqual(code, 0);
  assert.strictEqual(stdout.trim(), '');
});

test('ÉTAT PARTAGÉ ASSUMÉ (pas d\'agent_id Codex) : smart dédupe sur la clé session simple', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: smart\n---\ncontenu\n');
  const payload = { tool_name: 'Bash', tool_input: { command: 'cat C:/proj/server.js' }, session_id: 'cx-dedup' };
  const r1 = await run(payload);
  assert.ok(parseOut(r1.stdout), 'le 1er appel doit injecter');
  const r2 = await run(payload);
  assert.strictEqual(r2.stdout.trim(), '', 'le 2e appel doit se taire (clé historique sans agent)');
  // La clé de store est la clé SIMPLE (aucun suffixe --agent-) : contrat scopeId sans agent_id.
  const files = fs.readdirSync(STATE).filter((f) => f.startsWith('doc-seen-'));
  assert.deepStrictEqual(files, ['doc-seen-cx-dedup.json']);
});

test('FAIL-OPEN : stdin poubelle → exit 0, stdout vide', async () => {
  const { code, stdout } = await run(null, { raw: '{pas du json' });
  assert.strictEqual(code, 0);
  assert.strictEqual(stdout.trim(), '');
});

test('enabled: false → silence total même sur match', async () => {
  writeDoc('piege.md', '---\nmatch: server.js\nmode: dumb\n---\ncontenu\n');
  fs.writeFileSync(CONFIG, JSON.stringify({ enabled: false }));
  const { stdout } = await run({ tool_name: 'Bash', tool_input: { command: 'cat C:/proj/server.js' }, session_id: 'cx1' });
  assert.strictEqual(stdout.trim(), '');
});
