# Changelog

## 1.2.0

- **Isolation décision/I/O** : logique décisionnelle extraite dans `lib-pure.js` (zéro fs/path/process, 66 tests unitaires purs) — `mcp-doc-inject.js`/`mcp-doc-reset.js` deviennent de purs points d'I/O.
- **Mutation testing Stryker** sur `lib-pure.js` : 99.15% (117/118 mutants tués, 1 survivant documenté comme équivalent — chaîne interne à Stryker non observable en usage réel). Break threshold 99, cliquet jamais baissé.
- **Lock cross-process** (`lock.js`, `fs.mkdirSync` atomique) : corrige une race condition réelle sur `state/*.json` en cas d'appels MCP parallèles (Claude Code peut lancer des outils indépendants en parallèle). Prouvé par un test de charge (20 appels concurrents, aucune écriture perdue).
- **Couplage implicite éliminé** : `stdin-json.js` extrait (duplication détectée par `jscpd` entre les 2 hooks) ; `sanitizeSessionId` centralisé dans `lib-pure.js` (était dupliqué dans `mcp-doc-reset.js`). `dependency-cruiser` + `jscpd` gatés en CI (0 violation, 0 clone).
- 100 tests au total (66 unitaires + 34 intégration, dont 1 test de concurrence réelle).

## 1.1.0

- Granularité 3 niveaux : `docs/mcp/{server}.md` (serveur) → `docs/mcp/{server}/{tool}.md` (outil précis) → `docs/mcp/{server}/{subTool}.md` (paramètre, via `servers.{server}.subToolParam`, pour les MCP proxy à outil unique type Odoo).
- Purge automatique probabiliste des fichiers `state/*.json` périmés (TTL 30 jours par défaut) — borne la croissance disque sur un usage long terme.
- LICENSE (MIT), `.gitattributes`, CI GitHub Actions (matrice ubuntu/windows).
- 33 tests (config cassée, doc vide, granularité outil/sous-outil, purge state).

## 1.0.0

- Première release : injection par serveur MCP, 3 modes (`dumb`/`once`/`smart`), seuils et mode par serveur, filtrage whitelist/blacklist, reset absolu à la compaction (`PreCompact`), compteurs indépendants par serveur.
- 24 tests.
