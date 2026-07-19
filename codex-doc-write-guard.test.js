// ═══════════════════════════════════════════════════════════════════════
// Tests d'intégration de codex-doc-write-guard.js (coquille Codex — spawn réel).
// ⚠️ Ne re-teste PAS la validation (couverte par doc-write-guard.test.js via
//    guard-core partagé) — teste UNIQUEMENT le dialecte Codex : chemins
//    extraits du patch apply_patch (tool_input.command), multi-fichiers.
// ═══════════════════════════════════════════════════════════════════════

import { test, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOOK = path.join(__dirname, 'codex-doc-write-guard.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-guard-test-'));
const FILEDOCS = path.join(TMP, 'filedocs');

function run(payload) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [HOOK], {
      encoding: 'utf8',
      env: { ...process.env, MCP_DOC_FILEDOCS_DIR: FILEDOCS },
    }, (err, stdout) => resolve({ code: err ? err.code : 0, stdout }));
    child.stdin.end(JSON.stringify(payload));
  });
}

const patchFor = (...files) => '*** Begin Patch\n' + files.map((f) => `*** Update File: ${f}`).join('\n') + '\n*** End Patch';

beforeEach(() => {
  fs.rmSync(FILEDOCS, { recursive: true, force: true });
  fs.mkdirSync(FILEDOCS, { recursive: true });
});

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('BLOCK : apply_patch (command) sur une doc du parc INVALIDE → decision block + raison', async () => {
  const doc = path.join(FILEDOCS, 'cassee.md');
  fs.writeFileSync(doc, '---\nmach: typo.js\n---\ncontenu\n'); // clé inconnue = invalide
  const { code, stdout } = await run({ tool_name: 'apply_patch', tool_input: { command: patchFor(doc) } });
  assert.strictEqual(code, 0);
  const out = JSON.parse(stdout);
  assert.strictEqual(out.decision, 'block');
  assert.ok(out.reason.includes('cassee.md'));
});

test('SILENCE : doc du parc SAINE → stdout vide', async () => {
  const doc = path.join(FILEDOCS, 'saine.md');
  fs.writeFileSync(doc, '---\nmatch: server.js\nmode: dumb\n---\ncontenu\n');
  const { code, stdout } = await run({ tool_name: 'apply_patch', tool_input: { command: patchFor(doc) } });
  assert.strictEqual(code, 0);
  assert.strictEqual(stdout.trim(), '');
});

test('MULTI-FICHIERS : patch touchant une doc saine PUIS une cassée → block sur la cassée', async () => {
  const saine = path.join(FILEDOCS, 'saine.md');
  const cassee = path.join(FILEDOCS, 'cassee.md');
  fs.writeFileSync(saine, '---\nmatch: a.js\nmode: dumb\n---\nok\n');
  fs.writeFileSync(cassee, '---\nmach: typo.js\n---\nko\n');
  const { stdout } = await run({ tool_name: 'apply_patch', tool_input: { command: patchFor(saine, cassee) } });
  const out = JSON.parse(stdout);
  assert.strictEqual(out.decision, 'block');
  assert.ok(out.reason.includes('cassee.md'));
});

test('HORS PARC : patch sur un fichier quelconque → silence (fail-open)', async () => {
  const { code, stdout } = await run({ tool_name: 'apply_patch', tool_input: { command: patchFor('C:/proj/random.js') } });
  assert.strictEqual(code, 0);
  assert.strictEqual(stdout.trim(), '');
});

test('AUTRE OUTIL : Bash → aucun chemin extrait, silence', async () => {
  const doc = path.join(FILEDOCS, 'cassee.md');
  fs.writeFileSync(doc, '---\nmach: typo.js\n---\nko\n');
  const { stdout } = await run({ tool_name: 'Bash', tool_input: { command: 'echo ' + doc } });
  assert.strictEqual(stdout.trim(), '');
});
