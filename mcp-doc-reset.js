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

const stateDir = path.join(__dirname, 'state');

readStdinJson(
  (data) => {
    try {
      const storeFile = path.join(stateDir, `mcp-doc-seen-${lib.sanitizeSessionId(data.session_id)}.json`);
      fs.rmSync(storeFile, { force: true });
    } catch {
      /* fail-open */
    }
    process.exit(0);
  },
  () => process.exit(0) // JSON invalide → fail-open, pas de reset, jamais de blocage
);
