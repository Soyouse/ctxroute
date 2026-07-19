// ═══════════════════════════════════════════════════════════════════════
// SOURCE « MCP » — PURE. payload → quelles docs MCP (ids corpus 'mcp/…').
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O (même règle que sources/file.js — gate dependency-cruiser).
//    Réplique EXACTE de la sélection de mcp-doc-inject.js : serverName →
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
 * @param {object} config - mcp-doc-config.json
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
// ⚠️ Jamais de `confirm` ici : la source MCP INFORME, elle ne demande jamais
//    de confirmation (parité mcp-doc-inject.js, qui n'a aucun ask).
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
  return decl;
}

module.exports = { matchingDocs, declFor };
