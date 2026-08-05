// ═══════════════════════════════════════════════════════════════════════
// CŒUR DE PORTE PreToolUse — corps COMMUN à tous les harnais (source unique).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ EXTRAIT de doc-inject.js le 19/07/2026 pour le portage Codex : la logique
//    d'orchestration (collecte → décision → format) est LA MÊME sur tous les
//    harnais dont le payload PreToolUse expose session_id/tool_name/tool_input
//    (contrat MESURÉ : Claude Code + Codex CLI ≥ 0.144). La dupliquer par
//    coquille = la dérive que ce framework combat. SEUL le `emit` (dialecte de
//    SORTIE du harnais) varie — il est INJECTÉ par la coquille appelante.
//
// ⚠️ CONTRAT emit(decision, fullDoc, systemMessage) : appelé au plus UNE fois,
//    DOIT terminer le process (exit 0). decision ∈ 'allow'|'ask' — un harnais
//    sans support 'ask' le DÉGRADE en injection simple (jamais en silence).
//
// ⚠️ Ce module est une COQUILLE PARTAGÉE (I/O : lock, store, config) — jamais
//    muté Stryker, jamais importé par le moteur pur. Les invariants métier
//    vivent dans gate.js/sources/* ; ne JAMAIS en rapatrier ici.
//
// ⚠️ FAIL-OPEN intégral (config/corpus/state illisibles → exit 0 sans stdout),
//    SAUF le sens de l'injection sur échec de LOCK : on décide alors SANS état
//    (state = {}) plutôt que de se taire — se taire sur contention =
//    régression silencieuse.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const path = require('path');
const lib = require('./lib-pure');
const gate = require('./gate');
const { ADAPTERS } = require('./source-adapters');
// ⚠️ COLLECTE PARTAGÉE (31/07/2026) : la porte et `explain.js` DOIVENT collecter
//    par le MÊME code, sinon l'outil d'introspection finirait par décrire un
//    moteur qui n'existe pas — le bug qu'il est censé prévenir. `collect-core`
//    est la source unique ; ne JAMAIS reconstruire l'accumulateur ici.
const { collectAll, loadConfig } = require('./collect-core');
// Budget de TRAME (31/07/2026) : borne ce qui sort, annonce ce qui ne rentre pas.
const budget = require('./budget');
// ⚠️ COUCHE D'ÉMISSION (05/08/2026, REFACTOR-PLAN ⑯) — SOURCE UNIQUE du
//    transport (file + découpage). Elle vivait ICI, ce qui la rendait
//    facultative pour les AUTRES émetteurs : `session-inject.js` ne la
//    traversait pas et sortait donc sans sceau ni morcelage. Ne JAMAIS
//    rapatrier la file ni le découpage dans cette orchestration — le gate
//    `emission-core-gate.test.js` exige que tout émetteur passe par le module.
const emission = require('./emission-core');
const { withLock } = require('./lock');
const paths = require('./paths');
const store = require('./session-store');

// State par session, préfixe 'doc-seen-' (dédup par DOC) — cf session-store.js.
const STORE_PREFIX = 'doc-seen-';
// ⚠️ PLAN MÉMOÏSÉ PAR INVOCATION (03/08/2026) — préfixe DISTINCT obligatoire.
//    Sans lui, le mode multi-paquets serait FAUX : les N processus appellent
//    chacun `gate.decide`, qui ÉCRIT l'état. Le premier consomme les docs
//    `once` ⇒ les suivants décident « rien à injecter » ⇒ paquets 2..N VIDES.
//    Ici, le premier arrivé décide et range sa décision ; les autres la
//    RELISENT. Le découpage, lui, est pur et déterministe : chacun le
//    recalcule et n'émet que son indice. Purgé par ctxroute-reset.js.
const PLAN_PREFIX = 'plan-';
// ⚠️ LA FILE D'ÉMISSION A QUITTÉ CE FICHIER (05/08/2026, REFACTOR-PLAN ⑯).
//    Elle vit désormais dans `emission-core.js`, la couche que TOUT émetteur
//    traverse. La garder ici la rendait facultative pour les autres émetteurs
//    — c'est exactement le défaut qui a laissé la porte SESSION sans transport.
//    Ne JAMAIS redéclarer un préfixe de file ici.
// Compteur de TOURS (porte turn-count.js, UserPromptSubmit) — préfixe distinct.
const TURN_PREFIX = 'turn-count-';

// ⚠️ `loadConfig` vivait ICI en copie — déplacé dans collect-core.js le
//    31/07/2026 (même comportement fail-open : config absente = défauts,
//    framework ACTIF). Ne pas le réintroduire.

/**
 * Budget d'émission effectif, en caractères. CASCADE :
 *   ① défaut FRAMEWORK (`budget.DEFAUT_BUDGET`) — existe même sans config ni coquille
 *   ② limite du HARNAIS, déclarée par la coquille (`options.budget`)
 *   ③ config globale (`budgetInjection`) — l'opérateur peut RÉDUIRE, jamais dépasser
 *
 * ⚠️ Le `Math.min` n'est PAS une commodité : la limite du harnais est PHYSIQUE
 *    (au-delà, le contenu est rangé dans un fichier et l'agent ne voit qu'un
 *    aperçu). Laisser une config la dépasser rendrait la troncature silencieuse
 *    au moment même où l'opérateur croit desserrer la contrainte.
 * ⚠️ Aucune valeur de harnais n'est écrite ici : `porte-core` est partagé par
 *    TOUS les harnais. Le chiffre vient de la coquille, toujours.
 */
function budgetPour(config, options) {
  const duHarnais = options && Number.isFinite(options.budget) && options.budget > 0 ? options.budget : budget.DEFAUT_BUDGET;
  const c = config && config.budgetInjection;
  if (Number.isFinite(c) && c > 0) return Math.min(duHarnais, c);
  return duHarnais;
}

// Corps commun. `data` = payload stdin déjà parsé du harnais ; `emit` = dialecte
// de sortie de la coquille ; `options.budget` = limite de trame du harnais
// (facultatif — absent ⇒ défaut framework, donc AUCUNE coquille n'est cassée).
// Toute erreur = exit 0 muet (fail-open).
function run(data, emit, options) {
  try {
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};
    // ⚠️ SCOPE PAR AGENT (19/07/2026) : l'état once/smart est keyé par
    // lib.scopeId(session_id, agent_id) — JAMAIS session_id seul. session_id
    // est PARTAGÉ maître/sous-agents (contrat harnais) : keyer dessus = le
    // 1er agent consomme le `once` et tous les sous-agents suivants ne
    // reçoivent RIEN (trou prouvé 19/07/2026). Harnais SANS agent_id (Codex) :
    // scopeId retourne la clé simple — état partagé, absorbé par construction.
    const sessionId = lib.scopeId(data.session_id, data.agent_id);
    const config = loadConfig();

    // Interrupteur global — même sémantique sur tous les harnais.
    if (!lib.isFrameworkEnabled(config)) process.exit(0);

    // ── COLLECTE (collect-core.js → registre source-adapters.js) ──
    // Chaque adaptateur pose ses docs matchées + decls/bodies/labels dans
    // l'accumulateur. Ordre du registre = ordre de concaténation.
    // `cwd` = champ COMMUN des contrats de hooks MESURÉ sur les 2 harnais
    // (Claude Code : champ commun de tout payload · Codex CLI : payload de
    // base session_id/transcript_path/cwd/hook_event_name). Consommé
    // UNIQUEMENT par la source skill, FAIL-SOFT : absent → comportement
    // d'avant. Les sources fichier/MCP l'IGNORENT — parité protect-files.
    const payload = { toolName, toolInput, cwd: data.cwd };
    const acc = collectAll(config, payload);
    const { matched, decls, bodies } = acc;

    // Compteur de TOURS lu UNIQUEMENT si une doc matchée est en driftUnit
    // 'turn' (gate.driftUnitForDoc = l'unique cascade, jamais recopiée ici) :
    // zéro lecture disque ajoutée pour un parc 100% 'tool' (parité perf).
    // Lecture seule hors lock : le compteur est monotone, écrit par la porte
    // turn-count sous SON lock. CONTRAT gate.decide : toujours un entier.
    let turnCount = 0;
    if (matched.some((d) => gate.driftUnitForDoc(config, decls[d]) === 'turn')) {
      const t = store.loadState(TURN_PREFIX, sessionId).turns;
      if (Number.isInteger(t)) turnCount = t;
    }

    // [source: …] — vocabulaire posé par CHAQUE source (acc.labels) :
    // fichier = '.claude/hooks/docs/…', MCP = 'docs/mcp/…'. Parité gardée.
    const segmentsPour = (docs) =>
      docs.map((doc) => ({
        id: doc,
        text: (bodies[doc] || '').trim() + '\n[source: ' + acc.labels[doc] + ']',
        label: acc.labels[doc],
      }));
    const budgetMax = budgetPour(config, options);

    // ── TRANSPORT MULTI-TRAMES (fourni par la COQUILLE, jamais lu ici) ──
    // ⚠️ CONTRAT D'EXTENSION §7 : le noyau ne lit AUCUN champ de harnais.
    //    `invocationId` (Claude Code : `tool_use_id`) est passé par la coquille
    //    comme le budget. Un harnais qui n'en a pas ⇒ `fragmente` faux ⇒
    //    UNE trame, comportement d'aujourd'hui à l'octet. Dégradation, pas casse.
    const nbDeclare = options && Number.isInteger(options.nbPaquets) && options.nbPaquets >= 2 ? options.nbPaquets : 1;
    const invocationId = options && typeof options.invocationId === 'string' ? options.invocationId : '';
    // ⚠️ La fragmentation exige les DEUX : une déclaration multi-trames ET un
    //    identifiant d'invocation pour partager la décision. Il en manque un ⇒
    //    on retombe INTÉGRALEMENT sur la trame unique — découpage compris.
    //    Découper sans mémoïser produirait des paquets décidés séparément :
    //    docs `once` consommées par le premier, trames suivantes vides.
    const fragmente = nbDeclare >= 2 && invocationId !== '';
    const nbPaquets = fragmente ? nbDeclare : 1;
    const indice = fragmente && Number.isInteger(options.paquet) && options.paquet >= 1 ? options.paquet : 1;

    // Section critique sous lock (état par session, dédup par doc). Un corpus
    // 100% dumb ne produit aucune écriture (changed=false) — parité perf.
    const lockDir = path.join(paths.stateDir(), `.lock-doc-${lib.sanitizeSessionId(sessionId)}`);
    // ⚠️ TOUT PASSE PAR LA COUCHE D'ÉMISSION — jamais `budget.planifierPaquets`
    //    en direct depuis un émetteur. `decouper` seul = REJOUE d'un découpage
    //    déjà décidé (plan mémoïsé) ou chemin DÉGRADÉ sans lock ; le chemin
    //    normal est `emission.emettre`, qui touche la file.
    const decouper = (segs) => emission.decouper(segs, budgetMax, nbPaquets);
    // Identité d'un document : source unique dans `budget.js` (les morceaux
    // portent `<doc>#<j>`). Vivait ici en copie locale — c'est une règle du
    // TRANSPORT, pas de cette orchestration.
    const baseId = budget.baseId;
    let res = withLock(lockDir, () => {
      // ⚠️ RELECTURE DU PLAN — le cœur du multi-paquets. Les N processus sont
      //    PARALLÈLES et ne peuvent pas se parler : un seul décide (et écrit
      //    l'état), tous recalculent le MÊME découpage par déterminisme pur.
      //    N'importe lequel peut être le premier — c'est sans importance.
      // ⚠️ Clé PRÉFIXÉE PAR LA SESSION (et non l'invocation seule) : c'est ce
      //    qui rend le plan purgeable par `ctxroute-reset.js`, qui balaie par
      //    préfixe de session. Une clé orpheline ne serait nettoyée que par le
      //    GC de TTL — un déchet silencieux, exactement ce qu'on refuse.
      const clePlan = sessionId + '--inv-' + invocationId;
      const cache = fragmente ? store.loadState(PLAN_PREFIX, clePlan) : {};
      // ⚠️ LE PLAN MÉMOÏSE LES **SEGMENTS**, PLUS SEULEMENT LES IDS (05/08/2026).
      //    Depuis la file, l'entrée du découpage n'est plus dérivable des seuls
      //    ids : elle mêle des morceaux HÉRITÉS de gestes précédents et des docs
      //    fraîches. Les processus 2..N doivent voir EXACTEMENT ce qu'a vu le
      //    premier — sinon leurs trames ne recollent plus. Ne JAMAIS revenir à
      //    un cache d'ids « pour alléger » : ce serait rendre le découpage
      //    non-reproductible, c'est-à-dire casser le multi-trames en silence.
      if (Array.isArray(cache.segments)) {
        return { segments: cache.segments, decision: cache.decision, paquets: decouper(cache.segments) };
      }
      const state = store.loadState(STORE_PREFIX, sessionId);
      const r = gate.decide(config, decls, matched, state, turnCount, acc.owner);

      // ── ÉMISSION : file d'abord, frais ensuite, reste persisté ──
      // ⚠️ TOUT CE MÉCANISME VIT DANS `emission-core.js` (ordre RFC 6455, dédup
      //    par document, écriture inconditionnelle de la file). Il était ÉCRIT
      //    ICI jusqu'au 05/08/2026 — donc invisible et non réutilisable pour
      //    les autres émetteurs. Ne JAMAIS le réinstaller dans cette fonction :
      //    ce serait recréer la copie que ⑯ vient de supprimer.
      const em = emission.emettre({
        frais: segmentsPour(r.inject),
        budgetMax,
        nbPaquets,
        indice,
        scopeId: sessionId,
      });
      const segments = em.segments;
      const paquets = em.paquets;

      // ⚠️ LA BOUCLE DE RESTAURATION D'ÉTAT DES DIFFÉRÉS A ÉTÉ SUPPRIMÉE ICI
      //    (05/08/2026). Elle « dé-marquait » une doc différée pour que le geste
      //    suivant la redécide, parce qu'un différé était alors PERDU. Ce n'est
      //    plus vrai : le différé est EN VOL, la file garantit son arrivée. La
      //    garder produirait l'inverse du but recherché — la doc serait à la
      //    fois dans la file ET redécidée, donc livrée en double. La garantie
      //    « jamais consommée sans être livrée » n'a pas disparu : elle a changé
      //    de gardien, et son gardien est maintenant scellé par property.
      if (r.changed) store.saveState(STORE_PREFIX, sessionId, r.state);
      if (fragmente) store.saveState(PLAN_PREFIX, clePlan, { segments, decision: r.decision });
      return { segments, decision: r.decision, paquets };
    }, { fallback: null });
    // Lock indisponible → décider SANS état (jamais se taire, cf en-tête).
    // ⚠️ NI LECTURE NI ÉCRITURE DE LA FILE SUR CE CHEMIN : sans lock, deux
    //    processus pourraient consommer puis réécrire la file concurremment et
    //    en perdre une partie. On dégrade donc au frais seul — l'ancien
    //    comportement, jamais une corruption. La file reste intacte et repart au
    //    geste suivant.
    if (!res) {
      const r = gate.decide(config, decls, matched, {}, turnCount, acc.owner);
      const segments = segmentsPour(r.inject);
      res = { segments, decision: r.decision, paquets: decouper(segments) };
    }

    // ⚠️ `segments`, PAS `r.inject` : la file peut porter du contenu alors que
    //    gate.decide n'a rien décidé de neuf (tout est déjà `seen`). Tester
    //    l'ancien champ ferait sortir en silence avec une file pleine — la doc
    //    n'arriverait alors JAMAIS. C'est le piège exact de ce chantier.
    if (res.segments.length === 0) process.exit(0);

    // ⚠️ Un paquet VIDE sort en SILENCE (exit 0) : il n'a ni contenu ni annonce.
    //    En trame unique ce cas est impossible dès que `inject` est non vide —
    //    la parité est donc intacte.
    const plan = res.paquets[indice - 1];
    if (!plan || plan.texte === '') process.exit(0);

    const fullDoc = plan.texte;

    // systemMessage : chaque source compose LE SIEN sur SES docs injectées
    // (contrat message()), joints ' · ' — avant la fusion, deux hooks
    // émettaient deux messages ; on les garde tous.
    const msgs = [];
    for (const a of ADAPTERS) {
      // ⚠️ `plan.emis`, PAS `r.inject` : le marqueur (« 🧩 skill: … ») annonce ce
      //    qui est RÉELLEMENT dans le contexte. Annoncer une doc différée
      //    ferait croire à l'agent qu'il l'a reçue — le « vert qui ment ».
      //    ⚠️ En multi-paquets, c'est le contenu de CE paquet — chaque trame
      //    annonce ce qu'ELLE porte, jamais ce que les autres transportent.
      //    ⚠️ `baseId` + dédup : une trame peut porter `foo#2` et `foo#3` du
      //    MÊME document. Sans repli sur la base, aucun propriétaire ne serait
      //    reconnu (le badge deviendrait muet dès qu'une doc est morcelée) et un
      //    document compterait double. Un morceau hérité de la file dont la doc
      //    ne matche plus n'a pas de propriétaire : il n'est pas annoncé, ce qui
      //    est honnête — il est livré, pas attribué.
      const injected = [...new Set(plan.emis.map(baseId))].filter((d) => acc.owner[d] === a.id);
      if (injected.length === 0) continue;
      const m = a.message(injected, { fullDoc, config, acc });
      if (m) msgs.push(m);
    }
    emit(res.decision, fullDoc, msgs.join(' · '));
  } catch {
    process.exit(0); // fail-open
  }
}

/**
 * SORTIE `deny` — DIALECTE COMMUN aux deux harnais (05/08/2026).
 *
 * ⚠️ POURQUOI ICI ET PAS DANS CHAQUE COQUILLE : le JSON de refus est
 *    RIGOUREUSEMENT IDENTIQUE sur Claude Code et Codex (doc officielle des
 *    deux + chaînes vérifiées dans le binaire Codex 0.144.6). Le dupliquer
 *    dans les 2 coquilles était un CLONE de 22 lignes — jscpd l'a vu, et le
 *    contrat de portage l'interdit (« JAMAIS de copie »). Précédent identique :
 *    `decision: block` de guard-core.js.
 * ⚠️ Le jour où un harnais divergerait sur CE point, il reprendrait son propre
 *    emit — c'est la règle : on partage ce qui est MESURÉ identique, jamais ce
 *    qu'on suppose identique.
 * ⚠️ La doc part en `permissionDecisionReason`, JAMAIS en `additionalContext` :
 *    ce dernier n'arrive qu'à côté du RÉSULTAT de l'outil, donc trop tard pour
 *    l'appel qu'on refuse. C'est tout le sens de `enforce`.
 */
function sortieDeny(fullDoc) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: '[GESTE REFUSÉ — lis ceci, puis recommence]\n\n' + fullDoc,
    },
  };
}

module.exports = { run, sortieDeny };
