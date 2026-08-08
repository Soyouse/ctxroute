---
match: mutation-plancher-gate
mode: dumb
---

# mutation-plancher-gate — le seuil GLOBAL de Stryker est aveugle à un fichier qui s'effondre

⚠️ **`thresholds.break` est une MOYENNE.** `canari.js` a tenu **89,23 % avec 7 survivants** pendant que le global affichait 99,64 % : CI verte, effondrement invisible. Ce gate ajoute un plancher **PAR FICHIER** — il ne remplace pas `break`, il le complète (l'un protège la moyenne, l'autre chaque module).
🛑 **PLANCHER = 100, CLIQUET JAMAIS BAISSÉ.** Mesuré atteignable par les **16** modules mutés. Un survivant se **TUE** (test ciblé) ou s'**ÉLIMINE** (code mort supprimé — c'est ce qui a réglé `canari.js` : `occurrences()` n'avait aucun appelant). Il ne se tolère JAMAIS en abaissant le chiffre.
⚠️ **`Timeout` compte comme TUÉ** (contrat Stryker) et **`Ignored` sort du dénominateur** (`// Stryker disable` délibéré) : sans ces deux règles, le gate rougirait sur du sain.
⚠️ **MUET si `reports/mutation.json` est absent** — VOULU : `npm test` ne lance pas Stryker. L'exiger rendrait toute suite rouge sans mutation préalable, donc un gate qu'on cesse de lire. Il mord en CI mutation et après `npm run test:mutation`.
🛑 **La piste du backlog ㉞ était FAUSSE** : « passe complète périodique » — elle existe déjà (`mutation.yml` ne restaure aucun cache incrémental, donc mute TOUT). Le faux vert était LOCAL ; le trou en CI était la GRANULARITÉ du verdict, pas sa fréquence.
