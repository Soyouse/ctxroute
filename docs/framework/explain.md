---
rules: [{"pattern":"explain.js","scope":["ctxroute"]},{"pattern":"explain.test.js","scope":["ctxroute"]},{"pattern":"collect-core.js","scope":["ctxroute"]}]
mode: dumb
---
# explain.js / collect-core.js — « pourquoi ça s'injecte (ou pas) ? »

⚠️ **AVANT de conclure qu'une doc est muette ou que le moteur a un bug : `node explain.js --doc <nom> --tool X --input '{"command":"…"}'`.** Il rend le motif EXACT (frontmatter invalide · `inject: never` · corps vide · déclencheur inerte · outil non visé · scope · exclude · pattern absent + contextes testés · commande git ignorée).
⚠️ **NE JAMAIS réimplémenter le moteur pour le sonder** : coût MESURÉ le 31/07/2026 = une session entière, 3 sondes fausses, une conclusion FAUSSE « il faut modifier le moteur ». Un harnais maison se trompe de format et rend un « muet » qu'on prend pour un verdict.
⚠️ **Il ne DÉCIDE rien** : lecture seule, ZÉRO écriture d'état (une doc `once` consommée par un diagnostic priverait la vraie session). Hors chemin critique — aucune porte ne doit l'importer (gate dependency-cruiser).
⚠️ **Il consomme les MÊMES fonctions que la porte** (`collect-core` → ADAPTERS → `gate.decide`). Le « pourquoi PAS » vient de PROBES qui ré-interrogent les vraies sources avec une règle amputée d'un opérateur — jamais d'une 2ᵉ logique de match. Motif manquant ⇒ ajouter une probe, JAMAIS une condition maison.
⚠️ **FAIL-LOUD** (exit 2 + « PANNE DE L'OUTIL »), à l'inverse des hooks fail-open : un diagnostic muet sur sa propre panne se lit comme « rien ne s'injecte » = faux verdict moteur.
⚠️ `collect-core.js` = collecte PARTAGÉE porte↔explain. La dupliquer rouvre la divergence que cet outil existe pour tuer.
⚠️ `explain.test.js` : les 2 CAS FONDATEURS rejouent les faux verts du 31/07. **Ne JAMAIS les supprimer** — si le comportement change, on INVERSE le verdict attendu (fait pour le joker), le cas reste. Un cas fondateur supprimé, c'est la classe de bug qui redevient invisible.
