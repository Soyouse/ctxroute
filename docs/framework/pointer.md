---
rules: [{"pattern":"mcp-doc-inject.js","rank":350},{"pattern":"mcp-doc-reset.js","rank":351},{"pattern":"mcp-doc-config.json","rank":352},{"pattern":"mcp-doc-inject.test.js","rank":353},{"pattern":"lib-pure.js","scope":["mcp-doc-hooks"],"rank":362},{"pattern":"lock.js","scope":["mcp-doc-hooks"],"exclude":["package-lock.json"],"rank":365},{"pattern":"stdin-json.js","rank":368}]
mode: dumb
confirm: true
rank: 350
---
# mcp-doc-hooks — déplacé en dossier autonome (repo git séparé)

Le framework (code + tests) vit maintenant dans `~/Desktop/mcp-doc-hooks/` (repo git propre, poussable sur GitHub sans mélanger avec le reste du home directory).
Câblage `settings.json` → chemins absolus pointent vers ce dossier (`mcp-doc-inject.js`, `mcp-doc-reset.js`).
Doc interne complète : `Desktop/mcp-doc-hooks/HOOK-INTERNALS.md`. Usage/config : `Desktop/mcp-doc-hooks/README.md` (et skill `.claude/commands/mcp-doc-hooks.md`).
⚠️ Les docs MCP personnalisées du mainteneur (`docs/mcp/stripe.md`, `odoo.md` — avec vrais emails/clients) vivent dans `Desktop/mcp-doc-hooks/docs/mcp/*.md`, gitignorées. Seuls les `.md.example` génériques sont poussés sur GitHub.
Modif du framework → éditer dans `Desktop/mcp-doc-hooks/`, PAS ici (ce dossier ne contient plus le code).
