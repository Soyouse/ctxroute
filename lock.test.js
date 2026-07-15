#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Tests lock.js — couvre en particulier le bug réel du 15/07/2026 : lock
// jamais acquis sur un checkout FRAIS où le dossier parent n'existe pas
// encore (trouvé en CI, invisible en local car state/ existait déjà).
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { withLock } = require('./lock');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

console.log('lock.test.js\n');

const TMP_ROOT = path.join(__dirname, '.lock-test-tmp');
function freshLockDir(...segments) {
  return path.join(TMP_ROOT, ...segments, '.lock-test');
}

// ⚠️ RÉGRESSION — checkout frais : le PARENT de lockDir n'existe PAS du tout
// (ni state/, ni même .lock-test-tmp/) avant l'appel. C'est EXACTEMENT le
// scénario qui a cassé la CI : sans le fix, mkdirSync(lockDir) lève ENOENT
// (pas EEXIST) → interprété à tort comme erreur fatale → lock jamais acquis.
{
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  ok('TMP_ROOT n\'existe vraiment pas avant le test (précondition)', !fs.existsSync(TMP_ROOT));
  const lockDir = freshLockDir('never-created-before', 'nested', 'deeply');
  const result = withLock(lockDir, () => 'executed', { fallback: 'FALLBACK' });
  ok('withLock réussit sur un chemin dont AUCUN parent n\'existe (régression CI 15/07)', result === 'executed');
  ok('le dossier de lock est bien nettoyé après usage', !fs.existsSync(lockDir));
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
}

// ── Exécution normale : fn() est appelée, sa valeur de retour propagée ──
{
  const lockDir = freshLockDir('normal');
  const result = withLock(lockDir, () => 42);
  ok('withLock retourne la valeur de fn()', result === 42);
  ok('le lock est libéré après usage normal', !fs.existsSync(lockDir));
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
}

// ── fn() qui lève : le lock est TOUJOURS libéré (finally), l'exception propage ──
{
  const lockDir = freshLockDir('throws');
  let threw = false;
  try {
    withLock(lockDir, () => { throw new Error('boom'); });
  } catch (e) {
    threw = e.message === 'boom';
  }
  ok('withLock propage l\'exception de fn()', threw);
  ok('le lock est libéré MÊME si fn() lève (finally)', !fs.existsSync(lockDir));
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
}

// ── Contention : lock déjà pris (dossier existant, mtime récent) → timeout → fallback ──
{
  const lockDir = freshLockDir('contended');
  fs.mkdirSync(lockDir, { recursive: true }); // simule un AUTRE process qui détient déjà le lock
  const result = withLock(lockDir, () => 'never', { timeoutMs: 100, fallback: 'FALLBACK' });
  ok('lock déjà détenu (récent) → timeout → fallback retourné, fn() jamais exécutée', result === 'FALLBACK');
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
}

// ── Lock STALE (mtime vieux = process mort) → forcé et libéré, exécution normale ──
{
  const lockDir = freshLockDir('stale');
  fs.mkdirSync(lockDir, { recursive: true });
  const oldTime = (Date.now() - 60 * 1000) / 1000; // 60s dans le passé, largement > STALE_MS (5s)
  fs.utimesSync(lockDir, oldTime, oldTime);
  const result = withLock(lockDir, () => 'recovered', { timeoutMs: 2000 });
  ok('lock STALE (mtime vieux) → forcé, fn() exécutée normalement', result === 'recovered');
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
