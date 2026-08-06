// ═══════════════════════════════════════════════════════════════════════
// SOURCE « MCP » — PURE. payload → quelles docs MCP (ids corpus 'mcp/…').
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O (même règle que sources/file.js — gate dependency-cruiser).
//    Réplique EXACTE de la sélection de legacy-mcp-inject.js : serverName →
//    isServerActive (filterMode/filterList) → docCandidatePaths (3 niveaux,
//    subToolParam, isSafePathSegment). Toute la sémantique vit dans lib-pure ;
//    ce module ne fait qu'ALIGNER les candidats sur le vocabulaire de la porte
//    (ids 'mcp/{…}.md' = ids du corpus lu par readCorpus(paths.docsDir(), 'mcp/')).
//
// ⚠️ Decl (mode/threshold) d'une doc MCP — PRÉCÉDENCE (17/07/2026, décision
//    le mainteneur « le frontmatter précise, le JSON est global ») :
//      frontmatter de LA doc  >  config servers.{name}  >  config globale  >  défaut.
//    Une doc sans frontmatter (ou à valeur invalide → fallback TOTAL, jamais
//    de throw) hérite du serveur — comportement d'avant, parité intacte.
//    Chaque doc garde SON compteur (dédup par DOC, cf REFACTOR-PLAN).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const lib = require('../lib-pure');
const { MODES, DRIFT_UNITS } = require('../frontmatter');

/**
 * Docs MCP candidates pour cet appel. [] si outil non-MCP ou serveur filtré.
 * @param {object} config - ctxroute-config.json
 * @param {{toolName: string, toolInput: object}} payload
 * @returns {Array<{doc: string, sourceLabel: string, level: string, server: string}>}
 *   ORDRE = global → spécifique (server, tool, subTool) — même ordre que
 *   docCandidatePaths, donc que l'ancien moteur. `doc` = id corpus ('mcp/x.md').
 */
function matchingDocs(config, { toolName, toolInput }) {
  const server = lib.serverName(toolName);
  // ⚠️ PAS de garde `if (!server)` ici : docCandidatePaths rejette déjà tout
  //    server null/unsafe (isSafePathSegment, defense-in-depth) — une garde
  //    redondante = mutant Stryker équivalent (éviter par construction).
  if (!lib.isServerActive(config, server)) return [];
  return lib.docCandidatePaths(config, server, toolName, toolInput || {}).map((c) => ({
    doc: 'mcp/' + c.relPath,
    sourceLabel: c.sourceLabel,
    level: c.level,
    server,
  }));
}

// Decl (vocabulaire gate.js) d'une doc MCP. `fm` = frontmatter parsé de LA doc
// (l'auteur propose) ; valeur absente OU invalide → fallback config serveur
// (l'utilisateur/global dispose, cf lib-pure). TOTAL : ne throw jamais.
// 🛑 CE COMMENTAIRE A CAUSÉ UN BUG — CORRIGÉ LE 06/08/2026. Il disait « une decl
//    ne porte QUE de la cadence », et cette phrase, JUSTE sur le fond (une source
//    n'arbitre rien, `gate.js` tranche), a été lue comme « donc ne recopie pas
//    `enforce` ». Résultat : `enforce` accepté par `validateMcp`, documenté
//    partout, et INERTE sur le canal MCP — là où vit l'incident FONDATEUR du
//    framework (le clic de paiement Stripe). Découvert en l'armant pour de vrai.
// ⚠️ LA DISTINCTION EXACTE, à ne plus confondre : une decl TRANSPORTE ce que
//    l'auteur a déclaré (mode, threshold, driftUnit, enforce) ; elle ne RÉSOUT
//    aucune cascade et ne prend aucune décision. Transporter ≠ décider.
// 🛑 TOUTE clé de décision DOIT être recopiée ici — `declfor-gate.test.js` la
//    dérive de `gate.js` et rougit si une seule manque. Ne pas s'y fier de
//    mémoire : la relecture a laissé passer `enforce` pendant 24 h.
function declFor(config, server, fm) {
  const data = fm || {};
  const decl = {
    mode: MODES.includes(data.mode) ? data.mode : lib.modeFor(config, server),
    threshold: Number.isInteger(data.threshold) && data.threshold >= 1
      ? data.threshold
      : lib.thresholdFor(config, server),
  };
  // ⚠️ `driftUnit` : l'auteur propose (frontmatter), sinon ABSENT — le fallback
  //    global (`defaultDriftUnit`) puis framework ('tool') vit dans gate.js
  //    (driftUnitForDoc), UNIQUE point de cascade. Pas de per-serveur : `servers`
  //    ne porte AUCUNE cadence (scellé config-gate, décision 17/07/2026).
  if (DRIFT_UNITS.includes(data.driftUnit)) decl.driftUnit = data.driftUnit;
  // ⚠️ `enforce` — MANQUAIT ICI pendant 24 h (05→06/08/2026). Cette `declFor`
  //    RECOPIE clé par clé : tout ce qui n'est pas nommé est perdu EN SILENCE.
  // ⚠️ Repris TEL QUEL, `false` COMPRIS : c'est lui qui permet à une doc de se
  //    DÉSINSCRIRE d'un `defaults.mcp.enforce`. Le filtrer comme une valeur
  //    « vide » rendrait la désinscription impossible (même raison que skill.js).
  if (typeof data.enforce === 'boolean') decl.enforce = data.enforce;
  return decl;
}

module.exports = { matchingDocs, declFor };
