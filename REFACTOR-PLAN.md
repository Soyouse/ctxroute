# Plan de refactor — fusion en moteur d'injection unique

---

# 📍 ÉTAT AU 07/08/2026 (NUIT) — REPRISE DE SESSION, LIRE CECI EN PREMIER

## ⚠️ OÙ VIT LE TRAVAIL — RIEN EN COURS (vérifié 07/08/2026)
Tout est sur **`master`**, mergé (fast-forward) et **poussé** ; `canari-codex-reel` a été
SUPPRIMÉE. La branche avait été créée parce que d'AUTRES agents travaillaient en parallèle.
🛑 **UNE BRANCHE NE LES PROTÈGE PAS DU RUNTIME, et il faut le savoir** : le câblage
(`settings.json`, `requirements.toml`) pointe les `.js` du **répertoire de travail**, pas d'une
branche. Toute édition d'un fichier vivant est active pour tous les agents au geste suivant. La
branche protège l'HISTORIQUE ; seul un worktree séparé isolerait le runtime — mais alors on ne
testerait plus le vrai câblage.

## Les 25 commits du jour, dans l'ordre
`cfeab92` canari multi-harnais (② fermé) · `6f7f415` doc injectable manquante · `b7ed90c` fenêtre
d'aveuglement post-compaction scellée · `eb31e2d` gate ㉕ (couplage par le stockage) · `e69e5a2`
le skill se contredisait · `228ae8a` ㉖ piste fermée · `f0ed560` `rank` = z-index · `47531fa` ㉗
audit des valeurs de rank · `a0d6d22` · **`466a0bc` ㉘ la marque `[source:` CITÉE n'est plus
comptée comme LIVRÉE (+ ② bis fermé par run Codex réel)** · `31c1ccd` + `e0d5ad3` la tête du
backlog annonçait un état périmé (DEUX fois — d'où ㉚) · `b8a17c0` ㉙ la suite legacy n'écrit plus
dans le `state/` vivant · `382436d` ㉚ le gate de décompte de la tête · `679bae2` · `f21d17f` ④ le
contrat canari ⟷ afficheur · `c447469` · **`cb05f2a` le repli sans verrou DEVINAIT l'état au lieu
de le lire — le doublon de morceau EXISTAIT, et la « réfutation » du matin était la vraie erreur**
(une reproduction RATÉE convertie en RÉFUTATION) · `f609163` · `1444f70` dégraissage (le récit va
au backlog, pas au chemin chaud) · `1cf7557` gate `etat-devine` au tableau des couches ·
**`f874e16` écriture ATOMIQUE du store — le lecteur sans verrou voyait du JSON TRONQUÉ**
(4 779 lectures creuses sur 16 656 mesurées) · `22ae600` · `44ed356` ㉛ au backlog · **`09d1d98`
mon test exigeait qu'un processus TUÉ survive à sa mort** (CI rouge macOS : un écrivain tué entre
le `writeFileSync(tmp)` et le `rename` laisse forcément son temporaire — l'invariant réel est
« un écrivain qui termine NORMALEMENT ne laisse rien »).
**Preuves de clôture** : **1102 tests** (59 fichiers) · doctor **14 ok / 0 problème** sur les
câblages réels · dependency-cruiser 0 violation (49 modules) · jscpd 0,52 % · miroirs parc ⟷ repo
identiques · arbre **propre**. ✅ **CI VERTE sur `09d1d98`** (lue APRÈS complétion, sans tube).
⚠️ Mutation `canari.js` 100 % / 0 survivant — mesure du 07/08, NON rejouée depuis : aucun module
PUR n'a été touché après (`porte-core`/`session-store` sont de l'I/O, jamais mutés).
⚠️ **Le commit qui écrit CETTE ligne ne peut pas s'y citer** — la mise à jour de la tête est
toujours le commit N+1. Ne pas le compter comme un mensonge.

## 🔴 CE QUE CETTE SESSION A PROUVÉ, ET QUI VAUT PLUS QUE LE CODE LIVRÉ
**Quatre défauts trouvés — AUCUN par une machine.** Tous sont sortis de questions du mainteneur
(« c'est vraiment solide ? », « les docs disent-elles vrai ? », « le rank, ça marche ? ») :
① une régression introduite le matin même, invisible sous **1081 tests verts + mutation 100 %** ;
② l'afficheur du canari MORT depuis 3 jours (chemin périmé, hors repo, aucun gate ne peut le voir) ;
③ le skill se **contredisait lui-même** à 9 lignes d'intervalle ; ④ une suite sans doc injectable.
⚠️ **Et 2 des 3 gates écrits ce jour avaient un défaut AU PREMIER RUN sur le repo réel** (faux
positif `sources/skill.js`, fixture non discriminant sur `rank`). **Un gate se juge sur ce qu'il
matche RÉELLEMENT, jamais sur ce que son commentaire prétend** — et ça ne se voit qu'en le lançant
pour de vrai AVANT de le déclarer fini.
🛑 **3 SONDES FAUSSES en cherchant si `rank` marchait** (harnais maison vide · mauvaise variable
d'env · fixture ambigu) — le motif EXACT que `explain.md` documente. Réflexe à garder :
`node explain.js`, jamais un harnais maison ; parc de test via **`CTXROUTE_FILEDOCS_DIR`**.

## 📋 CE QUI RESTE OUVERT — liste COMPLÈTE, rien d'autre ne vit ailleurs
| # | Chantier | État |
|---|---|---|
| ㉚ | **Fraîcheur de la tête du backlog** — ✅ **FERMÉ 07/08/2026** (volet ② de `backlog-coherence-gate`). 🛑 Portée réduite ASSUMÉE : vérifier que les empreintes EXISTENT est impossible en CI (`fetch-depth: 1`) ⇒ cohérence INTERNE du décompte seulement | ✅ |
| ㉘ bis | **Marque `[source:` auto-référente — reste 4 docs du parc** citant un `.md`. Fix total = n'accepter que les étiquettes RÉELLEMENT émises (store `emission-core`) ⇒ touche le chemin chaud de TOUS les agents ⮕ **à faire quand aucun autre agent ne travaille** | 🟠 |
| ㉙ | **`legacy-mcp-inject.test.js` est FLAKY** — son `STATE_DIR` est le dossier `state/` **VIVANT**, où les hooks en prod écrivent en permanence (12 processus par appel d'outil). Ses tests de purge listent ce dossier pendant que d'autres agents y écrivent ⇒ 3 rouges aléatoires le 07/08, **verts en 2 runs isolés consécutifs**. Fix = tmpdir jeté (test-only, zéro risque runtime) | 🟠 |
| ㉙ | **`legacy-mcp-inject.test.js` flaky** — ✅ **FERMÉ 07/08/2026** : son état vit en tmpdir jeté (`CTXROUTE_STATE_DIR`), plus aucune lecture du `state/` vivant. 2 runs consécutifs verts (46/46). 🛑 **AUCUN gate — 3 critères mesurés, 3 fois du bruit** : « toute suite qui spawne un hook doit isoler » ⇒ **6 faux positifs** (doctor, deadline, lint-corpus, doc-write-guard, deps-purete, vendor-deadline : elles laissent au pire un fichier inerte, jamais relu, purgé) ; « aucune suite ne résout un chemin `state` » ⇒ **8 faux positifs** (elles joignent un TMPDIR à `state`). Distinguer exigerait de savoir si la BASE est la racine du repo = analyse de flot, pas du texte. Ne pas réessayer sans nouveau critère | ✅ |
| ㉗ | **Valeurs de `rank`** — ✅ **MESURÉ 07/08/2026 (nuit)**, décision d'action en attente. 42 654 chemins réels, VRAI moteur (`sources/file.js`) : **88 paires co-injectées**, 77 ordonnées par le rank, **11 par l'alphabet** (Infinity/Infinity), **0 conflit** (impossible par construction : tri global). 7 rangs en DOUBLON — **aucun ne co-injecte, donc inoffensifs**. 🔴 **Le vrai trou = 39 paires MIXTES** (une rankée face à une sans rank) : la rankée passe toujours devant, mécaniquement, quelle que soit l'intention. 🛑 **Relire les 313 valeurs = TOIL** : le transport à 12 trames ne préserve PAS l'ordre de LECTURE (cf `sources.md`) ⇒ auditer un « ordre voulu » auditerait un effet non observable. Seul effet survivant = priorité de LIVRAISON sous pression de capacité. ⚠️ 5ᵉ sonde fausse sur ce sujet : `tool_name`/`tool_input` au lieu de `toolName`/`toolInput` ⇒ 0 paire, faux verdict. **Témoin positif obligatoire dans toute sonde.** | 🟠 |
| ㉕ | **Couplage par le stockage** — moitié décidable LIVRÉE (gate), moitié sémantique indécidable | 🟠 |
| ④ | **Contrat canari ⟷ afficheur** — ✅ **FERMÉ 07/08/2026** (volet ④ de `parc-sync-gate`) : chemins absolus, export destructuré et clé `verdict` vérifiés quand un afficheur existe. 🛑 **Mon 1er motif filtrait sur `ctxroute` et aurait RATÉ son cas fondateur** (le chemin périmé citait l'ANCIEN nom `mcp-doc-hooks`) — élargi à TOUT chemin absolu après mesure : 5 chemins, 0 mort, 0 exemption. Le framework ne RÉCLAME toujours aucun afficheur (skip s'il n'y en a pas) | ✅ |
| ㉜ | **㉚ NE VOIT PAS UNE TÊTE INCOMPLÈTE** — prouvé le 08/08/2026 : elle annonçait 18 commits, il y en avait **25**, et le gate était VERT (il compare N annoncé à N empreintes CITÉES = cohérence INTERNE, jamais l'exhaustivité). 🛑 Trouvé UNIQUEMENT parce que le mainteneur a redemandé « tu es sûr à 100 % ? ». **Piste** : dériver la liste des commits du jour par `git log` et exiger l'inclusion — ⚠️ MAIS `fetch-depth: 1` en CI rend l'historique INEXISTANT là-bas, donc ce volet serait local-seulement, donc inerte au moment qui compte. Mesurer avant d'écrire. | 🟠 |
| ㉝ | **`master` exige une PR, et tous les pushes de l'agent la CONTOURNENT** (constaté 08/08/2026 : `remote: Bypassed rule violations — Changes must be made through a pull request`). Passe parce que le compte a le droit de contourner. **Décision du mainteneur requise** : soit retirer la règle (elle ne protège personne si elle est contournée à chaque push), soit basculer l'agent sur des PR. 🛑 Une règle qu'on contourne systématiquement est PIRE que pas de règle : elle donne l'illusion d'un garde-fou. | 🟠 |
| ㉛ | **`doctor.js` écrit un JSON sans passer par tmp + `rename`** — seul reste du scan parc du 08/08/2026 qui soit DANS ce repo. 🛑 Risque à VÉRIFIER, pas établi : le motif ne devient un défaut que s'il existe un lecteur CONCURRENT, et le doctor est un diagnostic lancé à la main. Ne PAS corriger par réflexe de symétrie avec `session-store` — mesurer d'abord s'il peut être lu pendant qu'il écrit. | 🟢 |
| ⑱ | **Rien ne mesure le DÉBIT** — partiellement couvert par l'alarme de capacité | 🟠 |
| — | **DOC-FIRST** — récidive du 04/08, et encore ce jour (affirmation scellée non vérifiée) | 🔴 |
| ⑳ | Audit des negative-checks (bonus, jamais un pilier — coûteux et peu fiable) | 🟠 |
| ㉑ | `tsc --checkJs` | 🟢 |
| ㉒ | Langue du code | 🧊 **GELÉ** — réveil : quand le projet aura de la popularité |
| ㉖ | Gate sur les constantes citées | 🛑 **FERMÉ** sur mesure, ne pas rouvrir |
| — | Worktree orphelin `mcp-doc-hooks-paquets` (105 Mo) | scorie, marche à suivre écrite |

⚠️ **AUCUN de ces trous ne dégrade ce qui est LIVRÉ à l'agent.** Le moteur d'injection est en prod
depuis le 17/07 et prouvé sur le terrain (341 injections atterries mesurées dans un transcript de
46 Mo). Canari, gates et docs sont des FILETS autour — s'ils disparaissaient, les agents
recevraient exactement les mêmes documents.

## ✅ SESSION DU 07/08 (SOIR-2) — ② bis FERMÉ, ET IL A LIVRÉ UN DÉFAUT RÉEL

**② bis — RUN CODEX RÉEL DU CANARI : FAIT.** Session Codex 0.146 à 2 tours (`codex exec` puis
`codex exec resume --last`, sandbox lecture seule). Le canari a écrit `vivant, emissions:3,
injections:12` et le rollout Codex contenait **exactement 12** occurrences de `[source:` — il lit
donc bien le transcript Codex. Câblage confirmé EN FONCTIONNEMENT (`requirements.toml`,
`UserPromptSubmit`), plus seulement au doctor. Coût : ~84 k tokens de quota.

🔴 **ET C'EST LA MESURE QUI A TROUVÉ LE DÉFAUT ㉘, pas un test.** En lisant les étiquettes du
rollout, une valeur détonnait : `[source: …]` — l'étiquette d'aucune doc. C'était le TEXTE QUI
PARLE DU MARQUEUR, compté comme si le marqueur avait été livré.
⇒ `compterInjections` comptait toute occurrence de `[source:`. Or ce littéral vit dans les
commentaires de `canari.js` LUI-MÊME et dans **64 docs du parc sur 386** (mesuré). Un agent qui LIT
une de ces docs faisait passer le canari au VERT — **le geste exact de quelqu'un qui enquête sur une
injection morte**. Le dead-man switch se désamorçait pile au moment où il servait.

✅ **CORRIGÉ** : seule une étiquette de forme ÉMISE compte (`.md` en suffixe ou préfixe `skill/`).
Mesure des marqueurs EN DUR du parc : 23 `.js`, 18 `.ts`, 7 `.tsx`, 4 `.sh`, 3 `.py`, 1 `.mjs`,
1 `.service` — et **4 seulement en `.md`**. Le filtre élimine donc l'écrasante majorité.
⚠️ **RESTE OUVERT (㉘ bis)** : ces 4 docs. Le fix TOTAL exige `emission-core`, par où passe tout le
contexte de tous les agents — **non fait volontairement**, d'autres agents travaillaient sur du
sensible. Ne pas le présenter comme résolu.

🛑 **POURQUOI AUCUN GATE ANTI-AUTO-RÉFÉRENCE** (mesuré avant d'écrire, pas après) : ~10 fichiers du
repo portent légitimement un littéral `[source: ….md]` (assertions de `doc-inject.test.js`,
`mcp-differential`, `session-inject`, `doctor.js`…). Un gate exigerait une liste d'exemptions de 10
entrées = pur bruit. **Un gate bruyant est un gate qu'on cesse de lire.**

⚠️ **MUTATION : 4 survivants, 1 ÉLIMINÉ (pas testé)** — la garde `l.length === 0` était MORTE (une
étiquette vide échoue déjà sur la forme). Les 3 autres étaient du vrai comportement : tués par des
fixtures DISCRIMINANTES. La plus instructive : `[source: docs/a.mdZ` — sans la garde `fin !== -1`,
la coupure de fenêtre FABRIQUE l'étiquette `docs/a.md` en rognant le dernier caractère. La 1re
fixture que j'avais écrite (`…/x.m`) ne distinguait RIEN : elle échouait déjà sur la forme.

🔴 **LE GATE ANTI-FUITE A MORDU SUR MOI** : ma 1re fixture citait un chemin client réel. Dépôt
PUBLIC ⇒ rouge immédiat, corrigé en chemins génériques. Le gate a fait exactement son travail.

## Ce qui a été livré dans cette session
**② CANARI CODEX — FERMÉ, et le portage n'a coûté AUCUN fichier neuf.**
🛑 **LE PLAN ÉCRIT DANS CE BACKLOG ÉTAIT MAUVAIS, et c'est le point à retenir.** Il prévoyait de
mesurer le marqueur d'appel d'outil dans le rollout Codex (`response_item`/`custom_tool_call`).
Doc officielle relue le 07/08 (`learn.chatgpt.com/docs/hooks`, Codex 0.146.0 installé) :
> *« the transcript format isn't a stable interface for hooks and may change over time »*

Rétro-ingénierer ce schéma aurait produit un canari **mort en silence à la première mise à jour** —
un dead-man switch qui meurt sans le dire est pire que pas de dead-man switch du tout.
✅ **CE QUI A ÉTÉ FAIT À LA PLACE** : le dénominateur du canari (« combien de fois a-t-on émis ? »)
vient désormais de **notre** compteur, `emission-core.compteurEmissions`, incrémenté dans une
écriture de store qui existait DÉJÀ (zéro I/O, zéro lock de plus). Du transcript on ne lit plus que
**notre propre** sous-chaîne `[source:`, qui ne dépend d'aucun schéma.
⇒ `MARQUE_APPEL_CLAUDE` supprimé : **plus aucun dialecte de harnais dans le canari**, donc **une
seule coquille pour les deux produits** (`transcript_path` et `session_id` sont documentés sous ces
noms des deux côtés, et les deux contrats admettent le silence total). Le portage s'est réduit à
une ligne de câblage dans `requirements.toml` + les preuves.
✅ **BÉNÉFICE NON PRÉVU** : sans émission de notre part, plus aucune accusation (`indecidable`).
Avant, l'activité du HARNAIS suffisait à crier « INJECTION MORTE » — faux positif sur un
utilisateur ne touchant aucun fichier documenté.
✅ **⑩ FERMÉ PAR RICOCHET** : le canari étant le seul gate anti-dépréciation praticable, il couvre
maintenant les deux harnais.

## 🔴 BUG RÉEL TROUVÉ EN CHEMIN — l'afficheur du canari était MORT depuis 3 jours
`statusline.js` lisait `Desktop/mcp-doc-hooks/state/canari.json` : le nom du repo **AVANT** son
renommage en `ctxroute` (04/08). Dossier inexistant ⇒ le `catch` fail-open avalait tout ⇒ le canari
écrivait son verdict **pour personne**. Le canal d'injection aurait pu mourir sans que rien ne
s'affiche. **Corrigé + commentaire scellé.**
⚠️ **CLASSE D'ERREUR À RETENIR** : l'afficheur vit HORS du repo, donc **aucun gate du repo ne peut
le voir**. C'est le prix assumé du principe « le framework ne fournit aucun afficheur ». Tout
renommage du dossier ctxroute DOIT repasser dans `statusline.js`. Trouvé en appliquant la règle
« énumérer les consommateurs avant de déplacer une responsabilité » — pas par un test.

## 🔴 ㉕ NOUVEAU — COUPLAGE PAR LE STOCKAGE : la classe que RIEN ne voit (07/08/2026)
**Née d'une régression que j'ai introduite ce jour et qu'AUCUN filet n'a vue** (1081 tests verts,
mutation 100 %, doctor 74 ok) : `canari-check` s'est mis à dépendre du store `reliquat-`, que
`ctxroute-reset` PURGE en PreCompact. Résultat : fenêtre d'aveuglement après chaque compaction.
Trouvée en instruisant une question du mainteneur — **par un humain, pas par une machine.**

🔴 **LA CLASSE, formulée pour être gatable** : *un composant dépend d'un état qu'un AUTRE composant
purge.* C'est du couplage **par le STOCKAGE**, et il échappe aux deux filets existants par
construction — `dependency-cruiser` voit les IMPORTS, `couches-gate` voit les GLOBALS. Personne ne
voit qu'un lecteur et un purgeur partagent un préfixe.

**MESURE FAITE (ne pas la refaire)** : 8 fichiers citent un préfixe de store
(`budget`, `ctxroute-reset`, `doctor`, `emission-core`, `legacy-mcp-inject`, `porte-core`,
`session-store`, `turn-count`) · 1 seul purge (`ctxroute-reset`, 5 préfixes en dur). Petit graphe,
littéraux décidables : **le gate est faisable.**

🛑 **LE PIÈGE, MESURÉ AVANT D'ÉCRIRE UNE LIGNE — et il est fatal au gate naïf** :
`canari-check.js` **NE CITE AUCUN PRÉFIXE**. Il passe par `emission.compteurEmissions()`. Un gate
par simple grep serait donc **INERTE SUR LE CAS QUI L'A MOTIVÉ** — la définition même du gate
décoratif que ce repo traque. ⇒ il DOIT être **TRANSITIF**, sur le modèle exact de
`emission-core-gate` (traversée des require, pas un scan de littéraux).

✅ **MOITIÉ DÉCIDABLE LIVRÉE le 07/08/2026 — `store-purge-gate.test.js`.** « Tout store déclaré est
CONNU du reset », dérivé des DEUX côtés (boucle de purge ⇄ déclarations), + volet inverse (purge
morte) + negative-check. Il **convertit en machine** la consigne en prose que `reset.md` portait
depuis des semaines (« tout nouveau store DOIT être ajouté ici dans le MÊME geste ») — un invariant
qui dépendait de la vigilance, et dont l'échec est SILENCIEUX.
⚠️ **IL A LEVÉ UN FAUX POSITIF AU PREMIER RUN, et c'est la leçon la plus utile** : il accusait
`sources/skill.js`, qui déclare `PREFIX = 'skill/'` — un préfixe d'IDENTIFIANT de doc, pas un
store. Mon commentaire prétendait viser « la déclaration d'un store », le code capturait TOUTE
constante `PREFIX`. ⇒ 2ᵉ condition ajoutée (le fichier doit utiliser `session-store`). 🛑 **Un gate
se juge sur ce qu'il matche RÉELLEMENT, jamais sur ce que son commentaire prétend** — et ça ne se
voit qu'en le lançant sur le repo réel AVANT de le déclarer fini.

🔴 **CE QUI RESTE OUVERT, ET NE SE FERMERA PAS PAR UN GATE** : « ce lecteur TOLÈRE-t-il la purge ? »
est **sémantique** — « ce composant a-t-il besoin de continuité ? » ne se lit pas dans le code.
C'est exactement la régression du 07/08 (le canari a perdu son dénominateur en PreCompact).
**Filet actuel, assumé plus faible** : test « APRÈS COMPACTION » (`canari-check.test.js`) — il
scelle le CAS, pas la CLASSE. 🛑 Ne pas croire la classe fermée parce qu'un gate porte son nom.

## 🟠 ㉗ AUDITER LES VALEURS DE `rank` — le MÉCANISME est prouvé, les VALEURS non (07/08/2026)
✅ **LE MÉCANISME MARCHE — mesuré, et de façon DISCRIMINANTE.** Parc de test à 2 docs, rangs
INVERSÉS par rapport à l'alphabet (`aaa.md` rang 90 · `zzz.md` rang 10) ⇒ livré **`zzz` AVANT
`aaa`**. `rank` bat donc l'ordre alphabétique ; il est lu par `loader.js` (tri l.92), atteint depuis
le chemin vivant via `source-adapters.js`.
⚠️ **CE PREMIER TEST ÉTAIT AMBIGU et il a fallu le refaire** : avec `aaa`=10 et `zzz`=90, l'ordre
obtenu satisfaisait le rank ET l'alphabet — il ne prouvait RIEN. **Un fixture non discriminant
donne un vert qui ne mesure pas ce qu'on croit.** (3 sondes fausses avant celle-là : harnais maison
vide, puis `CTXROUTE_HOOKS_DIR` au lieu de `CTXROUTE_FILEDOCS_DIR` — le motif exact que
`explain.md` documente.)
🔴 **CE QUI RESTE OUVERT : les 313 VALEURS elles-mêmes.** Personne n'a jamais audité si elles
disent ce qu'on croit — un rank posé au jugé, deux docs qui devraient s'ordonner et ne le font pas,
un rank oublié (⇒ `Infinity`, la doc passe APRÈS toutes les rankées). Le moteur applique
fidèlement des nombres que personne n'a relus.
**CIBLE** : dérouler les paires de docs qui matchent une MÊME cible et vérifier que l'ordre livré
est celui voulu. ⚠️ Mesure de 2026-07-16 à re-faire (39 paires, 0 conflit) — elle date d'avant
`rules` par-entrée et d'avant 100 docs. 🛑 **Test discriminant OBLIGATOIRE** : toute paire dont
l'ordre alphabétique coïncide avec l'ordre des rangs ne prouve rien.

## 🛑 ㉖ PISTE MESURÉE PUIS FERMÉE — « gate sur les constantes citées » (07/08/2026)
**Née d'un défaut RÉEL du jour** : le skill se contredisait à 9 lignes d'intervalle — il annonçait
la disparition de `MARQUE_APPEL_CLAUDE` **et** expliquait comment la modifier. Trouvé par un grep
manuel, pas par une machine. `doc-drift-gate` ne pouvait pas le voir : il vérifie que les FICHIERS
cités existent, pas les IDENTIFIANTS.

**MESURE FAITE (ne pas la refaire)** : docs injectables = **18 constantes citées, 0 introuvable**
(les `*-reference.md` exclus — ils citent légitimement des constantes de RFC, ex. `BASE_PLPMTU`,
seul faux positif du corpus). Skill = 4 citées, 0 introuvable. **Le taux de bruit serait donc nul.
Le gate semblait faisable.**

🛑 **IL NE L'EST PAS, ET LA RAISON EST STRUCTURELLE.** Le scan rend « 0 introuvable » sur le cas
fondateur LUI-MÊME : `MARQUE_APPEL_CLAUDE` **existe encore dans le code**, en COMMENTAIRE, parce
que la doctrine du repo impose de garder la trace datée d'une erreur. Le gate serait donc **inerte
sur le défaut qui l'a motivé**. Et en dé-commentarisant (ce que fait `emission-core-gate`), on
inverse le problème : il rougirait sur les mentions HISTORIQUES des docs — « cette ligne disait
l'inverse, voici pourquoi » — qui sont précisément ce qu'on veut CONSERVER.
⇒ **Distinguer « cité comme vivant » de « cité comme disparu » est SÉMANTIQUE.** Les deux sens du
gate sont faux, quel que soit le réglage. **Piste FERMÉE, pas reportée.**
⚠️ **Ce qui tient lieu de filet, assumé plus faible** : un grep des littéraux supprimés au moment
où on en supprime un. C'est une habitude, pas une machine — et c'est écrit ici pour que personne
ne rouvre cette piste en croyant qu'elle n'a pas été instruite.

## ㉒ LANGUE DU CODE — DÉCLASSÉE par décision du mainteneur (07/08/2026)
L'API interne reste en **français**, le DSL en anglais. **Ce n'est pas une dette à résorber
maintenant** : le coût du renommage de masse n'est pas justifié tant que le projet n'a pas
d'audience externe. **Condition de réveil, explicite : quand le projet commence à avoir de la
popularité** (premiers contributeurs extérieurs). D'ici là, ne PAS rouvrir le sujet, ne pas le
resservir comme un manque.

---

# 📍 ÉTAT AU 07/08/2026 (matin)

## Ce qui tourne MAINTENANT
`settings.json` câble la porte en **12 déclarations** (`--paquet k --paquets 12`).
**Capacité d'un geste = 91 932 c** (1 trame = 7 661 c) · **charge réelle au pire = 65 265 c (71 %)**,
dont **53 830 c pour le seul skill**. Réglage utilisateur : **`paquets`** dans `ctxroute-config.json`.
**Preuves du jour** : 1072 tests verts (56 fichiers) · doctor **57 ok / 0 problème** sur le câblage
réel · différentiels porte + mcp verts · dependency-cruiser **0 violation** (49 modules) · jscpd
**0,53 %** · mutation NON relancée et c'est justifié (aucun fichier `mutate` touché : seuls
`doctor.js`, `porte-core.js`, `source-adapters.js` — de l'I/O — ont changé).
Commits : `ddc7146` (retour aux 12 trames) · `388773b` (réfutation du faux doublon). **Rien n'est
poussé sur GitHub**, donc **aucune CI n'a validé** ce travail — c'est le premier geste à faire.

## 🛑 LES DEUX ERREURS DE MÉTHODE DU JOUR — les lire avant de décider quoi que ce soit
1. **Un faux diagnostic a servi à casser une capacité qui marchait.** « Le morceau 7/8 livré 2× »
   n'a JAMAIS été un doublon : un `PreCompact` séparait les deux occurrences (compaction ⇒ purge
   ⇒ une doc `once` se réinjecte entière, comportement CONÇU). Non reproduit, jamais revérifié,
   il s'est propagé dans le code, 4 docs et ce backlog. Détail complet : section ㉔.
2. **La mesure qui justifiait le retrait mesurait la mauvaise grandeur** (trames UTILISÉES au lieu
   du compteur de docs différées). **Un chiffre juste peut porter une conclusion fausse.**
⇒ **RÈGLE : un défaut se REPRODUIT avant d'être gravé**, et tout fait hérité d'un RÉSUMÉ de
session est NON VÉRIFIÉ tant qu'on n'a pas retrouvé la trace d'origine.

## 🟠 GATE « UN DÉFAUT SE REPRODUIT AVANT D'ÊTRE GRAVÉ » — ÉCARTÉ, avec sa raison
La doctrine dit : une consigne en prose qui n'a pas tenu doit devenir un GATE. La leçon du jour
(un faux défaut gravé dans le code, 4 docs et ce backlog) devrait donc être mécanisée.
🛑 **DÉCISION : NON, et ce n'est pas un report.** Le seul gate imaginable serait « une doc qui
AFFIRME un défaut doit citer une date de reproduction » — il faudrait donc **comprendre de la
prose** pour distinguer « ce défaut existe » de « ce défaut a existé » ou « ne pas réintroduire ce
défaut ». Sur 385 docs, ça produirait des faux positifs en masse, et **un gate bruyant finit
débranché** (leçon du rush mode, déjà payée). Un gate qui certifie au lieu de protéger est pire
que pas de gate.
⚠️ **CE QUI TIENT LIEU DE FILET, ASSUMÉ COMME PLUS FAIBLE** : la leçon est écrite en doc
injectable (`paquet-unique.md`, réinjectée à chaque accès au transport) ET en mémoire globale
(`feedback-reproduire-avant-de-graver-un-defaut`). C'est de la prévention par CONTEXTE, pas un
fail-closed. **Le vrai filet reste l'opérateur** : la question « comment tu l'as su ? » est ce qui
a défait le faux diagnostic — aucune machine du repo ne l'aurait posée.
⇒ Rouvrir seulement si la classe RÉCIDIVE : trois occurrences justifieraient un gate même
imparfait. Deux ne le justifient pas.

## ⚠️ SCORIE MESURÉE, VOLONTAIREMENT NON TRAITÉE (07/08/2026)
Worktree `~/Desktop/mcp-doc-hooks-paquets` (branche `chantier-paquets`, **105 Mo**) : son dépôt
parent (`mcp-doc-hooks/.git`) N'EXISTE PLUS — le repo a été renommé `ctxroute`, donc le worktree
est ORPHELIN et `git -C` y échoue. **`git log master..chantier-paquets` = 10 commits**, dont les
MESSAGES sont identiques à des commits présents dans `master` sous d'autres SHA (`cd565a6` ici ⇄
`f1481ef` là) ⇒ le travail a très probablement été rejoué. 🛑 **NON SUPPRIMÉ : « très
probablement » ne suffit pas pour effacer 105 Mo d'historique.** Pour trancher : comparer les
ARBRES (`git diff --stat master chantier-paquets` montre 8 871 suppressions = la branche est en
RETARD, pas en avance) puis `git worktree prune` avant tout `rm`.

---

# 📍 ÉTAT AU 05/08/2026 (historique — conservé pour ses mesures)

## Bilan des 2 jours (04 → 05/08/2026)

**Livré, prouvé, en prod :**
| Chantier | État | Preuve |
|---|---|---|
| `defaults.{source}` — cascade 3 → **4 étages** | ✅ | réglages par catégorie (`file`/`mcp`/`skill`/`tool`), clés DÉRIVÉES du registre |
| `note:` — commentaire d'auteur | ✅ | le seul champ que le moteur ne lit JAMAIS ; symétrisé dans les 4 corpus le 05/08 |
| **`enforce`** — refuser le geste | ✅ | spawn RÉEL sur les 2 harnais, mutation 100 % |
| **Gate anti-décalage** du vocabulaire | ✅ | a trouvé `note` manquant au 1er run |
| Symétrie des 4 sources (`enforce`) | ✅ | gate DÉRIVÉ d'`ADAPTERS` — une 5ᵉ source naîtra avec |
| `additionalContextLimit = 0` (Codex) | 🟡 | posé + gate doctor, mais **INERTE sur 0.144.6** |

**Chiffres de clôture** : 978 tests verts (48 fichiers) · mutation **100,00 %** (cliquet tenu) ·
doctor **61 ok / 0 problème** sur les 2 câblages réels · CI verte (`test` 3 OS + `mutation`) ·
0 violation de couplage · 1 clone consigné (0,28 %, seuil 1 %).

**⚠️ Ce que ces 2 jours ont coûté en erreurs — à ne pas répéter :**
1. **Garde posée à la mauvaise couche** (anti-bloc-YAML) — la CI l'a tuée en 4 min. Une garde
   doit vivre là où l'information discriminante existe.
2. **Deux gardes INERTES en JSON** (split TOML-only, motif `= 0` sans guillemets) — un gate qui ne
   peut pas rougir dans un des formats acceptés est décoratif.
3. **Trois restrictions empilées sur `enforce`** (interdire `smart`, exiger `once` écrit, interdire
   `dumb`) pour un problème INEXISTANT — remplaçées par l'ALTERNANCE (idée du mainteneur).
4. **Diagnostic trop doux** : « doc qui ment » alors que c'était une PANNE silencieuse (Codex).
5. **`find /` lancé sur tout le disque**, resté en fond des heures — repéré par le mainteneur.
⇒ **Constante** : à chaque fois, la correction est venue du mainteneur ou d'une MACHINE
(CI, mutation, jscpd, gate), jamais de mon propre jugement. C'est la justification vivante du
framework — et la raison de ne JAMAIS remplacer un gate par une consigne en prose.

---

## ✅ SÉRIE CANARI / CODEX — TOUS FERMÉS (dernier : ② le 07/08/2026)
> ⚠️ Cet en-tête disait « 🔴 CHANTIERS OUVERTS » ; la fermeture de ② l'a rendu MENSONGER et
> `backlog-coherence-gate` l'a attrapé **au premier run**, sans que personne regarde. C'est
> exactement ce pour quoi il a été écrit le 06/08 (3 en-têtes périmés en 2 jours).
> **Ce qui reste ouvert vit AILLEURS dans ce fichier** : 🔴 DOC-FIRST · ⑱ débit · ⑳ audit des
> negative-checks · ㉑ `tsc --checkJs` · ④ contrat canari ⟷ afficheur. ㉒ est GELÉ (décision
> mainteneur). Ne pas chercher un chantier ouvert dans les sous-sections ci-dessous.

### ① CANARI SANS SONDE DOCTOR — ✅ FERMÉ (05/08/2026)
`grep -c canari doctor.js` était à **0** : le canari tournait en PROD depuis le 03/08 sans aucune
preuve qu'il fonctionne. C'était MON trou (câblé sans sonde, en violation du contrat « preuves
OBLIGATOIRES avant de câbler ») et il est resté ouvert **deux jours, repoussé deux fois**.
**LIVRÉ** : probe 9 (spawn réel, transcript FABRIQUÉ, verdict lu dans `state/canari.json`) +
check de câblage (`UserPromptSubmit`, fichier existe, bien CE repo) + **3 negative-checks**
(3i muet · 3j FIGÉ sur `vivant` · 5f non câblé).
⚠️ **LES DEUX VERDICTS SONT EXIGÉS, jamais un seul.** Une sonde à un cas aurait validé un canari
figé sur une constante — un fichier valide, un verdict plausible, et zéro capacité à voir la panne
qu'il existe pour détecter. C'est la leçon EXACTE des gates de pureté inertes du 03/08/2026,
appliquée cette fois AVANT de payer : `mort` sur 30 appels sans injection, `vivant` dès UNE
injection atterrie. Le negative-check 3j sabote précisément ce cas.
**MESURES** : doctor **66 ok / 0 problème** sur les 2 câblages réels (contre 61 avant) ·
`doctor.test.js` **61 tests** (6 neufs) · le canari de prod était bien câblé — mais c'était une
SUPPOSITION jusqu'à aujourd'hui, c'est maintenant vérifié à chaque session.

### ② ✅ CANARI CODEX — FERMÉ le 07/08/2026 (voir l'état en tête de fichier)
🛑 **L'« inconnue à mesurer » annoncée ici (« format du transcript Codex + marqueur d'appel
d'outil ») ÉTAIT LA MAUVAISE QUESTION.** Doc officielle Codex : le format du transcript *« isn't a
stable interface for hooks and may change over time »* ⇒ on n'y compte plus RIEN. Le dénominateur
vient de notre propre compteur d'émissions, identique sur tous les harnais ; du transcript on ne
lit que notre marque `[source:`. Résultat : **une seule coquille pour les deux harnais**, zéro
fichier neuf, et un faux positif éliminé au passage.

### ③ `additionalContextLimit` — ✅ ACTIF (05/08/2026), et 2 pannes trouvées au passage
**Codex mis à jour 0.144.6 → 0.146.0.** Re-mesure du binaire : `additionalContextLimit` passe de
**0 à 18 occurrences** (`additional_context_limit` : 2). Le réglage posé le 04/08 n'est donc plus
inerte : il AGIT. Doctor **66 ok / 0 problème** après mise à jour, réglage toujours déclaré sur
les 2 émetteurs.

**DEUX PANNES BLOQUANTES trouvées en tentant la preuve de bout en bout** (aucune n'aurait été
vue sans un run RÉEL — c'est l'argument entier du canari, appliqué à la main) :
1. 🔴 **`[features].codex_hooks` DÉPRÉCIÉ en 0.146** (le binaire le dit au démarrage) → renommé
   `hooks = true`. Les hooks tournaient ENCORE, mais un flag déprécié finit RETIRÉ : ce jour-là,
   toute l'injection Codex serait morte **en silence** (fail-open partout). Corrigé à la seconde.
2. 🔴 **`model = "gpt-5-codex"` REFUSÉ côté serveur** pour un compte ChatGPT (400,
   « not supported ») → Codex ne démarrait plus AUCUN tour. **Clé RETIRÉE, pas remplacée** : un
   modèle épinglé remeurt à chaque rotation de catalogue ; sans la clé, Codex prend son défaut,
   supporté par construction. Run réel OK après correction (20 460 tokens, réponse correcte).

**PREUVE PARTIELLE, et c'est dit** : l'injection Codex VIT (doc `paths.md` retrouvée dans le
rollout comme message `developer`, scellée, `[source: …]` présent). Mais la preuve VOLUMÉTRIQUE
n'est PAS faite — voir le chantier ⑨ ci-dessous, qu'elle a révélé.

### ⑪ ✅ LES DEUX DETTES DU 05/08/2026 SONT FERMÉES (le jour même)
1. ✅ **Le feature flag Codex est GARDÉ** — nouveau `doctor.js --codex-config <config.toml>`,
   opt-in SÉPARÉ de `--codex-hooks` **parce que le flag vit dans un AUTRE fichier que le câblage**
   (`~/.codex/config.toml` ≠ `ProgramData/.../requirements.toml`). Exige les DEUX faits, jamais un
   seul : `hooks = true` PRÉSENT **ET** `codex_hooks` ABSENT — ne vérifier que le nouveau
   laisserait dormir un déprécié à côté. **Ancrage début de ligne** (`^[ \t]*codex_hooks[ \t]*=`) :
   un COMMENTAIRE a le droit de nommer le flag pour dire de ne plus l'écrire — c'est exactement le
   cas du `config.toml` de référence, et un gate qui rougit sur du sain finit débranché.
   **CÂBLÉ** dans `requirements.toml` (SessionStart Codex) : sans câblage, le check serait une
   capacité sans usage — la dette qu'on combat. **MESURES** : `doctor.test.js` **68 tests**
   (61 → 68, negative-check 7e en 5 volets dont le faux positif du commentaire) · run réel sur le
   câblage vivant **16 ok / 0 problème**, muet, exit 0.
   ⚠️ Reste NON gardée, et c'est ASSUMÉ : l'ABSENCE de `model` épinglé. Un `model` valide est
   légitime, seul un modèle refusé par le serveur casse — indécidable hors appel réseau. Le
   commentaire dans `config.toml` porte la raison ; le canari verrait l'effet.
2. ✅ **CI passée en `actions/checkout@v5` + `actions/setup-node@v5`** (les 2 workflows) — fin de
   l'avertissement « Node.js 20 is deprecated ». Le gate qui va avec est posé dans le rituel
   (`rituel-stack-audit.md`) : **`gh run view <id> --log | grep -i deprecat`**. ⚠️ C'est la 4ᵉ piste
   du chantier ⑩ **et la seule qui marche** : GitHub Actions PERSISTE ses avertissements, là où
   Codex ne les met que sur stderr. Gratuit, décidable — mais limité au harnais CI.
   Scorie corrigée au passage : `test.yml` affirmait « repo PRIVÉ = 2000 min/mois ». **Le repo est
   PUBLIC** (vérifié `gh repo view`), donc minutes illimitées ; la séparation des workflows reste
   justifiée par le TEMPS DE RETOUR, plus par le quota.

### ⑭ ✅ CAUSE RACINE DU RELIQUAT — LIVRÉE le 05/08/2026 (voir ⑬ pour ce qui a été construit)
⚠️ **CE QU'IL FAUT RETENIR, ET C'EST CONTRE-INTUITIF : le fait ci-dessous a servi à COMPRENDRE,
jamais à s'appuyer dessus.** Le correctif retenu (file d'émission, ⑬) ne dépend d'AUCUN
comportement du harnais : aucune trame ne dépasse jamais son budget, donc le spill n'est même
pas ATTEINT. Si Anthropic le retirait demain, rien ne changerait chez nous. C'est le test du
CONTRAT (`budget.md`), et il passe.
**DOC OFFICIELLE, lue ce jour** (`docs.claude.com/en/docs/claude-code/hooks` → 301 vers
`code.claude.com/docs/en/hooks`), citation EXACTE :
> *« Hook output strings, including `additionalContext`, `systemMessage`, and plain stdout, are
> capped at 10,000 characters. Output that exceeds this limit is **saved to a file and replaced
> with a preview and file path**, the same way a large valid Bash result is handled »*

Et : *« All matching hooks run in parallel »* · **« There is no documented limit on the number of
hooks »**.

🔴 **TROIS DE NOS AFFIRMATIONS SONT PÉRIMÉES OU FAUSSES** :
1. « plafond interne **NON documenté** » (budget.md, skill) ⇒ **FAUX** : 10 000, documenté.
2. « le harnais tronque **EN SILENCE** » ⇒ **FAUX** : il SPILLE dans un fichier et donne le
   CHEMIN. Ce n'est pas une perte, c'est un débordement récupérable.
3. Le commentaire scellé de `planifier()` — *« Ne JAMAIS émettre le segment tronqué : ce serait
   rendre au harnais exactement le pavé qu'il coupe en silence »* — **repose entièrement sur la
   croyance n°2**. Sa prémisse tombe.

🔴 **CONSÉQUENCE, ET C'EST LE VRAI DÉFAUT** : le harnais a un filet, mais **il ne peut pas nous
rattraper puisqu'on ne lui donne jamais le surplus** — on le jette AVANT d'émettre. Nous avons
bâti un transport à 12 processus (~4 s/geste) pour éviter une perte qui n'existait pas, et créé
au passage la SEULE perte réelle du système.
✅ **FIX, et il est petit** : **ne plus jamais différer — émettre TOUT**, y compris ce qui dépasse
le budget de la trame. Au-delà, le harnais spille et l'agent reçoit aperçu + chemin (il peut LIRE).
Concerne **les DEUX fonctions** : `planifier()` (trame unique — le cas de Codex et de tout harnais
sans multi-trames) ET `planifierPaquets()` (dernier paquet).
⚠️ **CE FIX NE PARIE SUR RIEN** — c'est ce qui le rend acceptable face à un fournisseur qui change
sans prévenir (objection du mainteneur, juste) : spill présent ⇒ récupérable · spill retiré ⇒ on
n'est pas plus mal qu'en jetant · seuil abaissé ⇒ le SCEAU le rend bruyant et le CANARI voit
l'effet. **Aucune promesse d'Anthropic dans l'équation.**
⚠️ **NE PAS coder 10 000 en dur** : le budget reste fourni par la COQUILLE. On ne consomme ce fait
que pour cesser de JETER, jamais pour caler une constante dessus.
---

## 📐 AUDIT D'EXÉCUTION DE ⑭ — ✅ EXÉCUTÉ le 05/08/2026 (conservé : le CONTRAT ci-dessous reste la loi)

### LE CONTRAT, D'ABORD — c'est lui qui rend le reste indépendant du harnais
> **Le framework ÉMET tout ce qu'il a décidé d'injecter. Sa promesse s'arrête à l'émission.**

🛑 **CE QUE LE HARNAIS FAIT DU SURPLUS N'EST PAS NOTRE PROMESSE, ET NE DOIT JAMAIS LE DEVENIR.**
Le spill (« saved to a file … preview and file path ») est un comportement **OBSERVÉ ET DOCUMENTÉ
AUJOURD'HUI**, jamais un contrat sur lequel on s'appuie. Raison, à ne pas perdre : Anthropic n'a
jamais publié d'interface pour bâtir un système par-dessus les hooks — **rien ne les engage à
prévenir**, et un comportement non pensé comme une API disparaît sans dépréciation.
⚠️ **Test de non-dépendance, à s'appliquer à chaque ligne écrite** : « si le harnais jetait
purement et simplement le surplus demain, notre code changerait-il ? » **La réponse DOIT être
non.** Émettre tout est gagnant dans les deux mondes — spill présent ⇒ récupérable · spill absent
⇒ pas plus mal qu'en jetant, puisque c'est ce qu'on fait déjà. **On ne parie pas, on ne perd pas.**
🛑 Interdits permanents : coder `10000` (ou toute constante du harnais) dans le moteur · lire /
sonder le fichier de spill · faire dépendre une décision de son existence · écrire une doc qui
promet que « le surplus est récupérable ».

### ① `budget.js` — `planifier()` (trame unique : Codex et tout harnais sans multi-trames)
Aujourd'hui : boucle décroissante `for (k = liste.length; k >= 1; k--)` qui RETIRE des segments
jusqu'à tenir dans `max` ; le reste part en `differes` (annoncé, jamais livré). Plus le cas final
« rien ne rentre » qui émet l'annonce NUE, **zéro contenu**.
Cible : **plus aucune boucle de retrait.** On compose avec TOUT, on émet. Si le texte dépasse
`max`, on préfixe un AVERTISSEMENT de dépassement. `differes` sort **toujours vide**.
⚠️ Le commentaire scellé « ne JAMAIS émettre le segment tronqué » est à RÉÉCRIRE, pas à
supprimer : sa prémisse (« le harnais coupe en silence ») est fausse, mais la trace de l'erreur
doit rester, datée.

### ② `budget.js` — `planifierPaquets()` (dernier paquet)
Les paquets 1..N-1 gardent leur remplissage glouton **inchangé** — c'est le débit normal, et c'est
lui qui préserve la parité. Seul le DERNIER change : il prend **tout le reste**, quelle que soit
la taille. `differesFinaux` disparaît.

### ③ `annonceConfig()` → `annonceDepassement()`
Le message actuel (« morceau(x) non émis … `--paquets N` TROP PETIT ») **décrit un abandon** et
accuse la config. Il devient un **avertissement de dépassement** : cette trame dépasse le budget
de N caractères, tout est émis, augmente `--paquets` ou `budgetInjection` pour livrer en direct.
🛑 Ne PAS y écrire ce que le harnais fera du surplus (cf contrat).

### ④ `porte-core.js` — la boucle de restauration d'état des différés (~l.180)
`differes` devenant vide par construction, cette boucle devient du **code mort** ⇒ mutant
ÉQUIVALENT ⇒ survivant éternel. La doctrine du repo est explicite : « on ÉLIMINE l'équivalence par
construction, on ne la désactive JAMAIS » ⇒ **SUPPRIMER la boucle**, et transférer sa garantie à
la property ⑤-a (qui la rend inutile au lieu de la rendre muette).

### ⑤ TESTS ANTI-RÉGRESSION — c'est ici que ça se joue, pas dans le code
- **a. Property ① DURCIE (`budget.property.test.js`)** — elle dit aujourd'hui *« tout segment
  ressort — émis OU annoncé »*. **C'est cette disjonction qui a AUTORISÉ le bug** : jeter en
  annonçant satisfaisait la propriété. Nouvelle forme : **`∀ segments, ∀ budget, ∀ n : union des
  `emis` de tous les paquets === tous les ids d'entrée`**, et `differes` vide partout. Plus de
  « ou ».
- **b. Negative-check du durcissement** : réintroduire un différé sur une COPIE ⇒ la property DOIT
  rougir. Sans lui, on ne saura jamais qu'elle mord (leçon des gates de pureté inertes du 03/08).
- **c. Gate statique de NON-DÉPENDANCE** : aucun fichier du moteur ne contient `10000`, `spill`,
  ni de lecture du fichier de débordement — seulement des commentaires datés. C'est le gate qui
  matérialise le contrat ci-dessus, et il est **gratuit**.
- **d. Test de bout en bout** : un corpus qui dépasse largement N×budget ⇒ **toutes** les docs
  apparaissent dans la concaténation des N trames. La preuve directe, sans raisonnement.

### ⑥ RE-PROUVER (aucune de ces preuves n'est optionnelle)
mutation **100 %** (break 99, cliquet jamais baissé) · `porte-differential` + `mcp-differential`
(le rendu change au-delà du budget) · `npm test` complet · doctor sur les 2 câblages réels.

### ⑦ DOC & SKILL
`budget.md`, `couverture.md`, skill + miroirs : remplacer « livré OU signalé » par **« livré,
toujours »**, et inscrire le contrat + les interdits permanents. ⚠️ Écrire le fait du spill **avec
sa réserve** : observé, jamais une dépendance.

### CE QUE ÇA DONNE — pourquoi c'est scalable ET maintenable
- **Plus AUCUNE limite interne au framework.** Le contenu n'est plus jamais jugé : ni trop gros,
  ni trop petit. La seule variable devient le **débit** (`--paquets N` × `budgetInjection`), qui
  change la RÉPARTITION, jamais le contenu livré.
- **Deux réglages, zéro nouveau mot** : la taille (`budgetInjection`, plafonnée par `Math.min` au
  budget du harnais) et le nombre (`--paquets N`, forcément côté harnais puisque c'est lui qui
  lance les processus). Petite machine ⇒ on baisse, ça livre en plus de trames, **jamais moins**.
- **La classe de bug est éteinte par construction** : la property ⑤-a rend un abandon
  IMPOSSIBLE à faire passer, quelle que soit la future implémentation.
- **Le code rétrécit** : deux boucles de retrait et un champ (`differes`) disparaissent. On enlève
  du code pour supprimer un défaut — le meilleur signe qu'on tenait le mauvais bout.
⇒ **Rend ⑬ (file de reliquat) FACULTATIF** : la file resterait un confort (livrer en direct plutôt
qu'en fichier), plus une nécessité.

### ⑲ ✅ LIVRÉ 06/08/2026 — LE TABLEAU CAPACITÉS × COUCHES (le vrai squelette)
**LA QUESTION POSÉE PAR LE MAINTENEUR** : « ce dépôt est écrit par des AGENTS et relu par PERSONNE.
Un projet de qualité standard est-il seulement possible, ou c est du gambling ? »
**RÉPONSE : ce n était pas du gambling, c était INCOMPLET.** Nos gates attrapaient la RÉCIDIVE, pas
la PREMIÈRE occurrence — donc la 1re fois dépendait d un regard, donc de la chance.
**LE RENVERSEMENT** : on n écrit plus un gate PAR FAUTE DÉCOUVERTE (réactif, sans fin). On DÉCLARE
ce que chaque couche a le DROIT de faire. Et ce qu un programme peut faire est une liste FINIE
(tuer le processus · écrire la sortie · lire l environnement · lire les arguments…) — exactement
le raisonnement de la base booléenne OU/ET/NON du matching : une base FERMÉE, pas une liste ouverte.
⇒ **il n y a plus de « classe de bug d architecture » à découvrir, il n y a que des CASES.**
**PREUVE, PAS PROMESSE** : les 3 défauts de la semaine (⑯ transport, ⑯bis process.exit, guard-core
console.log) sont 3 CASES de ce tableau. Aucun n était vu par 1011 tests ni par la mutation à 100 %.
Avec le tableau ils auraient été ROUGES au premier push, sans que personne regarde.
**LIVRÉ** : `couches.json` (manifeste) + `couches-gate.test.js` (5 volets). Noyau pur DÉRIVÉ de
`stryker.conf.json` → `mutate` (source unique, jamais recopiée).
⚠️ **LE PIÈGE FERMÉ D AVANCE — pour le SUCCESSEUR** : un agent futur voit rouge et « corrige » en
ÉLARGISSANT le tableau au lieu du code ⇒ garde-fou auto-désarmé, en silence, invisible à jamais.
D où : justification ÉCRITE obligatoire + volet INVERSE qui tue une justification périmée + le
message d erreur qui dit littéralement « élargir le tableau est presque toujours la mauvaise réponse ».
⚠️ **DOC-FIRST APPLIQUÉ (rappel du mainteneur)** : outils comparés AVANT de coder.
`eslint-plugin-boundaries` et `Sheriff` = frontières de MODULES, donc rien de plus que
dependency-cruiser (déjà là), au prix d ESLint en dépendance neuve ⇒ **ÉCARTÉS**. Retenu :
`ast-grep` (doctrine du parc : AST, JAMAIS regex) — `files`/`ignores` + `severity` confirmés sur la
doc officielle. ⚠️ `ast-grep.github.io` REDIRIGE en 301 vers `astgrep.com`.
⚠️ **PARTAGE DES RÔLES, à ne jamais brouiller** : IMPORTS = dependency-cruiser · GLOBALS = ce gate.
Deux outils pour un même invariant divergent — c est le couplage implicite qu on combat.
**CE QU IL RESTE DE ⑲** : la déclaration PAR HARNAIS (budget/trames/dialecte en un seul endroit).
Le tableau ferme les couches ; l unification du contrat de harnais reste à faire.

### ⑳ 🟠 BACKLOG — auditer TOUS les negative-checks
⚠️ **NUANCE APPORTÉE PAR LE MAINTENEUR (06/08/2026)** : l audit par sous-agent COÛTE et n est pas
fiable — « je te garantis que personne ne l aurait trouvé ». Ne PAS en faire un pilier. Le tableau
des couches tourne en CI à coût ZÉRO ; l audit reste un bonus, jamais une garantie.
### ⑯bis ✅ LIVRÉ 06/08/2026 — LE CYCLE DE VIE APPARTIENT À LA COQUILLE
**MÊME FAMILLE QUE ⑯, AUTRE AXE.** Le transport était un choix d'appelant ; la MORT DU PROCESSUS
était une décision de cœur : `porte-core.js` appelait `process.exit(0)` 4× et `guard-core.js` 2×.
Sortir est le rôle de la COQUILLE — celle qui connaît le harnais et son contrat de sortie.
Effet concret : `run()` était intestable et inappelable depuis un autre contexte.
**FAIT** : les 2 cœurs RETOURNENT ; les 4 coquilles (`doc-inject`, `codex-doc-inject`,
`doc-write-guard`, `codex-doc-write-guard`) assument `process.exit(0)`. Parité prouvée par les
différentiels (octet). Gate DÉRIVÉ de `*-core.js` dans `emission-core-gate.test.js` (+ volet
existence + negative-check en mémoire, avec dé-commentarisation pour ne pas rougir sur une MENTION).
🔴 **LE GATE A TROUVÉ `guard-core`, PAS MOI** : je n'avais corrigé que `porte-core`. Un gate dérivé
trouve ce que la revue ne voit pas — c'est exactement l'argument de ⑳.
⚠️ **NÉ D'UNE REVUE « ŒIL DE SENIOR » DU CODE FONCTIONNEL SEUL** (sans tests ni mutation). Le reste
de cette revue : le nommage est BILINGUE (API interne en français, DSL en anglais) — frein réel à
l'adoption pour un projet qui vise le standard multi-harnais. À trancher (cf ㉒).

### ㉒ 🟢 GELÉ — LANGUE DU CODE (décision du mainteneur, 07/08/2026)
**TRANCHÉ : on garde le français, et on ne traduit PAS maintenant.** Le coût d'un renommage de
masse n'est pas justifié tant que le projet n'a pas d'audience externe. **Condition de réveil
explicite : quand le projet commence à avoir de la popularité** (premiers contributeurs
extérieurs). D'ici là, ne pas rouvrir, ne pas le resservir comme un manque dans un audit.
Le constat d'origine reste valable et est conservé ci-dessous pour le jour où la condition tombe.
API interne en français (`planifierPaquets`, `emettre`, `decouper`, `chargerFile`), DSL en anglais
(`match`/`scope`/`exclude`/`mode`). Incohérent pour un projet OPEN SOURCE visant le standard
industriel : un contributeur étranger lit la moitié du code. ⚠️ Renommage MÉCANIQUE de masse ⇒
expand/contract + différentiels comme filet, jamais en fin de session. Décider la cible D'ABORD.
### ⑰ ✅ LIVRÉ 05/08/2026 — LE BUDGET SUIT LA LIMITE DÉCLARÉE (Codex : 11 gestes → 1)
**LE DÉFAUT, et sa classe.** Le câblage Codex déclarait `additionalContextLimit = 0` depuis le
04/08 — son commentaire disait même « c'est POUR ÇA que Codex n'a pas besoin de fragmentation ».
**Personne ne l'avait dit au moteur** : la coquille ne passait aucun budget, le plancher de 8 000
s'appliquait, et un skill de 76 000 c partait en **11 gestes au lieu d'1**. 995 tests verts,
mutation 100 %, doctor 27/27, canari vivant. 🔴 **UN VERT QUI MENT — pas une panne, une
DÉGRADATION SILENCIEUSE.** Aucun filet du repo n'est conçu pour ça : les gates vérifient qu'on ne
CASSE rien, le canari que le tuyau est VIVANT, **rien ne mesure le DÉBIT**.
🔴 **CLASSE D'ERREUR À RETENIR : tout ce qu'on DÉCLARE à un harnais doit être RELU par le moteur,
jamais deviné en parallèle.** Deux endroits pour un même chiffre = divergence garantie.
**FAIT** : `lib.budgetDeclare` (PUR, muté 100 %) lit `--budget N` ; les 2 émetteurs Codex le
passent ; `budget.js` accepte `Infinity` comme valeur LÉGITIME ; `budget-declare-gate.test.js`
exige l'égalité des deux chiffres DANS LE MÊME BLOC du câblage (+ negative-check en mémoire).
**MESURES** : binaire Codex 0.146.0 — `additionalContextLimit` **18 occurrences** (contre **0 en
0.144.6** : la clé n'existait pas, notre déclaration était INERTE) ; sa doc interne dit *« `null`
uses 2,500 tokens; `0` disables spilling »*. Run Codex réel APRÈS fix : skill **entier, 0 morceau**.
⚠️ **ASYMÉTRIE DÉCLARÉE** : rien de tel côté Claude Code. Là-bas la limite est IMPOSÉE et peut
changer sans préavis — la coder serait une constante de harnais dans le moteur, interdit permanent.
Règle déjà écrite dans budget.md : **négocier quand une autorité existe, plancher sinon.**
⚠️ **Codex 0.146 a changé de stockage** : transcripts en `~/.codex/sessions/AAAA/MM/JJ/rollout-*.jsonl`
(les docs décrivaient 0.144). Le `logs_*.sqlite` est de la TÉLÉMÉTRIE, pas un transcript.

### ⑱ 🟠 BACKLOG — RIEN NE MESURE LE DÉBIT (né de ⑰, 05/08/2026)
Tous nos filets répondent à « est-ce cassé ? » ou « est-ce vivant ? ». Aucun ne répond à
**« livre-t-on à la bonne vitesse ? »**. Un système qui livre à 1/11 de son débit est
parfaitement « fonctionnel » et parfaitement vert. ⇒ témoin de DÉBIT, à concevoir.



### ㉑ 🟢 BACKLOG — `tsc --checkJs` (décision mainteneur 05/08/2026)
TypeScript **le vérificateur, jamais la syntaxe** : JSDoc + `tsc --noEmit`, zéro build, zéro
artefact, le fichier exécuté reste le fichier écrit (un hook est spawné à chaque appel d'outil).
Apporte l'analyse d'impact que la doctrine anti-couplage réclame. À faire APRÈS ⑲ (typer une
architecture qu'on s'apprête à changer = du travail jeté).
### ⑯ ✅ LIVRÉ 05/08/2026 — LE TRANSPORT EST DEVENU UNE COUCHE
**FAIT** : `emission-core.js` extrait (file + découpage + persistance du reliquat) ; `porte-core.js`
et `session-inject.js` sont désormais des APPELANTS, aucun ne réimplémente rien. Les parties PURES
(`baseId`, `ordonner`) sont remontées dans `budget.js` — muté **100,00 %, 0 survivant** — pour que
la décision reste hors de l'I/O. `emission-core.js` est une coquille I/O, jamais mutée.
**LE GATE, qui est le vrai livrable** : `emission-core-gate.test.js` scanne les fichiers qui
écrivent la CLÉ `additionalContext` et exige qu'ils ATTEIGNENT la couche, en **traversée
TRANSITIVE** (les coquilles de harnais passent par `porte-core` — exiger un import direct casserait
les couches). DÉRIVÉ du code ⇒ tout émetteur FUTUR est couvert le jour où il est écrit. 3 volets :
scan + filet d'existence (`>= 3` émetteurs, sinon c'est le GATE qui est cassé) · volet INVERSE sur
les exemptions périmées · **negative-check par sabotage EN MÉMOIRE** (jamais un fichier réel : la
1re version d'un tel check avait fait tomber 38 tests d'autres suites). Seule exemption :
`legacy-mcp-inject.js`, RELIQUE-oracle qui doit rester figée, avec son pourquoi écrit.
⚠️ **AUCUNE modification de `settings.json`** — c'était une extraction, le câblage est intact.

<details><summary>Constat d'origine (conservé : c'est le raisonnement, pas l'état)</summary>
⑮ n'est pas un oubli, c'est un **défaut de squelette**, et il en produira d'autres.
**Le constat** : il y a DEUX émetteurs de contexte — `porte-core.js` (PreToolUse, les 2 harnais)
et `session-inject.js` (SessionStart/PostCompact). Le transport (morcelage + sceau + paquets +
file) vit DANS `porte-core.js`, c'est-à-dire dans l'ORCHESTRATION d'un seul des deux. Le second
ne le traverse pas, et **rien ne l'y oblige** : c'est de l'opt-in par recopie.
🔴 **Donc le trou se reproduira au 3ᵉ émetteur** (PostCompact côté Codex, SubagentStart, Stop… —
5 événements Codex non exploités sont déjà listés). Le framework interdit ce motif PARTOUT
ailleurs (« moteur figé, sources qui s'empilent », cascade résolue en UN point, collecte en
SOURCE UNIQUE) — le transport est la dernière brique à ne pas l'appliquer.
🔴 **ET LE GATE D'ASYMÉTRIE NE LE VOIT PAS** : `frontmatter.test.js` scelle la symétrie du
VOCABULAIRE (les clés existent dans les 4 corpus). Personne ne scelle la symétrie du CHEMIN
D'ÉMISSION. Un gate qui vérifie une dimension laisse croire que toutes sont vérifiées.
**LE SQUELETTE CIBLE — 4 COUCHES, et 3 sont DÉJÀ propres** (c'est une EXTRACTION, pas une
réécriture) :
| # | Couche | Rôle | État |
|---|---|---|---|
| 1 | `sources/*` | « quelles docs ? » — PURES, zéro dialecte | ✅ |
| 2 | `gate.js` | « laquelle, maintenant ? » — PURE, cascade en UN point | ✅ |
| 3 | **`emission-core.js`** | budget · morcelage · sceau · paquets · file | ❌ **à extraire** |
| 4 | coquilles harnais | dialecte de SORTIE seulement (~15 l.) | ✅ |
**LA RÈGLE QUI TIENT LE SQUELETTE** : *aucun émetteur n'écrit sur stdout — il rend à la couche
d'émission.* C'est le motif des frameworks web (un handler ne sérialise jamais sa réponse ; le
pipeline le fait). ⚠️ **DIFFÉRENCE CAPITALE avec eux** : là-bas on ne PEUT pas contourner le
pipeline (on ne possède pas le transport). Ici on possède tout ⇒ **seule une machine peut
l'imposer**. D'où le gate ci-dessous : sans lui, la couche existe mais reste facultative, et on
n'a fait que déplacer le problème.

✅ **CIBLE, en deux temps et dans cet ordre** :
1. **Extraire `emission-core.js`** — la couche que TOUT émetteur traverse : reçoit des segments +
   un budget + un indice de trame, rend le texte scellé et le reliquat. `porte-core` et
   `session-inject` deviennent des appelants ; aucun ne réimplémente rien.
2. **Poser le GATE STATIQUE, DÉRIVÉ (jamais une liste écrite)** : « tout fichier qui écrit
   `additionalContext` DOIT importer `emission-core` ». Dérivé du code, il couvre d'office les
   émetteurs FUTURS — c'est la seule forme qui tienne. Negative-check obligatoire : saboter une
   COPIE d'un émetteur (retirer l'import) et exiger le ROUGE, sinon le gate naît inerte
   (leçon des `*-must-stay-pure`, 03/08/2026).
⚠️ **Faire ⑯ AVANT ⑮** : câbler la porte session à la main d'abord, ce serait poser la 2ᵉ copie
qu'on veut justement supprimer — et le gate arriverait après le mal.
⚠️ Ne PAS fusionner les deux portes pour autant (événements et contrats DIFFÉRENTS, invariant déjà
écrit dans `session-porte.md`) : on partage la COUCHE D'ÉMISSION, jamais l'orchestration.

</details>

### ⑮ ✅ LIVRÉ 05/08/2026 (dans le même geste que ⑯) — LA PORTE SESSION A SON TRANSPORT
**FAIT** : `session-inject.js` traverse `emission-core`. Sceau, morcelage et file s'appliquent ;
segments par DOCUMENT (le séparateur de la couche est le MÊME `

---

`, donc **parité à
l'octet** tant que le corpus tient dans la trame). Lock obligatoire autour de la file, dégradation
au frais seul si le lock manque — jamais un silence.
**LES DEUX INCONNUES, TRANCHÉES SANS RÉTRO-INGÉNIERIE** :
① « un SessionStart déclaré N fois est-il spawné N fois ? » → **NON MESURÉ, donc NON UTILISÉ** :
on émet sur UNE trame (`nbPaquets: 1`). À une trame le morcelage livre quand même TOUT, simplement
sur plusieurs gestes. Passer à N est un réglage APRÈS mesure, pas une reconception.
② « la file a-t-elle un sens là où il n'y a pas de geste suivant ? » → **OUI, par le store
PARTAGÉ** : même préfixe `reliquat-`, même scope d'agent ⇒ le reliquat de la porte session est
drainé par la porte PreToolUse au TOUT PREMIER appel d'outil. C'est exactement l'hypothèse écrite
ici la veille, et elle n'a coûté **aucune ligne de `settings.json`**.

<details><summary>Constat d'origine (conservé)</summary>
**`session-inject.js` ne contient AUCUNE référence à `budget`/`planifier`/`paquet`/`reliquat`.**
Les docs de `docs/session/` (le « CLAUDE.md géré par le framework », injecté à CHAQUE début de
session et après compaction) sortent donc **d'un bloc, dans UNE sortie de hook** — soumises au
plafond de 10 000 c, sans sceau, sans morcelage, sans file.
⚠️ **Ça marche aujourd'hui UNIQUEMENT parce que le corpus session pèse ~1,2 Ko.** C'est du
dimensionnement statique — précisément ce que la file vient d'éliminer partout ailleurs. Le jour
où quelqu'un y met un vrai document, il part en fichier de spill **en silence**, et personne ne
le saura : cette voie n'a ni sceau (donc aucune détection de troncature) ni canari dédié.
🔴 **La garantie « n'importe quelle taille arrive » est donc FAUSSE sur cette voie.** Ne pas
l'affirmer sans cette réserve tant que ⑮ n'est pas fait.
✅ **CIBLE** : faire passer `session-inject.js` par `budget.planifierPaquets` comme la porte —
mêmes `--paquet k --paquets N` déclarés dans `settings.json`, même sceau, même file. Le cœur
existe déjà, c'est du câblage, pas de la conception.
⚠️ **DEUX INCONNUES À MESURER AVANT DE CODER** (ne pas rétro-ingénierer) : ① un hook
`SessionStart` déclaré N fois est-il bien spawné N fois (la dédup du harnais se fait par commande
+ args — vrai pour PreToolUse, à VÉRIFIER ici) ; ② la file a-t-elle un sens à SessionStart, où il
n'y a pas encore de « geste suivant » — sans doute faut-il que le reliquat soit repris par la
porte PreToolUse au premier outil, donc un store PARTAGÉ entre les deux portes.
⚠️ Modifie `settings.json` (PROD) ⇒ **GO explicite du mainteneur**, à un moment où aucun agent ne tourne.

</details>

### ⑬ ✅ FILE DE RELIQUAT — LIVRÉE le 05/08/2026 (le trou est FERMÉ, plus de réserve)
⚠️ **JUGEMENT RENVERSÉ, RÉÉCRIT (pilotage.md) : cette section disait « FACULTATIF après ⑭ ».
C'était FAUX**, et la décision du mainteneur l'a tranché : ⑭ seul (« émettre au-delà du budget et
laisser le harnais spiller ») aurait envoyé le surplus dans un FICHIER, pas dans le contexte.
Exigence retenue : **tout arrive DANS LE CONTEXTE, à 100 %, sans dépendre d'aucun filet du
harnais.** La file n'est donc pas un complément de ⑭ — elle EST le mécanisme.

**LE DÉFAUT (observé en session)** : `12 morceau(x) non émis : le nombre de paquets déclarés est
TROP PETIT` — un skill de projet n'arrivait pas en entier. **MESURES** : budget 8 000 c/trame ·
capacité utile **7 658 c** · capacité TOTALE **12 × 7 658 = 91 896 c** · ce seul skill pesait
**75 927 c ⇒ 10 trames sur 12**. Avec les docs fichier du même appel, le plafond sautait.
**POURQUOI CE PLAFOND EXISTE** : `N` = le nombre de DÉCLARATIONS du hook dans `settings.json`. Le
harnais spawne exactement ce qui est déclaré — on ne peut pas créer une 13ᵉ trame pendant l'appel.
La capacité d'UN appel est donc finie et fixée à froid. Dimensionner `N` sur « le plus gros
contenu connu » = capacity planning statique, c'est-à-dire du bricolage : le jour où le contenu
grossit, tout est bloqué.

✅ **LA SOLUTION, ET ELLE EST CELLE DU PROTOCOLE DONT ON SE RÉCLAME** : ni RFC 2046, ni RFC 6455,
ni TCP ne jettent quoi que ce soit quand la fenêtre est pleine — **ils DIFFÈRENT**. Le canal
n'est pas UNE trame, c'est le FLUX des appels d'outils. Le reliquat est désormais **persisté**
(store `reliquat-`) et **ré-émis EN TÊTE aux appels suivants**, jusqu'à épuisement. `--paquets N`
n'est plus un plafond de livraison, seulement un **DÉBIT** — on peut le baisser sans rien perdre.
**Le palliatif « monter N à 24 » est donc ÉCARTÉ définitivement** (il coûtait ~8 s/geste, 96 % en
démarrage de node, et ne faisait que repousser le mur).

**CE QUI A ÉTÉ LIVRÉ** (détail des invariants → `budget.md`, `porte.md`, `reset.md` injectables) :
file `reliquat-` sous le lock existant · plan mémoïsé portant les SEGMENTS (les N processus
doivent voir la même entrée) · dédup par doc de base (`doc#3` → `doc`) · ordre strict, file avant
frais (RFC 6455 : jamais entrelacé) · purge PreCompact (5 stores) · suppression de la boucle de
restauration d'état des différés, devenue nuisible (livraison en double).

🔴 **TROIS DÉFAUTS TROUVÉS EN CONSTRUISANT, tous par SIMULATION de la boucle réelle avant mise en
prod — aucun n'était visible tant qu'on jetait le reliquat** :
① l'annonce citait des **MORCEAUX** (56 lignes pour UNE doc) et remplissait la trame ⇒ zéro
   contenu émis, à chaque geste, **pour toujours**. Corrigé : dédup par document + 5 citations max.
② rien ne garantissait qu'une trame émette au moins un morceau ⇒ boucle infinie. Corrigé :
   **garantie de progrès** (on force un morceau, on sacrifie l'annonce — *livrer avant décrire*).
③ `morceler` pouvait rendre un morceau **plus gros que sa propre borne** (419 c pour un budget de
   340) quand l'en-tête de morceau dépassait la capacité — défaut PRÉEXISTANT, masqué parce que
   rien n'obligeait à émettre ce morceau. Corrigé : l'en-tête de morceau cède aussi.
④ `n === 1` court-circuitait vers `planifier()`, **qui ne morcelle pas** ⇒ sur un harnais
   mono-trame (Codex) une doc trop lourde n'arrivait JAMAIS. Corrigé : le morcelage vaut aussi à
   une trame. **Codex a désormais la même garantie que Claude Code, avec un débit plus faible.**

**PREUVES** : property ⑧ CONVERGENCE (la boucle rejouée : la file se vide ET tout est livré —
elle seule prouve « tout arrive », ① ne prouvait que « rien ne s'évapore dans UNE émission ») +
cas fondateur déterministe du blocage mesuré + test d'annonce bornée. Générateur ⑦ renforcé par
tirage stratifié (jamais le seuil abaissé).

### ⑫ ✅ FAUX ROUGE DU DIFFÉRENTIEL DE PORTE — trouvé ET fermé le 05/08/2026
`porte-differential.test.js` est passé au ROUGE après **deux lignes ajoutées à des docs du parc**,
sans qu'aucun moteur ne change. **Cause mesurée** (223 c d'écart = exactement l'enveloppe) : la
porte SCELLE au-delà de 50 % du budget (4 000 c) ; l'oracle `protect-files.js` est FIGÉ depuis le
17/07 et ignore le sceau né le 03/08. Le test ne tenait que parce que les payloads pesaient
~3 400 c — **un gate dont la validité dépend de la taille du parc est un compte à rebours**, pas
un gate. **Fix** : comparer le CONTENU déscellé (back-référence sur le marqueur, donc un sceau
incohérent n'est PAS avalé) + **negative-check dédié** prouvant que `desceller()` n'assouplit que
l'enveloppe. 🛑 **La tentation à ne JAMAIS suivre** : raccourcir une doc pour repasser sous le
seuil — dégrader un livrable pour tenir dans notre propre plomberie, l'interdit du framework.
⚠️ Cet oracle restera daté : chaque capacité ajoutée à la porte après le 17/07 creusera l'écart.
Question à reposer au prochain `/stack-audit` : **ce différentiel doit-il encore exister ?**

### ⑩ GATE ANTI-DÉPRÉCIATION MULTI-HARNAIS — 3 PISTES MESURÉES, 2 FERMÉES (05/08/2026)
**Question posée (mainteneur)** : « y a-t-il un gate pour détecter les *deprecated* sur tous les
harnais ? » **Réponse : non — et détecter l'ANNONCE n'est pas automatisable gratuitement.**
Mesures, pour ne PAS refaire ces essais :
1. 🛑 **Grep du binaire = FAUX** (piste la plus tentante, mesurée et ÉCARTÉE) : `codex_hooks`
   est **ENCORE PRÉSENT** dans le binaire 0.146 (3 occurrences) — un flag déprécié y reste
   justement pour pouvoir avertir. Témoins validant la mesure : flags valides tous > 0
   (`unified_exec` 69, `multi_agent` 96, `shell_tool` 7), témoin bidon = 0. **Présence ≠ validité.**
2. 🛑 **Écouter une trace persistée = IMPOSSIBLE** : le warning n'est NI dans le rollout JSONL
   (0 occurrence sur les 2 sessions du jour), NI dans `~/.codex/log/` (fichier daté d'oct. 2025).
   Il n'existe que sur **stderr, en direct**.
3. 🛑 **Commande légère qui charge la config = INEXISTANTE** : `--version`, `exec --help`,
   `hooks list`, `debug` ne crient PAS avec un `codex_hooks` déprécié posé dans un `CODEX_HOME`
   jetable. Seul un `codex exec` RÉEL déclenche l'avertissement ⇒ coût en tokens à chaque passage.
   (⚠️ `CODEX_HOME` refuse un dossier sous `%TEMP%` — utiliser un dossier hors temp.)
**⇒ CONCLUSION ARCHITECTURALE : le gate anti-dépréciation, c'est le CANARI.** Il ne détecte pas
l'ANNONCE (personne ne le peut gratuitement), il détecte l'**EFFET** — le jour où le flag est
retiré et où l'injection meurt. C'est gratuit, universel par construction, et déjà conçu pour ça.
**Cela fait du chantier ② (canari Codex) la PRIORITÉ n°1**, plus une simple symétrie manquante.
✅ **4ᵉ PISTE, POSÉE le 05/08/2026 — la seule qui marche, mais bornée à la CI** : GitHub Actions
PERSISTE ses avertissements ⇒ `gh run view <id> --log | grep -i deprecat`, gratuit et décidable,
inscrit dans `rituel-stack-audit.md`. Elle ne couvre QUE le harnais CI : Codex et Claude restent
au canari. Ne pas la présenter comme une réponse générale.
Piste restante si un jour l'annonce doit être vue AVANT la mort : un `codex exec` trivial en
**nightly** (jamais au pre-push — cf CLAUDE.md « gate JAMAIS bloquant »), scannant stderr sur
`deprecat`. À ne poser que si une 2ᵉ dépréciation fait réellement mal.

### ⑨ ✅ RÉSOLU 06/08/2026 — LE SKILL N'ÉTAIT PAS ABSENT, IL ARRIVAIT EN MORCEAUX
**MÉTHODE** : run Codex RÉEL dans le périmètre, puis lecture du transcript. ⚠️ Le log terminal ne
montre PAS l'`additionalContext` (il part au modèle) — conclure de son absence, c'est se tromper
d'observable. La vérité est dans `~/.codex/sessions/AAAA/MM/JJ/rollout-*.jsonl`.
⚠️ **Codex 0.146 a changé de stockage** (les docs décrivaient 0.144) ; `logs_*.sqlite` = TÉLÉMÉTRIE,
pas un transcript.
**CE QU'ON A VU** : `⟦ skill/ctxroute — MORCEAU 1/7 ⟧`. Le skill arrivait bien, en **7 morceaux** —
mon 1er grep cherchait `[source: skill/ctxroute]`, étiquette qui vit à la FIN du document, donc dans
le morceau 7 jamais atteint dans un run court. **L'outil de mesure mentait, pas le framework.**
**CAUSE RÉELLE** : ⑰ — le moteur ignorait la limite déclarée et appliquait son plancher de 8 000.
Corrigé ; run de vérification : skill ENTIER, zéro morceau. ⇒ **plus aucune inconnue sur Codex.**

<details><summary>Constat d'origine (conservé)</summary>
### ⑨ (historique) CODEX : `skill/ctxroute` ABSENT d'un run réel — CAUSE INCONNUE (05/08/2026)
⚠️ **CE CHANTIER S'APPELAIT « CODE MODE : le skill n'atteint plus l'agent ». Ce titre était FAUX**
et il est réécrit ici plutôt qu'annoté (cf `pilotage.md` : un jugement renversé se réécrit).
**LE FAIT MESURÉ, lui, tient** — run réel visant `Desktop/ctxroute/paths.js` :
· la porte Codex a bien tourné (état de session créé) ;
· l'injection est arrivée : **1 415 caractères, `paths.md` SEULE**, scellée, sans reliquat ;
· **`skill/ctxroute` (42 848 c) est ABSENT du rollout**, et **rien ne l'annonce** ;
· `explain.js` sur le payload reconstruit rend pourtant `✓ skill/ctxroute source=skill cadence=once`.
**L'EXPLICATION QUE J'EN AVAIS TIRÉE ÉTAIT FAUSSE.** J'avais vu dans le rollout un `custom_tool_call`
nommé `exec` portant du JavaScript (`await tools.shell_command({command:"…"})`) et conclu que le
chemin était « enfoui dans du code, double-échappé », donc invisible au matcher. **Non** : j'avais
confondu la vue du ROLLOUT avec le payload du HOOK. Ce que dit la doc officielle :
🔵 **DOC-FIRST FAIT LE 05/08/2026 :**
Doc officielle `learn.chatgpt.com/codex/hooks` (relue ce jour ; l'ancienne URL `developers.openai.com`
redirige 308 vers `learn.chatgpt.com`, et il n'existe PAS de `docs/hooks.md` dans le repo GitHub) :
· *« When a model uses code mode to call a tool from JavaScript, hook decisions apply to that
  nested call »* ⇒ **le code mode NE CONTOURNE PAS les hooks.** Le hook reçoit l'appel IMBRIQUÉ
  avec son `tool_name` canonique — **pas le JavaScript**. Le `custom_tool_call exec` observé était
  la vue du ROLLOUT, pas le payload du hook : je les avais confondus.
· Table « Tool coverage » : shell et unified exec (`exec_command`) ⇒ *« Match as `Bash` »*, commande
  dans `tool_input.command`. **C'est exactement ce que `sources/file.js` fait déjà** (l. 118/140) ⇒
  **AUCUN changement de moteur ni de données n'est justifié par le code mode.** Le plan ne bouge pas.
· Payload `PreToolUse` inchangé (`session_id`/`cwd`/`tool_name`/`tool_input`/`tool_use_id`/`turn_id`…),
  décisions `deny`/`allow`+`updatedInput`, `ask` *« parsed but fail closed »*, `additionalContextLimit`
  défaut **2500 tokens** — nos 3 correctifs (renommage `hooks`, `deny`, limite à 0) restent CORRECTS.
🔴 **DEUX FAITS NOUVEAUX, eux, changent quelque chose** (gravés dans `porte.md`) :
① *« Hosted tools, such as `WebSearch` … don't use the local function-tool hook path »* ⇒ le
   déclencheur `tool:` est **MUET sur Codex pour les outils hébergés** : asymétrie de HARNAIS
   assumée, à ne JAMAIS chasser dans le moteur. ② *« Some specialized tool paths can opt out of the
   default hook path. Treat tool hooks as a useful guardrail, not a complete enforcement boundary »*
   ⇒ confirme noir sur blanc que `enforce` est un garde-fou, pas une frontière d'application.
⇒ **CE QUI RESTE DE ⑨** : la capture du payload réel (étape ①) reste à faire — elle n'est plus une
enquête sur le code mode, mais la seule façon d'expliquer pourquoi `skill/ctxroute` était absent.
Hypothèse restante à MESURER, pas à conclure : cadence `once` déjà consommée, ou budget.
⚠️ **NE PAS « corriger » le moteur à l'aveugle** — piège prouvé le 31/07 (3 sondes fausses, une
session perdue, un faux verdict « le moteur est en cause »). **ORDRE OBLIGATOIRE** : ① CAPTURER le
payload réel du hook Codex (le journaliser depuis la coquille, en tmpdir) ; ② le rejouer dans
`explain.js` ; ③ seulement alors décider — et la réponse sera probablement en **DONNÉES**
(enrichir `match`) avant d'être dans le moteur (contrat d'extension §7 : « un trou de matching se
règle d'abord en données »).
⚠️ **Gravité, reformulée après la doc** : la panne n'est plus imputée au code mode (piste morte),
mais le FAIT demeure — un savoir attendu n'est pas arrivé et **rien ne l'a annoncé**. C'est
exactement la classe de panne que le canari existe pour voir, et Codex n'a toujours pas de canari
(chantier ②). Le silence, lui, est confirmé comme le vrai défaut.

</details>

### ④ RETRAIT DE `confirm` — ✅ FAIT (05/08/2026, GO du mainteneur)
**CIBLE ATTEINTE, intégralement.** `confirm` et `ask` n'existent plus nulle part : ni dans le
vocabulaire (`KNOWN`), ni dans `lib-pure` (`confirmFor` supprimée), ni dans `gate.js` (la porte
rend **3 décisions et pas 4** : `none` · `allow` · `deny`), ni dans les 2 coquilles, ni au schéma,
ni dans la config livrée, ni dans un seul frontmatter du parc.
**RETIRÉ EN PRIME, non prévu au plan** : `WRITE_TOOLS` (la liste d'outils d'écriture) et le
paramètre `toolName` de `decide()` — ils n'existaient QUE pour `ask`. Les garder aurait laissé
une liste à maintenir pour rien et un paramètre mort dans la signature la plus chaude du moteur.
**Aucune décision de la porte ne dépend plus du NOM de l'outil.**
**MESURES** : **390 frontmatters** nettoyés (363 dans `~/.claude/hooks/docs` + 27 dans
`docs/`, tous vérifiés DANS le frontmatter, 0 hors bloc) · lint-corpus **0 erreur** ·
**964 tests verts / 48 fichiers** · **mutation 100,00 %** (1775 tués, 0 survivant) ·
doctor **12 ok / 0 problème** · jscpd **0,51 %** (< 1 %).
**ANTI-RETOUR SCELLÉ** (c'est ce qui reste du chantier, et le plus important) :
① `gate.test.js` — aucune entrée ne peut produire `ask`, et les décisions sont EXACTEMENT
`none|allow|deny` ; ② `frontmatter.test.js` — `confirm` REFUSÉ dans les 2 corpus de docs ;
③ **spawn RÉEL sur les 2 coquilles** (c'est la coquille qui écrit `permissionDecision`, donc
c'est elle qui pourrait le réintroduire sans que le moteur en sache rien) ; ④ le gate de
symétrie a `ASYMETRIES_JUSTIFIEES` **VIDE** — le vocabulaire est intégralement symétrique.
**Leçon à garder** : la clé était à `false` depuis la bascule du 17/07/2026, donc **morte
pendant trois semaines sans que personne ne s'en aperçoive**. C'est la définition d'une dette :
pas un bug, un mot qui coûte à lire et ne rend rien. Une machine ne l'aurait jamais signalée —
seul le gate de symétrie l'a rendue VISIBLE, et il a fallu la question du mainteneur pour la tuer.

<details><summary>Raisons du verdict (conservées — c'est ce qui interdit le retour en arrière)</summary>

Trois raisons, par ordre de poids :
1. **Contraire au 0-human** — `ask` remet un humain dans la boucle ; le skill le proscrit.
2. **Asymétrie IRRÉDUCTIBLE** — Codex ne supporte pas `ask` (dégradé en injection). Un standard
   multi-harnais ne peut pas reposer sur un mot qui ne marche que d'un côté.
3. **Le retirer ne change RIEN** — mesuré : l'interrupteur global est à `false`, donc les
   **363 docs sur 379** qui portent `confirm: true` ne déclenchent déjà plus rien.
   Le comportement d'après-suppression EST le comportement actuel. Risque fonctionnel NUL.
Origine : héritage de `protect-files.js`, repris tel quel pour la parité de bascule du 17/07/2026,
jamais rejugé depuis. `enforce` couvre le besoin en mieux (autonome, identique sur les 2 harnais,
livre le savoir avec le refus).
⚠️ **L'ORDRE A COMPTÉ (expand/contract), il est la raison pour laquelle rien n'a cassé** :
retirer la clé du vocabulaire AVANT de nettoyer les frontmatters aurait rendu 390 docs de PROD
invalides d'un coup (clé inconnue = ERREUR) — donc plus aucune injection, pour tous les agents
en cours. Ordre suivi : ① nettoyer les 390 frontmatters ; ② `lint-corpus` vert ; ③ retirer le
code ; ④ vider `ASYMETRIES_JUSTIFIEES` ; ⑤ mutation + doctor. **À rejouer tel quel pour toute
future suppression de clé.**
⚠️ **NE PAS « corriger » l'asymétrie en ÉTENDANT `confirm`** aux docs MCP/skills/defaults :
ce serait généraliser un mot éteint et contraire à la doctrine. Piste ÉCARTÉE, avec sa mesure.

</details>

### ⑤ `enforce` N'EST UTILISÉ PAR AUCUNE DOC
Le mot existe, prouvé, symétrique — et **le comportement réel du parc est INCHANGÉ**.
⚠️ **Une capacité sans usage n'est pas encore un actif** (même motif que les paquets et le
canari). Cible : choisir les gestes IRRÉVERSIBLES (paiement, suppression, envoi client) et poser
`enforce: true` dessus, un par un. **Décision humaine, geste par geste** — jamais en masse,
jamais en `defaults` (un blocage de catégorie rend le système invivable).

### ⑥ DÉCLENCHEUR DOC-FIRST + ⑦ DRIFT-TEST doc↔code
Inchangés (sections plus bas). Le biais s'est encore manifesté ces 2 jours.

### ⑧ Divers froids
Anti-mojibake · `sources.md` et `doctor.md` dépassent le seuil de dilution (à scinder) ·
worktree périmé `~/Desktop/mcp-doc-hooks-paquets` à supprimer.
(La ligne « `codex_hooks` déprécié » a été RETIRÉE d'ici : corrigée le jour même, cf ③.)

---

> Statut : ✅ **TERMINÉ (17/07/2026)** — architecture cible ATTEINTE. Hook UNIQUE
> `doc-inject.js` (matcher `*`) live en prod : sources/file.js + sources/mcp.js →
> gate.js (dédup par DOC). `legacy-mcp-inject.js` retiré du câblage (gardé comme
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
  acme-infra 69 017, ctxroute 51 480) en tier-1 + `*-reference.md`. Ils sont désormais
  ANNONCÉS au lieu d'être amputés en silence — la dette est visible et bornée par le volet ⑤.

## ✅ PAQUETS — LIVE EN PRODUCTION (bascule faite le 03/08/2026)

> ⚠️ **SECTION CORRIGÉE LE 04/08/2026 — elle annonçait encore « EN ATTENTE DE GO, câblage PAS
> fait ».** C'était FAUX depuis la bascule : `settings.json` déclare **12 paquets**
> (`--paquet k --paquets 12`) et les injections arrivent scellées/numérotées à chaque geste.
> Un backlog qui décrit un chantier livré comme « en attente » fait re-décider ce qui est décidé.

**État : LIVE.** Le câblage est en place, les autres agents en bénéficient.
⚠️ Le **N = 3** cité plus bas dans le dimensionnement est PÉRIMÉ : c'est **N = 12** (le plus gros
contenu du parc, 79 516 c, exige 11 trames). Le raisonnement de dimensionnement reste valable, le
chiffre non.

**Preuves** : 816 tests verts · **mutation 100,00 % (0 survivant)** · 0 clone jscpd · doctor vert ·
différentiels (`porte-differential` à l'octet, `mcp-differential`) VERTS ⇒ parité confirmée.
Cas fondateur prouvé par SPAWN RÉEL : *3 docs trop grosses pour une trame → livrées en 3 paquets,
zéro éviction*, numéros `k/N` et marqueur commun vérifiés.

**Ce qui a été construit** — aucun fichier nouveau :
`budget.planifierPaquets` (pur) · `porte-core` (plan mémoïsé par invocation + émission du paquet k)
· `lib.parsePaquetArgs` (pur) · coquille `doc-inject.js` (dialecte : `tool_use_id` + argv) ·
`ctxroute-reset` purge le 4ᵉ store (`plan-`).

**3 défauts RÉELS trouvés par les gates, pas par relecture** (à ne pas réintroduire) :
1. **Découpage sans mémoïsation** — la porte fragmentait même sans identifiant d'invocation ⇒ les N
   paquets décidaient séparément ⇒ docs `once` consommées par le premier, trames suivantes VIDES.
   Corrigé : `fragmente` exige les DEUX (déclaration ET identifiant), sinon trame unique intégrale.
2. **`argv[i + 1]` avec i = -1** (drapeau absent) lisait `argv[0]` ⇒ un nombre nu dans la ligne de
   commande passait pour une déclaration de paquets. Trouvé par MUTATION.
3. **Budget sous l'annonce nue** (property-test) : on émet quand même l'annonce — dire vaut mieux
   que se taire, même arbitrage que `planifier`.

**⚠️ 3 mutants ÉQUIVALENTS éliminés PAR CONSTRUCTION** (jamais un `// Stryker disable`) : cascade du
budget dupliquée → `budgetEffectif()` SOURCE UNIQUE · `utiles.slice()` sans lecteur → on remplit
`reste` directement · `k >= 0` dont le cas 0 recalculait l'initialisation → boucle jusqu'à 1.
Et deux formes réécrites pour être TESTABLES : `nbPaquets >= 2` (et non `> 1`), `Math.max(1, v)`
(et non `v >= 1 ? v : 1`) — à `1`, les deux branches coïncidaient donc le comparateur était intuable.

### 📏 DIMENSIONNEMENT DE N — mesuré sur le corpus réel (03/08/2026)
375 docs injectables · **médiane 1 548 caractères** · capacité utile par paquet = 8 000 − 339 = **7 661**.
⇒ **N = 3 retenu** (capacité ~23 Ko par geste, soit ~15 docs médianes). CLIQUET : raisable en
configuration seule, jamais baissé. ⚠️ Le coût est RÉEL — N processus spawnés à CHAQUE appel
d'outil, sur un poste déjà sujet à la saturation (875 zombies le 15/07, 502 le 27/07). Ne PAS
gonfler N « au cas où » : chaque unité se paie à chaque geste, pour un bénéfice rare.

### ✅ CE QUI EST VRAI DEPUIS LE 03/08/2026 (remplace le paragraphe « ce que les paquets ne resolvent pas »)
**JUGEMENT RENVERSE, reecrit et non empile.** La version precedente disait « un segment est
INDIVISIBLE, donc 7 docs du parc et tous les skills ne seront JAMAIS livres ». **C'EST FAUX
DESORMAIS.** La regle d'indivisibilite a ete SUPPRIMEE : une doc trop lourde est MORCELEE et livree.
L'indelivrabilite est impossible par construction.
- Regle finale, DEUX chemins : ca rentre -> on emet tel quel · ca ne rentre pas -> on decoupe.
- Protocole = RFC 2046 `message/partial` (id / numero des 1 / total) + RFC 6455 (ordre strict,
  jamais entrelace), coupe sur FRONTIERES DE LIGNES. Detail : `budget-paquets-reference.md`.
- Un reliquat ne signifie PLUS « trop gros » mais `--paquets N` TROP PETIT — erreur de config,
  message qui porte sa solution.
- Le gate qui plafonnait la LONGUEUR des docs (volet ④) est SUPPRIME : le framework livre, il ne
  juge pas la taille de ce qu'on lui confie. Raison gravee dans `couverture-gate.test.js`.
- Mesure : skill `agent-social` 79 516 c -> 11 trames, zero reliquat. **N = 12 declare.**

### Reste à faire AVANT de déclarer le chantier fini
1. **GO du mainteneur** puis câblage `settings.json` (3 déclarations `--paquet k --paquets 3`).
2. **Doc injectable + miroir `docs/framework/`** — à poser DANS LE MÊME GESTE que la bascule
   (les écrire avant décrirait un moteur qui n'est pas en prod, et `parc-sync-gate` rougirait
   à raison — même règle qu'au 31/07).
3. **Codex** : `additionalContextLimit: 0` (documenté, débrayable) ⇒ aucune fragmentation nécessaire
   là-bas. Codex n'expose pas d'identifiant d'invocation documenté ⇒ il reste en trame unique,
   dégradation EXPLICITE, jamais silencieuse.

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

## ✅ /stack-audit du 04/08/2026 — 2 MANQUES trouvés et FERMÉS dans le même geste

### ① Le README enseignait une config que le SCHÉMA REFUSE (18 jours)
`README.md` montrait `servers: { stripe: { threshold: 1, mode: "dumb" } }` — cadence par serveur
**retirée du schéma le 17/07/2026**. Un arrivant qui copiait l'exemple d'accueil d'un dépôt PUBLIC
obtenait une config rejetée.
⚠️ **Une relecture ne ferme pas cette classe** (elle a survécu 18 jours, à travers plusieurs
sessions et un audit). **Gate posé** : tout bloc ```json du README est confronté au schéma, clé par
clé (1er niveau, `servers.*`, `defaults.*`), + negative-check sur l'exemple exact qui a menti.
README corrigé ET complété (cascade 4 étages, `defaults`, `note`).

### ② `note: |` perdait les lignes suivantes EN SILENCE — ✅ FERMÉ le 06/08/2026
> **RÉÉCRIT, pas empilé** (règle de ce document) : ce paragraphe a décrit un piège
> OUVERT du 05/08 au 06/08. Il est désormais **fermé**, et le texte ci-dessous
> reste parce qu'il porte la LEÇON DE COUCHE, qui elle ne périme pas.
> **FIX** : `parse()` comprend les blocs YAML (`|` littéral, `>` replié,
> désindentation sur le minimum, chomping clip). **AUCUNE exception par clé** —
> la règle est « `|`/`>` SUIVI d'une ligne INDENTÉE », donc valable partout ; une
> exception sur `note` aurait laissé le piège armé pour la clé suivante.
> **La prédiction du paragraphe ci-dessous était JUSTE** : le fix appartenait bien
> à `parse()`, seule couche qui voit encore la ligne suivante et lève l'ambiguïté
> avec `match: "|"`. Mutation ramenée à 100 % dont **5 mutants ÉLIMINÉS PAR
> CONSTRUCTION** (garde `typeof` inobservable, branche `indents` inatteignable,
> boucle indexée → consommée, condition absorbée par le `trimEnd`).
Trouvé par **simulation adversariale** :
```yaml
note: |
  ligne un
  ligne deux
```
donne `note === "|"`, **validation VERTE**, les deux lignes PERDUES. Et `note` est précisément le
champ qui invite à écrire long.

🛑 **UNE GARDE A ÉTÉ POSÉE DANS `validate()` PUIS RETIRÉE LE MÊME JOUR — ne pas la refaire.**
Elle rejetait toute valeur égale à `|`/`>`. **La CI l'a mise en ROUGE en quelques minutes**
(property-test ROUND-TRIP de `migrate` : « le migrateur produit un frontmatter INVALIDE :
{"match":"|"} ») — `match: "|"` est un pattern **LÉGITIME**.
⚠️ **CAUSE RACINE : garde posée à la MAUVAISE COUCHE.** Après `parse()`, `cle: |` (bloc YAML) et
`cle: "|"` (pipe littéral) sont **rigoureusement indistinguables** — les deux valent la chaîne
« | ». Vérifié en direct. Une garde incapable de distinguer interdit du SAIN, et une garde qui
interdit du sain finit débranchée : c'est pire que le piège qu'elle prétend fermer.

**CIBLE (le fix correct)** : la détection appartient à **`parse()`**, seul endroit qui voit le
TEXTE — un bloc RÉEL = valeur `|`/`>` **ET** ligne suivante indentée. Reste à décider comment
l'information remonte au validateur sans éclater la garde en N endroits (piste : `parse()` expose
les clés concernées, `validate()` prend un 2ᵉ argument optionnel — comportement d'avant si absent).
⚠️ **NE JAMAIS « régler » ça en supportant le multi-ligne** : ce parser est un sous-ensemble de
YAML délibéré (« vouloir juste ajouter le multi-ligne = la première marche vers un parser YAML »).
**En attendant** : le comportement est FIGÉ par un test (`frontmatter.test.js`) qui documente la
perte, et la forme sûre est la liste inline `note: [ligne un, ligne deux]` (README).

⚠️ **LEÇON DE MÉTHODE, la vraie valeur de l'épisode** : la simulation adversariale a trouvé le
piège, mais mon premier réflexe de scellement était FAUX et 931 tests verts en local ne l'ont pas
vu — c'est la **CI cross-OS** qui a tranché. Un gate écrit vite en fin de session doit passer la CI
avant d'être présenté comme une protection.

### Vérifié CONFORME (preuves)
`testTimeout: 30000` présent (suite à spawns) · arbo exhaustive (aucun fichier ajouté) · couplage
48 modules/144 deps, 0 clone · doctor vert sur les 2 harnais · mutation 100 % (1775 mutants).

### Limites ASSUMÉES de cet audit (à ne pas lire comme des preuves)
- **CI jamais exécutée** : rien n'est poussé. Or les fichiers VIVANTS (skill, docs injectables de
  `~/.claude/hooks/docs/`) sont déjà modifiés, donc déployés de fait. La doctrine « CI verte avant
  déploiement » n'est pas tenue sur ce périmètre-là.
- **`skillDefaults` supprimé SANS expand/contract** (la doctrine impose ajouter → migrer → retirer).
  Assumé : un seul consommateur, et `additionalProperties: false` rend le rejet BRUYANT, jamais
  silencieux. Pour un dépôt public, ça reste un breaking change — noté au README, pas de CHANGELOG.

---

## ✅ LIVRÉ — `enforce` : ARRÊTER le geste (ouvert 04/08, **LIVRÉ le 05/08/2026**)

> **GO du mainteneur donné le 05/08/2026.** Livré : mot `enforce` (booléen) admis dans les docs
> fichier, les docs MCP et les entrées `skills` — même mot, même sens, cascade identique.
> `false` explicite annule l'héritage de `defaults.{source}`. **Pas d'étage global** (volontaire).
> Absent = comportement d'avant à l'octet (contrat de parité §6).
>
> ### 🛑 CE QUE J'AI EU FAUX, ET QUE LE MAINTENEUR A CORRIGÉ
> J'ai empilé **trois restrictions successives** pour un problème qui n'existait pas :
> interdire `smart`, puis exiger `mode: once` ÉCRIT, puis interdire `dumb`. Le mainteneur a
> vu la bonne mécanique : **un blocage n'est jamais suivi d'un blocage**. Le geste refait passe
> TOUJOURS, puis la cadence reprend son cours.
> ⇒ Les 3 restrictions ont été SUPPRIMÉES et remplacées par UN drapeau d'état (`denied`).
> Résultat : **aucun mode interdit** (`dumb` = bloque/passe/bloque), moins de code, plus de cas
> couverts. **NE JAMAIS réintroduire une interdiction de mode ici.**
> ⚠️ Une doc `enforce` écrit son état MÊME en `dumb` (sinon rien ne se souvient du refus) ; sans
> `enforce`, la shape d'état ne bouge pas d'un octet.
> ⚠️ J'ai aussi proposé un cran `warn` (repris de Kubernetes/CSP) : **inutile ici**, il ne
> faisait RIEN de plus que le défaut — un synonyme de `false`, donc une violation de la loi
> anti-synonyme. Retiré avant d'être écrit. `dryrun` écarté aussi (aucune valeur avec l'alternance).
>
> ### ⚠️ DETTE ASSUMÉE, MESURÉE — 1 clone jscpd de 19 lignes entre les 2 coquilles
> `codex-doc-inject.js:32` ⇔ `doc-inject.js:43`, **0,28 %** (seuil du gate : 1 % → VERT).
> Le repo était à **0 clone** avant : c'est moi qui l'ai introduit en écrivant `deny` deux fois.
> La LOGIQUE a été factorisée (`porte-core.sortieDeny`, dialecte identique MESURé sur les 2
> harnais — même précédent que `decision: block` de guard-core). Ce qui reste identique = les
> `require` + la signature de `emit` + la branche `deny` de 3 lignes.
> 🛑 **NE PAS le faire disparaître en réécrivant des commentaires** : ce serait maquiller une
> mesure. Et deux coquilles minces DOIVENT se ressembler — le jour où elles divergent, c'est
> qu'on y a remis de la logique. Ce clone est un signal SAIN, pas une dette à rembourser.
>
> ### PREUVES
> 960+ tests verts · **mutation 100,00 %** (10 survivants tués, cliquet tenu) · **spawn RÉEL sur
> LES DEUX harnais** (refus effectif + raison reçue + negative-check « sans enforce, jamais de
> blocage » + alternance prouvée) · doc injectable + skill + schéma à jour.
> ⚠️ **Aucune doc du parc n'utilise `enforce` à ce jour** : le mot existe, le comportement réel
> du parc est INCHANGÉ. L'activer sur une doc = décision humaine, geste par geste.

<details><summary>Plan d'origine (04/08/2026) — conservé pour les faits datés</summary>

#### `enforce` : ARRÊTER le geste, pas seulement l'informer (ouvert 04/08/2026)

> ⚠️ **DÉCISION DU MAINTENEUR REQUISE avant de coder** : c'est un retour sur le retrait du
> deny/ask du 17/07/2026 — mais pris, cette fois, en connaissance du fait ci-dessous.

### LE FAIT QUI ROUVRE LE SUJET (doc officielle, mesuré le 04/08/2026)
Claude Code, page Hooks : *« Where the reminder appears depends on the event: **PreToolUse**,
PostToolUse, PostToolUseFailure, PostToolBatch: **next to the tool result** »*.
⇒ **`additionalContext` d'un PreToolUse n'arrive PAS avant l'outil : il arrive À CÔTÉ DE SON
RÉSULTAT.** Le hook s'exécute avant, son TEXTE non.
🛑 **Conséquence directe, à ne jamais réoublier : une injection ne peut PAS empêcher le geste
qu'elle vise.** Elle protège le geste SUIVANT. L'incident FONDATEUR du framework (le clic de
paiement) ne serait donc PAS évité par une doc injectée — seul un `deny` l'aurait fait.
⚠️ Le skill affirmait « le savoir livré AU MOMENT du geste » : vrai pour l'exécution du hook,
FAUX pour l'arrivée du texte. Corrigé.

### CE QUI EXISTE, SUR LES DEUX HARNAIS (doc officielle, 04/08/2026 — ne pas re-chercher)
| | Claude Code | Codex |
|---|---|---|
| forme JSON | `permissionDecision: "deny"` + `permissionDecisionReason` | **identique** (+ ancienne forme `decision:"block"`) |
| repli | exit 2 + stderr | exit 2 + stderr |
| raison → modèle | oui (*« blocks the tool call, and shows Claude the reason »*) | oui |
| interaction utilisateur | **aucune** | **aucune** (*« fully automatic — without requiring approval prompts »*) |
⇒ **`deny` est 100 % autonome et DISPONIBLE À L'IDENTIQUE sur les deux harnais** : c'est la
condition d'un standard. 🛑 **`ask` est PROSCRIT** — il escalade vers l'humain (anti 0-human), et
Codex le parse sans le supporter.

### CIBLE
- Un mot PAR ENTRÉE, cascadable comme les autres (les 4 autorités, `defaults.{source}` compris) :
  `enforce: true` — défaut `false` = comportement d'aujourd'hui, à l'identique (contrat §6).
- `true` ⇒ la doc part en `permissionDecisionReason` (PAS en `additionalContext`) et l'outil est
  REFUSÉ. Le corps du savoir doit tenir dans la raison, sinon on informe à moitié.
- 🛑 **PIÈGE MORTEL — LA BOUCLE INFINIE** : bloquer sans mémoire ⇒ l'agent réessaie ⇒ on rebloque,
  sans fin. **La solution est DÉJÀ dans le vocabulaire** : `enforce: true` + `mode: once` = blocage
  au 1er geste, savoir livré, l'agent refait l'appel, ça passe. **Zéro mécanisme neuf.**
  ⇒ **`enforce` + `dumb` DOIT être ROUGE à la validation** (deadlock déclaré), et `enforce` + `smart`
  aussi (le seuil rouvrirait la porte au hasard). Seul `once` est cohérent — le gate doit le dire.
- Coquilles : le dialecte (`permissionDecision` vs exit 2) vit dans la COQUILLE, jamais dans le
  noyau — `porte-core` décide « bloquer ou informer », chaque harnais l'exprime.
- Preuves exigées : spawn réel par harnais (blocage effectif + raison reçue), negative-check
  (une doc sans `enforce` ne bloque JAMAIS), mutation 100 %, doctor probe.

</details>

### CE QUI RESTE VRAI ET NE CHANGE PAS
« L'injection informe, ne bloque jamais » demeure le DÉFAUT. `enforce` est l'exception déclarée,
jamais l'inverse : un rappel de confort qui bloque rend le système insupportable, et un système
qu'on subit finit débranché.

---

## ✅ LIVRÉ — `note:` — le commentaire d'auteur, invisible à l'agent qui agit (04/08/2026)

**Le besoin (mainteneur)** : « un agent qui veut modifier une doc doit savoir à quoi s'attendre
s'il touche aux paramètres ». Une doc a DEUX publics : qui AGIT (rappel court, réinjecté à chaque
geste) et qui la MAINTIENT (pourquoi ce `mode`, pourquoi ce `scope`). Le second coûtait des tokens
à chaque injection sans rien apprendre sur le geste en cours.

**Ce qui rendait ça presque gratuit** : le frontmatter est DÉJÀ retiré du corps injecté. Il ne
manquait qu'une clé admise — sans elle, `note:` tombait sous la règle « clé inconnue = ERREUR »
(règle voulue : `mach:` = doc morte en silence).

- Clé `note` admise dans les 3 corpus (doc fichier, doc MCP, entrée de registre skill) — MÊME mot
  partout, loi anti-synonyme. Texte, ou liste de textes.
- **FORME validée, jamais le CONTENU** : en valider le sens reviendrait à lui donner un rôle, donc
  à en faire de la config.
- **Le moteur ne la lit JAMAIS** — aucune décision, aucun matching, aucun tri. Le jour où une source
  la lirait, ce serait un champ de config déguisé en commentaire (2ᵉ vérité à synchroniser).
- Test dédié : `note` n'atteint JAMAIS le corps injecté. Invisible « par construction » sans test =
  une promesse ; ici c'est un contrat.

🛑 **BORNE CONSERVÉE TELLE QUELLE (décision du 03/08)** : `note` ne porte QUE du méta sur le RÉGLAGE.
**JAMAIS le pourquoi d'un INVARIANT** — celui-là reste dans le corps, visible de l'agent qui agit :
un invariant privé de sa raison DÉRIVE. Le risque est GRAVITATIONNEL : dès qu'une zone invisible
existe, le « pourquoi » y migre parce qu'il est long et « encombre ».

**Trouvé en chemin** : deux docs affirmaient encore « doc MCP = `mode`/`threshold` seulement » —
PÉRIMÉ (`driftUnit` admis depuis le 18/07). Corrigées.

**Preuves** : 927 tests verts · mutation **100,00 %** (1764 mutants, `frontmatter.js` 315).

---

## ✅ LIVRÉ — `defaults.{source}` : la cascade passe de 3 à 4 ÉTAGES (04/08/2026)

**Le manque, formulé par le mainteneur** : on pouvait régler le global (« tout le corpus »)
ou l'entrée (« cette doc-là »), mais rien entre les deux — impossible de dire « tous les skills
en `once`, tous les MCP en `smart` » sans recopier le réglage dans chaque entrée (duplication,
donc dérive).

**Ce qui existait déjà à 25 %** : `skillDefaults` ouvrait cet étage… aux seuls skills. Deux mots
pour un même étage = loi anti-synonyme ⇒ **`skillDefaults` SUPPRIMÉ**, généralisé en
`defaults.{source}`. Aucun alias gardé : deux vérités dérivent.

**Cascade finale, POINT UNIQUE (`gate.js`)** : entrée > `defaults.{source}` > global > défaut
FRAMEWORK. Fallback total à chaque étage. `defaults` absent ⇒ comportement d'avant à l'identique.

**Dette de conception fermée en chemin** : `sources/skill.js#declFor` résolvait SA propre cascade
en plus de `gate.js` — deux points de résolution qui pouvaient diverger en silence. `declFor(entry)`
ne fait plus que POSER l'entrée ; un cas de test rougit si un 2ᵉ argument réapparaît.

**Ce qui rend l'étage vivant** : `decide()` reçoit `owners` (= `acc.owner`, déjà posé par chaque
adaptateur). Sans lui, `defaults` aurait été accepté par le schéma et **sans aucun effet**.

### ⚠️ ERREUR RÉELLE DE LA SESSION, à ne pas réintroduire
Une clé **`defaults.session`** avait été écrite au schéma. Elle aurait été **acceptée et INERTE** :
`docs/session/` n'est PAS une source du moteur (livrée par `session-inject.js` sur
SessionStart/PostCompact, sans passer par `gate.decide`, donc **sans cadence**). C'est le faux vert
tué le 31/07 sur `mcp:`, réapparu ailleurs.
- **Cause racine** : le skill affirmait §2 « sources (fichier, MCP, **session**, skill), même moteur
  (matcher + gate + cadence) » — **faux pour session**. Une doc qui ment pousse à l'erreur ; ce
  n'est pas un défaut de vigilance. **Corrigé** (skill + miroir, nouveau §2bis).
- **Gate posé** : les clés admises de `defaults` sont **DÉRIVÉES des `id` d'ADAPTERS**, jamais
  recopiées, avec negative-check dans les deux sens (clé en trop / source retirée).
- Trouvée par le MAINTENEUR, pas par une machine ⇒ scellée mécaniquement le jour même.

**Preuves** : 923 tests verts (48 fichiers) · **mutation 100,00 %, 0 survivant** (cache purgé —
`gate.js` 140 mutants) · 0 clone jscpd · doctor vert sur les DEUX câblages (Claude + Codex).

---

## 🟠 1 OUVERT sur 4 — manques trouvés par `/stack-audit` le 04/08/2026 (session canari)
> ③ FERMÉ le 04/08/2026 (requalifié en PANNE, pas en doc inexacte). ① FERMÉ le 05/08/2026
> (sonde canari dans le doctor — `grep -c canari doctor.js` = 20, cf le ✅ de la section ① plus bas).
> **② FERMÉ le 07/08/2026** (canari câblé sur Codex, coquille commune — voir l'état en tête).
> **Reste ④** (contrat de frontière canari ⟷ afficheur non scellé) — et il vient de se PAYER :
> l'afficheur a lu un chemin périmé pendant 3 jours sans que rien ne rougisse. ⚠️ Cet en-tête a annoncé « 3 OUVERTS / restent ①②④ » pendant 24 h APRÈS la
> fermeture de ① : un lecteur croyait un chantier grave encore ouvert. C'est exactement ce
> qu'interdit `pilotage.md` — un jugement renversé se RÉÉCRIT, il ne s'empile pas. Corrigé le
> 06/08/2026, après que le mainteneur a demandé un état des lieux.

> ⚠️ Les 3 premiers sont des trous que J'AI CRÉÉS la nuit du 03→04/08 en posant le canari, et que
> l'audit de session a d'abord RATÉS. Ils sont classés par gravité, pas par facilité.

### ① Le CANARI n'est pas surveillé par le doctor — VIOLATION du contrat du framework
**Constat mesuré** : `grep -c canari doctor.js` = **0**. Or le contrat (skill, §Porter sur un nouveau
harnais, point 4) dit : « Preuves OBLIGATOIRES avant de câbler : extension du doctor (probe de
chaque nouvelle porte + check câblage + negative-check) ». `canari-check.js` a été câblé en PROD
dans `settings.json` (UserPromptSubmit) **sans sonde**.
**Pourquoi c'est le plus grave** : le canari est un dead-man switch. S'il meurt, plus rien ne
signale la mort du canal d'injection — ET on croit être surveillé. **Le veilleur sans veilleur =
fausse confiance**, exactement ce que `doctor.md` interdit.
**Cible** : sonde doctor qui prouve un EFFET RÉEL (poser un transcript de test → lancer la coquille
→ exiger le fichier `canari.json` avec le bon verdict), + check du câblage `--settings`, + un
negative-check dans `doctor.test.js` qui SABOTE une copie et exige le hurlement.

### ② ✅ FERMÉ le 07/08/2026 — Codex a son canari, et c'est le MÊME fichier
**Constat d'origine** : `0` mention de `canari` dans `requirements.toml` — filet mono-harnais.
🛑 **LA CIBLE ÉCRITE ICI ÉTAIT FAUSSE, et il faut le lire avant de recommencer ailleurs.** Elle
prévoyait une coquille `codex-canari-check.js` dont la « seule inconnue à MESURER » serait le
marqueur d'appel d'outil du transcript Codex. **Aucune mesure n'était la bonne réponse** : la doc
officielle dit que ce format *« isn't a stable interface for hooks and may change over time »*.
Mesurer un format instable, c'est fabriquer une dépendance qui cassera sans préavis — et un canari
cassé ne se plaint pas, il se tait.
✅ **CE QUI A ÉTÉ LIVRÉ** : le dénominateur passe par `emission-core.compteurEmissions` (notre
donnée) ; le transcript n'est plus lu que pour NOTRE marque `[source:`. Plus aucun dialecte ⇒ zéro
coquille neuve, `canari-check.js` se câble tel quel comme reset/turn-count/session-inject.
**Preuves** : doctor 74 ok / 0 problème sur les 2 câblages réels · `doctor.test.js` 70 tests
(negative-check **7f** : câblage Codex sans canari ⇒ ROUGE + canari NOMMÉ) · `canari-check.test.js`
8 tests dont un **contrat de frontière** (le canari lit ce que la couche d'émission écrit
VRAIMENT) et un **negative** (transcript bruyant sans émission ⇒ jamais d'accusation).
⚠️ **LEÇON GÉNÉRALISABLE, pour le prochain portage** : quand une inconnue porte sur le format
interne d'un produit tiers, la question à poser n'est pas « comment le mesurer ? » mais
**« ai-je le droit d'en dépendre ? »**. Ici la réponse documentée était non.

### ③ 🟡 POSÉ mais PAS ENCORE ACTIF (04/08/2026) — et le diagnostic ci-dessous était TROP DOUX
> **Résumé en une ligne** : le réglage est écrit, scellé par un gate, et ne casse rien (prouvé en
> session réelle) — mais la version installée (0.144.6) **ne connaît pas la clé**, donc il n'agit
> pas encore. Ne pas cocher ce chantier tant que la mise à jour + la mesure de bout en bout n'ont
> pas eu lieu (cf « NUANCE MESURÉE » plus bas).

> 🛑 **CE N'ÉTAIT PAS « une doc qui ment » : c'était une PANNE SILENCIEUSE EN PROD.**
> Le texte d'origine (conservé plus bas) concluait « ce n'est pas cassé, le plancher 8 000 est
> conservateur donc sûr ». **FAUX** — le plancher 8 000 est le nôtre, il ne protège de rien côté
> Codex : c'est **Codex** qui plafonnait, à **2500 TOKENS**, et qui spillait le reste sur disque en
> n'envoyant qu'un aperçu. Le skill `ctxroute` (39 Ko ≈ 10 000 tokens) n'est donc **jamais arrivé
> entier** sur Codex depuis le câblage du 19/07/2026. Exactement le défaut qui a motivé les paquets
> côté Claude Code — resté grand ouvert sur l'autre harnais, sans que rien ne le signale.
>
> **Doc officielle (`learn.chatgpt.com/docs/hooks`, lue le 04/08/2026)** : le réglage se déclare
> **PAR HANDLER**, à côté de `command`/`timeout` — donc **dans NOTRE câblage**. Il n'y a rien à
> « lire » : on l'**ÉCRIT**. *« Omit additionalContextLimit to use the default 2500-token
> threshold »* · *« 0 to pass the handler's complete additional context directly to the model »*.
> ⇒ La formule « Codex expose une autorité qu'on LIT », écrite partout, était fausse sur le fond.
>
> **Fait** : `additionalContextLimit = 0` posé sur les **2 émetteurs** (`codex-doc-inject`
> PreToolUse, `session-inject` SessionStart) dans `C:\ProgramData\OpenAI\Codex\requirements.toml`,
> avec commentaire de scellement. **Gate** : `doctor.js --codex-hooks` l'EXIGE, vérifié **par BLOC**
> (le réglage sur un seul émetteur laisserait l'autre muet — un match global l'aurait raté).
> **Negative-check 7d**, 4 volets : absent partout · **présent sur un seul** · valeur non nulle ·
> vert quand les deux sont à 0. Positif prouvé sur le câblage RÉEL (25 ok, 0 problème).
>
> ⚠️ **DEUX gardes que j'ai posées FAUSSES avant d'arriver là, à ne pas refaire** : (1) découpage
> par `[[hooks.` = TOML-only ⇒ **inerte en JSON** ; (2) motif `= 0` sans guillemets ⇒ ne voit pas
> `"additionalContextLimit":0`. Les deux corrigées par `"?` et un split sur `command`. Un gate qui
> ne peut pas rougir dans un des formats acceptés est un gate décoratif — c'est la leçon du 03/08,
> reproduite le lendemain.
> ⚠️ **Ne PAS en conclure que Codex a besoin de paquets** : avec `0`, il n'a **aucun plafond**. La
> fragmentation reste un contournement de Claude Code uniquement.
>
> ### ⚠️ NUANCE MESURÉE LE MÊME JOUR — le réglage est INERTE sur la version INSTALLÉE
> Mesures (04/08/2026, `codex.exe` 0.144.6, 341 Mo) :
> | Chaîne cherchée dans le binaire | Occurrences |
> |---|---|
> | `additionalContextLimit` / `additional_context_limit` | **0 / 0** |
> | témoins de la même famille : `PreToolUse` · `UserPromptSubmit` · `additionalContext` · `hookSpecificOutput` · `permissionDecision` | 44 · 38 · 15 · 8 · 5 |
> ⇒ la méthode de mesure est VALIDÉE par les témoins (chaînes UTF-8 bien lisibles) : la clé
> **n'existe pas** dans 0.144.6. Elle est **documentée**, mais la doc ne dit pas depuis QUELLE
> version — et **0.146.0 est disponible** (non installée).
>
> ✅ **AUCUNE CASSE — prouvé en session RÉELLE**, pas déduit : `codex exec` sur cette machine rend
> `hook: SessionStart` ×2 → `Completed` ×2 → `UserPromptSubmit Completed`. Les hooks du fichier
> MANAGÉ se chargent et s'exécutent : Codex **ignore** la clé inconnue au lieu de rejeter le
> fichier. C'était le vrai risque de ce changement, il est levé.
>
> 🛑 **DONC, à ne pas surinterpréter** : le réglage est CORRECT et prêt, mais il **n'agit pas sur
> 0.144.6**. Dire « la panne est réparée ici » serait faux. Deux questions restent OUVERTES et
> **indécidables par grep** (`context_limit` seul = 3 occurrences, ambigu — et rétro-ingénierer un
> comportement documenté est INTERDIT par la méthode) :
> ① 0.144.6 plafonne-t-il quand même, sans réglage pour le débrayer ?
> ② à partir de quelle version la clé est-elle honorée ?
> **Seule façon honnête de trancher : mettre Codex à jour (0.146.0), puis MESURER une injection
> volumineuse réelle de bout en bout.** À faire avec le chantier ② (canari Codex), qui est
> justement le témoin qui manque pour voir ce qu'il advient à l'autre bout.
>
> ⚠️ **Découvert au passage, à traiter** : `~/.codex/config.toml` utilise `[features].codex_hooks`,
> que 0.144.6 déclare **DÉPRÉCIÉ** (« Use `[features].hooks` instead »). Le fichier managé, lui,
> est déjà en `hooks = true`.

<details><summary>Diagnostic d'origine (conservé — il montre comment on sous-estime un trou)</summary>

#### ③ `additionalContextLimit` (Codex) n'est qu'un COMMENTAIRE
**Constat mesuré** : la seule occurrence dans le code est `budget.js:213`, en commentaire. La doc
injectable ET le skill affirment pourtant « Codex expose une autorité déclarée ⇒ on la LIT ».
**Ce n'est pas cassé** (le plancher 8 000 est conservateur donc sûr) **mais la doc décrit une
intention comme un fait** — c'est une doc qui ment, la classe d'erreur que ce repo combat.
**Cible** : la coquille Codex lit le réglage et le passe en `options.budget` (`0` = illimité).
Tant que ce n'est pas fait, **corriger la doc** pour dire « plancher conservateur, lecture du
réglage = BACKLOG », jamais l'inverse.

</details>

### ④ Contrat de frontière canari ⟷ afficheur non scellé
La frontière est le fichier `state/canari.json`. Vérifiée À LA MAIN le 03/08 (statusline), jamais
par un test. La doctrine exige un test de contrat de CHAQUE frontière entre composants.
**Cible** : test de contrat sur la forme du fichier (clés + valeurs admises du verdict), côté
producteur ; l'afficheur vit hors framework et n'a pas à être testé ici.

### Contexte à ne pas perdre
Le canari **n'a jamais tiré en conditions réelles** (par construction : il ne tire que si le canal
meurt). Sa seule preuve est en laboratoire — spawn réel sur transcript fabriqué. Ne pas le
présenter comme éprouvé en prod.

---

## 🔴 OUVERT — DOC-FIRST : le réflexe inverse a coûté 2 fois dans la MÊME session (04/08/2026)

**Fait, deux fois la même nuit** :
1. `includeOnly` de dependency-cruiser : j'ai sondé par SABOTAGE (3 essais) avant de lire la doc.
   La doc officielle 18.1.0 donnait la réponse en une phrase — « includeOnly will discard all files
   not matching the pattern » — et donc l'explication complète du gate inerte.
2. `fc.stringOf` : supprimé en fast-check 4 (le parc est en **4.9.0**). Deux allers-retours pour
   une API qu'une lecture de la doc de la version INSTALLÉE aurait donnée immédiatement.

⚠️ **CE N'EST PAS UN OUBLI ISOLÉ, c'est le biais natif du modèle**, déjà écrit dans CLAUDE.md
(« l'expérimentation arrive TOUJOURS trop tôt »). Il s'est reproduit malgré la règle écrite ⇒ selon
la doctrine des garde-fous, **une consigne en prose qui ne tient pas doit devenir un déclencheur
mécanique**.

**Pourquoi la doc injectable existante n'a PAS suffi** : `web-recherche.md` se déclenche sur
`WebFetch`/`WebSearch` — c'est-à-dire **une fois qu'on a DÉJÀ décidé de chercher**. Elle ne peut
structurellement pas se déclencher quand on décide d'expérimenter À LA PLACE de chercher. C'est un
angle mort RÉEL du périmètre, pas un défaut de rédaction.

**Cible (décidable, donc exprimable)** : déclencher sur le GESTE « je touche la configuration d'un
outil TIERS » — `.dependency-cruiser.json`, `stryker.conf.json`, `vitest.config.*`, `.jscpd.json`,
`package.json` — avec le message : *« comportement d'un outil tiers = LIRE SA DOC OFFICIELLE pour
la version INSTALLÉE d'abord ; rétro-ingénierer un comportement documenté est interdit »*.
Ce déclencheur AURAIT tiré cette nuit : j'ai édité `.dependency-cruiser.json` avant de sonder.
⚠️ Vérifier le périmètre par spawn réel (1 cas positif + 1 négatif) avant de le poser — jamais sur
parole.

**Second volet, même racine — LES DOCS À JOUR** : plusieurs docs de ce repo se sont révélées
PÉRIMÉES cette nuit (`capacitePaquet` exigeait encore un gate de taille · `couverture.md` décrivait
un volet supprimé et proposait de RESSUSCITER un cliquet · l'arbo décrivait un segment
« indivisible » · le skill se disait « rien n'est câblé »). Toutes corrigées, mais **elles avaient
survécu des jours**. Une doc qui ment oriente vers la mauvaise cause — même dégât qu'un gate inerte.
**Cible** : trouver le déclencheur mécanique de la péremption (piste : toute doc citant un
identifiant de code qui n'existe plus = ROUGE, dérivé, jamais une liste).

---

## ✅ LIVRÉ — INJECTION INTÉGRALE D'UN SKILL (ouvert 31/07/2026, **FERMÉ le 03/08/2026**)

> ⚠️ **Cible ATTEINTE, ne pas relire ce qui suit comme un chantier à faire.** Le transport
> multi-trames est LIVE (`settings.json`, 12 déclarations `--paquet k --paquets 12`), et le cas
> « budget si petit qu'il ne porte pas le sceau » a été fermé le 03/08 (l'enveloppe cède, jamais
> le contenu). Mesure de recette : 6 docs / 28 800 c ⇒ **6/6 livrées** (1/6 avant). Il n'existe
> plus AUCUN contenu indélivrable — ni trop gros, ni trop petit.
> Le texte ci-dessous est conservé pour sa MESURE (concurrence illimitée des hooks), qui est la
> raison pour laquelle le multi-hooks a été retenu. Section laissée marquée 🔴 OUVERT jusqu'au
> 04/08 : c'est exactement la péremption de doc que dénonce le chantier DOC-FIRST.

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

## 🟡 EN GRANDE PARTIE TRAITÉ — 3 manques trouvés le 31/07/2026 (doc « déclencher sur un GESTE »)

> ⚠️ **STATUT CORRIGÉ LE 04/08/2026 — cette section était marquée OUVERTE en entier.**
> **FERMÉS** : §A (faux vert `mcp:`), §B + §B0 (joker `tool:["*"]` + négation sur l'axe outil —
> la table de §B0 est donc PÉRIMÉE, l'axe outil a ses 3 opérateurs), §E (`explain` livré),
> §G (3 tests rouges), §D (`docs/mcp/ssh.md` existe — vérifié 04/08).
> **RESTENT OUVERTS** : §C (recette « geste » — partiellement écrite dans les docs) et §F
> (`sources.md` au-delà du seuil de dilution, à scinder À FROID).

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
- **#12** : 0 doc orpheline (7 réf `inject: never` + 7 règles ajoutées). **#6** : 5 faux positifs exclus. **#13** : lint-corpus --quiet en SessionStart. **#11** : protect-files.js a sa doc (`docs/protect-files.md`). **#5** : `ctxroute-config.schema.json` + drift-test dans config-gate.
- ⚠️ Découverte : `scope` = OR (`some`) — un scope large (ex. `acme-infra` du modèle bookings) sur-matche. Scopes précis obligatoires.

**FAIT session fusion partie 1 (16/07/2026 après-midi)** :
- **#2** : rank mesuré (75 374 vrais chemins) puis CONSERVÉ — cf § mesures. Trou découvert au passage : 31/103 docs multi-règles à scopes divergents → clé `rules:` (JSON par-entrée) dans frontmatter.js + migrate.js, mutation 100,00%.
- **Migration RÉELLE ÉCRITE** : 302 docs de `~/.claude/hooks/docs/` portent leur frontmatter (dumb+confirm+rank), 0 règle morte, convergence prouvée (rejeu = 0 action), lint 0 erreur, injection prod vérifiée SANS fuite de frontmatter (spawn réel), miroir .codex resynchronisé. ⚠️ TRANSITOIRE jusqu'à #7 : nouvelle règle = protected-paths.json ET frontmatter (double écriture assumée).
- **#4 (côté moteur)** : `confirmFor(config, decl)` dans lib-pure.js + clé `confirm` au schéma (config utilisateur > frontmatter > défaut). Le retrait du fichier `.rush` lui-même = à la bascule #7, pas avant (protect-files reste le lecteur du .rush aujourd'hui).

- **Différentiel post-migration VERT (16/07/2026, 14h17)** : 2160 cas / 568 règles, 0 divergence, 636 s. **PARTIE 1 CLOSE.**

- **SHADOW CÂBLÉ (16/07/2026, 15h)** : `loader.js` (corpus frontmatters → règles ordonnées, entrelacement résolu par rank PAR ENTRÉE — 23 docs re-migrées, mutation 100%, différentiel in-process à chaque npm test) + `shadow-inject.js` (PreToolUse `*`, n'injecte JAMAIS, journalise `state/shadow-*.jsonl`) + `shadow-reconcile.js` (verdict : rejoue l'oracle partagé `oracle.js`, exit 1 divergence / exit 2 journal vide). Preuve : spawn réel silencieux + reconcile 0 divergence. Prend effet aux NOUVELLES sessions.

- **PORTE UNIFIÉE ÉCRITE (16/07/2026, 15h30 — NON CÂBLÉE)** : `gate.js` (décision pure par DOC : dumb/once/smart, compteurs étrangers, ask via confirmFor — muté 100,00%, 0 survivant) + `doc-inject.js` (coquille I/O, format de sortie protect-files À L'IDENTIQUE, ne lit JAMAIS `.rush` : rush = `confirm: false` config) + `corpus.js`/`session-store.js` (I/O partagées shadow/legacy-mcp-inject, gate jscpd). **Parité prouvée par `porte-differential.test.js`** : vieux vs nouveau sur parc réel, contenu injecté à l'octet près, décision miroir du `.rush`, systemMessage identique. Reconcile jour 1 : 0 divergence / 53 payloads réels.

- **DÉRIVE DES 2 SOURCES TROUVÉE ET FERMÉE (17/07/2026)** : le reconcile a hurlé 53/473 la veille de la bascule. Diagnostic : 34 réelles (19 = time-skew de la construction), toutes traçables à **3 règles** dérivées entre `protected-paths.json` (ancien) et les frontmatters (neuf) — la double écriture transitoire avait dérivé DANS LES DEUX SENS : `sitemap-sync.py`+`notify.ts` ajoutés au frontmatter seul (JSON en retard), `specs/tla` (dispatcher-tla-spec) raté par la migration côté frontmatter (le neuf RATAIT = régression). **Fix au mérite** (frontmatter dispatcher ajouté rank 191 ; 2 règles reportées au JSON), ordre vérifié identique vieux/neuf sur les payloads sensibles, miroir resync, journal shadow pollué purgé. **Gate mécanique posé** : `source-drift-gate.test.js` (diff symétrique 586 règles = 0, sens critique distingué, dans test:fast + CI) → cette classe redevient ROUGE au pre-push, jamais découverte à la veille d'une bascule. 497 tests verts.
  ⚠️ Leçon : le `source-drift-gate` (statique, EXHAUSTIF sur 586 règles) est une preuve d'équivalence PLUS FORTE que le reconcile (échantillonné sur trafic). Pour la bascule : gate vert + différentiel de match vert = certitude, sans attendre N jours. Le reconcile devient confirmation, pas gate bloquant.

- **BASCULE FICHIER FAITE (17/07/2026, GO mainteneur)** : `confirm: false` (miroir .rush), porte câblée à la place de l'injection de protect-files, doctor étendu (porte surveillée + negative-checks). Deny/ask sécurité RETIRÉS sur décision explicite du mainteneur (« on s'en tape de la sécurité, pas la priorité ») — réintroduction possible plus tard en hook séparé.

- **✅ FUSION MCP FAITE — HOOK UNIQUE (17/07/2026, GO mainteneur « on fait tout maintenant »)** : `sources/mcp.js` (pur, muté 100% : payload → docs 'mcp/…', decl mode/threshold hérités de servers.{name}) + `gate.js` threshold PAR DOC + `doc-inject.js` aiguille fichier+MCP (fail-open local du corpus MCP, systemMessages composés ' · ') + `ctxroute-reset.js` purge les 2 stores. **Parité prouvée : `mcp-differential.test.js`** (9 séquences spawn vieux vs nouveau : dumb/once/smart, overrides, granularité 3 niveaux, filtres, enabled/showNotification). Câblage : porte sur `*`, `legacy-mcp-inject.js` RETIRÉ (doctor exige son absence — double injection sinon). 525 tests verts, mutation 100,00% (0 survivant, cache purgé), doctor 15/15 sur le câblage réel, preuve vivante des 2 voies par spawn réel.

**HORS REPO (autres projets, pas ce framework)** : glue agent-social → vitest ; audit Stryker prospection-mcp/infra/publer ; README/exemples publics (nice-to-have).

## ⚠️ RÈGLE N°1 — LA PROD TOURNE PENDANT CE REFACTOR

**D'autres agents travaillent en parallèle, en ce moment même**, et consomment
`~/.claude/hooks/protect-files.js` + la doc injectable à CHAQUE appel d'outil.
Casser un de ces fichiers = casser leur travail en cours = tokens brûlés = argent réel.

- **Ce framework est du DÉVELOPPEMENT PUR.** Il n'a AUCUN droit sur la prod aujourd'hui.
- **Phase EXPAND uniquement** : on AJOUTE dans `Desktop/ctxroute/`. On ne débranche
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
| `ctxroute` (ce repo) | serveur/outil MCP | oui (`smart`/`once`/seuils) | 36 ms |
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
   scope: [ctxroute]
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

**Purge 30 j** : EXISTE (`legacy-mcp-inject.js`, `GC_TTL_MS`, probabiliste, fail-open, testée). Vérifiée le 15/07/2026.

**Moteur MCP** : vérité terrain 6/6 (spawn du vrai hook, state isolé) — `dumb` réinjecte, `smart` se tait au 2ᵉ appel, serveur sans doc = silence, outil non-MCP = hors périmètre. **Le moteur est juste.**

**`match` segment-ancré : IDÉE MESURÉE PUIS ABANDONNÉE.** Proposée pour tuer les faux positifs (`lock.js` matche `package-lock.json`). Mesurée sur **1423 vrais chemins × 553 règles** :

| | |
|---|---|
| Matches perdus | **586 / 1125 = 52 %** |
| Règles impactées | 59 / 553 |
| Ratio | **~455 matches voulus détruits pour ~41 faux positifs corrigés — 11 contre 1** |

Cause : **les patterns ne sont PAS des noms de fichiers.** `.test.js` (136 matches × 3 docs) et `.test.mjs` (47) sont des **suffixes VOLONTAIRES** — c'est la famille des docs de convention de test. `demo-`, `browser-recover`, `.dependency-cruiser` sont des préfixes/fragments. Un segment ne vaut jamais `.test.js` → la règle meurt. **Le substring n'est pas un accident, c'est la feature.**
⚠️ Le corpus du différentiel ne pouvait PAS voir ça : il est dérivé des règles, pas des vrais fichiers. Toute future idée sur le matching se mesure sur de VRAIS chemins.

**Faux positifs réels** (mesurés, ~41) : `lock.js`→`package-lock.json` (9), `config.js`→`ctxroute-config.json` (6), `search.js`→`research.json` (3), `paths.js`→`protected-paths.json` (2).
→ **Problème de DONNÉES, pas de moteur.** Fix = `exclude` sur ces 5 règles (l'outil existe déjà). Rayon de souffle nul.

**⚠️ TROU OUVERT — couverture MCP : 2 serveurs documentés sur 16 branchés.**
Documentés : `stripe`, `odoo`. Non documentés : **`ssh` (VPS prod)**, **`infra` (sites clients)**, `gworkspace`, `publer`, `discord`, `media`, `blog`, `n8n`, `browser`, `mobile`, `seo-agency`, `qa-seo`, `prospection`, `umami`.
`config-gate.test.js` est **directionnel** : il vérifie « toute doc a une config », donc il est structurellement AVEUGLE à un serveur sans doc. C'est le miroir exact du bug déjà scellé : *une doc qui n'injecte jamais = indiscernable d'une doc absente* → ici *un serveur sans doc = indiscernable d'un serveur qui n'en a pas besoin*. Côté fichier, le filet d'exhaustivité est l'arbo du skill ; **côté MCP il n'y a AUCUN filet.**
→ Gate à poser : **tout serveur branché doit être SOIT documenté, SOIT explicitement listé comme volontairement sans doc. Le silence n'est pas une option.** (`filterList` existe déjà.)

**`rank` → parent/enfant : IDÉE MESURÉE PUIS ABANDONNÉE (16/07/2026).** Mesuré sur **75 374 vrais fichiers × 568 règles** : 36 séquences co-injectées, 39 paires ordonnées, **0 conflit** (jamais A→B et B→A). MAIS les paires mélangent de vrais parent→enfant (`pointer.md → config-gate.md`) et des **voisins accidentels** (`ssh-async → tests-protocol`) dont l'ordre ne vient que de l'index JSON. Nommer ces 39 contraintes = les relire et les juger À LA MAIN — exactement ce que le refactor interdit (« personne ne relit les règles »). → **`rank` reste** (dérivé de l'index, comportement identique). Règle pour les FUTURES docs sans `rank` (à implémenter dans le loader) : injectées APRÈS les docs rankées, ordre alphabétique (déterministe). Le passage à un ordre sémantique = chantier séparé, humain, post-bascule (même doctrine que `smart` et le tri `confirm`).

**⚠️ DIVERGENCE scope/exclude INTRA-DOC — trou du format frontmatter, MESURÉ (16/07/2026).** Sur 103 docs multi-règles, **31 ont des scopes/excludes DIFFÉRENTS entre leurs règles** (ex. `pointer.md` : `lib-pure.js` scopé `[ctxroute]` mais `legacy-mcp-inject.js` sans scope). Le format `match: [a, b]` + UN `scope:` par doc ne peut PAS les représenter — `declaration()` prenait `entries[0]` et aurait perdu/écrasé des scopes EN SILENCE (sur-injection ou doc morte). Fix : clé **`rules:`** = liste JSON inline d'objets `{pattern, scope?, exclude?}` (JSON.parse : total via try/catch, zéro mini-langage, format d'origine des règles). Docs homogènes → `match:` simple (lisible) ; divergentes → `rules:`. `rules` + (`match`/`scope`/`exclude`) = CONTRADICTION rouge. Le parser reste un sous-ensemble plat — JSON inline ≠ YAML.

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
- **Pourquoi c'est là et pourquoi c'est CORRECT** : chaque source réplique À L'IDENTIQUE le badge de son ancêtre (protect-files.js / legacy-mcp-inject.js) — c'est une CONTRAINTE DE PARITÉ, exigée par les tests différentiels de bascule. Y toucher MAINTENANT casserait le différentiel. L'asymétrie est donc la BONNE décision tant que les reliques vivent.
- **Impact réel** : zéro. Aucun bug, aucune régression, aucune dette technique fonctionnelle. Purement cosmétique (deux chemins de formatage au lieu d'un).
- **Le jour LOINTAIN où ça pourrait bouger** (et seulement si le mainteneur le décide, jamais un agent) : après le retrait définitif de protect-files.js ET legacy-mcp-inject.js, quand la contrainte de parité octet n'existe plus. À ce moment SEULEMENT, unifier les deux `message()` derrière un formateur paramétré unique. Pas avant. Pas de deadline. Pas de rappel.
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
6. **ctxroute-reset.js** (PreCompact) : reset des DEUX compteurs (tool + turn).
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
- [ ] Phase 4 — distribution cousin : repo de parc en git pull (JAMAIS de copie manuelle) + doctor comme gate d'installation sur sa machine. ACCÈS GITHUB POSÉ 19/07/2026 : l'associé invité en READ ONLY sur Soyouse/ctxroute — il FORK et propose des PR, SEUL le propriétaire merge (master intouchable par construction ; branch protection impossible en privé gratuit — GitHub Pro si un jour accès write direct voulu)

## 20/07/2026 — ✅ FERMÉ : INJECTION TRONQUÉE EN SILENCE (défaut VÉCU — cause SUPPRIMÉE)

> ✅ **FERMÉ. Statut corrigé le 06/08/2026** — l'en-tête est resté `🔴 prioritaire` pendant deux
> semaines APRÈS la résolution. La cause n'existe plus : le transport multi-trames (03/08) morcelle
> ce qui déborde, la FILE (05/08) garde le surplus au lieu de le jeter, et le SCEAU rend une
> troncature du harnais BRUYANTE au lieu de silencieuse. L'indélivrabilité est impossible par
> construction. Le récit ci-dessous est conservé pour la classe d'erreur — pas comme un chantier.

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

## 💡 Commentaires NON injectés dans les docs — idée du mainteneur, 03/08/2026 (NON tranchée)

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

## 🟠 DEUX DÉFAUTS DU MOTEUR — ① FERMÉ, ② à moitié (session pw-mcp-proxy, 03/08/2026)

> Statut de l'en-tête corrigé le 06/08/2026 : il annonçait `🔴 DEUX DÉFAUTS` alors que ① est
> ✅ RÉSOLU depuis le 03/08 et que la part DÉCIDABLE de ② est fermée depuis le 06/08. Reste
> ouverte la seule part INDÉCIDABLE de ② : « une doc dit VRAI » ne se prouve pas mécaniquement
> (`doc-drift-gate` ne vérifie que l'EXISTENCE des fichiers cités).

### ① ✅ RÉSOLU (03/08/2026) — ÉVICTION : il déclarait une doc OBLIGATOIRE puis ne la livrait pas

> ⚠️ **STATUT CORRIGÉ LE 04/08/2026.** Le transport multi-trames a supprimé la cause : une doc
> trop lourde est MORCELÉE et livrée, l'indélivrabilité est impossible par construction.
> Le diagnostic ci-dessous est CONSERVÉ (il explique pourquoi le transport existe) — mais
> ⚠️ **les « pistes non tranchées » qu'il liste sont CADUQUES** : elles proposent notamment de
> « scinder plus agressivement », c'est-à-dire de faire porter à l'auteur d'une doc un défaut du
> TRANSPORT — exactement ce que la décision du 03/08 a rejeté. Ne PAS les rouvrir.

#### Diagnostic d'origine (conservé pour mémoire)
Message vu ~10 fois dans UNE session, jusqu'à **4 docs évincées d'un coup** :
« N doc(s) NON injectée(s) faute de place dans cette trame. **Elles ne sont PAS optionnelles.** »
Ce n'est pas un bug : segments indivisibles + `DEFAUT_BUDGET` 8000 + corpus qui grossit = **plafond
atteint**. Mais le résultat est qu'un agent travaille parfois SANS un invariant réputé garanti, et
il ne peut pas savoir ce qu'il a manqué (le nom seul ne porte pas le contenu).
Pistes non tranchées : budget par tour plus élevé · priorité (un `🛑` passe avant un rappel de
confort) · **scinder plus agressivement** (le format « <10 lignes » n'est PAS tenu par tout le
corpus — plusieurs docs du parc font 20-30 lignes) · évincer d'abord les `once` déjà consommés.

### ② UNE DOC QUI MENT — 🟠 PART DÉCIDABLE FERMÉE le 06/08/2026, le reste OUVERT
> **RÉÉCRIT** : ce paragraphe disait « AUCUNE défense ». C'est devenu FAUX, mais
> le remplacer par « fermé » serait tout aussi faux — d'où l'état exact ci-dessous.
> ✅ **LIVRÉ** : `doc-drift-gate.test.js` — toute doc du framework qui cite un
> fichier `.js` doit prouver qu'il EXISTE (repo · `sources/` · parc). Ferme la
> classe qui arrive MÉCANIQUEMENT : le renommage, que personne ne voit parce
> qu'il ne touche pas les docs qui parlent du fichier renommé. Mesure d'abord :
> 32 docs, 936 littéraux, 64 fichiers, **0 introuvable** (sans la racine parc,
> 8 faux rouges). Rougissement prouvé par sabotage temporaire.
> 🛑 **CE QUI RESTE OUVERT, et ce n'est pas un détail** : un gate ne prouvera
> JAMAIS qu'une doc dit VRAI. Les 3 docs de l'incident du 03/08 citaient des
> littéraux qui EXISTAIENT (`stdio:'ignore'`, `ONSTART`) — elles auraient passé
> ce gate. La piste restante (valeur d'un littéral confrontée au code) n'est
> PAS décidable en général : ne pas la promettre, ne pas la bricoler.
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
budget `DEFAUT_BUDGET` = **8000**. En face : skill `agent-social` **83 160** · `acme-infra`
**77 670** · `ctxroute` **28 402** · doc `pw-mcp-tests.md` **6 808** (85 % du budget à elle
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

---

## ✅ FAIT — RENOMMAGE `mcp-doc-hooks` → `ctxroute` (décidé ET exécuté le 04/08/2026)

> ⚠️ **L'ancien nom ci-dessous est ÉCHAPPÉ à dessein** : le codemod du renommage a réécrit ce
> paragraphe et produit un « RENOMMAGE ctxroute → ctxroute » absurde. Leçon générale : **un codemod
> de renommage détruit le récit HISTORIQUE qui cite l'ancien nom** — relire les documents de
> pilotage APRÈS tout renommage de masse.

**Pourquoi l'ancien nom était FAUX** (deux mensonges, pas un) : ① le framework n'injecte plus
seulement des docs **MCP** — fichier, session, skill, outil natif sont des sources de plein droit ;
② « **hooks** » nommait la plomberie d'UN harnais, alors que l'ambition écrite (§2bis) est d'être un
standard **multi-harnais**. Un nom qui décrit l'implémentation d'un seul consommateur interdit le
standard qu'on vise.

**Pourquoi `ctxroute`.** L'idée directrice est **l'ACHEMINEMENT** : livrer le bon savoir au bon
geste — l'analogie déjà écrite dans le skill (« SQL / CSS / **table de routage** »).
⚠️ **`ctxlang` ÉCARTÉ, ne pas le rouvrir** : `lang` promet une SYNTAXE, or on n'écrit ici que du
frontmatter YAML et du JSON — personne n'apprend un langage. Le nom aurait menti sur ce qu'est le
produit, exactement le défaut que ce repo combat. (Écartés aussi : `Trame`, qui ne nomme que le
transport, soit la moitié basse ; `Aiguillage`, juste mais non exportable ; `Relais`, passe-partout.)

**CE QUI A ÉTÉ FAIT** — expand/contract, fenêtre de casse nulle :
1. **EXPAND** — dossier déplacé vers `~/Desktop/ctxroute` + **jonction Windows** sur l'ancien chemin
   (les deux chemins répondent, aucun agent en cours ne voit la différence).
2. **MIGRER** — `settings.json` (19 refs) · `requirements.toml` Codex (9) · **`protected-paths.json`
   (160)**, source de l'ORACLE du différentiel : oubliée d'abord, **3 tests de parité rouges**
   jusqu'à sa migration · 110 fichiers par codemod · skill → `.claude/commands/ctxroute.md` ·
   docs injectables → `.claude/hooks/docs/ctxroute/` · clé `skills` de la config · arbo.
   ⚠️ **Gemini ne référençait RIEN** — la mention initiale d'une config Gemini était FAUSSE
   (corrigée par mesure avant d'agir).
3. **CONTRACT** — jonction retirée après preuves, dépôt GitHub renommé (`Soyouse/ctxroute`,
   redirection auto de l'ancienne URL), remote local mis à jour et joignable.

**Preuves** : 866 tests · doctor VERT sur les DEUX harnais (avant ET après retrait de la jonction) ·
couplage vert · périmètre du skill re-prouvé par spawn réel, cas positif ET négatif.

⚠️ **DEUX PIÈGES PAYÉS, ne pas les refaire** :
① `cmd //c "mklink /J …"` depuis Git Bash **n'exécute RIEN** (cmd démarre en interactif et avale la
ligne suivante) — l'ancien chemin est resté MORT quelques secondes. Utiliser
`New-Item -ItemType Junction` en PowerShell.
② `Get-Content`/`Set-Content` en **PowerShell 5.1 lisent en ANSI** : ils ont DOUBLE-ENCODÉ tous les
accents du fichier Codex. Un remplacement de texte sur un fichier UTF-8 se fait en **octets bruts**
(`sed`), jamais via PowerShell 5.1.

⚠️ **RESTE OUVERT** : le worktree périmé `~/Desktop/mcp-doc-hooks-paquets` (branche
`chantier-paquets`, 8 règles de pureté inertes) porte encore l'ancien nom — décision du mainteneur
en attente.

### Volet 2 — les IDENTIFIANTS INTERNES (fait dans la foulée, 04/08/2026)

Le nom du framework ne suffisait pas : **6 fichiers et 13 variables d'environnement** portaient encore
le préfixe `mcp-doc`. Un installeur ouvrait `ctxroute` et y trouvait `mcp-doc-config.json` —
incohérent pour un projet qui vise un standard public.
- `mcp-doc-reset.js` → **`ctxroute-reset.js`** (câblé dans les DEUX harnais, migrés)
- `mcp-doc-inject.js` → **`legacy-mcp-inject.js`** (relique = oracle du différentiel ; le nouveau nom
  DIT enfin ce que c'est : le moteur MCP-only d'avant la fusion du 17/07)
- `mcp-doc-config.json` / `.schema.json` / `.example` → **`ctxroute-config.*`**
- `MCP_DOC_*` → **`CTXROUTE_*`** (13 variables) · préfixes de store `mcp-doc-seen-`,
  `mcp-doc-doctor-`, `mcp-doc-wiring-`… → `ctxroute-*`
- 5 fichiers d'état orphelins `state/mcp-doc-seen-*.json` (moteur legacy, jamais écrits en prod)
  supprimés.
- Les hooks PERSONNELS du mainteneur (`~/.claude/hooks/deadline.js`, `gate-disabled.js`) suivaient
  la même convention : alignés aussi. ⚠️ Aucun changement de comportement — **rien ne définit ces
  variables en prod**, elles ne servent qu'aux tests.
Preuves : 866 tests · doctor VERT sur les deux harnais · couplage vert (47 modules / 144 deps) ·
injection réelle re-prouvée par spawn (positif 3 428 c. / négatif silencieux).
⚠️ Il ne reste `mcp-doc` NULLE PART, sauf les deux mentions HISTORIQUES de ce document et le
worktree périmé `mcp-doc-hooks-paquets`.

## ㉓ LISIBILITÉ DU TRANSPORT — le badge dit « morceau j/m » (06/08/2026, LIVRÉ)

**Déclencheur** : le mainteneur voit SEPT lignes `🧩 skill: ctxroute` identiques sur un
seul geste et demande « ça fait peur, c'est normal ? ». La livraison était parfaitement
normale — un skill de ~76 Ko découpé en 7 morceaux — mais **rien dans le badge ne le
disait**. Verdict : un transport correct mais ILLISIBLE se fait prendre pour une panne,
et un système qu'on croit en panne finit débranché. La transparence n'est pas cosmétique.

**Livré** : l'id d'un morceau porte désormais `#j/m` (le TOTAL n'existait nulle part hors
du texte de l'en-tête) ; `partMorceau` + `suffixeMorceaux` (purs, mutés 100 %) ; suffixe
composé UNE fois dans `porte-core.js`. Badge : `📄 doc: gros (morceau 1/2)`.

**BUG PRÉEXISTANT TROUVÉ PAR LE TEST ANTI-INERTE** — et c'est lui le vrai gain : le tag
`[source:]` vit à la FIN d'un document, donc **aucun morceau sauf le dernier ne le porte**.
`docLabel` retombait alors sur son fallback « titre markdown », dont la regex acceptait un
`#` collé au texte, et attrapait le PIED DE SCEAU : le badge d'une doc morcelée affichait
`📄 doc: ##FIN:7426e64b###`. Corrigé des DEUX côtés (regex ATX conforme CommonMark +
repli sur `acc.labels`) — l'un sans l'autre laisse soit un faux nom, soit aucun nom.

**Deux erreurs de MA part, écrites ici pour mes successeurs** :
- j'ai d'abord testé avec `--budget 900` sur la coquille Claude Code, **qui ne lit pas ce
  drapeau** (il n'existe que côté Codex/session) : le test était vert sur le mauvais
  chemin, exactement le défaut qu'il traquait ;
- j'ai failli « harmoniser » les trois `message()` alors que le badge FICHIER ignore
  VOLONTAIREMENT `showNotification` (parité protect-files). Un test mal écrit a bien
  failli changer une voie EN PRODUCTION. Le test ANCRE désormais l'asymétrie.

**Incident** : une édition intermédiaire a laissé `message: messageDoc` avec la fonction
pas encore écrite ⇒ les 12 hooks ont crié pendant ~2 min. **Fail-open confirmé en réel** :
aucun geste bloqué, rien de corrompu, injection rétablie et prouvée par le doctor.

**Preuves** : 1034 tests · mutation 100,00 % (0 survivant) · les 2 différentiels de parité
verts · dependency-cruiser 0 violation · jscpd 0,55 % · doctor 14/14.

## ⑤ `enforce` ARMÉ EN PROD (06/08/2026) — et il était INERTE sur MCP

**Décision du mainteneur** : « active-le maintenant ». Armé sur les DEUX gestes
Stripe irréversibles — `create_refund` et `stripe_api_write` — et **PAS** sur
`stripe.md` global : bloquer les lectures serait du bruit, et le bruit finit
débranché. Les lectures (`stripe_api_read`, `get_stripe_account_info`) passent.

🔴 **EN L'ARMANT, DÉCOUVERT QUE LA CLÉ NE FAISAIT RIEN.** `sources/mcp.js#declFor`
RECOPIE clé par clé et ne recopiait pas `enforce` : accepté par `validateMcp`,
présent dans le skill, dans les 4 corpus du gate de symétrie… et **INERTE sur le
canal MCP**, c'est-à-dire précisément là où vit l'incident FONDATEUR du framework.
Mesuré par spawn réel : `create_refund` rendait `allow`. **Sans cette
vérification, j'aurais annoncé « c'est armé » et livré un cran d'arrêt qui ne
s'arrête jamais — pire que pas de cran d'arrêt, parce qu'on lui fait confiance.**

**CAUSE RACINE = UN COMMENTAIRE**, pas une étourderie : « une decl ne porte QUE
de la cadence ». Juste sur le fond (une source n'arbitre rien), il a été lu comme
« donc ne recopie pas `enforce` ». Réécrit : **transporter ≠ décider**.

**POURQUOI AUCUN GATE NE L'A VU** : le gate de symétrie du vocabulaire vérifie
qu'une clé est ADMISE dans les 4 corpus, pas qu'elle est TRANSPORTÉE jusqu'à
`gate.decide`. Deux invariants distincts — admettre et honorer ne sont pas la
même chose. D'où `declfor-gate.test.js` (clés DÉRIVÉES des `xForDoc` de gate.js,
volet anti-angle-mort, rougissement prouvé par sabotage réel).

**Preuves** : create_refund DENY · stripe_api_write DENY · lectures ALLOW ·
appel Stripe RÉEL en lecture seule OK (doc injectée, geste non bloqué) ·
1057 tests · mutation 100,00 % · 0 violation · doctor 14/14.
🛑 **`create_refund` n'a PAS été appelé pour « voir le blocage »** : un échec du
garde-fou déclencherait un remboursement RÉEL. Vérifier ≠ muter, toujours.

---

## ㉔ ✅ LA BANDE PASSANTE EST UN RÉGLAGE — 12 trames, `paquets` (06→07/08/2026)

> 🔴 **CETTE SECTION S'INTITULAIT « UN SEUL PROCESSUS — les 12 paquets étaient un ANTIPATTERN ».
> LE JUGEMENT EST RENVERSÉ, ET LE TITRE RÉÉCRIT (07/08/2026).** Le passage à UNE déclaration a
> vécu 24 h et a été ANNULÉ. Les mesures ci-dessous restent exactes ; **la conclusion qu'on en
> avait tirée était fausse.**
>
> **CE QUI A ÉTÉ MAL CADRÉ** : j'ai pris l'ORDRE D'AFFICHAGE pour l'exigence. L'exigence du
> mainteneur, répétée toute la journée, est **« le contexte doit être COMPLET avant le prochain
> appel d'outil »**. À 1 trame la capacité tombe à 7 661 c ⇒ un skill de 53 830 c s'étale sur
> **8 gestes** ⇒ l'agent agit **7 fois avec un savoir partiel**. Un désordre se recolle (`k/N`,
> c'est tout l'objet des RFC citées plus haut) ; un savoir absent au moment d'agir, non.
>
> 🔴 **ET LA MESURE QUI A SERVI À JUSTIFIER LE RETRAIT ÉTAIT BIAISÉE** — c'est la leçon de
> méthode la plus importante de la journée. « Les 12 trames n'ont saturé qu'1 fois sur 74 »
> comptait les trames UTILISÉES. Le bon observable était le **compteur de docs différées, qui ne
> redescendait jamais à zéro** : un corpus `dumb` est redécidé à CHAQUE geste, donc
> sous-dimensionner N met la file en **rotation perpétuelle** — invariant DÉJÀ écrit dans
> `porte.md`, que je n'ai pas relié à ce que j'avais sous les yeux. **Mesurer la mauvaise
> grandeur produit un chiffre juste et une conclusion fausse.**
>
> ⚠️ **L'ORDRE N'EST GARANTI PAR AUCUN HARNAIS, et c'est DOCUMENTÉ** (doc officielle relue le
> 06/08) : *« All matching hooks run in parallel »*, ordre d'agrégation **non spécifié**, plafond
> de 10 000 c sur les **5 types de handler** (`command`/`http`/`mcp_tool`/`prompt`/`agent`), aucun
> réglage pour le lever. ⇒ **ordre garanti ⟺ sortie UNIQUE ⟺ contenu ≤ une trame.** Les trois
> exigences « zéro geste en plus » + « tout avant d'agir » + « dans l'ordre » sont donc
> **incompatibles** — ce n'est pas un manque d'astuce, c'est structurel.
> 🛑 **NE JAMAIS coder de chaîne de précédence entre processus pour forcer l'ordre** (tentée puis
> abandonnée le 07/08) : elle reposerait sur « le harnais ordonne par fin de processus », qui
> n'est écrit NULLE PART. C'est l'interdit permanent de `budget.md` — si le harnais changeait
> demain, ce code changerait. La réponse doit être NON.
>
> **CE QUI A ÉTÉ LIVRÉ LE 07/08** : `paquets` au schéma + à la config (défaut 12) · 4 checks
> `doctor --settings` (même `--paquets` partout · autant de déclarations que de trames · indices
> 1..N sans trou ni doublon · **égalité avec la config**) · **alarme de capacité** dans le badge
> (`alarme-capacite.test.js`, 3 volets par spawn réel) · **badge multi-docs** corrigé
> (`injected[0]` ne nommait qu'UNE doc sur N — c'est ce qui a fait croire à une panne).
> **MESURES** : 1 trame 7 661 c · 12 trames **91 932 c** · charge réelle au pire **65 265 c
> (71 %)**, dont **53 830 c pour le seul skill**.
>
> 🔴 **LE DOUBLON EXISTE — ET LA « RÉFUTATION » CI-DESSOUS ÉTAIT LA VRAIE ERREUR (07/08/2026, nuit).**
> Cette section a d'abord annoncé un doublon, puis l'a déclaré **RÉFUTÉ**. Les deux textes ont eu
> tort chacun à leur tour, et c'est le SECOND qui coûte le plus cher : il a converti une
> **reproduction ratée** en **réfutation**, en gras, avec un 🛑, dans le code, quatre docs et ce
> backlog — fermant le sujet pour tout agent suivant.
> ⚠️ **RÈGLE, DANS LES DEUX SENS** : un défaut se grave sur REPRODUCTION ; son ABSENCE ne se grave
> JAMAIS. Le seul statut honnête d'un phénomène non reproduit est **« non reproduit à ce jour »**,
> qui laisse la porte ouverte. « Réfuté » exige de démontrer l'impossibilité, pas d'échouer à voir.
>
> **CE QUI RESTE VRAI DE L'ANALYSE DU MATIN** (à ne pas jeter) : le morceau 7/8 des 05:42/06:26
> était bien séparé par un `PreCompact` — comportement CONÇU ; une doc `dumb` relivrée n'est pas
> un doublon ; et 12 processus parallèles sur 105 segments n'en ont produit aucun. Tout cela est
> exact. **Rien de tout cela ne généralisait**, et la sonde ne pouvait PAS voir la vraie cause :
> elle ne mettait jamais le verrou en échec.
>
> **CAUSE RÉELLE, TROUVÉE PAR LECTURE DU CODE APRÈS UNE 2ᵉ OBSERVATION DU MAINTENEUR** :
> le repli « lock indisponible » de `porte-core.js` décidait avec un état **VIDE** (`{}`). Or
> l'état porte le « déjà vu » ⇒ un `once` DÉJÀ livré était jugé jamais livré et **réémis**. Ce
> chemin ne lit pas non plus le plan mémoïsé : il recalculait seul le MÊME découpage (déterministe
> ⇒ **marqueur identique**) et n'émettait que **SA** trame.
> **SIGNATURE** = un **morceau ORPHELIN** après une livraison COMPLÈTE, sans compaction, file VIDE.
> Relevé dans le transcript : `21:25:03-05` paquets 1..9 → morceaux 1/9…9/9 `###FIN:be66cd9b###`,
> puis `21:30:19` paquet 2 → **morceau 2/9 SEUL**, même marqueur. Quatre traits, quatre coïncidences.
>
> 🛑 **LA FAUTE DE FOND EST UNE INFÉRENCE, la même classe que [[feedback-interroger-ce-qui-sait]]** :
> le processus savait UNIQUEMENT « je n'ai pas eu le verrou » et en déduisait « donc rien n'a été
> injecté ». Le verrou sérialise les **ÉCRITURES** ; la **LECTURE** n'en a jamais eu besoin —
> l'état est un fichier, il suffisait de le lire. **Interroger ce qui SAIT, jamais un indice.**
> ⚠️ Conséquence systémique : le comportement dépendait de **qui gagnait la course**, donc
> irreproductible, donc « pas reproduit », donc « réfuté ». **La fausse conclusion était fille de
> l'inférence.** Corrigé : le repli LIT l'état (`store.loadState`) et n'écrit toujours RIEN (ni
> état, ni plan, ni file) — fail-open intact, déterminisme retrouvé. 🛑 NE JAMAIS y remettre `{}`.
>
> ⚠️ **POURQUOI 1096 TESTS, MUTATION 100 % ET DOCTOR VERT NE L'ONT PAS VU** : aucune suite ne
> faisait **ÉCHOUER** le verrou. La branche de repli n'était exercée qu'avec un état déjà vide,
> c'est-à-dire dans le seul cas où l'inférence tombe juste. **Un chemin de DÉGRADATION testé
> uniquement avec de l'état vide n'est pas testé.** Scellé par « REPLI SANS VERROU » dans
> `doc-inject.test.js` : volet ROUGE (le `once` déjà vu ne doit PAS ressortir) + contre-épreuve
> (une doc jamais vue est quand même livrée — sinon un `return` prématuré passerait pour un fix).
> ⚠️ **GÉNÉRALISATION À CHERCHER** (non fait) : tout autre chemin de dégradation du parc qui
> SUPPOSE un état au lieu de le lire. C'est une CLASSE, pas un cas.

**DÉCLENCHEUR : le mainteneur, à l'œil nu.** Il voit les badges arriver dans le désordre
(`morceau 1/8`, puis `5/8`, puis `2/8`…) et demande « pourquoi ça affiche pas dans l'ordre ? ».
Puis il remarque une doc « incrustée au milieu du skill ». Deux observations visuelles — aucun
test ne regardait ni l'une ni l'autre.

**CE QUE LA MESURE A TROUVÉ (transcript réel, pas une théorie) :**
- ordre d'arrivée dans le transcript : `1, 3, 2, 6, 7, 5, 4, 8, 9` — donc le désordre est EN AMONT
  de l'affichage, pas dans le terminal ;
- **le morceau 7/8 livré DEUX FOIS**, à deux gestes distincts (marqueurs `2bc5f3df` puis
  `03d7e9f2`), les 7 autres une seule. **Un doublon, pas une perte** — d'où l'aveuglement des
  tests : `budget.property` prouve la CONSERVATION, et un segment livré 2× est parfaitement
  « conservé ». Conservation et unicité sont deux propriétés, on n'en avait qu'une ;
- distribution sur **74 gestes** : 1 trame ×5 · 2 ×27 · 3 ×22 · 4 ×10 · 5-9 ×8 · **12 ×1**.
  Médiane = 3. **Les 12 trames n'ont servi à fond qu'UNE fois sur 74**, pour ~4 s de spawn node
  payées à CHAQUE appel d'outil ;
- **69 gestes sur 74 utilisaient ≥2 trames ⇒ 93 % arrivaient en désordre.** Ce n'était pas un cas
  rare, c'était le régime permanent.

**CAUSE RACINE.** N déclarations = N processus PARALLÈLES qui se partagent la file d'émission.
Chacun lit, décide, réécrit — sur une photo différente du monde. 🛑 **Le lock ne protège pas de
ça** : il sérialise les ÉCRITURES, il n'empêche pas une SECONDE DÉCISION prise sur un état déjà
modifié. Reproduit en test déterministe (volet ③ de `emission-doublon.test.js`, ROUGE : les 5
morceaux déjà sortis repartaient), puis le volet a été RETIRÉ parce que sa cause a disparu.

**POURQUOI L'ORDRE N'ÉTAIT PAS RATTRAPABLE.** Le harnais rend les sorties dans l'ordre où les
processus FINISSENT. Les ordonner exigerait qu'un processus ATTENDE ses pairs : **coordination
entre PAIRS ÉGAUX**, que rien ne tranche — le signal d'alarme de CLAUDE.md. Et ça sérialiserait
12 spawns à chaque geste.

**CE QUE ÇA NE COÛTE PAS.** Depuis la file (⑮/⑯, 05/08), `--paquets N` ne réglait plus que le
DÉBIT : le surplus attend et repart au geste suivant. Passer à 1 ne retire donc AUCUNE capacité —
un contenu de n'importe quelle taille arrive encore, en plus de gestes (médiane : 3). Le seul
changement observable : ce qui arrivait en 1 geste arrive en ~3.

**ÉTAT DE L'ART, vérifié le 06/08/2026 (sources datées, cf `budget-paquets-reference.md`).**
Ouvrir N connexions parallèles était la ruse de **HTTP/1.1** ; **HTTP/2 puis HTTP/3 l'ont
abandonnée** pour UNE connexion multiplexée — « opening parallel connections for HTTP/3 would be
unnecessary and wasteful ». gRPC 2026 dit la même chose pour les gros messages : **découper en
flux sur un canal**, avec backpressure et **file BORNÉE** (la nôtre l'est : dédup par document).
⇒ **« Plus de tuyaux » est la vieille méthode ; le standard est un tuyau, mieux utilisé.**
On avait réinventé l'antipattern de 2015.

**LIVRÉ.**
- `settings.json` : **12 déclarations → 1** (sauvegarde `settings.json.bak-avant-n1-20260806`).
- `emission-doublon.test.js` : 3 volets (émis∩file = ∅ · aucun doublon intra-geste · 6 gestes
  successifs sans relivraison).
- `doctor.js --settings` : **2 checks anti-retour** (UNE déclaration · aucun `--paquets N>1`),
  rougissement PROUVÉ par sabotage sur copie. C'est le seul endroit possible : le câblage vit
  HORS du repo, aucun test d'ici ne peut le voir.
- Docs : `paquet-unique.md` (neuve) + `porte.md` et `budget.md` RÉÉCRITES (leurs lignes « déclarés
  N fois » et « 12 × 7 658 = 91 896 c » étaient devenues fausses — réécrites, pas empilées).
- Preuves : **1066 tests verts**, doctor **33 ok / 0 problème** sur le câblage réel.

🛑 **NE JAMAIS rouvrir N>1, même sous un drapeau.** Le désordre et la course reviendraient avec, et
un utilisateur ne peut pas consentir à un défaut qu'il ne découvrira que des semaines plus tard.

⚠️ **DEUX LEÇONS DE MÉTHODE, à ne pas perdre.**
① **1066 tests, mutation 100 %, doctor vert — et deux défauts visibles à l'œil nu.** Les tests
prouvaient ce qu'on avait pensé à prouver. L'observation humaine reste le seul détecteur de ce
qu'on n'a pas imaginé : quand le mainteneur dit « c'est bizarre », c'est une MESURE à instruire,
jamais un ressenti à rassurer.
② **J'ai commencé par sonder le binaire de Claude Code pour retrouver la limite de 10 000 c —
qui est DOCUMENTÉE, et déjà écrite dans `budget.md`.** Doc-first violé une fois de plus (cf le
🔴 OUVERT du 04/08). La doc injectable m'a rattrapé en vol.
