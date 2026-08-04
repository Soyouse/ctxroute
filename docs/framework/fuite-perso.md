---
rules: [{"pattern":"fuite-pure.js","scope":["ctxroute"]},{"pattern":"fuite-perso-gate.test.js","scope":["ctxroute"]},{"pattern":"fuite-pure.test.js","scope":["ctxroute"]}]
mode: dumb
confirm: true
rank: 566
---
# fuite-perso — le gate qui empêche une donnée personnelle d'atteindre un dépôt PUBLIC

⚠️ **UNE DONNÉE POUSSÉE NE SE RETIRE PLUS** : elle survit dans `git log -p` même après correction de l'arbre. Constaté le 04/08/2026 — 5 fuites dans des fichiers trackés (corrigées À LA MAIN, sans filet) + la config utilisateur devenue trackée parce qu'un codemod avait raté `.gitignore`.
⚠️ **AUCUNE DONNÉE PERSONNELLE DANS CES FICHIERS, PAR CONSTRUCTION** : un gate qui listerait en dur le prénom ou les clients SERAIT LUI-MÊME LA FUITE. Tout vient de l'extérieur — environnement (compte OS, dossier perso) + liste privée `~/.claude/secrets/ctxroute-fuite.json`, hors dépôt. Y écrire une chaîne à protéger = annuler le gate.
⚠️ **DÉRIVER, JAMAIS LISTER** : les clients viennent des DOSSIERS qui portent leur marqueur (`brief.md`), pas d'une liste écrite — une liste serait périmée au client suivant et protégerait moins EN SILENCE. Le marqueur écarte aussi `.git`/`node_modules`/`scripts` (mesuré : 4 collisions, 3 fausses).
⚠️ **FRONTIÈRES DE MOT, jamais du sous-chaîne** : un prénom court est un sous-mot de mots courants (2 faux positifs réels le 04/08). Et du dossier personnel on ne garde QUE le dernier segment — « Users » est générique et rendrait le gate rouge partout (6 faux positifs).
⚠️ **DOIT RESTER VERT SUR UN CLONE VIERGE** : liste privée absente ⇒ mode GÉNÉRIQUE (email réel, IP du bloc CGNAT/Tailscale), jamais une panne. Les plages de documentation (RFC 5737) et `example.`/`test.` (RFC 2606) restent AUTORISÉES — les interdire rendrait la doctrine inapplicable.
⚠️ **TEXTE, PAS AST** : ici un nom en commentaire ou en chaîne EST la fuite, et la plupart des fuites vivaient dans des `.md`. L'AST (bon pour `setTimeout`) serait aveugle là où ça fuit vraiment.
