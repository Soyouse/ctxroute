// ═══════════════════════════════════════════════════════════════════════
// differential-normalise.js — RETIRER L'ENVELOPPE AVANT DE COMPARER
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ PARTAGÉ PAR LES DEUX DIFFÉRENTIELS (`porte-differential`,
//    `mcp-differential`). SOURCE UNIQUE, jamais une copie : deux normalisations
//    divergeraient au premier changement de format, et deux filets qui ne
//    filtrent plus la même chose ne prouvent plus rien ensemble.
//
// 🛑 POURQUOI CE MODULE EXISTE. L'oracle (`protect-files.js`) est FIGÉ depuis
//    juillet : sa propre doc lui interdit d'évoluer. Tout ce qui est né APRÈS
//    lui (le sceau, puis l'ordinal) le fait diverger sur l'ENVELOPPE alors
//    qu'aucun moteur n'a changé. On compare donc le CONTENU, pas l'emballage.
//
// 🛑 CE MODULE EST UN AFFAIBLISSEMENT DÉLIBÉRÉ D'UN GARDE-FOU. Il DOIT donc
//    porter son negative-check (`differential-normalise.test.js`) : un filtre
//    de comparaison non testé peut avaler une VRAIE régression, et le
//    différentiel resterait vert dessus. C'est le seul risque de ce fichier.
// ⚠️ NE JAMAIS élargir un motif pour « faire passer » un rouge. Un différentiel
//    qu'on ajuste jusqu'à ce qu'il soit vert ne garde plus rien.

/**
 * Retire l'ordinal `[DOC i/T]` posé par la porte à côté du tag source.
 *
 * 🛑 ANCRÉ SUR LE TAG SOURCE, JAMAIS UN EFFACEMENT AVEUGLE. Retirer tout
 *    `[DOC x/y]` où qu'il soit avalerait une doc dont le CORPS contient
 *    légitimement ce texte — le différentiel deviendrait borgne exactement là
 *    où on croirait l'avoir renforcé. Le volet ③ du negative-check l'exige.
 * ⚠️ TOTALE : une entrée sans ordinal ressort à l'octet près.
 */
function sansOrdinal(ctx) {
  if (typeof ctx !== 'string') return ctx;
  return ctx.replace(/(\[source: [^\]]+\]) \[DOC \d+\/\d+\]/g, '$1');
}

module.exports = { sansOrdinal };
