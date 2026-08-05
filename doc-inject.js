#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// PORTE UNIFIÉE — hook UNIQUE PreToolUse : sources FICHIER + MCP, dédup par DOC.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ LIVE depuis le 17/07/2026 (bascule fichier puis fusion MCP le même jour).
//    Câblée dans settings.json ; c'est ELLE qui injecte TOUTES les docs
//    (fichier via frontmatters, MCP via docs/mcp/) — protect-files.js ne garde
//    que deny/ask sécurité, legacy-mcp-inject.js est RETIRÉ (cf REFACTOR-PLAN.md).
//
// ⚠️ EXTENSIBLE PAR REGISTRE : les sources vivent dans source-adapters.js
//    (contrat d'adaptateur documenté là-bas). Ajouter une source N'ÉDITE
//    JAMAIS ce fichier — il itère ADAPTERS, c'est tout.
//
// ⚠️ SEUL POINT D'I/O de la chaîne (avec les adaptateurs) : corpus → match
//    (sources pures) → décision (gate.js) → stdout. Toute la logique est
//    PURE et mutée ; ce fichier ne fait que lire/verrouiller/écrire.
//
// ⚠️ PARITÉ protect-files EXIGÉE sur le corpus migré (dumb) :
//    mêmes docs, même contenu (frontmatter retiré via parse().body — source
//    unique, jamais une regex recopiée), même format de sortie, même label
//    [source: .claude/hooks/docs/…]. Scellée par porte-differential.test.js.
//
// ⚠️ La porte NE lit JAMAIS .rush (fichier sentinelle de protect-files.js).
//    Son remplaçant `confirm` a lui-même été RETIRÉ le 05/08/2026 : plus
//    aucun interrupteur de confirmation, ni fichier, ni clé de config.
//
// ⚠️ FAIL-OPEN intégral (config/corpus/state illisibles → exit 0 sans stdout),
//    SAUF le sens de l'injection sur échec de LOCK : on décide alors SANS état
//    (state = {}) plutôt que de se taire — l'ancien moteur n'a aucun état et
//    injecte toujours ; se taire sur contention = régression silencieuse.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ Échéance AVANT toute I/O (bug #68626 : 875 zombies le 15/07/2026).
require('./deadline').arm();

// ⚠️ Corps commun EXTRAIT dans porte-core.js (19/07/2026, portage Codex) :
//    cette coquille ne garde que le dialecte Claude Code — stdin + emit.
//    Toute évolution d'orchestration se fait DANS porte-core.js, jamais ici.
const { run, sortieDeny } = require('./porte-core');
const { parsePaquetArgs } = require('./lib-pure');
const { readStdinJson } = require('./stdin-json');

// Sortie hook — FORMAT protect-files À L'IDENTIQUE (parité de bascule).
// `systemMessage` est CALCULÉ PAR L'APPELANT : fichier seul = '📄 doc: …'
// (octet-identique à l'ancien), MCP = formatSystemMessage (badge
// '[ctxroute]', parité legacy-mcp-inject), mixte = les deux joints ' · '
// (avant la fusion, DEUX hooks émettaient DEUX messages — on les garde tous).
function emit(decision, fullDoc, systemMessage) {
  // ⚠️ `deny` (05/08/2026) — le SEUL cas où la porte arrête le geste.
  //    Doc officielle : « blocks the tool call, and shows Claude the reason ».
  //    Le savoir part donc en `permissionDecisionReason`, PAS en
  //    `additionalContext` : ce dernier n'arrive qu'à côté du RÉSULTAT, donc
  //    trop tard pour l'appel refusé. Aucune interaction utilisateur.
  // ⚠️ La décision vient de gate.js et de LUI SEUL (contrat : une coquille ne
  //    décide rien, elle traduit). Elle est déjà garantie compatible `once`,
  //    donc le 2ᵉ appel de l'agent passera — pas de boucle.
  if (decision === 'deny') {
    // ⚠️ SORTIE PARTAGÉE : le JSON de refus est identique sur les 2 harnais.
    //    Le dupliquer ici serait un CLONE — jscpd l'a vu le 05/08/2026, et le
    //    contrat de portage l'interdit. La DÉCISION, elle, vient de gate.js.
    console.log(JSON.stringify(sortieDeny(fullDoc)));
    process.exit(0);
  }
  // ⚠️ La branche `ask` a été RETIRÉE le 05/08/2026 (avec la clé `confirm`).
  //    Ne JAMAIS la réintroduire : `ask` demandait une autorisation à l'HUMAIN,
  //    à l'opposé du 0-human, et n'existait pas côté Codex. Le seul refus du
  //    framework est `deny` (ci-dessus), automatique et identique partout.
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      additionalContext: fullDoc,
    },
  };
  if (systemMessage) out.systemMessage = systemMessage;
  console.log(JSON.stringify(out));
  process.exit(0);
}

// ⚠️ DIALECTE CLAUDE CODE — c'est ICI, et NULLE PART ailleurs, que le noyau
//    apprend qu'un transport multi-trames est possible (CONTRAT D'EXTENSION §7 :
//    le moteur ne lit JAMAIS un champ de harnais).
//    · `tool_use_id` = identifiant d'invocation, présent sur PreToolUse (doc
//      officielle, vérifiée le 03/08/2026). Il permet aux N processus PARALLÈLES
//      de partager UNE décision : sans lui, chacun consommerait les docs `once`
//      et les paquets 2..N seraient vides.
//    · `--paquet k --paquets N` viennent de settings.json (le MÊME script
//      déclaré N fois — Claude Code déduplique par commande + args, donc des
//      indices différents ne sont PAS fusionnés : doc officielle 03/08/2026).
//    · Rien de déclaré ⇒ trame unique ⇒ comportement d'aujourd'hui à l'octet.
readStdinJson(
  (data) => run(data, emit, {
    ...parsePaquetArgs(process.argv),
    invocationId: typeof data.tool_use_id === 'string' ? data.tool_use_id : '',
  }),
  () => process.exit(0)
);
