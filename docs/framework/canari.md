---
rules: [{"pattern":"canari.js","scope":["ctxroute"]},{"pattern":"canari-check.js","scope":["ctxroute"]},{"pattern":"canari.test.js","scope":["ctxroute"]},{"pattern":"canari-check.test.js","scope":["ctxroute"]}]
mode: dumb
confirm: true
---
# canari — le SEUL témoin qui regarde l'AUTRE BOUT du tuyau
⚠️ **TOUT LE RESTE SE TESTE SOI-MÊME.** Le doctor spawne NOTRE hook avec NOTRE payload et vérifie NOTRE sortie — aveugle au seul risque restant : que le HARNAIS change d'avis (champs renommés, `additionalContext` plus consommé). Alors les hooks fail-open en silence, le doctor reste VERT, et plus rien n'atteint l'agent. Le canari observe le RÉEL : le transcript écrit par le harnais.
⚠️ **DÉCIDABLE, jamais heuristique** : une injection qui a ATTERRI laisse `[source: …]` dans le transcript. On constate « des appels d'outils ont eu lieu ET zéro injection a atterri ». UNE seule trace suffit à prouver que le canal vit — on ne compare JAMAIS reçu vs attendu (ce serait de l'estimation).
⚠️ **L'ALARME NE PASSE JAMAIS PAR LE TUYAU TESTÉ** : hurler par une injection mourrait avec ce qu'elle signale. Sortie = `state/canari.json` → lu par `statusline.js` (canal hors-bande, motif déjà éprouvé par `mem-health.json`). NE JAMAIS « simplifier » en repassant par additionalContext.
⚠️ **MUET quand tout va bien** (`etiquette()` rend `''`) : une alarme permanente devient un décor qu'on ne lit plus. Ne JAMAIS y ajouter un « ✅ ok ».
⚠️ **LECTURE BORNÉE À 2 Mo depuis la FIN** : un transcript du parc pesait **104 Mo** le 03/08/2026 (524 ms pour le lire, à chaque tour) ; la queue coûte **5 ms** et voit déjà ~109 appels. NE JAMAIS repasser à une lecture intégrale.
⚠️ **SEUIL = 25 appels** : taille d'ÉCHANTILLON, pas un délai (« le temps se déclare » ne s'applique pas). Le baisser fabrique des fausses alertes — et un gate qui crie sur du sain cesse d'être lu.
⚠️ **UserPromptSubmit, jamais PreToolUse** : un spawn node coûte ~330 ms mesurés ; à l'appel d'outil le canari doublerait la facture pour une info qui bouge à l'échelle de la session. **MUET par contrat** (stdout vide, exit 0 TOUJOURS) : un `exit≠0` y BLOQUERAIT le prompt.
⚠️ **Sur erreur : on n'écrit RIEN** (verdict précédent préservé). Écrire « vivant » sans avoir mesuré fabriquerait du vert.
