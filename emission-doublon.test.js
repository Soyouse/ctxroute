// ═══════════════════════════════════════════════════════════════════════
// ZÉRO DOUBLON — un segment ÉMIS ne doit JAMAIS rester en file (06/08/2026)
// ═══════════════════════════════════════════════════════════════════════
//
// 🔴 DÉFAUT RÉEL, OBSERVÉ EN PRODUCTION, PAS UNE CRAINTE THÉORIQUE. Mesuré
//    dans le transcript du 06/08/2026 : le morceau 7/8 du skill `ctxroute` a
//    été livré DEUX FOIS, à deux gestes distincts (marqueurs `2bc5f3df` puis
//    `03d7e9f2`), alors que les 7 autres ne l'ont été qu'une seule fois. C'est
//    le MAINTENEUR qui l'a vu à l'œil nu — aucun des 1000+ tests ne regardait
//    cet invariant.
//
// ⚠️ L'INVARIANT, ÉNONCÉ EXACTEMENT : à l'issue d'un geste, l'ensemble des
//    segments ÉMIS et l'ensemble des segments PERSISTÉS EN FILE doivent être
//    DISJOINTS. Un segment appartient à l'un ou à l'autre, jamais aux deux.
//    Sinon il est livré maintenant ET redélivré au geste suivant : du contexte
//    payé deux fois, et un agent qui lit deux fois la même chose sans savoir
//    laquelle fait autorité.
//
// 🛑 CE N'EST PAS UN TEST DE PERTE, C'EST SON MIROIR. `budget.property.test.js`
//    prouve la CONSERVATION (« rien ne s'évapore ») et il est AVEUGLE au cas
//    inverse : un segment livré deux fois est, du point de vue de la
//    conservation, parfaitement conservé. Conservation ET unicité — les deux,
//    jamais l'une pour l'autre.
//
// ⚠️ POURQUOI LE VOLET ③ (deux `emettre` dans le MÊME geste) : les N processus
//    de `--paquets N` sont PARALLÈLES. Le plan mémoïsé doit faire qu'un seul
//    appelle `emettre`, mais il est ÉCRIT APRÈS l'appel — il existe donc une
//    fenêtre où deux processus le manquent tous les deux. Le second lit une
//    file DÉJÀ réécrite par le premier : il ne voit plus le même monde, donc
//    ne décide plus le même découpage. C'est la définition d'une course, et
//    c'est la cause racine mesurée. 🛑 LE LOCK NE PROTÈGE PAS DE ÇA : il
//    sérialise les ÉCRITURES, il n'empêche pas une SECONDE DÉCISION d'être
//    prise sur un état modifié.

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import emission from './emission-core.js';

// ⚠️ Fixtures en THUNK, jamais des const de niveau module : Stryker `perTest`
//    transforme une fixture partagée en mutant STATIQUE, donc en faux
//    survivant (42 mesurés le 16/07/2026).
const grosDoc = () => [{
  id: 'doc/gros',
  label: 'gros.md',
  text: Array.from({ length: 400 }, (_, i) => `ligne ${i} ` + 'x'.repeat(70)).join('\n'),
}];

/** Isole le store : jamais le `state/` réel, il est partagé avec la prod. */
function isole(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-doublon-'));
  const avant = process.env.CTXROUTE_STATE_DIR;
  process.env.CTXROUTE_STATE_DIR = dir;
  try {
    return fn();
  } finally {
    if (avant === undefined) delete process.env.CTXROUTE_STATE_DIR;
    else process.env.CTXROUTE_STATE_DIR = avant;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Tous les ids réellement sortis, toutes trames confondues. */
const idsEmis = (paquets) => paquets.flatMap((p) => p.emis || []);

/** Ce qui est persisté pour le geste suivant = les différés de la DERNIÈRE trame. */
const idsEnFile = (paquets) => (paquets[paquets.length - 1].differes || []).map((s) => s.id);

test('① un segment ÉMIS ne reste jamais en file (le défaut du 06/08/2026)', () => {
  isole(() => {
    const em = emission.emettre({
      frais: grosDoc(), budgetMax: 8000, nbPaquets: 12, indice: 1, scopeId: 'S',
    });
    const enFile = idsEnFile(em.paquets);
    const doublons = idsEmis(em.paquets).filter((id) => enFile.includes(id));
    assert.deepStrictEqual(doublons, [], 'émis ET en file : ' + doublons.join(', '));
  });
});

test('② aucun segment n\'est émis deux fois dans un même geste', () => {
  isole(() => {
    const em = emission.emettre({
      frais: grosDoc(), budgetMax: 8000, nbPaquets: 12, indice: 1, scopeId: 'S',
    });
    const vus = new Set();
    const repetes = idsEmis(em.paquets).filter((id) => (vus.has(id) ? true : (vus.add(id), false)));
    assert.deepStrictEqual(repetes, [], 'émis plusieurs fois : ' + repetes.join(', '));
  });
});

// ⚠️ IL Y A EU UN VOLET ③ « COURSE », ET IL ÉTAIT ROUGE (06/08/2026). Il
//    appelait `emettre` DEUX FOIS pour le même geste — ce que faisaient les 12
//    processus de `--paquets 12` quand ils manquaient tous le plan mémoïsé — et
//    il rendait exactement le défaut observé en prod : les 5 morceaux déjà
//    sortis repartaient une seconde fois.
//
// 🛑 IL A ÉTÉ RETIRÉ PARCE QUE SA CAUSE N'EXISTE PLUS, PAS PARCE QU'IL GÊNAIT.
//    Le câblage est passé à UNE seule déclaration : il n'y a plus qu'un
//    processus par geste, donc plus qu'un `emettre`. La course est éliminée
//    PAR CONSTRUCTION — c'est la doctrine du repo (éliminer, jamais tester du
//    code qu'on aurait pu supprimer). Écrire un test pour rendre sûre une
//    concurrence qu'on peut simplement ne pas avoir, c'est figer le problème.
//
// ⚠️ CE QUI GARDE LA PORTE FERMÉE EST DONC AILLEURS, et c'est volontaire :
//    `doctor.js --settings` exige UNE déclaration et REFUSE `--paquets N>1`.
//    Le câblage vit HORS du repo (aucun test d'ici ne peut le voir) — c'est
//    la même raison qui fait que le check `--settings` est la seule couverture
//    du câblage depuis le début. Ne PAS réintroduire ici un test de course :
//    il redeviendrait rouge sans qu'aucun défaut n'existe.

test('③ plusieurs gestes successifs ne réémettent jamais un morceau déjà sorti', () => {
  isole(() => {
    const vusGlobal = new Set();
    const doublons = [];
    // Un `once` n'est décidé qu'une fois : le frais n'arrive qu'au 1er geste,
    // les suivants ne font que DRAINER la file. C'est le régime réel d'un skill.
    for (let geste = 1; geste <= 6; geste++) {
      const em = emission.emettre({
        frais: geste === 1 ? grosDoc() : [], budgetMax: 8000, nbPaquets: 1, indice: 1, scopeId: 'S',
      });
      for (const id of idsEmis(em.paquets)) {
        if (vusGlobal.has(id)) doublons.push(id);
        vusGlobal.add(id);
      }
    }
    assert.deepStrictEqual(doublons, [], 'livrés deux fois : ' + doublons.join(', '));
    assert.ok(vusGlobal.size > 1, 'le corpus doit avoir été morcelé, sinon le test ne prouve rien');
  });
});
