// ═══════════════════════════════════════════════════════════════════════
// CŒUR DE GARDE D'ÉCRITURE — corps COMMUN PostToolUse (source unique).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ EXTRAIT de doc-write-guard.js le 19/07/2026 (portage Codex) : classer le
//    fichier écrit (quel corpus du parc ?) + le valider est IDENTIQUE sur tous
//    les harnais. SEULE l'extraction des chemins depuis tool_input varie
//    (Claude : file_path direct · Codex : chemins DANS le patch apply_patch) —
//    elle reste dans les coquilles.
//
// ⚠️ La VALIDATION est DÉLÉGUÉE à frontmatter.js (validate / validateMcp) —
//    seule autorité, jamais re-jugée ici (2 codes pour 1 jugement = dérive).
//    Docs session : rien à valider par construction (tout .md s'injecte).
//
// ⚠️ Sortie `decision: "block"` + reason = dialecte COMMUN MESURÉ (Claude Code
//    + Codex CLI ≥ 0.144, doc officielle re-lue le 19/07/2026) — si un futur
//    harnais diverge, son emit deviendra un paramètre, jamais un if ici.
//
// ⚠️ FAIL-OPEN intégral : fichier illisible/supprimé/hors-parc → silence.
//    Un hook ne bloque JAMAIS le travail pour sa propre panne.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const { parse, validate, validateMcp } = require('./frontmatter');
const paths = require('./paths');

const norm = (s) => String(s).replace(/\\/g, '/').toLowerCase();

// Classe le fichier écrit : quel corpus du parc ? (null = pas une doc gérée)
function docKind(filePath) {
  const p = norm(filePath);
  if (!p.endsWith('.md')) return null;
  if (p.startsWith(norm(paths.docsDir()) + '/')) return 'mcp';
  if (p.startsWith(norm(paths.sessionDocsDir()) + '/')) return 'session';
  if (p.startsWith(norm(paths.fileDocsDir()) + '/')) return 'file';
  return null;
}

// Valide chaque chemin candidat ; au PREMIER cassé, émet le block et exit.
// Aucune doc du parc touchée / tout est sain → exit 0 muet.
function run(filePaths) {
  try {
    for (const filePath of filePaths) {
      const kind = docKind(filePath);
      if (kind === null || kind === 'session') continue;

      let errs;
      try {
        const { data: fm } = parse(fs.readFileSync(filePath, 'utf8'));
        errs = kind === 'mcp' ? validateMcp(fm) : validate(fm);
      } catch {
        continue; // fichier illisible/supprimé = fail-open sur CE chemin
      }
      if (errs.length === 0) continue;

      console.log(JSON.stringify({
        decision: 'block',
        reason: '[ctxroute] La doc que tu viens d\'écrire est INVALIDE — elle serait morte/faussée en silence. Corrige MAINTENANT :\n- '
          + errs.join('\n- ') + '\nFichier : ' + filePath,
      }));
      // ⚠️ Le cœur RETOURNE, il ne tue pas : la sortie appartient à la
      //    COQUILLE (06/08/2026). `return` et non `break` — un blocage émis,
      //    on n'examine PAS les fichiers suivants (une seule sortie par hook).
      return;
    }
  } catch {
    /* fail-open */
  }
  // ⚠️ NE PAS remettre `process.exit(0)` ici : le cycle de vie du processus
  //    est une décision de COQUILLE, jamais d'un cœur partagé (scellé par
  //    `emission-core-gate.test.js`). Ce cœur avait le même défaut que
  //    porte-core — trouvé par le gate DÉRIVÉ, pas à l'œil.
}

module.exports = { run, docKind };
