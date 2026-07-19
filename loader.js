// ═══════════════════════════════════════════════════════════════════════
// LOADER — PUR. Corpus de docs (frontmatters) -> règles ordonnées pour la source fichier.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O (gate `loader-must-stay-pure`). L'appelant lit les fichiers et passe
//    [{ doc, text }] ; ce module décide. Même doctrine que lib-pure/sources/frontmatter.
//
// ⚠️ C'EST LA PIÈCE QUI REMPLACE protected-paths.json APRÈS BASCULE : il reconstruit,
//    depuis les frontmatters écrits par la migration du 16/07/2026, la liste plate de
//    règles que `sources/file.js` consomme. Toute divergence d'ORDRE ou de CONTENU avec
//    le JSON = régression silencieuse → scellé par `loader-differential.test.js`
//    (in-process, corpus dérivé des vraies règles) PUIS par le shadow (vrai trafic).
//
// ⚠️ ORDRE : tri par `rank` croissant (l'ordre parent→enfant hérité de l'index JSON,
//    mesuré puis conservé — cf REFACTOR-PLAN). Docs SANS rank (créées après la
//    migration) : APRÈS toutes les rankées, ordre alphabétique (déterministe, décision
//    gravée au plan le 16/07/2026). À rank égal, alphabétique aussi (stable cross-fs).
//
// ⚠️ FAIL-OPEN doc par doc : une doc sans frontmatter, invalide, ou déclenchée
//    autrement (`mcp:`, `inject: never`) est simplement IGNORÉE ici — jamais un throw
//    (un .md malformé ne doit jamais tuer l'injection des 301 autres). La détection
//    BRUYANTE des docs invalides = le rôle du lint (SessionStart), pas du chemin chaud.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { parse, validate } = require('./frontmatter');

// Une déclaration -> ses règles plates { pattern, doc, scope?, exclude? }.
// ⚠️ Reproduit EXACTEMENT la sémantique inverse de migrate.declaration() :
//    `match` + scope/exclude de doc (homogène) OU `rules` par-entrée (divergent).
function rulesOfDecl(data, doc) {
  if (Array.isArray(data.rules)) {
    return data.rules.map((r) => {
      const out = { pattern: r.pattern, doc };
      if (Array.isArray(r.scope) && r.scope.length) out.scope = r.scope;
      if (Array.isArray(r.exclude) && r.exclude.length) out.exclude = r.exclude;
      // rank PAR ENTRÉE (docs entrelacées) : la règle porte son index JSON exact.
      if (typeof r.rank === 'number') out.rank = r.rank;
      return out;
    });
  }
  if (data.match === undefined) return [];
  const patterns = Array.isArray(data.match) ? data.match : [data.match];
  return patterns.map((p) => {
    const out = { pattern: String(p), doc };
    if (Array.isArray(data.scope) && data.scope.length) out.scope = data.scope;
    if (Array.isArray(data.exclude) && data.exclude.length) out.exclude = data.exclude;
    return out;
  });
}

/**
 * Corpus -> règles plates ordonnées, prêtes pour matchingDocs().
 * @param {Array<{doc: string, text: string}>} docs - contenu brut de chaque .md
 * @returns {Array<{pattern, doc, scope?, exclude?}>}
 */
function rulesFromCorpus(docs) {
  if (!Array.isArray(docs)) return [];
  const groupes = [];
  for (const d of docs) {
    // ⚠️ PAS de check sur d.text : parse() est TOTAL (non-string → data {} → validate
    //    rouge → skip). Ni de garde `hasFrontmatter` : même raison. Gardes redondantes
    //    = mutants équivalents — on les évite par construction, jamais on les tolère.
    if (!d || typeof d.doc !== 'string') continue;
    const { data } = parse(d.text);
    if (validate(data).length > 0) continue; // invalide = inerte ICI, ROUGE au lint.
    const rules = rulesOfDecl(data, d.doc);
    // ⚠️ PAS de garde `rules.length === 0` : un groupe vide n'émet rien au flatten —
    //    même sortie, garde en moins (doc `mcp:` seule / `inject: never` inoffensives).
    groupes.push({ rank: typeof data.rank === 'number' ? data.rank : Infinity, doc: d.doc, rules });
  }
  // ⚠️ TRI PAR RÈGLE, jamais par doc : 23 docs ENTRELACÉES (règles dispersées dans
  //    le JSON entre celles d'autres docs) — un tri par groupe inversait l'ordre
  //    d'évaluation (divergence réelle attrapée par le différentiel loader le 16/07).
  //    Rang effectif d'une règle = son `rank` propre (entrelacée), sinon celui du
  //    groupe. Tie-break : doc alpha (déterministe) puis ordre local déclaré.
  //    L'ordre LOCAL (entrées d'une même doc) est porté par la STABILITÉ du sort
  //    (garantie spec ES2019) — un tie-break `i` explicite serait redondant (= mutants
  //    équivalents). Deux docs SANS rank : Infinity-Infinity = NaN (falsy) → tie alpha.
  const flat = [];
  groupes.forEach((g) => {
    g.rules.forEach((r) => {
      flat.push({ r, rank: typeof r.rank === 'number' ? r.rank : g.rank, doc: g.doc });
    });
  });
  // Stryker disable next-line ConditionalExpression,EqualityOperator: la branche `> ? 1 : 0` est
  // structurellement INOBSERVABLE (prouvé 16/07/2026, 2 runs + analyse) : un tri par comparaison ne
  // consomme que la NÉGATIVITÉ (le `<` du sens inverse corrige toute paire mal ordonnée ; 0 vs 1
  // tombent du même côté de `< 0`). NE PAS « simplifier » la branche pour autant : un vrai 0 pour
  // des docs différents s'appuierait sur la stabilité au lieu de l'ordre — fragile au changement d'algo.
  flat.sort((a, b) => (a.rank - b.rank) || (a.doc < b.doc ? -1 : a.doc > b.doc ? 1 : 0));
  // Le rank d'entrée a servi au tri — la règle plate reste minimale. Destructuration
  // INCONDITIONNELLE : un `if (rank)` préalable serait un mutant équivalent (la copie
  // sans rank est identique quand il n'y en a pas).
  return flat.map(({ r }) => {
    const { rank, ...rest } = r;
    return rest;
  });
}

module.exports = { rulesFromCorpus, rulesOfDecl };
