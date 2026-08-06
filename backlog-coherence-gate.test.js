// ═══════════════════════════════════════════════════════════════════════
// UN EN-TÊTE DE BACKLOG NE DOIT PAS MENTIR (gate, 06/08/2026)
// ═══════════════════════════════════════════════════════════════════════
//
// 🔴 CLASSE D'ERREUR RÉCURRENTE, PAS UN INCIDENT : **trois** en-têtes de
//    `REFACTOR-PLAN.md` annonçaient un chantier OUVERT alors que tout leur
//    contenu était FERMÉ — trouvés à la main les 05 et 06/08/2026 :
//      · « 🔴 3 OUVERTS sur 4 … Restent ①②④ » alors que ① était fermé la veille ;
//      · « 🔴 INJECTION TRONQUÉE EN SILENCE (prioritaire) » resté rouge DEUX
//        SEMAINES après que le transport multi-trames en eut supprimé la cause ;
//      · « 🔴 DEUX DÉFAUTS DU MOTEUR » dont ① était marqué ✅ RÉSOLU juste dessous.
//
// ⚠️ POURQUOI C'EST GRAVE ET PAS COSMÉTIQUE : le backlog est la SEULE mémoire
//    du projet entre deux sessions. Un en-tête faux fait rouvrir un chantier
//    clos, ou fait croire qu'un vrai chantier est traité. `pilotage.md` l'écrit
//    déjà — « un jugement RENVERSÉ se réécrit, il ne s'empile pas » — mais une
//    consigne en PROSE n'a pas tenu trois fois de suite. Doctrine du repo :
//    une consigne qui ne tient pas doit devenir un DÉCLENCHEUR MÉCANIQUE.
//
// ⚠️ CE QUE CE GATE PROUVE, ET RIEN DE PLUS : la COHÉRENCE INTERNE d'une
//    section — « une section annoncée ouverte dont TOUTES les sous-sections
//    sont fermées ment ». 🛑 Il ne prouve JAMAIS qu'un chantier ouvert existe
//    encore dans la réalité du code : ça, c'est indécidable ici. Ne pas le
//    vendre pour ce qu'il n'est pas (même leçon que `doc-drift-gate`, qui
//    prouve l'EXISTENCE d'un fichier cité, jamais la VÉRITÉ de la doc).
//
// ⚠️ UNE SECTION SANS SOUS-SECTION EST IGNORÉE : son statut ne se dérive de
//    rien, l'exiger produirait du bruit — et un gate bruyant finit contourné.

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));

// ⚠️ Marqueurs volontairement LARGES : le backlog est écrit à la main, en
//    français, par des agents successifs. Un vocabulaire étroit rendrait le
//    gate inerte au premier synonyme — le piège des gates de pureté du 03/08.
const OUVERT = /🔴|🟠|🟡|OUVERT|BACKLOG/;
const FERME = /✅|FERMÉ|FERME|RÉSOLU|RESOLU|LIVRÉ|LIVRE|TRAITÉ|TRAITE|EXÉCUTÉ|EXECUTE/;

/** Découpe le backlog en sections `## …` portant leurs sous-titres `### …`. */
function sections(texte) {
  const lignes = texte.split(/\r?\n/);
  const out = [];
  let courante = null;
  for (const l of lignes) {
    if (/^##\s/.test(l) && !/^###/.test(l)) {
      courante = { titre: l, sous: [] };
      out.push(courante);
    } else if (/^###\s/.test(l) && courante) {
      courante.sous.push(l);
    }
  }
  return out;
}

/** Les sections dont l'en-tête MENT : annoncée ouverte, tout le contenu fermé. */
function menteuses(texte) {
  return sections(texte)
    .filter((s) => s.sous.length > 0)
    .filter((s) => OUVERT.test(s.titre) && !FERME.test(s.titre))
    .filter((s) => s.sous.every((t) => FERME.test(t)))
    .map((s) => s.titre.slice(0, 100));
}

test('aucun en-tête de REFACTOR-PLAN n\'annonce ouvert ce qui est entièrement fermé', () => {
  const texte = fs.readFileSync(path.join(ICI, 'REFACTOR-PLAN.md'), 'utf8');
  const faux = menteuses(texte);
  assert.deepStrictEqual(faux, [],
    'En-tête(s) qui mentent — réécris-les (ne PAS les empiler) :\n  ' + faux.join('\n  '));
});

test('NEGATIVE — le gate rougit vraiment (sabotage EN MÉMOIRE, jamais le vrai fichier)', () => {
  // ⚠️ EN MÉMOIRE, PAS SUR DISQUE : un sabotage sur fichier réel avait fait
  //    tomber 38 tests d'autres suites qui lisaient en parallèle (31/07/2026).
  const sabote = [
    '## 🔴 CHANTIER SOI-DISANT OUVERT',
    '### ① ✅ RÉSOLU le 01/01',
    '### ② LIVRÉ le 02/01',
  ].join('\n');
  assert.strictEqual(menteuses(sabote).length, 1, 'le gate ne voit pas un en-tête faux : il est INERTE');

  // Contre-épreuve : une section réellement ouverte ne doit PAS être signalée.
  const sain = ['## 🔴 VRAI CHANTIER', '### ① ✅ RÉSOLU', '### ② encore à faire'].join('\n');
  assert.deepStrictEqual(menteuses(sain), [], 'faux positif : une section avec du travail restant est signalée');

  // Contre-épreuve : une section sans sous-section est hors périmètre.
  assert.deepStrictEqual(menteuses('## 🔴 SANS SOUS-SECTION'), [], 'une section sans sous-titre ne doit rien déclencher');
});
