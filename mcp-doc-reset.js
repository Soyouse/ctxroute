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
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const stateDir = path.join(__dirname, 'state');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;
    const safe = String(sessionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
    const storeFile = path.join(stateDir, `mcp-doc-seen-${safe || 'unknown'}.json`);
    fs.rmSync(storeFile, { force: true });
  } catch {
    /* fail-open */
  }
  process.exit(0);
});
