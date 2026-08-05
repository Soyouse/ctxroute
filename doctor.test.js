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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-sabotage-'));
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
    fs.writeFileSync(path.join(tmp, 'legacy-mcp-inject.js'), 'throw new Error("sabotage");\n');
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
    fs.writeFileSync(path.join(tmp, 'legacy-mcp-inject.js'), 'process.exit(0);\n');
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
    fs.writeFileSync(path.join(tmp, 'ctxroute-reset.js'), 'process.stdin.resume(); process.stdin.on("end", () => process.exit(0)); process.stdin.on("data", () => {});\n');
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

// ── Cas 3i — NEGATIVE : le CANARI ne rend plus aucun verdict ──────────
// ⚠️ Le canari est le SEUL témoin qui regarde l'AUTRE bout du tuyau. Il a
//    tourné DEUX JOURS en prod sans aucune sonde (trou posé le 03/08/2026,
//    fermé le 05/08). Un dead-man switch que personne ne surveille est PIRE
//    que pas de switch : il fabrique de la confiance sans rien garantir.
{
  const tmp = cloneFrameworkWithSources();
  try {
    // Stub PLAUSIBLE : exit 0, muet — exactement ce qu'un canari SAIN doit
    // faire côté sortie (il est muet par contrat). Seul le FICHIER de verdict
    // le distingue d'un mort. C'est pour ça que la sonde lit le fichier.
    fs.writeFileSync(path.join(tmp, 'canari-check.js'), 'process.exit(0);\n');
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('canari muet (n\'écrit aucun verdict) → doctor exit ≠ 0', r.status !== 0);
    ok('canari muet → doctor nomme le canari', r.stderr.includes('canari-check.js'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 3j — NEGATIVE : le CANARI est FIGÉ sur un verdict constant ────
// ⚠️ LE SABOTAGE LE PLUS VICIEUX, et celui qu'une sonde à UN SEUL CAS aurait
//    laissé passer : un canari qui écrit toujours `vivant` produit un fichier
//    valide, un verdict plausible, et ne détectera JAMAIS la panne qu'il
//    existe pour voir. C'est la leçon EXACTE des gates de pureté inertes du
//    03/08/2026 — un gate qui ne peut pas rougir est une décoration.
{
  const tmp = cloneFrameworkWithSources();
  try {
    const fige = `
const fs = require('fs'); const path = require('path'); const paths = require('./paths');
let d = ''; process.stdin.on('data', (c) => { d += c; });
process.stdin.on('end', () => {
  const dir = paths.stateDir(); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'canari.json'), JSON.stringify({ verdict: 'vivant', appels: 0, injections: 0 }));
  process.exit(0);
});
`;
    fs.writeFileSync(path.join(tmp, 'canari-check.js'), fige);
    const r = runDoctor(path.join(tmp, 'doctor.js'));
    ok('canari FIGÉ sur `vivant` → doctor exit ≠ 0', r.status !== 0);
    ok('canari FIGÉ → doctor dit qu\'il ne détecte plus un canal MORT',
      r.stderr.includes('MORT') || r.stderr.includes('mort'));
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-codex-wiring-'));
  try {
    const repo = import.meta.dirname;
    // 7a — hooks.json Codex qui câble l'ANCIEN protect-files EN PLUS de la coquille
    //      + oublie la porte TOUR : le doctor doit nommer le double ET le manquant.
    const hooksPath = path.join(tmp, 'hooks.json');
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'codex-doc-inject.js')}` },
      { command: `node ${path.join(tmp, 'protect-files.js')}` },
      { command: `node ${path.join(repo, 'codex-doc-write-guard.js')}` },
      { command: `node ${path.join(repo, 'ctxroute-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--codex-hooks', hooksPath]);
    ok('câblage CODEX avec protect-files (double injection) → doctor exit ≠ 0', r.status !== 0);
    ok('câblage CODEX double → doctor nomme la double injection', r.stderr.includes('DOUBLE'));
    ok('câblage CODEX sans turn-count → doctor le nomme', r.stderr.includes('turn-count.js absent'));

    // 7b — câblage COMPLET et propre → aucun problème côté Codex.
    // ⚠️ « propre » INCLUT additionalContextLimit = 0 sur les deux ÉMETTEURS
    //    (04/08/2026) : sans lui, Codex tronque en silence — un câblage qui
    //    livre des aperçus n'est pas un câblage propre. Prouve aussi que le
    //    check marche en JSON, pas seulement en TOML.
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'codex-doc-inject.js')}`, additionalContextLimit: 0 },
      { command: `node ${path.join(repo, 'codex-doc-write-guard.js')}` },
      { command: `node ${path.join(repo, 'ctxroute-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}`, additionalContextLimit: 0 },
      { command: `node ${path.join(repo, 'turn-count.js')}` },
    ] }] } }));
    const r2 = runDoctor(DOCTOR, ['--codex-hooks', hooksPath]);
    ok('câblage CODEX complet et propre → doctor exit 0', r2.status === 0);

    // 7c — la coquille câblée pointe vers une AUTRE copie du framework → rouge.
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(tmp, 'codex-doc-inject.js')}` },
      { command: `node ${path.join(repo, 'codex-doc-write-guard.js')}` },
      { command: `node ${path.join(repo, 'ctxroute-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}` },
      { command: `node ${path.join(repo, 'turn-count.js')}` },
    ] }] } }));
    const r3 = runDoctor(DOCTOR, ['--codex-hooks', hooksPath]);
    ok('coquille CODEX câblée depuis une COPIE → doctor exit ≠ 0', r3.status !== 0);
    ok('coquille CODEX en copie → doctor nomme le fichier', r3.stderr.includes('codex-doc-inject.js'));

    // ── 7d — NEGATIVE : le PLAFOND DE CONTEXTE CODEX (04/08/2026) ──────
    // ⚠️ Sans `additionalContextLimit = 0`, Codex spille au-delà de 2500 tokens
    //    et n'envoie qu'un aperçu SANS le dire : panne SILENCIEUSE. Ce bloc
    //    prouve que le gate rougit vraiment — un gate jamais vu rouge est un
    //    gate qu'on croit posé (classe d'erreur mesurée le 03/08 sur les
    //    règles de pureté, toutes inertes pendant des mois).
    // ⚠️ Format TOML : c'est le terrain RÉEL (hooks.json est IGNORÉ par
    //    Codex 0.144, mesuré le 19/07/2026).
    const toml = path.join(tmp, 'requirements.toml');
    const bloc = (fichier, limite) => [
      '[[hooks.PreToolUse.hooks]]',
      'type = "command"',
      `command = 'node ${path.join(repo, fichier)}'`,
      'timeout = 10',
      ...(limite === null ? [] : [`additionalContextLimit = ${limite}`]),
      '',
    ].join('\n');
    const cablage = (limInject, limSession) => bloc('codex-doc-inject.js', limInject)
      + bloc('codex-doc-write-guard.js', null)
      + bloc('ctxroute-reset.js', null)
      + bloc('session-inject.js', limSession)
      + bloc('turn-count.js', null);

    // 7d-1 — les DEUX émetteurs déclarent 0 → vert.
    fs.writeFileSync(toml, cablage(0, 0));
    ok('câblage CODEX TOML avec additionalContextLimit = 0 partout → doctor exit 0',
      runDoctor(DOCTOR, ['--codex-hooks', toml]).status === 0);

    // 7d-2 — réglage ABSENT partout → rouge, et le doctor nomme les DEUX.
    fs.writeFileSync(toml, cablage(null, null));
    const rNu = runDoctor(DOCTOR, ['--codex-hooks', toml]);
    ok('câblage CODEX sans additionalContextLimit → doctor exit ≠ 0', rNu.status !== 0);
    // ⚠️ Chercher la RAISON (`problems`), pas le libellé du check : seules les
    //    raisons partent sur stderr. Attendre le libellé rendait l'assert
    //    toujours faux — donc un negative-check qui ne prouve RIEN.
    ok('sans additionalContextLimit → doctor nomme la coquille PreToolUse',
      /codex-doc-inject\.js est cable SANS additionalContextLimit/.test(rNu.stderr));
    ok('sans additionalContextLimit → doctor nomme AUSSI la porte SESSION',
      /session-inject\.js est cable SANS additionalContextLimit/.test(rNu.stderr));
    ok('sans additionalContextLimit → la raison dit la panne SILENCIEUSE',
      rNu.stderr.includes('2500 tokens') && rNu.stderr.includes('SILENCE'));

    // 7d-3 — ⚠️ LE PIÈGE : réglage présent sur UN SEUL émetteur. Un match
    //        GLOBAL sur le fichier passerait au vert ici — c'est exactement le
    //        faux vert que le découpage par bloc existe pour empêcher.
    fs.writeFileSync(toml, cablage(0, null));
    const rMoitie = runDoctor(DOCTOR, ['--codex-hooks', toml]);
    ok('additionalContextLimit sur UN SEUL émetteur → doctor exit ≠ 0 (pas de match global)',
      rMoitie.status !== 0);
    ok('un seul émetteur réglé → seule la porte SESSION est nommée',
      /session-inject\.js est cable SANS additionalContextLimit/.test(rMoitie.stderr)
      && !/codex-doc-inject\.js est cable SANS additionalContextLimit/.test(rMoitie.stderr));

    // 7d-4 — une valeur NON NULLE ne vaut pas 0 : elle laisse un plafond.
    //        Garde aussi contre un `0` lu à l'intérieur de `2500`/`10`.
    fs.writeFileSync(toml, cablage(5000, 0));
    ok('additionalContextLimit = 5000 (plafond résiduel) → doctor exit ≠ 0',
      runDoctor(DOCTOR, ['--codex-hooks', toml]).status !== 0);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 4 — NEGATIVE : settings.json pointe vers un fichier inexistant ──
// La mort silencieuse la plus probable : le câblage vit hors du repo.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-wiring-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    fs.writeFileSync(settings, JSON.stringify({
      hooks: { PreToolUse: [{ hooks: [{ command: `node ${path.join(tmp, 'disparu', 'legacy-mcp-inject.js')}` }] }],
               PreCompact: [{ hooks: [{ command: `node ${path.join(tmp, 'disparu', 'ctxroute-reset.js')}` }] }] },
    }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('câblage vers un fichier INEXISTANT → doctor exit ≠ 0', r.status !== 0);
    ok('câblage vers un fichier INEXISTANT → doctor le nomme', r.stderr.includes('INEXISTANT'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5 — NEGATIVE : settings.json ne câble pas le framework du tout ──
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-wiring2-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ command: 'node autre-hook.js' }] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('framework NON câblé → doctor exit ≠ 0', r.status !== 0);
    // Depuis la fusion (17/07/2026) : il doit nommer les DEUX câblages manquants
    // (porte = injecteur unique, reset = réinjection post-compaction).
    ok('framework NON câblé → doctor nomme la porte absente', r.stderr.includes('doc-inject.js absent'));
    ok('framework NON câblé → doctor nomme le reset absent', r.stderr.includes('ctxroute-reset.js absent'));
    ok('framework NON câblé → doctor nomme la porte session absente', r.stderr.includes('session-inject.js absent'));
    ok('framework NON câblé → doctor nomme la garde d\'écriture absente', r.stderr.includes('doc-write-guard.js absent'));
    ok('framework NON câblé → doctor nomme la porte TOUR absente', r.stderr.includes('turn-count.js absent'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5b — NEGATIVE : le moteur MCP est câblé mais PAS la porte (doc-inject) ──
// Depuis la bascule (17/07/2026), doc-inject.js injecte les docs FICHIER. Câbler le
// reste sans la porte = plus aucune doc fichier, en silence. Le doctor DOIT hurler.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-wiring3-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // legacy-mcp-inject/reset EXISTENT et sont CE repo → seul le check porte tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'legacy-mcp-inject.js')}` },
      { command: `node ${path.join(repo, 'ctxroute-reset.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('PORTE non câblée → doctor exit ≠ 0', r.status !== 0);
    ok('PORTE non câblée → doctor nomme la porte', r.stderr.includes('doc-inject.js'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5c — NEGATIVE : legacy-mcp-inject.js ENCORE câblé à côté de la porte ──
// Depuis la fusion (17/07/2026), la porte couvre aussi le MCP : laisser le
// legacy câblé = docs MCP injectées EN DOUBLE (tokens brûlés). Doctor DOIT hurler.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-wiring4-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // porte + reset câblés et valides → seul le check anti-double tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'doc-inject.js')}` },
      { command: `node ${path.join(repo, 'legacy-mcp-inject.js')}` },
      { command: `node ${path.join(repo, 'ctxroute-reset.js')}` },
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-wiring5-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // porte + reset câblés et valides → seul le check session tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'doc-inject.js')}` },
      { command: `node ${path.join(repo, 'ctxroute-reset.js')}` },
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-wiring6-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // porte + reset + session + garde câblés → seul le check turn tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'doc-inject.js')}` },
      { command: `node ${path.join(repo, 'ctxroute-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}` },
      { command: `node ${path.join(repo, 'doc-write-guard.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('porte TOUR non câblée → doctor exit ≠ 0', r.status !== 0);
    ok('porte TOUR non câblée → doctor la nomme', r.stderr.includes('turn-count.js absent'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 5f — NEGATIVE : tout est câblé SAUF le CANARI ────────────────
// Décâbler le canari ne dégrade RIEN de visible — c'est exactement ce qui le
// rend dangereux : on perd le seul témoin capable de voir le harnais cesser
// de consommer nos injections, et on le perd sans aucun symptôme.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-wiring7-'));
  try {
    const settings = path.join(tmp, 'settings.json');
    const repo = import.meta.dirname; // tout le reste câblé → seul le check canari tombe.
    fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { command: `node ${path.join(repo, 'doc-inject.js')}` },
      { command: `node ${path.join(repo, 'ctxroute-reset.js')}` },
      { command: `node ${path.join(repo, 'session-inject.js')}` },
      { command: `node ${path.join(repo, 'doc-write-guard.js')}` },
      { command: `node ${path.join(repo, 'turn-count.js')}` },
    ] }] } }));
    const r = runDoctor(DOCTOR, ['--settings', settings]);
    ok('canari non câblé → doctor exit ≠ 0', r.status !== 0);
    ok('canari non câblé → doctor le nomme', r.stderr.includes('canari-check.js absent'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Cas 6 — le probe ne DOIT JAMAIS toucher les fichiers livrés du repo ──
// Config utilisateur gitignorée (19/07/2026) : réelle si présente (machine
// installée), sinon le .example livré (clone vierge/CI) — même invariant.
{
  const real = path.join(import.meta.dirname, 'ctxroute-config.json');
  const cfg = fs.existsSync(real) ? real : path.join(import.meta.dirname, 'ctxroute-config.json.example');
  const before = fs.readFileSync(cfg, 'utf8');
  runDoctor(DOCTOR);
  const after = fs.readFileSync(cfg, 'utf8');
  ok('le probe ne modifie PAS la config livrée (isolation tmpdir totale)', before === after);
}
