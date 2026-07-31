// ═══════════════════════════════════════════════════════════════════════
// GATE DES DÉCLENCHEURS — « déclaré » DOIT vouloir dire « consommé ».
// ═══════════════════════════════════════════════════════════════════════
//
// RAISON D'ÊTRE (31/07/2026, REFACTOR-PLAN §A) : `validate()` répondait
// 0 ERREUR sur une doc du corpus FICHIER portant `mcp:` — clé CONNUE, donc
// acceptée, et consommée par AUCUNE source ⇒ doc MUETTE, validateur content.
// ⚠️ C'est PIRE qu'une typo (`mach:` = rejeté, doc morte détectée) : la clé
//    est reconnue, donc le validateur APPROUVE DU MORT. Un validateur qui
//    approuve du mort n'est pas neutre — il oriente activement vers la
//    mauvaise cause (le 31/07 : accuser le MOTEUR de ne pas lire les commandes).
//
// ⚠️ CE GATE NE LIT AUCUNE LISTE : il APPELLE les sources réelles et exige
//    qu'un déclencheur produise un match. Une liste recopiée mentirait le jour
//    où une source change ; un appel réel, jamais. C'est la différence entre
//    « certifier » et « prouver ».
//
// ⚠️ AJOUTER UN DÉCLENCHEUR À `DECLENCHEURS` SANS SON CAS DE PREUVE = ROUGE.
//    C'est voulu : un déclencheur sans preuve de consommation est exactement
//    le bug que ce fichier existe pour rendre impossible.
//
// ⚠️ ZÉRO I/O, zéro parc : valable sur un clone VIERGE (un gate qui n'est vrai
//    que sur la machine de son auteur est faux pour tout le monde).
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { validate, DECLENCHEURS, KNOWN } from './frontmatter.js';
import { rulesFromCorpus } from './loader.js';
import fileSource from './sources/file.js';
import toolSource from './sources/tool.js';

// Un cas = un frontmatter minimal + le payload qui DOIT le déclencher, et la
// source censée le consommer. Thunks (jamais de const de module : perTest).
const CAS = () => ({
  match: {
    fm: '---\nmatch: cible-unique.js\nmode: dumb\n---\nCorps.\n',
    payload: { toolName: 'Read', toolInput: { file_path: 'C:/p/cible-unique.js' } },
    via: 'fichier',
  },
  rules: {
    fm: '---\nrules: [{"pattern":"cible-unique.js"}]\nmode: dumb\n---\nCorps.\n',
    payload: { toolName: 'Read', toolInput: { file_path: 'C:/p/cible-unique.js' } },
    via: 'fichier',
  },
  tool: {
    fm: '---\ntool: ["WebFetch"]\nmode: dumb\n---\nCorps.\n',
    payload: { toolName: 'WebFetch', toolInput: { url: 'https://exemple.test' } },
    via: 'outil',
  },
});

// Passe un frontmatter dans la VRAIE chaîne de sa source, rend true s'il matche.
function declenche(texte, payload, via) {
  const doc = 'docs/preuve.md';
  if (via === 'fichier') {
    return fileSource.matchingDocs(rulesFromCorpus([{ doc, text: texte }]), payload).length > 0;
  }
  // Axe outil : la source consomme le frontmatter parsé (contrat sources/tool.js).
  const { parse } = require('./frontmatter.js');
  return toolSource.matchingDocs([{ doc, fm: parse(texte).data }], payload).length > 0;
}

test('GATE : tout déclencheur de DECLENCHEURS a un cas de preuve', () => {
  const cas = CAS();
  for (const k of DECLENCHEURS) {
    assert.ok(cas[k],
      `\`${k}\` est déclaré déclencheur mais n'a AUCUN cas de preuve ici : ajoute-le, ` +
      'ou retire-le de DECLENCHEURS. Un déclencheur non prouvé = doc muette + validateur content.');
  }
});

test('GATE : chaque déclencheur DÉCLENCHE vraiment (appel de source réel)', () => {
  const cas = CAS();
  for (const k of DECLENCHEURS) {
    const c = cas[k];
    assert.equal(validate(require('./frontmatter.js').parse(c.fm).data).length, 0,
      `le frontmatter de preuve de \`${k}\` doit être VALIDE`);
    assert.ok(declenche(c.fm, c.payload, c.via),
      `\`${k}\` est déclaré déclencheur mais AUCUNE source ne le consomme — c'est un faux vert (§A).`);
  }
});

test('CONTRAT : `mcp` N\'EST PLUS un déclencheur du corpus fichier', () => {
  // ⚠️ Valeur de CONTRAT écrite EN DUR : dériver l'attendu de la valeur testée
  //    ferait muter le test AVEC le code (mutant invisible).
  assert.deepStrictEqual(DECLENCHEURS, ['match', 'rules', 'tool']);
});

test('§A : une doc FICHIER portant `mcp:` est ROUGE, avec le message qui dit où aller', () => {
  const errs = validate({ mcp: 'stripe' });
  assert.ok(errs.length > 0, '`mcp:` dans une doc fichier DOIT être rejeté (avant : 0 erreur, doc muette)');
  const texte = errs.join(' | ');
  assert.ok(/CHEMIN/.test(texte), 'le message doit indiquer le CHEMIN docs/mcp/{serveur}.md');
  assert.ok(!/aucun déclencheur/.test(texte),
    'un seul message utile : empiler « aucun déclencheur » noierait la ligne qui répare');
});

test('NEGATIVE-CHECK : le gate DÉTECTE un déclencheur non consommé', () => {
  // ⚠️ Sans ceci, le gate pourrait passer au vert en ne prouvant RIEN.
  //    On simule l'ajout d'un déclencheur fantôme et on exige la détection.
  const cas = CAS();
  const fantome = 'perimetre'; // synonyme réellement inventé puis supprimé le 18/07/2026
  const listeSabotee = [...DECLENCHEURS, fantome];
  const manquants = listeSabotee.filter((k) => !cas[k]);
  assert.deepStrictEqual(manquants, [fantome],
    'le gate ne détecte pas un déclencheur sans preuve : il ne prouve RIEN.');
});

test('NEGATIVE-CHECK : une clé de KNOWN ne suffit JAMAIS à déclencher', () => {
  // `scope` est connu et légitime, mais SEUL il ne déclenche rien : le
  // distinguer d'un déclencheur est tout l'objet de §A.
  assert.ok(KNOWN.includes('scope') && !DECLENCHEURS.includes('scope'));
  assert.ok(validate({ scope: ['x'] }).length > 0,
    'une doc avec `scope` seul serait muette : elle DOIT être rouge');
});
