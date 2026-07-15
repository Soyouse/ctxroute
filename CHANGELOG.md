# Changelog

## 1.3.0

- **2 interrupteurs DISTINCTS et composables** :
  - `enabled` (défaut `true`) — GLOBAL, coupe TOUT (injection ET tracking d'état). Pattern standard (ESLint, git hooks `SKIP=...`).
  - `showNotification` (défaut `true`) — coupe UNIQUEMENT le badge visible `📄 [mcp-doc-hooks] ...`, l'injection réelle continue toujours. Ne pas confondre les deux (corrigé après une confusion en session).
- **systemMessage enrichi** : préfixe explicite `[mcp-doc-hooks]` (distingue des autres sources de doc injectable, ex. `protect-files.js`) + granularité réelle injectée visible (ex. `stripe (tool)`, `odoo (tool+subTool)`).
- **CI matrice 3 OS** : ajout de macOS (Linux + Windows + macOS), tous verts.
- **Docs injectables sur TOUT le repo** : 17 patterns dans `.claude/hooks/protected-paths.json`, tous scopés `["mcp-doc-hooks"]` quand le nom de fichier est générique (zéro collision avec d'autres projets), regroupés dans `docs/mcp-doc-hooks/` (pas à plat). Tout futur agent qui touche un fichier du repo, même sans contexte de session, reçoit automatiquement l'invariant pertinent.
- **2e skill créé** : `mcp-doc-hooks-architecture.md` (philosophie, modèle mental, arbo complète, invariants — pas de how-to), distinct du skill d'usage `mcp-doc-hooks.md`.
- 142 tests au total (87 unitaires lib-pure + 9 lock + 46 intégration).

## 1.2.1

- **Fix bug réel trouvé en CI** (invisible en local) : `lock.js` supposait que le dossier parent de `state/` existait déjà. Sur un checkout FRAIS, `fs.mkdirSync(lockDir)` échouait en `ENOENT` (pas `EEXIST`) → interprété à tort comme erreur fatale → lock jamais acquis → toutes les injections silencieusement désactivées (`fallback: {inject:false}`). Fix : créer la chaîne de dossiers parents (`recursive:true`, idempotent, sûr en concurrence) avant la tentative d'acquisition atomique.
- Nouveau `lock.test.js` (9 tests) qui reproduit EXACTEMENT ce scénario (checkout frais, aucun parent existant) — ne peut plus régresser silencieusement.
- 109 tests au total (66 unitaires lib-pure + 9 lock + 34 intégration).

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
