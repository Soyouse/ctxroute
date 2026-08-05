---
rules: [{"pattern":"couverture-gate.test.js","scope":["ctxroute"]}]
mode: dumb
---
# couverture-gate.test.js — le repo se documente lui-même, ou il rougit
⚠️ 5 volets DÉRIVÉS (jamais une liste recopiée — ce serait le même bug) : ① tout `.js` racine/`sources/` reçoit une doc injectable (mesuré par la VRAIE source) · ② tout fichier TRACKÉ est dans l'arbo du skill · ③ tout module est dans l'`includeOnly` de dependency-cruiser · ④ **SUPPRIME le 03/08/2026** (plafond de LONGUEUR des docs) — le framework LIVRE, il ne juge JAMAIS la taille : une doc trop lourde est MORCELEE et livree, l'indelivrabilite est impossible par construction. Ne PAS le reintroduire, la raison est gravee dans le fichier · ⑤ **SUPPRIME aussi le 03/08/2026** (plafond du POIDS DES SKILLS). Les volets ①→③ restent ACTIFS.
⚠️ Né d'un audit qui a trouvé 5 oublis dont 3 PRÉEXISTANTS (suites nues, fichiers hors arbo, 4 modules jamais analysés par dependency-cruiser — faux négatif silencieux depuis leur création).
⚠️ **Volet ③ = le plus traître** : un module hors `includeOnly` rend le gate de couplage VERT en n'analysant RIEN.
🛑 **VOLET ⑤ SUPPRIME (03/08/2026) — sa condition de reactivation est CADUQUE, pas remplie.** Il plafonnait le poids des skills ; il avait ete suspendu le 02/08 « jusqu'a ce que l'injection auto des skills soit prouvee ». ⚠️ Elle l'est DESORMAIS (doctor + skill de 28 Ko livre en MORCEAUX numerotes) — relire cette condition telle quelle ferait RESSUSCITER un cliquet de taille. Un skill lourd est LIVRE : son poids n'est plus un defaut. 🛑 **DOCTRINE : un skill s'injecte EN ENTIER ou PAS DU TOUT** — ne JAMAIS conseiller de le scinder.
⚠️ Volets ①② dependent du parc/skill ⇒ skip sur clone vierge ; ③ vaut partout.
⚠️ NE JAMAIS retirer un negative-check : un gate qui ne peut pas rougir CERTIFIE au lieu de proteger (deja vecu avec `deadline-gate`, vert en n'analysant aucun hook reel). Les 3 volets restants ont le leur.
