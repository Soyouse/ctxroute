---
rules: [{"pattern":"couches.json","scope":["ctxroute"]},{"pattern":"couches-gate.test.js","scope":["ctxroute"]}]
mode: dumb
---
# couches.json — LE TABLEAU CAPACITÉS × COUCHES (06/08/2026)
🛑 **ÉLARGIR CE TABLEAU EST PRESQUE TOUJOURS LA MAUVAISE RÉPONSE.** Un gate rouge dit que le FICHIER est dans la mauvaise couche, ou fait un travail qui ne lui appartient pas. Ajouter une capacité pour faire taire le rouge désarme le garde-fou **en silence**, et personne ne le verra jamais — le dépôt est écrit par des agents et relu par personne. Corrige le fichier, pas le tableau.
⚠️ **POURQUOI IL EXISTE** : 3 défauts d'architecture en 3 jours (transport dans un seul émetteur · `process.exit` dans 2 cœurs · `console.log` dans guard-core) = **3 CASES de ce tableau**, pas 3 découvertes. On ne rattrape plus les fautes une par une : on déclare ce que chaque couche a le DROIT de faire. Ce qu'un programme peut faire est une liste **FINIE** — même logique que la base booléenne OU/ET/NON du matching.
⚠️ **NOYAU PUR = DÉRIVÉ de `stryker.conf.json` → `mutate`**, jamais recopié (il déclare déjà « TOUS les modules PURS »). Ajouter un module pur à Stryker le protège ici d'office. Une 2ᵉ liste divergerait — le couplage implicite qu'on combat.
⚠️ **LES IMPORTS NE SONT PAS ICI** : `fs`/`path`/`child_process`/modules de harnais = `dependency-cruiser`, déjà en place. Ne JAMAIS les dupliquer ici (deux outils pour un invariant = divergence). Ce gate ne couvre QUE ce qu'un graphe de dépendances ne voit pas : les GLOBALS.
⚠️ **AST, JAMAIS REGEX** (`ast-grep`) : un `process.exit` cité en commentaire ou en chaîne est un faux positif. Le 1er jet était une regex avec dé-commentarisation maison — interdit par la doctrine du parc, remplacé. Doc officielle : `files`/`ignores` (Array<Glob>) + `severity` ∈ hint|info|warning|error|off. ⚠️ `ast-grep.github.io` **REDIRIGE en 301** vers `astgrep.com` (vérifié 06/08/2026) — l'ancienne URL traîne dans tous les tutos.
⚠️ **Outils ÉCARTÉS, mesuré 06/08/2026** : `eslint-plugin-boundaries` et `Sheriff` font des frontières de MODULES — donc rien de plus que dependency-cruiser ici, au prix d'ESLint en dépendance neuve.
⚠️ **CE QU'IL NE FAIT PAS** : trouver un bug de logique, un invariant faux, un mauvais choix produit. C'est le travail des tests et de la mutation. Il ferme UNE classe — celle qui échappe à tout le reste, et qui a mordu 3 fois en 3 jours.
