# Plan de refactor — fusion en moteur d'injection unique

> Statut : ✅ **TERMINÉ (17/07/2026)** — architecture cible ATTEINTE. Hook UNIQUE
> `doc-inject.js` (matcher `*`) live en prod : sources/file.js + sources/mcp.js →
> gate.js (dédup par DOC). `mcp-doc-inject.js` retiré du câblage (gardé comme
> oracle du différentiel + rollback). Doctrine du patrimoine (CLAUDE.md) :
> plus AUCUN chantier ouvert sur ce framework — scaler = ajouter des docs .md.

## ✅ TRAITÉS LE 31/07/2026 (branche `chantier-explain` — ✅ BASCULÉE dans `master`, vérifié 03/08/2026)

> ⚠️ Fait dans un **worktree isolé** — le dossier live est resté sur `master` tout
> du long : d'autres agents utilisaient le framework pendant ce chantier.
> Bascule = `git merge --ff-only` (fenêtre ~50 ms, fail-open, aucun état touché).
> ⚠️ La doc injectable (`sources.md`, nouvelle `explain.md`) et son miroir
> `docs/framework/` se posent DANS LE MÊME GESTE que la bascule : les écrire
> avant décrirait un moteur qui n'est pas encore en prod (et `parc-sync-gate`
> rougirait, à raison).

- **§E — `explain` LIVRÉ.** `collect-core.js` (collecte = source unique porte↔explain)
  + `explain.js` (verdict via `gate.decide` + le « pourquoi PAS » par PROBES qui
  ré-interrogent les vraies sources, jamais une 2ᵉ logique). 14 tests par spawn réel.
  Motifs distingués : frontmatter invalide · `inject: never` · corps vide · déclencheur
  inerte · outil non visé · scope · exclude · pattern absent (avec les contextes
  RÉELLEMENT confrontés) · **commande git ignorée par construction** — ce dernier
  n'était documenté nulle part et se lit comme une règle cassée.
- **§A — FAUX VERT TUÉ.** `mcp` retiré de `DECLENCHEURS` + message qui dit OÙ aller.
  Mesuré avant de toucher : **0 doc du parc (344) ne portait `mcp:`** ⇒ rien d'existant
  invalidé. Tombe aux 3 étages sans les modifier (garde d'écriture, lint, gate de push)
  puisque tous délèguent à `validate()`. Scellé par `triggers-gate.test.js`, qui APPELLE
  les sources au lieu de lire une liste. ⚠️ 3 suites certifiaient le faux vert lui-même :
  réécrites.
- **§B + §B0 — JOKER `tool: ["*"]`, traités ENSEMBLE** (le joker seul aurait laissé
  l'autre moitié inexprimable). Mesuré dans le code : `exclude` visait DÉJÀ le nom
  d'outil, il était juste inutilisable sans joker ⇒ `*` + `exclude` = « tous SAUF X ».
  **Zéro mot ajouté** (valeur spéciale, pas opérateur). Joker NU = ROUGE. Cas négatif
  (outil vide) scellé. Prouvé par spawn sur 4 canaux dont un outil inexistant.
  ⚠️ La table §B0 ci-dessous est donc PÉRIMÉE : l'axe outil a ses 3 opérateurs.
- **Dette trouvée en chemin** : `toolList` existait en 2 exemplaires ; `porte-core`/
  `guard-core` n'étaient dans AUCUN `includeOnly` dependency-cruiser (donc jamais
  analysés) ; le miroir CI de `mutation.yml` avait raté `deps-criticite-pure`.

- **§C — FAIT.** Recette « geste » + « `match` = CHEMINS uniquement » écrites dans le skill,
  la doc injectable `sources.md` ET le `CLAUDE.md` global (+ miroirs Codex). ⚠️ `match` **N'A PAS**
  été renommé (décision maintenue) : ~532 règles le portent. Si un jour on renomme, ce sera
  par ALIAS + codemod + dépréciation (jamais un rename sec), au moment du packaging public.
- **§D — FAIT.** `docs/mcp/ssh.md` (outils fichiers dédiés, Tailscale, infra-MCP d'abord, correctif
  serveur = sursis, zone à déclarer, `ssh_exec` non annulable). Déclenchement vérifié par cas
  POSITIF (`mcp__ssh__ssh_exec` → injectée) et NÉGATIF (autre serveur → silence).

**Reste ouvert — 2 chantiers, chacun à part :**
- **29/07 — cohérence clé×clé** (`threshold` avec `dumb`/`once` ignoré en silence, `driftUnit` hors
  `smart`). **Session dédiée exigée par son propre backlog** : matrice complète des combinaisons,
  puis error/warn tranché pour chacune. ⚠️ Arbitrage de sûreté : `warn` au lint plutôt que rejet au
  chargement — un durcissement qui COUPE une injection est pire que le défaut qu'il corrige.
- **20/07 — troncature silencieuse : ✅ FERMÉ le 31/07/2026** (moteur ET gate, les deux du backlog).
  **Seuil MESURÉ dans le binaire Claude Code 2.1.220** (non documenté, non configurable — donc la
  lecture du code EST la mesure, pas de la rétro-ingénierie d'un comportement documenté) :
  `BYe(e, t, r, n = TCu) { if (e.length <= n) return e; … }` avec `TCu = 1e4` ⇒ **10 000 caractères
  par hook ET par champ** (et non 50 000 = `LYr`, qui borne les RÉSULTATS D'OUTIL). Au-delà :
  `tool-results/hook-<id>-<n>-additionalContext.txt`, aperçu de 2 000 caractères, **zéro signal au
  producteur**. Unique override = feature-gate DISTANT `tengu_velvet_ibis` (indexé par outil) ⇒
  **le seuil peut changer sans mise à jour ni commit**.
  → `budget.js` (PUR, muté 100 %) : le noyau ne lit JAMAIS le seuil, il reçoit un budget de la
  COQUILLE. Segment INDIVISIBLE, éviction ANNONCÉE (nom + chemin), sceau `###FIN:xxx###` au-delà
  de 50 % du budget — sous ce seuil, format HISTORIQUE à l'octet (bascule sûre : les 347 docs du
  parc, médiane 1 367 caractères, sont inchangées).
  → Gate statique = volet ⑤ de `couverture-gate.test.js` (cliquet de dette sur le poids des skills).
  ⚠️ **Piège découvert** : `gate.decide` marque `seen:true` sans connaître le budget ⇒ `porte-core`
  REMET l'état des docs différées, sinon une doc `once` évincée serait consommée sans avoir été
  livrée. Le défaut même qu'on corrigeait.
  ⚠️ **CECI NE FERME QUE LA MOITIÉ DU PROBLÈME** — cf. chantier « INJECTION INTÉGRALE » ci-dessous.
  Le silence est mort ; l'injection COMPLÈTE, non. Un manque bien signalé reste un manque : un
  skill annoncé mais absent du contexte oblige l'agent à aller le lire — c'est le « pointeur qui
  espère que l'agent obéisse » que le CONTRAT D'EXTENSION §4 INTERDIT. La cible n'a jamais été
  « prévenir », c'est « LIVRER ». (Fragmentation d'abord écartée le 31/07 au motif « dialecte non
  portable » : jugement RENVERSÉ le jour même par la mesure — cf. ci-dessous.)
  **CODEX — recherche FAITE le 31/07/2026, ne pas la refaire à l'aveugle** (binaire Rust
  `codex.exe` 0.144.6, `strings`) : `outputBytesCap` / `disableOutputCap` existent mais bornent
  l'EXÉCUTION DE COMMANDES (`process/spawn`), pas les hooks. `HookOutputEntry`, `HookRunSummary`,
  `hookSpecificOutput.additionalContext` existent SANS constante de troncature ni message
  « output too large » sur ce chemin. ⚠️ **AUCUN plafond trouvé ≠ preuve qu'il n'y en a pas**
  (binaire Rust : les constantes numériques ne sont pas en clair comme dans un bundle JS).
  Conséquence assumée : aucune coquille ne passe `options.budget` — TOUS les harnais tournent sur
  `DEFAUT_BUDGET` (8 000), prudent partout. C'est le SCEAU qui couvre le risque résiduel : si
  Codex coupait, l'agent recevrait l'en-tête SANS le marqueur de fin et le saurait. Mesure fine
  possible plus tard (payload réel capturé), pas bloquante.

  **Reste (CONTENU, pas moteur)** : scinder les 3 skills > budget (agent-social 79 516,
  webzenon-infra 69 017, mcp-doc-hooks 51 480) en tier-1 + `*-reference.md`. Ils sont désormais
  ANNONCÉS au lieu d'être amputés en silence — la dette est visible et bornée par le volet ⑤.

## 📐 CONCEPTION ARRÊTÉE — PAQUETS (03/08/2026, branche `chantier-paquets`)

**Faits DOC OFFICIELLE, relevés le 03/08/2026 — ne PAS les re-chercher, les corriger sur place si un jour ils changent :**
| Harnais | Plafond de sortie hook | Débrayable ? | `additionalContext` sur PreToolUse |
|---|---|---|---|
| Claude Code | **10 000 caractères** par chaîne (`additionalContext`, `systemMessage`, stdout) | ❌ « no setting to configure or disable » | ✅ |
| Codex | ~2 500 **tokens** | ✅ **`additionalContextLimit`**, `0` = illimité | ✅ |
| Gemini CLI | aucun plafond documenté | — | ❌ **canal ABSENT** (`BeforeAgent`/`AfterTool`/`SessionStart` seulement) |
⚠️ **CORRIGE le §20/07 « CODEX — aucun plafond trouvé »** : il concluait sur un `strings` du binaire Rust
alors que la limite est DOCUMENTÉE et CONFIGURABLE. Rétro-ingénierie d'un comportement documenté =
exactement ce que la méthode interdit. Le fait tient, la méthode qui l'a produit était fausse.
⚠️ **UN SEUL harnais sur trois nous oblige à fragmenter.** ⇒ la fragmentation est un CONTOURNEMENT
de Claude Code, PAS une vérité du domaine : elle vit dans la COQUILLE, jamais dans le noyau. Le jour
où le réglage existe côté Anthropic, on supprime la coquille et le noyau n'aura jamais su.

**Prior art = RFC, pas la littérature « context engineering ».**
- [RFC 8900] « Developers SHOULD NOT develop new protocols that rely on IP fragmentation » — mais ses
  9 causes de fragilité sont TOUTES des équipements intermédiaires (NAT, pare-feu, ECMP, collisions
  d'ID). **On n'en a aucun** : hook → harnais → contexte, zéro middlebox. Et sa recommandation de
  fond — *« push fragmentation responsibilities upward to layers that understand application
  semantics »* — nous décrit : on ne coupe JAMAIS au milieu d'une doc. **C'est de la segmentation
  TCP/MSS, pas de la fragmentation IP.** On est du bon côté de la RFC.
- [RFC 8899 / PLPMTUD] ⇒ **la « découverte du plafond » est ABANDONNÉE.** Le PMTUD classique casse
  parce qu'il dépend d'un signal de retour (ICMP) filtré ⇒ trou noir. Le fichier de spill du harnais
  est NOTRE ICMP, en pire : aucun canal de retour, l'unique récepteur est l'agent. Réponse de la RFC :
  **plancher conservateur** (`BASE_PLPMTU` = notre `DEFAUT_BUDGET` 8000, déjà juste) + **négociation
  quand elle existe** (= `additionalContextLimit: 0`), jamais de sondage à l'aveugle.
- [RFC 8899] exige la robustesse au **réordonnancement** ⇒ les N hooks tournent EN PARALLÈLE, l'ordre
  d'arrivée n'est PAS garanti ⇒ **chaque paquet est AUTO-DESCRIPTIF (`k/N` + marqueur commun)**. Sans
  numéro de séquence, un paquet manquant est indétectable = la perte silencieuse qu'on combat.

**Le PIÈGE DE CONCURRENCE, trouvé en lisant `porte-core.js` (à ne surtout pas réintroduire).**
Les N processus appellent CHACUN `gate.decide`, qui ÉCRIT l'état. Le premier marque les docs `once`
« vues » ⇒ les suivants décident « rien à injecter » ⇒ **paquets 2..N vides**. Le découpage n'est
déterministe que si les N voient le MÊME état.
⇒ **Plan MÉMOÏSÉ par invocation**, sous le lock qui existe DÉJÀ : premier arrivé décide + écrit
l'état + range le plan ; les autres LISENT le plan. Idempotent, reprenable, zéro nouveau verrou.
⚠️ **L'`invocationId` est fourni par la COQUILLE** (Claude Code : `tool_use_id`, présent sur
PreToolUse, doc 03/08/2026), JAMAIS lu par le noyau — sinon violation du CONTRAT D'EXTENSION §7
(ne fonder le moteur QUE sur ce que TOUT harnais expose par nécessité). Harnais sans identifiant
d'invocation ⇒ `nbPaquets = 1` ⇒ comportement d'aujourd'hui, à l'octet. **Dégradation, jamais casse.**

**Architecture — AUCUN fichier nouveau** (un `fragmenter.js` créerait 2 endroits qui décident « ce
qui tient dans une trame » = la double vérité que tout le repo combat) :
- `budget.js` (PUR) : `planifierPaquets(segments, budget, nbPaquets)` → N plans. Invariant de
  CONSERVATION RENFORCÉ : tout segment est dans EXACTEMENT un paquet (ou dans l'annonce du dernier).
- `porte-core.js` : mémoïsation par invocation + n'émet que le paquet `k`. La remise d'état des
  différés (déjà là) DOIT couvrir les paquets.
- Coquilles : lisent `--paquet k`, déclarent budget + invocationId. **Seul endroit avec un chiffre.**
- `settings.json` : N déclarations du même script. Config, pas code ⇒ Codex a le même mécanisme.
⚠️ **PARITÉ (contrat §6) : le multi-paquets ne s'ENGAGE QUE si une éviction aurait eu lieu.** Tout ce
qui tient aujourd'hui sort exactement comme aujourd'hui, à l'octet — médiane du parc 1 367 car.
Le risque de bascule est donc borné aux cas qui, sans ça, étaient DÉJÀ cassés.
⚠️ **N est un cliquet, DÉRIVÉ d'une mesure sur le plus gros contenu réel — jamais deviné.** Trop
petit = l'éviction revient ; trop grand = des spawns pour rien sur un poste sujet à la saturation.

## 🔴 OUVERT — INJECTION INTÉGRALE D'UN SKILL (la VRAIE cible du §20/07, ouvert 31/07/2026)

**Le problème, sans détour** : un skill fait des CENTAINES DE LIGNES **par conception** — c'est le
contrat du projet, pas une dérive. ⚠️ La convention d'usage « doc réinjectée < ~10 lignes » (règle
du PARC, jamais du framework — cf. rejet du gate de taille, 03/08) visait les **DOCS**, JAMAIS les
skills : les confondre a produit une conclusion fausse (« il suffit de condenser »). La trame du harnais fait 10 000 caractères. **Ça ne rentre pas, et aucune réécriture
ne changera ça** — condenser un skill pour entrer dans la plomberie, c'est dégrader le LIVRABLE
pour une limite de TRANSPORT : exactement ce que la doctrine interdit (« réparer le tuyau, pas le
livrable »).

**LA SOLUTION = FRAGMENTATION.** Tout réseau fait ça depuis 40 ans : une trame trop petite ne se
règle pas en raccourcissant le message, elle se règle en PAQUETS.

⚠️ **FAIT MESURÉ le 31/07/2026 — il RENVERSE le rejet initial** (binaire Claude Code 2.1.220) :
```js
async function* ATo(e, t = 1/0) { … while (o.size < t && n.length > 0) { o.add(r(n.shift())) } }
for await (let j of ATo(M))   // appelé SANS 2e argument ⇒ t = Infinity
```
Les hooks d'un même événement sont lancés **TOUS EN PARALLÈLE, concurrence ILLIMITÉE**. Donc
N hooks ≠ N × la latence : le temps reste celui du plus lent, seul le CPU monte. Et la persistance
est mesurée **par hook** (`${toolUseID}-${V}`, V incrémenté par hook) **ET par champ** ⇒ chaque
paquet a sa PROPRE trame de 10 000. **Le multi-hooks est VIABLE — ce n'est pas un hack.**

**Architecture visée (le noyau ne change pas de NATURE)** :
- `budget.js` rend des **PAQUETS** au lieu d'« un bloc + une annonce ». L'invariant de CONSERVATION
  se RENFORCE : tout segment est dans EXACTEMENT un paquet (property-based à étendre).
- Le MÊME script déclaré N fois avec un index (`--paquet k`). « N déclarations » est un concept de
  CONFIGURATION, pas de code : Codex a le même mécanisme ⇒ ZÉRO dialecte dans le noyau.
- Paquet vide ⇒ sortie immédiate (fail-open). Le SCEAU reste, et se renforce : il devient la preuve
  que les N paquets sont bien arrivés ET recollés dans l'ordre.
- ⚠️ **Coût CPU à MESURER avant de fixer N** (poste sujet à la saturation : 875 zombies le 15/07,
  502 le 27/07). N se DÉRIVE du plus gros skill, il ne se devine pas.
- ⚠️ Le mode `once` des skills joue en notre faveur : l'injection d'un skill est PONCTUELLE par
  agent, seul le SPAWN est permanent. C'est le spawn qu'il faut chiffrer, pas l'injection.

**NE PAS CONFONDRE avec la scission de contenu** : scinder reste utile contre la DILUTION (90 % d'un
skill est hors-sujet pour un geste donné), JAMAIS comme moyen de tenir dans la trame. Les deux
sujets sont désormais SÉPARÉS — les avoir mélangés est ce qui a fait dériver ce backlog.

⚠️ Survivant Stryker PRÉEXISTANT hors périmètre : `deps-criticite-pure.js` 98,08 %.

---

## 🔵 OUVERT — 3 manques trouvés le 31/07/2026 en écrivant une doc « déclencher sur un GESTE »

> Contexte : première doc du parc dont l'intention n'est pas « quel FICHIER touches-tu » mais
> « quel GESTE poses-tu » (poser un conteneur / un service / une tâche planifiée ⇒ le déclarer).
> Cas d'usage central du framework (il est né d'un clic de paiement — donc d'une ACTION), et
> pourtant jamais exprimé jusqu'ici. Les 3 points ci-dessous sont sortis de cette écriture.
> ⚠️ **Le MOTEUR de matching n'est PAS en cause** : le besoin s'est révélé exprimable avec les
> primitives existantes (`tool` pour cibler + `scope` pour filtrer), prouvé sur 4 canaux par
> spawn réel (shell POSIX, shell Windows, outil MCP distant, lecture de fichier). La base
> booléenne a tenu sa promesse — c'est l'ERGONOMIE et un FAUX VERT qui ont coûté la session.

### A. 🔴 FAUX VERT — un déclencheur DÉCLARÉ mais INERTE passe la validation
`validate()` répond **0 erreur** sur une doc du corpus FICHIER qui porte `mcp:` — alors qu'aucune
source ne consomme cette clé pour ce corpus (le canal MCP se déclenche par le CHEMIN
`docs/mcp/{server}.md`, pas par une clé de frontmatter). Résultat : doc muette, validateur content.
- ⚠️ **C'est la classe de bug que le projet dit avoir tuée** (« clé inconnue = ERREUR, jamais
  ignorée : `mach:` = doc morte en silence »). Ici c'est PIRE qu'une typo : la clé est CONNUE,
  donc acceptée, et pourtant morte. Un validateur qui approuve du mort n'est pas neutre — **il
  oriente activement vers la mauvaise cause** (ici : accuser le moteur de ne pas lire les commandes).
- **Cible** : gate statique « tout déclencheur déclaré est consommé par ≥1 source POUR LE CORPUS
  où la doc vit », message qui dit où la doc aurait dû aller. Dérivé du registre d'adaptateurs,
  jamais une liste recopiée.
- ⚠️ Negative-check obligatoire : une doc volontairement inerte doit ROUGIR (sonde → rouge → retrait).

### B0. 🔴 LE DÉFAUT DE FOND — la complétude booléenne est vraie PAR AXE, pas UNIFORMÉMENT
**Mesuré 31/07/2026 par audit d'expressivité** (chaque intention testée par appel réel des sources,
harnais validé sur les cas de base avant toute conclusion) :

| Axe | OU | ET | NON |
|---|---|---|---|
| fichier / chemin | ✅ `match` | ✅ `scope` | ✅ `exclude` |
| **outil** | ✅ `tool` (énumération) | ✅ `scope` | ❌ **ABSENT** |

`exclude` est matché contre le CHEMIN en cours, jamais contre le nom d'outil ⇒ **« tous les outils
SAUF celui-ci » est INEXPRIMABLE**, et « n'importe quel outil » aussi (§B).
- ⚠️ **C'est une correction à apporter à la PHILOSOPHIE, pas juste au code** : le modèle mental
  annonce « OU+ET+NON = complétude fonctionnelle, N'IMPORTE QUELLE condition de déclenchement est
  exprimable ». C'est vrai sur l'axe FICHIER (l'axe d'origine, hérité de `protect-files`), FAUX sur
  l'axe OUTIL. Tant que la doctrine affirme la complétude, personne ne cherchera le trou — et un
  auteur de doc conclura que SON besoin est illégitime, pas que le langage est incomplet.
- ⚠️ **Le joker (§B) est un SYMPTÔME, pas la maladie.** Traiter §B seul rendrait « tout outil »
  exprimable mais laisserait « tout sauf X » inexprimable ⇒ la même session se reproduira sur
  l'autre moitié. **Traiter l'axe, pas le cas.**
- **Cible** : rendre les 3 opérateurs uniformes sur l'axe outil (joker + négation), SANS ajouter de
  mot — la négation existe déjà (`exclude`), il lui manque de pouvoir viser l'axe outil.
  Décider explicitement : `exclude` devient-il multi-axes, ou un axe se déclare-t-il autrement ?
  ⚠️ Quelle que soit la forme retenue : **comportement par défaut inchangé** (contrat d'extension §6).
- ⏭️ **NON AUDITÉ à ce jour** (ne pas conclure « sain » sur ces points sans la même méthode) :
  axe MCP (les 3 opérateurs y sont-ils uniformes ?), cadence (`dumb`/`once`/`smart` + `threshold`
  + `driftUnit`), cascade des 3 autorités, ordre/`rank` et dédup, isolation multi-agents (`scopeId`).

### B. 🟠 IMPOSSIBLE d'exprimer « n'importe quel outil » — on énumère là où on veut un INVARIANT
`scope` voit TOUS les paramètres, mais ne déclenche jamais seul : il faut lui ouvrir la porte par
un déclencheur. Pour un GESTE, ça oblige à **lister les outils** (`["Bash","PowerShell","mcp__…"]`).
- ⚠️ Conséquence : le jour où un shell / un MCP / un outil de harnais s'ajoute, la règle devient
  **MUETTE EN SILENCE**. On a codé une énumération là où l'intention est « quel que soit l'outil ».
  C'est le défaut que le framework combat partout ailleurs (liste à la main = fantôme en devenir).
- ⚠️ **AGGRAVANT — MESURÉ 31/07 : `tool: ["*"]` est DÉJÀ ACCEPTÉ par `validate()` (0 erreur) et ne
  matche RIEN.** La syntaxe que n'importe qui essaierait spontanément pour dire « tous les outils »
  est donc **silencieusement morte ET certifiée valide** (même classe que §A, 3ᵉ chemin trouvé dans
  la même session). Ce n'est pas qu'une fonction absente : c'est un PIÈGE ACTIF. Donc soit le joker
  est implémenté, soit `"*"` est REJETÉ à la validation — l'état actuel (accepté + inerte) est le
  seul qui soit inacceptable.
- **Cible** : joker `tool: ["*"]` = n'importe quel outil, `scope` fait le tri. **Zéro mot ajouté**
  (base booléenne fermée respectée) — une VALEUR spéciale, pas un opérateur.
- ⚠️ Parité : comportement par défaut inchangé (aucune doc existante n'utilise `*`) ⇒ différentiel
  vert sans modification. Mutation + cas négatif (`*` ne doit pas matcher un nom d'outil vide).

### C. 🟡 DOC — aucune recette « geste », et `match` promet plus qu'il ne fait
1. **Aucune recette documentée pour déclencher sur une COMMANDE.** Le vocabulaire décrit `match`
   (chemins), `mcp` (serveur), `tool` (outil) — nulle part « pour réagir à un geste, combine
   `tool` + `scope` ». Il faut le DÉDUIRE, alors que tout le framework repose sur l'inverse
   (« la machine tranche, on n'espère jamais que l'agent devine »). Ajouter la recette + l'exemple
   validé sur les 4 canaux. **Sans ça, le prochain agent refera le même parcours** (mesuré : il a
   coûté une session, dont une conclusion FAUSSE « il faut modifier le moteur »).
2. **`match` est nommé par son ACTION quand les 3 autres déclencheurs le sont par leur DIMENSION**
   (`mcp` = serveur, `tool` = outil). « match » se lit comme universel (« ça matche les arguments »)
   alors qu'il signifie `path`. A induit en erreur l'agent ET le mainteneur dans la même session.
   ⚠️ **NE PAS RENOMMER** : ~532 règles portent le mot, migration coûteuse pour un gain cosmétique.
   Écrire explicitement « `match` = CHEMINS uniquement (+ commande du shell POSIX) » dans le skill
   et la doc injectable — corriger la compréhension, pas le vocabulaire.
3. ⚠️ **`match` NE DOIT PAS devenir universel** (tranché 31/07, ne pas rouvrir) : il deviendrait
   la même SOURCE que `scope` (loi anti-synonyme), et surtout les règles existantes portent la
   sémantique « chemin » ⇒ un pattern comme `index.ts` matcherait toute commande le mentionnant
   = faux positifs de masse, silencieux, sur des docs que personne ne relit. Un système qui injecte
   à tort finit ignoré. La séparation « OÙ j'agis » (chemin) / « QUOI je fais » (outil+params) est
   SAINE — c'est un axe de plus, pas une limite à lever.

### E. 🔴 LE LANGAGE REVENDIQUE L'EXPLICABILITÉ MAIS N'OFFRE AUCUN MOYEN DE L'EXERCER
Le modèle mental pose comme feature centrale : « on peut TOUJOURS répondre à *pourquoi ça s'est
injecté ?* ». **Aucun outil ne permet de poser la question.** `doctor` prouve que le moteur vit,
`lint-corpus` traque les docs mortes, `check-collisions` arbitre les croisements — mais rien ne
répond à « pour CE geste, qu'est-ce qui s'injecterait, et POURQUOI ».
- ⚠️ **COÛT MESURÉ (31/07/2026) : une session entière.** Faute d'outil d'introspection, l'agent a
  reconstruit le moteur à la main pour tester sa doc — et s'est trompé **3 fois** de harnais
  (mauvais nombre d'arguments, puis `{id,fm,body}` au lieu de `{doc,text}`). Chaque sonde fausse a
  produit un « muet » interprété comme un verdict SUR LE MOTEUR ⇒ conclusion FAUSSE « il faut
  modifier le moteur », défendue plusieurs fois avant d'être infirmée.
- ⚠️ **LA LEÇON N'EST PAS « l'agent doit être plus rigoureux »** (une consigne en prose ne tient pas
  40 sessions, doctrine du projet) : c'est que **la seule façon d'interroger le langage aujourd'hui
  est de le RÉIMPLÉMENTER**, et réimplémenter c'est se tromper. L'outil rend la faute impossible.
- **Cible** : `explain` — entrée = un payload (outil + params), sortie = docs qui s'injecteraient,
  **la règle exacte qui a déclenché chacune**, et pour les non-déclenchées le motif du rejet
  (pattern absent / `scope` non satisfait / `exclude` / mauvais corpus). Le « pourquoi PAS » est le
  plus précieux : c'est la question qu'on se pose quand on écrit une doc.
- ⚠️ Il ne DÉCIDE rien (lecture seule, hors chemin critique) : il expose la décision existante,
  jamais une 2ᵉ implémentation qui divergerait. **Il consomme les MÊMES sources que la porte**,
  sinon on recrée exactement le bug qu'il vient prévenir.
- Précédent dans le parc : un `npm run explain -- <cible>` existe déjà côté projet applicatif
  (config effective + refus motivés). Même besoin, même forme.

### F. 🟡 `sources.md` DÉPASSE LE SEUIL DE DILUTION — et la session du 31/07 l'a AGGRAVÉ
La doc injectable du moteur était déjà au-delà du seuil « < 10 lignes / progressive
disclosure » ; 3 lignes y ont été ajoutées le 31/07 (recette geste, faux verts, explain)
parce que le savoir manquait CRUELLEMENT — mais le bon geste était de SCINDER
(tier-1 réinjecté + `sources-reference.md` on-demand sans pattern).
- ⚠️ Elle est réinjectée à CHAQUE accès aux fichiers du moteur : chaque ligne se paie en
  tokens sur toutes les sessions de tous les agents. C'est la doctrine que ce repo
  applique aux AUTRES docs (précédent : `pw-mcp-proxy.md` scindée à 16 lignes).
- Non traité sciemment : scinder une doc RÉINJECTÉE pendant qu'un autre agent modifie le
  moteur créerait un conflit sur le fichier le plus chaud du repo. À faire à froid.

### G. 🔴 3 TESTS ROUGES PRÉEXISTANTS dans `mutation-workflow-gate.test.js` (constaté 31/07)
`npm test` = **711 verts / 3 rouges** : « tout module muté déclenche le workflow »,
« toute suite lancée par Stryker déclenche le workflow », et son propre negative-check.
- ⚠️ **NON causés par la session du 31/07** : vérifié, aucun des fichiers que ce gate lit
  (`stryker.conf.json`, `.github/workflows/**`, `vitest.stryker.config.mjs`) n'a été
  touché ce jour-là. La dérive est ANTÉRIEURE.
- ⚠️ **Personne ne les avait vus parce que la CI est à l'arrêt** (quota Actions des repos
  privés épuisé) — exactement le scénario « ① un gate rouge + ② la CI muette » déjà vécu
  ailleurs dans le parc : un gate qui ne s'exécute pas ne protège rien.
- ⚠️ Un rouge permanent est le pire état d'un filet : on cesse de le lire. Le traiter OU
  écrire le refus — jamais le laisser.

### D. ⏭️ HORS MOTEUR — le MCP le plus sensible du parc n'a AUCUNE doc
`docs/mcp/` ne contient que browser / gworkspace / odoo / stripe. **Le MCP d'accès SSH aux serveurs
n'a rien**, alors que la philosophie pose que « chaque MCP est une frontière à risque au même titre
qu'un fichier critique » et que le défaut est « documenter ». Zéro code : un `.md`.

---

## État au 16/07/2026 (fin de session — reprendre ICI)

**FAIT (sur GO explicite du mainteneur, prod touchée et vérifiée)** :
- Port vitest complet : 398 tests / 35 s, mutation **100,00% en 30 s** (0 survivant : 2 tués, 2 équivalents `Stryker disable` justifiés dans sources/file.js), break 99 (marge délibérée — ne PAS monter).
- **#8** : `~/.claude/hooks/protect-files.js` retire le frontmatter avant injection (`FRONTMATTER_RE` = copie de FM_RE) → la migration frontmatter ne polluera plus le contexte. Prouvé rouge/vert sur copie avant prod.
- **#12** : 0 doc orpheline (7 réf `inject: never` + 7 règles ajoutées). **#6** : 5 faux positifs exclus. **#13** : lint-corpus --quiet en SessionStart. **#11** : protect-files.js a sa doc (`docs/protect-files.md`). **#5** : `mcp-doc-config.schema.json` + drift-test dans config-gate.
- ⚠️ Découverte : `scope` = OR (`some`) — un scope large (ex. `zenon-infra` du modèle bookings) sur-matche. Scopes précis obligatoires.

**FAIT session fusion partie 1 (16/07/2026 après-midi)** :
- **#2** : rank mesuré (75 374 vrais chemins) puis CONSERVÉ — cf § mesures. Trou découvert au passage : 31/103 docs multi-règles à scopes divergents → clé `rules:` (JSON par-entrée) dans frontmatter.js + migrate.js, mutation 100,00%.
- **Migration RÉELLE ÉCRITE** : 302 docs de `~/.claude/hooks/docs/` portent leur frontmatter (dumb+confirm+rank), 0 règle morte, convergence prouvée (rejeu = 0 action), lint 0 erreur, injection prod vérifiée SANS fuite de frontmatter (spawn réel), miroir .codex resynchronisé. ⚠️ TRANSITOIRE jusqu'à #7 : nouvelle règle = protected-paths.json ET frontmatter (double écriture assumée).
- **#4 (côté moteur)** : `confirmFor(config, decl)` dans lib-pure.js + clé `confirm` au schéma (config utilisateur > frontmatter > défaut). Le retrait du fichier `.rush` lui-même = à la bascule #7, pas avant (protect-files reste le lecteur du .rush aujourd'hui).

- **Différentiel post-migration VERT (16/07/2026, 14h17)** : 2160 cas / 568 règles, 0 divergence, 636 s. **PARTIE 1 CLOSE.**

- **SHADOW CÂBLÉ (16/07/2026, 15h)** : `loader.js` (corpus frontmatters → règles ordonnées, entrelacement résolu par rank PAR ENTRÉE — 23 docs re-migrées, mutation 100%, différentiel in-process à chaque npm test) + `shadow-inject.js` (PreToolUse `*`, n'injecte JAMAIS, journalise `state/shadow-*.jsonl`) + `shadow-reconcile.js` (verdict : rejoue l'oracle partagé `oracle.js`, exit 1 divergence / exit 2 journal vide). Preuve : spawn réel silencieux + reconcile 0 divergence. Prend effet aux NOUVELLES sessions.

- **PORTE UNIFIÉE ÉCRITE (16/07/2026, 15h30 — NON CÂBLÉE)** : `gate.js` (décision pure par DOC : dumb/once/smart, compteurs étrangers, ask via confirmFor — muté 100,00%, 0 survivant) + `doc-inject.js` (coquille I/O, format de sortie protect-files À L'IDENTIQUE, ne lit JAMAIS `.rush` : rush = `confirm: false` config) + `corpus.js`/`session-store.js` (I/O partagées shadow/mcp-doc-inject, gate jscpd). **Parité prouvée par `porte-differential.test.js`** : vieux vs nouveau sur parc réel, contenu injecté à l'octet près, décision miroir du `.rush`, systemMessage identique. Reconcile jour 1 : 0 divergence / 53 payloads réels.

- **DÉRIVE DES 2 SOURCES TROUVÉE ET FERMÉE (17/07/2026)** : le reconcile a hurlé 53/473 la veille de la bascule. Diagnostic : 34 réelles (19 = time-skew de la construction), toutes traçables à **3 règles** dérivées entre `protected-paths.json` (ancien) et les frontmatters (neuf) — la double écriture transitoire avait dérivé DANS LES DEUX SENS : `sitemap-sync.py`+`notify.ts` ajoutés au frontmatter seul (JSON en retard), `specs/tla` (dispatcher-tla-spec) raté par la migration côté frontmatter (le neuf RATAIT = régression). **Fix au mérite** (frontmatter dispatcher ajouté rank 191 ; 2 règles reportées au JSON), ordre vérifié identique vieux/neuf sur les payloads sensibles, miroir resync, journal shadow pollué purgé. **Gate mécanique posé** : `source-drift-gate.test.js` (diff symétrique 586 règles = 0, sens critique distingué, dans test:fast + CI) → cette classe redevient ROUGE au pre-push, jamais découverte à la veille d'une bascule. 497 tests verts.
  ⚠️ Leçon : le `source-drift-gate` (statique, EXHAUSTIF sur 586 règles) est une preuve d'équivalence PLUS FORTE que le reconcile (échantillonné sur trafic). Pour la bascule : gate vert + différentiel de match vert = certitude, sans attendre N jours. Le reconcile devient confirmation, pas gate bloquant.

- **BASCULE FICHIER FAITE (17/07/2026, GO mainteneur)** : `confirm: false` (miroir .rush), porte câblée à la place de l'injection de protect-files, doctor étendu (porte surveillée + negative-checks). Deny/ask sécurité RETIRÉS sur décision explicite du mainteneur (« on s'en tape de la sécurité, pas la priorité ») — réintroduction possible plus tard en hook séparé.

- **✅ FUSION MCP FAITE — HOOK UNIQUE (17/07/2026, GO mainteneur « on fait tout maintenant »)** : `sources/mcp.js` (pur, muté 100% : payload → docs 'mcp/…', decl mode/threshold hérités de servers.{name}) + `gate.js` threshold PAR DOC + `doc-inject.js` aiguille fichier+MCP (fail-open local du corpus MCP, systemMessages composés ' · ') + `mcp-doc-reset.js` purge les 2 stores. **Parité prouvée : `mcp-differential.test.js`** (9 séquences spawn vieux vs nouveau : dumb/once/smart, overrides, granularité 3 niveaux, filtres, enabled/showNotification). Câblage : porte sur `*`, `mcp-doc-inject.js` RETIRÉ (doctor exige son absence — double injection sinon). 525 tests verts, mutation 100,00% (0 survivant, cache purgé), doctor 15/15 sur le câblage réel, preuve vivante des 2 voies par spawn réel.

**HORS REPO (autres projets, pas ce framework)** : glue agent-social → vitest ; audit Stryker prospection-mcp/infra/publer ; README/exemples publics (nice-to-have).

## ⚠️ RÈGLE N°1 — LA PROD TOURNE PENDANT CE REFACTOR

**D'autres agents travaillent en parallèle, en ce moment même**, et consomment
`~/.claude/hooks/protect-files.js` + la doc injectable à CHAQUE appel d'outil.
Casser un de ces fichiers = casser leur travail en cours = tokens brûlés = argent réel.

- **Ce framework est du DÉVELOPPEMENT PUR.** Il n'a AUCUN droit sur la prod aujourd'hui.
- **Phase EXPAND uniquement** : on AJOUTE dans `Desktop/mcp-doc-hooks/`. On ne débranche
  rien, on n'édite ni `settings.json`, ni `protected-paths.json`, ni les hooks vivants.
- **Étapes 2 (bascule) et 3 (retrait) = GO EXPLICITE du mainteneur obligatoire**, à un moment
  où aucun agent ne tourne. Un différentiel vert prouve l'équivalence du match —
  **jamais** que le moment est bon pour basculer. Ne JAMAIS enchaîner automatiquement.
- **Zéro kill à filet large sur `node.exe`** (MCP + agents des autres sessions tournent
  dessus). Ne viser que des orphelins (parent mort). Erreur commise le 15/07/2026.

## Le problème

Deux systèmes font le MÊME travail sans le savoir :

| | Déclencheur | Dédup | Coût mesuré |
|---|---|---|---|
| `mcp-doc-hooks` (ce repo) | serveur/outil MCP | oui (`smart`/`once`/seuils) | 36 ms |
| `~/.claude/hooks/protect-files.js` | chemin de fichier | **aucun** | 4 ms |

Conséquence réelle : `protect-files.js` réinjecte la même doc à CHAQUE appel d'outil (`pointer.md` livré ~15× dans une seule session). Ses 4 ms sont "moins chers" **parce qu'il ne se souvient de rien** — les 36 ms de l'autre, c'est le prix du dédup, et l'échange est très favorable (tokens ≫ ms).

## L'idée qui rend la fusion possible

**L'unité de dédup est le DOC, pas le déclencheur.** Aujourd'hui on compte par serveur (et par chance serveur ≈ doc). En comptant par doc, fichier et MCP deviennent le même problème : « ce `.md` a-t-il déjà été livré récemment ? »

## Architecture cible

```
        n'importe quel appel d'outil
                    |
              doc-inject.js          <- hook UNIQUE, seul I/O
                    |
        +-----------+-----------+
   sources/file.js      sources/mcp.js    <- PURS : payload -> quels docs ?
        +-----------+-----------+
                    |
               lib-pure.js           <- PUR : lesquels envoyer ? (modes, seuils, dédup par doc)
                    |
          injecte seulement le nouveau
```

- **Une source** = une fonction pure `payload -> liste de docs`. Le moteur ignore d'où ça vient.
- Ajouter une fonctionnalité plus tard = **une source de plus**, le reste ne bouge pas.
- `lock.js`, `paths.js`, `stdin-json.js`, `doctor.js`, `config-gate` : déjà là, réutilisés tels quels.

## Décisions prises (et pourquoi)

1. **Frontmatter : le doc déclare son déclencheur.** `protected-paths.json` (527 règles) DISPARAÎT.
   ```markdown
   ---
   match: lib-pure.js
   scope: [mcp-doc-hooks]
   mode: dumb        # optionnel — défaut proposé par l'AUTEUR du doc
   ---
   ⚠️ invariant...
   ```
   Raison : la doc actuelle admet « 3 endroits à synchroniser » = 3 occasions de dériver, en SILENCE dans les deux sens (doc sans règle = jamais injectée ; règle sans doc = morte). Avec le frontmatter, ces bugs n'existent plus — il n'y a plus deux choses à désynchroniser.
   Perf validée par mesure : lire les 299 docs = **23 ms** (89 ms à froid) vs 440 ms de démarrage Node. Pas d'index nécessaire. Plafond estimé ~3000 docs (~230 ms) → on optimisera là, pas avant.

2. **⚠️ La config utilisateur écrase TOUJOURS le frontmatter.**
   ```
   config utilisateur > frontmatter (défaut de l'auteur) > global > défaut
   ```
   Deux besoins DIFFÉRENTS, jamais le même champ (même classe d'erreur que `enabled` vs `showNotification`, déjà corrigée une fois) :
   - frontmatter = l'auteur du doc dit « je suis critique »
   - config = l'utilisateur dit « chez moi, désactive-le »
   Si désactiver un doc obligeait à ÉDITER ce doc, ça casse dès que le doc n'est pas à toi (doc d'équipe, `.md.example` livré, docs vendorisées). On n'édite pas le plugin pour désactiver une règle — on le fait dans sa config (cf ESLint).

3. **`filterMode`/`filterList` RESTENT.** Envisagé de les supprimer → **rejeté**. Ils portent l'adoption progressive (« je clone, je teste sur Stripe seulement »), qu'aucun `enabled: false` par doc ne remplace. Le framework est un STANDARD réutilisable, pas un outil perso. Seul changement : ils filtrent des **docs** (unité commune), donc marchent enfin aussi sur les docs fichier.

4. **Un SEUL JSON**, réglages uniquement, jamais de contenu ni de mapping.

5. **Les docs perso restent dans `~/.claude/hooks/docs/`** (synchronisées vers `.codex/`). Le repo ne porte que le MOTEUR — jamais mélanger code public et docs perso (emails/clients réels).

6. **Aucune autre fonctionnalité.** Pas de priorités, tags, TTL, sévérités. Chaque fonctionnalité actuelle vient d'une douleur RÉELLE (mode `smart` = dérive de contexte ; niveau sous-outil = outil unique d'Odoo ; `dumb` = clic Stripe). Une fonctionnalité sans bug derrière = hypothèse non mesurée.

7. **⚠️ DEUX CLÉS DE MATCHING, JAMAIS UNE SEULE : `match:` (fichier) et `mcp:` (serveur).**
   ```yaml
   match: [lock.js]   # source fichier — substring sur le chemin
   mcp:   [stripe]    # source MCP — nom EXACT du serveur
   ```
   Les deux sémantiques n'ont RIEN à voir : le fichier fait `chemin.includes(pattern)` (faux positifs possibles), le MCP fait `mcp__X__y` → `docs/mcp/X.md` (nom exact, ZÉRO faux positif possible).
   ⚠️ Une clé `match:` UNIQUE serait AMBIGUË : `match: stripe` = le fichier `stripe-config.js` OU le serveur MCP `stripe` ? Les deux → la doc MCP partirait en éditant un fichier. **Ce serait un faux positif CRÉÉ PAR LA FUSION**, là où le MCP n'en a aucun aujourd'hui.
   Chaque source lit SA clé, avec SA sémantique. **Fusionner les moteurs ≠ fusionner les sémantiques.** (Trou trouvé par le mainteneur le 15/07/2026 — le plan initial avait cette ambiguïté.)

8. **⚠️ `mode: dumb` sur TOUTE doc migrée — le refactor NE change PAS le comportement.**
   Le plan a d'abord admis « le dédup change EXPRÈS » : c'était une ERREUR de méthode. `protect-files.js` n'a aucun dédup (réinjecte à chaque appel) ; sans `mode: dumb`, les 292 docs tombaient sur le global `smart` = « injectée une fois puis oubliée ». **Un refactor de FORMAT ne livre JAMAIS un changement de comportement en douce** — sinon, à la première régression, on ne sait pas lequel des deux a cassé.
   Scellé par gate dans `migrate.test.js`. Le passage de docs en `smart` = chantier SÉPARÉ, doc par doc, humain, APRÈS bascule (même doctrine que `confirm: true`).

## HORS PÉRIMÈTRE — ne pas fusionner

**Le blocage (`deny`/`ask`) ne fusionne PAS — DÉCISION DÉFINITIVE (le mainteneur, 17/07/2026, ne plus rouvrir).** Rôles opposés : un injecteur est silencieux et fail-open (panne = pas de doc), un garde est bruyant et fail-closed (panne = on bloque). Fusionner = choisir UN comportement de panne, mauvais pour l'autre rôle.
**État réel : le blocage n'est PAS utilisé en interne (constat le mainteneur) → AUCUN garde n'est construit, et ce n'est pas de la dette** (doctrine : fonctionnalité sans douleur mesurée = spéculation interdite). Le jour où un besoin RÉEL apparaît : **seconde porte sœur `guard.js`** (fail-closed, policy explicite) consommant les MÊMES sources pures (`sources/file.js`, `sources/mcp.js` — sans dialecte de harnais, réutilisables telles quelles) + corpus + doctor. ~1 session, l'architecture d'aujourd'hui a été conçue pour ça.

⚠️ **Injecter une doc ne SÉCURISE rien** — ça prévient l'agent, ça ne l'empêche pas. Le jour du clic Stripe, une doc aurait averti, pas bloqué. « Bloquer les actions MCP dangereuses » = PROJET SÉPARÉ, non tranché, qui commence par : *qu'est-ce qu'on bloque, et qui décide ?*

## Étapes (expand/contract — l'ancien marche à chaque instant)

1. **AJOUTER** `sources/file.js` (pur : pattern/scope/exclude, sémantique identique à protect-files) + parser de frontmatter. **Rien de câblé.**
   - Gate : **test différentiel** — rejouer ancien et nouveau moteur sur un corpus de chemins réels, exiger des docs matchées IDENTIQUES. C'est LE filet : personne ne relit 527 règles à la main.
   - Script de migration `protected-paths.json` → frontmatter (mécanique, jamais à la main).
   - Gate : frontmatter invalide = ROUGE (sinon un `match:` mal écrit = doc silencieuse — le bug d'aujourd'hui déguisé).
2. **SHADOW** — le nouveau moteur tourne sur le VRAI trafic, **et on jette sa réponse**.
   Seul l'ancien injecte. Divergence → loggée, personne n'est réveillé, rien ne casse.
   ⚠️ **Risque nul PAR CONSTRUCTION** : le nouveau n'a aucun pouvoir. Donc cette étape
   n'a PAS besoin d'attendre que les agents dorment — contrairement à la bascule.
   Raison d'être : le différentiel teste des cas **inventés** (corpus dérivé des règles) ;
   le shadow teste les **vraies sessions, vrais chemins, vrais agents** — donc ce que
   personne n'a su imaginer. C'est précisément là que les erreurs se sont produites
   (deadline 2 s, oracle menteur ×3, script d'audit menteur — 15/07/2026).
3. **BASCULER** après N jours à zéro divergence sur trafic réel. GO EXPLICITE du mainteneur.
   L'ancien reste en shadow → divergence après bascule = **retour arrière AUTOMATIQUE**.
4. **RETIRER** l'injection de `protect-files.js` (il ne garde que deny/ask), en dernier,
   quand plus personne ne peut le regretter.

⚠️ **Le 100 % atteignable n'est PAS « le code est juste »** — ça, personne ne l'a jamais, et
cette session l'a prouvé 4 fois. C'est **« il n'existe aucune fenêtre où ça peut casser »** :
pendant le shadow le nouveau n'a aucun pouvoir, après bascule la divergence déclenche le
rollback toute seule, l'ancien ne meurt qu'à la fin. La certitude se trompe ; un rollback
automatique, non. Doctrine CLAUDE.md : « on va vite PARCE QUE health-check + rollback sont
AUTOMATIQUES », jamais en sautant des vérifications.

## Ce qui est garanti

- **Le match** (par le test différentiel) : pour un chemin donné, les mêmes docs matchent qu'avant. Aucune des 553 règles ne se perd.
- **Le moment** (par `mode: dumb`, décision 8 + gate dans `migrate.test.js`) : chaque doc part aux mêmes instants qu'avant.
- **La réversibilité** (par le shadow, étape 2) : aucune fenêtre où ça peut casser.

⚠️ Une version antérieure de ce plan déclarait le comportement temporel « PAS garanti — il change exprès ». **C'était une erreur de méthode, corrigée le 15/07/2026** : un refactor de format et un changement de comportement ne voyagent JAMAIS ensemble.

## ⚠️ MESURES DE LA PHASE 0 — ne pas re-débattre sans nouvelles données

**Purge 30 j** : EXISTE (`mcp-doc-inject.js`, `GC_TTL_MS`, probabiliste, fail-open, testée). Vérifiée le 15/07/2026.

**Moteur MCP** : vérité terrain 6/6 (spawn du vrai hook, state isolé) — `dumb` réinjecte, `smart` se tait au 2ᵉ appel, serveur sans doc = silence, outil non-MCP = hors périmètre. **Le moteur est juste.**

**`match` segment-ancré : IDÉE MESURÉE PUIS ABANDONNÉE.** Proposée pour tuer les faux positifs (`lock.js` matche `package-lock.json`). Mesurée sur **1423 vrais chemins × 553 règles** :

| | |
|---|---|
| Matches perdus | **586 / 1125 = 52 %** |
| Règles impactées | 59 / 553 |
| Ratio | **~455 matches voulus détruits pour ~41 faux positifs corrigés — 11 contre 1** |

Cause : **les patterns ne sont PAS des noms de fichiers.** `.test.js` (136 matches × 3 docs) et `.test.mjs` (47) sont des **suffixes VOLONTAIRES** — c'est la famille des docs de convention de test. `demo-`, `browser-recover`, `.dependency-cruiser` sont des préfixes/fragments. Un segment ne vaut jamais `.test.js` → la règle meurt. **Le substring n'est pas un accident, c'est la feature.**
⚠️ Le corpus du différentiel ne pouvait PAS voir ça : il est dérivé des règles, pas des vrais fichiers. Toute future idée sur le matching se mesure sur de VRAIS chemins.

**Faux positifs réels** (mesurés, ~41) : `lock.js`→`package-lock.json` (9), `config.js`→`mcp-doc-config.json` (6), `search.js`→`research.json` (3), `paths.js`→`protected-paths.json` (2).
→ **Problème de DONNÉES, pas de moteur.** Fix = `exclude` sur ces 5 règles (l'outil existe déjà). Rayon de souffle nul.

**⚠️ TROU OUVERT — couverture MCP : 2 serveurs documentés sur 16 branchés.**
Documentés : `stripe`, `odoo`. Non documentés : **`ssh` (VPS prod)**, **`infra` (sites clients)**, `gworkspace`, `publer`, `discord`, `media`, `blog`, `n8n`, `browser`, `mobile`, `seo-agency`, `qa-seo`, `prospection`, `umami`.
`config-gate.test.js` est **directionnel** : il vérifie « toute doc a une config », donc il est structurellement AVEUGLE à un serveur sans doc. C'est le miroir exact du bug déjà scellé : *une doc qui n'injecte jamais = indiscernable d'une doc absente* → ici *un serveur sans doc = indiscernable d'un serveur qui n'en a pas besoin*. Côté fichier, le filet d'exhaustivité est l'arbo du skill ; **côté MCP il n'y a AUCUN filet.**
→ Gate à poser : **tout serveur branché doit être SOIT documenté, SOIT explicitement listé comme volontairement sans doc. Le silence n'est pas une option.** (`filterList` existe déjà.)

**`rank` → parent/enfant : IDÉE MESURÉE PUIS ABANDONNÉE (16/07/2026).** Mesuré sur **75 374 vrais fichiers × 568 règles** : 36 séquences co-injectées, 39 paires ordonnées, **0 conflit** (jamais A→B et B→A). MAIS les paires mélangent de vrais parent→enfant (`pointer.md → config-gate.md`) et des **voisins accidentels** (`ssh-async → tests-protocol`) dont l'ordre ne vient que de l'index JSON. Nommer ces 39 contraintes = les relire et les juger À LA MAIN — exactement ce que le refactor interdit (« personne ne relit les règles »). → **`rank` reste** (dérivé de l'index, comportement identique). Règle pour les FUTURES docs sans `rank` (à implémenter dans le loader) : injectées APRÈS les docs rankées, ordre alphabétique (déterministe). Le passage à un ordre sémantique = chantier séparé, humain, post-bascule (même doctrine que `smart` et le tri `confirm`).

**⚠️ DIVERGENCE scope/exclude INTRA-DOC — trou du format frontmatter, MESURÉ (16/07/2026).** Sur 103 docs multi-règles, **31 ont des scopes/excludes DIFFÉRENTS entre leurs règles** (ex. `pointer.md` : `lib-pure.js` scopé `[mcp-doc-hooks]` mais `mcp-doc-inject.js` sans scope). Le format `match: [a, b]` + UN `scope:` par doc ne peut PAS les représenter — `declaration()` prenait `entries[0]` et aurait perdu/écrasé des scopes EN SILENCE (sur-injection ou doc morte). Fix : clé **`rules:`** = liste JSON inline d'objets `{pattern, scope?, exclude?}` (JSON.parse : total via try/catch, zéro mini-langage, format d'origine des règles). Docs homogènes → `match:` simple (lisible) ; divergentes → `rules:`. `rules` + (`match`/`scope`/`exclude`) = CONTRADICTION rouge. Le parser reste un sous-ensemble plat — JSON inline ≠ YAML.

## Latence — déjà mesuré, ne pas re-débattre

| | |
|---|---|
| Démarrage de Node (plancher) | 430–460 ms |
| Chargement des modules | 1 ms |
| Lock + état + docs | 36 ms |
| protect-files | 4 ms |

**95% de la latence est le démarrage de Node, pas le code.** Optimiser le framework ne donnerait rien. La fusion se justifie par les TOKENS (dédup), pas par la latence — elle n'économise un spawn que sur les appels SSH (seul cas où les 2 hooks se déclenchent).

Hypothèse NON vérifiée : 430 ms est ~6-10× la normale (30-80 ms) ; cause probable = Defender qui rescanne `node.exe` à chaque spawn. Une exclusion Defender rendrait ~400 ms par appel d'outil, sans toucher au code. **À mesurer avant de conclure.**

## 17/07/2026 — shadow décâblé (relique)
- `shadow-inject.js` retiré de settings.json (son rôle — répétition avant bascule — est terminé). Code + tests conservés comme relique. Doctor 15/15 vert après retrait.
- ⚠️ `protected-paths.json` N'EST PAS une relique : c'est la source VIVE du moteur Codex (`~/.codex/hooks/protect-files.js`, synchronisé au SessionStart). La double écriture JSON⟺frontmatter + le source-drift-gate RESTENT obligatoires tant que Codex n'est pas porté sur la porte unifiée (chantier séparé, non planifié).

## 17/07/2026 — PORTE SESSION (nouvelle capacité, plugin du noyau)
- Besoin le mainteneur : savoir injecté à CHAQUE début de session ET après chaque compaction, comme CLAUDE.md, sans passer par un outil.
- Livré : `docs/session/*.md` (gitignoré, .md.example poussé) → `sources/session.js` (PUR, muté 13/13, 0 survivant) → `session-inject.js` (porte sœur SessionStart, fail-open, zéro état). Câblé settings.json, doctor étendu (probe 3 + câblage, 19 checks), negative-checks 3b/5d, gates (deps/jscpd/mutation.yml) à jour.
- Usage : poser un .md dans docs/session/, c'est tout. Retirer = supprimer le .md.

## 17/07/2026 — CADENCE PAR DOC = FRONTMATTER (JSON = global only, décision mainteneur)
- Constat (question le mainteneur) : asymétrie de modèle mental — cadence fichier en frontmatter, cadence MCP en config par serveur (héritage de parité, pas un idéal).
- Switch SANS rétro-compat de la config LIVRÉE : `servers.*` ne porte plus AUCUNE cadence (schéma strict + gate « servers sans cadence ») ; `stripe: dumb` migré dans le frontmatter de docs/mcp/stripe.md. Précédence : frontmatter doc > global.
- Moteur : `threshold` ajouté au vocabulaire frontmatter (entier ≥ 1) ; `declFor(config, server, fm)` (fallback TOTAL sur invalide) ; lib-pure inchangé (le relic + différentiel en dépendent — la branche per-serveur reste honorée à runtime mais INATTEIGNABLE via la config livrée, scellée par gate).
- Gates : drift-test frontmatter des docs MCP livrées (clés admises mode/threshold — tue la classe `mod:` silencieuse), contrat KNOWN en dur mis à jour, test d'intégration frontière (fm dumb bat global once), mutation 100% (0 survivant, borne 1 testée). 553 tests verts.
- Rappel chantier portage Codex : `~/.claude/hooks/check-collisions.js` (analyse on-demand des croisements de docs, 3 niveaux de tri, verdict humain — jamais un gate) lit protected-paths.json ; le jour où le JSON devient relique, le porter sur les frontmatters (loader.js fournit déjà les règles plates).

## 17/07/2026 — COLLISIONS intégré au moteur + GARDE D'ÉCRITURE temps réel (0-human)
- `collisions.js` (pur, muté 100%) + `check-collisions.js` (coquille frontmatters via loader) : remplacent l'ancien ~/.claude/hooks/check-collisions.js (SUPPRIMÉ — il lisait le JSON transitoire). Verdict des croisements = AGENT (0-human), jamais un gate.
- `doc-write-guard.js` (PostToolUse Write|Edit, câblé) : doc du parc invalide → block + raison dans le tour de l'agent (il corrige immédiatement) ; saine → silence total. Validation = frontmatter.validate/validateMcp (seule autorité, partagée avec config-gate). Doctor : probe 4 + câblage + negative-checks 3c/5e (21 checks).
- Décisions d'archi consignées : temps réel = DÉCIDABLE seulement (les croisements probabilistes restent on-demand — 35 cas majoritairement légitimes en temps réel = alert fatigue = canal mort) ; 1 seul JSON de config runtime (standard une-config-par-domaine).
- Mutation totale du repo : 100,00%, 0 survivant (mutants statiques/équivalents éliminés PAR CONSTRUCTION : forEach, MCP_KEYS locale, localeCompare, gardes redondantes retirées).

## 17/07/2026 — DETTE COSMÉTIQUE (backlog FROID — NE PAS agir, NE PAS relancer)
⚠️ CECI N'EST PAS UNE TÂCHE. Aucun agent ne doit la ressortir comme « à faire », ni mettre la moindre pression dessus. Elle est notée UNIQUEMENT pour mémoire, pas pour action. Si tu es un agent qui lit ceci : ne propose PAS de la traiter, ne la signale PAS comme un manque, ne l'audite PAS comme un défaut. Elle est VOLONTAIREMENT laissée en l'état — c'est le bon état.
- **Quoi** : les deux sources formatent leur badge de notification différemment — `fileAdapter` via `gate.docLabel`, `mcpAdapter` via `formatSystemMessage`/`shouldShowNotification` (source-adapters.js). Deux « dialectes » de notif.
- **Pourquoi c'est là et pourquoi c'est CORRECT** : chaque source réplique À L'IDENTIQUE le badge de son ancêtre (protect-files.js / mcp-doc-inject.js) — c'est une CONTRAINTE DE PARITÉ, exigée par les tests différentiels de bascule. Y toucher MAINTENANT casserait le différentiel. L'asymétrie est donc la BONNE décision tant que les reliques vivent.
- **Impact réel** : zéro. Aucun bug, aucune régression, aucune dette technique fonctionnelle. Purement cosmétique (deux chemins de formatage au lieu d'un).
- **Le jour LOINTAIN où ça pourrait bouger** (et seulement si le mainteneur le décide, jamais un agent) : après le retrait définitif de protect-files.js ET mcp-doc-inject.js, quand la contrainte de parité octet n'existe plus. À ce moment SEULEMENT, unifier les deux `message()` derrière un formateur paramétré unique. Pas avant. Pas de deadline. Pas de rappel.
- Audit yeux-neufs 17/07/2026 : architecture MCP/fichier notée 9/10, séparation JUSTIFIÉE (deux moteurs de matching réellement distincts, pipeline unique mutualisé). Ce point est le SEUL écart au 10, et il est explicitement classé « ne rien faire maintenant ».

## 18/07/2026 — BACKLOG : cadence `smart` & dérive de contexte (brainstorm, PAS urgent)
⚠️ NOTE de réflexion, pas une tâche. Ne pas agir sans décision explicite du mainteneur.
- **Constat (le mainteneur)** : le compteur `smart` compte les appels d'OUTILS uniquement. Or le contexte se dilue AUSSI par la conversation (messages user + texte assistant entre 2 outils), que le hook PreToolUse ne voit pas.
- **Cadrage** : entre 2 compactions rien ne « sort » du contexte (tout le transcript est vu) — c'est de la DILUTION, pas une disparition. La vraie disparition = la compaction, déjà gérée (reset PreCompact + réinjection). Donc la dérive ne concerne QUE `smart` (re-boost de saillance).
- **Design capturé (18/07/2026, PAS câblé) : `driftUnit`** = knob ORTHOGONAL, pas des sous-modes de smart. Valeurs `tool` (défaut) | `turn`. Défaut GLOBAL dans le JSON + override PAR ENTRÉE (mirror exact de mode/threshold). `threshold:N` = N ticks, un tick = `driftUnit`. `tool` GRATUIT (PreToolUse compte déjà) ; `turn` exige un 2e hook (Stop/UserPromptSubmit) qui incrémente le même compteur — surface + porte Codex de plus. Zéro heuristique (compter un événement discret). C'est un axe de PROGRAMMABILITÉ légitime (« tous les 3 outils » ≠ « tous les 3 tours »).
- **Statut = FEATURE, pas qualité structurelle** → YAGNI (doctrine le mainteneur : day-one seulement sur structurel). Design gravé ci-dessus pour ne pas le reperdre ; CÂBLER le 2e hook UNIQUEMENT sur besoin réel de « compter les tours ».
- **Question de fond AVANT d'optimiser `smart`** : `smart` est-il seulement utile ? Garde-fou → `dumb` (frais à chaque action = fiabilité, un doc court n'est pas du bruit). Pointeur/skill → `once` (la dérive conversationnelle est hors-sujet : skill chargé = contenu déjà en contexte). `smart` = le milieu bâtard qui crée le problème. Si on l'utilise peu, le problème est moot.
- **Décision provisoire** : skills défaut `once` (esquive le débat). Ne PAS ajouter le compteur-message. Rouvrir SEULEMENT si un cas réel de « savoir dilué non réinjecté » est observé en prod.

## 18/07/2026 — ✅ `driftUnit` CONSTRUIT (GO mainteneur, même jour — plan exécuté INTÉGRALEMENT)
Étapes 0→13 toutes faites : contrat UserPromptSubmit vérifié doc officielle (1×/tour,
session_id, stdout = contexte → porte MUETTE) · schéma (defaultDriftUnit + skillDefaults.driftUnit
+ driftUnit par skill) · vocabulaire frontmatter (`driftUnit`, DRIFT_UNITS = SOURCE UNIQUE
dans frontmatter.js, importée par gate/mcp/skill — le MODES local de skill.js supprimé au
passage, doublon latent) · porte `turn-count.js` (store 'turn-count-', même session-store,
lock, deadline, fail-open) · gate.js : `driftUnitForDoc` (cascade UNIQUE entrée > defaultDriftUnit
> 'tool') + decide(…, turnCount) — UN point de décision, unité 'tool' = comportement historique
à l'identique (les compteurs étrangers n'avancent que pour 'tool' ; l'état porte l'horodatage
`turn`) · porte doc-inject : lecture PARESSEUSE du compteur (zéro I/O ajoutée si aucun doc 'turn') ·
reset PreCompact (3 stores) · settings.json câblé (UserPromptSubmit) · doctor probe 6 + check
câblage + negative-checks 3e/5e (24 checks) · miroirs (dep-cruiser) · différentiels VERTS ·
mutation 100,00% (0 survivant) · 637 tests · doublon jscpd validate/validateMcp extrait
(`cadenceErrors`, source unique du jugement de cadence) · docs (porte.md, skill-source.md,
skill arbo + contrat portage Codex : porte tour ajoutée) + double écriture protected-paths.json
(turn-count.js/turn-count.test.js → porte.md). Plan d'origine conservé ci-dessous pour mémoire.

## 18/07/2026 — PLAN COMPLET `driftUnit` (EXÉCUTÉ — conservé pour mémoire)
But : rendre l'UNITÉ du compteur `smart` configurable. `driftUnit` ∈ {`tool`, `turn`}.
« combien s'est écoulé depuis la dernière injection » = N appels d'OUTILS (`tool`, actuel)
OU N tours de conversation (`turn`). C'est un axe de PROGRAMMABILITÉ (« tous les 3 outils »
≠ « tous les 3 tours »). N'affecte QUE `smart` (dégénéré aux extrêmes dumb=0/once=∞).

### Les 3 AUTORITÉS (cascade, identique à mode/threshold — modèle à respecter PARTOUT)
1. **Défaut FRAMEWORK** = codé en dur (`tool`). EXISTE même sans aucune config, même si le
   JSON est absent/vide. C'est le socle « hors-JSON » : quand tu n'es dans aucun réglage, il est là.
2. **Config GLOBALE** (JSON) = écrase le défaut framework pour TOUT (skillDefaults.driftUnit,
   et defaultDriftUnit pour les docs). Optionnel : absent → on retombe sur le framework.
3. **ENTRÉE** (frontmatter d'une doc / entrée d'un skill) = dernier mot, écrase le global.
Précédence : entrée > global > framework. Fallback TOTAL à chaque étage sur valeur invalide.

### Pourquoi ce n'est PAS un bolt-on (honnêteté) : ça touche le NOYAU SCELLÉ
`turn` exige un signal qui se déclenche PAR TOUR — or le hook PreToolUse ne voit QUE les outils.
Donc : nouveau hook + modif de gate.js (pur, muté 100%, sous 2 différentiels de parité).

### Étapes — AUCUNE à sauter, dans l'ordre
0. **MESURER D'ABORD** (doctrine, jamais bâtir à l'aveugle) : vérifier le contrat du hook
   `UserPromptSubmit` de Claude Code (se déclenche par tour ? payload = session_id ?). ET
   l'équivalent Codex (pour la portabilité). Doc-first ; sonder au curl UNIQUEMENT le non-documenté.
1. **Schéma D'ABORD** (config-gate hurle sinon) : `driftUnit` enum {tool,turn} ajouté à
   skillDefaults + entrée skill + vocabulaire frontmatter (docs) + un `defaultDriftUnit` global.
   driftUnit doit valoir PARTOUT où `smart` vaut (skills ET docs) — pas skill-only (cohérence).
2. **session-store.js** : 2ᵉ compteur « turn » (namespace distinct du compteur outil, MÊME
   mécanisme — zéro nouveau store). ⚠️ fichier PARTAGÉ avec shadow-inject (relique) → re-prouver
   ses suites + doctor après.
3. **Nouvelle porte `turn-count.js`** (UserPromptSubmit) : incrémente le compteur turn de la
   session. Modèle = portes existantes (fail-open, deadline.arm() avant I/O, paths.js).
4. **gate.js** (NOYAU) : la décision `smart` lit `decl.driftUnit` et compare le BON compteur.
   La porte passe les 2 valeurs de compteur (tool+turn) ; le gate choisit. UN seul point de
   décision, zéro logique smart dupliquée. ⚠️ Défaut `tool` = comportement ACTUEL À L'IDENTIQUE
   → les différentiels restent verts pour les cas par défaut (ne pas casser la parité).
5. **declFor (cascade)** : ajouter driftUnit à la cascade 3 étages, DANS sources/skill.js ET
   dans la voie docs (frontmatter.js + sources/mcp.js declFor). Réutiliser le pattern cascade existant.
6. **mcp-doc-reset.js** (PreCompact) : reset des DEUX compteurs (tool + turn).
7. **settings.json** (PROD, prudence) : câbler le hook UserPromptSubmit. Prouver sur COPIE d'abord.
8. **doctor.js** : Probe « compteur turn incrémente » + négative-check dans doctor.test.js
   (saboter la porte turn → doctor hurle « voie turn »). cloneFrameworkWithSources si besoin.
9. **Miroirs** (si turn-count a de la logique pure) : mutate + vitest.stryker include +
   mutation.yml + dep-cruiser includeOnly (mutation-workflow-gate le vérifie).
10. **Différentiels** : relancer porte-differential + mcp-differential (gate changé). Vert obligatoire.
11. **Mutation** : re-muter gate.js + skill.js + modules touchés → 100%.
12. **Codex** : nouvel événement UserPromptSubmit à porter (l'ajouter au contrat de portage).
13. **Docs** : skill (arbo + doctrine) + PHILOSOPHY (§5, driftUnit devient « construit ») +
    doc injectable skill-source.md + cette entrée → marquer FAIT.

### Zéro doublon — les points de vigilance
- Compteur turn = MÊME mécanisme session-store que le compteur outil (pas un 2ᵉ store).
- Cascade driftUnit = MÊME pattern 3 étages que mode/threshold (pas une 2ᵉ logique de cascade).
- gate choisit le compteur par driftUnit = UN point de décision (pas de smart dupliqué tool/turn).

### Rappel du VERDICT (ne pas recâbler par réflexe)
driftUnit = FEATURE, pas qualité structurelle → n'affecte que `smart` (le maillon faible :
`dumb` pour les gardes, `once` pour les pointeurs couvrent le réel). Valeur MARGINALE.
Construire UNIQUEMENT si un besoin réel de « compter les tours » apparaît. Sinon, laisser tel quel.

## 18/07/2026 — Périmètre skill : chemins RELATIFS couverts par CONFIG, `cwd` REJETÉ (décision mainteneur)
- Trou constaté : un agent DANS le dossier du projet (`npm test`, `sed gate.test.js`) n'émet aucune
  chaîne contenant le nom du dossier → skill non déclenché.
- Fix moteur tenté (cwd du hook ajouté aux chemins matchables) puis **REVERTÉ sur décision
  mainteneur** : `cwd` n'est PAS garanti par tous les harnais (portabilité) et le besoin se couvre
  en PURES DONNÉES — le `match` du skill liste les NOMS DE FICHIERS distinctifs du projet
  (doc-inject, lib-pure, turn-count…), présents dans tout chemin relatif. Zéro moteur touché.
- Limite résiduelle initialement assumée (`npm test` seul), puis **cwd RÉOUVERT ET AJOUTÉ le jour
  même, APRÈS la mesure doc-first exigée** : `cwd` = champ COMMUN des contrats de hooks des DEUX
  harnais (Claude Code : champ commun de tout payload · Codex CLI v0.114+ : payload de base
  session_id/transcript_path/cwd/hook_event_name). Signal universel → conforme à l'invariant n°7
  (universalité). Implémentation FAIL-SOFT (harnais sans cwd → comportement d'avant), consommée
  par la SEULE source skill (parité protect-files intacte par construction). Les noms distinctifs
  du `match` RESTENT (double couverture : chemins relatifs + cwd).

## 19/07/2026 — AUDIT ZÉRO-BLOCAGE : 3 frontières NOMMÉES (pas des murs — fix pré-identifié, à faire sauter SEULEMENT sur douleur réelle)
Verdict d'audit complet (toutes fonctionnalités passées en revue, zéro doublon certifié) :
le langage couvre tout le décidable SAUF 3 asymétries, chacune JUSTIFIÉE et avec sa sortie :
1. **Docs MCP sans scope/exclude** (frontmatter MCP = mode/threshold/driftUnit seulement).
   Justif : matching MCP exact = zéro faux positif à filtrer, aucune douleur mesurée.
   Fix pré-identifié : admettre scope/exclude dans validateMcp + declFor — même algèbre, ~1h.
   Cas déclencheur : « même serveur, 2 projets, 2 contextes de doc ».
2. **Skills sans `confirm`** (pas d'ask à l'entrée d'un périmètre en écriture).
   Justif : un skill = savoir, pas un garde. Fix : étendre confirmFor aux decls skill.
3. **Skills sans `rank`** (ordre inter-skills = ordre du JSON — contrôlable de facto, quasi-moot).
Doctrine : fonctionnalité sans douleur mesurée = interdite — on GARDE les 3 frontières telles
quelles. Une frontière écrite avec sa sortie ≠ un blocage. NE PAS les construire préventivement.

## CHANTIER SUIVANT — Portage Codex (backlog gravé 19/07/2026, session dédiée)

> Contexte : Codex installé sur le PC du mainteneur (à METTRE À JOUR d'abord) ; utilisateur réel = l'associé (cousin), sur SA machine. Hooks Codex vérifiés à la doc officielle du 19/07/2026 (learn.chatgpt.com/docs/hooks) : activés par défaut, Windows supporté (commandWindows / windows_managed_dir), PreToolUse couvre Bash + apply_patch + MCP + outils locaux (PAS les outils hébergés type WebSearch), trust par hash (/hooks), événements SessionStart/PreToolUse/PreCompact/PostCompact/UserPromptSubmit/SubagentStart/SubagentStop/Stop. ⚠️ payload PreToolUse SANS agent_id → sous-agents Codex = état partagé maître (limitation OpenAI, scopeId l'absorbera dès qu'exposé). Schémas canoniques = codex-rs/hooks/schema/generated (source de vérité wire format).

Contrat = skill §« Porter le framework sur un NOUVEAU HARNAIS » (moteur INTOUCHABLE, coquilles only) :
- [x] Phase 0 — FAIT 19/07/2026 : Codex 0.130.0 → 0.144.6 (npm). Doc officielle re-lue le jour même : PostToolUse EXISTE (apply_patch/Bash/MCP) · SessionStart couvre source=compact · MCP tool_name = `mcp__srv__tool` IDENTIQUE · `permissionDecision: "ask"` = parsed but NOT supported · apply_patch = patch dans `tool_input.command` · stdout hookSpecificOutput/systemMessage/decision:block = dialecte COMMUN Claude/Codex.
- [x] Phase 1 — FAIT 19/07/2026, MIEUX que prévu (zéro copie) : cœurs partagés extraits (`porte-core.js`, `guard-core.js`) ; 2 coquilles Codex seulement (`codex-doc-inject.js` = ask dégradé sans permissionDecision · `codex-doc-write-guard.js` = chemins via extractFilePaths) ; reset/turn-count/session-inject SE CÂBLENT TELS QUELS (dialecte identique). Fix contrat : extractFilePaths accepte `command` (shape réel Codex ≥ 0.144).
- [x] Phase 2 — FAIT 19/07/2026 : suites spawn codex-doc-inject.test.js + codex-doc-write-guard.test.js ; doctor probes 7-8 + `--codex-hooks` (câblage 5 voies, fichiers = CE repo, anti-double injection protect-files) ; negative-checks 3g/3h/7 (sabotage copie → hurlement prouvé). npm test + mutation 100% + check:all verts.
- [x] Phase 3 — FAIT 19/07/2026, câblé + PROUVÉ END-TO-END dans un run Codex VIVANT (`codex exec --dangerously-bypass-hook-trust` : doc porte.md retrouvée dans le transcript du run). **Faits de TERRAIN (contre la doc)** : ① Codex 0.144 IGNORE `~/.codex/hooks.json` quand config.toml existe → câblage = `config.toml` [[hooks.*]] UNIQUEMENT (hooks.json renommé .ignored-by-codex-0144.bak) ; ② payload hook réel : `tool_name: "Bash"` MÊME quand le function_call du modèle s'appelle shell_command → le Bash-scan du moteur marche tel quel ; ③ pas d'agent_id (confirmé live). protect-files retiré du câblage même geste ; doctor --codex-hooks config.toml = 37/37 ; doctor auto à chaque SessionStart Codex. TRUST RÉSOLU 0-HUMAN (19/07/2026 soir) : câblage déplacé en politique machine `C:\ProgramData\OpenAI\Codex\requirements.toml` (hooks MANAGÉS, doc officielle : « trusted by policy ») — PROUVÉ par run `codex exec` SANS bypass (PreToolUse/PostToolUse exécutés + doc dans le transcript). Aucun /hooks requis, ni pour le mainteneur ni pour le cousin (Phase 4 : poser le même requirements.toml chez lui). Piège annexe corrigé : config.toml avait 9 clés mcp_servers DUPLIQUÉES (manuel vs bloc sync) = Codex REFUSAIT de démarrer ; + model gpt-5-codex MORT avec compte ChatGPT (à changer, cf modèles cache gpt-5.5/5.6).
- [ ] Phase 4 — distribution cousin : repo de parc en git pull (JAMAIS de copie manuelle) + doctor comme gate d'installation sur sa machine. ACCÈS GITHUB POSÉ 19/07/2026 : l'associé invité en READ ONLY sur Soyouse/mcp-doc-hooks — il FORK et propose des PR, SEUL le propriétaire merge (master intouchable par construction ; branch protection impossible en privé gratuit — GitHub Pro si un jour accès write direct voulu)

## 20/07/2026 — 🔴 BACKLOG : INJECTION TRONQUÉE EN SILENCE (défaut VÉCU, prioritaire)

**Classe d'erreur** : le hook a fonctionné, le marqueur était vert, **et le contenu n'est pas arrivé**.
Vécu deux fois dans une même session, sur deux repos différents.

**Mécanisme** : le hook rend son contenu sur stdout. Au-delà d'un seuil de taille, le harnais
(Claude Code) n'injecte PAS le texte : il l'écrit dans un fichier de résultats et ne présente
qu'un **aperçu des ~2 premiers Ko**, précédé de `Output too large (NN KB)`. L'agent reçoit donc
l'INTRO du skill et rien d'autre — arborescence, invariants et conventions restent hors contexte.

**Mesuré** : skill projet = 45,9 Ko rendus → ~2 Ko reçus (≈ 4 %). Skill du framework lui-même =
43,4 Ko → même troncature. Les deux ont affiché leur marqueur `🧩 skill:` normalement.

**Pourquoi c'est grave** : l'agent ne peut pas savoir qu'il lui manque quelque chose — il travaille
sur une intro en croyant avoir le contrat. Aucun signal, aucune ligne rouge. C'est très exactement
le mode d'échec que le framework existe pour supprimer (le vert qui ment). Un skill qui GROSSIT
franchit le seuil un jour, et son injection se dégrade en silence à partir de là, sans commit ni
changement de config — donc sans rien à qui imputer la régression.

**Deux corrections, de natures différentes — les DEUX, jamais l'une à la place de l'autre :**

1. **Moteur (fail-loud, obligatoire)** : mesurer la taille de ce qu'on rend AVANT de le rendre.
   Au-delà du seuil, ne PAS émettre un pavé en espérant qu'il passe : émettre un contenu court qui
   DIT qu'il est tronqué + le chemin du fichier complet à lire. Le silence est le bug ; un agent
   informé va lire, un agent non informé invente. ⚠️ Le seuil est imposé par le HARNAIS, pas par
   nous : le découvrir par mesure et l'encoder en donnée, ne jamais le deviner.
2. **Gate statique (0-human)** : tout skill/doc dont le rendu dépasse le seuil ⇒ ROUGE au pre-push,
   avec le poids mesuré dans le message. Sinon la règle « docs < 10 lignes / progressive
   disclosure » reste une consigne en prose — et une consigne en prose ne tient pas 40 sessions.

**Conséquence côté CONTENU (hors moteur, à traiter séparément)** : un skill de 45 Ko réinjecté à
chaque entrée de périmètre viole la progressive disclosure du framework, troncature ou pas.
Cible = tier-1 court (invariants/pièges) + `*-reference.md` à la demande. Le gate ci-dessus rend
cette dette VISIBLE au lieu de la laisser grossir jusqu'au seuil.

⚠️ **NE PAS traiter comme un cas particulier d'un skill trop gros.** Le défaut est dans le contrat
moteur↔harnais : « rendre plus que ce que le harnais accepte » doit être une ERREUR BRUYANTE,
pour n'importe quelle doc, aujourd'hui et à toute taille future.

---

## 💡 Commentaires NON injectés dans les docs — idée le mainteneur, 03/08/2026 (NON tranchée)

**Le besoin.** Une doc porte DEUX publics : l'agent qui AGIT (rappel court, réinjecté à chaque
geste) et l'agent qui MAINTIENT la doc (provenance, péremption d'une source tierce, historique de
scission, date d'élargissement d'un pattern). Le second coûte des tokens à CHAQUE injection sans
rien apprendre sur le geste en cours.

**Piste.** Une syntaxe strippée à l'injection — le moteur retire déjà le frontmatter, l'endroit
existe — mais présente dans le fichier quand un agent l'ouvre pour l'éditer.

🛑 **BORNE OBLIGATOIRE SI ON LE FAIT, sinon la feature est NUISIBLE.** Seul le méta SANS valeur au
moment de l'usage : « re-vérifier cette page éditeur après AAAA-MM », « scindée depuis X ».
⚠️ **JAMAIS LE POURQUOI D'UNE RÈGLE.** Un invariant privé de sa raison DÉRIVE — le suivant ne voit
pas ce qu'il casse et le contourne. Le risque n'est pas technique, il est **gravitationnel** : dès
qu'une zone invisible existe, le « pourquoi » y migre parce qu'il est long et « encombre ».

⚠️ **ALTERNATIVE À ÉPUISER D'ABORD — ZÉRO CODE, DÉJÀ DISPONIBLE.** Une page `*-reference.md` SANS
`match` n'est jamais auto-injectée : c'est déjà « du texte réservé à qui maintient », à coût nul.
⇒ **Ne coder ce système QUE si l'usage réel des `*-reference.md` prouve qu'elles ne suffisent pas.**
Sinon c'est un 2ᵉ mécanisme pour un besoin couvert — la définition d'une dette.

**Piste ÉCARTÉE le même jour, avec sa raison (ne pas la rouvrir).** L'idée de départ était
« injecter une doc AU MOMENT de l'erreur ». Écartée : le bon déclencheur n'est pas l'erreur mais
**le geste qui la précède** — une doc qui `match` la commande arrive AVANT la faute, donc l'erreur
n'a pas lieu du tout. Prévention > runbook. Aucune modification du moteur n'était nécessaire :
`planificateur-os.md` a été écrit le même jour sur ce principe (vérifié par spawn, positif sur
`schtasks`, muet sur `systemctl restart nginx`). Seule la question du méta invisible a survécu.

---

## 🔴 DEUX DÉFAUTS DU MOTEUR, OBSERVÉS EN USAGE RÉEL (session pw-mcp-proxy, 03/08/2026)

### ① ÉVICTION : il déclare une doc OBLIGATOIRE puis ne la livre pas
Message vu ~10 fois dans UNE session, jusqu'à **4 docs évincées d'un coup** :
« N doc(s) NON injectée(s) faute de place dans cette trame. **Elles ne sont PAS optionnelles.** »
Ce n'est pas un bug : segments indivisibles + `DEFAUT_BUDGET` 8000 + corpus qui grossit = **plafond
atteint**. Mais le résultat est qu'un agent travaille parfois SANS un invariant réputé garanti, et
il ne peut pas savoir ce qu'il a manqué (le nom seul ne porte pas le contenu).
Pistes non tranchées : budget par tour plus élevé · priorité (un `🛑` passe avant un rappel de
confort) · **scinder plus agressivement** (le format « <10 lignes » n'est PAS tenu par tout le
corpus — plusieurs docs du parc font 20-30 lignes) · évincer d'abord les `once` déjà consommés.

### ② AUCUNE DÉFENSE CONTRE UNE DOC QUI MENT — le plus grave
Le 03/08, **TROIS docs enseignaient l'INVERSE du code** : `pw-mcp-child-guard.md` imposait le
`stdio:'ignore'` qui ÉTAIT le défaut à corriger · `pw-mcp-transports.md` affirmait « pas conforme
au 404 » deux heures après la mise en conformité · `pw-mcp-concierge.md` décrivait `ONSTART`,
abandonné pour du XML. Elles n'ont été corrigées que parce qu'un agent PASSAIT dessus.
🛑 **Une doc injectée qui a tort est PIRE que pas de doc** : elle porte le ton d'un invariant prouvé
(`🛑 OBLIGATOIRE`) et personne ne la remet en cause. Cas limite atteint le même jour : le GATE
`stdio:'ignore'` ET sa doc disaient la même chose FAUSSE — deux remparts d'accord entre eux et tous
deux à côté. Il a fallu un audit humain pour en sortir.
Piste : un **drift-test doc↔code** (une doc qui cite un littéral de code — `stdio:'ignore'`,
`ONSTART`, un nom de fonction — doit pouvoir prouver que ce littéral EXISTE encore dans le fichier
qu'elle documente). ⚠️ Ne couvre que les affirmations CITABLES, jamais la prose — mais c'est déjà
ce qui a menti trois fois sur trois.

**CHIFFRES DE ① (mesurés 03/08/2026) — la cause n'est PAS « un peu juste » :**
budget `DEFAUT_BUDGET` = **8000**. En face : skill `agent-social` **83 160** · `webzenon-infra`
**77 670** · `mcp-doc-hooks` **28 402** · doc `pw-mcp-tests.md` **6 808** (85 % du budget à elle
seule).
🛑 **Un skill fait 3,5 à 10× le budget ENTIER : il ne peut JAMAIS être livré**, et comme les
segments non livrés sont réessayés indéfiniment, il est **annoncé à chaque tour, pour toujours**.
C'est le pire des deux mondes : jamais délivré ET bruit permanent. Même symptôme que le skill
`pw-mcp-proxy` (23 Ko), sorti du périmètre le 03/08 pour cette raison exacte.
⇒ Deux problèmes DISTINCTS, à ne pas confondre : (a) les skills sont hors-jeu par conception —
soit on les découpe en sections déclenchables, soit on cesse de prétendre les injecter ; (b) des
docs dépassent le format « <10 lignes » du parc et mangent le budget des voisines.

**⚠️ LES DOCS AUSSI SONT ÉVINCÉES — pas seulement les skills (le cas skills est déjà connu).**
Preuve du 03/08 : `.claude/hooks/docs/stryker-runner-choice.md` évincée **pendant la correction des
configs Stryker du parc**, c'est-à-dire au moment EXACT où elle servait. Poussée dehors par des
skills qui, eux, ne pouvaient de toute façon jamais passer.
Arithmétique, skills mis de côté : `pw-mcp-logger.md` (2 463) + `pw-mcp-child-guard.md` (5 104)
= 7 567 → passe de justesse. Mais `pw-mcp-tests.md` seule = **6 808 = 85 % du budget** ⇒ elle +
n'importe quoi = éviction.

🛑 **PISTE « GATE DE TAILLE » — REJETÉE le 03/08/2026 (décision mainteneur), ne PAS la rouvrir.**
Elle consistait à rougir toute doc de `.claude/hooks/docs/` au-delà de N caractères, pour forcer la
scission. **Erreur de couche** : « < 10 lignes / scinder en tier-1 + `*-reference.md` » est la
convention D'USAGE d'UN déploiement (anti-dilution), **jamais une règle du framework**. Un gate du
moteur qui l'impose transforme une préférence locale en contrainte universelle et **fait porter à
l'AUTEUR de la doc un défaut du TRANSPORT**.
⇒ **Inversion de la cible : le framework DOIT livrer une doc de n'importe quelle taille.** Chaque
déploiement écrit ce qu'il veut, comme il veut ; si ça ne passe pas, le bug est dans le moteur.
C'est aussi la condition de l'ambition « standard multi-harnais » (§2bis) : un moteur qui dicte le
format de son contenu n'est pas un standard.
⚠️ Corollaire déjà appliqué (03/08) : les mentions « <10 lignes » présentées comme une règle du
framework ont été retirées de `README.md`, `HOOK-INTERNALS.md` et du skill (+ miroir). Le volet ⑤
de `couverture-gate` (cliquet sur le poids des skills) reste SUSPENDU — il mesurait la même chose
au mauvais endroit.
⚠️ Reste VRAI et non contesté : **ne PAS « régler » le problème en gonflant `DEFAUT_BUDGET`** (le
contexte est fini ; un budget qui enfle dilue tout le reste). La solution est le TRANSPORT, cf. le
chantier « INJECTION INTÉGRALE » — découverte du plafond, fragmentation, déclencheur par segment.
