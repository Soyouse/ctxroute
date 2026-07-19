---
rules: [{"pattern":"lock.js","scope":["mcp-doc-hooks"],"exclude":["package-lock.json"]},{"pattern":"lock.test.js","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
rank: 366
---
# lock.js — invariants

⚠️ BUG RÉEL DÉJÀ VÉCU (15/07/2026) : `fs.mkdirSync(lockDir)` SANS `{recursive:true}` sur le dossier PARENT échoue en `ENOENT` (pas `EEXIST`) sur un checkout frais où `state/` n'existe pas encore — invisible en local (dossier déjà créé par des runs précédents), cassait en CI. Le fix crée la chaîne de parents en amont (`recursive:true`, idempotent, sûr en concurrence) AVANT la tentative d'acquisition atomique.
NE JAMAIS supprimer `lock.test.js` "checkout frais" (dossier `TMP_ROOT` jamais créé avant test) — c'est le seul test qui aurait attrapé ce bug.
`withLock` est FAIL-OPEN sur timeout (`fallback`) — ne JAMAIS bloquer le hook indéfiniment pour une contention de lock.
`MCP_DOC_LOCK_TIMEOUT_MS` = env RÉSERVÉE AUX TESTS (19/07/2026, doctrine paths.js) : les tests de concurrence relèvent le timeout pour prouver l'ATOMICITÉ indépendamment de la charge (2 s expirent légitimement sous charge = fail-open voulu, pas un bug). JAMAIS un réglage utilisateur — prod = 2000 ms.
STALE_MS force un lock abandonné (process mort) — sans ça un crash en section critique bloquerait ce lock pour toujours.
