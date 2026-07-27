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

## Arborescence (EXHAUSTIVE — tout fichier hors de cette liste = trou de doc à combler)
**Code** :
- `Desktop/mcp-doc-hooks/mcp-doc-inject.js` — RELIQUE (retiré du câblage 17/07/2026, la porte couvre le MCP) : gardé comme oracle du différentiel mcp + rollback. Le doctor exige son ABSENCE du câblage.
- `Desktop/mcp-doc-hooks/mcp-doc-reset.js` — hook PreCompact. Vide les 3 stores de session à chaque compaction (doc-seen, mcp-doc-seen legacy, turn-count — reset absolu, tous modes).
- `Desktop/mcp-doc-hooks/turn-count.js` — porte TOUR (UserPromptSubmit, câblée 18/07/2026) : incrémente le compteur de tours de la session (store 'turn-count-'). MUETTE par contrat (stdout UserPromptSubmit = contexte injecté). Capteur du `driftUnit: turn`.
- `Desktop/mcp-doc-hooks/lib-pure.js` — TOUTE la logique décisionnelle, zéro I/O (fs/path/process interdits). Mutée par Stryker.
- `Desktop/mcp-doc-hooks/lock.js` — lock cross-process (`fs.mkdirSync` atomique) protégeant les accès concurrents à `state/`. Timeout 2 s fail-open (prod, intouchable) ; env `MCP_DOC_LOCK_TIMEOUT_MS` réservée aux tests de concurrence (prouver l'atomicité hors charge).
- `Desktop/mcp-doc-hooks/stdin-json.js` — lecture stdin→JSON partagée par les 2 hooks (extrait après détection de duplication par jscpd).
- `Desktop/mcp-doc-hooks/paths.js` — SOURCE UNIQUE des chemins (config/docs/state) + 3 env vars d'isolation réservées aux tests/doctor. Aucun `path.join(__dirname,...)` ad-hoc ailleurs.
- `Desktop/mcp-doc-hooks/doctor.js` — dead-man switch : 7 sondes bout-en-bout (5 portes + garde d'écriture + reset), chacune prouvée par EFFET RÉEL (injection dans le contexte, store incrémenté, stores effacés — jamais juste exit 0, trou fermé 19/07) + câblage `settings.json` fichier par fichier. Câblé en SessionStart (`--quiet`), hurle si mort.
- `Desktop/mcp-doc-hooks/deadline.js` — ÉCHÉANCE de process (anti-zombie). Autonome, dépend de rien. Tout hook lisant stdin DOIT l'armer avant toute I/O. Né des 875 zombies du 15/07/2026 (bug Claude Code #68626).
- `Desktop/mcp-doc-hooks/sources/file.js` — SOURCE « fichier » : payload → quels docs (frontmatters). PUR, réplique exacte de l'injection de protect-files.js. Consommée par la porte unique.
- `Desktop/mcp-doc-hooks/sources/tool.js` — SOURCE « tool » (19/07/2026) : docs à clé `tool:` → match EXACT (===) sur le NOM d'un outil natif (WebFetch/WebSearch — angle mort chemin/mcp__ comblé). scope/exclude via file.shouldSkip (source unique). PURE, mutée 100%. ⚠️ son adaptateur RÉUTILISE le corpus posé par fileAdapter (ordre file→tool = dépendance scellée par test).
- `Desktop/mcp-doc-hooks/sources/mcp.js` — SOURCE « MCP » (fusion 17/07/2026) : payload → docs 'mcp/…' (3 niveaux, filtres, subToolParam via lib-pure) + declFor (cadence : frontmatter de LA doc > global — JSON = global only depuis 17/07/2026). PUR, muté 100%.
- `Desktop/mcp-doc-hooks/source-adapters.js` — REGISTRE des sources (point d'extension, 17/07/2026) : contrat d'adaptateur {id, collect, message} documenté en tête, ordre du tableau = ordre de concaténation. Nouvelle source = 1 module pur + 1 adaptateur ICI — doc-inject.js/gate.js ne se touchent JAMAIS.
- `Desktop/mcp-doc-hooks/frontmatter.js` — parser PUR du frontmatter des docs (refactor en cours). Total : ne throw jamais. Déclencheurs : `match:` (fichier), `mcp:` (serveur), `rules:` (JSON par-entrée {pattern, scope?, exclude?} — pour les 31 docs à scopes divergents, mesuré 16/07).
- `Desktop/mcp-doc-hooks/migrate.js` — NOYAU PUR de la migration (plan : quelles docs, quel frontmatter). Muté par Stryker (100%). ⚠️ MIGRATION FAITE le 16/07/2026 : 302 docs réelles portent leur frontmatter (dumb+confirm+rank) ; rejouable, converge à 0 action.
- `Desktop/mcp-doc-hooks/migrate-to-frontmatter.js` — coquille I/O de la migration. Dry-run par défaut, idempotent, `rank` dérivé de l'index JSON. ⚠️ ZÉRO logique ici : tout vit dans `migrate.js`.
- `Desktop/mcp-doc-hooks/loader.js` — PUR : corpus de docs (frontmatters) → règles plates ordonnées pour `sources/file.js`. Tri PAR RÈGLE (rank par entrée = docs entrelacées). Muté 100%.
- `Desktop/mcp-doc-hooks/shadow-inject.js` — hook SHADOW (RELIQUE — décâblé 17/07/2026, ne PAS recâbler) : calcule ce que le nouveau moteur injecterait, le JOURNALISE (`state/shadow-*.jsonl`), n'émet JAMAIS rien (fail-open intégral).
- `Desktop/mcp-doc-hooks/shadow-reconcile.js` — dépouillement OFFLINE du journal shadow : rejoue l'oracle, exit 1 divergence / exit 2 journal vide. LE verdict de bascule.
- `Desktop/mcp-doc-hooks/oracle.js` — SEULE lecture de la sortie de protect-files.js (spawn + parse JSON) — partagé par file-differential et shadow-reconcile.
- `Desktop/mcp-doc-hooks/gate.js` — PUR : LA décision de la porte unifiée (par DOC : dumb/once/smart, compteurs étrangers, ask via confirmFor, docLabel). Muté 100%.
- `Desktop/mcp-doc-hooks/doc-inject.js` — PORTE UNIFIÉE (✅ CÂBLÉE, LIVE 17/07/2026, hook unique PreToolUse `*`) : coquille Claude Code = stdin + emit (allow/ask) ; corps commun dans porte-core.js. Ne lit JAMAIS `.rush` (rush = `confirm: false` config).
- `Desktop/mcp-doc-hooks/porte-core.js` — CŒUR DE PORTE PreToolUse (19/07/2026, source unique multi-harnais) : collecte registre → gate → format, run(data, emit). Toute évolution d'orchestration ICI, jamais dans une coquille.
- `Desktop/mcp-doc-hooks/codex-doc-inject.js` — coquille CODEX PreToolUse (19/07/2026) : porte-core + emit Codex (SANS permissionDecision, ask DÉGRADÉ en contexte préfixé — « ask » Codex parsed-not-supported).
- `Desktop/mcp-doc-hooks/codex-doc-inject.test.js` — suite spawn de la coquille Codex (dialecte seul : dégradation ask, clé sans agent_id, fail-open).
- `Desktop/mcp-doc-hooks/corpus.js` — I/O partagée shadow+porte : lecture récursive des .md du parc (ids identiques aux `doc` du JSON).
- `Desktop/mcp-doc-hooks/session-store.js` — I/O partagée des states par session (préfixes distincts : `mcp-doc-seen-` serveurs / `doc-seen-` docs). Extrait par gate jscpd.
- `Desktop/mcp-doc-hooks/session-inject.js` — PORTE SESSION (SessionStart, câblée 17/07/2026) : injecte TOUT `docs/session/*.md` à chaque début de session ET après chaque compaction (le « CLAUDE.md géré par le framework »). Zéro état, zéro dédup, fail-open.
- `Desktop/mcp-doc-hooks/sources/session.js` — SOURCE « session » : corpus docs/session → docs ordonnées (alpha, frontmatter strippé). PURE, mutée 13/13.
- `Desktop/mcp-doc-hooks/sources/skill.js` — SOURCE « skill » (18/07/2026) : registre `config.skills` → skills déclenchés par PÉRIMÈTRE. 2 dimensions RÉUTILISÉES (fichier via matchingDocs, MCP via lib.serverName), union dédupée. L'adaptateur injecte le CORPS du skill lu en direct (paths.skillsDir(), frontmatter harnais strippé — décision mainteneur 18/07/2026), fallback pointeur si fichier illisible. PURE, mutée 100%.
- `Desktop/mcp-doc-hooks/collisions.js` — NOYAU PUR de l'analyse des croisements de règles (3 niveaux de tri, verdict = AGENT, jamais un gate). Muté 100%.
- `Desktop/mcp-doc-hooks/check-collisions.js` — coquille on-demand (`node check-collisions.js [--json]`), source = frontmatters via loader. Remplace l'ancien ~/.claude/hooks/check-collisions.js (supprimé 17/07/2026).
- `Desktop/mcp-doc-hooks/doc-write-guard.js` — GARDE D'ÉCRITURE (PostToolUse Write|Edit, câblée 17/07/2026) : coquille Claude Code (file_path direct) ; corps commun dans guard-core.js. Validation déléguée à frontmatter.js.
- `Desktop/mcp-doc-hooks/guard-core.js` — CŒUR DE GARDE PostToolUse (19/07/2026, source unique multi-harnais) : docKind + validation multi-fichiers, run(filePaths) → block/silence.
- `Desktop/mcp-doc-hooks/codex-doc-write-guard.js` — coquille CODEX PostToolUse (19/07/2026) : chemins extraits du patch apply_patch (tool_input.command) via sources/file.js#extractFilePaths (MÊME parseur que le match).
- `Desktop/mcp-doc-hooks/codex-doc-write-guard.test.js` — suite spawn de la garde Codex (block sur patch invalide, multi-fichiers, hors-parc muet).
- `Desktop/mcp-doc-hooks/docs/framework/` — LA TOTALE POUR UN FORK (19/07/2026) : miroir versionné du skill (`SKILL.md` = copie de ce fichier) + des docs injectables DU framework (`~/.claude/hooks/docs/mcp-doc-hooks/*.md`). ⚠️ Éditer le PARC (câblé) puis recopier ICI dans le MÊME geste — dérive = ROUGE (parc-sync-gate).
- `Desktop/mcp-doc-hooks/parc-sync-gate.test.js` — GATE parc↔repo : skill + chaque doc injectable du parc == miroir repo à l'octet, zéro oubli, zéro orphelin ; skip propre si parc absent (CI/fork).
- `Desktop/mcp-doc-hooks/vendor-deadline.js` — vendorise `deadline.js` dans `~/.claude/hooks/` + arme les 7 hooks du parc. Dry-run par défaut, idempotent, insertion AVANT la 1ʳᵉ ligne exécutable, signale (jamais devine) les fichiers non patchables.

**Config & état** :
- `Desktop/mcp-doc-hooks/mcp-doc-config.json` — config (mode + seuils + filtres). Prise en compte immédiate, pas de redémarrage. `$schema` → validation IDE.
- `Desktop/mcp-doc-hooks/mcp-doc-config.schema.json` — JSON Schema de la config (enums fermés, clés strictes). Drift-test dans config-gate.test.js : clé de config hors schéma = ROUGE (la classe du bug testserver999).
- `Desktop/mcp-doc-hooks/docs/mcp/{server}.md` / `{server}/{tool}.md` / `{server}/{subTool}.md` — docs par serveur/outil/sous-outil. ⚠️ Gitignoré (vrais invariants perso : emails, clients). Versions génériques poussées sur GitHub = `{server}.md.example`.
- `Desktop/mcp-doc-hooks/state/mcp-doc-seen-<session_id>.json` — état runtime (généré automatiquement, purgé après 30j).
- `Desktop/mcp-doc-hooks/state/.lock-<session_id>/` — dossier-lock temporaire (existe seulement pendant la section critique, jamais commité).

**Tests & qualité** (tous OBLIGATOIRES, jamais temporaires) :
- `Desktop/mcp-doc-hooks/lib-pure.test.js` — tests unitaires purs (zéro spawn), cible de Stryker. ⚠️ Ne JAMAIS écrire un compte de tests ici : deux skills l'ont déjà désynchronisé (66/34 vs 81/40) — le runner est la seule source.
- `Desktop/mcp-doc-hooks/config-gate.test.js` — GATE : la config COMMITTÉE doit couvrir tout serveur documenté. Dead-man switch né du bug "framework désactivé en silence" (15/07/2026).
- `Desktop/mcp-doc-hooks/collisions.test.js` — tests DÉTERMINISTES de collisions.js (cible Stryker, briques internes testées en direct).
- `Desktop/mcp-doc-hooks/doc-write-guard.test.js` — intégration de la garde (spawn, parc tmpdir) : block sur typo/clé interdite, silence sur sain/session/hors-parc, fail-open.
- `Desktop/mcp-doc-hooks/sources-session.test.js` — tests DÉTERMINISTES de `sources/session.js` (cible Stryker).
- `Desktop/mcp-doc-hooks/sources-skill.test.js` — tests DÉTERMINISTES de `sources/skill.js` (cible Stryker) : skillRules, matchingSkills (union fichier+serveur, dédup), serverMatches, declFor, contrat MODES en dur.
- `Desktop/mcp-doc-hooks/skill-registry-gate.test.js` — GATE : tout skill de `config.skills` EXISTE dans le harnais (Claude Code : ~/.claude/commands/{nom}.md). Rename/suppression = pointeur fantôme = ROUGE. SENS INVERSE (19/07), OPT-IN EXPLICITE : ne s'active QUE si la clé `skillsWithoutPerimeter` est présente (même []) — c'est l'interrupteur d'adoption de la discipline zéro-silence (un langage n'impose jamais une politique). Actif → tout skill du harnais DOIT être enregistré (`skills`) OU déclaré sans périmètre, sinon ROUGE. `findMissing`/`findUndeclared` négative-checkés. Skippé sur clone vierge (env MCP_DOC_SKILLS_DIR pour tests).
- `Desktop/mcp-doc-hooks/session-inject.test.js` — intégration de la porte session (spawn, tmpdir) : ordre, contrat SessionStart, fail-open, enabled:false.
- `Desktop/mcp-doc-hooks/sources-file.test.js` — tests DÉTERMINISTES de `sources/file.js` (cible Stryker). ⚠️ Créé après audit : le cœur du refactor n'avait AUCUN test unitaire, sa seule couverture était le différentiel de 75 min (inlançable par Stryker).
- `Desktop/mcp-doc-hooks/sources-mcp.test.js` — tests DÉTERMINISTES de `sources/mcp.js` (cible Stryker) : ids corpus, ordre global→spécifique, filtres, declFor.
- `Desktop/mcp-doc-hooks/sources-tool.test.js` — tests DÉTERMINISTES de `sources/tool.js` (cible Stryker) : match exact/casse, scope/exclude, totalité, ordre.
- `Desktop/mcp-doc-hooks/mcp-differential.test.js` — DIFFÉRENTIEL MCP : spawn vieux (mcp-doc-inject) vs porte unique sur 9 séquences (modes, overrides, granularité, filtres) — gate de parité du retrait du legacy. Timeout 60 s par test (spawns sous charge).
- `Desktop/mcp-doc-hooks/gate.test.js` — tests DÉTERMINISTES de gate.js (cible Stryker). WRITE_TOOLS épinglés EN DUR (contrat protect-files).
- `Desktop/mcp-doc-hooks/gate.property.test.js` — property-based de gate.js (fast-check, inputs générés). JAMAIS lancé par Stryker (non déterministe) : chaque invariant a AUSSI son cas déterministe dans gate.test.js.
- `Desktop/mcp-doc-hooks/doc-inject.test.js` — intégration de la porte (spawn, corpus tmpdir) : allow/ask/rush/dédup smart/fail-open, zéro écriture d'état en corpus dumb.
- `Desktop/mcp-doc-hooks/porte-differential.test.js` — DIFFÉRENTIEL DE PORTE : vieux vs nouveau moteur sur parc RÉEL, contenu injecté À L'OCTET PRÈS + décision miroir du `.rush`. Gate de parité de la bascule. Skippé sur clone vierge.
- `Desktop/mcp-doc-hooks/gitignore-gate.test.js` — GATE STATIQUE : aucun fichier de `state/` (quel que soit son format) n'est tracké par git. Né d'un incident réel (16/07/2026 : journal shadow `.jsonl` non couvert par le pattern par-extension → payloads réels partis sur GitHub). `state/` = runtime PRIVÉ, jamais committable.
- `Desktop/mcp-doc-hooks/frontmatter.test.js` — tests DÉTERMINISTES du parser (cible Stryker). ⚠️ Il n'avait QUE des properties → 100% de ses mutants auraient survécu.
- `Desktop/mcp-doc-hooks/migrate.test.js` — tests DÉTERMINISTES du noyau de migration (cible Stryker).
- `Desktop/mcp-doc-hooks/loader.test.js` — tests DÉTERMINISTES du loader (cible Stryker), dont le piège entrelacement et les cas 25 éléments (TimSort réel — l'insertion sort V8 <23 éléments cache les mutants du comparateur).
- `Desktop/mcp-doc-hooks/shadow-inject.test.js` — preuves du shadow par spawn réel (faux corpus tmpdir) : stdout TOUJOURS vide (sinon = bascule déguisée), journal fidèle (non-matches inclus), fail-open.
- `Desktop/mcp-doc-hooks/migrate.property.test.js` — properties du migrateur : round-trip `parse(serialize(x))===x` (paire encode↔decode) + convergence (rejouer = zéro action, reprise après crash). ⚠️ Sans elles, 292 docs pouvaient être écrites dans un format que le moteur ne relit pas.
- `Desktop/mcp-doc-hooks/lib-pure.property.test.js` — property-based (fast-check) : invariants de sécurité/totalité sur inputs générés. A trouvé le trou `serverName` que les cas à la main avaient raté.
- `Desktop/mcp-doc-hooks/doctor.test.js` — NEGATIVE-CHECK du doctor : sabote une COPIE du framework (tmpdir) et exige qu'il hurle. Sans ça, le dead-man switch pourrait ne jamais se déclencher.
- `Desktop/mcp-doc-hooks/turn-count.test.js` — intégration de la porte TOUR (spawn réel) : incrément par tour, stdout TOUJOURS vide (contrat UserPromptSubmit), sessions isolées, enabled:false, fail-open, reset PreCompact.
- `Desktop/mcp-doc-hooks/deadline.test.js` — PREUVE par spawn réel que l'échéance tue un zombie, dont le negative-check qui REPRODUIT le bug (sans échéance → le process ne meurt pas) et le test anti-latence (unref).
- `Desktop/mcp-doc-hooks/deadline-charge.test.js` — L'échéance ne doit JAMAIS tuer du travail légitime. Gate sur la VALEUR (≥ 15 s) + preuve sous 24 spawns simultanés. ⚠️ Né d'une régression PROD réelle (seuil 2 s → 19/24 hooks sortaient sans injecter). Le test s'AUTO-VALIDE au repos (sa 1ʳᵉ version visait un chemin sans règle → faux rouge).
- `Desktop/mcp-doc-hooks/deadline-gate.test.js` — GATE statique : tout fichier lisant stdin (direct OU via `stdin-json.js`) DOIT armer `deadline.arm()`. ⚠️ Sa 1ʳᵉ version ne cherchait que `process.stdin` → VERT en n'analysant AUCUN hook réel. Un gate aveugle CERTIFIE au lieu de protéger.
- `Desktop/mcp-doc-hooks/frontmatter.property.test.js` — property-based du parser (totalité/round-trip/idempotence + « pas de match = toujours rejeté »).
- `Desktop/mcp-doc-hooks/hooks-parc-gate.test.js` — GATE DU PARC : aucun hook de `~/.claude/hooks/` ne lit stdin sans échéance. Couvre les 7 que `deadline-gate.test.js` ne voit pas (il ne lit que ce repo). Skippé sur clone vierge.
- `Desktop/mcp-doc-hooks/deadline-vendor.test.js` — DRIFT-TEST : la copie vendorisée ≠ l'original = ROUGE. C'est la SEULE chose qui rend la copie acceptable. Skippé sur clone vierge.
- `Desktop/mcp-doc-hooks/vendor-deadline.test.js` — PREUVE sur COPIE tmpdir avant de toucher la prod : dry-run inoffensif, idempotence, 0 « manuel », `node --check` (syntaxe), les 9 suites du parc IDENTIQUES avant/après (anti-régression), et chaque hook patché meurt vraiment. ⚠️ Les 3 angles sont nécessaires : « le process meurt » était VERT sur un fichier cassé (un crash meurt aussi).
- `Desktop/mcp-doc-hooks/file-differential.test.js` — DIFFÉRENTIEL : rejoue `sources/file.js` ET le vrai `protect-files.js` sur 2021 cas dérivés des règles réelles, exige des docs identiques ET ORDONNÉES. ⚠️ ~75 min (spawns) → `npm run test:differential`, hors de `npm test`. Skippé si `protect-files.js` absent (clone vierge).
- `Desktop/mcp-doc-hooks/lock.test.js` — 9 tests dédiés au lock cross-process, dont la régression du bug "checkout frais" (15/07/2026 : lock.js supposait `state/` déjà existant, cassait en CI, invisible en local).
- `Desktop/mcp-doc-hooks/mcp-doc-inject.test.js` — tests d'intégration (spawn process, dont 1 test de concurrence réelle). ⚠️ Config de test = tmpdir via `MCP_DOC_CONFIG_PATH`, JAMAIS le fichier réel du repo.
- `Desktop/mcp-doc-hooks/stryker.conf.json` — config mutation (mute TOUS les modules purs : lib-pure, sources/file, frontmatter, migrate, lint ; break 99, runner vitest perTest — node:test/commandRunner BANNIS 16/07/2026).
- `Desktop/mcp-doc-hooks/vitest.config.mjs` — config vitest par défaut (`npm test`) : toutes les suites SAUF les lourdes.
- `Desktop/mcp-doc-hooks/vitest.stryker.config.mjs` — config vitest DÉDIÉE à Stryker : SEULES les 5 suites déterministes des modules mutés (jamais property/spawn).
- `Desktop/mcp-doc-hooks/vitest.heavy.config.mjs` — config vitest des suites lourdes (charge, parc, vendor, différentiel) — seul moyen de les lancer (l'exclude de la config par défaut bat les args CLI).
- `Desktop/mcp-doc-hooks/mutation-workflow-gate.test.js` — GATE : miroir mutate ⟷ paths CI ⟷ suites Stryker + anti-retour commandRunner/node:test.
- `Desktop/mcp-doc-hooks/lint.js` — NOYAU PUR de l'audit du parc (docs mortes/fantômes, muté par Stryker). Coquille = `lint-corpus.js`.
- `Desktop/mcp-doc-hooks/lint-corpus.js` — coquille I/O du lint du parc (`npm run lint`), sonde de vivacité exit 2.
- `Desktop/mcp-doc-hooks/lint.test.js` / `lint-corpus.test.js` — suites du lint (noyau déterministe · negative-check sur faux parc tmpdir).
- `Desktop/mcp-doc-hooks/.github/workflows/mutation.yml` — workflow mutation séparé à paths stricts (miroir gaté).
- `Desktop/mcp-doc-hooks/.dependency-cruiser.json` — règles anti-couplage (lib-pure doit rester pure, pas de circulaire, stdin-json standalone).
- `Desktop/mcp-doc-hooks/.jscpd.json` — détection de duplication (seuil 1%).

**Doc & meta** :
- `Desktop/mcp-doc-hooks/HOOK-INTERNALS.md` — doc interne détaillée (mécanisme, invariants).
- `Desktop/mcp-doc-hooks/README.md` — doc d'installation/usage publique.
- `Desktop/mcp-doc-hooks/CHANGELOG.md` — historique versionné.
- `Desktop/mcp-doc-hooks/LICENSE` — MIT.
- `Desktop/mcp-doc-hooks/.gitattributes` — normalisation LF.
- `Desktop/mcp-doc-hooks/.gitignore` — exclut state/, docs perso, node_modules, artefacts Stryker/jscpd.
- `Desktop/mcp-doc-hooks/package.json` — scripts (`test`, `test:unit`, `test:integration`, `test:mutation`, `check:coupling`, `check:all`).
- `Desktop/mcp-doc-hooks/.github/workflows/test.yml` — CI (3 jobs : test matriciel ubuntu/windows, coupling, mutation).

## Porter le framework sur un NOUVEAU HARNAIS (Codex, Gemini CLI, autre) — contrat STRICT
Le MOTEUR est portable PAR CONSTRUCTION (gate `sources-must-not-know-the-harness` : CI rouge si une source importe un dialecte). Porter = écrire des COQUILLES, jamais toucher le moteur.
1. **INTERDIT ABSOLU** : modifier `sources/`, `gate.js`, `frontmatter.js`, `loader.js`, `lib-pure.js`, `collisions.js` pour un portage. Si tu crois devoir le faire, tu te trompes de couche — STOP.
2. **À écrire, par événement du harnais cible — JAMAIS de copie (prouvé sur Codex 19/07/2026)** : le corps des portes vit dans des CŒURS PARTAGÉS (`porte-core.js` = PreToolUse, `guard-core.js` = PostToolUse) — une coquille = stdin + `emit` du dialecte (~15-50 l.). D'abord VÉRIFIER si la porte existante se câble TELLE QUELLE (dialecte identique — Codex : reset/turn-count/session-inject réutilisés à l'octet) ; sinon coquille `<harnais>-*.js` qui require le cœur. Seule différence permise : le FORMAT stdin/stdout du harnais cible. Capacité absente (ex. « ask » Codex) = DÉGRADATION EXPLICITE commentée dans l'emit, jamais silencieuse. Événement absent = voie sautée, notée dans REFACTOR-PLAN, jamais bricolée.
3. **Toute coquille** : arme `deadline.arm()` avant toute I/O, fail-open intégral (erreur = exit 0 muet), chemins via `paths.js` uniquement, décision via les modules purs uniquement.
4. **Preuves OBLIGATOIRES avant de câbler** (pas d'exception) : suite d'intégration par spawn réel sur corpus tmpdir (modèles : `doc-inject.test.js`, `session-inject.test.js`, `doc-write-guard.test.js`) + extension du doctor (probe de chaque nouvelle porte + check câblage + negative-check dans `doctor.test.js` qui SABOTE une copie et exige le hurlement).
5. Un harnais SANS un événement (ex. pas de SessionStart) = on saute CETTE voie, on le note dans REFACTOR-PLAN — jamais de contournement bricolé.
6. Fini = `npm test` vert + mutation verte + doctor vert sur le câblage réel + REFACTOR-PLAN/skill mis à jour. Un portage sans ces 4 preuves N'EST PAS fini.

## Ajouter un MCP au standard
1. Créer `Desktop/mcp-doc-hooks/docs/mcp/{server}.md` — même format que la doc fichier : <10 lignes, 1 ligne = 1 invariant/piège, ton impératif, zéro filler.
2. C'est tout. Aucun code à écrire — le hook générique lit tous les `.md` du dossier à la volée.
3. Par défaut : documenter dès qu'un MCP a un invariant/piège/contexte à transmettre (presque toujours) — pas seulement après un incident.

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
