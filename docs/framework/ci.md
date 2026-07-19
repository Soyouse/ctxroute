---
match: test.yml
scope: [mcp-doc-hooks]
mode: dumb
confirm: true
rank: 373
---
# .github/workflows/test.yml — invariants

3 jobs indépendants : `test` (matrice ubuntu/windows/macos, `npm test`), `coupling` (`dependency-cruiser`+`jscpd`), `mutation` (Stryker). Tous doivent rester verts avant tout tag de version.
⚠️ Node version DOIT être ≥22 partout (dependency-cruiser l'exige) — un mismatch entre la machine dev (souvent plus récente) et la CI pinnée plus bas EST le bug le plus probable si `coupling`/`mutation` échouent sans raison apparente en CI mais passent en local (déjà vécu 15/07/2026).
macOS coûte 10× le multiplicateur de minutes GitHub Actions (vs 1× Linux, 2× Windows) — négligeable ici (job <1s) mais à recalculer si un job devient lourd.
`concurrency: cancel-in-progress` — un push annule le run précédent en cours, normal, pas un bug si tu vois un run "cancelled".
