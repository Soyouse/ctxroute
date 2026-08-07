// ═══════════════════════════════════════════════════════════════════════
// ZÉRO DOUBLON — un segment ÉMIS ne doit JAMAIS rester en file (06/08/2026)
// ═══════════════════════════════════════════════════════════════════════
//
// 🛑 ATTENTION — LE DÉFAUT FONDATEUR DE CE FICHIER N'A JAMAIS EXISTÉ.
//    RÉFUTÉ PAR LA MESURE LE 07/08/2026, et c'est écrit ici pour que personne
//    ne reparte de la fausse piste.
//
//    Ce fichier est né d'une observation du 06/08 : le morceau 7/8 du skill vu
//    DEUX FOIS dans le transcript (sceaux `2bc5f3df` puis `03d7e9f2`), d'où
//    l'hypothèse d'une course entre les N processus sur la file. **FAUX.** Le
//    transcript montre un hook **`PreCompact` entre les deux** (06:24:24) : la
//    compaction PURGE les états, donc une doc `once` redevient à livrer et se
//    réinjecte ENTIÈRE. C'est le comportement CONÇU — sans lui, l'agent
//    repartirait sans son skill après chaque compaction. Une 3ᵉ livraison à
//    16:39:57 suit le même schéma : un contexte de plus, pas un doublon.
//    Reproduction dédiée (12 processus RÉELLEMENT parallèles, 2 gestes, 105
//    puis 92 segments en file) : **0 doublon**, drainage propre `#12/23` →
//    `#13/23`. Il n'y avait rien à reproduire.
//
// ⚠️ POURQUOI CE FICHIER RESTE MALGRÉ TOUT. L'invariant qu'il énonce est SAIN
//    et n'était couvert par rien : `budget.property` prouve la CONSERVATION et
//    est structurellement aveugle à la duplication. Un test juste, né d'une
//    cause fausse, reste un test juste — on corrige son RÉCIT, on ne jette pas
//    sa garantie. 🛑 Mais ne JAMAIS le citer comme la preuve d'un bug passé.
//
// ⚠️ LEÇON DE MÉTHODE, le vrai legs de l'épisode : deux occurrences d'un même
//    identifiant NE SONT PAS un doublon tant qu'on n'a pas regardé CE QU'IL Y A
//    ENTRE LES DEUX. Le fait décisif était à trois lignes dans le transcript.
//    L'observation, héritée d'un RÉSUMÉ de session et jamais revérifiée, s'est
//    durcie en certitude à force d'être recopiée — dans le code, quatre docs et
//    le backlog — et a servi d'argument principal pour supprimer une capacité
//    qui fonctionnait. **Un défaut se REPRODUIT avant d'être gravé.**
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
// 🛑 CE QUI SUIVAIT ICI DÉCRIVAIT UNE « COURSE ENTRE PROCESSUS » COMME LA CAUSE
//    RACINE MESURÉE. C'ÉTAIT UNE HYPOTHÈSE, JAMAIS UNE MESURE — et elle est
//    RÉFUTÉE (cf en-tête : la compaction explique tout, et 12 processus
//    réellement parallèles sur 2 gestes ne produisent AUCUN doublon).
//    Le texte disait : « le plan mémoïsé est écrit APRÈS l'appel, il existe donc
//    une fenêtre où deux processus le manquent ». Cette fenêtre n'a jamais été
//    observée ; l'appel et l'écriture du plan sont dans la MÊME section
//    critique du lock.
// ⚠️ IL EST CONSERVÉ SOUS CETTE FORME, BARRÉ ET DATÉ, plutôt que supprimé :
//    une hypothèse effacée revient, une hypothèse RÉFUTÉE PAR ÉCRIT ne revient
//    pas. C'est la même règle que pour le backlog — un jugement renversé se
//    réécrit, il ne s'empile pas et ne s'efface pas non plus.

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

// 🛑 CE BLOC A JUSTIFIÉ, PENDANT 24 H, LE RETRAIT D'UN VOLET « COURSE » PAR DES
//    RAISONS AUJOURD'HUI PÉRIMÉES OU FAUSSES. Réécrit le 07/08/2026.
//
//    ① Il affirmait « le câblage est passé à UNE seule déclaration, donc plus
//       qu'un `emettre` par geste ». **PÉRIMÉ** : le câblage est revenu à
//       **12 déclarations** (bande passante, cf `paquet-unique.md`).
//    ② Il affirmait que le volet ③ rouge « rendait exactement le défaut observé
//       en prod ». **FAUX** : ce volet appelait `emettre` DEUX FOIS À LA MAIN,
//       ce que le code réel ne fait jamais — le plan mémoïsé et l'écriture de
//       la file sont dans la MÊME section critique du lock. Il reproduisait un
//       scénario FABRIQUÉ, pas le comportement du système. Et le « défaut
//       observé en prod » n'existait pas non plus (cf en-tête : compaction).
//    ③ Il affirmait que `doctor --settings` « exige UNE déclaration et REFUSE
//       `--paquets N>1` ». **PÉRIMÉ** : ces deux checks ont été remplacés par
//       des checks de COHÉRENCE (même N partout, autant de déclarations que de
//       trames, indices 1..N sans trou ni doublon, égalité avec la config).
//
// ⚠️ CE QU'IL FAUT EN RETENIR — un test qui prouve un scénario que le code ne
//    peut pas produire ne prouve RIEN sur le code. Il rassure ou il effraie,
//    au hasard. Avant d'écrire un test « de course », vérifier que la course
//    est ATTEIGNABLE : ici, 12 processus réellement parallèles sur 2 gestes
//    n'ont produit aucun doublon (sonde du 07/08).

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
