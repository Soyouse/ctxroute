// ═══════════════════════════════════════════════════════════════════════
// GATE (porte unifiée) — PUR. Que faire de cet appel d'outil ?
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O (gate `gate-must-stay-pure`). L'appelant (doc-inject.js) lit
//    corpus/config/state et applique la décision ; ce module TRANCHE seulement.
//    Muté par Stryker (mutate + include Stryker, cf quality-configs.md).
//
// ⚠️ C'EST LA PIÈCE QUI REMPLACE l'injection de protect-files.js À LA BASCULE.
//    Parité comportementale EXIGÉE sur le corpus migré (tout en mode dumb +
//    confirm: true) : mêmes docs, mêmes instants, ask sur les mêmes outils.
//    Scellée par porte-differential.test.js (spawn vieux vs nouveau moteur).
//
// ⚠️ Le dédup par DOC (modes smart/once, compteurs « outils étrangers ») est
//    la raison d'être de la fusion — mais il ne s'ACTIVE qu'au passage d'une
//    doc hors de `dumb`, chantier humain post-bascule (décision 8 du plan).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { shouldInjectFor, confirmFor } = require('./lib-pure');
const { DRIFT_UNITS, MODES } = require('./frontmatter');

// ⚠️ COPIE CONTRACTUELLE de la liste de protect-files.js (writeTools) — outils
//    d'ÉCRITURE qui déclenchent une confirmation quand une doc `confirm: true`
//    est injectée. Liste unifiée Claude + Codex. Épinglée EN DUR dans gate.test.js.
const WRITE_TOOLS = ['mcp__ssh__ssh_edit_file', 'mcp__ssh__ssh_write_file', 'mcp__ssh__ssh_upload_file', 'Edit', 'Write', 'apply_patch'];

// ═══════════════════════════════════════════════════════════════════════
// CASCADE DES AUTORITÉS — 4 ÉTAGES, UN SEUL POINT (ici). 04/08/2026.
// ═══════════════════════════════════════════════════════════════════════
//   ① entrée (frontmatter de la doc / entrée du registre skill) = dernier mot
//   ② defaults.{source}  (JSON) — « toutes les docs de CETTE catégorie »
//   ③ global mode/defaultThreshold/defaultDriftUnit (JSON) — tout le corpus
//   ④ défaut FRAMEWORK, codé en dur (existe même sans aucun JSON)
//
// ⚠️ L'étage ② généralise l'ancien `skillDefaults`, qui n'ouvrait cet étage
//    qu'aux skills. Deux mots pour un même étage = loi anti-synonyme violée :
//    `skillDefaults` est SUPPRIMÉ, jamais gardé en alias (deux vérités dérivent).
//
// ⚠️ NE JAMAIS recopier cette cascade ailleurs (ni dans une source, ni dans une
//    coquille) : une source POSE l'entrée, elle ne résout RIEN. C'est la règle
//    qui existait déjà pour driftUnit — étendue à mode et threshold.
//
// ⚠️ ASYMÉTRIE VOLONTAIRE, mesurée, à NE PAS « corriger » : la source `skill`
//    SAUTE l'étage ③ et son défaut framework est `once` (les docs : `smart`).
//    Un skill est un savoir de projet — le charger une fois suffit ; une doc est
//    un rappel de geste. Les uniformiser ferait basculer TOUS les skills à la
//    première config globale posée = régression silencieuse (contrat §6).
const DEFAUTS_FRAMEWORK = { skill: { mode: 'once', global: false }, '': { mode: 'smart', global: true } };
function reglesDe(source) {
  return DEFAUTS_FRAMEWORK[source] || DEFAUTS_FRAMEWORK[''];
}

// Étage ② : les défauts déclarés pour CETTE source. Absent = objet vide (fallback
// total — une catégorie non déclarée se comporte exactement comme avant).
function defaultsDe(config, source) {
  const d = config && config.defaults;
  const v = d && source ? d[source] : null;
  return v || {};
}

// Mode effectif pour UNE doc — cascade complète ci-dessus.
function modeForDoc(config, decl, source) {
  const regles = reglesDe(source);
  const cat = defaultsDe(config, source);
  if (decl && MODES.includes(decl.mode)) return decl.mode;
  if (MODES.includes(cat.mode)) return cat.mode;
  if (regles.global && config && MODES.includes(config.mode)) return config.mode;
  return regles.mode;
}

// Seuil effectif pour UNE doc : decl.threshold (posé par une SOURCE — ex. MCP,
// résolu depuis servers.{name}.threshold) > defaultThreshold global > 4.
// ⚠️ COMMENTAIRE CORRIGÉ LE 29/07/2026 — il affirmait l'INVERSE de la réalité et a
//    coûté un doute en session (« ma doc va-t-elle être rejetée ? »).
//    Il disait : « les docs FICHIER n'ont pas de threshold dans leur frontmatter
//    (clé inconnue = frontmatter rejeté) ». C'était vrai AVANT le 17/07/2026 ;
//    depuis, `threshold` est une clé ADMISE du frontmatter fichier (validée par
//    frontmatter.js : entier ≥ 1) et arrive donc bien jusqu'ici dans `decl`.
//    VÉRIFIÉ en direct : `{mode:'smart', threshold:5}` → validate() = [] et
//    thresholdForDoc rend 5 (4 sans la clé).
//    ⚠️ `threshold` n'a d'effet QUE si `mode: smart` — en `dumb`/`once` le compteur
//    n'est jamais consommé (cf plus bas), donc le seuil est MORT EN SILENCE.
//    Cette incohérence n'est encore détectée par AUCUN gate (tracé EVAL-SESSIONS).
// ⚠️ 04/08/2026 : étage ② (defaults.{source}) inséré — MÊME cascade que mode.
//    Un threshold vaut à son étage s'il est un entier ≥ 1, sinon on DESCEND
//    (fallback total : une valeur invalide ne fait jamais planter, elle s'ignore).
function thresholdForDoc(config, decl, source) {
  const cat = defaultsDe(config, source);
  if (decl && Number.isInteger(decl.threshold)) return decl.threshold;
  if (Number.isInteger(cat.threshold) && cat.threshold >= 1) return cat.threshold;
  return Number.isInteger(config && config.defaultThreshold) ? config.defaultThreshold : 4;
}

// Unité du compteur `smart` pour UNE doc — CASCADE 3 AUTORITÉS (miroir exact de
// mode/threshold) : decl (l'entrée : frontmatter/skill, posée par la source) >
// `defaultDriftUnit` global (JSON) > défaut FRAMEWORK 'tool' (existe même sans
// aucune config). `tool` = comportement historique À L'IDENTIQUE (compteur
// sinceLastCall) — les différentiels de parité ne voient RIEN changer.
// `turn` = compare le compteur de tours de session (porte turn-count.js).
// ⚠️ Dégénéré hors de smart : dumb/once n'appellent jamais cette valeur.
function driftUnitForDoc(config, decl, source) {
  const cat = defaultsDe(config, source);
  if (decl && DRIFT_UNITS.includes(decl.driftUnit)) return decl.driftUnit;
  if (DRIFT_UNITS.includes(cat.driftUnit)) return cat.driftUnit;
  return DRIFT_UNITS.includes(config && config.defaultDriftUnit) ? config.defaultDriftUnit : 'tool';
}

// ═══════════════════════════════════════════════════════════════════════
// `enforce` (05/08/2026) — ARRÊTER le geste, au lieu de seulement l'informer.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI CE MOT EXISTE — fait de doc officielle, mesuré le 04/08/2026 :
//    l'`additionalContext` d'un PreToolUse arrive « next to the tool result »,
//    donc APRÈS l'exécution. Une injection NE PEUT PAS empêcher le geste
//    qu'elle vise, elle protège le suivant. L'incident fondateur du framework
//    (un clic de paiement réel) n'aurait PAS été évité par une doc injectée.
//    Seul un refus le fait. C'est le seul trou que la cadence ne bouchait pas.
//
// ⚠️ RESTE L'EXCEPTION, JAMAIS LA RÈGLE : « l'injection informe, ne bloque
//    jamais » demeure le DÉFAUT (absent ⇒ comportement d'avant à l'octet).
//    Un rappel de confort qui bloque rend le système insupportable, et un
//    système qu'on subit finit débranché — on perdrait TOUTES les règles.
//
// ⚠️ CE N'EST PAS UNE SÉCURITÉ, c'est un GARDE-FOU. La porte est fail-open par
//    contrat : hook mort ⇒ l'outil passe. Ça protège d'un agent distrait,
//    jamais d'un adversaire. Ne jamais le présenter autrement.
//
// Cascade IDENTIQUE aux autres réglages (entrée > defaults.{source} > défaut
// framework `false`). ⚠️ PAS d'étage GLOBAL : un `enforce` global bloquerait le
// premier geste de chaque session sur chaque doc — le système qu'on débranche.
// `false` explicite ANNULE l'héritage : sans lui, une catégorie passée en
// enforce serait INDÉSINSCRIPTIBLE (impasse classique des cascades).
function enforceForDoc(config, decl, source) {
  const cat = defaultsDe(config, source);
  if (decl && typeof decl.enforce === 'boolean') return decl.enforce;
  if (typeof cat.enforce === 'boolean') return cat.enforce;
  return false;
}

// `enforce` SUIT LA CADENCE — il n'a AUCUN rythme à lui (05/08/2026).
// Le blocage a lieu quand la doc s'injecte : même condition, un seul axe.
// C'est ce qui garde le mot minuscule, et TOUS les modes utilisables :
//   `once`  → un blocage, puis plus rien de la session.
//   `smart` → un blocage, passage, puis un nouveau blocage après N appels.
//   `dumb`  → blocage / passage / blocage / passage… en alternance.
//
// ⚠️ AUCUN mode n'est interdit, et ce n'est PAS un oubli : la garantie
//    anti-boucle ne vient pas d'un filtre sur le mode mais de l'ALTERNANCE
//    (drapeau `denied`, cf `decide`). Un blocage n'est jamais suivi d'un
//    blocage — donc l'agent peut TOUJOURS refaire son geste au coup suivant.
//    Filtrer `dumb` ici serait redondant ET amputerait le langage.
function bloqueForDoc(config, decl, source) {
  return enforceForDoc(config, decl, source);
}

/**
 * LA décision de la porte. PURE — ne mute AUCUN argument.
 *
 * @param {object} config  - ctxroute-config.json (mode, defaultThreshold, confirm…)
 * @param {object} decls   - { [doc]: frontmatter } de TOUT le corpus (modes des
 *                           docs « étrangères » nécessaires aux compteurs smart).
 * @param {string[]} matched - docs matchées par la source, ORDRE = ordre d'injection.
 * @param {string} toolName
 * @param {object} state   - { [doc]: { seen, sinceLastCall, turn? } } AVANT cet appel.
 * @param {number} [turnCount] - compteur de TOURS de la session (porte
 *                           turn-count.js, UserPromptSubmit). CONTRAT : l'appelant
 *                           passe un entier (0 si inconnu/illisible) — jamais de
 *                           garde ici (mutant équivalent). Consommé UNIQUEMENT
 *                           par les docs smart à driftUnit 'turn'.
 * @returns {{ decision: 'none'|'allow'|'ask', inject: string[], state: object, changed: boolean }}
 *
 * ⚠️ `changed` = le state a RÉELLEMENT bougé — un corpus 100% dumb ne produit
 *    JAMAIS d'écriture (parité perf avec protect-files, qui n'a aucun état).
 */
function decide(config, decls, matched, toolName, state, turnCount, owners) {
  const prev = state || {};
  // ⚠️ Source PROPRIÉTAIRE de chaque doc (acc.owner, posé par l'adaptateur) —
  //    seule entrée de l'étage ② de la cascade. ABSENT = cascade d'AVANT à
  //    l'identique (parité : les différentiels ne voient rien changer).
  const src = (doc) => (owners ? owners[doc] : undefined);
  const matchedSet = new Set(matched);
  const next = {};
  let changed = false;

  // ⚠️ COMPTEURS INDÉPENDANTS PAR DOC (même doctrine que legacy-mcp-inject.js par
  //    serveur) : cet appel est « étranger » à toute doc déjà vue NON matchée
  //    ici — son compteur n'avance QUE si SON mode est smart.
  // ⚠️ PAS de garde `entry.sinceLastCall || 0` ni `entry.seen` ici : les entrées
  //    de state sont TOUJOURS écrites par decide() comme { seen: true, sinceLastCall: n }
  //    — une garde sur un état qu'on est seul à écrire = mutant équivalent.
  // ⚠️ Le compteur d'outils étrangers n'avance QUE pour l'unité 'tool' : une
  //    doc à driftUnit 'turn' mesure son écoulement via turnCount (aucun état à
  //    incrémenter ici) — l'incrémenter quand même = écritures disque mortes.
  for (const doc of Object.keys(prev)) {
    const entry = prev[doc];
    if (!matchedSet.has(doc) && entry && modeForDoc(config, decls[doc], src(doc)) === 'smart'
      && driftUnitForDoc(config, decls[doc], src(doc)) === 'tool') {
      next[doc] = { seen: true, sinceLastCall: entry.sinceLastCall + 1 };
      changed = true;
    } else {
      next[doc] = entry;
    }
  }

  // Décision PAR DOC sur l'état d'AVANT (non affecté par cet appel), puis
  // remise à zéro de son compteur — matchée = « rappelée », injectée ou pas.
  const inject = [];
  // Docs qui REFUSENT le geste à CET appel (alternance : cf plus bas).
  const bloquees = [];
  for (const doc of matched) {
    // ⚠️ Pas d'objet par défaut `|| { seen: false, … }` : mutant ObjectLiteral
    //    équivalent ({} donne les mêmes falsy). Les ternaires sur `entry` suffisent.
    const entry = prev[doc];
    // ⚠️ UN SEUL point de décision smart : l'écoulement (`since`) est mesuré
    //    dans l'UNITÉ de la doc — 'tool' = compteur sinceLastCall (historique),
    //    'turn' = tours écoulés depuis la dernière livraison (turnCount - entry.turn).
    //    shouldInjectFor reste l'UNIQUE juge (jamais un smart dupliqué par unité).
    const since = driftUnitForDoc(config, decls[doc], src(doc)) === 'turn'
      ? (entry ? turnCount - entry.turn : 0)
      : (entry ? entry.sinceLastCall : 0);
    const injecte = shouldInjectFor(modeForDoc(config, decls[doc], src(doc)), entry ? entry.seen : false, since, thresholdForDoc(config, decls[doc], src(doc)));
    if (injecte) inject.push(doc);
    // ── ALTERNANCE DU BLOCAGE (05/08/2026) ────────────────────────────
    // 🛑 RÈGLE UNIVERSELLE : **un blocage n'est JAMAIS suivi d'un blocage.**
    //    Le geste que l'agent refait juste après passe TOUJOURS, quel que soit
    //    le mode ; ensuite la cadence reprend son cours normal.
    //    C'est ça, et rien d'autre, qui rend la boucle infinie impossible —
    //    donc `dumb` devient légitime lui aussi (bloque, passe, bloque, passe).
    // ⚠️ Ne pas confondre avec « la doc n'est plus injectée » : en `dumb` elle
    //    est réinjectée à chaque appel, c'est seulement le REFUS qui alterne.
    if (injecte && bloqueForDoc(config, decls[doc], src(doc)) && !(entry && entry.denied === true)) {
      bloquees.push(doc);
    }
    // ⚠️ N'écrire l'état QUE si le mode le consomme : une doc `dumb` injecte
    //    toujours et ne lit jamais seen/sinceLastCall — la tracker serait une
    //    écriture disque par appel pour rien (le corpus migré est 100% dumb).
    // ⚠️ Une doc `enforce` DOIT écrire son état MÊME en `dumb` : c'est le
    //    drapeau `denied` qui garantit l'alternance. Sans lui, dumb rebloquerait
    //    sans fin. Les docs sans `enforce` gardent le comportement d'AVANT à
    //    l'octet (aucune écriture en dumb) — parité intacte, différentiels verts.
    const enf = enforceForDoc(config, decls[doc], src(doc));
    if (modeForDoc(config, decls[doc], src(doc)) !== 'dumb' || enf) {
      // `turn` mémorisé à CHAQUE rappel = horodatage « dernière livraison »,
      // shape d'état UNIQUE (jamais 2 formes selon l'unité). En unité 'tool'
      // pur (turnCount=0 constant), `entry.turn !== turnCount` ne déclenche
      // JAMAIS d'écriture supplémentaire — parité perf intacte.
      next[doc] = { seen: true, sinceLastCall: 0, turn: turnCount };
      // ⚠️ `denied` n'existe QUE sur les docs enforce : la shape des autres ne
      //    bouge pas d'un octet (les différentiels de parité comparent l'état).
      if (enf) next[doc].denied = bloquees.includes(doc);
      if (!entry || entry.sinceLastCall !== 0 || entry.turn !== turnCount
        || (enf && entry.denied !== next[doc].denied)) changed = true;
    }
  }

  // ask UNIQUEMENT si un outil d'écriture ET au moins une doc INJECTÉE demande
  // confirmation (confirmFor : config.confirm === false = rush → tout allow).
  // ⚠️ `deny` PRIME sur tout : une doc qui doit ARRÊTER le geste ne peut pas être
  //    dégradée en simple demande de confirmation. L'ordre est deny > ask > allow.
  //    Et il n'y a rien à décider quand rien n'est injecté : bloquer sans livrer
  //    le savoir serait un mur muet — le pire des deux mondes.
  const decision = inject.length === 0
    ? 'none'
    : bloquees.length > 0
      ? 'deny'
      : WRITE_TOOLS.includes(toolName) && inject.some((doc) => confirmFor(config, decls[doc] || {}))
        ? 'ask'
        : 'allow';

  return { decision, inject, state: next, changed };
}

// Label court d'une doc injectée (systemMessage user-only) — RÉPLIQUE EXACTE du
// docLabel de protect-files.js (PREMIER tag [source: …] sinon titre markdown,
// '' si rien). ⚠️ Parité avant justesse : même si le PREMIER marqueur peut venir
// du CONTENU d'une doc (61 mesurées), on garde le comportement de l'ancien —
// « améliorer » le label = changement de comportement livré en douce (décision 8).
function docLabel(doc) {
  // ⚠️ Pas de `|| ''` avant String() : String(null) = 'null' ne matche ni tag ni
  //    titre → même sortie '' — la garde serait un mutant équivalent.
  const s = String(doc);
  const src = s.match(/\[source:\s*([^\]]+)\]/);
  if (src) return src[1].split(/[\\/]/).pop().replace(/\.md$/, '');
  const title = s.match(/^#\s*(.+)$/m);
  return title ? title[1].slice(0, 40) : '';
}

module.exports = { decide, docLabel, WRITE_TOOLS, modeForDoc, thresholdForDoc, driftUnitForDoc, enforceForDoc, bloqueForDoc };
