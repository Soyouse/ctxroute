#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// PORTE « TOUR » — hook UserPromptSubmit : incrémente le compteur de TOURS.
// ═══════════════════════════════════════════════════════════════════════
//
// RAISON D'ÊTRE (driftUnit, 18/07/2026) : le compteur `smart` historique compte
// les appels d'OUTILS (PreToolUse). Une doc/skill à `driftUnit: turn` mesure son
// écoulement en TOURS de conversation — or PreToolUse ne voit pas les tours.
// Cette porte est LE capteur manquant : UserPromptSubmit se déclenche UNE fois
// par tour (contrat Claude Code vérifié doc officielle 18/07/2026), elle
// incrémente un compteur par session que gate.decide compare (turnCount -
// entry.turn >= threshold).
//
// ⚠️ MUETTE PAR CONTRAT : sur UserPromptSubmit, tout stdout devient du CONTEXTE
//    injecté à côté du prompt. Cette porte n'émet JAMAIS rien — un console.log
//    ici polluerait chaque tour de chaque agent. Compter, se taire, sortir.
// ⚠️ MÊME mécanisme de store que la porte (session-store.js, préfixe DISTINCT
//    'turn-count-') — jamais un 2ᵉ système d'état. Reset par ctxroute-reset.js
//    (PreCompact) comme les deux autres stores.
// ⚠️ FAIL-OPEN intégral : state illisible = repartir de 0, inécrivable = tant
//    pis pour ce tour (pire cas = une réinjection retardée, jamais un blocage).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ Échéance AVANT toute I/O (bug #68626 : 875 zombies le 15/07/2026).
require('./deadline').arm();

const path = require('path');
const fs = require('fs');
const lib = require('./lib-pure');
const store = require('./session-store');
const { withLock } = require('./lock');
const { readStdinJson } = require('./stdin-json');
const paths = require('./paths');

const STORE_PREFIX = 'turn-count-';

readStdinJson(
  (data) => {
    try {
      let config = {};
      try {
        config = JSON.parse(fs.readFileSync(paths.configPath(), 'utf8'));
      } catch { /* config absente = défauts (framework actif) */ }
      // enabled:false coupe TOUT le framework, compteur de tours inclus.
      if (!lib.isFrameworkEnabled(config)) process.exit(0);

      // ⚠️ SCOPE PAR AGENT — même clé composite que la porte (lib.scopeId,
      // SOURCE UNIQUE) : un compteur de tours partagé maître/sous-agents
      // fausserait le driftUnit 'turn' des sous-agents. Sans agent_id = clé
      // historique inchangée.
      const sessionId = lib.scopeId(data.session_id, data.agent_id);
      const lockDir = path.join(paths.stateDir(), `.lock-turn-${lib.sanitizeSessionId(sessionId)}`);
      withLock(lockDir, () => {
        const s = store.loadState(STORE_PREFIX, sessionId);
        const turns = Number.isInteger(s.turns) ? s.turns : 0;
        store.saveState(STORE_PREFIX, sessionId, { turns: turns + 1 });
      }, { fallback: null }); // lock indisponible = tour non compté (fail-open)
    } catch {
      /* fail-open */
    }
    process.exit(0);
  },
  () => process.exit(0)
);
