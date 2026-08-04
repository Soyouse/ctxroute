#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Lecture stdin → JSON, format Claude Code hooks. Boilerplate partagé par
// TOUS les hooks (legacy-mcp-inject.js, ctxroute-reset.js) — extrait ici après
// détection de duplication par jscpd (couplage implicite : même code copié
// dans 2 fichiers = même contrat modifié à 2 endroits si le format change).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// Lit stdin en entier, parse en JSON, appelle onData(parsed). Si le JSON est
// invalide, appelle onError() (fail-open : chaque hook décide de son propre
// comportement d'erreur, typiquement process.exit(0)).
function readStdinJson(onData, onError) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (input += c));
  process.stdin.on('end', () => {
    try {
      onData(JSON.parse(input));
    } catch (e) {
      if (onError) onError(e);
    }
  });
}

module.exports = { readStdinJson };
