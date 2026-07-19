#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// VENDORISE deadline.js dans ~/.claude/hooks/ + arme les hooks du parc
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ DRY-RUN PAR DÉFAUT (`--write` pour appliquer). Un script qui écrit par
//    défaut est un script qu'on lance une fois de trop. Ces fichiers sont EN
//    PRODUCTION : d'autres agents s'en servent à chaque appel d'outil.
//
// ⚠️ IDEMPOTENT : rejouer converge, ne double jamais un `arm()` déjà posé.
//    Condition pour reprendre après un crash à mi-course sans dégât.
//
// ⚠️ COPIE, PAS require() VERS CE REPO : les hooks perso ne doivent PAS dépendre
//    d'un chemin absolu vers un repo public (il bouge, ils meurent). `deadline.js`
//    est autonome EXPRÈS pour être copiable. La dérive des 2 copies est tuée par
//    `deadline-vendor.test.js` — sans ce drift-test, ce script crée de la dette.
//
// ⚠️ INSERTION AVANT LA 1ʳᵉ LIGNE EXÉCUTABLE (après shebang/commentaires/'use strict').
//    Règle universelle : l'échéance est armée avant TOUTE I/O, `require` ou pas.
//    ⚠️ La 1ʳᵉ version cherchait « après le dernier require de tête » et a RATÉ
//    `browser-recover.js` (aucun require : il lit process.stdin directement) —
//    6 hooks armés sur 7, attrapé par vendor-deadline.test.js sur COPIE, jamais
//    en prod. Un `arm()` placé dans un callback ne protège RIEN : le zombie attend
//    AVANT le callback, c'est tout le sujet.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SRC = path.join(__dirname, 'deadline.js');
const PARC = process.env.VENDOR_TARGET_DIR || path.join(os.homedir(), '.claude', 'hooks');
const WRITE = process.argv.includes('--write');

const BANNIERE = [
  '',
  '// ⚠️ ÉCHÉANCE — ne JAMAIS retirer, ne JAMAIS déplacer plus bas.',
  "//    Claude Code (Windows) ne ferme pas toujours le stdin du hook qu'il spawne",
  "//    (bug Anthropic anthropics/claude-code#68626) : sans ça, ce process attend un",
  "//    `end` qui n'arrive JAMAIS et vit POUR TOUJOURS. Mesuré le 15/07/2026 :",
  '//    875 zombies `statusline.js`, un de 20 h, 0,8 Go de RAM libre sur 16.',
  "//    `.unref()` garantit ZÉRO latence ajoutée quand tout va bien.",
  '//    Gate : mcp-doc-hooks/hooks-parc-gate.test.js — copie : deadline-vendor.test.js.',
  "const deadline = require('./deadline');",
  'deadline.arm();',
  '',
].join('\n');

function estUnHook(src) {
  return /process\.stdin/.test(src) || /require\(['"]\.\/stdin-json['"]\)/.test(src);
}

function dejaArme(src) {
  return /require\(['"]\.\/deadline['"]\)/.test(src) && /\barm\s*\(/.test(src);
}

// Index de la 1ʳᵉ ligne EXÉCUTABLE : on saute shebang, commentaires (// et /* */),
// lignes vides et 'use strict' (qui DOIT rester en tête de son scope).
// ⚠️ Retourne -1 si le fichier n'a aucun code exécutable : on NE PATCHE PAS à
//    l'aveugle. Un fichier inattendu est SIGNALÉ à un humain, jamais deviné.
function pointInsertion(lignes) {
  let dansBloc = false;
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i].trim();
    if (dansBloc) {
      if (l.includes('*/')) dansBloc = false;
      continue;
    }
    if (l === '') continue;
    if (i === 0 && l.startsWith('#!')) continue;
    if (l.startsWith('//')) continue;
    if (l.startsWith('/*')) {
      if (!l.includes('*/')) dansBloc = true;
      continue;
    }
    // ⚠️ 'use strict' doit précéder tout code — on s'insère APRÈS, jamais avant.
    if (/^['"]use strict['"];?$/.test(l)) continue;
    return i;
  }
  return -1;
}

function main() {
  if (!fs.existsSync(PARC)) {
    console.error(`cible introuvable : ${PARC}`);
    process.exit(1);
  }

  const rapport = { copie: false, armes: [], deja: [], manuels: [], ignores: 0 };

  // 1. Vendoriser deadline.js (copie octet pour octet).
  const dest = path.join(PARC, 'deadline.js');
  const srcContent = fs.readFileSync(SRC, 'utf8');
  const identique = fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === srcContent;
  if (!identique) {
    if (WRITE) fs.writeFileSync(dest, srcContent);
    rapport.copie = true;
  }

  // 2. Armer chaque hook.
  for (const f of fs.readdirSync(PARC)) {
    if (!f.endsWith('.js') || f.endsWith('.test.js') || f === 'deadline.js') continue;
    const abs = path.join(PARC, f);
    const src = fs.readFileSync(abs, 'utf8');

    if (!estUnHook(src)) {
      rapport.ignores++;
      continue;
    }
    if (dejaArme(src)) {
      rapport.deja.push(f);
      continue;
    }

    const eol = src.includes('\r\n') ? '\r\n' : '\n';
    const lignes = src.split(/\r?\n/);
    const idx = pointInsertion(lignes);
    if (idx === -1) {
      // ⚠️ JAMAIS de patch deviné : on signale, un humain tranche.
      rapport.manuels.push(f);
      continue;
    }

    // ⚠️ INSERTION *AVANT* la ligne idx, JAMAIS après (`idx + 1`) : une instruction
    //    peut s'étendre sur plusieurs lignes (`const LOCK_RE = new RegExp(` dans
    //    browser-recover.js) — insérer après sa 1ʳᵉ ligne la coupe EN DEUX et casse
    //    la syntaxe. Vécu le 15/07/2026, attrapé par le `node --check` de
    //    vendor-deadline.test.js sur COPIE. ⚠️ Le test « le process meurt » était VERT
    //    sur ce fichier cassé : un process qui CRASHE meurt aussi. La mort ne prouve
    //    jamais que ça marche — garder les deux tests, jamais l'un sans l'autre.
    lignes.splice(idx, 0, BANNIERE.replace(/\n/g, eol));
    if (WRITE) fs.writeFileSync(abs, lignes.join(eol));
    rapport.armes.push(f);
  }

  console.log(WRITE ? '=== ÉCRIT ===' : '=== DRY-RUN (--write pour appliquer) ===');
  console.log(`cible          : ${PARC}`);
  console.log(`deadline.js    : ${rapport.copie ? 'à copier' : 'déjà identique'}`);
  console.log(`à armer        : ${rapport.armes.length}${rapport.armes.length ? ' → ' + rapport.armes.join(', ') : ''}`);
  console.log(`déjà armés     : ${rapport.deja.length}${rapport.deja.length ? ' → ' + rapport.deja.join(', ') : ''}`);
  console.log(`non-hooks      : ${rapport.ignores} (ne lisent pas stdin)`);
  console.log(`⚠️ MANUELS     : ${rapport.manuels.length}${rapport.manuels.length ? ' → ' + rapport.manuels.join(', ') : ''}`);
}

main();
