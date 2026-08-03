# ctxroute

[![test](https://github.com/Soyouse/ctxroute/actions/workflows/test.yml/badge.svg)](https://github.com/Soyouse/ctxroute/actions/workflows/test.yml)

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
        "hooks": [{ "type": "command", "command": "node /chemin/vers/ctxroute/mcp-doc-inject.js", "timeout": 5 }]
      }
    ],
    "PreCompact": [
      {
        "hooks": [{ "type": "command", "command": "node /chemin/vers/ctxroute/mcp-doc-reset.js", "timeout": 5 }]
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
- **`enabled`** (défaut `true`) : interrupteur GLOBAL — `false` coupe TOUT (injection ET tracking d'état/compteurs). Pattern standard (cf ESLint, git hooks `SKIP=...`) pour désactiver temporairement sans retirer le câblage `settings.json`.
- **`showNotification`** (défaut `true`) : contrôle UNIQUEMENT le `systemMessage` visible (le badge `📄 [ctxroute] ...`) — `false` n'affiche plus le badge mais l'injection réelle (`additionalContext`, ce que voit l'agent) continue normalement. Indépendant de `enabled`.

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
2. Format : **LIBRE. Le framework n'impose ni taille ni structure** — il doit livrer une doc de n'importe quelle taille. Une doc qui ne passe pas est un défaut du TRANSPORT, à corriger dans le moteur, jamais une doc à raccourcir.
   *(Recommandation d'USAGE, propre à chaque déploiement : le contenu étant réinjecté à chaque geste, court et impératif — 1 ligne = 1 invariant/piège — limite la dilution. C'est un conseil, pas une contrainte, et aucun gate du framework ne l'applique.)*
3. Aucun code à écrire — le hook générique lit tous les `.md` du dossier à la volée.

## Architecture

Le repo sépare strictement la **décision** (pure, testable/mutable) de l'**I/O** (fs/stdin/stdout, non muté) :

- `lib-pure.js` — logique décisionnelle pure, ZÉRO import fs/path/process. Testée par `lib-pure.test.js` (tests unitaires directs, pas de spawn) et mutée par Stryker.
- `lock.js` — lock cross-process (`fs.mkdirSync` atomique) pour sérialiser les accès concurrents à `state/`. Testé par `lock.test.js`, y compris le scénario "checkout frais" (dossier parent inexistant) qui a réellement cassé en CI.
- `stdin-json.js` — lecture stdin → JSON, partagée par tous les hooks (extrait après détection de duplication par `jscpd`).
- `mcp-doc-inject.js` / `mcp-doc-reset.js` — les 2 hooks eux-mêmes, seuls points d'I/O, consomment `lib-pure.js`/`lock.js`/`stdin-json.js`/`paths.js`.
- `paths.js` — source unique des chemins (config/docs/state). Aucun `path.join(__dirname, ...)` ad-hoc ailleurs : deux copies d'un même chemin divergent en silence.
- `doctor.js` — **dead-man switch**. Un hook mort est indiscernable d'un hook absent : aucune erreur, aucun log, juste plus de doc injectée. `doctor.js` spawne le vrai hook et vérifie qu'il injecte réellement, puis (avec `--settings`) que le câblage pointe vers des fichiers existants.

```bash
node doctor.js                                      # le framework est-il vivant ?
node doctor.js --quiet --settings ~/.claude/settings.json   # idem, muet sauf si cassé
```

Câblez-le en `SessionStart` avec `--quiet` : il ne parle que s'il est mort.
- `.dependency-cruiser.json` — garantit statiquement que `lib-pure.js` ne dépend jamais de fs/path/child_process (règle `lib-pure-must-stay-pure`), et qu'aucune dépendance circulaire n'apparaît.

## Tests

```
npm test               # unitaires + property + lock + config-gate + intégration + doctor
npm run test:mutation  # Stryker sur lib-pure.js (99%+ requis, cliquet jamais baissé)
npm run check:coupling # dependency-cruiser + jscpd (couplage implicite)
npm run check:all      # tout d'un coup
npm run doctor         # le framework est-il vivant, ici et maintenant ?
```

- `lib-pure.test.js` — tests unitaires purs (appel direct des fonctions, zéro spawn).
- `lock.test.js` — tests dédiés au lock (contention, lock stale forcé, propagation d'exception, ET la régression "checkout frais" trouvée en CI).
- `mcp-doc-inject.test.js` — tests d'intégration (spawn les hooks en process enfant, y compris un test de **concurrence réelle** : 20 appels parallèles sur la même session, preuve empirique que le lock cross-process ne perd aucune écriture). Les fixtures de config vivent en tmpdir (`MCP_DOC_CONFIG_PATH`) : un test n'écrit **jamais** dans un fichier livré.
- `lib-pure.property.test.js` — **property-based** (`fast-check`) : invariants de sécurité (aucun chemin ne peut sortir de `docs/mcp/`, quel que soit l'input) et de totalité (aucune fonction ne lève). Un test par cas ne couvre que les entrées auxquelles l'auteur a pensé — pour un parseur, c'est précisément l'angle mort.
- `config-gate.test.js` — la config **committée** doit couvrir tout serveur documenté. Une doc écrite mais jamais injectée est pire que pas de doc : c'est une fausse sécurité.
- `doctor.test.js` — **negative-check** : sabote une copie du framework (tmpdir) et exige que `doctor.js` sorte en ≠ 0. Un dead-man switch qui ne se déclenche jamais ne prouve rien.

## Hygiène — purge automatique de `state/`

Chaque session Claude Code produit un fichier `state/mcp-doc-seen-<session_id>.json`. Sans purge, ce dossier grossirait indéfiniment sur un usage long terme. Le hook `mcp-doc-inject.js` purge probabilistement (~1 appel sur 50, pour éviter un `readdir`/`stat` coûteux à chaque invocation) les fichiers dont le `mtime` dépasse 30 jours. Réglable via variables d'environnement (usage tests uniquement) : `MCP_DOC_GC_PROBABILITY`, `MCP_DOC_GC_TTL_MS`.

## Licence

MIT.
