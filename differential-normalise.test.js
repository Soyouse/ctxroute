// ═══════════════════════════════════════════════════════════════════════
// differential-normalise — NEGATIVE-CHECK OBLIGATOIRE
// ═══════════════════════════════════════════════════════════════════════
// 🛑 RAISON D'ÊTRE : `sansOrdinal()` AFFAIBLIT DÉLIBÉRÉMENT les différentiels
//    (elle retire de la matière avant comparaison). Une fonction de
//    comparaison non testée peut avaler une VRAIE régression, et les deux
//    filets resteraient VERTS dessus. C'est le seul risque du module, et ces
//    quatre volets sont ce qui le tient.
// ⚠️ Même discipline que le negative-check de `desceller()` dans
//    `porte-differential.test.js` — ne JAMAIS livrer l'un sans l'autre.
import { test } from 'vitest';
import assert from 'node:assert';
import { sansOrdinal } from './differential-normalise.js';

const NU = 'corps de doc\n[source: .claude/hooks/docs/a.md]';

test('sansOrdinal : retire l\'ordinal posé après le tag source, et RIEN d\'autre', () => {
  assert.strictEqual(sansOrdinal(NU + ' [DOC 2/5]'), NU);
  // Plusieurs documents dans un même contexte : tous nettoyés.
  const deux = NU + ' [DOC 1/2]\n\n---\n\nautre\n[source: docs/mcp/odoo.md] [DOC 2/2]';
  assert.strictEqual(sansOrdinal(deux).includes('[DOC '), false);
  assert.strictEqual(sansOrdinal(deux).includes('[source: docs/mcp/odoo.md]'), true,
    'le tag source DOIT survivre — c\'est le chemin que l\'agent suit pour corriger la doc');
});

test('sansOrdinal : un contexte SANS ordinal ressort à l\'octet près', () => {
  assert.strictEqual(sansOrdinal(NU), NU);
  assert.strictEqual(sansOrdinal(''), '');
});

// 🛑 LE VOLET QUI COMPTE — sans lui, un effacement AVEUGLE passerait les trois
//    autres tout en rendant les différentiels borgnes sur du contenu réel.
test('sansOrdinal : un [DOC x/y] du CORPS d\'une doc SURVIT (jamais un effacement aveugle)', () => {
  const corpsQuiEnParle = 'la trame porte [DOC 1/3]\n[source: .claude/hooks/docs/b.md]';
  assert.strictEqual(sansOrdinal(corpsQuiEnParle), corpsQuiEnParle);
  // Et le cas mixte : le corps garde le sien, le tag perd le sien.
  const mixte = 'exemple [DOC 9/9] dans le texte\n[source: .claude/hooks/docs/c.md] [DOC 1/2]';
  assert.strictEqual(sansOrdinal(mixte),
    'exemple [DOC 9/9] dans le texte\n[source: .claude/hooks/docs/c.md]');
});

test('sansOrdinal : une divergence de CONTENU reste VISIBLE après normalisation', () => {
  const a = sansOrdinal(NU + ' [DOC 2/5]');
  const b = sansOrdinal(NU.replace('corps', 'CORPS') + ' [DOC 2/5]');
  assert.notStrictEqual(a, b, 'la normalisation ne doit JAMAIS masquer un écart de contenu');
  // Un chemin source différent = une divergence RÉELLE, elle doit survivre.
  const c = sansOrdinal(NU.replace('a.md', 'z.md') + ' [DOC 2/5]');
  assert.notStrictEqual(a, c);
});

// TOTALE — appelée sur une valeur absente (contexte `undefined` côté MCP quand
// le hook n'injecte rien), elle ne doit PAS jeter : un différentiel qui plante
// se lit comme une panne de moteur.
test('sansOrdinal : TOTALE — entrée non-chaîne rendue telle quelle, jamais un jet', () => {
  for (const x of [undefined, null, 42, {}]) assert.strictEqual(sansOrdinal(x), x);
});
