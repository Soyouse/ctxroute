# Arborescence du framework — filet d'EXHAUSTIVITÉ

> ⚠️ EXTRAIT du skill le 31/07/2026 (progressive disclosure) : cette liste pesait 24 625
> caractères, soit 48 % du skill, et poussait l'ensemble bien au-dessus du budget
> d'émission — le skill était donc ÉVINCÉ de la trame, c'est-à-dire ABSENT du contexte.
> ⚠️ RÔLE INCHANGÉ : c'est le filet d'exhaustivité. UN FICHIER HORS DE CETTE LISTE EST UN
> TROU, par définition — jamais un jugement d'importance. Scellé par le volet ② de
> `couverture-gate.test.js`, qui lit CE fichier et le skill.
> ⚠️ Lecture ON-DEMAND : le skill n'en garde qu'un pointeur. Ne pas la réintégrer au skill.

**Code** :
- `Desktop/mcp-doc-hooks/ARBORESCENCE.md` — CE fichier : le filet d'exhaustivité lui-même (1 ligne = 1 fichier + rôle). Sorti du skill le 31/07/2026 (48 % de son poids) ; le skill n'en garde qu'un pointeur. Scellé par le volet ② de couverture-gate.
- `Desktop/mcp-doc-hooks/mcp-doc-inject.js` — RELIQUE (retiré du câblage 17/07/2026, la porte couvre le MCP) : gardé comme oracle du différentiel mcp + rollback. Le doctor exige son ABSENCE du câblage.
- `Desktop/mcp-doc-hooks/mcp-doc-reset.js` — hook PreCompact. Vide les 3 stores de session à chaque compaction (doc-seen, mcp-doc-seen legacy, turn-count — reset absolu, tous modes).
- `Desktop/mcp-doc-hooks/turn-count.js` — porte TOUR (UserPromptSubmit, câblée 18/07/2026) : incrémente le compteur de tours de la session (store 'turn-count-'). MUETTE par contrat (stdout UserPromptSubmit = contexte injecté). Capteur du `driftUnit: turn`.
- `Desktop/mcp-doc-hooks/lib-pure.js` — TOUTE la logique décisionnelle, zéro I/O (fs/path/process interdits). Mutée par Stryker.
- `Desktop/mcp-doc-hooks/lock.js` — lock cross-process (`fs.mkdirSync` atomique) protégeant les accès concurrents à `state/`. Timeout 2 s fail-open (prod, intouchable) ; env `MCP_DOC_LOCK_TIMEOUT_MS` réservée aux tests de concurrence (prouver l'atomicité hors charge).
- `Desktop/mcp-doc-hooks/stdin-json.js` — lecture stdin→JSON partagée par les 2 hooks (extrait après détection de duplication par jscpd).
- `Desktop/mcp-doc-hooks/paths.js` — SOURCE UNIQUE des chemins (config/docs/state) + 3 env vars d'isolation réservées aux tests/doctor. Aucun `path.join(__dirname,...)` ad-hoc ailleurs.
- `Desktop/mcp-doc-hooks/doctor.js` — dead-man switch : 7 sondes bout-en-bout (5 portes + garde d'écriture + reset), chacune prouvée par EFFET RÉEL (injection dans le contexte, store incrémenté, stores effacés — jamais juste exit 0, trou fermé 19/07) + câblage `settings.json` fichier par fichier. Câblé en SessionStart (`--quiet`), hurle si mort.
- `Desktop/mcp-doc-hooks/deadline.js` — ÉCHÉANCE de process (anti-zombie). Autonome, dépend de rien. Tout hook lisant stdin DOIT l'armer avant toute I/O. Né des 875 zombies du 15/07/2026 (bug Claude Code #68626). ⚠️ BEST-EFFORT par nature (vit DANS le process visé) : 502 zombies mesurés le 27/07/2026 MALGRÉ lui (process nés sous saturation, jamais assez avancés pour l'armer). Le filet externe qui les récolte est un outil PERSONNEL du mainteneur (`~/.claude/hooks/maintenance/`) — **hors de ce repo public : il cible des hooks propres à SON poste, il n'a rien d'universel**.
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
- `Desktop/mcp-doc-hooks/explain.js` — OUTIL D'INTROSPECTION (31/07/2026) : « pour CE geste, qu'est-ce qui s'injecte, et POURQUOI (ou pourquoi PAS) ? ». Lecture seule, ZÉRO écriture d'état, fail-LOUD (exit 2). Consomme les MÊMES fonctions que la porte ; le « pourquoi PAS » vient de PROBES qui ré-interrogent les vraies sources — jamais une 2ᵉ logique. ⚠️ À dégainer AVANT de conclure qu'une doc est muette : réimplémenter le moteur pour le sonder a coûté une session entière.
- `Desktop/mcp-doc-hooks/collect-core.js` — COLLECTE PARTAGÉE porte↔explain (source unique de « quelles docs pour ce payload ? »). Zéro décision (gate.js tranche). La dupliquer rouvre la divergence qu'`explain` existe pour tuer.
- `Desktop/mcp-doc-hooks/porte-core.js` — CŒUR DE PORTE PreToolUse (19/07/2026, source unique multi-harnais) : collecte registre → gate → format, run(data, emit, options). Toute évolution d'orchestration ICI, jamais dans une coquille. ⚠️ Remet l'état des docs DIFFÉRÉES par le budget (`gate.decide` marque `seen` sans connaître le budget) — sinon une doc `once` évincée serait consommée sans avoir été livrée.
- `Desktop/mcp-doc-hooks/budget.js` — BUDGET D'ÉMISSION (31/07/2026), PUR, muté : ce qui sort tient dans la trame du harnais, ou c'est ANNONCÉ (nom + chemin) — jamais perdu en silence. Ne connaît AUCUN seuil (le chiffre vient de la coquille). Segment INDIVISIBLE, sceau `###FIN:xxx###` conditionnel au-delà de 50 % du budget (sous ce seuil = format historique à l'octet, bascule sûre).
- `Desktop/mcp-doc-hooks/budget.test.js` — suite DÉTERMINISTE de budget.js (celle que Stryker mute : les property-tests sont exclus de `vitest.stryker.config.mjs`, un run flaky par mutant rendrait le score menteur). Ancre les textes EXACTS de l'en-tête/annonce (ils SONT le contrat lu par l'agent) et la borne inclusive.
- `Desktop/mcp-doc-hooks/budget.property.test.js` — property-based (fast-check) : CONSERVATION, borne, priorité, déterminisme, sceau, annonce + méta-test ⑦ COUVERTURE (prouve que le générateur atteint la zone mixte — deux sabotages y sont passés VERTS avant lui).
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
- `Desktop/mcp-doc-hooks/deps-criticite.json` — MANIFESTE de criticité des dépendances : chaque dépendance de chaque `package.json` est classée `moteur` (détermine la sortie livrée ⇒ épinglage EXACT obligatoire) ou `ordinaire`. Non classée = ROUGE — trancher EST le but.
- `Desktop/mcp-doc-hooks/deps-criticite-pure.js` — NOYAU PUR du gate de criticité (muté Stryker). La règle vit ICI, pas dans le test : Stryker ne mute pas le code des tests, une règle qui y vivrait serait INVÉRIFIABLE.
- `Desktop/mcp-doc-hooks/mcp-doc-config.json.example` — config générique livrée (le vrai `mcp-doc-config.json` est gitignoré : il porte les noms de skills/projets = données perso).
- `Desktop/mcp-doc-hooks/package-lock.json` — verrou de dépendances (`npm ci`). Ne jamais l'éditer à la main.
- `Desktop/mcp-doc-hooks/mcp-doc-config.json` — config (mode + seuils + filtres). Prise en compte immédiate, pas de redémarrage. `$schema` → validation IDE.
- `Desktop/mcp-doc-hooks/mcp-doc-config.schema.json` — JSON Schema de la config (enums fermés, clés strictes). Drift-test dans config-gate.test.js : clé de config hors schéma = ROUGE (la classe du bug testserver999).
- `Desktop/mcp-doc-hooks/docs/mcp/{server}.md` / `{server}/{tool}.md` / `{server}/{subTool}.md` — docs par serveur/outil/sous-outil. ⚠️ Gitignoré (vrais invariants perso : emails, clients). Versions génériques poussées sur GitHub = `{server}.md.example`.
- `Desktop/mcp-doc-hooks/state/mcp-doc-seen-<session_id>.json` — état runtime (généré automatiquement, purgé après 30j).
- `Desktop/mcp-doc-hooks/state/.lock-<session_id>/` — dossier-lock temporaire (existe seulement pendant la section critique, jamais commité).

**Tests & qualité** (tous OBLIGATOIRES, jamais temporaires) :
- `Desktop/mcp-doc-hooks/lib-pure.test.js` — tests unitaires purs (zéro spawn), cible de Stryker. ⚠️ Ne JAMAIS écrire un compte de tests ici : deux skills l'ont déjà désynchronisé (66/34 vs 81/40) — le runner est la seule source.
- `Desktop/mcp-doc-hooks/explain.test.js` — suite d'`explain` par SPAWN RÉEL sur parc jetable (14 tests). ⚠️ Contient les 2 CAS FONDATEURS qui rejouent les faux verts du 31/07 : ne JAMAIS les supprimer — si le comportement change, le verdict s'INVERSE (fait pour le joker), le cas reste.
- `Desktop/mcp-doc-hooks/deps-criticite-pure.test.js` — tests DÉTERMINISTES du noyau de criticité (cible Stryker), edge cases adverses inclus (`/regex/.test(['1.2.3'])` vaut TRUE par coercition JS — la garde `typeof` n'est PAS décorative).
- `Desktop/mcp-doc-hooks/deps-criticite-gate.test.js` — GATE : toute dépendance réelle est classée, un `moteur` est épinglé EXACT, une entrée FANTÔME est ROUGE. ⚠️ Périmètre vide ici (zéro dépendance runtime) ⇒ test d'ANTI-DORMANCE obligatoire, sinon le gate dormirait au vert.
- `Desktop/mcp-doc-hooks/couverture-gate.test.js` — GATE DE COUVERTURE (4 volets DÉRIVÉS, jamais une liste) : ① tout `.js` reçoit une doc injectable · ② tout fichier tracké est dans CETTE arbo · ③ tout module est dans l'`includeOnly` dependency-cruiser (hors liste = gate de couplage VERT en n'analysant rien) · ④ aucune doc ne GROSSIT (cliquet + dette qui ne peut que rétrécir). Né d'un audit ayant trouvé 5 oublis dont 3 préexistants.
- `Desktop/mcp-doc-hooks/triggers-gate.test.js` — GATE : tout déclencheur de `DECLENCHEURS` DOIT être prouvé consommé par une source RÉELLE (appel, jamais une liste recopiée) ; aucun message de `validate` ne conseille une clé rejetée. Ajouter un déclencheur sans son cas de preuve = ROUGE.
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
- `Desktop/mcp-doc-hooks/EVAL-SESSIONS.md` — JOURNAL D'ÉVALUATION du framework en usage réel (ce qui s'est injecté au bon moment, ce qui a manqué, valeur MESURÉE). ⚠️ Repo public : zéro donnée perso (« le mainteneur », jamais un nom de client).
- `Desktop/mcp-doc-hooks/LICENSE` — MIT.
- `Desktop/mcp-doc-hooks/.gitattributes` — normalisation LF.
- `Desktop/mcp-doc-hooks/.gitignore` — exclut state/, docs perso, node_modules, artefacts Stryker/jscpd.
- `Desktop/mcp-doc-hooks/package.json` — scripts (`test`, `test:unit`, `test:integration`, `test:mutation`, `check:coupling`, `check:all`).
- `Desktop/mcp-doc-hooks/.github/workflows/test.yml` — CI (3 jobs : test matriciel ubuntu/windows, coupling, mutation).
