---
match: stdin-json.js
mode: dumb
rank: 369
---
# stdin-json.js — invariants

Utilitaire I/O générique — NE DOIT dépendre de RIEN d'autre du repo (règle `stdin-json-stays-standalone` dans `.dependency-cruiser.json`), pour rester copiable tel quel dans un autre projet.
Extrait après détection de DUPLICATION réelle par `jscpd` (le même boilerplate stdin était copié dans `legacy-mcp-inject.js` ET `ctxroute-reset.js`) — si tu dupliques ce pattern ailleurs dans le repo, jscpd le détectera en CI (`check:coupling`).
`onError` est appelé sur JSON invalide — chaque hook appelant décide de son propre comportement de repli (typiquement `process.exit(0)`, jamais un throw non catché).
