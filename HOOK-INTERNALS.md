# mcp-doc-inject.js — doc injectable générique par serveur MCP

Hook PreToolUse, matcher `mcp__.*` dans settings.json. Framework générique : 1 seul fichier code, N docs déposées dans `docs/mcp/{server}.md`, config dans `mcp-doc-config.json`.
**3 modes** (`mcp-doc-config.json` → `mode`) : `dumb` (réinjecte à chaque appel, bruyant, jamais défaut) · `once` (1er appel du serveur, plus jamais jusqu'à compaction) · `smart` (défaut — comme once, MAIS réinjecte si ≥ N appels D'AUTRES outils depuis le dernier appel à CE serveur ; seuil = `defaultThreshold` ou `servers.{server}.threshold`).
Compteur `sinceLastCall` par serveur : incrémenté par TOUT outil ÉTRANGER (outil natif OU appel à un AUTRE serveur MCP — pas seulement les outils non-MCP), mode smart only. Remis à 0 dès que le serveur est rerappelé (injecté ou pas). ⚠️ Compteurs INDÉPENDANTS entre serveurs — jamais un compteur global partagé (Stripe→Odoo→Stripe fait avancer le compteur Stripe pendant l'appel Odoo, et réciproquement).
**Mode PAR SERVEUR** : `servers.{server}.mode` écrase `mode` global pour CE serveur uniquement (ex: Stripe fixé en "dumb" pendant que le reste reste "smart").
**Filtrage** (`filterMode`: "none"|"whitelist"|"blacklist" + `filterList`) : contrôle QUELS serveurs sont couverts (injection + état), indépendamment de l'existence d'un doc.md. ⚠️ Un serveur EXCLU par le filtre compte QUAND MÊME comme "étranger" pour les AUTRES serveurs actifs (la boucle d'incrémentation ne connaît pas le filtre — un appel reste un appel réel).
Store = `state/mcp-doc-seen-<session_id>.json` : `{server: {seen, sinceLastCall}}`. Clé par session_id — même isolation que odoo-provenance.js.
⚠️ PUREMENT informatif — ne bloque JAMAIS (pas de deny/ask). Le blocage reste le rôle des hooks dédiés (protect-files.js, odoo-provenance.js).
Ajouter un MCP au standard = déposer `docs/mcp/{server}.md` (<10 lignes). AUCUN code à écrire par serveur.
⚠️ RESET ABSOLU sur compaction (tous modes) : `mcp-doc-reset.js` (hook PreCompact) supprime tout le store de session — session_id ne change pas à la compaction, sans ce reset le store resterait "vu" alors que le contexte est vidé.
`serverName()` extrait `{server}` depuis `mcp__{server}__{tool}` via regex (gère les noms multi-underscore, ex: `plugin_discord_discord`).
Usage/config détaillés : skill `.claude/commands/mcp-doc-hooks.md`.
Câblage settings.json → REDÉMARRER la session après modif pour activer.
