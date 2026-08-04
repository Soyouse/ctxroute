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
    const decouper = (inject) => budget.planifierPaquets(segmentsPour(inject), budgetMax, nbPaquets);
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
      if (Array.isArray(cache.inject)) {
        return { r: { inject: cache.inject, decision: cache.decision }, paquets: decouper(cache.inject) };
      }
      const state = store.loadState(STORE_PREFIX, sessionId);
      const r = gate.decide(config, decls, matched, toolName, state, turnCount);
      const paquets = decouper(r.inject);
      // ⚠️ UNE DOC DIFFÉRÉE NE DOIT JAMAIS ÊTRE MARQUÉE « VUE ».
      //    `gate.decide` écrit `{seen:true, sinceLastCall:0}` pour TOUT ce qu'il
      //    décide d'injecter — il ignore (et doit ignorer) le budget, qui est
      //    une contrainte de TRANSPORT, pas de décision. Sans cette remise en
      //    état, une doc `once` évincée par manque de place serait consommée
      //    sans jamais avoir été livrée : PERDUE POUR TOUTE LA SESSION, en
      //    silence. C'est très exactement le défaut que ce chantier corrige —
      //    le réintroduire ici serait le comble. NE PAS SUPPRIMER.
      //    ⚠️ Les différés vivent dans le DERNIER paquet (c'est lui qui porte
      //    l'annonce) — en trame unique, c'est le seul, donc parité exacte.
      for (const d of paquets[paquets.length - 1].differes) {
        if (Object.prototype.hasOwnProperty.call(state, d.id)) r.state[d.id] = state[d.id];
        else delete r.state[d.id];
      }
      if (r.changed) store.saveState(STORE_PREFIX, sessionId, r.state);
      if (fragmente) store.saveState(PLAN_PREFIX, clePlan, { inject: r.inject, decision: r.decision });
      return { r, paquets };
    }, { fallback: null });
    // Lock indisponible → décider SANS état (jamais se taire, cf en-tête).
    if (!res) {
      const r = gate.decide(config, decls, matched, toolName, {}, turnCount);
      res = { r, paquets: decouper(r.inject) };
    }

    if (res.r.inject.length === 0) process.exit(0);

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
      const injected = plan.emis.filter((d) => acc.owner[d] === a.id);
      if (injected.length === 0) continue;
      const m = a.message(injected, { fullDoc, config, acc });
      if (m) msgs.push(m);
    }
    emit(res.r.decision, fullDoc, msgs.join(' · '));
  } catch {
    process.exit(0); // fail-open
  }
}

module.exports = { run };
