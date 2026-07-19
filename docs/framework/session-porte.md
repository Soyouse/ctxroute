---
rules: [{"pattern":"session-inject.js","scope":["mcp-doc-hooks"]},{"pattern":"session-inject.test.js","scope":["mcp-doc-hooks"]},{"pattern":"sources-session.test.js","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
---
# session-inject.js / sources/session.js — porte SESSION (LIVE 17/07/2026)

⚠️ `session-inject.js` = porte SŒUR SessionStart : injecte TOUT docs/session/*.md à CHAQUE début de session (startup/resume/clear/compact) — le « CLAUDE.md géré par le framework ». NE JAMAIS la fusionner avec doc-inject.js (événements/contrats différents).
⚠️ AUCUN état, AUCUN lock, AUCUNE dédup : la réinjection post-compaction est le BUT. Ne pas « optimiser » en ajoutant un once/smart ici.
⚠️ `sources/session.js` = PUR (muté Stryker 13/13), ordre ALPHA par id via localeCompare (un ternaire `<` = mutant équivalent garanti, retiré par construction). Frontmatter strippé via frontmatter.parse (source unique).
⚠️ FAIL-OPEN intégral (dossier absent inclus) ; vivacité couverte par doctor (probe 3 + check câblage session-inject) — ne pas retirer ces checks.
⚠️ `enabled: false` de mcp-doc-config.json coupe AUSSI cette porte (interrupteur global unique).
