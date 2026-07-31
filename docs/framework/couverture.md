---
rules: [{"pattern":"couverture-gate.test.js","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
---
# couverture-gate.test.js — le repo se documente lui-même, ou il rougit
⚠️ 5 volets DÉRIVÉS (jamais une liste recopiée — ce serait le même bug) : ① tout `.js` racine/`sources/` reçoit une doc injectable (mesuré par la VRAIE source) · ② tout fichier TRACKÉ est dans l'arbo du skill · ③ tout module est dans l'`includeOnly` de dependency-cruiser · ④ aucune doc injectable ne GROSSIT · ⑤ aucun skill enregistré ne dépasse sa dette de poids.
⚠️ Né d'un audit qui a trouvé 5 oublis dont 3 PRÉEXISTANTS (suites nues, fichiers hors arbo, 4 modules jamais analysés par dependency-cruiser — faux négatif silencieux depuis leur création).
⚠️ **Volet ③ = le plus traître** : un module hors `includeOnly` rend le gate de couplage VERT en n'analysant RIEN.
⚠️ **Volet ⑤ (31/07/2026)** : un skill au-dessus du budget d'émission est ÉVINCÉ de la trame — annoncé, jamais perdu, mais ABSENT du contexte. Plafond des skills NEUFS = `DEFAUT_BUDGET` de budget.js, DÉRIVÉ (jamais recopié).
⚠️ ⑤ raisonne en **PALIERS** (pas en valeurs exactes) : le parc est un WORKSPACE VIVANT, plusieurs agents éditent les skills en permanence. Un cliquet exact rougirait à chaque phrase d'un autre chantier ⇒ bruit ⇒ gate ignoré. Le palier n'attrape que le FRANCHISSEMENT. Sortie de dette = SCINDER, JAMAIS monter un palier. Volets ①②④⑤ dépendent du parc/skill ⇒ skip sur clone vierge ; ③ vaut partout.
⚠️ NE JAMAIS retirer un negative-check : un gate qui ne peut pas rougir CERTIFIE au lieu de protéger (déjà vécu avec `deadline-gate`, vert en n'analysant aucun hook réel). Sabotage vérifié 31/07 sur ⑤.
