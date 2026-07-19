#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// MIGRATION protected-paths.json → frontmatter dans les .md
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ MÉCANIQUE, JAMAIS À LA MAIN. 531 règles : une migration manuelle
//    perdrait des règles en silence, et personne ne relit 531 lignes.
//
// ⚠️ DRY-RUN PAR DÉFAUT. `--write` pour appliquer. Un script qui écrit par
//    défaut est un script qu'on lance une fois de trop.
//
// ⚠️ IDEMPOTENT : rejouer converge, ne duplique jamais un frontmatter existant.
//    Condition pour qu'une reprise après crash à mi-course ne fasse pas de dégât.
//
// ⚠️ `rank` DÉRIVÉ DE L'INDEX JSON — c'est LE point délicat du refactor.
//    L'ordre d'injection (parent → enfant) vit aujourd'hui dans l'ORDRE DES LIGNES
//    de protected-paths.json. Des fichiers .md n'ont aucun ordre intrinsèque.
//    En figeant rank = position actuelle, le test différentiel passe PAR CONSTRUCTION.
//    Ne JAMAIS « renuméroter proprement » : ça réordonnerait des docs concaténées
//    et casserait le sens (doc globale AVANT doc spécifique) sans rien afficher.
//
// ⚠️ `confirm: true` PARTOUT — non négociable. Aujourd'hui, protect-files.js
//    demande confirmation sur écriture DÈS QU'une doc matche. Omettre confirm,
//    c'est supprimer en silence des centaines de confirmations sur des fichiers
//    critiques (VPS, prod). La migration préserve le comportement, elle ne le juge pas.
//    Le tri « qui mérite vraiment un ask » est un chantier SÉPARÉ, humain, plus tard.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parse } = require('./frontmatter');
// ⚠️ TOUTE la décision vit dans `migrate.js` (PUR, muté par Stryker, property-based).
//    Ce fichier n'est QUE la coquille I/O. NE JAMAIS y remettre de logique :
//    elle redeviendrait invisible à Stryker et intestable unitairement.
const noyau = require('./migrate');

const HOOKS_DIR = path.join(os.homedir(), '.claude', 'hooks');
const RULES_PATH = path.join(HOOKS_DIR, 'protected-paths.json');
const WRITE = process.argv.includes('--write');

function main() {
  const { rules } = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));

  // ⚠️ Le PLAN est calculé par le noyau PUR, sans aucune I/O : il reçoit un état
  //    (« ce doc existe ? a-t-il déjà un frontmatter ? ») et rend des actions.
  //    C'est ce qui rend la migration testable (round-trip + convergence) AVANT
  //    de toucher 288 docs réelles.
  const etat = {
    existe: (doc) => fs.existsSync(path.join(HOOKS_DIR, doc)),
    aDejaFrontmatter: (doc) => parse(fs.readFileSync(path.join(HOOKS_DIR, doc), 'utf8')).hasFrontmatter,
  };
  const plan = noyau.planifier(rules, etat);

  // Application : seule partie qui écrit. Idempotence garantie par le plan.
  if (WRITE) {
    for (const a of plan.actions) {
      const abs = path.join(HOOKS_DIR, a.doc);
      fs.writeFileSync(abs, a.frontmatter + fs.readFileSync(abs, 'utf8'));
    }
  }

  const multi = plan.actions.length ? rules.length - new Set(rules.map((r) => r.doc)).size : 0;
  console.log(WRITE ? '=== ÉCRIT ===' : '=== DRY-RUN (--write pour appliquer) ===');
  console.log(`  règles        : ${rules.length}`);
  console.log(`  docs uniques  : ${new Set(rules.map((r) => r.doc)).size}`);
  console.log(`  à migrer      : ${plan.actions.length}`);
  console.log(`  déjà migrées  : ${plan.deja.length}`);
  console.log(`  patterns en trop (docs multi-règles) : ${multi}`);
  console.log(`  ⚠️ RÈGLES MORTES : ${plan.morts.length}${plan.morts.length ? ' → ' + plan.morts.join(', ') : ''}`);
}

main();
