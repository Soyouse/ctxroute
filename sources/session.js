// ═══════════════════════════════════════════════════════════════════════
// SOURCE « SESSION » — corpus docs/session/ → docs à injecter au SessionStart.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ PURE (gate `sources-must-stay-pure`) : zéro fs/path/process — l'appelant
//    (session-inject.js) lit le disque et fournit le corpus. Condition pour
//    muter par Stryker sans mutants équivalents.
//
// ⚠️ AUCUN DIALECTE DE HARNAIS (gate `sources-must-not-know-the-harness`) :
//    cette source répond « quels docs, dans quel ordre ? » — le format de
//    sortie SessionStart appartient à la PORTE (portage Codex trivial).
//
// ⚠️ SÉMANTIQUE VOLONTAIREMENT TOTALE : tout .md de docs/session/ est injecté
//    à CHAQUE SessionStart (startup/resume/clear/compact), sans état ni mode.
//    C'est le contrat « comme CLAUDE.md » — une doc de référence non injectable
//    n'a RIEN à faire dans docs/session/, elle vit ailleurs. Pas de filtre par
//    matcher ici tant qu'aucun besoin réel ne l'exige (feature spéculative).
//
// ⚠️ Le frontmatter éventuel est RETIRÉ via frontmatter.parse (source unique,
//    jamais une regex recopiée). Doc vide après strip = ignorée (zéro bruit).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { parse } = require('../frontmatter');

/**
 * @param {Array<{doc: string, text: string}>} corpus - sortie de readCorpus.
 * @returns {Array<{doc: string, body: string}>} docs à injecter, ordre alpha
 *   par id (déterministe — l'ordre du filesystem ne l'est pas).
 */
function sessionDocs(corpus) {
  return corpus
    .map((e) => ({ doc: e.doc, body: parse(e.text).body.trim() }))
    .filter((e) => e.body.length > 0)
    // localeCompare (et pas un ternaire `<`) : les ids sont UNIQUES, donc le
    // cas d'égalité d'un ternaire serait un mutant équivalent garanti (`<` vs `<=`).
    .sort((a, b) => a.doc.localeCompare(b.doc));
}

module.exports = { sessionDocs };
