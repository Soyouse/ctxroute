---
match: doc-drift-gate.test.js
mode: dumb
---
# doc-drift-gate.test.js — une doc qui MENT est pire que pas de doc (06/08/2026)
⚠️ **NÉ D'UN DÉFAUT VÉCU** : le 03/08/2026, TROIS docs enseignaient l'INVERSE du code, corrigées seulement parce qu'un agent PASSAIT dessus. Une doc injectée porte le ton d'un invariant prouvé — personne ne la remet en cause. Cas limite atteint le même jour : le GATE **et** sa DOC disaient la même chose FAUSSE (deux remparts d'accord entre eux, tous deux à côté) ; il a fallu un audit HUMAIN, exactement ce que le 0-human interdit.
🛑 **CE QU'IL NE FAIT PAS** : il ne prouve JAMAIS qu'une doc dit vrai (aucun test ne le peut). Il ferme la seule part DÉCIDABLE — une doc qui cite un FICHIER disparu (renommage/suppression), classe qui arrive mécaniquement et que personne ne voit, car renommer un fichier ne touche pas les docs qui en parlent. Ne jamais l'annoncer comme « la défense contre les docs qui mentent » : ce serait le faux sentiment de sécurité qu'il combat.
⚠️ **TROIS RACINES** (repo · `sources/` · PARC `~/.claude/hooks`) : sans la racine parc, 8 des 64 fichiers cités seraient de FAUX rouges (`protect-files.js`, `statusline.js`… vivent chez le mainteneur). Parc absent (clone vierge/CI) ⇒ ces fichiers sont SAUTÉS explicitement ; le volet reste actif pour le repo, donc jamais aveugle.
⚠️ **MESURE AVANT ÉCRITURE** (obligatoire pour tout gate) : 32 docs, 936 littéraux, 64 fichiers `.js`, **0 introuvable**. Un critère à faux positifs aurait donné un gate que personne ne lit, donc un gate MORT. 🛑 Ne PAS l'élargir aux noms de FONCTIONS sans refaire cette mesure : les docs citent aussi des fonctions d'AUTRES projets, le bruit tuerait le signal (le volet ③ est le garde-fou anti-bruit — ne pas le retirer).
⚠️ **ANTI-DORMANCE** : plancher « ≥ 20 citations vérifiées » — une regex cassée rendrait zéro citation et le gate serait VERT en n'analysant RIEN (défaut déjà payé 3 fois : deps-purete, deadline-gate, couches-gate).
⚠️ Negative-check **EN MÉMOIRE**, jamais sur un fichier réel (un sabotage sur disque a fait tomber 38 tests d'autres suites le 03/08). Le rougissement du volet ① a été prouvé par sabotage temporaire le 06/08/2026.
