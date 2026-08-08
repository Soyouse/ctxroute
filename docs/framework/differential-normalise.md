---
match: differential-normalise
mode: dumb
---

# differential-normalise.js — le filtre qui pourrait rendre les différentiels AVEUGLES
⚠️ **SOURCE UNIQUE des 2 différentiels** (`porte-differential`, `mcp-differential`). Jamais une copie dans une suite : deux normalisations divergent, et deux filets qui ne filtrent plus la même chose ne prouvent plus rien ensemble.
🛑 **IL AFFAIBLIT DÉLIBÉRÉMENT UN GARDE-FOU** — il retire de la matière AVANT comparaison. C'est légitime (l'oracle `protect-files.js` est FIGÉ depuis juillet et ignore tout ce qui est né après : sceau, puis ordinal), mais ça exige son negative-check. Un filtre de comparaison NON testé peut avaler une VRAIE régression, et les 2 filets resteraient VERTS dessus.
🛑 **ANCRÉ SUR LE TAG SOURCE, JAMAIS UN EFFACEMENT AVEUGLE** : retirer tout `[DOC x/y]` où qu'il soit avalerait une doc dont le CORPS contient ce texte — les différentiels deviendraient borgnes là où on croirait les renforcer. Volet ③ du negative-check.
⚠️ **NE JAMAIS élargir un motif pour « faire passer » un rouge.** Un différentiel qu'on ajuste jusqu'au vert ne garde plus rien. Rouge ⇒ instruire sur pièce si l'écart est DÉJÀ déclaré, sinon c'est une parité RÉELLE qui casse.
⚠️ TOTALE : entrée non-chaîne rendue telle quelle (le contexte MCP vaut `undefined` quand rien n'est injecté) — un différentiel qui plante se lit comme une panne de moteur.
