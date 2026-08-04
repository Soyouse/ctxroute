---
rules: [{"pattern":"legacy-mcp-inject.js","rank":350},{"pattern":"ctxroute-reset.js","rank":351},{"pattern":"ctxroute-config.json","rank":352},{"pattern":"legacy-mcp-inject.test.js","rank":353},{"pattern":"lib-pure.js","scope":["ctxroute"],"rank":362},{"pattern":"lock.js","scope":["ctxroute"],"exclude":["package-lock.json"],"rank":365},{"pattern":"stdin-json.js","rank":368}]
mode: dumb
confirm: true
rank: 350
---
# ctxroute — déplacé en dossier autonome (repo git séparé)

Le framework (code + tests) vit maintenant dans `~/Desktop/ctxroute/` (repo git propre, poussable sur GitHub sans mélanger avec le reste du home directory).
Câblage `settings.json` → chemins absolus pointent vers ce dossier (`legacy-mcp-inject.js`, `ctxroute-reset.js`).
Doc interne complète : `Desktop/ctxroute/HOOK-INTERNALS.md`. Usage/config : `Desktop/ctxroute/README.md` (et skill `.claude/commands/ctxroute.md`).
⚠️ Les docs MCP personnalisées du mainteneur (`docs/mcp/stripe.md`, `odoo.md` — avec vrais emails/clients) vivent dans `Desktop/ctxroute/docs/mcp/*.md`, gitignorées. Seuls les `.md.example` génériques sont poussés sur GitHub.
Modif du framework → éditer dans `Desktop/ctxroute/`, PAS ici (ce dossier ne contient plus le code).
