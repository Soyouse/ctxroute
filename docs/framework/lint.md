---
rules: [{"pattern":"lint-corpus","exclude":["node_modules"]},{"pattern":"lint.js","scope":["mcp-doc-hooks"],"exclude":["node_modules"]},{"pattern":"lint.test.js","scope":["mcp-doc-hooks"],"exclude":["node_modules"]}]
mode: dumb
confirm: true
rank: 556
---
# lint.js / lint-corpus.js — audit du PARC (le framework s'audite lui-même)

⚠️ `doctor.js` surveille le MOTEUR (« j'injecte encore ? »), ce lint surveille le PARC (307 docs, 556 règles, 16 MCP). Rôles DISJOINTS, jamais fusionnés.
⚠️ `lint.js` = PUR (gate `lint-must-stay-pure`), `lint-corpus.js` = SEUL point d'I/O. La NORMALISATION vit dans la coquille : le noyau ignore si un déclencheur vient de `protected-paths.json` (aujourd'hui) ou du frontmatter (demain). NE JAMAIS y remonter la notion « visée par une règle » — ce serait rapatrier le transitoire dans le permanent.
⚠️ `validate()` (frontmatter.js) est la SEULE autorité sur « déclaration saine ? ». Le lint DÉLÈGUE, ne re-juge JAMAIS : 2 codes pour 1 jugement = divergence garantie.
⚠️ **SONDE DE VIVACITÉ, exit 2** si 0 règle chargée — « je n'ai pas pu mesurer » ≠ « c'est sain ». Un harnais creux annonce triomphalement 0 problème (erreur commise 2× le 15/07/2026). NE JAMAIS la retirer ni la ramener à exit 0/1.
⚠️ DIAGNOSTIC, PAS HOOK : il HURLE (exit≠0) sur ERREUR. Jamais fail-open comme un hook (rôles opposés, cf doctor.md). `--quiet` ne réduit QUE le succès.
⚠️ NE JAMAIS supprimer un cas de `lint-corpus.test.js` : le sabotage (faux parc en tmpdir via `MCP_DOC_HOOKS_DIR`/`MCP_DOC_HOME`) est la SEULE preuve que le lint mord. Vert sur parc sain ne prouve RIEN. Sabotage vérifié 15/07 : 18/3/2 tests rouges.
⚠️ Le test ne touche JAMAIS le vrai `~/.claude/hooks` (parc vivant servant d'autres agents) — faux parc jetable OBLIGATOIRE.
`mcp-sans-doc` = WARN, jamais error (arbitré : « pas encore fait » ≠ oubli). Un lint rouge en permanence est ignoré, donc inutile — la leçon exacte du rush mode.
