// ═══════════════════════════════════════════════════════════════════════
// SESSION-STORE — I/O du state par session (fichier JSON sous state/). PARTAGÉ.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Extrait le 16/07/2026 (gate jscpd) : legacy-mcp-inject.js (dédup par SERVEUR,
//    préfixe 'ctxroute-seen-') et doc-inject.js (dédup par DOC, 'doc-seen-')
//    portaient le MÊME trio storeFile/loadState/saveState — deux copies d'une
//    même vérité qui divergent en silence.
// ⚠️ FAIL-OPEN : state illisible = {} (repartir de zéro), state inécrivable =
//    silence (ne jamais casser l'injection pour un problème de disque).
// ⚠️ Préfixes DISTINCTS obligatoires : les deux hooks coexistent dans state/,
//    un préfixe partagé mélangerait serveurs et docs dans le même fichier.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizeSessionId } = require('./lib-pure');
const paths = require('./paths');

function storeFile(prefix, sessionId) {
  return path.join(paths.stateDir(), `${prefix}${sanitizeSessionId(sessionId)}.json`);
}

function loadState(prefix, sessionId) {
  try {
    return JSON.parse(fs.readFileSync(storeFile(prefix, sessionId), 'utf8'));
  } catch {
    return {};
  }
}

function saveState(prefix, sessionId, state) {
  try {
    fs.mkdirSync(paths.stateDir(), { recursive: true });
    fs.writeFileSync(storeFile(prefix, sessionId), JSON.stringify(state));
  } catch {
    /* fail-open : un store inécrivable ne casse jamais l'injection */
  }
}

module.exports = { storeFile, loadState, saveState };
