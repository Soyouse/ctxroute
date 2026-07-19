// ═══════════════════════════════════════════════════════════════════════
// deadline.js — PREUVE, pas déclaration.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Ces tests spawnent de VRAIS process : l'échéance est une propriété du CYCLE
//    DE VIE d'un process. La tester en appelant une fonction en mémoire ne prouve
//    RIEN (c'est exactement le genre de test qui rassure sans protéger).
//    Le seul fait qui compte : « ce process est-il mort, oui ou non ? »
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEADLINE = path.join(__dirname, 'deadline.js').replace(/\\/g, '/');

// Lance un process node avec du code inline, SANS jamais fermer son stdin.
// ⚠️ REPRODUIT LE BUG RÉEL (Claude Code #68626) : stdin ouvert pour toujours.
//    Sans échéance, ce process vivrait indéfiniment — c'est le zombie mesuré.
function spawnStuck(code, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', code], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    const t0 = Date.now();
    const killer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ mort: false, ms: Date.now() - t0, out });
    }, timeoutMs);
    child.on('exit', (code_) => {
      clearTimeout(killer);
      resolve({ mort: true, ms: Date.now() - t0, code: code_, out });
    });
    // ⚠️ On n'appelle JAMAIS child.stdin.end() : c'est tout le sujet.
  });
}

test('SANS échéance, un process au stdin jamais fermé NE MEURT PAS (le bug)', async () => {
  // ⚠️ NEGATIVE-CHECK : prouve que le danger est RÉEL avant de prouver le remède.
  //    Sans ce test, le suivant pourrait passer au vert pour une autre raison.
  const r = await spawnStuck(`process.stdin.on('data', () => {}); process.stdin.on('end', () => process.exit(0));`, 3000);
  assert.strictEqual(r.mort, false, 'le process est mort tout seul → le bug ne se reproduit plus, ce test ne prouve plus rien');
});

test('AVEC échéance, le même process meurt tout seul', async () => {
  const r = await spawnStuck(
    `require('${DEADLINE}').arm({ ms: 400 });
     process.stdin.on('data', () => {});
     process.stdin.on('end', () => process.exit(0));`,
    5000
  );
  assert.strictEqual(r.mort, true, 'ZOMBIE : le process a survécu à son échéance');
  assert.strictEqual(r.code, 0, 'doit sortir en 0 (fail-open — jamais bloquer un outil)');
  assert.ok(r.ms < 3000, `mort en ${r.ms}ms — trop tard`);
});

test('onExpire écrit un rendu best-effort AVANT de sortir', async () => {
  const r = await spawnStuck(
    `require('${DEADLINE}').arm({ ms: 300, onExpire: () => process.stdout.write('PARTIEL') });
     process.stdin.on('data', () => {});`,
    5000
  );
  assert.strictEqual(r.mort, true);
  assert.match(r.out, /PARTIEL/, 'onExpire non appelé — le rendu best-effort est perdu');
});

test('un onExpire qui THROW ne ressuscite PAS le zombie', async () => {
  // ⚠️ La sortie prime TOUJOURS sur le rendu. Une sortie de secours qui peut
  //    échouer n'est pas une sortie de secours.
  const r = await spawnStuck(
    `require('${DEADLINE}').arm({ ms: 300, onExpire: () => { throw new Error('boom'); } });
     process.stdin.on('data', () => {});`,
    5000
  );
  assert.strictEqual(r.mort, true, 'onExpire qui throw a empêché la mort → zombie');
  assert.strictEqual(r.code, 0);
});

test('ZÉRO LATENCE ajoutée quand tout va bien (unref)', async () => {
  // ⚠️ LE test qui protège du remède pire que le mal : sans .unref(), ce process
  //    attendrait les 5000ms complets au lieu de sortir immédiatement.
  const r = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', `require('${DEADLINE}').arm({ ms: 5000 }); process.stdout.write('OK');`]);
    const t0 = Date.now();
    child.on('exit', () => resolve({ ms: Date.now() - t0 }));
  });
  assert.ok(r.ms < 2000, `le process a attendu ${r.ms}ms → unref() cassé, latence sur CHAQUE appel d'outil`);
});
