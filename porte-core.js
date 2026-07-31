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
const { withLock } = require('./lock');
const paths = require('./paths');
const store = require('./session-store');

// State par session, préfixe 'doc-seen-' (dédup par DOC) — cf session-store.js.
const STORE_PREFIX = 'doc-seen-';
// Compteur de TOURS (porte turn-count.js, UserPromptSubmit) — préfixe distinct.
const TURN_PREFIX = 'turn-count-';

// ⚠️ `loadConfig` vivait ICI en copie — déplacé dans collect-core.js le
//    31/07/2026 (même comportement fail-open : config absente = défauts,
//    framework ACTIF). Ne pas le réintroduire.

// Corps commun. `data` = payload stdin déjà parsé du harnais ; `emit` = dialecte
// de sortie de la coquille. Toute erreur = exit 0 muet (fail-open).
function run(data, emit) {
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

    // Section critique sous lock (état par session, dédup par doc). Un corpus
    // 100% dumb ne produit aucune écriture (changed=false) — parité perf.
    const lockDir = path.join(paths.stateDir(), `.lock-doc-${lib.sanitizeSessionId(sessionId)}`);
    let res = withLock(lockDir, () => {
      const state = store.loadState(STORE_PREFIX, sessionId);
      const r = gate.decide(config, decls, matched, toolName, state, turnCount);
      if (r.changed) store.saveState(STORE_PREFIX, sessionId, r.state);
      return r;
    }, { fallback: null });
    // Lock indisponible → décider SANS état (jamais se taire, cf en-tête).
    if (!res) res = gate.decide(config, decls, matched, toolName, {}, turnCount);

    if (res.inject.length === 0) process.exit(0);

    // [source: …] — vocabulaire posé par CHAQUE source (acc.labels) :
    // fichier = '.claude/hooks/docs/…', MCP = 'docs/mcp/…'. Parité gardée.
    const parts = res.inject.map((doc) => (bodies[doc] || '').trim() + '\n[source: ' + acc.labels[doc] + ']');
    const fullDoc = parts.join('\n\n---\n\n');

    // systemMessage : chaque source compose LE SIEN sur SES docs injectées
    // (contrat message()), joints ' · ' — avant la fusion, deux hooks
    // émettaient deux messages ; on les garde tous.
    const msgs = [];
    for (const a of ADAPTERS) {
      const injected = res.inject.filter((d) => acc.owner[d] === a.id);
      if (injected.length === 0) continue;
      const m = a.message(injected, { fullDoc, config, acc });
      if (m) msgs.push(m);
    }
    emit(res.decision, fullDoc, msgs.join(' · '));
  } catch {
    process.exit(0); // fail-open
  }
}

module.exports = { run };
