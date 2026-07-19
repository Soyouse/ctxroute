// ═══════════════════════════════════════════════════════════════════════
// CORPUS — lecture récursive des docs fichier (.md). I/O PARTAGÉE.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ PARTAGÉ par shadow-inject.js (CÂBLÉ EN PROD) et doc-inject.js (la porte).
//    Extrait le 16/07/2026 pour qu'il n'existe qu'UNE lecture du corpus —
//    deux copies de readCorpus divergeraient en silence (gate jscpd).
//    Toute modif ici = re-prouver par shadow-inject.test.js ET doc-inject.test.js.
//
// ⚠️ AUCUN try/catch ICI : le fail-open appartient à l'APPELANT (le shadow
//    avale tout, la porte aussi) — l'avaler ici masquerait l'erreur aux tests.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Lit récursivement tous les .md sous `dir`.
 * @param {string} dir - dossier racine (ex: paths.fileDocsDir())
 * @param {string} prefix - préfixe des ids de doc (ex: 'docs/' → ids 'docs/x.md',
 *   IDENTIQUES aux `doc` de protected-paths.json — condition de l'oracle/reconcile).
 * @returns {Array<{doc: string, text: string}>}
 */
function readCorpus(dir, prefix) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + e.name;
    if (e.isDirectory()) out.push(...readCorpus(path.join(dir, e.name), rel + '/'));
    else if (e.name.endsWith('.md')) out.push({ doc: rel, text: fs.readFileSync(path.join(dir, e.name), 'utf8') });
  }
  return out;
}

module.exports = { readCorpus };
