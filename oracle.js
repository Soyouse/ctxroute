// ═══════════════════════════════════════════════════════════════════════
// ORACLE — spawne le VRAI protect-files.js et extrait les docs injectées.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ PARTAGÉ par file-differential.test.js ET shadow-reconcile.js — extrait le
//    16/07/2026 pour qu'il n'existe qu'UNE lecture de la sortie de l'oracle.
//    Deux parseurs = deux façons de mentir (vécu 3× le 15/07/2026 : chaque
//    oracle bricolé a accusé le moteur à tort).
//
// ⚠️ PARSER LE FORMAT, JAMAIS BRICOLER DU TEXTE — les 2 pièges scellés ici :
//    1. des docs contiennent un `[source: ...]` EN DUR dans leur CONTENU (61
//       mesurées) → on ne lit que le DERNIER marqueur de chaque bloc ;
//    2. la sortie est du JSON (retours ligne échappés) → on parse le JSON
//       d'abord, on découpe les blocs `\n\n---\n\n` APRÈS.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { execFile } = require('child_process');

/**
 * @param {string} legacyPath - chemin de protect-files.js (le VRAI script prod)
 * @param {{toolName: string, toolInput: object}} payload
 * @returns {Promise<string[]>} docs injectées, DANS L'ORDRE réel d'injection
 */
function legacyDocs(legacyPath, payload) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [legacyPath], { encoding: 'utf8' }, (_err, stdout) => {
      let contexte = '';
      try {
        // Fail-open : pas de JSON = le hook n'a rien injecté (cas légitime).
        const j = JSON.parse(stdout || '{}');
        contexte = (j.hookSpecificOutput && j.hookSpecificOutput.additionalContext) || '';
      } catch (e) {
        contexte = '';
      }
      const docs = [];
      for (const bloc of contexte.split('\n\n---\n\n')) {
        const marqueurs = [...bloc.matchAll(/\[source: \.claude\/hooks\/([^\]]+)\]/g)];
        if (marqueurs.length) docs.push(marqueurs[marqueurs.length - 1][1]);
      }
      resolve(docs);
    });
    child.stdin.end(JSON.stringify({ tool_name: payload.toolName, tool_input: payload.toolInput }));
  });
}

module.exports = { legacyDocs };
