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
const { DRIFT_UNITS } = require('./frontmatter');

// ⚠️ COPIE CONTRACTUELLE de la liste de protect-files.js (writeTools) — outils
//    d'ÉCRITURE qui déclenchent une confirmation quand une doc `confirm: true`
//    est injectée. Liste unifiée Claude + Codex. Épinglée EN DUR dans gate.test.js.
const WRITE_TOOLS = ['mcp__ssh__ssh_edit_file', 'mcp__ssh__ssh_write_file', 'mcp__ssh__ssh_upload_file', 'Edit', 'Write', 'apply_patch'];

// Mode effectif pour UNE doc : frontmatter (l'auteur propose) > mode global de
// la config > 'smart'. ⚠️ PAS d'override config par-doc aujourd'hui : l'utilisateur
// dispose via le mode GLOBAL et `confirm` — un `docs.{id}.mode` = feature sans
// douleur mesurée derrière (décision 6 du plan), ne pas l'ajouter « au cas où ».
function modeForDoc(config, decl) {
  return (decl && decl.mode) || (config && config.mode) || 'smart';
}

// Seuil effectif pour UNE doc : decl.threshold (posé par une SOURCE — ex. MCP,
// résolu depuis servers.{name}.threshold) > defaultThreshold global > 4.
// ⚠️ Les docs FICHIER n'ont pas de threshold dans leur frontmatter (clé
//    inconnue = frontmatter rejeté) : elles tombent toujours sur le global —
//    aucun changement de comportement pour le parc migré.
function thresholdForDoc(config, decl) {
  if (decl && Number.isInteger(decl.threshold)) return decl.threshold;
  return Number.isInteger(config && config.defaultThreshold) ? config.defaultThreshold : 4;
}

// Unité du compteur `smart` pour UNE doc — CASCADE 3 AUTORITÉS (miroir exact de
// mode/threshold) : decl (l'entrée : frontmatter/skill, posée par la source) >
// `defaultDriftUnit` global (JSON) > défaut FRAMEWORK 'tool' (existe même sans
// aucune config). `tool` = comportement historique À L'IDENTIQUE (compteur
// sinceLastCall) — les différentiels de parité ne voient RIEN changer.
// `turn` = compare le compteur de tours de session (porte turn-count.js).
// ⚠️ Dégénéré hors de smart : dumb/once n'appellent jamais cette valeur.
function driftUnitForDoc(config, decl) {
  if (decl && DRIFT_UNITS.includes(decl.driftUnit)) return decl.driftUnit;
  return DRIFT_UNITS.includes(config && config.defaultDriftUnit) ? config.defaultDriftUnit : 'tool';
}

/**
 * LA décision de la porte. PURE — ne mute AUCUN argument.
 *
 * @param {object} config  - mcp-doc-config.json (mode, defaultThreshold, confirm…)
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
function decide(config, decls, matched, toolName, state, turnCount) {
  const prev = state || {};
  const matchedSet = new Set(matched);
  const next = {};
  let changed = false;

  // ⚠️ COMPTEURS INDÉPENDANTS PAR DOC (même doctrine que mcp-doc-inject.js par
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
    if (!matchedSet.has(doc) && entry && modeForDoc(config, decls[doc]) === 'smart'
      && driftUnitForDoc(config, decls[doc]) === 'tool') {
      next[doc] = { seen: true, sinceLastCall: entry.sinceLastCall + 1 };
      changed = true;
    } else {
      next[doc] = entry;
    }
  }

  // Décision PAR DOC sur l'état d'AVANT (non affecté par cet appel), puis
  // remise à zéro de son compteur — matchée = « rappelée », injectée ou pas.
  const inject = [];
  for (const doc of matched) {
    // ⚠️ Pas d'objet par défaut `|| { seen: false, … }` : mutant ObjectLiteral
    //    équivalent ({} donne les mêmes falsy). Les ternaires sur `entry` suffisent.
    const entry = prev[doc];
    // ⚠️ UN SEUL point de décision smart : l'écoulement (`since`) est mesuré
    //    dans l'UNITÉ de la doc — 'tool' = compteur sinceLastCall (historique),
    //    'turn' = tours écoulés depuis la dernière livraison (turnCount - entry.turn).
    //    shouldInjectFor reste l'UNIQUE juge (jamais un smart dupliqué par unité).
    const since = driftUnitForDoc(config, decls[doc]) === 'turn'
      ? (entry ? turnCount - entry.turn : 0)
      : (entry ? entry.sinceLastCall : 0);
    if (shouldInjectFor(modeForDoc(config, decls[doc]), entry ? entry.seen : false, since, thresholdForDoc(config, decls[doc]))) inject.push(doc);
    // ⚠️ N'écrire l'état QUE si le mode le consomme : une doc `dumb` injecte
    //    toujours et ne lit jamais seen/sinceLastCall — la tracker serait une
    //    écriture disque par appel pour rien (le corpus migré est 100% dumb).
    if (modeForDoc(config, decls[doc]) !== 'dumb') {
      // `turn` mémorisé à CHAQUE rappel = horodatage « dernière livraison »,
      // shape d'état UNIQUE (jamais 2 formes selon l'unité). En unité 'tool'
      // pur (turnCount=0 constant), `entry.turn !== turnCount` ne déclenche
      // JAMAIS d'écriture supplémentaire — parité perf intacte.
      next[doc] = { seen: true, sinceLastCall: 0, turn: turnCount };
      if (!entry || entry.sinceLastCall !== 0 || entry.turn !== turnCount) changed = true;
    }
  }

  // ask UNIQUEMENT si un outil d'écriture ET au moins une doc INJECTÉE demande
  // confirmation (confirmFor : config.confirm === false = rush → tout allow).
  const decision = inject.length === 0
    ? 'none'
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

module.exports = { decide, docLabel, WRITE_TOOLS, modeForDoc, thresholdForDoc, driftUnitForDoc };
