// ═══════════════════════════════════════════════════════════════════════
// NEGATIVE-CHECK de lint-corpus.js — prouve qu'il HURLE quand le parc est cassé
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RAISON D'ÊTRE : `lint.js` (pur) est mutée à 99%+ — sa DÉCISION est prouvée.
//    Ce qui ne l'était PAS : la coquille I/O. Un `collecter()` qui rend un état
//    vide fait dire « ✅ parc sain » à un noyau parfait. C'est EXACTEMENT le bug
//    du 15/07/2026, commis DEUX FOIS dans la même journée (script d'audit
//    filtrant sur `scope`, puis `Array.isArray` sur une racine objet) : un
//    harnais creux annonce triomphalement 0 problème.
//    Un lint vert sur un parc sain ne prouve RIEN — `process.exit(0)` ferait
//    pareil. Seul le sabotage prouve.
//
// ⚠️ Le sabotage se fait TOUJOURS sur un FAUX parc en tmpdir (via
//    MCP_DOC_HOOKS_DIR / MCP_DOC_HOME), JAMAIS sur le vrai `~/.claude/hooks`
//    (307 docs réelles, 556 règles vivantes servant d'autres agents EN CE
//    MOMENT). Un test qui écrit dans un artefact livré = le bug du 15/07.
//
// ⚠️ NE JAMAIS supprimer un cas d'ici, et surtout PAS le cas « sonde de
//    vivacité » : c'est le seul qui prouve que le lint sait qu'il n'a rien lu.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const LINT = path.join(import.meta.dirname, 'lint-corpus.js');

// Chaque ok(name, cond) = EXACTEMENT UN test vitest (même nom, même cond).
// Les faux parcs/spawns sont construits séquentiellement au niveau module.
function ok(name, cond) {
  test(name, () => { assert.ok(cond, name); });
}

function runLint(parc, args = []) {
  const r = spawnSync(process.execPath, [LINT, ...args], {
    encoding: 'utf8',
    // ⚠️ Isolation TOTALE : le lint ne doit jamais voir le vrai parc ni le vrai home.
    env: { ...process.env, MCP_DOC_HOOKS_DIR: parc.hooks, MCP_DOC_HOME: parc.home },
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * Fabrique un faux parc minimal mais RÉALISTE (mêmes formes que le vrai :
 * racine objet `{rules:[…]}`, docs sous `docs/`, `mcpServers` dans le home).
 */
function faireParc({ regles = [], docs = {}, mcpServers = null } = {}) {
  const hooks = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-parc-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-home-'));
  fs.mkdirSync(path.join(hooks, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(hooks, 'protected-paths.json'), JSON.stringify({ rules: regles }));
  for (const [rel, contenu] of Object.entries(docs)) {
    const p = path.join(hooks, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, contenu);
  }
  if (mcpServers) fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers }));
  return { hooks, home, nettoyer: () => { for (const d of [hooks, home]) fs.rmSync(d, { recursive: true, force: true }); } };
}

// Un parc SAIN de référence : 1 doc, 1 règle qui la vise.
const SAIN = {
  regles: [{ doc: 'docs/lock.md', pattern: 'lock.js' }],
  docs: { 'docs/lock.md': '# lock\n\nNe jamais réimplémenter mkdirSync ad-hoc.\n' },
};

// ── Cas 1 — parc SAIN : le lint se tait et sort 0 ─────────────────────
// ⚠️ Ce cas ne prouve RIEN seul (cf en-tête). Il n'est là que pour garantir que
//    les cas NÉGATIFS ci-dessous rougissent pour la BONNE raison.
{
  const parc = faireParc(SAIN);
  try {
    const r = runLint(parc);
    ok('parc sain → exit 0', r.status === 0);
    ok('parc sain → le dit', r.stdout.includes('parc sain'));

    const q = runLint(parc, ['--quiet']);
    ok('parc sain + --quiet → SILENCE TOTAL (sinon SessionStart devient du bruit)', q.stdout.trim() === '');
    ok('parc sain + --quiet → exit 0', q.status === 0);
  } finally { parc.nettoyer(); }
}

// ── Cas 2 — SONDE DE VIVACITÉ : 0 règle chargée ──────────────────────
// ⚠️ LE cas central. Sans lui, un lint qui ne lit RIEN annonce « ✅ parc sain ».
//    Erreur commise 2× le 15/07/2026. Exit 2 = distinct de 1 : « je n'ai pas
//    pu mesurer » n'est PAS « j'ai mesuré et c'est sain ».
{
  const parc = faireParc({ regles: [], docs: SAIN.docs });
  try {
    const r = runLint(parc);
    ok('AUCUNE règle chargée → exit 2 (harnais creux ≠ parc sain)', r.status === 2);
    ok('AUCUNE règle chargée → hurle qu\'il ne peut rien prouver', r.stderr.includes('AUCUNE règle chargée'));
    ok('AUCUNE règle chargée → ne dit JAMAIS « parc sain »', !r.stdout.includes('parc sain'));

    const q = runLint(parc, ['--quiet']);
    ok('harnais creux + --quiet → hurle QUAND MÊME (le silence ne vaut que pour le succès)', q.status === 2);
  } finally { parc.nettoyer(); }
}

// ── Cas 3 — protected-paths.json à racine OBJET réellement lue ────────
// ⚠️ Le piège EXACT du 15/07 : `Array.isArray(brut)` faux sur `{rules:[…]}` →
//    0 règle → « 0 trou » sur un harnais creux. Si `extraireRegles` régresse,
//    le cas 1 tombe en exit 2 et CE cas nomme la cause.
{
  const parc = faireParc(SAIN);
  try {
    const r = runLint(parc);
    ok('racine OBJET {rules:[…]} → les règles sont RÉELLEMENT chargées (1 règle annoncée)', r.stdout.includes('1 règles'));
  } finally { parc.nettoyer(); }
}

// ── Cas 4 — NEGATIVE : doc MORTE (aucun déclencheur) ─────────────────
// Le bug que tout le refactor existe pour tuer : un .md complet, soigné, que
// RIEN ne vise — jamais injecté, et personne ne le voit.
{
  const parc = faireParc({
    regles: SAIN.regles,
    docs: { ...SAIN.docs, 'docs/orpheline.md': '# doc morte\n\nJamais injectée.\n' },
  });
  try {
    const r = runLint(parc);
    ok('doc MORTE → exit 1', r.status === 1);
    ok('doc MORTE → la NOMME', r.stderr.includes('docs/orpheline.md'));
    ok('doc MORTE → dit qu\'elle ne sera jamais injectée', r.stderr.includes('MORTE'));

    const q = runLint(parc, ['--quiet']);
    ok('doc MORTE + --quiet → hurle QUAND MÊME', q.status === 1 && q.stderr.includes('docs/orpheline.md'));
  } finally { parc.nettoyer(); }
}

// ── Cas 5 — NEGATIVE : règle FANTÔME (le miroir) ─────────────────────
{
  const parc = faireParc({
    regles: [...SAIN.regles, { doc: 'docs/disparue.md', pattern: 'disparu.js' }],
    docs: SAIN.docs,
  });
  try {
    const r = runLint(parc);
    ok('règle FANTÔME (vise un .md absent) → exit 1', r.status === 1);
    ok('règle FANTÔME → la nomme', r.stderr.includes('docs/disparue.md'));
  } finally { parc.nettoyer(); }
}

// ── Cas 6 — NORMALISATION : le frontmatter fait AUTORITÉ ─────────────
// ⚠️ Le cœur de la maintenabilité : une doc déclarant son déclencheur DANS son
//    frontmatter est vivante MÊME sans aucune règle dans protected-paths.json.
//    C'est le monde d'APRÈS la migration, prouvé AVANT de basculer.
{
  const parc = faireParc({
    regles: SAIN.regles, // règle sur lock.md seulement — rien ne vise moderne.md
    docs: {
      ...SAIN.docs,
      'docs/moderne.md': '---\nmatch: moderne.js\n---\n\n# moderne\n\nInvariant.\n',
    },
  });
  try {
    const r = runLint(parc);
    ok('doc à frontmatter `match:` SANS règle JSON → VIVANTE (exit 0)', r.status === 0);
  } finally { parc.nettoyer(); }
}

// ── Cas 7 — NEGATIVE : frontmatter présent mais MUET ─────────────────
// ⚠️ Le piège de la migration : `hasFrontmatter` fait autorité, donc un
//    frontmatter sans déclencheur ne retombe PAS sur le JSON. Une doc migrée à
//    moitié doit rougir, jamais être sauvée en douce par une vieille règle.
{
  const parc = faireParc({
    regles: [{ doc: 'docs/moitie.md', pattern: 'moitie.js' }],
    docs: { 'docs/moitie.md': '---\ntitle: joli titre\n---\n\n# migrée à moitié\n' },
  });
  try {
    const r = runLint(parc);
    ok('frontmatter SANS déclencheur → exit 1 (jamais rattrapé par la vieille règle)', r.status === 1);
    ok('frontmatter SANS déclencheur → nomme la doc', r.stderr.includes('docs/moitie.md'));
  } finally { parc.nettoyer(); }
}

// ── Cas 8 — WARN : serveur MCP sans doc, lu depuis le VRAI home ──────
// ⚠️ Prouve que `serveursMCP()` lit réellement `.claude.json` — s'il rendait []
//    en silence, la couverture MCP serait aveugle et personne ne le saurait.
{
  const parc = faireParc({ ...SAIN, mcpServers: { 'serveur-fictif-xyz': { command: 'x' } } });
  try {
    const r = runLint(parc);
    ok('serveur MCP branché sans doc → WARN, jamais bloquant (exit 0)', r.status === 0);
    ok('serveur MCP sans doc → le NOMME (preuve que .claude.json est lu)', r.stdout.includes('serveur-fictif-xyz'));

    const e = runLint(parc, ['--level', 'error']);
    ok('--level error → le warn disparaît', !e.stdout.includes('serveur-fictif-xyz'));
    ok('--level error → exit 0 malgré le warn filtré', e.status === 0);

    const off = runLint(parc, ['--level', 'off']);
    ok('--level off → tout éteint (choix déclaré), exit 0', off.status === 0 && !off.stdout.includes('serveur-fictif-xyz'));
  } finally { parc.nettoyer(); }
}

// ── Cas 9 — `--level` ne DOIT JAMAIS étouffer une erreur en silence ──
// ⚠️ `off` éteint tout, c'est un choix DÉCLARÉ (cf lint.js). Mais une faute de
//    frappe (`--level erreur`) doit retomber sur le défaut, JAMAIS sur off.
{
  const parc = faireParc({
    regles: SAIN.regles,
    docs: { ...SAIN.docs, 'docs/orpheline.md': '# morte\n' },
  });
  try {
    const r = runLint(parc, ['--level', 'erreur-typo']);
    ok('--level avec une FAUTE DE FRAPPE → défaut, l\'erreur hurle quand même (exit 1)', r.status === 1);
  } finally { parc.nettoyer(); }
}

// ── Cas 10 — le lint ne touche JAMAIS le vrai parc ───────────────────
// ⚠️ Le vrai `~/.claude/hooks` sert d'AUTRES agents en ce moment même.
{
  const reel = path.join(os.homedir(), '.claude', 'hooks', 'protected-paths.json');
  if (fs.existsSync(reel)) {
    const avant = fs.readFileSync(reel, 'utf8');
    const parc = faireParc(SAIN);
    try {
      runLint(parc);
      ok('le lint ne modifie PAS le vrai protected-paths.json (isolation tmpdir totale)',
        fs.readFileSync(reel, 'utf8') === avant);
    } finally { parc.nettoyer(); }
  } else {
    ok('le vrai parc est absent (checkout frais) → rien à protéger, cas N/A', true);
  }
}
