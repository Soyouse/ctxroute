// Tests DÉTERMINISTES de collisions.js — cible Stryker (import DIRECT,
// toute évaluation DANS les callbacks — contrat perTest).
import { test, expect } from 'vitest';
import { findCollisions } from './collisions.js';

const rule = (pattern, doc, extra = {}) => ({ pattern, doc, ...extra });

test('containment dossier → probable_parent_child, p1 = pattern court', () => {
  const out = findCollisions([
    rule('deploy-site/', 'docs/parent.md'),
    rule('deploy-site/08-generate.md', 'docs/enfant.md'),
  ]);
  expect(out.length).toBe(1);
  expect(out[0].classification).toBe('probable_parent_child');
  expect(out[0].pattern_a).toBe('deploy-site/');
  expect(out[0].pattern_b).toBe('deploy-site/08-generate.md');
});

test('containment fichier (pas dossier) → ambiguous, quel que soit l\'ordre d\'entrée', () => {
  const a = rule('handlers.ts', 'docs/a.md');
  const b = rule('api-site/src/handlers.ts', 'docs/b.md');
  for (const rules of [[a, b], [b, a]]) {
    const out = findCollisions(rules);
    expect(out.length).toBe(1);
    expect(out[0].classification).toBe('ambiguous');
    expect(out[0].pattern_a).toBe('handlers.ts'); // toujours le court en A
  }
});

test('pattern identique (norm : casse + backslash) → potential_duplicate', () => {
  const out = findCollisions([
    rule('Stryker.conf.json', 'docs/a.md'),
    rule('stryker.conf.json', 'docs/b.md'),
  ]);
  expect(out.length).toBe(1);
  expect(out[0].classification).toBe('potential_duplicate');
});

test('même doc = design multi-patterns, JAMAIS une collision', () => {
  expect(findCollisions([
    rule('a.js', 'docs/meme.md'),
    rule('sous/a.js', 'docs/meme.md'),
  ])).toEqual([]);
});

test('scopes disjoints = pas de collision réelle ; recoupés ou absents = collision', () => {
  const mk = (sa, sb) => findCollisions([
    rule('x.js', 'docs/a.md', sa ? { scope: sa } : {}),
    rule('x.js', 'docs/b.md', sb ? { scope: sb } : {}),
  ]).length;
  expect(mk(['api-site'], ['api-calendar'])).toBe(0);
  expect(mk(['api-site'], ['api-site'])).toBe(1);
  expect(mk(null, ['api-site'])).toBe(1); // sans scope = global = recoupe tout
});

test('exclude du parent couvrant l\'enfant = collision NEUTRALISÉE (containment seul)', () => {
  expect(findCollisions([
    rule('conf', 'docs/parent.md', { exclude: ['stryker'] }),
    rule('stryker.conf.json', 'docs/enfant.md'),
  ])).toEqual([]);
  // exclude sans rapport = collision maintenue
  expect(findCollisions([
    rule('conf', 'docs/parent.md', { exclude: ['node_modules'] }),
    rule('stryker.conf.json', 'docs/enfant.md'),
  ]).length).toBe(1);
});

test('patterns sans rapport = aucune collision ; liste vide = []', () => {
  expect(findCollisions([rule('a.js', 'docs/a.md'), rule('b.js', 'docs/b.md')])).toEqual([]);
  expect(findCollisions([])).toEqual([]);
});

// ── Briques internes testées en DIRECT (leurs mutants sont invisibles via
//    findCollisions : norm est appliquée aux DEUX côtés des comparaisons) ──
import { norm, isContained, scopesOverlap, excludeNeutralizes, isFolderPattern } from './collisions.js';

test('norm : backslash → slash, minuscules, null/undefined → chaîne vide', () => {
  expect(norm('A\\B\\Fichier.MD')).toBe('a/b/fichier.md');
  expect(norm(null)).toBe('');
  expect(norm(undefined)).toBe('');
});

test('isContained : strict (égaux = non), insensible casse/backslash', () => {
  expect(isContained('a.js', 'chemin/a.js')).toBe(true);
  expect(isContained('a.js', 'a.js')).toBe(false);
  expect(isContained('A.JS', 'chemin\\a.js')).toBe(true);
  expect(isContained('x.js', 'chemin/a.js')).toBe(false);
});

test('scopesOverlap : scope VIDE [] = global (recoupe tout), DES DEUX CÔTÉS', () => {
  expect(scopesOverlap({ scope: [] }, { scope: ['api-site'] })).toBe(true);
  expect(scopesOverlap({ scope: ['api-site'] }, { scope: [] })).toBe(true);
  expect(scopesOverlap({}, {})).toBe(true);
  expect(scopesOverlap({ scope: ['a'] }, { scope: ['a', 'b'] })).toBe(true);
  // UN seul scope commun suffit (some, jamais every) :
  expect(scopesOverlap({ scope: ['a', 'x'] }, { scope: ['a'] })).toBe(true);
  expect(scopesOverlap({ scope: ['a'] }, { scope: ['b'] })).toBe(false);
});

test('excludeNeutralizes : exclude vide/absent = false ; UN exclude qui matche suffit (some)', () => {
  expect(excludeNeutralizes({}, { pattern: 'x.js' })).toBe(false);
  expect(excludeNeutralizes({ exclude: [] }, { pattern: 'x.js' })).toBe(false);
  expect(excludeNeutralizes({ exclude: ['X.JS'] }, { pattern: 'chemin/x.js' })).toBe(true);
  expect(excludeNeutralizes({ exclude: ['sans-rapport', 'x.js'] }, { pattern: 'chemin/x.js' })).toBe(true);
});

test('sortie : scope_a/scope_b = le scope réel si présent, null sinon', () => {
  const out = findCollisions([
    rule('x.js', 'docs/a.md', { scope: ['api-site'] }),
    rule('x.js', 'docs/b.md'),
  ]);
  expect(out.length).toBe(1);
  expect(out[0].scope_a).toEqual(['api-site']);
  expect(out[0].scope_b).toBe(null);
});

test('isFolderPattern : slash final (backslash normalisé compris)', () => {
  expect(isFolderPattern('deploy-site/')).toBe(true);
  expect(isFolderPattern('deploy-site\\')).toBe(true);
  expect(isFolderPattern('deploy-site')).toBe(false);
});

// ── Cas frontière kind : `same-pattern` ne lit JAMAIS les branches containment ──
test('same-pattern avec exclude du côté A = collision QUAND MÊME (exclude ne vaut que pour containment)', () => {
  const out = findCollisions([
    rule('x.js', 'docs/a.md', { exclude: ['x.js'] }),
    rule('x.js', 'docs/b.md'),
  ]);
  expect(out.length).toBe(1);
  expect(out[0].classification).toBe('potential_duplicate');
});

test('same-pattern sur motif DOSSIER = potential_duplicate, jamais parent/enfant', () => {
  const out = findCollisions([
    rule('deploy-site/', 'docs/a.md'),
    rule('deploy-site/', 'docs/b.md'),
  ]);
  expect(out.length).toBe(1);
  expect(out[0].classification).toBe('potential_duplicate');
});
