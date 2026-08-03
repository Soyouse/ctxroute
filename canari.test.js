// ⚠️ CE QUE CETTE SUITE PROTÈGE : le SEUL témoin qui regarde l'autre bout du
//    tuyau. S'il se trompe, on croit être surveillé alors qu'on ne l'est pas —
//    une fausse confiance vaut moins que pas de témoin du tout.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  verdict, etiquette, compter, SEUIL_APPELS, FENETRE_OCTETS, MARQUE_INJECTION,
} from './canari.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));

// ⚠️ Dialecte du HARNAIS, déclaré ICI comme le fait la coquille — le NOYAU ne
//    le connaît pas (contrat de portage : porter le canari = changer cette
//    chaîne dans une coquille, et rien d'autre).
const MARQUE_APPEL = '"type":"tool_use"';
const appel = () => '{"type":"tool_use","name":"Read"}\n';
const injection = () => 'ma doc\n[source: .claude/hooks/docs/x.md]\n';

// ── LE VERDICT ──────────────────────────────────────────────────────────
test('VIVANT : UNE SEULE injection constatée suffit — on ne compte jamais un attendu', () => {
  // ⚠️ Invariant de conception : le canari ne compare PAS « reçu » à « espéré »
  //    (ce serait de l'estimation). Une trace = le canal transporte. Point.
  assert.equal(verdict(1000, 1), 'vivant');
  assert.equal(verdict(0, 1), 'vivant');
});

test('MORT : des appels, ZÉRO injection, au-delà du seuil', () => {
  assert.equal(verdict(SEUIL_APPELS, 0), 'mort');
  assert.equal(verdict(SEUIL_APPELS + 500, 0), 'mort');
});

test('FRONTIÈRE du seuil : à SEUIL-1 on se TAIT, à SEUIL pile on accuse', () => {
  // ⚠️ Le silence sous le seuil est un CHOIX : accuser trop tôt fabriquerait
  //    des fausses alertes, et un gate qui crie sur du sain cesse d'être lu.
  assert.equal(verdict(SEUIL_APPELS - 1, 0), 'indecidable');
  assert.equal(verdict(SEUIL_APPELS, 0), 'mort');
});

test('INDÉCIDABLE : session qui démarre (rien observé) ⇒ aucune accusation', () => {
  assert.equal(verdict(0, 0), 'indecidable');
});

test('TOTAL : entrées absurdes ⇒ jamais un throw, jamais une accusation', () => {
  // ⚠️ Un canari qui plante est un canari MUET — pire qu'absent, puisqu'on
  //    croirait être surveillé. Il doit encaisser n'importe quelle entrée.
  for (const mauvais of [undefined, null, NaN, -3, 1.5, '30', {}, []]) {
    assert.equal(verdict(mauvais, 0), 'indecidable', 'appels=' + String(mauvais));
    assert.equal(verdict(SEUIL_APPELS, mauvais), 'mort', 'injections=' + String(mauvais));
  }
});

test("SEUIL : valeur de CONTRAT écrite en dur (jamais dérivée du code testé)", () => {
  // ⚠️ Dériver l'attendu de la constante muterait AVEC le code : le mutant
  //    deviendrait invisible. Précédent réel du parc, cf quality-configs.
  assert.equal(SEUIL_APPELS, 25);
  assert.equal(FENETRE_OCTETS, 2097152);
});

// ── L'ÉTIQUETTE ─────────────────────────────────────────────────────────
test("ÉTIQUETTE : MUETTE quand tout va bien, explicite quand c'est mort", () => {
  // ⚠️ Le silence sur le sain EST la fonctionnalité : une alarme permanente
  //    devient un décor. Ne jamais y mettre un « ✅ ok ».
  assert.equal(etiquette('vivant'), '');
  assert.equal(etiquette('indecidable'), '');
  assert.equal(etiquette('mort'), '💉⚠️ INJECTION MORTE');
  assert.equal(etiquette('nimporte quoi'), '');
});

// ── LE COMPTAGE ─────────────────────────────────────────────────────────
test('COMPTAGE : les deux témoins, sur un extrait réaliste', () => {
  const s = appel() + injection() + appel() + appel();
  assert.deepEqual(compter(s, MARQUE_APPEL), { appels: 3, injections: 1 });
});

test('COMPTAGE : occurrences ADJACENTES toutes vues (pas de chevauchement raté)', () => {
  assert.deepEqual(compter(MARQUE_APPEL + MARQUE_APPEL + MARQUE_APPEL, MARQUE_APPEL).appels, 3);
  assert.deepEqual(compter(MARQUE_INJECTION + MARQUE_INJECTION, MARQUE_APPEL).injections, 2);
});

test('COMPTAGE : ligne TRONQUÉE en tête ⇒ robuste (la fenêtre coupe au milieu)', () => {
  // ⚠️ La lecture bornée COUPE forcément une ligne. Compter des sous-chaînes
  //    (et non du JSON parsé) est ce qui rend ça inoffensif — ne pas « améliorer »
  //    en parsant, le canari deviendrait fragile au découpage pour zéro gain.
  const tronque = 'e":"tool_use","name":"Bash"}\n' + appel() + injection();
  assert.deepEqual(compter(tronque, MARQUE_APPEL), { appels: 1, injections: 1 });
});

test('COMPTAGE : marque d\'appel ABSENTE ou VIDE ⇒ zéro, jamais un comptage délirant', () => {
  // ⚠️ La marque vient de la COQUILLE (dialecte du harnais). Si une coquille
  //    l'oublie, une marque vide ferait compter une occurrence à CHAQUE
  //    position — des milliers d'« appels » fictifs, donc un verdict « mort »
  //    fabriqué de toutes pièces. On rend zéro : le canari se TAIT plutôt que
  //    de mentir sur une configuration incomplète.
  const s = appel().repeat(5) + injection();
  for (const mauvaise of [undefined, null, '', 42, {}]) {
    assert.deepEqual(compter(s, mauvaise), { appels: 0, injections: 0 }, 'marque=' + String(mauvaise));
  }
});

test('COMPTAGE : entrée non-chaîne ⇒ zéro, jamais un throw', () => {
  for (const mauvais of [undefined, null, 42, {}]) {
    assert.deepEqual(compter(mauvais, MARQUE_APPEL), { appels: 0, injections: 0 });
  }
});

// ── NEGATIVE-CHECK ──────────────────────────────────────────────────────
test('NEGATIVE-CHECK : le canari SAIT accuser (sinon il certifie au lieu de protéger)', () => {
  // ⚠️ Un dead-man switch jamais déclenché est une fausse confiance. On vérifie
  //    ici qu'il existe bien une entrée qui produit l'alerte — et une qui ne la
  //    produit PAS, sans quoi « mort » serait une constante.
  assert.equal(verdict(SEUIL_APPELS, 0), 'mort', 'il sait accuser');
  assert.notEqual(verdict(SEUIL_APPELS, 1), 'mort', "…et il sait s'abstenir");
  assert.notEqual(verdict(SEUIL_APPELS - 1, 0), 'mort', "…et il sait attendre d'en savoir assez");
});
