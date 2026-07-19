---
match: [doctor.js, doctor.test.js]
scope: [mcp-doc-hooks]
mode: dumb
confirm: true
rank: 356
---
# doctor.js / doctor.test.js — dead-man switch

⚠️ RAISON D'ÊTRE : un hook PreToolUse mort est INDISCERNABLE d'un hook absent (aucune erreur, aucun log — juste plus de doc injectée). Déjà vécu 2× le 15/07/2026. Câblé en SessionStart (`--quiet --settings ...`) : silencieux si vivant, hurle si mort.
NE JAMAIS le rendre fail-open comme les hooks : un hook DOIT être silencieux/non-bloquant, un DIAGNOSTIC DOIT hurler (exit≠0 + stderr). Rôles opposés, jamais fusionnés.
⚠️ Toute sonde prouve un EFFET RÉEL (contexte injecté, store incrémenté, stores EFFACÉS), JAMAIS un simple exit 0 — trou fermé 19/07/2026 : le reset était vérifié « sort sans crash » ; un stub exit-0-muet était indiscernable d'un reset vivant (negative-check 3f le prouve). Nouvelle sonde = poser les 3 stores → reset → exiger l'ABSENCE.
NE JAMAIS supprimer les cas NÉGATIFS de `doctor.test.js` (sabotage réel sur COPIE tmpdir) : un dead-man switch jamais déclenché = fausse confiance. Le vert sur repo sain ne prouve RIEN.
`--quiet` ne réduit QUE la sortie de succès — un échec hurle toujours, quiet ou pas.
Le probe s'isole via `MCP_DOC_CONFIG_PATH`/`DOCS_DIR`/`STATE_DIR` (tmpdir) : il ne DOIT jamais toucher les fichiers livrés (cas 6 le vérifie).
Le check `--settings` est la SEULE couverture du câblage : il vit hors du repo, aucun test du repo ne peut le voir.
⚠️ CODEX (19/07/2026) : probes 7-8 = coquilles codex-doc-inject/codex-doc-write-guard (mêmes preuves d'effet réel) ; `--codex-hooks <path>` = câblage Codex (5 voies + fichiers = CE repo + anti-DOUBLE injection : protect-files.js ne doit PLUS y être câblé). Negative-checks 3g/3h/7 dans doctor.test.js — jamais supprimés.
⚠️ TERRAIN Codex 0.144 (mesuré 19/07/2026) : `~/.codex/hooks.json` IGNORÉ. Câblage framework = `C:\ProgramData\OpenAI\Codex\requirements.toml` (hooks MANAGÉS = trustés d'office par politique, ZÉRO /hooks — prouvé sans bypass) ; pointer --codex-hooks dessus. Hooks perso (rush-banner/sync-mcps) restent dans config.toml — ne JAMAIS y recâbler le framework (double injection). Payload réel : tool_name="Bash" même pour shell_command.
