# ctxroute — le savoir livré au geste (injection de contexte déclarative, multi-harnais)

## ⚠️ PROD VIVANTE — NE RIEN CASSER (règle n°1, avant toute autre)
⚠️ **PROJET PUBLIC (open source)** : traiter le repo comme DÉJÀ public, même avant publication. ZÉRO info perso dans les fichiers trackés — jamais de prénom (dire « le mainteneur »), jamais de chemin utilisateur réel (fixtures = `C:/Users/dev/...`), jamais d'IP réelle (utiliser la plage de documentation 203.0.113.x), jamais d'email/secret/nom de client. Les docs perso (`docs/mcp/*.md`, `docs/session/*.md`) restent GITIGNORÉES — seuls les `.md.example` génériques se poussent. Avant publication effective : squasher l'historique (les vieux commits contiennent du perso) ET remplacer `ctxroute-config.json` par un `.example` générique (la config livrée contient les NOMS des skills/projets du mainteneur — données perso ; l'utilisateur crée la sienne, les gates la valident).
⚠️ **`~/.claude/hooks/protect-files.js`, `statusline.js` et les hooks câblés dans `settings.json` sont EN PRODUCTION EN PERMANENCE** : d'AUTRES agents (Claude Code, Codex) tournent en parallèle de toi et s'en servent à chaque appel d'outil. Les modifier casse LEUR travail en cours et brûle les tokens du mainteneur — argent réel.
⚠️ **CE FRAMEWORK EST EN PRODUCTION** (à jour 03/08/2026 — l'ancienne mention « développement pur, rien n'est câblé » était PÉRIMÉE). `settings.json` câble la porte en **12 déclarations** `--paquet k --paquets 12`. Toute modification touche IMMÉDIATEMENT tous les agents en cours. Interdit sans GO : débrancher l'injection, retirer des déclarations de paquets, toucher un fichier vivant de `~/.claude/hooks/`.
⚠️ **La bascule (étape 2) et le retrait (étape 3) exigent un GO EXPLICITE du mainteneur, à un moment où aucun agent ne tourne.** Ne jamais les enchaîner « puisque le différentiel est vert » — vert prouve l'équivalence du match, pas que le moment est bon.
⚠️ **Zéro `taskkill`/`Stop-Process` à filet large sur `node.exe`** : les serveurs MCP et les agents des autres sessions tournent sous node. Ne viser QUE des process dont le parent est mort (orphelins), jamais « tous les node récents » (erreur commise le 15/07/2026).

## MODÈLE MENTAL (le POURQUOI — source unique, ex-PHILOSOPHY.md intégré 18/07/2026)
1. **Ce que c'est** : un **langage déclaratif (DSL) pour programmer des workflows d'injection de contexte TRAÇABLES**. Pas un moteur de plus : un langage. Tu DÉCRIS quand un savoir doit apparaître ; la machine l'injecte, prévisible et explicable.
2. **Primitive unique** : événement DÉCIDABLE → injection. ⚠️ **Les SOURCES du moteur sont exactement les `id` du registre `source-adapters.js` : `file` · `mcp` · `skill` · `tool`** — elles seules passent par matcher + gate + cadence. Étendre = 1 source pure + 1 adaptateur, le noyau ne bouge JAMAIS.
2bis. ⚠️ **`docs/session/` N'EST PAS UNE SOURCE** (corrigé le 04/08/2026 — cette ligne affirmait le contraire et a fait écrire une clé de config INERTE). C'est une voie d'injection à part : `session-inject.js` (SessionStart/PostCompact) livre ces docs UNE FOIS par contexte, sans consulter `gate.decide`. Elles n'ont donc **aucune cadence** — lui en régler une serait accepté et sans effet.
2bis. **AMBITION = STANDARD INDUSTRIEL MULTI-HARNAIS** (décision mainteneur 19/07/2026) : ce framework vise à devenir LE standard d'injection de contexte, agnostique du harnais — comme un langage. Architecture imposée par cette ambition : moteur pur sans AUCUN dialecte (gate CI) + cœurs partagés (porte-core/guard-core) + coquilles minces par harnais (~15 l. d'emit). Nouvel harnais = mesurer son dialecte (doc-first + payload RÉEL capturé, jamais sur parole) → réutiliser les portes telles quelles si identique, sinon coquille — JAMAIS une copie, JAMAIS un if-harnais dans le noyau. Prouvé sur Codex : 3 portes réutilisées à l'octet, 2 coquilles, 0 clone jscpd.
3. **Le matching = une BASE BOOLÉENNE COMPLÈTE (conçue à l'instinct par le mainteneur, prouvée le 18/07/2026)** : `match` = OU (au moins un pattern présent → déclenche) · `scope` = ET (contexte requis présent) · `exclude` = NON (interdit absent). OU+ET+NON = complétude fonctionnelle — N'IMPORTE QUELLE condition de déclenchement est exprimable avec ces 3 opérateurs, comme tout se calcule en binaire. C'est POUR ÇA qu'on n'ajoute JAMAIS d'opérateur de matching : la base est fermée, un 4ᵉ mot serait forcément un synonyme (cf loi anti-synonyme §8, précédent `perimeter`). Chaque opérateur est né d'une douleur réelle : faux positifs→exclude, cloisonnement projet→scope, déclenchement→match.
3bis. **Mur porteur : décidable, JAMAIS heuristique.** On n'injecte que sur des FAITS (outil appelé, fichier touché, périmètre franchi) — jamais deviner l'intention (zéro embedding). « Le binaire suffit » : l'action est un proxy parfait et décidable de l'intention. La contrainte EST la feature (on peut toujours répondre « pourquoi ça s'est injecté ? »).
4. **Pas Turing-complet, VOLONTAIREMENT** : parallèle = SQL/CSS/table de routage, jamais bash. Complet DANS son domaine (toute injection décidable est exprimable — ne JAMAIS livrer un grain de moins), borné (tout reste explicable). Le mur infranchissable = calcul arbitraire/heuristique.
5. **Cadence = UN axe** « réinjecte après N ticks » : dumb=0, smart=N, once=∞ (compaction = seul vrai vidage ; entre deux = DILUTION). `driftUnit` (tool|turn) = l'unité du tick, dégénérée hors de smart. Garde-fou→dumb, savoir de projet→once, smart = milieu à utiliser peu.
5bis. **DOCTRINE AGENT = CONTEXTE (19/07/2026)** : agent maître et CHAQUE sous-agent = agents TOTALEMENT distincts, contextes distincts ⇒ état d'injection (once/smart/turn) DISTINCT par agent. Clé de store = `lib.scopeId(session_id, agent_id)` (source unique ; `agent_id` = champ harnais présent seulement DANS un sous-agent — `session_id`/`transcript_path` sont PARTAGÉS, jamais discriminants). Sans agent_id = clé historique (rétro-compat + Codex, dont le payload n'a pas d'agent_id documenté). Trou fondateur prouvé 19/07 : keyé session seule, les sous-agents ne recevaient JAMAIS les skills (`once` consommé par le maître) — seuls les `dumb` (sans état) passaient, par accident.
6. **Config = ownership** : frontmatter UNIQUEMENT dans ce qu'on maîtrise à 100% (nos docs) ; fichier du HARNAIS (skill, serveur) → registre dans NOTRE JSON. Condition du cross-harnais.
7. **Les 4 AUTORITÉS (partout, sans exception : mode/threshold/driftUnit)** — mis à 4 le 04/08/2026 : ① défaut FRAMEWORK codé en dur (existe même sans JSON) > ② config GLOBALE (JSON) > ③ **`defaults.{source}`** (toutes les docs d'UNE catégorie — `file`/`mcp`/`skill`/`tool`, clés DÉRIVÉES du registre) > ④ ENTRÉE (frontmatter doc / entrée registre) = dernier mot. Fallback TOTAL à chaque étage, POINT UNIQUE de résolution = `gate.js` — une source POSE l'entrée, elle ne résout RIEN (une 2ᵉ résolution diverge en silence : c'est arrivé, `declFor` la portait). ⚠️ Seule asymétrie, VOLONTAIRE : `skill` saute l'étage ② global (défaut framework `once`, les docs `smart`).
8. **Croissance = enrichir le VOCABULAIRE** (primitives composables), jamais du calcul arbitraire.
   ⚠️ **UN CONCEPT = UN MOT, PARTOUT (loi anti-synonyme)** : avant d'ajouter une clé, vérifier si une primitive existante couvre déjà la sémantique — si la nouvelle clé alimente le MÊME chemin de code qu'une clé existante, c'est LA MÊME clé (la réutiliser, jamais la renommer par contexte). Un mot nouveau exige une SÉMANTIQUE nouvelle. Précédent réel : `perimeter` inventé comme synonyme de `match` pour les skills (18/07/2026) → supprimé. Docs, skills, futures sources : le MÊME vocabulaire (`match`/`mcp`/`rules`/`tool`/`scope`/`exclude`/`mode`/`threshold`/`driftUnit`/`note`), sans exception. ⚠️ **`note` (04/08/2026) = commentaire d'AUTEUR, le SEUL champ que le moteur ne lit JAMAIS** : destiné à qui vient MODIFIER l'entrée (« pourquoi ce mode/ce scope »), invisible à l'injection car le frontmatter entier est retiré du corps. 🛑 JAMAIS le pourquoi d'un INVARIANT — celui-là reste dans le corps, sinon la règle dérive. Les 4 DÉCLENCHEURS, sémantiques DISJOINTES jamais fusionnées : `match` = substring CHEMIN · `mcp` = nom exact SERVEUR · `rules` = match par-entrée · `tool` (19/07/2026) = nom EXACT d'un OUTIL NATIF (WebFetch, WebSearch… — l'angle mort des outils sans chemin ni mcp__, comblé ; couvre d'office tout futur outil du harnais : le nommer dans une doc suffit, zéro code).
9. **Honnête** : couvre 100% du décidable-qui-agit ; « retrouver l'inconnu » reste au RAG. But ultime (le mainteneur) : éliminer le toil — apprendre une fois, ne plus JAMAIS réexpliquer. Travail = capex unique, l'actif est éternel.

## POSTURE DE L'AGENT (biais LLM connus SUR CE PROJET — chacun a déjà causé une erreur réelle, corrigée le 18/07/2026)
Tu es un LLM : tes réflexes statistiques tirent vers ce que fait l'industrie. Ce projet est PRÉCISÉMENT ce que l'industrie ne fait pas. Tes biais actifs ici :
1. **Biais « cas d'usage »** : tu penses en features (« injecter des docs sur des fichiers ») ; le mainteneur pense en LANGAGE (n'importe quel événement → n'importe quel savoir). Antidote : à chaque brique, demande-toi « est-ce le cas particulier ou la généralisation ? » — livre TOUJOURS la généralisation (erreur réelle : grain outil MCP oublié sur les skills).
2. **Biais « économie de tokens »** : tu optimises le coût là où le mainteneur optimise la GARANTIE MÉCANIQUE (« la machine tranche, jamais le LLM »). Antidote : jamais un pointeur/un espoir d'obéissance là où une injection directe est possible (erreur réelle : pointeur au lieu du corps du skill).
3. **Biais « nouveau mot »** : tu inventes du vocabulaire qui « sonne mieux » par contexte. Antidote : loi anti-synonyme §8 (erreur réelle : `perimeter` = synonyme de `match`).
4. **Biais MVP** : tu livres le « raisonnable maintenant, complet plus tard ». Ici plus tard = jamais (doctrine patrimoine). Antidote : contrat d'extension ci-dessous, TOUTES les lignes dans le même geste.
5. **Quand le mainteneur te challenge** : NOMME le manque d'abord, argumente ensuite. Défendre le statu quo avant d'avoir reconnu le trou = la conversation qui a produit chacune des erreurs ci-dessus.
Aligné = tu appliques le modèle mental SANS que le mainteneur doive répéter. Chaque répétition de sa part = un échec de cette section.

## CONTRAT D'EXTENSION (invariants de TOUTE nouvelle primitive/source — les 3 erreurs du 18/07 étaient chacune une violation d'une ligne ci-dessous)
1. **Vocabulaire UNIQUE** : réutiliser `match`/`scope`/`exclude`/`mode`/`threshold`/`driftUnit` — jamais un synonyme (loi anti-synonyme, §8 du modèle mental).
2. **TOUS les grains, d'emblée** : une dimension se livre COMPLÈTE (ex. MCP = serveur ET outil ET sous-outil) — livrer un grain de moins = trahir le langage (§4).
3. **Cascade 4 autorités** sur tout réglage (framework en dur > JSON global > `defaults.{source}` > entrée), fallback total à chaque étage — jamais un réglage à moins d'étages. La résoudre AILLEURS que dans `gate.js` = dette immédiate.
4. **Injection MÉCANIQUE du savoir lui-même** (corps lu en direct depuis sa source unique), jamais un pointeur qui espère que l'agent obéisse.
5. **Schéma D'ABORD** (config-gate hurle sinon), puis source PURE + adaptateur (le noyau ne bouge pas), miroirs (mutate/include/mutation.yml/dep-cruiser), re-mutation 100%, doctor probe + negative-check, doc injectable + skill (arbo).
6. **Comportement par défaut = comportement d'AVANT, à l'identique** (parité — les différentiels doivent rester verts sans modification).
7. **UNIVERSALITÉ DES SIGNAUX** : ne fonder le matching QUE sur ce que TOUT harnais expose PAR NÉCESSITÉ (les paramètres d'outils : chemins, commandes, noms d'outils MCP — un agent DOIT les fournir pour agir). JAMAIS sur une métadonnée optionnelle d'un harnais (`cwd`, transcript_path, permission_mode…) : un signal optionnel = un périmètre qui meurt en silence sur le harnais qui ne l'envoie pas. Précédent réel : fix `cwd` tenté puis REJETÉ le 18/07/2026 — le besoin (chemins relatifs) se couvrait en pures DONNÉES (noms de fichiers distinctifs dans le `match`). Réflexe : un trou de matching se règle d'abord en DONNÉES (enrichir le match), le moteur en DERNIER recours.
8. **TEST DU KNOB (quand créer un réglage ?)** : « les données (patterns/scope/exclude) peuvent-elles DÉJÀ exprimer la distinction ? » OUI → rien à ajouter (précédent : cwd = une chaîne de plus dans l'axe « où », distinction fichiers/territoire déjà exprimable par le choix des patterns). NON → un mot de vocabulaire, cascade 4 autorités (précédent : driftUnit — tool vs turn écrasés dans UN compteur, indistinguables par les données). SOLUTION PRÉ-IDENTIFIÉE si un cas réel prouve un jour que les canaux de match (chemins explicites vs cwd) doivent se distinguer : un mot booléen PAR ENTRÉE (ex. matchCwd), même cascade — mesurer le cas réel D'ABORD, jamais préventivement.

## Philosophie
Chaque MCP (Stripe, Odoo, SSH, Infra...) est une frontière à risque au même titre qu'un fichier critique. Le système `.claude/hooks/docs/*.md` documente déjà les fichiers ; `ctxroute` fait pareil pour les serveurs MCP — un invariant/piège livré à l'agent AU moment où il touche le MCP, pas une consigne en prose qu'on espère qu'il se rappelle. Né de l'incident du 15/07/2026 (clic accidentel sur un bouton de paiement Stripe réel — cf `project_mcp_hook_docs_standard` en mémoire).

## Emplacement — dossier autonome, pas dans .claude/hooks
⚠️ Le code vit dans `~/Desktop/ctxroute/` (repo git séparé, poussable sur GitHub sans mélanger le reste du home directory). `settings.json` référence ce dossier par chemin absolu — Claude Code ne se soucie pas de l'emplacement, seuls les chemins internes du framework (relatifs entre eux) doivent rester groupés.

## Arborescence — ON-DEMAND : `Desktop/ctxroute/ARBORESCENCE.md`
⚠️ **1 ligne par fichier, filet d'EXHAUSTIVITÉ** (un fichier hors liste = trou, jamais un jugement d'importance). Sortie du skill le 31/07/2026 : elle pesait 24 625 caractères, soit 48 % du skill, et poussait l'ensemble bien au-delà du budget d'émission — le skill entier était donc ÉVINCÉ de la trame, c'est-à-dire ABSENT de ton contexte. **La LIRE dès que tu touches à la structure du repo** (ajout/suppression/renommage de fichier), et la METTRE À JOUR dans le même geste. Scellée par le volet ② de `couverture-gate.test.js`, qui lit ce fichier ET ce skill. ⚠️ Ne JAMAIS la réintégrer ici.

## Porter le framework sur un NOUVEAU HARNAIS (Codex, Gemini CLI, autre) — contrat STRICT
Le MOTEUR est portable PAR CONSTRUCTION (gate `sources-must-not-know-the-harness` : CI rouge si une source importe un dialecte). Porter = écrire des COQUILLES, jamais toucher le moteur.
1. **INTERDIT ABSOLU** : modifier `sources/`, `gate.js`, `frontmatter.js`, `loader.js`, `lib-pure.js`, `collisions.js` pour un portage. Si tu crois devoir le faire, tu te trompes de couche — STOP.
2. **À écrire, par événement du harnais cible — JAMAIS de copie (prouvé sur Codex 19/07/2026)** : le corps des portes vit dans des CŒURS PARTAGÉS (`porte-core.js` = PreToolUse, `guard-core.js` = PostToolUse) — une coquille = stdin + `emit` du dialecte (~15-50 l.). D'abord VÉRIFIER si la porte existante se câble TELLE QUELLE (dialecte identique — Codex : reset/turn-count/session-inject réutilisés à l'octet) ; sinon coquille `<harnais>-*.js` qui require le cœur. Seule différence permise : le FORMAT stdin/stdout du harnais cible. Capacité absente (ex. « ask » Codex) = DÉGRADATION EXPLICITE commentée dans l'emit, jamais silencieuse. Événement absent = voie sautée, notée dans REFACTOR-PLAN, jamais bricolée.
3. **Toute coquille** : arme `deadline.arm()` avant toute I/O, fail-open intégral (erreur = exit 0 muet), chemins via `paths.js` uniquement, décision via les modules purs uniquement.
4. **Preuves OBLIGATOIRES avant de câbler** (pas d'exception) : suite d'intégration par spawn réel sur corpus tmpdir (modèles : `doc-inject.test.js`, `session-inject.test.js`, `doc-write-guard.test.js`) + extension du doctor (probe de chaque nouvelle porte + check câblage + negative-check dans `doctor.test.js` qui SABOTE une copie et exige le hurlement).
5. Un harnais SANS un événement (ex. pas de SessionStart) = on saute CETTE voie, on le note dans REFACTOR-PLAN — jamais de contournement bricolé.
6. Fini = `npm test` vert + mutation verte + doctor vert sur le câblage réel + REFACTOR-PLAN/skill mis à jour. Un portage sans ces 4 preuves N'EST PAS fini.

## TRANSPORT MULTI-TRAMES — le framework LIVRE TOUT (03/08/2026, LIVE en prod)

**LA RÈGLE, DEUX CHEMINS ET PAS TROIS** — c'est tout le mécanisme :
1. **ça rentre dans la trame** ⇒ on émet tel quel (zéro enveloppe, zéro boucle, coût nul) ;
2. **ça ne rentre pas** ⇒ on **découpe en morceaux** répartis sur N trames.

⚠️ **Il n'existe AUCUN cas où le framework refuse de livrer.** L'indélivrabilité est impossible par construction : une doc de n'importe quelle taille arrive — 10 Ko, 80 Ko, peu importe. **NE JAMAIS réintroduire un plafond de taille, un « trop gros », un « scinde ta doc ».** Ce serait faire porter à l'AUTEUR d'une doc un défaut du TRANSPORT. Le framework livre, il ne juge pas ce qu'on lui confie. C'est pour ça que le volet ④ du `couverture-gate` (plafond de longueur) a été SUPPRIMÉ, et que la règle « <10 lignes » n'est qu'une convention de parc — jamais une contrainte du moteur.

**POURQUOI ON A FAIT ÇA.** Le harnais borne la taille d'une injection ; au-delà il range le contenu dans un fichier et n'en montre qu'un aperçu, **sans prévenir le producteur**. Résultat vécu : des docs annoncées « non injectées » à chaque tour, et des skills jamais livrés. Une doc qui n'arrive pas est un invariant qui ne protège personne.

**LE PROTOCOLE — repris de l'existant, rien d'inventé.** Deux standards résolvent exactement ce problème (un message trop gros pour son canal) et imposent les MÊMES trois informations :
| Ce dont le récepteur a besoin | RFC 2046 `message/partial` | RFC 6455 WebSocket | Chez nous |
|---|---|---|---|
| à qui ça appartient | `id` | la connexion | marqueur commun `###FIN:xxxx###` |
| où ça va | `number`, **commence à 1** | frames de continuation | `MORCEAU j/m` |
| quand c'est complet | `total` | **bit FIN** | le `m` de `j/m` |
Plus : coupe sur **frontières de lignes** (RFC 2046) et **ordre strict, jamais entrelacé** (RFC 6455). ⚠️ En retirer UN SEUL rend le réassemblage ambigu — chacun supprime une garantie.

⚠️ **C'est de la segmentation TCP/MSS, PAS de la fragmentation IP.** RFC 8900 déconseille la fragmentation IP, mais ses 9 causes de fragilité sont TOUTES des équipements intermédiaires (NAT, pare-feu, ECMP) — il n'y en a aucun ici. Sa recommandation de fond (« découper à la couche qui comprend la sémantique ») décrit exactement ce qu'on fait.

⚠️ **AUCUNE découverte automatique du plafond** (RFC 8899/PLPMTUD) : la détection classique dépend d'un signal de retour, et ici **il n'y en a aucun** — l'unique récepteur est l'agent. Un mécanisme fondé sur un signal absent tombe en trou noir SILENCIEUX. À la place : **plancher conservateur + négociation quand une autorité existe**.

**LES DEUX POSTURES, selon ce que le harnais expose** — même principe, pas une exception :
- **Claude Code** : plafond interne NON documenté + feature-gate DISTANT ⇒ on ne lit rien, on prend une **marge** (défaut 8 000 sous les 10 000 mesurés).
- **Codex** : `additionalContextLimit` est **documenté et réglé par l'utilisateur** ⇒ on le **LIT**. C'est l'autorité déclarée, pas un interne deviné.
- **Gemini** : `PreToolUse` n'expose PAS le canal — trou de capacité, pas de taille ; aucune fragmentation n'y remédie.

⚠️ **SI UN HARNAIS ABAISSE SA LIMITE** : ça ne casse pas en silence (le sceau annonce le marqueur de fin ; s'il manque, l'agent SAIT qu'il a été tronqué). La correction est **UN nombre de config** (`budgetInjection`), zéro ligne de code — tout se re-découpe. C'est ça, résister aux mises à jour.

⚠️ **PIÈGE DE CONCURRENCE, ne jamais le réintroduire** : les N processus sont PARALLÈLES et appellent chacun `gate.decide`, qui ÉCRIT l'état ⇒ le premier consommerait les `once` et les trames suivantes seraient VIDES. D'où le **plan mémoïsé par invocation** : un seul décide, tous recalculent le même découpage **par déterminisme pur**. Aucune coordination, aucun verrou neuf — c'est le déterminisme qui remplace l'autorité. Toute source de non-déterminisme dans `planifierPaquets` (horloge, aléa, lecture d'état) casserait tout.

⚠️ **Un reliquat ne veut PAS dire « trop gros »** — tout est morcelable. Il signifie **`--paquets N` trop petit** : erreur de configuration, et le message porte sa solution. Câblage actuel : **N = 12** (plus gros contenu du parc : 79 516 c ⇒ 11 trames).

⚠️ **RIEN N'EST JAMAIS « TROP PETIT » NON PLUS** (03/08/2026). Un contenu de 2 caractères sort tel quel par le chemin 1 — il n'existe aucun plancher. Et quand le budget est si petit qu'il ne porte même pas le sceau (`capacitePaquet` ≤ 0), **c'est l'ENVELOPPE qui cède, jamais le contenu** : on descelle et on livre (le marqueur rendu est alors vide — ne JAMAIS annoncer un sceau absent du texte). Bug RÉEL corrigé ce jour-là : avant, ce cas sortait ZÉRO doc **et** accusait `--paquets N`, c'est-à-dire une indélivrabilité doublée d'un message faux. **Livrer passe avant sceller, toujours.**

⚠️ **COÛT MESURÉ, à ne pas se tromper de cible** : 12 processus `node` qui ne font RIEN coûtent ~4 s sur le poste de mesure ; la porte complète ~4,2 s. **Le framework pèse 4 % — les 96 % restants sont le démarrage de node.** Optimiser la collecte (mémoïser plus tôt, sauter le corpus) est une FAUSSE piste, mesurée et écartée le 03/08/2026. Le seul levier réel sur le coût est **N**, et le baisser plafonnerait ce qu'on peut livrer. Ne pas rouvrir sans nouvelle mesure.

Détail complet, sources datées et mesures : `budget-paquets-reference.md` (on-demand).

## CANARI — le seul témoin qui regarde l'AUTRE BOUT du tuyau (03/08/2026, LIVE)

⚠️ **TOUT LE RESTE DU FRAMEWORK SE TESTE LUI-MÊME.** Le doctor spawne NOTRE hook avec NOTRE payload et vérifie NOTRE sortie. C'est nécessaire — et parfaitement aveugle au seul risque qui reste : **que le HARNAIS change d'avis** (champs renommés, `additionalContext` plus consommé). Alors les hooks fail-open en silence, le doctor reste VERT, et plus rien n'atteint l'agent. Aucun test ne peut voir ça : on se testerait soi-même.

**Ce que couvre déjà le reste, ne pas le refaire** : limite abaissée → le SCEAU la rend bruyante · paquet perdu → le NUMÉRO manquant · notre code cassé → le DOCTOR.

**Le canari** (`canari.js` PUR + `canari-check.js` coquille, UserPromptSubmit) lit le TRANSCRIPT réel du harnais et tranche `vivant`/`mort`/`indecidable`. ⚠️ **DÉCIDABLE** : une injection qui a ATTERRI laisse `[source: …]` ; UNE seule trace prouve que le canal vit. On ne compare JAMAIS reçu vs attendu.

⚠️ **L'ALARME NE PASSE JAMAIS PAR LE TUYAU TESTÉ** — hurler par une injection mourrait avec ce qu'elle signale. Sortie = `state/canari.json`, lu par un afficheur HORS framework (chez le mainteneur : la statusline). **Le framework ne fournit ni ne dépend d'aucun afficheur** — il publie un verdict, point. C'est ce qui le garde installable tel quel par n'importe qui.

⚠️ **MUET quand tout va bien** : une alarme permanente devient un décor. **Lecture bornée à 2 Mo depuis la fin** (transcript réel du parc mesuré à **104 Mo** : 524 ms l'intégrale, 5 ms la queue). **Seuil 25 appels** = taille d'ÉCHANTILLON, pas un délai.

⚠️ **Le dialecte du harnais vit dans la COQUILLE** (`MARQUE_APPEL_CLAUDE`), jamais dans `canari.js` — porter le canari = changer cette ligne, rien d'autre. Même contrat que `porte-core` ⟷ `doc-inject`/`codex-doc-inject`.

⚠️ **JAMAIS ENCORE DÉCLENCHÉ EN RÉEL** (par construction : il ne tire que si le canal meurt). Sa preuve est en laboratoire — spawn réel sur transcript fabriqué.

## LES GATES DE PURETÉ ÉTAIENT INERTES (bug RÉEL, 03/08/2026)

⚠️ `lib-pure-must-stay-pure` — le plus ancien gate d'architecture du repo, documenté partout comme LA garantie — **ne pouvait pas rougir**. Un `require('fs')` en tête de `lib-pure.js` passait VERT. **Toutes** les règles `*-must-stay-pure` étaient décoratives.
**Cause (doc officielle dependency-cruiser 18.1.0)** : `includeOnly` **filtre AUSSI les dépendances** ⇒ `fs`/`path`/`child_process` n'entraient jamais dans le graphe. Mesure : 41 modules/99 deps avant, **47/143** après avoir laissé entrer les modules cœur.
⚠️ **Scellé par `deps-purete-gate.test.js`** (statique DÉRIVÉ des règles + sabotage réel SUR COPIE). **Nouvelle règle de pureté ⇒ son module cœur DOIT être dans `includeOnly`**, sinon elle naît inerte.
⚠️ **Un sabotage de test ne touche JAMAIS un fichier réel** : la 1re version a fait tomber 38 tests d'autres suites qui importaient `lib-pure.js` EN PARALLÈLE. Et **jamais `npx` depuis un tmpdir** — il va chercher le paquet sur le RÉSEAU (placeholder anti-dependency-confusion ramené, mesuré) : pointer le binaire local.

## Ajouter un MCP au standard
1. Créer `Desktop/ctxroute/docs/mcp/{server}.md`. ⚠️ **Le framework n'impose NI taille NI format** : il DOIT livrer une doc de n'importe quelle taille — si elle ne passe pas, le défaut est dans le TRANSPORT, jamais dans la doc. « <10 lignes, 1 ligne = 1 invariant/piège, ton impératif » est la convention D'USAGE de ce parc (anti-dilution) — la suivre ici, ne JAMAIS la présenter comme une règle du moteur ni la faire appliquer par un gate du framework.
2. C'est tout. Aucun code à écrire — le hook générique lit tous les `.md` du dossier à la volée.
3. Par défaut : documenter dès qu'un MCP a un invariant/piège/contexte à transmettre (presque toujours) — pas seulement après un incident.

## Déclencher sur un GESTE (une commande), pas sur un LIEU — recette, prouvée 31/07/2026
Le cas d'usage FONDATEUR du framework est une ACTION (un clic de paiement), mais le vocabulaire
n'expose que des LIEUX. La recette n'était écrite nulle part et a coûté une session entière :
```yaml
tool: ["*"]                                  # QUI agit — `*` = N'IMPORTE QUEL outil (joker)
scope: ["docker run", "systemctl enable"]    # CE QU'IL FAIT (scope voit TOUS les params)
```
(énumérer reste possible : `tool: ["Bash", "PowerShell", "mcp__ssh__ssh_exec"]` — mais le jour où
un shell/MCP s'ajoute, l'énumération devient MUETTE en silence. Préférer le joker pour un GESTE.)
- ⚠️ **`match` NE SERT À RIEN ICI** : il ne regarde que les CHEMINS (+ la commande du shell POSIX).
  Il ne verra jamais un `docker run` lancé par un autre shell ni par un outil MCP.
- ⚠️ **`scope` est le seul opérateur qui voit TOUS les paramètres** — c'est lui qui filtre le geste ;
  mais il ne déclenche jamais seul, d'où le `tool:` qui lui ouvre la porte.
- ⚠️ **JOKER `*` LIVRÉ le 31/07/2026** : `tool: ["*"]` matche n'importe quel outil (y compris ceux
  qui n'existent pas encore) ; `*` + `exclude` = « tous SAUF X ». **Joker SANS `scope` ni `exclude`
  = ROUGE** (il s'injecterait à chaque appel d'outil ; une doc vraiment universelle → `docs/session/`).
- ⚠️ **VÉRIFIER : `node explain.js --doc <nom> --tool X --input '{...}'`** — il rend le motif exact,
  y compris le « pourquoi PAS ». **NE JAMAIS écrire un harnais Node maison pour sonder le moteur** :
  mesuré le 31/07, ça a coûté une session (3 sondes fausses, chacune rendant un « muet » pris pour
  un verdict SUR LE MOTEUR, d'où une conclusion FAUSSE « il faut modifier le moteur »). L'outil
  consomme les vraies sources : il ne peut pas se tromper de format.

## Configurer `ctxroute-config.json`
```json
{
  "enabled": true,
  "showNotification": true,
  "mode": "smart",
  "defaultThreshold": 4,
  "filterMode": "none",
  "filterList": [],
  "servers": {
    "odoo": { "subToolParam": "args.tool" }
  }
}
```
- **`enabled`** (défaut `true`) : interrupteur GLOBAL du framework — `false` coupe TOUT (injection ET tracking d'état). ⚠️ DISTINCT de `showNotification` (ne pas confondre : celui-ci coupe le fonctionnement réel, l'autre coupe juste un message visuel).
- **`showNotification`** (défaut `true`) : contrôle UNIQUEMENT le badge visible `📄 [ctxroute] ...` — `false` masque le badge mais l'injection réelle dans le contexte de l'agent continue normalement. Sert à l'utilisateur qui veut le bénéfice sans le bruit visuel.
- **`mode`** :
  - `"dumb"` — réinjecte à CHAQUE appel du serveur. Jamais le défaut (bruit maximal), utile seulement en debug du hook lui-même.
  - `"once"` — injecte au 1er appel du serveur dans la session, plus jamais (sauf compaction). Zéro bruit, mais peut rester silencieux longtemps si le contexte dérive sans compacter.
  - `"smart"` (défaut recommandé) — comme `once`, MAIS réinjecte aussi si ≥ N appels D'AUTRES outils se sont écoulés depuis le dernier appel à CE serveur précis. Le compteur d'un serveur repart à 0 à chaque fois qu'il est rappelé (injecté ou non).
- **`defaultThreshold`** : le N par défaut (nombre d'appels d'autres outils avant réinjection en mode smart).
- **Cadence PAR DOC = frontmatter de la doc, JAMAIS le JSON** (décision 17/07/2026, zéro doublon) : `docs/mcp/stripe.md` ouvre par `---
mode: dumb
---` (ou `threshold: 2`). Précédence : frontmatter > global. Clés admises dans une doc MCP : `mode`/`threshold` seulement (gate dans config-gate.test.js).
- **`servers.{name}`** : réglages STRUCTURELS uniquement (`subToolParam`) — le schéma REJETTE mode/threshold ici.
- **`filterMode`** (`"none"` défaut / `"whitelist"` / `"blacklist"`) + **`filterList`** (array de noms de serveur) : contrôle QUELS serveurs sont couverts par le framework du tout.
  - `"whitelist"` : SEULS les serveurs de `filterList` sont couverts (utile pour ne documenter que les MCP à risque, ex. `["stripe", "odoo"]`).
  - `"blacklist"` : TOUS les serveurs SAUF ceux de `filterList` (utile pour exclure un MCP bruyant/sans enjeu, ex. `["umami"]`).
  - ⚠️ Un serveur exclu par le filtre fait quand même avancer le compteur des AUTRES serveurs actifs — l'exclusion désactive SA propre injection/état, pas la réalité qu'un outil a été appelé.

## Granularité 3 niveaux (docs CONCATÉNÉES, global → spécifique)
1. `docs/mcp/{server}.md` — serveur entier.
2. `docs/mcp/{server}/{tool}.md` — outil précis (`{tool}` = suffixe après `mcp__{server}__`).
3. `docs/mcp/{server}/{subTool}.md` — pour un MCP proxy à outil UNIQUE où l'opération réelle est un paramètre (ex. Odoo : `tool_name` toujours `odoo_call`, la vraie opération vit dans `tool_input.args.tool`). Activé via `servers.{server}.subToolParam: "args.tool"` — sans ce réglage, niveau 3 inactif (zéro faux positif).
Exemple : `servers.odoo.subToolParam = "args.tool"` + `docs/mcp/odoo/delete_record.md` → injecté UNIQUEMENT sur un `delete_record` réel, en plus de `odoo.md` global.

## Invariants du mécanisme (LES doctrines — toutes écrites ici, aucune implicite)
- **0-HUMAN partout** : la machine tranche le DÉCIDABLE (gates fail-closed, block temps réel), un AGENT tranche l'HEURISTIQUE (check-collisions on-demand), l'humain JAMAIS dans la boucle.
- **Décidable vs heuristique, jamais mélangés** : prouvable (doc cassée, dérive, moteur mort) = signal AUTOMATIQUE (garde temps réel → lint session → CI push, defense-in-depth étagée) ; heuristique (croisements) = JAMAIS auto-injecté, uniquement sur demande explicite d'un agent — un avertissement récurrent sur du sain = canal mort (leçon rush mode).
- **L'INJECTION informe, ne bloque jamais** (deny/ask sécurité hors moteur, décision 17/07). SEULE exception : `doc-write-guard` (PostToolUse) bloque sur doc INVALIDE — c'est un correcteur d'écriture, pas un bloqueur d'action ; le `ask` de confirm reste le seul ask légal de la porte.
- **Une vérité, un emplacement** : la doc porte son savoir ET sa cadence (frontmatter) ; le JSON = global/utilisateur uniquement ; jamais deux emplacements pour une même vérité (gates anti-doublon).
- **Frontmatter UNIQUEMENT dans ce qu'on maîtrise à 100% (18/07/2026)** : le critère = « est-ce NOTRE framework qui définit ET valide le format du fichier ? ». Nos docs (`docs/*.md`) = oui → cadence en frontmatter. Un fichier du HARNAIS (skill `.claude/commands/*.md`, serveur MCP) = NON (leur schéma, une update peut nettoyer nos clés en silence) → config dans NOTRE JSON global, référence par nom. Portabilité cross-harnais = ne JAMAIS mettre sa config dans le fichier d'un tiers. Registre uniforme (skills, servers) = JSON central même quand on maîtrise (table de routage, pas frontmatter éparpillé).
- **Skill par périmètre = 4ᵉ déclencheur (`config.skills`)** : un skill (savoir de projet) s'auto-injecte EN ENTIER (corps lu en direct depuis ~/.claude/commands/, jamais copié — source unique) quand l'agent entre dans son périmètre — fichier (`match`/`scope`/`exclude` OU `rules` par-entrée — MÊME vocabulaire que les docs, y compris la forme par-ligne depuis 19/07) OU MCP (`servers`, 3 grains : srv · srv/outil · srv/sous-outil), 2 dimensions RÉUTILISÉES en union. Fallback pointeur seulement si fichier illisible. Scellé par `skill-registry-gate` (nom = fichier existant).
- **L'emplacement du fichier = son déclencheur** : frontmatter `rules:` (fichier) · chemin `docs/mcp/` (serveur) · dossier `docs/session/` (chaque session + post-compaction).
- Reset PreCompact = ABSOLU, indépendant du mode — la compaction vide le contexte réel, le store repart de zéro.
- Un serveur MCP sans `docs/mcp/{server}.md` ne déclenche rien (pas d'erreur, pas de bruit).
- **Hooks fail-open, diagnostics qui hurlent** — rôles opposés, jamais fusionnés (doctor/lint = exit≠0 bruyant ; portes/garde = exit 0 muet sur panne).
- **Moteur figé, sources qui s'empilent** : toute extension = module pur + adaptateur/coquille, jamais une modif du noyau (cf §Porter sur un nouveau harnais).

## Qualité — gates (`npm run check:all` avant tout commit substantiel)
- **Tests** : `npm test` = `vitest run` (toutes suites sauf lourdes — le runner est la SEULE source du compte) · `test:watch` (boucle dev) · `test:fast` (suites sans spawn, ~4 s) · suites lourdes via `test:parc`/`test:differential`/`test:deadline` (config heavy). STACK = vitest UNIQUEMENT (node:test banni 16/07/2026).
- **Mutation Stryker** : `npm run test:mutation`, runner vitest perTest (~30 s local contre 12 min avant), mute tous les modules purs (I/O jamais muté — doctrine "isoler la décision avant de muter"). Break 99%, cliquet jamais baissé (ne PAS le monter au score exact — marge délibérée). **Score 100,00%, 0 survivant** (16/07/2026 : 2 tués par test ciblé, 2 équivalents prouvés = `// Stryker disable` justifiés dans sources/file.js). ⚠️ perTest : fixtures = thunks évalués DANS le test, jamais des const de niveau module (mutant statique = faux survivant, mesuré 16/07 : 42 faux, score 76,67%).
- **Couplage** : `npm run check:coupling` = `dependency-cruiser` (lib-pure ne doit JAMAIS importer fs/path/child_process) + `jscpd` (0 duplication tolérée au-delà de 1%).
- **Concurrence** : accès à `state/*.json` protégés par lock cross-process (`lock.js`) — Claude Code peut lancer des appels d'outils indépendants EN PARALLÈLE, un state partagé sans lock = race condition réelle, pas théorique.

## MCP déjà documentés
- `stripe.md` — ne jamais cliquer un bouton de paiement/lien réel envoyé à un client (irréversible, notifie immédiatement).
- `odoo.md` — pas de `payment.token` stocké dans cette instance ; anomalies connues de dates de facture générées en avance.

## ✅ FUSION TERMINÉE (17/07/2026) — architecture cible ATTEINTE
**Hook UNIQUE `doc-inject.js` (matcher `*`) LIVE en prod** : sources/file.js (frontmatters) + sources/mcp.js (docs/mcp/) → gate.js (dédup par DOC, threshold par doc). `legacy-mcp-inject.js` RETIRÉ du câblage (gardé comme oracle du différentiel + rollback — le doctor exige son ABSENCE, sinon double injection). Deny/ask sécurité RETIRÉS (décision mainteneur 17/07, réintroduction possible en hook séparé). Preuves : suite vitest complète (le runner est la seule source du compte), mutation 100% (0 survivant), mcp-differential 9/9, porte-differential octet, doctor vert sur câblage réel.
✅ **DOUBLE ÉCRITURE MORTE (27/07/2026)** — ⚠️ **RAISON EXACTE, à ne pas déformer : `protected-paths.json` était la vérité de l'ANCIEN moteur (`protect-files.js`), remplacé par la porte unique le 17/07. Le JSON ne servait plus qu'à un rollback vers un moteur mort.** Ce n'est PAS un retrait de Codex : **le framework reste pleinement compatible Codex**, ses coquilles (`codex-doc-inject`, `codex-doc-write-guard`) tournent déjà sur le NOUVEAU moteur, donc sur les frontmatters. Rien n'est fermé de ce côté et le portage multi-harnais reste l'ambition (§2bis).
Concrètement : les frontmatters sont la SEULE source de règles, **`lint-corpus` COMPRIS** (il lisait encore le JSON — le laisser aurait ressuscité la double écriture par la bande, un gate en réclamant une entrée à chaque nouvelle doc). `source-drift-gate` et `loader-differential` SUPPRIMÉS : ils n'existaient que pour exiger la parité entre 2 sources dont une est morte. `protected-paths.json` = artefact INERTE, plus aucun lecteur — **NE PLUS JAMAIS y écrire ni le maintenir**. La classe « règle fantôme » est **ÉTEINTE PAR CONSTRUCTION** (un déclencheur vit DANS sa doc : supprimer la doc supprime la règle) — `lint-corpus.test.js` cas 5 le prouve et rougira si une source de règles EXTERNE est réintroduite.
Plan/historique : `Desktop/ctxroute/REFACTOR-PLAN.md`. Doctrine du patrimoine (CLAUDE.md) : plus AUCUN chantier ouvert — scaler = déposer des `.md`, le moteur ne bouge plus.

## Pour aller plus loin
Étendre à SSH, Infra, autres MCP agence au fil des pièges découverts — même réflexe "par défaut : documenter" que la doc fichier (cf règle Documentation du CLAUDE.md global).
