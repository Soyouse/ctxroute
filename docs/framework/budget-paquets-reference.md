---
inject: never
---
# Transport multi-trames — le protocole, ses sources, ses mesures

Page ON-DEMAND (jamais réinjectée). Les invariants courts vivent dans `budget.md` ; ici le POURQUOI complet, pour qui maintient ou porte le mécanisme. **Objectif : zéro ambiguïté pour l'agent qui arrive après.**

## Le problème, en une phrase

Tout harnais borne la taille d'une injection. Au-delà, il range le contenu dans un fichier et n'en montre qu'un aperçu — **sans prévenir le producteur**. L'agent reçoit une intro en croyant tenir le contrat.

## La règle, en deux lignes (il n'y a pas de troisième cas)

1. **Ça rentre** → on émet tel quel. Aucune enveloppe, aucune boucle, aucun surcoût.
2. **Ça ne rentre pas** → on découpe en morceaux répartis sur N trames.

Tout le reste du module n'est que la mise en œuvre honnête de ces deux lignes.

## Le protocole : on n'a rien inventé

Deux standards résolvent exactement ce problème — un message trop gros pour son canal — et **imposent les mêmes trois informations**.

| Besoin du récepteur | RFC 2046 (`message/partial`) | RFC 6455 (WebSocket) | Chez nous |
|---|---|---|---|
| À qui ça appartient | `id` (quasi world-unique) | la connexion | marqueur commun `###FIN:xxxx###` |
| Où ça va | `number`, **commence à 1** | frames de continuation | `MORCEAU j/m` |
| Quand c'est complet | `total` (obligatoire sur le dernier) | **bit FIN** | le `m` de `j/m` |
| Ordre | strict | strict, **jamais entrelacé** | strict, jamais entrelacé |
| Où couper | **frontières de lignes** | — | frontières de lignes |

⚠️ **Ces trois champs sont un minimum, pas un confort.** En retirer un rend le réassemblage ambigu : sans `id` on ne sait pas ce qui va ensemble, sans `number` on ne sait pas l'ordre, sans `total` on ne sait pas si c'est fini.

## Pourquoi c'est de la segmentation TCP/MSS et NON de la fragmentation IP

[RFC 8900] dit « SHOULD NOT develop new protocols that rely on IP fragmentation ». Ses 9 causes de fragilité sont **toutes des équipements intermédiaires** (NAT, pare-feu sans état, ECMP, collisions d'ID de réassemblage) — il n'y en a **aucun** ici : hook → harnais → contexte. Et sa recommandation de fond, *« push fragmentation responsibilities upward to layers that understand application semantics »*, décrit exactement ce qu'on fait : on découpe en connaissant le contenu, sur des frontières qui ont un sens.

## Pourquoi AUCUNE découverte automatique du plafond (ne pas la reproposer)

[RFC 8899 / PLPMTUD] existe parce que le PMTUD classique dépend d'un **signal de retour** (ICMP) souvent filtré ⇒ **trou noir silencieux**. Le fichier de spill du harnais serait notre ICMP, en pire : **il n'y a aucun canal de retour**, l'unique récepteur est l'agent. La réponse des RFC est donc :

- **plancher conservateur** (`BASE_PLPMTU` → notre `DEFAUT_BUDGET` = 8 000, sous les 10 000 mesurés) ;
- **négociation là où une autorité existe** (l'équivalent du MSS de TCP) ;
- **jamais de sondage à l'aveugle**.

## Le tableau des harnais (doc officielle, relevé du 03/08/2026)

| Harnais | Plafond | Réglable ? | Notre posture |
|---|---|---|---|
| Claude Code | 10 000 caractères par chaîne | ❌ « no setting to configure or disable », + feature-gate DISTANT | **plancher** 8 000 (marge), on ne lit rien |
| Codex | ~2 500 **tokens** (défaut) | ✅ `additionalContextLimit` (`0` = illimité) | **on le DÉCLARE à `0` dans NOTRE câblage** ⇒ zéro fragmentation nécessaire |
| Gemini CLI | non documenté | — | `PreToolUse` **n'a pas le canal** — problème de capacité, pas de taille |

⚠️ **Codex n'est pas une exception, c'est le même principe** : quand le produit expose une autorité déclarée, on la consulte au lieu de deviner. Quand il n'en expose pas (Claude Code), on prend une marge. Deviner un interne non documenté, c'est bâtir sur du sable — il peut changer sans mise à jour.

⚠️ **CORRECTION DU 04/08/2026 — « on LIT le réglage » était FAUX, et le mot comptait.**
Doc officielle (`learn.chatgpt.com/docs/hooks`, lue ce jour) : `additionalContextLimit` se déclare
**PAR HANDLER**, à côté de `command`/`timeout`, dans le fichier de hooks — donc **dans NOTRE propre
câblage**. Il n'y a aucune config amont à lire : on l'**ÉCRIT**. Valeurs : *« Omit
additionalContextLimit to use the default 2500-token threshold »* · *« or 0 to pass the handler's
complete additional context directly to the model »*.
🛑 **Ce n'était donc pas « une doc qui ment » mais une PANNE SILENCIEUSE en prod** : le réglage était
absent du câblage ⇒ défaut 2500 tokens ⇒ tout skill un peu gros (le skill `ctxroute` fait 39 Ko,
~10 000 tokens) était écrit sur disque et remplacé par un APERÇU, sans que le hook en sache rien.
Exactement le défaut qui a motivé les paquets côté Claude Code, resté ouvert côté Codex.
⚠️ Posé le 04/08/2026 sur les **deux émetteurs** (`codex-doc-inject` PreToolUse, `session-inject`
SessionStart) et **scellé par `doctor.js --codex-hooks`** (vérif PAR BLOC : le réglage sur un seul
émetteur laisserait l'autre muet, et un match global le manquerait).

## Si un harnais ABAISSE sa limite demain

1. **Ça ne casse pas en silence** — le sceau annonce le marqueur de fin en tête ; s'il manque à la lecture, l'agent sait qu'il a été tronqué et va lire les fichiers. Le mécanisme ne suppose aucune valeur.
2. **La correction est UN nombre** : `budgetInjection` dans la config (ou le réglage du harnais). Tout se re-découpe automatiquement en morceaux plus petits.
3. **Éventuellement** monter `--paquets N` s'il faut plus de trames.

Aucun code à modifier. C'est ça, résister aux mises à jour.

## Le piège de concurrence (ne JAMAIS le réintroduire)

Les N processus sont **parallèles** et appellent chacun `gate.decide`, qui **écrit l'état**. Le premier consommerait les docs `once` ⇒ les suivants n'auraient plus rien à injecter ⇒ trames vides. D'où le **plan mémoïsé par invocation** sous le lock existant : un seul décide, tous recalculent le même découpage **par déterminisme pur**. C'est le déterminisme qui remplace toute coordination — toute source de non-déterminisme dans `planifierPaquets` (horloge, aléa, lecture d'état) casserait le mécanisme.

⚠️ [RFC 8899] exige la robustesse au **réordonnancement**. Observé en production dès la bascule : le paquet 3 est arrivé **avant** le paquet 1. C'est précisément pour ça que chaque trame est auto-descriptive.

## Bugs RÉELS trouvés pendant la construction (03/08/2026)

- **Contenu évaporé** : trame trop petite pour l'en-tête d'un morceau ⇒ aucun morceau produit ⇒ doc ni livrée ni signalée. Trouvé par MESURE, scellé par property-based + negative-check par sabotage (retirer la garde ⇒ la propriété rougit).
- **Fragmentation sans mémoïsation** : la porte découpait même sans identifiant d'invocation ⇒ docs `once` consommées par la première trame.
- **`argv[i+1]` avec i = −1** : un nombre nu dans la ligne de commande passait pour une déclaration de paquets. Trouvé par mutation.

## Dimensionnement de N

375 docs injectables · médiane 1 548 caractères · capacité utile ≈ 7 660 par trame.
Plus gros contenu du parc : skill `agent-social` **79 516 caractères → 11 trames**. **N = 12 déclaré** dans `settings.json`.
⚠️ Une trame déclarée mais inutile coûte un process. Ne pas gonfler N sans mesure — mais ne pas le rogner non plus : en manquer, c'est ne pas livrer.
