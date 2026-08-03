---
match: [stryker.conf.json, .dependency-cruiser.json, .jscpd.json]
scope: [ctxroute]
mode: dumb
confirm: true
rank: 370
---
# stryker.conf.json / .dependency-cruiser.json / .jscpd.json — invariants

⚠️ `stryker.conf.json` mute TOUS les modules PURS : `lib-pure.js` + `sources/file.js` + `frontmatter.js` + `migrate.js` (leur pureté est garantie par les gates dependency-cruiser). JAMAIS les fichiers I/O — mutants équivalents garantis. Nouveau module pur ⇒ l'ajouter à `mutate` **ET** à l'`include` de `vitest.stryker.config.mjs` (SEULES suites lancées par Stryker — runner vitest perTest depuis 16/07/2026, commandRunner BANNI, gate anti-retour dans mutation-workflow-gate.test.js) ; un fichier muté sans sa suite = massacre trompeur (mutants « survivants » faute de test LANCÉ, pas manquant).
⚠️ Break 99, **cliquet JAMAIS baissé**. Ne pas le monter au score exact non plus : la marge est délibérée.
⚠️ `timeoutMS: 60000` = LA CAUSE RACINE du « score local ment » (corrigée 15/07/2026). Sans lui, défaut Stryker ~12s ⇒ machine chargée ⇒ un run normal expire ⇒ Stryker compte l'EXPIRÉ comme TUÉ ⇒ score GONFLÉ (mesuré : **100% local avec 411 timeouts et 0,17 test/mutant** = quasi rien n'était exécuté). Depuis le fix : **local 99,33% = CI 99,33%, 0 timeout des deux côtés**. NE JAMAIS le baisser pour « accélérer » : ça réintroduit le mensonge silencieux, et un score faux est pire que pas de score.
⚠️ Score local suspect (timeouts > 0, ou « X tests par mutant » < 1) ⇒ le run ne prouve RIEN, quel que soit le chiffre affiché. Lire ces 2 lignes AVANT le score.
La CI reste plus RAPIDE (4 min vs 12 min sur machine chargée) : la boucle normale est « pousse → lis la CI ». Le local est désormais VRAI, pas plus rapide.
⚠️ Property-tests EXCLUS du runner Stryker (lents, non déterministes) ⇒ toute garde prouvée par property DOIT avoir son cas déterministe dans `*.test.js`, sinon son mutant survit et le score ment.
⚠️ Un test ne DOIT JAMAIS dériver son attendu de la valeur qu'il vérifie : `for (const m of MODES)` mutait AVEC le code → mutant invisible. Valeurs de CONTRAT = écrites EN DUR dans le test.
⚠️ Garde REDONDANTE = mutant équivalent : l'éviter par CONSTRUCTION, jamais la tester. (Le check `#` du parser était déjà couvert par la regex `[A-Za-z0-9_-]+` → retiré, 3 mutants disparus et code plus simple.)
⚠️ Mutant vraiment équivalent (libellé de message) ⇒ `// Stryker disable StringLiteral` CIBLÉ + commentaire qui justifie. JAMAIS étendre un disable à la LOGIQUE ; jamais coupler un test à une chaîne interne de Stryker (casse à l'upgrade de l'outil).
⚠️ `"incremental": true` a servi un résultat PÉRIMÉ (15/07/2026) : score suspect ⇒ purger `reports/` + `.stryker-tmp/` AVANT de conclure. Le cache ment dans les DEUX sens.
`.dependency-cruiser.json` : nouveau `.js` ⇒ l'ajouter à `includeOnly`, sinon `check:deps` ne le voit pas (faux négatif silencieux). Pureté gatée : lib-pure, sources/, frontmatter, migrate · Autonomie gatée : deadline, stdin-json, paths.
`.jscpd.json` : seuil 1%. Duplication détectée ⇒ extraire un module partagé, JAMAIS monter le seuil.
