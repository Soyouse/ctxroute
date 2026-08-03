---
rules: [{"pattern":"mcp-doc-config.json","scope":["ctxroute"],"rank":359},{"pattern":"config-gate.test.js","scope":["ctxroute"],"rank":360},{"pattern":"mcp-doc-inject.test.js","scope":["ctxroute"],"rank":361},{"pattern":"mcp-doc-config.schema.json","rank":567}]
mode: dumb
confirm: true
rank: 359
---
# mcp-doc-config.json / config-gate.test.js — invariants

⚠️ BUG RÉEL (15/07/2026, présent depuis le 1er commit) : la config committée contenait des résidus de FIXTURE de test (`filterMode:"whitelist"`, `filterList:["testserver999"]`) → framework tournant mais n'injectant RIEN pour stripe/odoo, EN SILENCE, pendant des jours. Cause : les tests d'intégration écrivaient dans le VRAI fichier et "restauraient l'original" — lequel était déjà pollué.
NE JAMAIS faire écrire un test dans `mcp-doc-config.json` : les tests passent `MCP_DOC_CONFIG_PATH` (tmpdir jetable). Cette env var est RÉSERVÉE aux tests.
NE JAMAIS supprimer/assouplir `config-gate.test.js` — c'est le dead-man switch : tout serveur ayant un `docs/mcp/{server}.md` DOIT être couvert par la config livrée. Un hook qui n'injecte jamais est indiscernable d'un hook absent.
Config livrée : `enabled` non-false, `mode` global jamais `"dumb"` (fixture de debug ; une DOC en dumb reste légitime — via SON frontmatter, ex. stripe.md).
⚠️ ZÉRO CADENCE dans le JSON (17/07/2026) : `servers` = subToolParam SEULEMENT — mode/threshold par doc vivent dans le frontmatter de la doc. Gates : schéma strict + check « servers sans cadence » + drift-test frontmatter des docs MCP livrées (clés admises : mode/threshold, valeurs valides).
`mcp-doc-config.schema.json` (16/07/2026) = vocabulaire FERMÉ de la config (enums, clés strictes). Drift-test dans config-gate.test.js : clé de config hors schéma = ROUGE. Nouvelle clé de config ⇒ l'ajouter au schéma D'ABORD, sinon le gate hurle — c'est voulu.
