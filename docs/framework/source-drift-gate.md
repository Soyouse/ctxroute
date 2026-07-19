---
rules: [{"pattern":"source-drift-gate.test.js","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
---
# source-drift-gate.test.js — les 2 sources de vérité NE DÉRIVENT JAMAIS

⚠️ Prouve STATIQUEMENT (584 règles, EXHAUSTIF — pas échantillonné comme le reconcile) que `protected-paths.json` (ancien moteur) et les frontmatters du parc (nouveau moteur) sont IDENTIQUES. Fail-closed au pre-push.
⚠️ 2 sens, sévérités distinctes : SEULEMENT-JSON = le neuf RATERAIT une doc que l'ancien injecte = RÉGRESSION post-bascule (interdit absolu) ; SEULEMENT-FRONTMATTER = neuf sur-injecte + fallback JSON troué (bénin mais ROUGE quand même).
⚠️ Tant que la double écriture transitoire dure : toute nouvelle règle = JSON **ET** frontmatter, sinon ROUGE ici. Né 17/07/2026 (sitemap-sync.py + notify.ts ajoutés au frontmatter seul, specs/tla raté par la migration côté frontmatter).
⚠️ Compare (doc, pattern, scope, exclude) normalisés. Skippé sur clone vierge (parc absent). Retiré à la bascule quand le JSON devient artefact.
