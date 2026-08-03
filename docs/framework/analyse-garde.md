---
rules: [{"pattern":"collisions.js","scope":["ctxroute"]},{"pattern":"collisions.test.js","scope":["ctxroute"]},{"pattern":"check-collisions.js","scope":["ctxroute"]},{"pattern":"doc-write-guard.js","scope":["ctxroute"]},{"pattern":"doc-write-guard.test.js","scope":["ctxroute"]},{"pattern":"guard-core.js","scope":["ctxroute"]},{"pattern":"codex-doc-write-guard.js","scope":["ctxroute"]},{"pattern":"codex-doc-write-guard.test.js","scope":["ctxroute"]}]
mode: dumb
confirm: true
---
# collisions.js / check-collisions.js / doc-write-guard.js — analyse & garde du parc (0-human)

⚠️ `doc-write-guard.js` = PostToolUse Write|Edit (CÂBLÉ) : doc du parc invalide → `decision: block` + raison DANS le tour de l'agent (il corrige lui-même) ; doc saine → SILENCE TOTAL. Validation DÉLÉGUÉE à frontmatter.js (validate/validateMcp) — ne JAMAIS re-juger ici.
⚠️ `collisions.js` = NOYAU PUR (muté) : croisements de règles, 3 niveaux de TRI. JAMAIS un gate (indécidable par machine) — le verdict revient à un AGENT, jamais à un humain.
⚠️ `check-collisions.js` = coquille on-demand (`node check-collisions.js [--json]`), source = FRONTMATTERS via loader — plus jamais protected-paths.json. Exit 0 toujours.
⚠️ **PORTAGE (19/07/2026)** : corps commun = `guard-core.js` (docKind + validation multi-fichiers, run(filePaths)) — coquilles minces : Claude = file_path direct · Codex = `codex-doc-write-guard.js`, chemins extraits du patch apply_patch (tool_input.command) via sources/file.js#extractFilePaths (MÊME parseur que le match d'entrée, jamais un 2ᵉ). `decision: block` = dialecte commun mesuré.
⚠️ Docs session : jamais bloquées (rien à valider par construction).
⚠️ Fail-open intégral de la garde ; sa vivacité = doctor (probe 4 + câblage).
