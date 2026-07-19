// ═══════════════════════════════════════════════════════════════════════
// NEGATIVE-CHECK du doctor — prouve qu'il CRIE quand c'est cassé
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RAISON D'ÊTRE : un dead-man switch qui ne se déclenche JAMAIS est pire
// qu'absent — il fabrique une confiance fausse. Vérifier qu'il passe au vert
// sur un repo sain ne prouve RIEN (un `exit(0)` inconditionnel ferait pareil).
// La SEULE preuve valable est le negative-check : CASSER réellement le
// framework et exiger que doctor.js sorte en ≠ 0 en hurlant.
//
// ⚠️ Le sabotage se fait TOUJOURS sur une COPIE en tmpdir, JAMAIS sur le repo
// (un test qui mutile les fichiers livrés = le bug du 15/07/2026 en pire).
//
// NE JAMAIS supprimer ces cas : sans eux, doctor.js peut pourrir en
// `console.log("tout va bien")` sans que personne ne le voie.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DOCTOR = path.join(import.meta.dirname, 'doctor.js');

// Chaque ok(name, cond) = EXACTEMENT UN test vitest (même nom, même cond).
// L'état (spawns, sabotages tmpdir) est construit séquentiellement au niveau
// module — l'ordre d'origine du harnais est préservé.
function ok(name, cond) {
  test(name, () => { assert.ok(cond, name); });
}

function runDoctor(cwdDoctor, args = []) {
  const r = spawnSync(process.execPath, [cwdDoctor, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Copie du framework dans un tmpdir jetable → terrain de sabotage sûr.
function cloneFramework() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-sabotage-'));
  for (const f of fs.readdirSync(import.meta.dirname)) {
    if (f.endsWith('.js') && !f.endsWith('.test.js')) fs.copyFileSync(path.join(import.meta.dirname, f), path.join(tmp, f));
  }
  return tmp;
}

// Comme cloneFramework MAIS copie aussi sources/*.js → la porte CHARGE réellement
// (les probes 1-4 passent) ; on peut alors saboter UNE source précise et vérifier
// que doctor isole SA mort, pas juste « la porte plante ». Requis pour la voie skill
// (sources/skill.js vit en sous-dossier, absent du clone racine-seul).
function cloneFrameworkWithSources() {
  const tmp = cloneFramework();
  const srcDir = path.join(tmp, 'sources');
  fs.mkdirSync(srcDir, { recursive: true });
  for (const f of fs.readdirSync(path.join(import.meta.dirname, 'sources'))) {
    if (f.endsWith('.js')) fs.copyFileSync(path.join(import.meta.dirname, 'sources', f), path.join(srcDir, f));
  }
  return tmp;
}

// ── Cas 1 — repo SAIN : doctor passe et reste silencieux en --quiet ──
{
  const r = runDoctor(DOCTOR);
  ok('repo sain → doctor exit 0', r.status === 0);
  ok('repo sain → doctor confirme que la doc est réellement injectée', r.stdout.includes('framework vivant'));

  const q = runDoctor(DOCTOR, ['--quiet']);
  ok('repo sain + --quiet → SILENCE TOTAL sur stdout (sinon SessionStart devient du bruit)', q.stdout.trim() === '');
  ok('repo sain + --quiet → exit 0', q.status === 0);
}

// ── Cas 2 — NEGATIVE : le hook crashe au chargement ──
{
  const tmp = cloneFramework();
  try {
    fs.writeFileSync(path.join(tmp, 'mcp-doc-inject.js'), 'throw new Error("sabotage");\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('hook qui CRASHE → doctor exit ≠ 0', r.status !== 0);
    ok('hook qui CRASHE → doctor hurle sur stderr', r.stderr.includes('CASSÉ'));
    const q = runDoctor(path.join(tmp, 'doctor.js'), ['--quiet']);
    ok('hook qui CRASHE + --quiet → hurle QUAND MÊME (le silence ne vaut que pour le succès)', q.status !== 0 && q.stderr.includes('CASSÉ'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3 — NEGATIVE : le hook tourne mais N'INJECTE RIEN ──
// LE bug du 15/07/2026 : exit(0) propre, zéro erreur, zéro injection. C'est le
// cas que TOUS les autres tests laissaient passer.
{
  const tmp = cloneFramework();
  try {
    fs.writeFileSync(path.join(tmp, 'mcp-doc-inject.js'), 'process.exit(0);\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('hook SILENCIEUX (exit 0, aucune injection) → doctor exit ≠ 0', r.status !== 0);
    ok('hook SILENCIEUX → doctor nomme la mort silencieuse', r.stderr.includes('N\'INJECTE RIEN') || r.stderr.includes('stdout illisible ou vide'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3b — NEGATIVE : la porte SESSION tourne mais N'INJECTE RIEN ──
// Même classe de mort silencieuse que le cas 3, sur la voie SessionStart.
{
  const tmp = cloneFramework();
  try {
    fs.writeFileSync(path.join(tmp, 'session-inject.js'), 'process.exit(0);\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('porte SESSION silencieuse (exit 0, aucune injection) → doctor exit ≠ 0', r.status !== 0);
    ok('porte SESSION silencieuse → doctor nomme la voie session', r.stderr.includes('voie session'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3c — NEGATIVE : la GARDE D'ÉCRITURE avale les docs invalides ──
{
  const tmp = cloneFramework();
  try {
    fs.writeFileSync(path.join(tmp, 'doc-write-guard.js'), 'process.exit(0);\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('garde d\'écriture muette sur doc invalide → doctor exit ≠ 0', r.status !== 0);
    ok('garde d\'écriture muette → doctor la nomme', r.stderr.includes('doc-write-guard'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3d — NEGATIVE : la source SKILL n'injecte plus aucun pointeur ──
// Clone AVEC sources → la porte charge et les probes 1-4 passent ; on casse SEULE
// sources/skill.js → seule la voie skill tombe. Prouve l'ISOLATION du dead-man switch.
{
  // Auto-validation du montage : un clone AVEC sources, NON saboté, DOIT passer —
  // sinon le sabotage ci-dessous prouverait la mort du clone, pas celle de la source.
  const sane = cloneFrameworkWithSources();
  try {
    ok('clone AVEC sources, non saboté → doctor exit 0 (montage sain, auto-validation)',
      runDoctor(path.join(sane, 'doctor.js')).status === 0);
  } finally { fs.rmSync(sane, { recursive: true, force: true }); }

  const tmp = cloneFrameworkWithSources();
  try {
    fs.writeFileSync(path.join(tmp, 'sources', 'skill.js'),
      'module.exports = { matchingSkills: () => [], skillNameFromDoc: (d) => d, pointerBody: () => "", ' +
      'declFor: () => ({ mode: "dumb" }), serverMatches: () => [], skillRules: () => [], DOC_PREFIX: "skill/", MODES: [] };\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('source SKILL muette (aucun pointeur) → doctor exit ≠ 0', r.status !== 0);
    ok('source SKILL muette → doctor nomme la voie skill', r.stderr.includes('voie skill'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3f — NEGATIVE : le reset sort en exit 0 SANS rien effacer ──
// Le stub le plus vicieux : plausible, silencieux, exit 0 — indiscernable d'un
// reset vivant sans la preuve par le STORE (trou du doctor fermé le 19/07/2026).
{
  const tmp = cloneFrameworkWithSources();
  try {
    fs.writeFileSync(path.join(tmp, 'mcp-doc-reset.js'), 'process.stdin.resume(); process.stdin.on("end", () => process.exit(0)); process.stdin.on("data", () => {});\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('reset muet (exit 0 sans effacer) → doctor exit ≠ 0', r.status !== 0);
    ok('reset muet → doctor nomme les stores survivants', r.stderr.includes('SURVIVENT'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3e — NEGATIVE : la porte TOUR ne compte plus (driftUnit turn mort) ──
// Un compteur figé = docs driftUnit 'turn' plus JAMAIS réinjectées, en silence —
// exactement la classe de mort que le doctor existe pour attraper.
{
  const tmp = cloneFrameworkWithSources();
  try {
    // Stub PLAUSIBLE : exit 0, muet — mais ne compte RIEN. Indiscernable d'un
    // hook vivant sans le probe 6 (la preuve de vie est le STORE, pas la sortie).
    fs.writeFileSync(path.join(tmp, 'turn-count.js'), 'process.exit(0);\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('porte TOUR muette (ne compte pas) → doctor exit ≠ 0', r.status !== 0);
    ok('porte TOUR muette → doctor nomme le compteur de tours', r.stderr.includes('turn-count'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3g — NEGATIVE : la coquille CODEX tourne mais N'INJECTE RIEN ──
// Même classe de mort silencieuse que le cas 3, sur le dialecte Codex.
{
  const tmp = cloneFrameworkWithSources();
  try {
    fs.writeFileSync(path.join(tmp, 'codex-doc-inject.js'), 'process.exit(0);\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('coquille CODEX silencieuse (exit 0, aucune injection) → doctor exit ≠ 0', r.status !== 0);
    ok('coquille CODEX silencieuse → doctor nomme la voie Codex', r.stderr.includes('codex-doc-inject'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3h — NEGATIVE : la garde CODEX avale les docs invalides d'un patch ──
{
  const tmp = cloneFrameworkWithSources();
  try {
    fs.writeFileSync(path.join(tmp, 'codex-doc-write-guard.js'), 'process.exit(0);\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('garde CODEX muette sur patch invalide → doctor exit ≠ 0', r.status !== 0);
    ok('garde CODEX muette → doctor la nomme', r.stderr.includes('codex-doc-write-guard'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 7 — NEGATIVE : câblage CODEX incomplet / double injection ──
// Le câblage Codex vit hors du repo (~/.codex) : seule couverture = --codex-hooks.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-codex-wiring-'));
  try {
    const repo = import.meta.dirname;
    // 7a — hooks.json Codex qui câble l'ANCIEN protect-files EN PLUS de la coquille
    //      + oublie la porte TOUR : le doctor doit nommer le double ET le manquant.
    const hooksPath = path.join(tmp, 'hooks.json');
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'codex-doc-inject.js')}` },
      { command: `node ${path.join(tmp, 'protect-files.js')}` },
      { command: `node ${path.join(repo, 'codex-doc-write-guard.js')}` },
      { command: `node ${path.join(repo, 'mcp-doc-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--codex-hooks', hooksPath]);
    ok('câblage CODEX avec protect-files (double injection) → doctor exit ≠ 0', r.status !== 0);
    ok('câblage CODEX double → doctor nomme la double injection', r.stderr.includes('DOUBLE'));
    ok('câblage CODEX sans turn-count → doctor le nomme', r.stderr.includes('turn-count.js absent'));

    // 7b — câblage COMPLET et propre → aucun problème côté Codex.
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'codex-doc-inject.js')}` },
      { command: `node ${path.join(repo, 'codex-doc-write-guard.js')}` },
      { command: `node ${path.join(repo, 'mcp-doc-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}` },
      { command: `node ${path.join(repo, 'turn-count.js')}` },
    ] }] } }));
    const r2 = runDoctor(DOCTOR, ['--codex-hooks', hooksPath]);
    ok('câblage CODEX complet et propre → doctor exit 0', r2.status === 0);

    // 7c — la coquille câblée pointe vers une AUTRE copie du framework → rouge.
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(tmp, 'codex-doc-inject.js')}` },
      { command: `node ${path.join(repo, 'codex-doc-write-guard.js')}` },
      { command: `node ${path.join(repo, 'mcp-doc-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}` },
      { command: `node ${path.join(repo, 'turn-count.js')}` },
    ] }] } }));
    const r3 = runDoctor(DOCTOR, ['--codex-hooks', hooksPath]);
    ok('coquille CODEX câblée depuis une COPIE → doctor exit ≠ 0', r3.status !== 0);
    ok('coquille CODEX en copie → doctor nomme le fichier', r3.stderr.includes('codex-doc-inject.js'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 4 — NEGATIVE : settings.json pointe vers un fichier inexistant ──
// La mort silencieuse la plus probable : le câblage vit hors du repo.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-wiring-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    fs.writeFileSync(settings, JSON.stringify({
      hooks: { PreToolUse: [{ hooks: [{ command: `node ${path.join(tmp, 'disparu', 'mcp-doc-inject.js')}` }] }],
               PreCompact: [{ hooks: [{ command: `node ${path.join(tmp, 'disparu', 'mcp-doc-reset.js')}` }] }] },
    }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('câblage vers un fichier INEXISTANT → doctor exit ≠ 0', r.status !== 0);
    ok('câblage vers un fichier INEXISTANT → doctor le nomme', r.stderr.includes('INEXISTANT'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5 — NEGATIVE : settings.json ne câble pas le framework du tout ──
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-wiring2-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ command: 'node autre-hook.js' }] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('framework NON câblé → doctor exit ≠ 0', r.status !== 0);
    // Depuis la fusion (17/07/2026) : il doit nommer les DEUX câblages manquants
    // (porte = injecteur unique, reset = réinjection post-compaction).
    ok('framework NON câblé → doctor nomme la porte absente', r.stderr.includes('doc-inject.js absent'));
    ok('framework NON câblé → doctor nomme le reset absent', r.stderr.includes('mcp-doc-reset.js absent'));
    ok('framework NON câblé → doctor nomme la porte session absente', r.stderr.includes('session-inject.js absent'));
    ok('framework NON câblé → doctor nomme la garde d\'écriture absente', r.stderr.includes('doc-write-guard.js absent'));
    ok('framework NON câblé → doctor nomme la porte TOUR absente', r.stderr.includes('turn-count.js absent'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5b — NEGATIVE : le moteur MCP est câblé mais PAS la porte (doc-inject) ──
// Depuis la bascule (17/07/2026), doc-inject.js injecte les docs FICHIER. Câbler le
// reste sans la porte = plus aucune doc fichier, en silence. Le doctor DOIT hurler.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-wiring3-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // mcp-doc-inject/reset EXISTENT et sont CE repo → seul le check porte tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'mcp-doc-inject.js')}` },
      { command: `node ${path.join(repo, 'mcp-doc-reset.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('PORTE non câblée → doctor exit ≠ 0', r.status !== 0);
    ok('PORTE non câblée → doctor nomme la porte', r.stderr.includes('doc-inject.js'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5c — NEGATIVE : mcp-doc-inject.js ENCORE câblé à côté de la porte ──
// Depuis la fusion (17/07/2026), la porte couvre aussi le MCP : laisser le
// legacy câblé = docs MCP injectées EN DOUBLE (tokens brûlés). Doctor DOIT hurler.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-wiring4-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // porte + reset câblés et valides → seul le check anti-double tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'doc-inject.js')}` },
      { command: `node ${path.join(repo, 'mcp-doc-inject.js')}` },
      { command: `node ${path.join(repo, 'mcp-doc-reset.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('legacy encore câblé → doctor exit ≠ 0', r.status !== 0);
    ok('legacy encore câblé → doctor nomme la double injection', r.stderr.includes('DOUBLE'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5d — NEGATIVE : tout est câblé SAUF la porte SESSION ──
// Depuis le 17/07/2026, docs/session/ est injecté par session-inject.js en
// SessionStart : l'oublier = plus de savoir de session, en silence.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-wiring5-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // porte + reset câblés et valides → seul le check session tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'doc-inject.js')}` },
      { command: `node ${path.join(repo, 'mcp-doc-reset.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('porte SESSION non câblée → doctor exit ≠ 0', r.status !== 0);
    ok('porte SESSION non câblée → doctor la nomme', r.stderr.includes('session-inject.js absent'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5e — NEGATIVE : tout est câblé SAUF la porte TOUR (turn-count.js) ──
// driftUnit 'turn' sans son capteur = compteur figé = docs jamais réinjectées,
// en silence. Le doctor DOIT nommer précisément le câblage manquant.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-wiring6-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // porte + reset + session + garde câblés → seul le check turn tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'doc-inject.js')}` },
      { command: `node ${path.join(repo, 'mcp-doc-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}` },
      { command: `node ${path.join(repo, 'doc-write-guard.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('porte TOUR non câblée → doctor exit ≠ 0', r.status !== 0);
    ok('porte TOUR non câblée → doctor la nomme', r.stderr.includes('turn-count.js absent'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 6 — le probe ne DOIT JAMAIS toucher les fichiers livrés du repo ──
{
  const before = fs.readFileSync(path.join(import.meta.dirname, 'mcp-doc-config.json'), 'utf8');
  runDoctor(DOCTOR);
  const after = fs.readFileSync(path.join(import.meta.dirname, 'mcp-doc-config.json'), 'utf8');
  ok('le probe ne modifie PAS mcp-doc-config.json (isolation tmpdir totale)', before === after);
}
