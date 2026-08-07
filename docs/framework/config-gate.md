---
rules: [{"pattern":"ctxroute-config.json","scope":["ctxroute"],"rank":359},{"pattern":"config-gate.test.js","scope":["ctxroute"],"rank":360},{"pattern":"legacy-mcp-inject.test.js","scope":["ctxroute"],"rank":361},{"pattern":"ctxroute-config.schema.json","rank":567}]
mode: dumb
rank: 359
---
# ctxroute-config.json / config-gate.test.js — invariants

⚠️ BUG RÉEL (15/07/2026, présent depuis le 1er commit) : la config committée contenait des résidus de FIXTURE de test (`filterMode:"whitelist"`, `filterList:["testserver999"]`) → framework tournant mais n'injectant RIEN pour stripe/odoo, EN SILENCE, pendant des jours. Cause : les tests d'intégration écrivaient dans le VRAI fichier et "restauraient l'original" — lequel était déjà pollué.
NE JAMAIS faire écrire un test dans `ctxroute-config.json` : les tests passent `CTXROUTE_CONFIG_PATH` (tmpdir jetable). Cette env var est RÉSERVÉE aux tests.
NE JAMAIS supprimer/assouplir `config-gate.test.js` — c'est le dead-man switch : tout serveur ayant un `docs/mcp/{server}.md` DOIT être couvert par la config livrée. Un hook qui n'injecte jamais est indiscernable d'un hook absent.
Config livrée : `enabled` non-false, `mode` global jamais `"dumb"` (fixture de debug ; une DOC en dumb reste légitime — via SON frontmatter, ex. stripe.md).
⚠️ `servers` = subToolParam SEULEMENT (jamais de cadence par serveur). La cadence PAR DOC vit dans son frontmatter ; la cadence PAR CATÉGORIE dans `defaults.{file|mcp|skill|tool}` (04/08/2026) — clés DÉRIVÉES des `id` d'ADAPTERS, negative-check dans les 2 sens. Clés admises d'une doc MCP : `mode`/`threshold`/`driftUnit`/`note`/`enforce`.
⚠️ **`enforce` (05/08/2026)** : booleen admis dans `defaults.{source}` ET dans une entree `skills`. **AUCUN etage global** (volontaire : un blocage global refuserait le 1er geste de chaque session). Le poser sur une categorie ENTIERE est DECONSEILLE.
⚠️ **`paquets` (07/08/2026) = la BANDE PASSANTE d'un geste, défaut 12.** Capacité = `paquets × (budgetInjection − enveloppe)` — mesuré : 12 × 7 661 = **91 932 c**. 🛑 **NE PILOTE RIEN AU RUNTIME** : le harnais lance exactement les processus déclarés dans SON câblage (`settings.json`), à froid. Cette clé est la SOURCE DE VÉRITÉ que `doctor.js --settings` CONFRONTE au câblage réel — deux endroits pour un chiffre divergent en silence. ⚠️ L'augmenter se paie : un processus par trame à CHAQUE appel d'outil, même vide (~330 ms). ⚠️ **Gitignoré ⇒ tout test qui lit ce fichier CASSE la CI** (clone vierge) : passer par `CTXROUTE_CONFIG_PATH`, ou `skipIf` — payé le 07/08, 3 rouges sur ubuntu.
`ctxroute-config.schema.json` (16/07/2026) = vocabulaire FERMÉ de la config (enums, clés strictes). Drift-test dans config-gate.test.js : clé de config hors schéma = ROUGE. Nouvelle clé de config ⇒ l'ajouter au schéma D'ABORD, sinon le gate hurle — c'est voulu.
