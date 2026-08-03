# mcp-doc-hooks — doc injectable par serveur MCP

## ⚠️ PROD VIVANTE — NE RIEN CASSER (règle n°1, avant toute autre)
⚠️ **PROJET PUBLIC (open source)** : traiter le repo comme DÉJÀ public, même avant publication. ZÉRO info perso dans les fichiers trackés — jamais de prénom (dire « le mainteneur »), jamais de chemin utilisateur réel (fixtures = `C:/Users/dev/...`), jamais d'IP réelle (utiliser la plage de documentation 203.0.113.x), jamais d'email/secret/nom de client. Les docs perso (`docs/mcp/*.md`, `docs/session/*.md`) restent GITIGNORÉES — seuls les `.md.example` génériques se poussent. Avant publication effective : squasher l'historique (les vieux commits contiennent du perso) ET remplacer `mcp-doc-config.json` par un `.example` générique (la config livrée contient les NOMS des skills/projets du mainteneur — données perso ; l'utilisateur crée la sienne, les gates la valident).
⚠️ **`~/.claude/hooks/protect-files.js`, `statusline.js` et les hooks câblés dans `settings.json` sont EN PRODUCTION EN PERMANENCE** : d'AUTRES agents (Claude Code, Codex) tournent en parallèle de toi et s'en servent à chaque appel d'outil. Les modifier casse LEUR travail en cours et brûle les tokens du mainteneur — argent réel.
⚠️ **Ce framework est du DÉVELOPPEMENT PUR pour l'instant.** Interdit : toucher un fichier vivant de `~/.claude/hooks/`, débrancher l'injection de doc existante, éditer `settings.json`, `protected-paths.json`. Le refactor est en phase EXPAND : on AJOUTE dans `Desktop/mcp-doc-hooks/`, rien n'est câblé, l'ancien tourne intact.
⚠️ **La bascule (étape 2) et le retrait (étape 3) exigent un GO EXPLICITE du mainteneur, à un moment où aucun agent ne tourne.** Ne jamais les enchaîner « puisque le différentiel est vert » — vert prouve l'équivalence du match, pas que le moment est bon.
⚠️ **Zéro `taskkill`/`Stop-Process` à filet large sur `node.exe`** : les serveurs MCP et les agents des autres sessions tournent sous node. Ne viser QUE des process dont le parent est mort (orphelins), jamais « tous les node récents » (erreur commise le 15/07/2026).

## MODÈLE MENTAL (le POURQUOI — source unique, ex-PHILOSOPHY.md intégré 18/07/2026)
1. **Ce que c'est** : un **langage déclaratif (DSL) pour programmer des workflows d'injection de contexte TRAÇABLES**. Pas un moteur de plus : un langage. Tu DÉCRIS quand un savoir doit apparaître ; la machine l'injecte, prévisible et explicable.
2. **Primitive unique** : événement DÉCIDABLE → injection. Déclinée en sources (fichier, MCP, session, skill), même moteur (matcher + gate + cadence). Étendre = 1 source pure + 1 adaptateur, le noyau ne bouge JAMAIS.
2bis. **AMBITION = STANDARD INDUSTRIEL MULTI-HARNAIS** (décision mainteneur 19/07/2026) : ce framework vise à devenir LE standard d'injection de contexte, agnostique du harnais — comme un langage. Architecture imposée par cette ambition : moteur pur sans AUCUN dialecte (gate CI) + cœurs partagés (porte-core/guard-core) + coquilles minces par harnais (~15 l. d'emit). Nouvel harnais = mesurer son dialecte (doc-first + payload RÉEL capturé, jamais sur parole) → réutiliser les portes telles quelles si identique, sinon coquille — JAMAIS une copie, JAMAIS un if-harnais dans le noyau. Prouvé sur Codex : 3 portes réutilisées à l'octet, 2 coquilles, 0 clone jscpd.
3. **Le matching = une BASE BOOLÉENNE COMPLÈTE (conçue à l'instinct par le mainteneur, prouvée le 18/07/2026)** : `match` = OU (au moins un pattern présent → déclenche) · `scope` = ET (contexte requis présent) · `exclude` = NON (interdit absent). OU+ET+NON = complétude fonctionnelle — N'IMPORTE QUELLE condition de déclenchement est exprimable avec ces 3 opérateurs, comme tout se calcule en binaire. C'est POUR ÇA qu'on n'ajoute JAMAIS d'opérateur de matching : la base est fermée, un 4ᵉ mot serait forcément un synonyme (cf loi anti-synonyme §8, précédent `perimeter`). Chaque opérateur est né d'une douleur réelle : faux positifs→exclude, cloisonnement projet→scope, déclenchement→match.
3bis. **Mur porteur : décidable, JAMAIS heuristique.** On n'injecte que sur des FAITS (outil appelé, fichier touché, périmètre franchi) — jamais deviner l'intention (zéro embedding). « Le binaire suffit » : l'action est un proxy parfait et décidable de l'intention. La contrainte EST la feature (on peut toujours répondre « pourquoi ça s'est injecté ? »).
4. **Pas Turing-complet, VOLONTAIREMENT** : parallèle = SQL/CSS/table de routage, jamais bash. Complet DANS son domaine (toute injection décidable est exprimable — ne JAMAIS livrer un grain de moins), borné (tout reste explicable). Le mur infranchissable = calcul arbitraire/heuristique.
5. **Cadence = UN axe** « réinjecte après N ticks » : dumb=0, smart=N, once=∞ (compaction = seul vrai vidage ; entre deux = DILUTION). `driftUnit` (tool|turn) = l'unité du tick, dégénérée hors de smart. Garde-fou→dumb, savoir de projet→once, smart = milieu à utiliser peu.
5bis. **DOCTRINE AGENT = CONTEXTE (19/07/2026)** : agent maître et CHAQUE sous-agent = agents TOTALEMENT distincts, contextes distincts ⇒ état d'injection (once/smart/turn) DISTINCT par agent. Clé de store = `lib.scopeId(session_id, agent_id)` (source unique ; `agent_id` = champ harnais présent seulement DANS un sous-agent — `session_id`/`transcript_path` sont PARTAGÉS, jamais discriminants). Sans agent_id = clé historique (rétro-compat + Codex, dont le payload n'a pas d'agent_id documenté). Trou fondateur prouvé 19/07 : keyé session seule, les sous-agents ne recevaient JAMAIS les skills (`once` consommé par le maître) — seuls les `dumb` (sans état) passaient, par accident.
6. **Config = ownership** : frontmatter UNIQUEMENT dans ce qu'on maîtrise à 100% (nos docs) ; fichier du HARNAIS (skill, serveur) → registre dans NOTRE JSON. Condition du cross-harnais.
7. **Les 3 AUTORITÉS (partout, sans exception : mode/threshold/driftUnit)** : ① défaut FRAMEWORK codé en dur (existe même sans JSON) > ② config GLOBALE (JSON) > ③ ENTRÉE (frontmatter doc / entrée skill) = dernier mot. Fallback TOTAL à chaque étage. Granularité complète, zéro trou.
8. **Croissance = enrichir le VOCABULAIRE** (primitives composables), jamais du calcul arbitraire.
   ⚠️ **UN CONCEPT = UN MOT, PARTOUT (loi anti-synonyme)** : avant d'ajouter une clé, vérifier si une primitive existante couvre déjà la sémantique — si la nouvelle clé alimente le MÊME chemin de code qu'une clé existante, c'est LA MÊME clé (la réutiliser, jamais la renommer par contexte). Un mot nouveau exige une SÉMANTIQUE nouvelle. Précédent réel : `perimeter` inventé comme synonyme de `match` pour les skills (18/07/2026) → supprimé. Docs, skills, futures sources : le MÊME vocabulaire (`match`/`mcp`/`rules`/`tool`/`scope`/`exclude`/`mode`/`threshold`/`driftUnit`), sans exception. Les 4 DÉCLENCHEURS, sémantiques DISJOINTES jamais fusionnées : `match` = substring CHEMIN · `mcp` = nom exact SERVEUR · `rules` = match par-entrée · `tool` (19/07/2026) = nom EXACT d'un OUTIL NATIF (WebFetch, WebSearch… — l'angle mort des outils sans chemin ni mcp__, comblé ; couvre d'office tout futur outil du harnais : le nommer dans une doc suffit, zéro code).
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
3. **Cascade 3 autorités** sur tout réglage (framework en dur > JSON global > entrée), fallback total à chaque étage — jamais un réglage à 1 ou 2 étages.
4. **Injection MÉCANIQUE du savoir lui-même** (corps lu en direct depuis sa source unique), jamais un pointeur qui espère que l'agent obéisse.
5. **Schéma D'ABORD** (config-gate hurle sinon), puis source PURE + adaptateur (le noyau ne bouge pas), miroirs (mutate/include/mutation.yml/dep-cruiser), re-mutation 100%, doctor probe + negative-check, doc injectable + skill (arbo).
6. **Comportement par défaut = comportement d'AVANT, à l'identique** (parité — les différentiels doivent rester verts sans modification).
7. **UNIVERSALITÉ DES SIGNAUX** : ne fonder le matching QUE sur ce que TOUT harnais expose PAR NÉCESSITÉ (les paramètres d'outils : chemins, commandes, noms d'outils MCP — un agent DOIT les fournir pour agir). JAMAIS sur une métadonnée optionnelle d'un harnais (`cwd`, transcript_path, permission_mode…) : un signal optionnel = un périmètre qui meurt en silence sur le harnais qui ne l'envoie pas. Précédent réel : fix `cwd` tenté puis REJETÉ le 18/07/2026 — le besoin (chemins relatifs) se couvrait en pures DONNÉES (noms de fichiers distinctifs dans le `match`). Réflexe : un trou de matching se règle d'abord en DONNÉES (enrichir le match), le moteur en DERNIER recours.
8. **TEST DU KNOB (quand créer un réglage ?)** : « les données (patterns/scope/exclude) peuvent-elles DÉJÀ exprimer la distinction ? » OUI → rien à ajouter (précédent : cwd = une chaîne de plus dans l'axe « où », distinction fichiers/territoire déjà exprimable par le choix des patterns). NON → un mot de vocabulaire, cascade 3 autorités (précédent : driftUnit — tool vs turn écrasés dans UN compteur, indistinguables par les données). SOLUTION PRÉ-IDENTIFIÉE si un cas réel prouve un jour que les canaux de match (chemins explicites vs cwd) doivent se distinguer : un mot booléen PAR ENTRÉE (ex. matchCwd), même cascade — mesurer le cas réel D'ABORD, jamais préventivement.

## Philosophie
Chaque MCP (Stripe, Odoo, SSH, Infra...) est une frontière à risque au même titre qu'un fichier critique. Le système `.claude/hooks/docs/*.md` documente déjà les fichiers ; `mcp-doc-hooks` fait pareil pour les serveurs MCP — un invariant/piège livré à l'agent AU moment où il touche le MCP, pas une consigne en prose qu'on espère qu'il se rappelle. Né de l'incident du 15/07/2026 (clic accidentel sur un bouton de paiement Stripe réel — cf `project_mcp_hook_docs_standard` en mémoire).

## Emplacement — dossier autonome, pas dans .claude/hooks
⚠️ Le code vit dans `~/Desktop/mcp-doc-hooks/` (repo git séparé, poussable sur GitHub sans mélanger le reste du home directory). `settings.json` référence ce dossier par chemin absolu — Claude Code ne se soucie pas de l'emplacement, seuls les chemins internes du framework (relatifs entre eux) doivent rester groupés.

## Arborescence — ON-DEMAND : `Desktop/mcp-doc-hooks/ARBORESCENCE.md`
⚠️ **1 ligne par fichier, filet d'EXHAUSTIVITÉ** (un fichier hors liste = trou, jamais un jugement d'importance). Sortie du skill le 31/07/2026 : elle pesait 24 625 caractères, soit 48 % du skill, et poussait l'ensemble bien au-delà du budget d'émission — le skill entier était donc ÉVINCÉ de la trame, c'est-à-dire ABSENT de ton contexte. **La LIRE dès que tu touches à la structure du repo** (ajout/suppression/renommage de fichier), et la METTRE À JOUR dans le même geste. Scellée par le volet ② de `couverture-gate.test.js`, qui lit ce fichier ET ce skill. ⚠️ Ne JAMAIS la réintégrer ici.

## Porter le framework sur un NOUVEAU HARNAIS (Codex, Gemini CLI, autre) — contrat STRICT
Le MOTEUR est portable PAR CONSTRUCTION (gate `sources-must-not-know-the-harness` : CI rouge si une source importe un dialecte). Porter = écrire des COQUILLES, jamais toucher le moteur.
1. **INTERDIT ABSOLU** : modifier `sources/`, `gate.js`, `frontmatter.js`, `loader.js`, `lib-pure.js`, `collisions.js` pour un portage. Si tu crois devoir le faire, tu te trompes de couche — STOP.
2. **À écrire, par événement du harnais cible — JAMAIS de copie (prouvé sur Codex 19/07/2026)** : le corps des portes vit dans des CŒURS PARTAGÉS (`porte-core.js` = PreToolUse, `guard-core.js` = PostToolUse) — une coquille = stdin + `emit` du dialecte (~15-50 l.). D'abord VÉRIFIER si la porte existante se câble TELLE QUELLE (dialecte identique — Codex : reset/turn-count/session-inject réutilisés à l'octet) ; sinon coquille `<harnais>-*.js` qui require le cœur. Seule différence permise : le FORMAT stdin/stdout du harnais cible. Capacité absente (ex. « ask » Codex) = DÉGRADATION EXPLICITE commentée dans l'emit, jamais silencieuse. Événement absent = voie sautée, notée dans REFACTOR-PLAN, jamais bricolée.
3. **Toute coquille** : arme `deadline.arm()` avant toute I/O, fail-open intégral (erreur = exit 0 muet), chemins via `paths.js` uniquement, décision via les modules purs uniquement.
4. **Preuves OBLIGATOIRES avant de câbler** (pas d'exception) : suite d'intégration par spawn réel sur corpus tmpdir (modèles : `doc-inject.test.js`, `session-inject.test.js`, `doc-write-guard.test.js`) + extension du doctor (probe de chaque nouvelle porte + check câblage + negative-check dans `doctor.test.js` qui SABOTE une copie et exige le hurlement).
5. Un harnais SANS un événement (ex. pas de SessionStart) = on saute CETTE voie, on le note dans REFACTOR-PLAN — jamais de contournement bricolé.
6. Fini = `npm test` vert + mutation verte + doctor vert sur le câblage réel + REFACTOR-PLAN/skill mis à jour. Un portage sans ces 4 preuves N'EST PAS fini.

## Ajouter un MCP au standard
1. Créer `Desktop/mcp-doc-hooks/docs/mcp/{server}.md`. ⚠️ **Le framework n'impose NI taille NI format** : il DOIT livrer une doc de n'importe quelle taille — si elle ne passe pas, le défaut est dans le TRANSPORT, jamais dans la doc. « <10 lignes, 1 ligne = 1 invariant/piège, ton impératif » est la convention D'USAGE de ce parc (anti-dilution) — la suivre ici, ne JAMAIS la présenter comme une règle du moteur ni la faire appliquer par un gate du framework.
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

## Configurer `mcp-doc-config.json`
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
- **`showNotification`** (défaut `true`) : contrôle UNIQUEMENT le badge visible `📄 [mcp-doc-hooks] ...` — `false` masque le badge mais l'injection réelle dans le contexte de l'agent continue normalement. Sert à l'utilisateur qui veut le bénéfice sans le bruit visuel.
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
**Hook UNIQUE `doc-inject.js` (matcher `*`) LIVE en prod** : sources/file.js (frontmatters) + sources/mcp.js (docs/mcp/) → gate.js (dédup par DOC, threshold par doc). `mcp-doc-inject.js` RETIRÉ du câblage (gardé comme oracle du différentiel + rollback — le doctor exige son ABSENCE, sinon double injection). Deny/ask sécurité RETIRÉS (décision mainteneur 17/07, réintroduction possible en hook séparé). Preuves : suite vitest complète (le runner est la seule source du compte), mutation 100% (0 survivant), mcp-differential 9/9, porte-differential octet, doctor vert sur câblage réel.
✅ **DOUBLE ÉCRITURE MORTE (27/07/2026)** — ⚠️ **RAISON EXACTE, à ne pas déformer : `protected-paths.json` était la vérité de l'ANCIEN moteur (`protect-files.js`), remplacé par la porte unique le 17/07. Le JSON ne servait plus qu'à un rollback vers un moteur mort.** Ce n'est PAS un retrait de Codex : **le framework reste pleinement compatible Codex**, ses coquilles (`codex-doc-inject`, `codex-doc-write-guard`) tournent déjà sur le NOUVEAU moteur, donc sur les frontmatters. Rien n'est fermé de ce côté et le portage multi-harnais reste l'ambition (§2bis).
Concrètement : les frontmatters sont la SEULE source de règles, **`lint-corpus` COMPRIS** (il lisait encore le JSON — le laisser aurait ressuscité la double écriture par la bande, un gate en réclamant une entrée à chaque nouvelle doc). `source-drift-gate` et `loader-differential` SUPPRIMÉS : ils n'existaient que pour exiger la parité entre 2 sources dont une est morte. `protected-paths.json` = artefact INERTE, plus aucun lecteur — **NE PLUS JAMAIS y écrire ni le maintenir**. La classe « règle fantôme » est **ÉTEINTE PAR CONSTRUCTION** (un déclencheur vit DANS sa doc : supprimer la doc supprime la règle) — `lint-corpus.test.js` cas 5 le prouve et rougira si une source de règles EXTERNE est réintroduite.
Plan/historique : `Desktop/mcp-doc-hooks/REFACTOR-PLAN.md`. Doctrine du patrimoine (CLAUDE.md) : plus AUCUN chantier ouvert — scaler = déposer des `.md`, le moteur ne bouge plus.

## Pour aller plus loin
Étendre à SSH, Infra, autres MCP agence au fil des pièges découverts — même réflexe "par défaut : documenter" que la doc fichier (cf règle Documentation du CLAUDE.md global).
