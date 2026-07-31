// ═══════════════════════════════════════════════════════════════════════
// COLLECTE — SOURCE UNIQUE de « quelles docs pour ce payload ? »
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ EXTRAIT de porte-core.js le 31/07/2026 pour `explain.js`. RAISON EXACTE :
//    l'outil d'introspection DOIT interroger EXACTEMENT ce que la porte
//    exécute. Une 2ᵉ implémentation de la collecte divergerait — et c'est
//    PRÉCISÉMENT le bug qu'`explain` existe pour rendre impossible
//    (REFACTOR-PLAN §E : une session entière perdue à réimplémenter le
//    moteur à la main, 3 sondes fausses, une conclusion FAUSSE sur le moteur).
//    Deux appelants, un seul code : la divergence n'a plus d'endroit où naître.
//
// ⚠️ ZÉRO DÉCISION ICI. La collecte pose les CANDIDATS ; `gate.js` tranche
//    (cadence, dédup, ask). Ne JAMAIS ajouter ici un filtre « pratique » :
//    la porte et l'explain verraient deux réalités, ce qui est le seul
//    échec que cet outil ne pourrait pas rattraper.
//
// ⚠️ L'ORDRE du registre ADAPTERS est SIGNIFIANT (ordre de concaténation,
//    et dépendance file→tool : toolAdapter réutilise acc.decls/bodies posés
//    par fileAdapter). Itérer ADAPTERS tel quel, jamais une copie triée.
//
// ⚠️ I/O assumée (les adaptateurs lisent le parc) : ce module n'est donc
//    JAMAIS muté par Stryker et n'est importé par AUCUN module pur.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const { ADAPTERS } = require('./source-adapters');
const paths = require('./paths');

// Config utilisateur — fail-open : absente/illisible = défauts du framework
// (comportement identique à la porte : le framework reste ACTIF sans config).
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(paths.configPath(), 'utf8'));
  } catch {
    return {};
  }
}

// Accumulateur vide au CONTRAT du registre (cf source-adapters.js en-tête).
function emptyAcc() {
  return { matched: [], decls: {}, bodies: {}, labels: {}, owner: {}, meta: {} };
}

/**
 * Collecte TOUTES les sources pour un payload donné.
 * @param {object} config  - config utilisateur (loadConfig()).
 * @param {object} payload - { toolName, toolInput, cwd } — shape NEUTRE,
 *                           jamais le payload brut d'un harnais (les sources
 *                           ne connaissent aucun dialecte, gate CI).
 * @returns {object} acc - { matched, decls, bodies, labels, owner, meta }
 */
function collectAll(config, payload) {
  const acc = emptyAcc();
  for (const a of ADAPTERS) a.collect(config, payload, acc);
  return acc;
}

module.exports = { collectAll, loadConfig, emptyAcc };
