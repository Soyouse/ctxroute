---
rules: [{"pattern":"lint-corpus","exclude":["node_modules"]},{"pattern":"lint.js","scope":["ctxroute"],"exclude":["node_modules"]},{"pattern":"lint.test.js","scope":["ctxroute"],"exclude":["node_modules"]}]
mode: dumb
rank: 556
---
# lint.js / lint-corpus.js — audit du PARC (le framework s'audite lui-même)

⚠️ `doctor.js` surveille le MOTEUR (« j'injecte encore ? »), ce lint surveille le PARC (307 docs, 556 règles, 16 MCP). Rôles DISJOINTS, jamais fusionnés.
⚠️ `lint.js` = PUR (gate `lint-must-stay-pure`), `lint-corpus.js` = SEUL point d'I/O. La NORMALISATION vit dans la coquille ; le noyau ignore d'où vient un déclencheur. NE JAMAIS y remonter la notion « visée par une règle ».
⚠️ **SOURCE DE RÈGLES = LES FRONTMATTERS, POINT (27/07/2026)** : `lint-corpus.js` lit `rulesFromCorpus(readCorpus(DOCS))`. Il lisait `protected-paths.json` — le laisser aurait RESSUSCITÉ la double écriture par la bande (le lint réclamant une entrée JSON pour chaque nouvelle doc). **NE JAMAIS y rebrancher une source de règles EXTERNE** : ça réintroduit la classe « règle fantôme » (règle visant un .md supprimé), aujourd'hui ÉTEINTE PAR CONSTRUCTION — un déclencheur vit DANS sa doc. Scellé par `lint-corpus.test.js` cas 5, qui rougit si une source externe revient.
⚠️ Parc illisible (dossier absent) ⇒ corpus vide ⇒ la SONDE ci-dessous tranche (exit 2). JAMAIS de stack trace brute : un diagnostic hurle proprement.
⚠️ `validate()` (frontmatter.js) est la SEULE autorité sur « déclaration saine ? ». Le lint DÉLÈGUE, ne re-juge JAMAIS : 2 codes pour 1 jugement = divergence garantie.
⚠️ **SONDE DE VIVACITÉ, exit 2** si 0 règle chargée — « je n'ai pas pu mesurer » ≠ « c'est sain ». Un harnais creux annonce triomphalement 0 problème (erreur commise 2× le 15/07/2026). NE JAMAIS la retirer ni la ramener à exit 0/1.
⚠️ DIAGNOSTIC, PAS HOOK : il HURLE (exit≠0) sur ERREUR. Jamais fail-open comme un hook (rôles opposés, cf doctor.md). `--quiet` ne réduit QUE le succès.
⚠️ NE JAMAIS supprimer un cas de `lint-corpus.test.js` : le sabotage (faux parc en tmpdir via `CTXROUTE_HOOKS_DIR`/`CTXROUTE_HOME`) est la SEULE preuve que le lint mord. Vert sur parc sain ne prouve RIEN. Sabotage vérifié 15/07 : 18/3/2 tests rouges.
⚠️ Le test ne touche JAMAIS le vrai `~/.claude/hooks` (parc vivant servant d'autres agents) — faux parc jetable OBLIGATOIRE.
⚠️ **`tag-source-en-dur` = ERREUR (㉘ bis, 08/08/2026)** : une doc ne DOIT jamais porter une ligne `[source: …]` — le moteur l'ajoute à l'émission, donc c'est un copier-coller qui ① double le tag et ② fait passer le CANARI au vert (un agent qui LIT la doc dépose une étiquette valide dans le transcript). 🛑 **Motif ancré sur une LIGNE ENTIÈRE, ne jamais l'élargir** : mon 1er motif cherchait partout et a accusé `canari.md`, qui ne fait qu'EXPLIQUER le marqueur — une doc qui PARLE du mécanisme n'en porte pas. Mesuré : 4 fautives sur 393, 0 exemption.
`mcp-sans-doc` = WARN, jamais error (arbitré : « pas encore fait » ≠ oubli). Un lint rouge en permanence est ignoré, donc inutile — la leçon exacte du rush mode.
