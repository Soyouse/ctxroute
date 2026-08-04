---
rules: [{"pattern":"lib-pure.property.test.js","scope":["ctxroute"],"rank":358},{"pattern":"lib-pure.js","scope":["ctxroute"],"rank":363},{"pattern":"lib-pure.test.js","scope":["ctxroute"],"rank":364}]
mode: dumb
confirm: true
rank: 358
---
# lib-pure.js — invariants

⚠️ NE JAMAIS importer fs/path/child_process/process.env ici — c'est TOUT l'intérêt du fichier (mutable par Stryker sans bruit I/O). Un import cassé ça = `.dependency-cruiser.json` (règle `lib-pure-must-stay-pure`) doit le bloquer en CI.
Toute fonction ajoutée ici DOIT être pure (mêmes entrées ⇒ mêmes sorties, zéro effet de bord) et testée directement dans `lib-pure.test.js` (pas via spawn).
Avant de "protéger" un cas avec une garde `if`, vérifier qu'elle n'est pas déjà couverte par la coercion JS native (regex `.exec()` coerce déjà les falsy) — une garde redondante = mutant Stryker équivalent, à éviter par construction plutôt qu'accepté. Écrire la forme TESTABLE : `Math.max(1, v)` et non `v >= 1 ? v : 1` (à v = 1 les branches coïncident ⇒ comparateur intuable) — cf `parsePaquetArgs`.
`docCandidatePaths()` retourne des CANDIDATS (chemins calculés), jamais une lecture disque — le caller I/O (`legacy-mcp-inject.js`) filtre ceux qui existent vraiment.
⚠️ Stryker ne lance QUE les suites DÉTERMINISTES (`lib-pure.test.js`, `sources-file.test.js`, `frontmatter.test.js`, `migrate.test.js`) — JAMAIS les property-tests : un invariant couvert SEULEMENT par `lib-pure.property.test.js` laisse survivre ses mutants. Toute garde ajoutée ici → cas déterministe dans `lib-pure.test.js` AUSSI (le property test cherche l'inconnu, le cas verrouille le connu). Nouveau module pur ⇒ l'ajouter à `mutate` ET à l'`include` de `vitest.stryker.config.mjs` (cf `quality-configs.md`).
⚠️ `scopeId(sessionId, agentId)` = SOURCE UNIQUE de la clé d'état par agent (doctrine agent=contexte) — ne JAMAIS composer `session_id + agent_id` ailleurs ; sans agentId la clé DOIT rester octet-identique à sanitizeSessionId (rétro-compat/Codex, scellé lib-pure.test).
⚠️ `serverName()` : classe de caractères RESTRICTIVE ([a-zA-Z0-9-]) — NE JAMAIS revenir à `[^_]` (matche `/` et `.` → `mcp__../../etc__x` sortait de docs/mcp/ ; trou trouvé par property-based, invisible à la relecture).
⚠️ SÉCURITÉ : tout segment venant de `tool_input` (`subTool`) ou de `tool_name` (`suffix`) DOIT passer `isSafePathSegment()` AVANT de composer un chemin — sinon `../../..` sort de `docs/mcp/` et injecte un `.md` arbitraire dans le contexte de l'agent comme consigne faisant autorité (injection de prompt, pas simple lecture). Filtrer DANS lib-pure (à la source), jamais côté I/O.
