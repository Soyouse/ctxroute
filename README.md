# mcp-doc-hooks

Framework générique Claude Code : injecte automatiquement une doc courte (invariants, pièges, bonnes pratiques) au contexte de l'agent dès qu'il touche un serveur MCP donné — équivalent d'un mini-skill auto-chargé au contact, mais pour la frontière MCP plutôt que la frontière fichier.

## Pourquoi

Un serveur MCP (Stripe, Odoo, SSH...) est une frontière à risque au même titre qu'un fichier critique. Sans contexte injecté au bon moment, un agent peut appeler un outil sans connaître ses pièges (ex: cliquer un bouton de paiement réel sur un portail client, croire un champ par défaut alors qu'il est spécifique à l'enregistrement, etc.). Ce framework livre l'invariant AU moment du risque, pas dans une instruction en prose qu'on espère que l'agent se rappelle.

## Installation

1. Copier ce dossier où tu veux (aucune contrainte d'emplacement — voir "Comment ça marche").
2. Câbler dans `.claude/settings.json` :

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__.*",
        "hooks": [{ "type": "command", "command": "node /chemin/vers/mcp-doc-hooks/mcp-doc-inject.js", "timeout": 5 }]
      }
    ],
    "PreCompact": [
      {
        "hooks": [{ "type": "command", "command": "node /chemin/vers/mcp-doc-hooks/mcp-doc-reset.js", "timeout": 5 }]
      }
    ]
  }
}
```

3. Redémarrer la session Claude Code (les hooks sont chargés au démarrage).
4. Copier les `.md.example` dans `docs/mcp/` en `.md` réels (ex: `docs/mcp/stripe.md.example` → `docs/mcp/stripe.md`) et les personnaliser pour ton contexte.

## Comment ça marche

Claude Code ne connaît que le chemin absolu du `command` déclaré dans `settings.json` — le dossier peut vivre n'importe où. La seule contrainte : les fichiers `mcp-doc-inject.js`, `mcp-doc-reset.js`, `mcp-doc-config.json`, `docs/mcp/` et `state/` utilisent des chemins **relatifs entre eux** (`__dirname`) — ils doivent rester ensemble comme un bloc.

- **`mcp-doc-inject.js`** (hook `PreToolUse`, matcher `mcp__.*`) : au 1er appel d'un outil `mcp__{server}__*` de la session, injecte `docs/mcp/{server}.md` (si le fichier existe) en `additionalContext`.
- **`mcp-doc-reset.js`** (hook `PreCompact`) : vide l'état de session à chaque compaction — le contexte étant réellement vidé, la doc doit pouvoir se réinjecter.
- **`mcp-doc-config.json`** : configure le mode et les seuils.

Détails d'implémentation, format du store, invariants internes : voir `HOOK-INTERNALS.md`.

## Configuration (`mcp-doc-config.json`)

```json
{
  "mode": "smart",
  "defaultThreshold": 4,
  "filterMode": "none",
  "filterList": [],
  "servers": {
    "stripe": { "threshold": 1, "mode": "dumb" }
  }
}
```

- **`mode`** : `"dumb"` (réinjecte à chaque appel du serveur) · `"once"` (1 seule fois par contexte, jusqu'à compaction) · `"smart"` (défaut — comme `once`, mais réinjecte aussi si ≥ N appels D'AUTRES outils se sont écoulés depuis le dernier appel à ce serveur précis).
- **`defaultThreshold`** : N par défaut pour le mode `smart`.
- **`servers.{name}.threshold`** / **`servers.{name}.mode`** : override par serveur — un MCP à enjeu élevé (paiement, mutation destructive) peut avoir un seuil plus bas ou un mode `dumb` fixe, indépendamment du réglage global.
- **`filterMode`** (`"none"` / `"whitelist"` / `"blacklist"`) + **`filterList`** : limite quels serveurs sont couverts par le framework.

### Compteurs indépendants par serveur

Chaque serveur MCP a son propre compteur "appels étrangers depuis mon dernier appel". Un appel à un AUTRE serveur MCP fait avancer ce compteur au même titre qu'un outil natif (Bash/Read/...) — mais jamais un appel au serveur lui-même. Exemple : Stripe → Odoo → Stripe fait avancer le compteur de Stripe pendant l'appel à Odoo (Odoo est "étranger" à Stripe), et réciproquement.

## Granularité 3 niveaux

Toutes les docs qui matchent un appel sont **concaténées**, du plus global au plus spécifique :

1. `docs/mcp/{server}.md` — invariants du serveur entier.
2. `docs/mcp/{server}/{tool}.md` — spécifique à un outil précis (`{tool}` = ce qui suit `mcp__{server}__` dans le nom d'outil, ex. `mcp__stripe__authenticate` → `docs/mcp/stripe/authenticate.md`).
3. `docs/mcp/{server}/{subTool}.md` — pour les MCP **proxy à outil unique** où l'opération réelle est un paramètre à l'intérieur de `tool_input` (ex. Odoo : `tool_name` est toujours `mcp__odoo__odoo_call`, l'opération réelle vit dans `tool_input.args.tool`). Activé via `servers.{server}.subToolParam` (chemin pointé du paramètre à lire) :

```json
{
  "servers": {
    "odoo": { "subToolParam": "args.tool" }
  }
}
```

Avec ce réglage, `docs/mcp/odoo/delete_record.md` s'injecte UNIQUEMENT quand `tool_input.args.tool === "delete_record"`, en plus de `docs/mcp/odoo.md` — le framework distingue une lecture Odoo d'une suppression Odoo, alors que les deux partagent le même `tool_name`.

## Ajouter un MCP au standard

1. Créer `docs/mcp/{server}.md` (`{server}` = le nom entre les `mcp__`, ex. `mcp__stripe__authenticate` → `stripe.md`).
2. Format : < 10 lignes, 1 ligne = 1 invariant/piège, ton impératif, zéro filler.
3. Aucun code à écrire — le hook générique lit tous les `.md` du dossier à la volée.

## Tests

```
node mcp-doc-inject.test.js
```

Harnais Node natif (zéro dépendance), spawn le hook en process enfant, vérifie tous les modes/seuils/filtres/reset. Voir le fichier pour la couverture exacte.

## Licence

MIT.
