// ═══════════════════════════════════════════════════════════════════════
// migrate.js — NOYAU PUR de la migration protected-paths.json → frontmatter
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O (gate `migrate-must-stay-pure`). `migrate-to-frontmatter.js` = la
//    coquille I/O (lit/écrit les fichiers) ; TOUTE la décision vit ICI.
//    Extrait le 15/07/2026 après audit doctrine : la logique de migration vivait
//    dans le script I/O, donc INTESTABLE unitairement et INVISIBLE à Stryker.
//
// ⚠️ CE MODULE ÉCRIRA DANS 288 DOCS RÉELLES. C'est le SEUL composant du refactor
//    qui MUTE les fichiers du mainteneur. Une erreur ici = des docs mortes en silence —
//    exactement la classe de bug que ce refactor prétend tuer.
//    D'où : property round-trip (`parse(serialize(x)) === x`) + property de
//    convergence (rejouer = zéro action) OBLIGATOIRES, jamais négociables.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ ORDRE FIGÉ des clés — `rank` DOIT rester dérivé de l'index JSON d'origine :
//    l'ordre d'injection parent→enfant vit aujourd'hui dans l'ordre des LIGNES de
//    protected-paths.json. Renuméroter « proprement » réordonnerait des docs
//    concaténées et casserait leur sens SANS RIEN AFFICHER.
const CLES = ['match', 'rules', 'scope', 'exclude', 'mode', 'rank'];

function serializeValue(k, v) {
  // ⚠️ `rules` = JSON inline (contrepartie EXACTE du JSON.parse de frontmatter.js).
  //    Le format liste `[a, b]` ne survivrait pas au round-trip (objets imbriqués).
  if (k === 'rules') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  return String(v);
}

/**
 * Sérialise une déclaration en bloc frontmatter. PUR.
 * ⚠️ Contrepartie EXACTE de `frontmatter.parse()` — paire encode↔decode.
 *    Toute modif ici SANS relancer la property round-trip = 288 docs muettes.
 */
function serialize(decl) {
  const lignes = ['---'];
  for (const k of CLES) {
    if (decl[k] === undefined) continue;
    lignes.push(`${k}: ${serializeValue(k, decl[k])}`);
  }
  lignes.push('---', '');
  return lignes.join('\n');
}

/**
 * Regroupe les règles par doc. PUR.
 * ⚠️ Une même doc peut être visée par PLUSIEURS règles (mesuré : 98 des 288).
 *    `rank` = index de la PREMIÈRE règle — c'est elle qui gagne le dédup côté
 *    moteur (« première gagnante »), donc c'est SON rang qui fait foi.
 */
function grouper(rules) {
  const parDoc = new Map();
  if (!Array.isArray(rules)) return parDoc;
  rules.forEach((r, i) => {
    if (!r || typeof r.doc !== 'string' || typeof r.pattern !== 'string') return;
    if (!parDoc.has(r.doc)) parDoc.set(r.doc, { rank: i, entries: [], idxs: [] });
    parDoc.get(r.doc).entries.push(r);
    parDoc.get(r.doc).idxs.push(i);
  });
  return parDoc;
}

/**
 * Construit la déclaration d'une doc. PUR.
 *    La migration PRÉSERVE le comportement, elle ne le juge pas. Le tri
 *    « qui mérite un ask » est un chantier SÉPARÉ, humain, plus tard.
 *
 * ⚠️ `mode: 'dumb'` TOUJOURS — MÊME RAISON, et ce n'est PAS un défaut esthétique.
 *    protect-files.js n'a AUCUN dédup : il réinjecte à CHAQUE appel d'outil.
 *    `dumb` est la SEULE valeur qui reproduit ça. Omettre `mode` ferait tomber
 *    les 288 docs sur le mode global (`smart`) → « injectée une fois, puis
 *    seulement sur dérive » = changement de comportement MASSIF, silencieux,
 *    livré en douce dans un refactor de FORMAT. Un doc critique (VPS, prod)
 *    serait livré une fois puis oublié 200 tours plus tard.
 *    ⚠️ NE JAMAIS « optimiser les tokens » ici : migrer et changer le
 *    comportement dans le MÊME geste rend toute régression indébuggable
 *    (lequel des deux a cassé ?). Le passage de docs en `smart` est un
 *    chantier SÉPARÉ, doc par doc, humain, APRÈS bascule.
 */
function declaration(entries, rank, interleaved, idxs) {
  // ⚠️ DIVERGENCE scope/exclude INTRA-DOC — MESURÉ le 16/07/2026 : 31 docs sur 103
  //    multi-règles ont des scopes/excludes DIFFÉRENTS entre leurs règles. L'ancienne
  //    version prenait entries[0] → sur-injection OU doc morte, EN SILENCE, sur 31 docs.
  //    Divergent → `rules:` (JSON par-entrée, fidélité absolue) ; homogène → `match:`.
  const cle = (e) => JSON.stringify([e.scope || null, e.exclude || null]);
  const divergent = entries.some((e) => cle(e) !== cle(entries[0]));

  // ⚠️ ENTRELACEMENT (mesuré 16/07/2026 : 23 docs) : des règles d'AUTRES docs vivent
  //    ENTRE les règles de celle-ci dans le JSON. Un rank de groupe inverserait
  //    l'ordre d'évaluation (1 divergence réelle : web-realtime/web-front) →
  //    chaque entrée garde SON index JSON en `rank` par-entrée. Le loader trie
  //    par RÈGLE, pas par doc, et reproduit le JSON à l'identique par construction.
  if (divergent || interleaved) {
    const rules = entries.map((e, i) => {
      const r = { pattern: e.pattern };
      if (Array.isArray(e.scope) && e.scope.length) r.scope = e.scope;
      if (Array.isArray(e.exclude) && e.exclude.length) r.exclude = e.exclude;
      if (interleaved && Array.isArray(idxs)) r.rank = idxs[i];
      return r;
    });
    return { rules, mode: 'dumb', rank };
  }

  const decl = {
    match: entries.length === 1 ? entries[0].pattern : entries.map((e) => e.pattern),
    mode: 'dumb',
    rank,
  };
  const scope = entries[0].scope;
  const exclude = entries[0].exclude;
  if (Array.isArray(scope) && scope.length) decl.scope = scope;
  if (Array.isArray(exclude) && exclude.length) decl.exclude = exclude;
  return decl;
}

/**
 * LE PLAN de migration. PUR — décide, n'écrit rien.
 *
 * @param {Array} rules      - règles de protected-paths.json (ordre SIGNIFIANT)
 * @param {object} etat      - { existe(doc):bool, aDejaFrontmatter(doc):bool }
 * @returns {{actions:Array, deja:string[], morts:string[]}}
 *
 * ⚠️ IDEMPOTENT PAR CONSTRUCTION : une doc qui a déjà un frontmatter n'est JAMAIS
 *    replanifiée → rejouer converge vers ZÉRO action. Scellé par une property de
 *    convergence. Sans ça, un crash à mi-course puis un rejeu doublerait des
 *    frontmatters — corruption silencieuse de docs réelles.
 * ⚠️ Une règle dont le .md n'existe pas est SIGNALÉE (`morts`), jamais créée :
 *    inventer un .md vide masquerait un des 2 bugs que ce refactor tue.
 */
function planifier(rules, etat) {
  const parDoc = grouper(rules);
  const actions = [];
  const deja = [];
  const morts = [];

  for (const [doc, { rank, entries, idxs }] of parDoc) {
    if (!etat.existe(doc)) {
      morts.push(doc);
      continue;
    }
    if (etat.aDejaFrontmatter(doc)) {
      deja.push(doc);
      continue;
    }
    // ENTRELACÉE = des règles d'AUTRES docs vivent entre min et max de celle-ci.
    // (span > nombre d'entrées ⇔ au moins un index intermédiaire appartient à autrui)
    const interleaved = idxs[idxs.length - 1] - idxs[0] + 1 > idxs.length;
    actions.push({ doc, frontmatter: serialize(declaration(entries, rank, interleaved, idxs)) });
  }
  return { actions, deja, morts };
}

module.exports = { serialize, grouper, declaration, planifier, CLES };
