// ═══════════════════════════════════════════════════════════════════════
// LE COMPTEUR D'ÉMISSIONS — le dénominateur du canari.
// ═══════════════════════════════════════════════════════════════════════
//
// 🔴 CE QU'IL PROTÈGE, ET POURQUOI ÇA VAUT UNE SUITE (07/08/2026).
//    Le canari répond à « on a émis N fois, est-ce arrivé ? ». Sans dénominateur
//    fiable, ses deux modes de panne sont SILENCIEUX et OPPOSÉS :
//    ① compteur trop BAS (ou jamais lu)  ⇒ verdict `indecidable` éternel ⇒ un
//       dead-man switch muet et vert, qui fabrique de la confiance ;
//    ② compteur trop HAUT (passages à vide comptés) ⇒ accusation « INJECTION
//       MORTE » sur un système parfaitement sain ⇒ alarme qu'on cesse de lire.
//    Aucun des deux ne casse un test existant : d'où ce fichier.
//
// ⚠️ POURQUOI CE COMPTEUR EXISTE PLUTÔT QU'UN COMPTAGE DANS LE TRANSCRIPT :
//    doc officielle des hooks Codex — « the transcript format isn't a stable
//    interface for hooks and may change over time ». On ne bâtit pas un filet
//    sur un format que l'éditeur se réserve le droit de casser.
//
// ⚠️ ISOLATION : `CTXROUTE_STATE_DIR` en tmpdir. Un test n'écrit JAMAIS dans les
//    stores livrés (bug RÉEL du 15/07/2026 : une fixture polluée avait rendu le
//    framework muet pendant des jours).
// ═══════════════════════════════════════════════════════════════════════

import { test, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SID = 'emission-test';
let racine;

beforeEach(() => {
  racine = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-emission-'));
  process.env.CTXROUTE_STATE_DIR = racine;
});

afterEach(() => {
  delete process.env.CTXROUTE_STATE_DIR;
  fs.rmSync(racine, { recursive: true, force: true });
});

/** ⚠️ Import FRAIS à chaque test : `paths.js` peut figer la racine à l'import. */
function couche() {
  for (const k of Object.keys(require.cache)) {
    if (/emission-core|paths|session-store/.test(k)) delete require.cache[k];
  }
  return require('./emission-core.js');
}

const seg = (id) => ({ id, text: 'contenu de ' + id });
const emettre = (em, frais) => em.emettre({
  frais, budgetMax: 8000, nbPaquets: 1, indice: 1, scopeId: SID,
});

test('COMPTE : une émission porteuse incrémente de 1, et le compte est CUMULATIF', () => {
  const em = couche();
  assert.equal(em.compteurEmissions(SID), 0, 'départ à zéro');
  emettre(em, [seg('a')]);
  assert.equal(em.compteurEmissions(SID), 1);
  emettre(em, [seg('b')]);
  emettre(em, [seg('c')]);
  assert.equal(em.compteurEmissions(SID), 3);
});

test('NE COMPTE PAS : un passage À VIDE laisse le compteur intact', () => {
  // ⚠️ L'INVARIANT LE PLUS IMPORTANT DU FICHIER. `emettre` est appelée à chaque
  //    geste, y compris quand rien n'est décidé et que la file est vide. Compter
  //    ces passages ferait grimper le dénominateur sans qu'aucune trace ne soit
  //    jamais attendue en face ⇒ le canari accuserait une panne INEXISTANTE.
  const em = couche();
  emettre(em, [seg('a')]);
  for (let i = 0; i < 20; i++) emettre(em, []);
  assert.equal(em.compteurEmissions(SID), 1, '20 gestes sans contenu n\'ont rien à prouver');
});

test('SCOPE : deux agents comptent SÉPARÉMENT (jamais un compteur global)', () => {
  // ⚠️ Maître et sous-agents sont des contextes DISTINCTS : un compteur partagé
  //    ferait accuser un agent pour les émissions d'un autre.
  const em = couche();
  emettre(em, [seg('a')]);
  em.emettre({ frais: [seg('b')], budgetMax: 8000, nbPaquets: 1, indice: 1, scopeId: SID + '--agent-x' });
  assert.equal(em.compteurEmissions(SID), 1);
  assert.equal(em.compteurEmissions(SID + '--agent-x'), 1);
});

test('RÉTRO-COMPAT : un store écrit AVANT la clé `emissions` vaut 0, jamais une erreur', () => {
  // ⚠️ Expand/contract : la clé est apparue le 07/08/2026 sur des stores qui
  //    existaient déjà. Lever une erreur ici tuerait le canari sur toutes les
  //    sessions en cours — un filet qui casse au déploiement ne protège personne.
  const em = couche();
  fs.writeFileSync(path.join(racine, `reliquat-${SID}.json`), JSON.stringify({ segments: [] }));
  assert.equal(em.compteurEmissions(SID), 0);
  emettre(em, [seg('a')]);
  assert.equal(em.compteurEmissions(SID), 1, 'et il repart normalement');
});

test('TOTAL : store absent, illisible ou valeur absurde ⇒ 0, jamais un throw', () => {
  // ⚠️ Un canari qui plante est un canari MUET — pire qu'absent, puisqu'on
  //    croirait être surveillé. Toute entrée doit être encaissée.
  const em = couche();
  assert.equal(em.compteurEmissions('jamais-vu'), 0);
  for (const absurde of [{ emissions: -5 }, { emissions: 1.5 }, { emissions: '30' }, { emissions: null }, {}]) {
    fs.writeFileSync(path.join(racine, `reliquat-${SID}.json`), JSON.stringify({ segments: [], ...absurde }));
    assert.equal(em.compteurEmissions(SID), 0, 'valeur=' + JSON.stringify(absurde));
  }
});

test('LA FILE SURVIT AU COMPTEUR : les deux vivent dans le MÊME store sans se marcher dessus', () => {
  // ⚠️ Le compteur a été logé dans l'écriture de la file pour ne coûter AUCUNE
  //    I/O supplémentaire. Le prix de ce choix serait de casser la file : ce test
  //    est ce qui rend ce prix nul.
  const em = couche();
  // ⚠️ CALIBRAGE MESURÉ, pas deviné : à une seule trame le morcelage livre TOUT
  //    tant que le contenu tient dans le budget (3 segments courts / 60 c
  //    sortaient entiers — première version de ce test faussement rouge, l'erreur
  //    était dans le test). Il faut donc un contenu franchement plus gros que la
  //    capacité de la trame pour qu'un reliquat existe.
  const gros = Array.from({ length: 40 }, (_, i) => ({ id: 'g' + i, text: 'x'.repeat(500) }));
  em.emettre({ frais: gros, budgetMax: 900, nbPaquets: 1, indice: 1, scopeId: SID });
  assert.ok(em.chargerFile(SID).length > 0, 'prémisse : il reste du contenu en file');
  assert.equal(em.compteurEmissions(SID), 1, 'le compteur n\'a pas écrasé la file, ni l\'inverse');
});
