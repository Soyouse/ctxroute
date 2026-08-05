// ═══════════════════════════════════════════════════════════════════════
// shadow-inject.js — PREUVES par spawn réel (faux corpus tmpdir, jamais le vrai parc)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ LES 2 INVARIANTS DU SHADOW, dans cet ordre d'importance :
//    1. IL N'INJECTE JAMAIS (stdout VIDE, toujours) — sinon c'est une bascule
//       déguisée, sans GO. C'est le test le plus important du fichier.
//    2. Il JOURNALISE fidèlement (docs calculées + non-matches) — sinon le
//       reconcile dépouille du vide et le verdict de bascule ne repose sur rien.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';

const HOOK = path.join(__dirname, 'shadow-inject.js');

function faussesDocs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-docs-'));
  fs.writeFileSync(path.join(dir, 'piege.md'), '---\nmatch: fichier-piege.js\nmode: dumb\nrank: 0\n---\n⚠️ invariant\n');
  return dir;
}

function spawnShadow(stdinText, env) {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [HOOK],
      { encoding: 'utf8', env: { ...process.env, ...env } },
      (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout, stderr })
    );
    child.stdin.end(stdinText);
  });
}

test('SHADOW N\'INJECTE JAMAIS — stdout VIDE même sur un match plein', async () => {
  const docs = faussesDocs();
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-state-'));
  const r = await spawnShadow(
    JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'C:/x/fichier-piege.js' } }),
    { CTXROUTE_FILEDOCS_DIR: docs, CTXROUTE_STATE_DIR: state }
  );
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.stdout, '', 'le shadow a ÉMIS quelque chose = bascule déguisée sans GO');
});

test('SHADOW JOURNALISE — docs calculées écrites en JSONL, non-match logué aussi', async () => {
  const docs = faussesDocs();
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-state-'));
  const env = { CTXROUTE_FILEDOCS_DIR: docs, CTXROUTE_STATE_DIR: state };
  await spawnShadow(JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'C:/x/fichier-piege.js' } }), env);
  await spawnShadow(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'C:/x/anodin.txt' } }), env);

  const fichiers = fs.readdirSync(state).filter((f) => f.startsWith('shadow-'));
  assert.strictEqual(fichiers.length, 1, 'un journal par jour');
  const lignes = fs.readFileSync(path.join(state, fichiers[0]), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(lignes.length, 2, 'les NON-matches doivent être logués aussi (divergence « nouveau muet »)');
  assert.deepStrictEqual(lignes[0].docs, ['docs/piege.md']);
  assert.deepStrictEqual(lignes[1].docs, []);
});

test('FAIL-OPEN — stdin poubelle, corpus inexistant : exit 0, stdout vide, zéro throw', async () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-state-'));
  for (const stdin of ['pas du json', '{}', JSON.stringify({ tool_name: 'Edit', tool_input: {} })]) {
    const r = await spawnShadow(stdin, { CTXROUTE_FILEDOCS_DIR: 'C:/nexiste/pas', CTXROUTE_STATE_DIR: state });
    assert.strictEqual(r.code, 0, `exit ≠ 0 sur : ${stdin}`);
    assert.strictEqual(r.stdout, '');
  }
});
