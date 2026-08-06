// ═══════════════════════════════════════════════════════════════════════════
// declFor — UNE CLÉ DE DÉCISION FILTRÉE EST UNE CLÉ MORTE (06/08/2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 DÉFAUT RÉEL, ET LE PLUS COÛTEUX POSSIBLE : `enforce` (livré le 05/08/2026,
//    le mot qui REFUSE un geste) n'était PAS recopié par `sources/mcp.js`.
//    Il était donc accepté par `validateMcp`, documenté dans le skill, présent
//    dans les 4 corpus du gate de symétrie… et **INERTE sur le canal MCP** —
//    c'est-à-dire exactement là où vit l'incident FONDATEUR du framework (le
//    clic de paiement Stripe). Découvert le 06/08 en l'armant POUR DE VRAI :
//    `create_refund` rendait `allow`. Sans une vérification par spawn RÉEL,
//    j'aurais annoncé « c'est armé » et livré un cran d'arrêt qui ne s'arrête
//    jamais — pire que pas de cran d'arrêt, parce qu'on lui fait confiance.
//
// ⚠️ POURQUOI LE GATE DE SYMÉTRIE DU VOCABULAIRE NE L'A PAS VU : il vérifie que
//    la clé est ADMISE dans les 4 corpus (validation), pas qu'elle est
//    TRANSPORTÉE jusqu'à `gate.decide` (propagation). Deux invariants distincts.
//    Admettre une clé et l'honorer sont deux choses — celui-ci couvre la seconde.
//
// 🛑 LA FORME `declFor` EST UN PIÈGE STRUCTUREL : elle RECOPIE clé par clé, donc
//    tout ce qui n'est pas nommé est perdu EN SILENCE. La source fichier, elle,
//    passe le frontmatter ENTIER et n'a pas ce risque. Tant que cette asymétrie
//    existe, ce gate est le seul filet.

import { test } from 'vitest';
import assert from 'node:assert';
import * as gate from './gate.js';
import { declFor as declForMcp } from './sources/mcp.js';
import { declFor as declForSkill } from './sources/skill.js';

// ⚠️ Une valeur VALIDE et NON DÉFAUT par clé — sinon le test passerait même si
//    `declFor` inventait la valeur au lieu de la propager.
const ECHANTILLON = {
  mode: 'dumb',
  threshold: 7,
  driftUnit: 'turn',
  enforce: true,
};

// Les clés de DÉCISION sont DÉRIVÉES de gate.js : chaque résolveur `xForDoc`
// nomme la clé qu'il lit. Recopier une liste ici la ferait diverger — le bug
// même qu'on traque.
function clesDeDecision() {
  return Object.keys(gate)
    .filter((k) => k.endsWith('ForDoc'))
    .map((k) => k.slice(0, -'ForDoc'.length))
    // `bloque` n'est pas une clé de frontmatter : c'est le VERDICT dérivé
    // d'`enforce` + de l'état. Il n'a rien à propager.
    .filter((k) => k !== 'bloque');
}

test('DECLFOR ① : toute clé de DÉCISION est propagée par la source MCP', () => {
  const manquantes = clesDeDecision().filter((cle) => {
    const decl = declForMcp({}, 'srv', { [cle]: ECHANTILLON[cle] });
    return decl[cle] !== ECHANTILLON[cle];
  });
  assert.deepStrictEqual(manquantes, [],
    'FILTRÉES EN SILENCE par sources/mcp.js#declFor : ' + manquantes.join(', ')
    + '\nLa clé sera acceptée par validateMcp et n\'aura AUCUN effet.'
    + '\nAjouter sa recopie dans declFor — la validation ne suffit pas.');
});

test('DECLFOR ② : toute clé de DÉCISION est propagée par la source SKILL', () => {
  const manquantes = clesDeDecision().filter((cle) => {
    const decl = declForSkill({ [cle]: ECHANTILLON[cle] });
    return decl[cle] !== ECHANTILLON[cle];
  });
  assert.deepStrictEqual(manquantes, [],
    'FILTRÉES EN SILENCE par sources/skill.js#declFor : ' + manquantes.join(', '));
});

test('DECLFOR ③ : l ÉCHANTILLON couvre toutes les clés (anti-angle-mort)', () => {
  // ⚠️ Sans ce volet, ajouter une clé de décision SANS l'ajouter à ECHANTILLON
  //    la rendrait `undefined === undefined` ⇒ VERTE alors qu'elle est filtrée.
  //    Le gate se certifierait lui-même — le défaut qu'il existe pour empêcher.
  const nonCouvertes = clesDeDecision().filter((c) => !(c in ECHANTILLON));
  assert.deepStrictEqual(nonCouvertes, [],
    'clé(s) de décision sans échantillon : ' + nonCouvertes.join(', ')
    + '\nAjouter une valeur VALIDE et NON DÉFAUT dans ECHANTILLON.');
  assert.ok(clesDeDecision().length >= 4, 'gate DORMANT : moins de 4 clés dérivées');
});

test('DECLFOR ④ : `false` EXPLICITE survit — la désinscription doit rester possible', () => {
  // ⚠️ Un filtre « valeur vide » sur les booléens rendrait `enforce: false`
  //    indistinguable d'absent, donc une catégorie passée en
  //    `defaults.{source}.enforce` deviendrait INDÉSINSCRIPTIBLE : l'impasse
  //    de toute cascade. Le cas vaut pour les DEUX sources.
  assert.strictEqual(declForMcp({}, 'srv', { enforce: false }).enforce, false);
  assert.strictEqual(declForSkill({ enforce: false }).enforce, false);
});

test('DECLFOR ⑤ : une valeur INVALIDE n est jamais propagée (elle retombe en cascade)', () => {
  // L'auteur PROPOSE, la cascade DISPOSE : une valeur hors vocabulaire ne doit
  // pas s'imposer à `gate.decide`, sinon un typo deviendrait une décision.
  assert.notStrictEqual(declForMcp({}, 'srv', { mode: 'turbo' }).mode, 'turbo');
  assert.strictEqual(declForMcp({}, 'srv', { driftUnit: 'lune' }).driftUnit, undefined);
  assert.strictEqual(declForMcp({}, 'srv', { enforce: 'oui' }).enforce, undefined);
  assert.strictEqual(declForSkill({ enforce: 'oui' }).enforce, undefined);
});
