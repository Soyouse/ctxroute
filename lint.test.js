// ═══════════════════════════════════════════════════════════════════════
// lint.test.js — tests DÉTERMINISTES du noyau pur (cible Stryker)
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ Appel DIRECT, zéro spawn. Chaque cas rejoue une mesure RÉELLE du
//    15/07/2026 — jamais une hypothèse inventée.
// ⚠️ Valeurs de CONTRAT écrites EN DUR : ne JAMAIS les dériver de NIVEAUX ni
//    d'une constante du module, sinon le test mute AVEC le code et le mutant
//    devient invisible (erreur déjà commise sur `for (const m of MODES)`).
// ═══════════════════════════════════════════════════════════════════════

// ⚠️ STACK = vitest · SCOPE = ctxroute UNIQUEMENT.
//    Dette node:test SOLDÉE le 16/07/2026 (port tout-ou-rien des 21 suites,
//    mutation 12 min → ~30 s). Retour au mode dégradé rendu impossible par le
//    gate anti-commandRunner de mutation-workflow-gate.test.js.

'use strict';

import { test } from 'vitest';
import assert from 'node:assert';
import { analyser, filtrer, doitHurler, liste, NIVEAUX, NIVEAU_DEFAUT } from './lint.js';

// ── liste() : la garde de totalité, testée DIRECTEMENT ────────────────
// ⚠️ Elle est exportée POUR ça. En ligne (`Array.isArray(x) ? x : []`), le
//    fallback `[]` est un mutant ÉQUIVALENT (Stryker le remplace par
//    `["Stryker was here"]`, invisible). Extraite, elle devient observable.
//    CI 15/07/2026 : 5 mutants survivants tués par ce seul test.
test('liste : source unique de la garde « tableau ou rien »', () => {
  const t = ['a'];
  assert.strictEqual(liste(t), t); // tableau -> LUI-MÊME, pas une copie
  assert.deepStrictEqual(liste([]), []);
  for (const x of [null, undefined, 'x', 42, {}, { length: 2 }]) {
    assert.deepStrictEqual(liste(x), [], `liste(${JSON.stringify(x)})`);
  }
});

const doc = (chemin, declaration) => ({ chemin, declaration });
const codes = (c) => c.map((x) => x.code);

// ── Contrat ──────────────────────────────────────────────────────────
test('contrat : niveaux et défaut', () => {
  assert.deepStrictEqual(NIVEAUX, ['error', 'warn', 'info']);
  assert.strictEqual(NIVEAU_DEFAUT, 'warn');
});

// ── Totalité : un lint qui throw = un SessionStart cassé ──────────────
test('totalité : ne throw JAMAIS, quel que soit l\'état', () => {
  for (const e of [undefined, null, {}, { docs: null }, { docs: 'x' }, { docs: [null, 42, {}] },
    { docsFantomes: 'x' }, { serveursMCP: 3 }, { serveursDocumentes: null }]) {
    assert.doesNotThrow(() => analyser(e));
    assert.ok(Array.isArray(analyser(e)));
  }
});

// ── ERREUR : doc morte en silence (LE bug que le refactor tue) ────────
test('doc sans déclencheur = ERREUR (14 mesurées sur 306 le 15/07)', () => {
  const c = analyser({ docs: [doc('docs/orpheline.md', {})] });
  assert.strictEqual(c.length, 1);
  assert.strictEqual(c[0].niveau, 'error');
  assert.strictEqual(c[0].code, 'declaration-invalide');
  assert.strictEqual(c[0].cible, 'docs/orpheline.md');
});

test('doc avec `inject: never` = SILENCIEUSE ET VALIDE (le silence déclaré)', () => {
  assert.deepStrictEqual(analyser({ docs: [doc('docs/pw-mcp-proxy-reference.md', { inject: 'never' })] }), []);
});

test('doc avec un déclencheur du corpus FICHIER = valide (match / rules / tool)', () => {
  // ⚠️ RÉÉCRIT le 31/07/2026 (§A) : les cas `mcp:` certifiaient une doc MUETTE
  //    comme « valide » — le faux vert gravé dans la suite. Le lint DÉLÈGUE à
  //    validate() (seule autorité) : il devient rouge avec lui, par construction.
  assert.deepStrictEqual(analyser({ docs: [doc('a.md', { match: 'lock.js' })] }), []);
  assert.deepStrictEqual(analyser({ docs: [doc('b.md', { tool: ['WebFetch'] })] }), []);
  assert.deepStrictEqual(analyser({ docs: [doc('c.md', { match: 'ssh.js', tool: ['WebSearch'] })] }), []);
});

test('§A : le lint HURLE sur une doc fichier portant `mcp:` (délégation à validate)', () => {
  const c = analyser({ docs: [doc('b.md', { mcp: ['stripe'] })] });
  assert.equal(c.length, 1);
  assert.equal(c[0].niveau, 'error');
  assert.ok(/CHEMIN/.test(c[0].message), 'le lint doit relayer le message qui répare');
});

test('clé mal orthographiée (`mach:`) = ERREUR, jamais ignorée en silence', () => {
  const c = analyser({ docs: [doc('a.md', { mach: 'lock.js' })] });
  assert.ok(c.length >= 1);
  assert.ok(c.every((x) => x.niveau === 'error'));
});

// ⚠️ Le lint DÉLÈGUE à validate() — il ne re-juge jamais. Ce test scelle la
//    délégation : si quelqu'un réimplémente un jugement ici, il divergera.
test('délégation : `inject: never` + déclencheur = contradiction remontée', () => {
  const c = analyser({ docs: [doc('a.md', { inject: 'never', match: 'x.js' })] });
  assert.ok(c.some((x) => x.niveau === 'error'));
});

test('doc sans chemin exploitable = ignorée, jamais un crash', () => {
  assert.deepStrictEqual(analyser({ docs: [{ declaration: {} }, null, { chemin: 42 }] }), []);
});

// ── ERREUR : règle fantôme (miroir exact) ────────────────────────────
test('règle fantôme = ERREUR (0 mesurée le 15/07 — ce check maintient le 0)', () => {
  const c = analyser({ docsFantomes: ['docs/disparue.md'] });
  assert.deepStrictEqual(codes(c), ['regle-fantome']);
  assert.strictEqual(c[0].niveau, 'error');
});

// ── WARN : couverture MCP (mesuré 2/16) ──────────────────────────────
test('serveur MCP sans doc = WARN (arbitré : pas oublié, pas encore fait)', () => {
  const c = analyser({ serveursMCP: ['ssh', 'infra', 'stripe'], serveursDocumentes: ['stripe'] });
  assert.deepStrictEqual(codes(c), ['mcp-sans-doc', 'mcp-sans-doc']);
  assert.deepStrictEqual(c.map((x) => x.cible), ['ssh', 'infra']);
  assert.ok(c.every((x) => x.niveau === 'warn'));
});

test('serveur déclaré volontairement sans doc = silencieux (filterList)', () => {
  assert.deepStrictEqual(analyser({ serveursMCP: ['umami'], serveursDeclares: ['umami'] }), []);
});

test('serveur documenté ET déclaré = silencieux, jamais un doublon', () => {
  assert.deepStrictEqual(analyser({ serveursMCP: ['stripe'], serveursDocumentes: ['stripe'], serveursDeclares: ['stripe'] }), []);
});

// ── Ordre de gravité — garanti par CONSTRUCTION, pas par un sort ──────
// ⚠️ Un `.sort()` vivait ici : INATTEIGNABLE (la liste sortait déjà triée), donc
//    code mort + mutant équivalent, et ce test passait PAR ACCIDENT — il ne
//    prouvait rien. Retiré le 15/07/2026. Ce test garde son sens : il verra
//    rougir un futur check `warn` poussé avant un check `error`.
test('sortie triée par gravité (erreurs avant warns) — par ordre des checks', () => {
  const c = analyser({
    serveursMCP: ['ssh'],
    docs: [doc('mort.md', {})],
    docsFantomes: ['fantome.md'],
  });
  assert.deepStrictEqual(c.map((x) => x.niveau), ['error', 'error', 'warn']);
  // ⚠️ Attendu ÉCRIT EN DUR : ne jamais le dériver de NIVEAUX (muterait avec le code).
  const rang = { error: 0, warn: 1, info: 2 };
  for (let i = 1; i < c.length; i++) {
    assert.ok(rang[c[i - 1].niveau] <= rang[c[i].niveau], 'une erreur ne doit JAMAIS passer après un warn');
  }
});

// ── filtrer ──────────────────────────────────────────────────────────
const ECHANTILLON = [
  { niveau: 'error', code: 'e' },
  { niveau: 'warn', code: 'w' },
  { niveau: 'info', code: 'i' },
];

test('filtrer : error ne montre QUE les erreurs', () => {
  assert.deepStrictEqual(codes(filtrer(ECHANTILLON, 'error')), ['e']);
});
test('filtrer : warn montre erreurs + warns (le défaut)', () => {
  assert.deepStrictEqual(codes(filtrer(ECHANTILLON, 'warn')), ['e', 'w']);
});
test('filtrer : info montre tout', () => {
  assert.deepStrictEqual(codes(filtrer(ECHANTILLON, 'info')), ['e', 'w', 'i']);
});
test('filtrer : off éteint TOUT, erreurs comprises (choix déclaré)', () => {
  assert.deepStrictEqual(filtrer(ECHANTILLON, 'off'), []);
});
// ⚠️ Un niveau inconnu NE DOIT PAS éteindre le diagnostic : une faute de frappe
//    dans la config rendrait le lint muet en silence — le bug qu'il combat.
test('filtrer : niveau inconnu ⇒ défaut (warn), JAMAIS off', () => {
  for (const n of ['ERROR', 'verbose', '', null, undefined, 42]) {
    assert.deepStrictEqual(codes(filtrer(ECHANTILLON, n)), ['e', 'w'], `niveau: ${n}`);
  }
});
test('filtrer : entrée non-tableau ⇒ [], jamais un throw', () => {
  assert.deepStrictEqual(filtrer(null, 'warn'), []);
  assert.deepStrictEqual(filtrer('x', 'warn'), []);
});

// ── doitHurler ───────────────────────────────────────────────────────
test('doitHurler : SEULES les erreurs hurlent (un warn bloquant = gate banni)', () => {
  assert.strictEqual(doitHurler([{ niveau: 'error' }]), true);
  assert.strictEqual(doitHurler([{ niveau: 'warn' }, { niveau: 'info' }]), false);
  assert.strictEqual(doitHurler([]), false);
  assert.strictEqual(doitHurler([{ niveau: 'warn' }, { niveau: 'error' }]), true);
});
test('doitHurler : totalité', () => {
  assert.strictEqual(doitHurler(null), false);
  assert.strictEqual(doitHurler([null, undefined]), false);
});
