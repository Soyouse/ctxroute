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

// Valide chaque chemin candidat et REND UN VERDICT au PREMIER cassé.
// Rien de cassé (ou rien du parc touché) → rend `null`, la coquille se tait.
//
// ⚠️ LE CŒUR N'ÉCRIT NI SUR STDOUT NI SUR LE PROCESSUS (06/08/2026). Il
//    appelait `console.log` + `process.exit` : deux fuites de couche de la
//    MÊME famille que ⑯ — écrire la sortie et décider de mourir appartiennent
//    à la COQUILLE, seule à connaître le dialecte du harnais. Trouvé par le
//    scan de capacités (ast-grep), pas à l'œil : c'était la 3ᵉ instance.
// ⚠️ Le JSON `decision: block` reste un dialecte COMMUN mesuré aux 2 harnais :
//    il est composé ici (`sortieBlock`) mais ÉMIS par la coquille. Le jour où
//    un harnais diverge, il compose le sien — jamais un `if` de harnais ici.
function sortieBlock(errs, filePath) {
  return {
    decision: 'block',
    reason: '[ctxroute] La doc que tu viens d\'écrire est INVALIDE — elle serait morte/faussée en silence. Corrige MAINTENANT :\n- '
      + errs.join('\n- ') + '\nFichier : ' + filePath,
  };
}

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

      // ⚠️ On REND au premier cassé — `return` et non `break` : un seul verdict
      //    par hook, les chemins suivants ne sont pas examinés.
      return sortieBlock(errs, filePath);
    }
  } catch {
    /* fail-open */
  }
  // ⚠️ `null` = rien à signaler. NE PAS remettre `console.log` ni
  //    `process.exit(0)` ici : écrire la sortie et décider de mourir sont des
  //    décisions de COQUILLE, jamais d'un cœur partagé (scellé par
  //    `emission-core-gate.test.js`). Ce cœur avait le même défaut que
  //    porte-core — trouvé par le gate DÉRIVÉ, pas à l'œil.
}

module.exports = { run, docKind, sortieBlock };
