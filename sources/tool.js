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

// ⚠️ `toolList` VIT DANS frontmatter.js (c'est de la LECTURE de déclaration,
//    pas du matching) et n'est que RÉEXPORTÉ ici pour les appelants existants.
//    Il en existait une COPIE ici jusqu'au 31/07/2026 : deux lectures de la
//    même clé, donc deux façons de diverger en silence — précisément ce que ce
//    repo combat. La copie a été supprimée, pas « gardée au cas où ».

// ⚠️ JOKER `*` (31/07/2026, REFACTOR-PLAN §B/§B0) — une VALEUR spéciale, PAS un
//    opérateur : la base booléenne (match=OU, scope=ET, exclude=NON) reste
//    FERMÉE, aucun mot n'est ajouté au vocabulaire.
//    RAISON : `scope` voit tous les paramètres mais ne déclenche JAMAIS seul ;
//    pour réagir à un GESTE il fallait ÉNUMÉRER les outils
//    (["Bash","PowerShell","mcp__ssh__ssh_exec"]) — donc coder une liste là où
//    l'intention est « quel que soit l'outil ». Le jour où un shell/MCP
//    s'ajoute, la règle devient MUETTE EN SILENCE : précisément le défaut que
//    ce framework combat partout ailleurs.
//    ⚠️ AGGRAVANT MESURÉ AVANT LE FIX : `tool: ["*"]` était DÉJÀ accepté par
//    validate() ET ne matchait RIEN. La syntaxe que tout le monde essaie
//    spontanément était donc silencieusement morte ET certifiée valide — un
//    PIÈGE ACTIF, pas une simple fonction absente.
//    ⚠️ §B0 : c'est aussi ce qui rend la NÉGATION utilisable sur l'axe outil.
//    `exclude` était déjà matché contre le NOM D'OUTIL ici (cf shouldSkip
//    ci-dessous, dont le « contexte » est toolName) mais restait inerte : on
//    n'excluait rien d'une énumération qu'on écrivait soi-même. `*` + exclude
//    = « tous les outils SAUF X », qui était INEXPRIMABLE. La complétude
//    booléenne, annoncée par la doctrine, devient VRAIE sur l'axe outil.
//    ⚠️ SOURCE UNIQUE du symbole : il est défini dans `frontmatter.js` avec le
//    reste du VOCABULAIRE du langage (MODES, DRIFT_UNITS, KNOWN…). Le redéclarer
//    ici en ferait deux vérités — celles qui divergent en silence.
const { WILDCARD, toolList } = require('../frontmatter');

// ⚠️ Nom d'outil VIDE/absent ⇒ le joker NE matche PAS (cas négatif exigé) :
//    « n'importe quel outil » suppose qu'il y AIT un outil. Sans cette garde,
//    un payload dégradé déclencherait toutes les docs joker du parc.
function vise(noms, toolName) {
  if (noms.includes(toolName)) return true;
  return noms.includes(WILDCARD) && typeof toolName === 'string' && toolName !== '';
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
    if (!fm || !vise(toolList(fm), toolName)) continue;
    // ⚠️ `shouldSkip` reçoit toolName comme CONTEXTE : sur cet axe, `exclude`
    //    porte donc sur le NOM D'OUTIL (et non sur un chemin). C'est ce qui
    //    rend « tous SAUF X » exprimable une fois le joker posé (§B0).
    if (file.shouldSkip(fm, toolName, toolInput)) continue;
    out.push({ doc });
  }
  return out;
}

module.exports = { matchingDocs, toolList, vise, WILDCARD };
