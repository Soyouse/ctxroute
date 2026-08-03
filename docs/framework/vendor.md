---
match: [vendor-deadline.js, vendor-deadline.test.js, deadline-vendor.test.js, hooks-parc-gate.test.js]
scope: [ctxroute]
mode: dumb
confirm: true
rank: 541
---
# vendor-deadline.js + gates du parc — vendoring de l'échéance

⚠️ COPIE, JAMAIS `require()` vers ce repo : les hooks de `~/.claude/hooks/` ne DOIVENT pas dépendre d'un chemin absolu vers un repo PUBLIC (il bouge → ils meurent). `deadline.js` est autonome EXPRÈS pour être copiable. L'env perso n'est jamais otage du framework.
⚠️ La copie n'est acceptable QUE grâce au drift-test (`deadline-vendor.test.js`) : sans lui, corriger l'original ne corrigerait plus les 7 hooks et RIEN ne le dirait. Ne jamais le supprimer « parce qu'il gêne ».
⚠️ DRY-RUN par défaut, `--write` pour appliquer. Ces fichiers sont EN PROD : d'autres agents les exécutent à chaque appel d'outil. Idempotent : rejouer ne double jamais un `arm()`.
⚠️ INSERTION *AVANT* la 1ʳᵉ ligne exécutable, JAMAIS après (`idx+1`) : une instruction peut s'étendre sur plusieurs lignes (`const LOCK_RE = new RegExp(`) → insérer après sa 1ʳᵉ ligne la coupe en deux. Vécu le 15/07/2026.
⚠️ « Le process meurt » NE PROUVE PAS « ça marche » — un process qui CRASHE meurt aussi. Le test de mort était VERT sur un `browser-recover.js` cassé. GARDER les 3 : `node --check` (syntaxe) + les 9 suites du parc avant/après (régression) + le spawn (mort). Jamais l'un sans les autres.
⚠️ JAMAIS de patch deviné : aucun point d'insertion sûr ⇒ le script SIGNALE (`MANUELS`), un humain tranche. Le gate exige `MANUELS: 0` — un parc couvert à 86% laisse un zombie possible.
⚠️ Gates du parc SKIPPÉS sur clone vierge (repo public : il ne doit jamais exiger `~/.claude/hooks/`). Sauter n'est PAS échouer — ils hurlent chez le mainteneur, là où le parc existe.
`npm run test:parc` = gate parc + drift + preuve sur copie. Hors de `npm test` (spawns lents).
