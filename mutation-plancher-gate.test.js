// ═══════════════════════════════════════════════════════════════════════
// UN SEUIL GLOBAL EST AVEUGLE À L'EFFONDREMENT D'UN FICHIER (㉞, 08/08/2026)
// ═══════════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT RÉEL, ET IL N'EST PAS CELUI QUE LE BACKLOG ANNONÇAIT.
//    Le backlog (㉞) disait : « la mutation INCRÉMENTALE masque des survivants
//    ⇒ il faudrait une passe complète périodique ». **Deux erreurs**, toutes
//    deux corrigées par la mesure du 08/08/2026 :
//      ① la passe complète EXISTE DÉJÀ — `mutation.yml` fait `npm ci` sur un
//         clone vierge et ne restaure AUCUN cache incrémental (0 occurrence
//         de `incremental` dans le workflow), donc la CI mute TOUT à chaque
//         push touchant un module muté. Le faux vert était LOCAL, pas en CI ;
//      ② et malgré ça, `canari.js` est resté à **89,23 % avec 7 survivants**
//         sans que la CI bronche — parce que `thresholds.break` de Stryker
//         est **GLOBAL** : 99,64 % de moyenne noyaient l'effondrement.
//    ⇒ Ce n'est pas la fréquence des passes qui manquait, c'est la GRANULARITÉ
//      du verdict. C'est très exactement la classe ㉟ : *ce dont un gate tire
//      sa liste (ici : UN nombre agrégé) définit son angle mort.*
//
// ⚠️ MESURÉ AVANT D'ÊTRE ÉCRIT (règle du repo). Distribution réelle des 16
//    modules mutés au 08/08/2026 : **15 à 100,00 %**, `canari.js` seul en
//    dessous — et ses 4 derniers survivants étaient les 4 mutants d'une
//    fonction MORTE (`occurrences`, aucun appelant, non exportée), supprimée
//    dans le même geste plutôt que couverte. ⇒ plancher à 100 tenu par tous,
//    **zéro exemption**. Un plancher qu'il faut assortir d'exceptions dès le
//    premier jour est un plancher qu'on abaissera au deuxième.
//
// 🛑 LE PLANCHER NE REMPLACE PAS `break`, IL LE COMPLÈTE : `break` protège la
//    MOYENNE (un effondrement général), ce gate protège CHAQUE fichier (un
//    effondrement local). Retirer l'un en gardant l'autre laisse un angle mort.
//
// ⚠️ MUET SI LE RAPPORT N'EXISTE PAS — et c'est VOULU : `npm test` ne lance
//    pas Stryker (doctrine : gate jamais bloquant, la mutation tourne à part).
//    Exiger le rapport ferait rougir toute suite lancée sans mutation
//    préalable, donc un rouge permanent, donc un gate qu'on cesse de lire.
//    Le rapport EXISTE en CI mutation (le job écrit `reports/mutation.json`)
//    et en local après `npm run test:mutation` : c'est là qu'il mord.

'use strict';

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));

// ⚠️ CLIQUET : 100, jamais moins. Mesuré atteignable par les 16 modules.
//    NE JAMAIS l'abaisser pour faire passer un rouge — un survivant se TUE
//    (test ciblé) ou s'ÉLIMINE (code mort supprimé, cf `occurrences`), il ne
//    se tolère pas. Doctrine du repo : le cliquet ne redescend jamais.
const PLANCHER = 100;

// ⚠️ `Timeout` compte comme TUÉ (contrat Stryker : un mutant qui part en
//    boucle infinie est détecté). `Ignored` sort du dénominateur — c'est un
//    `// Stryker disable` DÉLIBÉRÉ et justifié dans le code.
const TUE = new Set(['Killed', 'Timeout', 'CompileError']);

/**
 * Rend les fichiers sous le plancher, ou `null` si la question ne se pose
 * pas (rapport absent/illisible). ⚠️ `null` = HORS PÉRIMÈTRE, jamais « sain ».
 */
function sousPlancher(rapport, plancher) {
  if (!rapport || typeof rapport !== 'object' || !rapport.files) return null;
  const fautifs = [];
  for (const [fichier, donnees] of Object.entries(rapport.files)) {
    const mutants = (donnees && donnees.mutants) || [];
    let tues = 0;
    let total = 0;
    for (const m of mutants) {
      if (!m || m.status === 'Ignored') continue;
      total++;
      if (TUE.has(m.status)) tues++;
    }
    if (total === 0) continue; // fichier sans mutant : rien à juger
    const score = (tues / total) * 100;
    if (score < plancher) {
      fautifs.push(`${fichier} : ${score.toFixed(2)} % (${total - tues} survivant(s) sur ${total})`);
    }
  }
  return fautifs;
}

test('㉞ — aucun module muté ne passe sous le plancher par fichier', () => {
  let rapport = null;
  try {
    rapport = JSON.parse(fs.readFileSync(path.join(ICI, 'reports', 'mutation.json'), 'utf8'));
  } catch {
    return; // rapport absent = hors périmètre (cf commentaire d'en-tête)
  }
  const fautifs = sousPlancher(rapport, PLANCHER);
  if (fautifs === null) return;
  assert.deepStrictEqual(fautifs, [],
    'Effondrement PAR FICHIER, invisible au seuil global de Stryker :\n  '
    + fautifs.join('\n  ')
    + '\n  ⇒ TUE le survivant (test ciblé) ou ÉLIMINE le code mort. Ne baisse JAMAIS le plancher.');
});

test('㉞ NEGATIVE — le plancher mord vraiment, et se tait vraiment', () => {
  // ⚠️ EN MÉMOIRE : on ne sabote jamais le vrai rapport, d'autres suites et
  //    la CI le lisent. Rapports FABRIQUÉS, aucun fichier touché.
  const rap = (statuts) => ({ files: { 'x.js': { mutants: statuts.map((s) => ({ status: s })) } } });

  // ① LE CAS RÉEL : canari.js à 89,23 % pendant que le global tenait 99,64 %.
  const effondre = sousPlancher(rap(['Killed', 'Survived']), 100);
  assert.strictEqual(effondre.length, 1, 'le gate ne voit pas un survivant : il est INERTE');
  assert.ok(/50\.00 %/.test(effondre[0]), 'le message doit donner le score réel, pas juste « échec »');

  // ② Contre-épreuve : tout tué ⇒ silence.
  assert.deepStrictEqual(sousPlancher(rap(['Killed', 'Killed']), 100), []);

  // ③ `Timeout` = TUÉ (contrat Stryker), sinon on rougirait sur du sain.
  assert.deepStrictEqual(sousPlancher(rap(['Killed', 'Timeout']), 100), []);

  // ④ `Ignored` sort du dénominateur : un `Stryker disable` justifié ne doit
  //    JAMAIS faire chuter le score, sinon on punit une exemption délibérée.
  assert.deepStrictEqual(sousPlancher(rap(['Killed', 'Ignored']), 100), []);

  // ⑤ Fichier SANS mutant = rien à juger (0/0 ne vaut pas 0 %).
  assert.deepStrictEqual(sousPlancher({ files: { 'v.js': { mutants: [] } } }, 100), []);

  // ⑥ TOTALITÉ : rapport absent/malformé ⇒ hors périmètre, jamais un crash
  //    ni un faux vert silencieux confondu avec un vrai.
  for (const x of [null, undefined, 42, {}, { files: null }]) {
    assert.strictEqual(sousPlancher(x, 100), null, `sousPlancher(${JSON.stringify(x)})`);
  }
});
