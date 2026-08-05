// ═══════════════════════════════════════════════════════════════════════
// loader.js — tests DÉTERMINISTES (cible Stryker)
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { rulesFromCorpus, rulesOfDecl } from './loader.js';

const md = (fm, body = 'corps') => `---\n${fm}\n---\n${body}`;

// ── rulesOfDecl : les 2 formats de déclaration ──
test('rulesOfDecl : match chaîne + scope/exclude de doc', () => {
  assert.deepStrictEqual(rulesOfDecl({ match: 'a.js', scope: ['s'], exclude: ['e'] }, 'docs/x.md'), [
    { pattern: 'a.js', doc: 'docs/x.md', scope: ['s'], exclude: ['e'] },
  ]);
});
test('rulesOfDecl : match liste → une règle par pattern, scope PARTAGÉ', () => {
  const r = rulesOfDecl({ match: ['a.js', 'b.js'], scope: ['s'] }, 'd.md');
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r[1], { pattern: 'b.js', doc: 'd.md', scope: ['s'] });
});
test('rulesOfDecl : rules par-entrée → scopes INDIVIDUELS préservés', () => {
  const r = rulesOfDecl({ rules: [{ pattern: 'a.js', scope: ['s1'] }, { pattern: 'b.js' }] }, 'd.md');
  assert.deepStrictEqual(r, [
    { pattern: 'a.js', doc: 'd.md', scope: ['s1'] },
    { pattern: 'b.js', doc: 'd.md' },
  ]);
});
test('rulesOfDecl : scope/exclude vides ou non-listes ne sont JAMAIS posés', () => {
  assert.deepStrictEqual(rulesOfDecl({ match: 'a.js', scope: [], exclude: 'oups' }, 'd.md'), [
    { pattern: 'a.js', doc: 'd.md' },
  ]);
  assert.deepStrictEqual(rulesOfDecl({ rules: [{ pattern: 'a.js', scope: [], exclude: 'x' }] }, 'd.md'), [
    { pattern: 'a.js', doc: 'd.md' },
  ]);
});
test('rulesOfDecl : ni match ni rules → aucune règle (doc mcp: seule)', () => {
  assert.deepStrictEqual(rulesOfDecl({ mcp: ['stripe'] }, 'd.md'), []);
});

// ── rulesFromCorpus : ordre + fail-open ──
test('ORDRE — rank croissant, doc entière AVANT la suivante (rule-major)', () => {
  const flat = rulesFromCorpus([
    { doc: 'b.md', text: md('match: [x, y]\nrank: 5') },
    { doc: 'a.md', text: md('match: z\nrank: 2') },
  ]);
  assert.deepStrictEqual(flat.map((r) => r.pattern), ['z', 'x', 'y']);
});
test('ORDRE — docs SANS rank : APRÈS les rankées, alphabétique (déterministe)', () => {
  const flat = rulesFromCorpus([
    { doc: 'zeta.md', text: md('match: n1') },
    { doc: 'alpha.md', text: md('match: n2') },
    { doc: 'ranked.md', text: md('match: r\nrank: 900') },
  ]);
  assert.deepStrictEqual(flat.map((r) => r.doc), ['ranked.md', 'alpha.md', 'zeta.md']);
});
test('ORDRE — rank ÉGAL : alphabétique (stable cross-filesystem)', () => {
  const flat = rulesFromCorpus([
    { doc: 'b.md', text: md('match: x\nrank: 1') },
    { doc: 'a.md', text: md('match: y\nrank: 1') },
  ]);
  assert.deepStrictEqual(flat.map((r) => r.doc), ['a.md', 'b.md']);
});
test('FAIL-OPEN — sans frontmatter, invalide, inject:never, mcp: seule → ignorées, les autres vivent', () => {
  const flat = rulesFromCorpus([
    { doc: 'nue.md', text: '# pas de frontmatter' },
    { doc: 'invalide.md', text: md('mach: typo') },
    { doc: 'ref.md', text: md('inject: never') },
    { doc: 'mcp.md', text: md('mcp: [stripe]') },
    { doc: 'ok.md', text: md('match: a.js') },
  ]);
  assert.deepStrictEqual(flat, [{ pattern: 'a.js', doc: 'ok.md' }]);
});
test('TOTALITÉ — corpus non-liste ou entrées bancales → [], jamais un throw', () => {
  assert.deepStrictEqual(rulesFromCorpus(null), []);
  assert.deepStrictEqual(rulesFromCorpus([null, {}, { doc: 'x.md' }, { text: '---' }]), []);
});
test('ENTRELACEMENT — rank PAR ENTRÉE : la règle tardive s\'évalue à SON index JSON', () => {
  // ⚠️ Le cas réel web-realtime/web-front (divergence attrapée le 16/07) : docA a des
  //    règles aux index 0 et 10, docB au 5. Un tri par doc donnerait a1,a2,b — FAUX.
  const flat = rulesFromCorpus([
    { doc: 'a.md', text: md('rules: [{"pattern":"a1","rank":0},{"pattern":"a2","rank":10}]\nrank: 0') },
    { doc: 'b.md', text: md('match: b1\nrank: 5') },
  ]);
  assert.deepStrictEqual(flat, [
    { pattern: 'a1', doc: 'a.md' },
    { pattern: 'b1', doc: 'b.md' },
    { pattern: 'a2', doc: 'a.md' },
  ]);
});
test('ENTRELACEMENT — le rank d\'entrée sert au TRI puis est STRIPPÉ de la règle plate', () => {
  const flat = rulesFromCorpus([{ doc: 'a.md', text: md('rules: [{"pattern":"p","rank":3}]\nrank: 3') }]);
  assert.deepStrictEqual(flat, [{ pattern: 'p', doc: 'a.md' }]);
});
test('rulesOfDecl — rank d\'entrée PRÉSERVÉ (rules), jamais inventé (match)', () => {
  assert.deepStrictEqual(rulesOfDecl({ rules: [{ pattern: 'p', rank: 7 }] }, 'd.md'), [
    { pattern: 'p', doc: 'd.md', rank: 7 },
  ]);
  assert.ok(!('rank' in rulesOfDecl({ match: 'p' }, 'd.md')[0]));
});
test('GARDE — doc non-string ou text absent → entrée ignorée même avec frontmatter valide', () => {
  assert.deepStrictEqual(rulesFromCorpus([{ doc: 42, text: md('match: a.js') }]), []);
  assert.deepStrictEqual(rulesFromCorpus([{ doc: 'x.md' }]), []);
});
test('GARDE — doc INVALIDE (clé inconnue) → ignorée MÊME si son match est valide', () => {
  // ⚠️ Sans ce cas, muter la garde validate() laissait vivre les docs à typo.
  assert.deepStrictEqual(rulesFromCorpus([{ doc: 'x.md', text: md('match: a.js\nmach: typo') }]), []);
});
test('ORDRE LOCAL — deux entrées rules SANS rank propre : ordre déclaré préservé', () => {
  const flat = rulesFromCorpus([
    { doc: 'a.md', text: md('rules: [{"pattern":"p1"},{"pattern":"p2"},{"pattern":"p3"}]\nrank: 1') },
  ]);
  assert.deepStrictEqual(flat.map((r) => r.pattern), ['p1', 'p2', 'p3']);
});

test('TRI À L\'ÉCHELLE — 25 docs, rank égal, ordre inverse → alpha strict (TimSort réel)', () => {
  // ⚠️ V8 utilise l'insertion sort SOUS ~23 éléments : les mutants du tie-break
  //    (`a.doc > b.doc`, `? 1 : 0`) y sont INVISIBLES (seul `< 0` décide du placement).
  //    25 éléments = TimSort merge réel → le comparateur complet devient observable.
  const docs = [];
  for (let k = 24; k >= 0; k--) {
    const name = 'doc' + String(k).padStart(2, '0') + '.md';
    docs.push({ doc: name, text: md('match: p' + k + '\nrank: 1') });
  }
  const flat = rulesFromCorpus(docs);
  const attendu = [...docs.map((d) => d.doc)].sort();
  assert.deepStrictEqual(flat.map((r) => r.doc), attendu);
});
test('TRI À L\'ÉCHELLE — 25 entrées d\'une MÊME doc : ordre local déclaré préservé', () => {
  const pats = Array.from({ length: 25 }, (_, k) => ({ pattern: 'p' + String(k).padStart(2, '0') }));
  const flat = rulesFromCorpus([{ doc: 'a.md', text: md('rules: ' + JSON.stringify(pats) + '\nrank: 1') }]);
  assert.deepStrictEqual(flat.map((r) => r.pattern), pats.map((p) => p.pattern));
});

test('RULES — doc `rules:` migrée relue → règles identiques à la déclaration', () => {
  const flat = rulesFromCorpus([
    { doc: 'p.md', text: md('rules: [{"pattern":"lock.js","scope":["ctxroute"],"exclude":["package-lock.json"]},{"pattern":"stdin-json.js"}]\nmode: dumb\nrank: 350') },
  ]);
  assert.deepStrictEqual(flat, [
    { pattern: 'lock.js', doc: 'p.md', scope: ['ctxroute'], exclude: ['package-lock.json'] },
    { pattern: 'stdin-json.js', doc: 'p.md' },
  ]);
});
