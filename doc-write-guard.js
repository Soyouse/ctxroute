#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// GARDE D'ÉCRITURE — hook PostToolUse (Write|Edit) : feedback TEMPS RÉEL
// à l'agent qui vient d'écrire une doc du parc.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CONTRAT (décision mainteneur 17/07/2026) : doc SAINE = SILENCE TOTAL (zéro
//    pollution de contexte) ; doc CASSÉE = `decision: "block"` + raison →
//    l'agent est informé DANS SON TOUR et corrige immédiatement, au lieu de
//    l'apprendre au prochain démarrage (lint) ou au push (gates). Les trois
//    filets coexistent : temps réel (ici) / session (lint) / push (CI).
//
// ⚠️ La VALIDATION est DÉLÉGUÉE à frontmatter.js (validate / validateMcp) —
//    seule autorité, jamais re-jugée ici (2 codes pour 1 jugement = dérive).
//    Docs session : rien à valider par construction (tout .md s'injecte).
//
// ⚠️ FAIL-OPEN intégral : fichier illisible/supprimé/hors-parc → exit 0 muet.
//    Un hook ne bloque JAMAIS le travail pour sa propre panne.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

require('./deadline').arm();

// ⚠️ Corps commun EXTRAIT dans guard-core.js (19/07/2026, portage Codex) :
//    cette coquille ne garde que l'extraction Claude Code (file_path direct).
const { run } = require('./guard-core');
const { readStdinJson } = require('./stdin-json');

readStdinJson(
  (data) => {
    const filePath = (data.tool_input || {}).file_path;
    run(typeof filePath === 'string' ? [filePath] : []);
    // ⚠️ La sortie appartient à la COQUILLE (06/08/2026, cf guard-core).
    process.exit(0);
  },
  () => process.exit(0)
);
