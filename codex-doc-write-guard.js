#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// COQUILLE CODEX — PostToolUse : garde d'écriture des docs du parc.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ TOUT le corps vit dans guard-core.js (source unique, partagé avec
//    doc-write-guard.js/Claude Code). Ce fichier = UNIQUEMENT l'extraction
//    des chemins au dialecte Codex.
//
// ⚠️ DIALECTE CODEX (doc officielle re-lue le 19/07/2026) : l'écriture passe
//    par `apply_patch`, chemins DANS le texte du patch (tool_input.command).
//    L'extraction est DÉLÉGUÉE à sources/file.js#extractFilePaths — le MÊME
//    parseur (pur, muté Stryker) que le match d'injection : un patch qui
//    matche à l'entrée est garanti gardé à la sortie, par construction.
//    Un patch multi-fichiers = tous les chemins validés (guard-core).
//
// ⚠️ Sortie `decision: "block"` = dialecte commun mesuré (cf guard-core).
// ⚠️ FAIL-OPEN intégral ; deadline armée AVANT toute I/O.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

require('./deadline').arm();

const { run } = require('./guard-core');
const { extractFilePaths } = require('./sources/file');
const { readStdinJson } = require('./stdin-json');

readStdinJson(
  (data) => {
    // ⚠️ La sortie appartient à la COQUILLE (06/08/2026, cf guard-core).
    run(extractFilePaths(data.tool_name || '', data.tool_input || {}));
    process.exit(0);
  },
  () => process.exit(0)
);
