// ═══════════════════════════════════════════════════════════════════════
// SOURCE « TOOL » — déclencheur = NOM EXACT d'un outil natif du harnais.
// ═══════════════════════════════════════════════════════════════════════
//
// RAISON D'ÊTRE (19/07/2026, mesuré) : les outils natifs SANS chemin de
// fichier et SANS préfixe mcp__ (WebFetch, WebSearch, …) étaient un ANGLE
// MORT total — aucune source ne pouvait déclencher dessus (prouvé par spawn :
// silence sur un payload WebFetch). Or « l'agent utilise l'outil X » est un
// événement 100 % DÉCIDABLE — pile la primitive du framework.
// Cas fondateur : consigne « recherche web = sources du JOUR, doc officielle
// d'abord » jamais livrée aux (sous-)agents qui partent sur le web.
//
// ⚠️ SÉMANTIQUE DISJOINTE des autres déclencheurs — NE JAMAIS FUSIONNER :
//    `match:` = substring sur un CHEMIN · `mcp:` = nom exact d'un SERVEUR ·
//    `tool:` = nom EXACT (===, sensible à la casse) d'un OUTIL natif.
//    Un substring ici matcherait `WebFetch` dans un chemin de fichier — le
//    faux positif que la disjonction des clés élimine par construction.
// ⚠️ PURE (gate sources-must-stay-pure) : zéro I/O, zéro dialecte de harnais.
//    `scope`/`exclude` = MÊME sémantique que la source fichier, via
//    file.shouldSkip (SOURCE UNIQUE — ne jamais recopier la logique ; le
//    contexte d'exclude = le nom d'outil, seul « chemin en cours » qui existe).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const file = require('./file');

// `tool:` accepte chaîne OU liste (même totalité que isMatchDecl — un
// frontmatter est de la donnée non maîtrisée, jamais supposée bien formée).
function toolList(fm) {
  if (typeof fm.tool === 'string') return [fm.tool];
  return Array.isArray(fm.tool) ? fm.tool : [];
}

/**
 * LA fonction de la source tool. PURE.
 * @param {Array} docs - [{ doc, fm }] : docs du corpus fichier AVEC frontmatter validé.
 * @param {object} payload - { toolName, toolInput } neutre.
 * @returns {Array} refs { doc } dans l'ordre du corpus, dédup par la porte (docId).
 */
function matchingDocs(docs, payload) {
  // ⚠️ Pas de garde « toolName vide » : redondante par CONSTRUCTION (mutant
  //    équivalent sinon) — un frontmatter `tool: ''` est REJETÉ par validate
  //    (isMatchDecl exige non-vide), donc includes(''/undefined) = false déjà.
  const toolName = payload && payload.toolName;
  const toolInput = (payload && payload.toolInput) || {};
  const out = [];
  for (const { doc, fm } of docs) {
    if (!fm || !toolList(fm).includes(toolName)) continue;
    if (file.shouldSkip(fm, toolName, toolInput)) continue;
    out.push({ doc });
  }
  return out;
}

module.exports = { matchingDocs, toolList };
