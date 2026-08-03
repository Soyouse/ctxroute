---
rules: [{"pattern":"deps-purete-gate.test.js","scope":["mcp-doc-hooks"]},{"pattern":".dependency-cruiser.json","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
---
# deps-purete-gate — le gate qui vérifie que les gates PEUVENT rougir
⚠️ **BUG RÉEL 03/08/2026** : `lib-pure-must-stay-pure`, le plus ancien gate d'architecture du repo, était **INERTE**. Un `require('fs')` en tête de `lib-pure.js` passait VERT. **Toutes** les règles `*-must-stay-pure` étaient décoratives.
⚠️ **CAUSE (doc OFFICIELLE dependency-cruiser 18.1.0)** : `includeOnly` **filtre AUSSI les dépendances** (« will discard all files not matching the pattern ») ⇒ `fs`/`path`/`child_process` n'entraient JAMAIS dans le graphe, donc aucune règle ne pouvait les voir. Mesure : **41 modules / 99 deps** avant, **47 / 143** après.
⚠️ **NOUVELLE RÈGLE DE PURETÉ ⇒ son module cœur DOIT être dans `includeOnly`**, sinon elle NAÎT inerte. Le volet statique du gate le dérive DES RÈGLES elles-mêmes — jamais d'une liste recopiée.
⚠️ **UN GATE QUI NE PEUT PAS ÉCHOUER CERTIFIE au lieu de protéger** — pire que pas de gate, on cesse de regarder. Ne JAMAIS supprimer ni assouplir ce fichier.
⚠️ **SABOTAGE DE TEST = TOUJOURS SUR COPIE, jamais un fichier réel** : la 1re version modifiait `lib-pure.js` en place et a fait tomber **38 tests** d'autres suites qui l'importaient EN PARALLÈLE. Un test qui casse ses voisins est un test qu'on désactive.
⚠️ **JAMAIS `npx` depuis un dossier temporaire** : sans le `node_modules` du repo il va chercher le paquet SUR LE RÉSEAU — un placeholder anti-dependency-confusion a été ramené (mesuré). Pointer le binaire local `node_modules/dependency-cruiser/bin/dependency-cruise.mjs`.
⚠️ **DOC-FIRST** : ces 3 pièges ont coûté des allers-retours parce que j'ai SONDÉ avant de LIRE. Comportement d'un outil tiers ⇒ sa doc officielle, pour la version INSTALLÉE, d'abord.
