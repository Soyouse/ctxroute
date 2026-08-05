---
match: ctxroute-reset.js
mode: dumb
---
# ctxroute-reset.js — PreCompact : le SEUL vrai vidage de contexte
⚠️ **LA LISTE DES PRÉFIXES EST EXHAUSTIVE OU ELLE EST FAUSSE.** 5 stores à purger : `doc-seen-` (dédup par doc) · `ctxroute-seen-` (relique legacy) · `turn-count-` (compteur de tours) · `plan-` (plan mémoïsé par invocation) · `reliquat-` (file d'émission). **En oublier un ne casse rien de visible** : ça produit des docs jamais réinjectées après compaction, ou un fragment orphelin — un défaut SILENCIEUX, découvert des sessions plus tard. Tout nouveau store DOIT être ajouté ici dans le MÊME geste.
⚠️ **PURGER LA FILE EST CORRECT, pas une perte** : la compaction vide le contexte réel, donc ce qui attendait d'y arriver n'a plus de destination et les docs seront redécidées à neuf par la cadence. Garder la file livrerait la FIN d'un document dont le DÉBUT a disparu — un fragment illisible.
⚠️ **`plan-` se balaie TOUJOURS par PRÉFIXE**, jamais par chemin exact : sa clé porte un suffixe d'invocation (`--inv-…`) qu'une suppression ciblée ne trouverait jamais.
⚠️ **SCOPE PAR AGENT** : compaction DANS un sous-agent (`agent_id` présent) = purge ciblée de SON scope ; compaction maître = purge par préfixe de session, sous-agents compris. Pire cas fail-open = une réinjection de trop, jamais un état gelé.
⚠️ **FAIL-OPEN TOTAL** (JSON invalide, disque illisible ⇒ exit 0 muet) : ce hook ne doit JAMAIS bloquer une compaction. Un reset raté coûte une doc non réinjectée ; un reset qui plante coûte la session.
