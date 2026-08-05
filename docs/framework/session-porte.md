---
rules: [{"pattern":"session-inject.js","scope":["ctxroute"]},{"pattern":"session-inject.test.js","scope":["ctxroute"]},{"pattern":"sources-session.test.js","scope":["ctxroute"]}]
mode: dumb
---
# session-inject.js / sources/session.js — porte SESSION (LIVE 17/07/2026)

⚠️ `session-inject.js` = porte SŒUR SessionStart : injecte TOUT docs/session/*.md à CHAQUE début de session (startup/resume/clear/compact) — le « CLAUDE.md géré par le framework ». NE JAMAIS la fusionner avec doc-inject.js (événements/contrats différents).
⚠️ AUCUNE CADENCE, AUCUNE dédup : la réinjection post-compaction est le BUT. Ne pas « optimiser » en ajoutant un once/smart ici.
⚠️ **TRANSPORT AJOUTÉ le 05/08/2026 (⑯/⑮) — elle n'en avait AUCUN** : elle sortait d'un bloc, sans sceau ni morcelage, et ça ne « marchait » que parce que `docs/session/` pesait ~1,2 Ko (dimensionnement statique). Elle traverse maintenant `emission-core.js`. Le seul état qu'elle touche est la FILE (transport, pas cadence) ⇒ **lock OBLIGATOIRE** autour d'elle ; lock indisponible = dégradation au frais seul, jamais un silence.
⚠️ **UNE SEULE TRAME ici (`nbPaquets: 1`), volontairement** : qu'un hook SessionStart déclaré N fois soit spawné N fois n'est PAS mesuré (la dédup par commande+args n'est prouvée que sur PreToolUse). On ne rétro-ingénierise pas — à une trame le morcelage livre quand même TOUT, plus lentement. Passer à N = un réglage APRÈS mesure.
⚠️ `sources/session.js` = PUR (muté Stryker 13/13), ordre ALPHA par id via localeCompare (un ternaire `<` = mutant équivalent garanti, retiré par construction). Frontmatter strippé via frontmatter.parse (source unique).
⚠️ FAIL-OPEN intégral (dossier absent inclus) ; vivacité couverte par doctor (probe 3 + check câblage session-inject) — ne pas retirer ces checks.
⚠️ `enabled: false` de ctxroute-config.json coupe AUSSI cette porte (interrupteur global unique).
