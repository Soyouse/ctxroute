# Changelog

## 1.1.0

- Granularité 3 niveaux : `docs/mcp/{server}.md` (serveur) → `docs/mcp/{server}/{tool}.md` (outil précis) → `docs/mcp/{server}/{subTool}.md` (paramètre, via `servers.{server}.subToolParam`, pour les MCP proxy à outil unique type Odoo).
- Purge automatique probabiliste des fichiers `state/*.json` périmés (TTL 30 jours par défaut) — borne la croissance disque sur un usage long terme.
- LICENSE (MIT), `.gitattributes`, CI GitHub Actions (matrice ubuntu/windows).
- 33 tests (config cassée, doc vide, granularité outil/sous-outil, purge state).

## 1.0.0

- Première release : injection par serveur MCP, 3 modes (`dumb`/`once`/`smart`), seuils et mode par serveur, filtrage whitelist/blacklist, reset absolu à la compaction (`PreCompact`), compteurs indépendants par serveur.
- 24 tests.
