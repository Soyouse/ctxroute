// ═══════════════════════════════════════════════════════════════════════
// COLLISIONS — NOYAU PUR : croisements de règles du parc (analyse, pas gate).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ INTÉGRÉ AU MOTEUR le 17/07/2026 (remplace ~/.claude/hooks/check-collisions.js
//    qui lisait protected-paths.json — le transitoire). Source = les règles
//    plates du loader (frontmatters), la SEULE vérité pérenne.
//
// ⚠️ ANALYSE INFORMATIVE, JAMAIS UN GATE : un croisement n'est PAS décidable
//    par machine (parent/enfant légitime vs doublon = sémantique des docs).
//    Ce module TRIE (3 niveaux) pour réduire la charge cognitive — le verdict
//    final revient à un AGENT (0-human : la machine trie, un LLM tranche, jamais le mainteneur). NE JAMAIS le brancher en fail-closed.
//
// ⚠️ PUR (gate `collisions-must-stay-pure`) : la coquille check-collisions.js
//    lit le disque. Condition pour muter par Stryker sans mutants équivalents.
//
// ⚠️ `excludeNeutralizes` DOIT rester aligné sur la sémantique `.includes()`
//    path-only de sources/file.js (exclude matché contre le path seul).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// Même normalisation que le moteur de match (backslash + casse).
const norm = (s) => (s == null ? '' : String(s)).replace(/\\/g, '/').toLowerCase();

const isFolderPattern = (p) => norm(p).endsWith('/');

// P court strictement inclus dans P long → tout fichier matchant le long
// matche aussi le court (2 docs injectées ensemble).
function isContained(short, long) {
  const s = norm(short);
  const l = norm(long);
  return s !== l && l.includes(s);
}

// Scopes disjoints = jamais injectées ensemble. Absence de scope = global.
function scopesOverlap(a, b) {
  const sa = Array.isArray(a.scope) && a.scope.length > 0 ? a.scope.map(norm) : null;
  const sb = Array.isArray(b.scope) && b.scope.length > 0 ? b.scope.map(norm) : null;
  if (sa === null || sb === null) return true;
  return sa.some((s) => sb.includes(s));
}

// L'exclude du parent (pattern court) couvre le pattern enfant → le parent est
// TOUJOURS skip sur les fichiers de l'enfant → collision neutralisée.
function excludeNeutralizes(parent, child) {
  // ⚠️ PAS de garde `length === 0` : some([]) vaut déjà false — une garde
  //    redondante = mutant équivalent (éviter par construction).
  if (!Array.isArray(parent.exclude)) return false;
  const cp = norm(child.pattern);
  return parent.exclude.some((ex) => cp.includes(norm(ex)));
}

// Stryker disable StringLiteral: les `hint` sont de la COMMUNICATION (le tri
// vit dans `classification`) — les muter = mutants équivalents, cf frontmatter.js.
/**
 * @param {Array<{pattern, doc, scope?, exclude?}>} rules - règles plates (loader).
 * @returns {Array<{classification, pattern_a, doc_a, scope_a, pattern_b, doc_b, scope_b, hint}>}
 *   classification : 'probable_parent_child' | 'ambiguous' | 'potential_duplicate'.
 */
function findCollisions(rules) {
  const collisions = [];
  // forEach (pas un for indexé) : une borne `<=` mutée serait ÉQUIVALENTE
  // (itération fantôme sans corps) — classe de mutant retirée par construction.
  rules.forEach((a, i) => {
    for (let j = i + 1; j < rules.length; j++) {
      const b = rules[j];
      // Deux patterns d'une MÊME doc = design multi-patterns, jamais un croisement.
      if (a.doc === b.doc) continue;

      let kind = null;
      let p1 = a;
      let p2 = b;
      if (isContained(a.pattern, b.pattern)) {
        kind = 'containment';
      } else if (isContained(b.pattern, a.pattern)) {
        kind = 'containment';
        p1 = b;
        p2 = a;
      } else if (norm(a.pattern) === norm(b.pattern)) {
        kind = 'same-pattern';
      }
      if (!kind) continue;
      if (!scopesOverlap(p1, p2)) continue;
      if (kind === 'containment' && excludeNeutralizes(p1, p2)) continue;

      let classification;
      let hint;
      if (kind === 'containment' && isFolderPattern(p1.pattern)) {
        classification = 'probable_parent_child';
        hint = `Le pattern dossier "${p1.pattern}" englobe "${p2.pattern}". Souvent légitime (contexte parent + détail enfant injectés ensemble).`;
      } else if (kind === 'containment') {
        classification = 'ambiguous';
        hint = `Pattern "${p1.pattern}" strictement inclus dans "${p2.pattern}". Doublon ou parent/enfant intentionnel ?`;
      } else {
        classification = 'potential_duplicate';
        hint = `Deux docs avec pattern identique "${p1.pattern}" et scopes recoupables. À trancher par un agent (0-human).`;
      }
      collisions.push({
        classification,
        pattern_a: p1.pattern,
        doc_a: p1.doc,
        scope_a: p1.scope || null,
        pattern_b: p2.pattern,
        doc_b: p2.doc,
        scope_b: p2.scope || null,
        hint,
      });
    }
  });
  return collisions;
}
// Stryker restore StringLiteral

// Briques exportées pour test DIRECT (perTest : muter norm/overlap sans passer
// par findCollisions — appliquées aux 2 côtés des comparaisons, leurs mutants
// y seraient invisibles). Pas une API publique : la porte n'importe que findCollisions.
module.exports = { findCollisions, norm, isContained, scopesOverlap, excludeNeutralizes, isFolderPattern };
