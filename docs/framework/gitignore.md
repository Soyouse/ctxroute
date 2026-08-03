---
match: .gitignore
scope: [ctxroute]
mode: dumb
confirm: true
rank: 354
---
# .gitignore (ctxroute) — piège

⚠️ `docs/mcp/*.md` est GITIGNORÉ (docs perso : emails/clients réels) ; seuls les `*.md.example` sont poussés. Conséquence : un checkout frais (CI, ou quiconque clone) n'a AUCUNE doc.
⚠️ NE JAMAIS écrire un gate de repo qui EXIGE la présence d'un `docs/mcp/*.md` — vert en local, ROUGE sur les 3 OS en CI (erreur commise le 15/07/2026 par config-gate). « Avoir des docs » est un invariant d'INSTALLATION (→ `doctor.js --settings`), jamais du dépôt.
Règle générale : un gate de repo doit valoir sur un clone VIERGE, sinon il est faux pour tout le monde sauf son auteur.
`state/` et `reports/` gitignorés = artefacts runtime, jamais commités.
