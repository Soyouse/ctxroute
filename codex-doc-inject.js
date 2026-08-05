#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// COQUILLE CODEX — PreToolUse : dialecte de sortie Codex CLI (≥ 0.144).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ TOUT le corps vit dans porte-core.js (source unique, partagé avec
//    doc-inject.js/Claude Code). Ce fichier = UNIQUEMENT le dialecte Codex.
//    Ajouter une feature ici = mauvaise couche — STOP (cf skill §Porter).
//
// ⚠️ DIALECTE CODEX (doc officielle re-lue le 19/07/2026) :
//    - stdin : session_id/cwd/tool_name/tool_input — IDENTIQUE à Claude Code,
//      SANS agent_id → lib.scopeId (dans porte-core) retourne la clé simple :
//      état PARTAGÉ maître/sous-agents, absorbé par construction. Le jour où
//      OpenAI expose agent_id, AUCUN code à changer.
//    - stdout : hookSpecificOutput.additionalContext + systemMessage = OK.
//    - `permissionDecision: "ask"` = « parsed but not supported yet ». Il
//      n'y a plus rien à dégrader : `ask` a été RETIRÉ du framework le
//      05/08/2026 (escalade humaine = anti 0-human, et sens différent selon
//      le harnais). NE PAS le réintroduire pour Codex « quand il le gérera » :
//      `enforce`/`deny` couvre le besoin, à l'identique sur les 2 harnais.
//    - `permissionDecision: "allow"` : OMIS volontairement — on n'accorde
//      jamais une permission à la place du harnais, on informe seulement.
//
// ⚠️ FAIL-OPEN intégral (porte-core) ; deadline armée AVANT toute I/O.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ Échéance AVANT toute I/O (bug #68626 : 875 zombies le 15/07/2026 —
//    même classe de risque sur Codex : stdin jamais fermé = process éternel).
require('./deadline').arm();

const { run, sortieDeny } = require('./porte-core');
const { readStdinJson } = require('./stdin-json');
const lib = require('./lib-pure');

// ⚠️ `budgetDeclare` vit dans lib-pure.js (PUR, muté 100 %) et non ici : les
//    DEUX émetteurs Codex en ont besoin, et un clone de parseur d'argument est
//    exactement ce que jscpd interdit. La coquille ne fait que TRANSMETTRE.

function emit(decision, fullDoc, systemMessage) {
  // ⚠️ `deny` (05/08/2026) — DIALECTE IDENTIQUE à Claude Code, contrairement à
  //    `ask`. Doc officielle Codex : même forme JSON, « fully automatic —
  //    without requiring approval prompts » (aucune interaction utilisateur).
  //    VÉRIFIÉ DANS LE BINAIRE INSTALLÉ (0.144.6, 05/08/2026) :
  //    `permissionDecision` 5 occurrences, `permissionDecisionReason` 4,
  //    `"deny"` 4 — contrairement à `additionalContextLimit` (0 occurrence).
  //    Une clé documentée n'est pas forcément dans la version installée : on
  //    mesure, on ne suppose pas.
  if (decision === 'deny') {
    // ⚠️ SORTIE PARTAGÉE avec Claude Code (porte-core.sortieDeny) : les deux
    //    harnais parlent ici le même dialecte au mot près. Depuis le retrait
    //    d'`ask` (05/08/2026), c'est le SEUL écart de comportement possible —
    //    tout le reste est une injection nue, identique des deux côtés.
    console.log(JSON.stringify(sortieDeny(fullDoc)));
    process.exit(0);
  }
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: fullDoc,
    },
  };
  if (systemMessage) out.systemMessage = systemMessage;
  console.log(JSON.stringify(out));
  process.exit(0);
}

readStdinJson(
  (data) => run(data, emit, { budget: lib.budgetDeclare(process.argv) }),
  () => process.exit(0)
);
