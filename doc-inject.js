#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// PORTE UNIFIÉE — hook UNIQUE PreToolUse : sources FICHIER + MCP, dédup par DOC.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ LIVE depuis le 17/07/2026 (bascule fichier puis fusion MCP le même jour).
//    Câblée dans settings.json ; c'est ELLE qui injecte TOUTES les docs
//    (fichier via frontmatters, MCP via docs/mcp/) — protect-files.js ne garde
//    que deny/ask sécurité, mcp-doc-inject.js est RETIRÉ (cf REFACTOR-PLAN.md).
//
// ⚠️ EXTENSIBLE PAR REGISTRE : les sources vivent dans source-adapters.js
//    (contrat d'adaptateur documenté là-bas). Ajouter une source N'ÉDITE
//    JAMAIS ce fichier — il itère ADAPTERS, c'est tout.
//
// ⚠️ SEUL POINT D'I/O de la chaîne (avec les adaptateurs) : corpus → match
//    (sources pures) → décision (gate.js) → stdout. Toute la logique est
//    PURE et mutée ; ce fichier ne fait que lire/verrouiller/écrire.
//
// ⚠️ PARITÉ protect-files EXIGÉE sur le corpus migré (dumb + confirm: true) :
//    mêmes docs, même contenu (frontmatter retiré via parse().body — source
//    unique, jamais une regex recopiée), même format ask/allow, même label
//    [source: .claude/hooks/docs/…]. Scellée par porte-differential.test.js.
//
// ⚠️ Le rush d'aujourd'hui (.rush) devient `confirm: false` dans
//    mcp-doc-config.json (confirmFor, #4) — la porte NE lit JAMAIS .rush.
//    À la bascule : reporter l'état du .rush dans la config, puis retirer le fichier.
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
const { run } = require('./porte-core');
const { readStdinJson } = require('./stdin-json');

// Sortie hook — FORMAT protect-files À L'IDENTIQUE (parité de bascule).
// `systemMessage` est CALCULÉ PAR L'APPELANT : fichier seul = '📄 doc: …'
// (octet-identique à l'ancien), MCP = formatSystemMessage (badge
// '[mcp-doc-hooks]', parité mcp-doc-inject), mixte = les deux joints ' · '
// (avant la fusion, DEUX hooks émettaient DEUX messages — on les garde tous).
function emit(decision, fullDoc, systemMessage) {
  if (decision === 'ask') {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: '[FICHIER DOCUMENTE — MODIFICATION] Confirmer avant de modifier.\n\n' + fullDoc,
      },
    }));
  } else {
    const out = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        additionalContext: fullDoc,
      },
    };
    if (systemMessage) out.systemMessage = systemMessage;
    console.log(JSON.stringify(out));
  }
  process.exit(0);
}

readStdinJson(
  (data) => run(data, emit),
  () => process.exit(0)
);
