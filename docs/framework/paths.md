---
match: paths.js
scope: [ctxroute]
exclude: [protected-paths.json]
mode: dumb
confirm: true
rank: 355
---
# paths.js — source unique des chemins

⚠️ TOUT chemin runtime (config/docs/state) est déclaré ICI, une seule fois. NE JAMAIS refaire un `path.join(__dirname,'state')` ad-hoc dans un hook : `stateDir` était dupliqué à l'identique dans inject.js ET reset.js — deux copies d'une même vérité qui divergent en silence (le reset viserait un autre dossier, sans erreur visible).
Résolution PARESSEUSE obligatoire (`paths.stateDir()` à l'appel, jamais figé en const au chargement) — sinon les env vars posées par le parent au spawn sont ignorées.
Les 3 env vars (`CTXROUTE_CONFIG_PATH`/`DOCS_DIR`/`STATE_DIR`) sont RÉSERVÉES aux tests et à doctor.js — jamais un réglage utilisateur (ça, c'est `ctxroute-config.json`).
⚠️ `config-gate.test.js` NE passe PAS par ce module (chemins en dur voulus) : il valide le fichier LIVRÉ, donc doit rester aveugle aux surcharges d'env.
NE JAMAIS importer paths.js depuis lib-pure.js (il lit process.env → casserait la pureté ; `.dependency-cruiser.json` le bloque).
