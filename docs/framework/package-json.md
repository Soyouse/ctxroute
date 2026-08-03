---
match: package.json
scope: [ctxroute]
mode: dumb
confirm: true
rank: 374
---
# package.json (ctxroute) — invariants

`engines.node >= 22` — contrainte RÉELLE (dependency-cruiser l'exige), pas arbitraire. Ne jamais la baisser sans vérifier que tous les devDependencies la supportent encore.
`npm run check:all` = la suite complète (tests + coupling + mutation) — TOUJOURS la lancer avant un tag de version, jamais juste `npm test`.
Nouveau fichier `.js` dans le repo → l'ajouter aux scripts de test s'il a sa propre suite (`test:xxx`), ET à `.dependency-cruiser.json` `includeOnly`, ET au `.gitignore`/`.jscpd.json` si pertinent — 3 endroits à synchroniser, jamais un seul.
