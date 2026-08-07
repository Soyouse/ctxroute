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
  verdict, etiquette, compterInjections, SEUIL_EMISSIONS, FENETRE_OCTETS, MARQUE_INJECTION,
} from './canari.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));

// ⚠️ PLUS AUCUN DIALECTE DE HARNAIS ICI (07/08/2026). Cette suite déclarait
//    `MARQUE_APPEL = '"type":"tool_use"'` pour simuler le comptage des appels
//    dans le transcript. Ce comptage a été SUPPRIMÉ : la doc officielle Codex
//    dit « the transcript format isn't a stable interface for hooks and may
//    change over time ». Le dénominateur vient désormais de notre propre
//    compteur d'émissions (`emission-core`), et la ligne de bruit ci-dessous ne
//    sert plus qu'à prouver qu'on ne compte PAS n'importe quoi.
const bruitHarnais = () => '{"type":"tool_use","name":"Read"}\n';
const injection = () => 'ma doc\n[source: .claude/hooks/docs/x.md]\n';

// ── LE VERDICT ──────────────────────────────────────────────────────────
test('VIVANT : UNE SEULE injection constatée suffit — on ne compte jamais un attendu', () => {
  // ⚠️ Invariant de conception : le canari ne compare PAS « reçu » à « espéré »
  //    (ce serait de l'estimation). Une trace = le canal transporte. Point.
  assert.equal(verdict(1000, 1), 'vivant');
  assert.equal(verdict(0, 1), 'vivant');
});

test('MORT : des appels, ZÉRO injection, au-delà du seuil', () => {
  assert.equal(verdict(SEUIL_EMISSIONS, 0), 'mort');
  assert.equal(verdict(SEUIL_EMISSIONS + 500, 0), 'mort');
});

test('FRONTIÈRE du seuil : à SEUIL-1 on se TAIT, à SEUIL pile on accuse', () => {
  // ⚠️ Le silence sous le seuil est un CHOIX : accuser trop tôt fabriquerait
  //    des fausses alertes, et un gate qui crie sur du sain cesse d'être lu.
  assert.equal(verdict(SEUIL_EMISSIONS - 1, 0), 'indecidable');
  assert.equal(verdict(SEUIL_EMISSIONS, 0), 'mort');
});

test('INDÉCIDABLE : session qui démarre (rien observé) ⇒ aucune accusation', () => {
  assert.equal(verdict(0, 0), 'indecidable');
});

test('TOTAL : entrées absurdes ⇒ jamais un throw, jamais une accusation', () => {
  // ⚠️ Un canari qui plante est un canari MUET — pire qu'absent, puisqu'on
  //    croirait être surveillé. Il doit encaisser n'importe quelle entrée.
  for (const mauvais of [undefined, null, NaN, -3, 1.5, '30', {}, []]) {
    assert.equal(verdict(mauvais, 0), 'indecidable', 'emissions=' + String(mauvais));
    assert.equal(verdict(SEUIL_EMISSIONS, mauvais), 'mort', 'injections=' + String(mauvais));
  }
});

test("SEUIL : valeur de CONTRAT écrite en dur (jamais dérivée du code testé)", () => {
  // ⚠️ Dériver l'attendu de la constante muterait AVEC le code : le mutant
  //    deviendrait invisible. Précédent réel du parc, cf quality-configs.
  assert.equal(SEUIL_EMISSIONS, 25);
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
test('COMPTAGE : seules NOS marques comptent — le bruit du harnais est ignoré', () => {
  // ⚠️ CE TEST EST LE CŒUR DU CHANGEMENT DU 07/08/2026. Le transcript contient
  //    quantité de structures propres au harnais ; aucune ne doit peser sur le
  //    verdict, parce que leur format n'est garanti par personne. Seule
  //    `[source:` — que NOUS écrivons — est comptée.
  const s = bruitHarnais() + injection() + bruitHarnais() + bruitHarnais();
  assert.equal(compterInjections(s), 1);
  assert.equal(compterInjections(bruitHarnais().repeat(50)), 0);
});

test('COMPTAGE : occurrences ADJACENTES toutes vues (pas de chevauchement raté)', () => {
  assert.equal(compterInjections(MARQUE_INJECTION + MARQUE_INJECTION), 2);
  assert.equal(compterInjections(MARQUE_INJECTION.repeat(7)), 7);
});

test('COMPTAGE : ligne TRONQUÉE en tête ⇒ robuste (la fenêtre coupe au milieu)', () => {
  // ⚠️ La lecture bornée COUPE forcément une ligne. Compter des sous-chaînes
  //    (et non du JSON parsé) est ce qui rend ça inoffensif — ne pas « améliorer »
  //    en parsant, le canari deviendrait fragile au découpage ET dépendant d'un
  //    format que la doc Codex déclare instable, pour zéro gain.
  const tronque = 'e":"tool_use","name":"Bash"}\n' + bruitHarnais() + injection();
  assert.equal(compterInjections(tronque), 1);
});

test('COMPTAGE : entrée non-chaîne ⇒ zéro, jamais un throw', () => {
  for (const mauvais of [undefined, null, 42, {}, []]) {
    assert.equal(compterInjections(mauvais), 0);
  }
});

// ⚠️ TEST SUPPRIMÉ, ET C'EST UN GAIN — « marque d'appel ABSENTE ou VIDE ⇒ zéro ».
//    Il protégeait d'un vrai piège : une coquille oubliant de fournir sa marque
//    de dialecte aurait compté une occurrence à CHAQUE position, fabriquant un
//    verdict « mort » de toutes pièces. Ce paramètre n'existe plus : le mode de
//    panne est ÉLIMINÉ PAR CONSTRUCTION, pas désactivé. Doctrine du repo — on
//    supprime la cause, on ne garde pas un test qui fige du code inutile.

// ── NEGATIVE-CHECK ──────────────────────────────────────────────────────
test('NEGATIVE-CHECK : le canari SAIT accuser (sinon il certifie au lieu de protéger)', () => {
  // ⚠️ Un dead-man switch jamais déclenché est une fausse confiance. On vérifie
  //    ici qu'il existe bien une entrée qui produit l'alerte — et une qui ne la
  //    produit PAS, sans quoi « mort » serait une constante.
  assert.equal(verdict(SEUIL_EMISSIONS, 0), 'mort', 'il sait accuser');
  assert.notEqual(verdict(SEUIL_EMISSIONS, 1), 'mort', "…et il sait s'abstenir");
  assert.notEqual(verdict(SEUIL_EMISSIONS - 1, 0), 'mort', "…et il sait attendre d'en savoir assez");
});
