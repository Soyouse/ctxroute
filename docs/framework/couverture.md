---
rules: [{"pattern":"couverture-gate.test.js","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
---
# couverture-gate.test.js — le repo se documente lui-même, ou il rougit

⚠️ 4 volets DÉRIVÉS (jamais une liste recopiée — ce serait le même bug) : ① tout `.js` racine/`sources/` reçoit une doc injectable (mesuré par la VRAIE source) · ② tout fichier TRACKÉ est dans l'arbo du skill · ③ tout module est dans l'`includeOnly` de dependency-cruiser · ④ aucune doc injectable ne GROSSIT.
⚠️ Né d'un audit qui a trouvé 5 oublis dont 3 PRÉEXISTANTS (suites nues, fichiers hors arbo, et 4 modules jamais analysés par dependency-cruiser — faux négatif silencieux depuis leur création).
⚠️ **Volet ③ = le plus traître** : un module hors `includeOnly` rend le gate de couplage VERT en n'analysant RIEN.
⚠️ La DETTE de taille (④) est une liste qui ne peut que RÉTRÉCIR — l'élargir, c'est acter la dérive qu'on prétend combattre.
⚠️ Volets ①②④ dépendent du parc/skill (hors repo) ⇒ skip propre sur clone vierge. ③ vaut partout.
⚠️ NE JAMAIS retirer le negative-check : un gate qui ne peut pas rougir CERTIFIE au lieu de protéger (déjà vécu ici avec `deadline-gate`, vert en n'analysant aucun hook réel).
