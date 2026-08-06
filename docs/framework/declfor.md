---
match: declfor-gate.test.js
mode: dumb
---
# declfor-gate.test.js — une clé de décision FILTRÉE est une clé MORTE (06/08/2026)
🔴 **DÉFAUT RÉEL, LE PLUS COÛTEUX POSSIBLE** : `enforce` (le mot qui REFUSE un geste, livré le 05/08) n'était pas recopié par `sources/mcp.js#declFor` ⇒ accepté par `validateMcp`, documenté partout, **INERTE sur le canal MCP** — donc précisément là où vit l'incident FONDATEUR (le clic de paiement Stripe). Découvert 24 h plus tard en l'armant POUR DE VRAI : `create_refund` rendait `allow`. **Un cran d'arrêt qui ne s'arrête pas est PIRE que rien : on lui fait confiance.**
🛑 **LA CAUSE ÉTAIT UN COMMENTAIRE** : « une decl ne porte QUE de la cadence » — juste sur le fond (une source n'arbitre rien), lu comme « donc ne recopie pas `enforce` ». **Transporter ≠ décider** : une decl TRANSPORTE ce que l'auteur a déclaré, `gate.js` seul tranche.
⚠️ **POURQUOI LE GATE DE SYMÉTRIE DU VOCABULAIRE NE L'A PAS VU** : il vérifie qu'une clé est ADMISE dans les 4 corpus (validation), pas qu'elle est TRANSPORTÉE jusqu'à `gate.decide` (propagation). Deux invariants distincts — admettre et honorer ne sont pas la même chose.
⚠️ **CLÉS DÉRIVÉES DE `gate.js`** (les résolveurs `xForDoc`), jamais recopiées : une liste ici divergerait, c'est le bug même qu'on traque. `bloque` est exclu — c'est le VERDICT, pas une clé de frontmatter.
⚠️ **VOLET ③ = ANTI-ANGLE-MORT, ne pas le retirer** : sans lui, une clé ajoutée sans échantillon donnerait `undefined === undefined` ⇒ VERT alors qu'elle est filtrée. Le gate se certifierait lui-même.
⚠️ `false` EXPLICITE doit survivre (volet ④) : c'est la seule façon de se DÉSINSCRIRE d'un `defaults.{source}.enforce`. Un filtre « valeur vide » rendrait la désinscription impossible.
🛑 **LA SOURCE FICHIER N'A PAS CE RISQUE** (elle passe le frontmatter ENTIER) ; `mcp` et `skill` recopient clé par clé. Tant que cette asymétrie existe, ce gate est le SEUL filet. Rougissement prouvé par sabotage réel le 06/08/2026.
