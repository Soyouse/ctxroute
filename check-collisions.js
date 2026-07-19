#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// CHECK-COLLISIONS — coquille I/O de l'analyse des croisements du parc.
// ═══════════════════════════════════════════════════════════════════════
//
// Usage : node check-collisions.js [--json]
//
// ⚠️ SOURCE = FRONTMATTERS du parc via loader (la vérité pérenne) — plus
//    jamais protected-paths.json (transitoire, réservé au moteur Codex).
// ⚠️ INFORMATIF : exit 0 TOUJOURS (le verdict revient à un agent, cf collisions.js).
//    Ne JAMAIS le câbler en hook/gate — outil on-demand de ménage du parc.
// ⚠️ ZÉRO logique ici : lecture corpus → loader → findCollisions → affichage.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { readCorpus } = require('./corpus');
const { rulesFromCorpus } = require('./loader');
const { findCollisions } = require('./collisions');
const paths = require('./paths');

const JSON_OUTPUT = process.argv.includes('--json');

const rules = rulesFromCorpus(readCorpus(paths.fileDocsDir(), 'docs/'));
const collisions = findCollisions(rules);

if (JSON_OUTPUT) {
  console.log(JSON.stringify({ total_rules: rules.length, collisions }, null, 2));
  process.exit(0);
}

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
console.log(`${C.bold}Détection croisements documentation${C.reset}`);
console.log(`${C.dim}Source : frontmatters de ${paths.fileDocsDir()} (${rules.length} règles)${C.reset}\n`);

if (collisions.length === 0) {
  console.log(`${C.green}Aucun croisement détecté.${C.reset}`);
  process.exit(0);
}

const labels = {
  probable_parent_child: `${C.green}✓ Probable parent/enfant${C.reset} (souvent légitime)`,
  ambiguous: `${C.yellow}❓ Ambigu${C.reset} (à inspecter)`,
  potential_duplicate: `${C.red}⚠ Doublon potentiel${C.reset} (à investiguer)`,
};
for (const cat of ['probable_parent_child', 'ambiguous', 'potential_duplicate']) {
  const group = collisions.filter((c) => c.classification === cat);
  if (group.length === 0) continue;
  console.log(`${C.bold}${labels[cat]}${C.reset}  —  ${group.length} cas\n`);
  group.forEach((c, i) => {
    console.log(`  [${i + 1}] ${C.bold}${c.pattern_a}${C.reset}  ↔  ${C.bold}${c.pattern_b}${C.reset}`);
    console.log(`      ${C.dim}A : ${c.doc_a}${c.scope_a ? ` (scope: ${JSON.stringify(c.scope_a)})` : ''}${C.reset}`);
    console.log(`      ${C.dim}B : ${c.doc_b}${c.scope_b ? ` (scope: ${JSON.stringify(c.scope_b)})` : ''}${C.reset}`);
    console.log(`      ${C.dim}${c.hint}${C.reset}\n`);
  });
}
console.log(`${C.dim}Total : ${collisions.length} croisements. Verdict final = AGENT (0-human) — le script trie, un LLM tranche, jamais un humain.${C.reset}`);
