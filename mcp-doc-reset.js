#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Hook PreCompact — reset du store "vu" de mcp-doc-inject.js
// ═══════════════════════════════════════════════════════════════════════
//
// PROBLÈME RÉSOLU : mcp-doc-inject.js n'injecte qu'UNE fois par serveur MCP
// par session (state/mcp-doc-seen-<session_id>.json). Mais une COMPACTION
// vide le contexte du modèle SANS changer session_id → sans ce reset, la
// doc injectée avant compaction disparaît du contexte mais le store dit
// encore "déjà vu" → plus jamais réinjectée alors que l'agent l'a oubliée.
//
// FIX : PreCompact supprime le store de session → le prochain appel MCP,
// après compaction, réinjecte la doc comme si c'était un nouveau contexte.
// C'est le SIGNAL EXACT (pas un compteur d'appels arbitraire) : "une fois
// par contexte" = une fois par session, reset sur l'événement qui vide
// réellement le contexte.
//
// ⚠️ FAIL-OPEN : erreur de suppression = pas grave (pire cas = pas de
// réinjection après compaction, jamais un blocage). Jamais deny/ask ici.
// ⚠️ sanitizeSessionId vient de lib-pure.js — SOURCE UNIQUE partagée avec
// mcp-doc-inject.js (un format de nom de fichier dupliqué à 2 endroits
// diverge silencieusement si l'un des deux change sans l'autre).
// ⚠️ Lecture stdin factorisée dans stdin-json.js (détecté dupliqué par
// jscpd avec mcp-doc-inject.js avant extraction).
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const lib = require('./lib-pure');
const { readStdinJson } = require('./stdin-json');

// ⚠️ stateDir vient de paths.js — SOURCE UNIQUE partagée avec mcp-doc-inject.js.
// Il était hardcodé ici ET là-bas : deux copies d'une même vérité, qui divergent
// en silence dès que l'une bouge (les 2 hooks viseraient alors des dossiers
// différents — le reset ne resetterait plus rien, sans aucune erreur visible).
const paths = require('./paths');
const deadline = require('./deadline');

// ⚠️ ÉCHÉANCE ARMÉE AVANT TOUTE I/O — ne JAMAIS déplacer plus bas ni retirer.
//    Cf `deadline.js` : Claude Code (Windows) ne ferme pas toujours le stdin du
//    hook spawné (bug Anthropic #68626) → sans ça, le process vit POUR TOUJOURS.
//    Gate : `deadline-gate.test.js`. Preuve par spawn réel : `deadline.test.js`.
deadline.arm();

readStdinJson(
  (data) => {
    try {
      // ⚠️ TROIS stores à vider : 'doc-seen-' (porte unifiée, dédup par DOC)
      //    + 'mcp-doc-seen-' (legacy mcp-doc-inject.js, gardé le temps du
      //    rollback) + 'turn-count-' (compteur de tours, driftUnit 18/07/2026 —
      //    la compaction ouvre un nouveau contexte : les tours repartent de 0
      //    comme les compteurs d'outils). Oublier l'un = docs jamais
      //    réinjectées après compaction, en silence.
      // ⚠️ SCOPE PAR AGENT (19/07/2026) : les stores sont keyés par
      //    lib.scopeId(session_id, agent_id) — `<session>` (maître) et
      //    `<session>--agent-<id>` (sous-agents). Compaction DANS un sous-agent
      //    (agent_id présent) = purge ciblée de SON scope. Compaction maître =
      //    purge par PRÉFIXE session : le maître ET tous ses sous-agents
      //    (pire cas fail-open = une réinjection, jamais un état gelé).
      const scoped = lib.scopeId(data.session_id, data.agent_id);
      for (const prefix of ['doc-seen-', 'mcp-doc-seen-', 'turn-count-']) {
        if (data.agent_id) {
          fs.rmSync(path.join(paths.stateDir(), `${prefix}${scoped}.json`), { force: true });
        } else {
          for (const f of fs.readdirSync(paths.stateDir())) {
            if (f.startsWith(`${prefix}${scoped}`) && f.endsWith('.json')) {
              fs.rmSync(path.join(paths.stateDir(), f), { force: true });
            }
          }
        }
      }
    } catch {
      /* fail-open */
    }
    process.exit(0);
  },
  () => process.exit(0) // JSON invalide → fail-open, pas de reset, jamais de blocage
);
