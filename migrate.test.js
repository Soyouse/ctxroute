// ═══════════════════════════════════════════════════════════════════════
// migrate.js — tests DÉTERMINISTES (cible Stryker)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ `migrate.property.test.js` n'est PAS lancé par Stryker (unit only) : toute
//    garde prouvée par property DOIT AUSSI avoir son cas déterministe ICI,
//    sinon le mutant correspondant SURVIT et le score ment.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { serialize, grouper, declaration, planifier } from './migrate.js';
import { parse } from './frontmatter.js';

const etat = (existants, avecFm) => ({
  existe: (d) => existants.includes(d),
  aDejaFrontmatter: (d) => avecFm.includes(d),
});

test('serialize : ordre des clés FIGÉ (match, scope, exclude, mode, rank)', () => {
  const out = serialize({ rank: 3, match: 'a.js', scope: ['x'] });
  assert.strictEqual(out, '---\nmatch: a.js\nscope: [x]\nrank: 3\n---\n');
});

test('serialize : omet les clés absentes (jamais `undefined` écrit)', () => {
  assert.strictEqual(serialize({ match: 'a.js' }), '---\nmatch: a.js\n---\n');
});

test('serialize : une liste devient [a, b]', () => {
  assert.match(serialize({ match: ['a.js', 'b.js'] }), /match: \[a\.js, b\.js\]/);
});

test('grouper : rank = index de la PREMIÈRE règle visant la doc', () => {
  const rules = [
    { pattern: 'z.js', doc: 'docs/autre.md' },
    { pattern: 'a.js', doc: 'docs/x.md' },
    { pattern: 'b.js', doc: 'docs/x.md' },
  ];
  const g = grouper(rules);
  assert.strictEqual(g.get('docs/x.md').rank, 1, 'rank doit être l’index de la 1ʳᵉ règle, pas de la dernière');
  assert.strictEqual(g.get('docs/x.md').entries.length, 2);
});

test('grouper : ignore les règles malformées, ne throw jamais', () => {
  assert.strictEqual(grouper([null, {}, { pattern: 'a' }, { doc: 'd' }, 'x']).size, 0);
  assert.strictEqual(grouper('pas un tableau').size, 0);
  assert.strictEqual(grouper(undefined).size, 0);
});

// ⚠️ GATE DE NON-RÉGRESSION COMPORTEMENTALE — ne JAMAIS assouplir.
// protect-files.js n'a AUCUN dédup : il réinjecte à CHAQUE appel d'outil.
// `dumb` est la SEULE valeur qui reproduit ça. Sans ce gate, omettre `mode`
// ferait tomber les 288 docs sur le mode global (`smart`) = « injectée une
// fois puis oubliée » : un changement de comportement MASSIF livré en douce
// dans un refactor de FORMAT, invisible car 100% des autres tests resteraient
// VERTS (le match, lui, ne change pas). Bug trouvé le 15/07/2026 en relisant
// le plan : la garantie « comportement identique » était FAUSSE.
// Passer des docs en `smart` = chantier SÉPARÉ, doc par doc, APRÈS bascule.
test('declaration : mode TOUJOURS "dumb" (protect-files n\'a aucun dédup)', () => {
  assert.strictEqual(declaration([{ pattern: 'a.js' }], 0).mode, 'dumb');
  assert.strictEqual(declaration([{ pattern: 'a.js' }, { pattern: 'b.js' }], 3).mode, 'dumb');
});

test('declaration : match = chaîne si 1 règle, liste si plusieurs', () => {
  assert.strictEqual(declaration([{ pattern: 'a.js' }], 0).match, 'a.js');
  assert.deepStrictEqual(declaration([{ pattern: 'a.js' }, { pattern: 'b.js' }], 0).match, ['a.js', 'b.js']);
});

test('declaration : scope/exclude repris de la 1ʳᵉ règle, omis si vides', () => {
  const d = declaration([{ pattern: 'a.js', scope: ['s'], exclude: [] }], 0);
  assert.deepStrictEqual(d.scope, ['s']);
  assert.ok(!('exclude' in d), 'un exclude vide ne doit pas être écrit');
});

test('planifier : une doc SANS frontmatter est planifiée', () => {
  const p = planifier([{ pattern: 'a.js', doc: 'docs/x.md' }], etat(['docs/x.md'], []));
  assert.strictEqual(p.actions.length, 1);
  assert.match(p.actions[0].frontmatter, /match: a\.js/);
});

test('planifier : une doc AVEC frontmatter n’est JAMAIS replanifiée (idempotence)', () => {
  const p = planifier([{ pattern: 'a.js', doc: 'docs/x.md' }], etat(['docs/x.md'], ['docs/x.md']));
  assert.deepStrictEqual(p.actions, []);
  assert.deepStrictEqual(p.deja, ['docs/x.md']);
});

test('planifier : une règle dont le .md n’existe pas est SIGNALÉE, jamais migrée', () => {
  const p = planifier([{ pattern: 'a.js', doc: 'docs/fantome.md' }], etat([], []));
  assert.deepStrictEqual(p.actions, []);
  assert.deepStrictEqual(p.morts, ['docs/fantome.md']);
});

test('planifier : le frontmatter produit se relit à l’identique (round-trip)', () => {
  const p = planifier([{ pattern: 'a.js', doc: 'docs/x.md', scope: ['s'] }], etat(['docs/x.md'], []));
  const d = parse(p.actions[0].frontmatter + 'corps').data;
  assert.strictEqual(d.match, 'a.js');
  assert.deepStrictEqual(d.scope, ['s']);
  assert.strictEqual(d.rank, 0);
});

// ═══════════════════════════════════════════════════════════════════════
// TUEURS DE MUTANTS (Stryker, 15/07/2026 — 94,52%, 4 survivants)
// ⚠️ Muter une entrée de CLES en "" survivait : aucun test n'exerçait `mode`
//    → `serialize` aurait pu OUBLIER une clé sans qu'un test rougisse.
// ═══════════════════════════════════════════════════════════════════════

test('MUTANT CLES — les 6 clés sont TOUTES sérialisées, dans l’ordre exact', () => {
  const out = serialize({ match: 'a.js', scope: ['s'], exclude: ['e'], mode: 'dumb', rank: 7 });
  assert.strictEqual(out, '---\nmatch: a.js\nscope: [s]\nexclude: [e]\nmode: dumb\nrank: 7\n---\n');
});

test('MUTANT CLES — une clé HORS liste n’est jamais écrite', () => {
  assert.strictEqual(serialize({ match: 'a.js', inconnu: 'x' }), '---\nmatch: a.js\n---\n');
});

test('MUTANT L78 — scope VIDE n’est pas écrit (Array.isArray && length)', () => {
  const d = declaration([{ pattern: 'a.js', scope: [] }], 0);
  assert.ok(!('scope' in d), 'un scope vide écrit = filtre fantôme sur la doc');
});

test('MUTANT L78 — scope NON-tableau n’est jamais écrit', () => {
  assert.ok(!('scope' in declaration([{ pattern: 'a.js', scope: 'oups' }], 0)));
});

test('MUTANT L79 — exclude non vide EST écrit', () => {
  assert.deepStrictEqual(declaration([{ pattern: 'a.js', exclude: ['n'] }], 0).exclude, ['n']);
});

test('MUTANT L79 — exclude NON-tableau n’est jamais écrit', () => {
  assert.ok(!('exclude' in declaration([{ pattern: 'a.js', exclude: 'oups' }], 0)));
});

// ═══════════════════════════════════════════════════════════════════════
// DIVERGENCE scope/exclude INTRA-DOC → `rules:` (mesuré 16/07/2026 : 31/103 docs)
// ⚠️ Avant ce format, declaration() prenait entries[0] : 31 docs migrées avec un
//    scope FAUX, en silence — sur-injection ou doc morte selon le sens de l'erreur.
// ═══════════════════════════════════════════════════════════════════════

test('DIVERGENCE — scopes différents entre règles → `rules:` par-entrée, rien perdu', () => {
  const d = declaration(
    [
      { pattern: 'a.js', scope: ['proj-a'] },
      { pattern: 'b.js' },
      { pattern: 'c.js', scope: ['proj-a'], exclude: ['dist'] },
    ],
    3
  );
  assert.ok(!('match' in d) && !('scope' in d) && !('exclude' in d), 'rules et match/scope sont exclusifs');
  assert.deepStrictEqual(d.rules, [
    { pattern: 'a.js', scope: ['proj-a'] },
    { pattern: 'b.js' },
    { pattern: 'c.js', scope: ['proj-a'], exclude: ['dist'] },
  ]);
  assert.strictEqual(d.mode, 'dumb');
  assert.strictEqual(d.rank, 3);
});

test('DIVERGENCE — SEUL le scope diverge (excludes identiques) → `rules:`', () => {
  // ⚠️ Tue le mutant `e.scope || null` → `e.scope && null` : sans ce cas, une
  //    divergence de scope PUR passait pour homogène → doc migrée avec le scope
  //    de la 1ʳᵉ règle = le bug réel des 31 docs, réintroduit par mutation.
  const d = declaration([{ pattern: 'a.js', scope: ['s1'] }, { pattern: 'b.js', scope: ['s2'] }], 0);
  assert.ok(Array.isArray(d.rules), 'divergence de scope seul non détectée');
  assert.deepStrictEqual(d.rules[1].scope, ['s2'], 'le scope de la 2ᵉ règle doit survivre');
});

test('DIVERGENCE — scope présent vs ABSENT → `rules:` (null ≠ liste)', () => {
  const d = declaration([{ pattern: 'a.js', scope: ['s1'] }, { pattern: 'b.js' }], 0);
  assert.ok(Array.isArray(d.rules));
  assert.ok(!('scope' in d.rules[1]), 'la règle sans scope ne doit PAS en gagner un');
});

test('DIVERGENCE — excludes différents à scopes égaux → `rules:` aussi', () => {
  const d = declaration([{ pattern: 'a.js', exclude: ['x'] }, { pattern: 'b.js' }], 0);
  assert.ok(Array.isArray(d.rules), 'une divergence d’exclude seule doit suffire');
});

test('HOMOGÈNE — scopes identiques sur toutes les règles → format `match:` simple', () => {
  const d = declaration([{ pattern: 'a.js', scope: ['s'] }, { pattern: 'b.js', scope: ['s'] }], 1);
  assert.deepStrictEqual(d.match, ['a.js', 'b.js']);
  assert.deepStrictEqual(d.scope, ['s']);
  assert.ok(!('rules' in d), 'homogène ne doit JAMAIS partir en rules (lisibilité)');
});

// ═══════════════════════════════════════════════════════════════════════
// ENTRELACEMENT (mesuré 16/07/2026 : 23 docs) — rank PAR ENTRÉE
// ═══════════════════════════════════════════════════════════════════════

test('ENTRELACÉE — declaration(interleaved) → rank par entrée = index JSON exact', () => {
  const d = declaration([{ pattern: 'a.js' }, { pattern: 'b.js' }], 2, true, [2, 9]);
  assert.deepStrictEqual(d.rules, [{ pattern: 'a.js', rank: 2 }, { pattern: 'b.js', rank: 9 }]);
});
test('NON entrelacée mais divergente — JAMAIS de rank par entrée (même avec idxs fournis)', () => {
  const d = declaration([{ pattern: 'a.js', scope: ['s'] }, { pattern: 'b.js' }], 0, false, [0, 1]);
  assert.ok(Array.isArray(d.rules));
  assert.ok(!('rank' in d.rules[0]), 'rank par entrée sans entrelacement = bruit fossilisé');
});
test('ENTRELACÉE — idxs absent/non-liste → pas de rank inventé (garde Array.isArray)', () => {
  const d = declaration([{ pattern: 'a.js', scope: ['s'] }, { pattern: 'b.js' }], 0, true, 'oups');
  assert.ok(!('rank' in d.rules[0]));
});
test('PLANIFIER — détection : span > count = entrelacée, contiguë = non', () => {
  const rules = [
    { pattern: 'a1', doc: 'docs/a.md' },
    { pattern: 'b1', doc: 'docs/b.md' },
    { pattern: 'a2', doc: 'docs/a.md' }, // a = span 0-2, 2 entrées → ENTRELACÉE
    { pattern: 'c1', doc: 'docs/c.md' },
    { pattern: 'c2', doc: 'docs/c.md' }, // c = span 3-4, 2 entrées → contiguë
  ];
  const p = planifier(rules, etat(['docs/a.md', 'docs/b.md', 'docs/c.md'], []));
  const fmA = p.actions.find((a) => a.doc === 'docs/a.md').frontmatter;
  const fmC = p.actions.find((a) => a.doc === 'docs/c.md').frontmatter;
  // a : rank par entrée aux index JSON exacts (0 et 2).
  assert.ok(fmA.includes('"rank":0') && fmA.includes('"rank":2'), fmA);
  // c : contiguë ET homogène → format match: simple, aucun rank par entrée.
  assert.ok(fmC.startsWith('---\nmatch: [c1, c2]'), fmC);
  assert.ok(!fmC.includes('"rank"'), fmC);
});

test('DIVERGENCE — round-trip : le frontmatter `rules:` se relit à l’IDENTIQUE', () => {
  const entries = [{ pattern: 'a.js', scope: ['s1'] }, { pattern: 'b.js', scope: ['s2'], exclude: ['e'] }];
  const d = declaration(entries, 5);
  const relu = parse(serialize(d) + 'corps').data;
  assert.deepStrictEqual(relu.rules, d.rules, 'rules perdu au round-trip = scope perdu sur doc réelle');
  assert.strictEqual(relu.rank, 5);
});
