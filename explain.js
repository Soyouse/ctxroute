#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// EXPLAIN — « pour CE geste, qu'est-ce qui s'injecte, et POURQUOI ? »
// ═══════════════════════════════════════════════════════════════════════
//
// RAISON D'ÊTRE (31/07/2026, REFACTOR-PLAN §E) : le langage revendiquait
// l'explicabilité comme feature centrale (« on peut TOUJOURS répondre à
// pourquoi ça s'est injecté ») et n'offrait AUCUN moyen de poser la
// question. COÛT MESURÉ : une session entière. Faute d'outil, l'agent a
// RÉIMPLÉMENTÉ le moteur à la main pour tester sa doc, s'est trompé 3 fois
// de harnais (mauvais nombre d'arguments, `{id,fm,body}` au lieu de
// `{doc,text}`), et chaque sonde fausse a produit un « muet » interprété
// comme un verdict SUR LE MOTEUR ⇒ conclusion FAUSSE « il faut modifier le
// moteur », défendue plusieurs fois avant d'être infirmée.
// ⚠️ La leçon n'est PAS « l'agent doit être plus rigoureux » (une consigne
//    en prose ne tient pas 40 sessions) : c'est que la seule façon
//    d'interroger le langage était de le RÉIMPLÉMENTER. Cet outil rend la
//    faute IMPOSSIBLE.
//
// ⚠️ IL NE DÉCIDE RIEN — lecture seule, hors chemin critique, ZÉRO écriture
//    d'état (le store de session n'est jamais touché : session NEUVE simulée).
//
// ⚠️ INVARIANT VITAL : il consomme les MÊMES fonctions que la porte
//    (collect-core → ADAPTERS → gate.decide). Le « pourquoi PAS » est obtenu
//    en RE-INTERROGEANT ces fonctions avec des variantes de la règle
//    (règle sans scope, règle sans exclude), JAMAIS en réimplémentant le
//    matching. Écrire ici une 2ᵉ logique de match recréerait EXACTEMENT le
//    bug que cet outil prévient. Si un motif manque, on ajoute une PROBE,
//    jamais une condition maison.
//
// USAGE :
//   node explain.js --tool Bash --input '{"command":"docker run -d nginx"}'
//   node explain.js --file C:/chemin/vers/gate.js
//   node explain.js --doc zone-declaration --tool Bash --input '{...}'
//   node explain.js --tool WebFetch --json
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { collectAll, loadConfig } = require('./collect-core');
const gate = require('./gate');
const { parse, validate, DECLENCHEURS } = require('./frontmatter');
const { readCorpus } = require('./corpus');
const { rulesFromCorpus } = require('./loader');
const fileSource = require('./sources/file');
const toolSource = require('./sources/tool');
const paths = require('./paths');

// ── ARGUMENTS ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { toolName: '', toolInput: {}, doc: null, json: false, cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--tool') { a.toolName = v || ''; i++; }
    else if (k === '--input') { try { a.toolInput = JSON.parse(v); } catch { a.bad = '--input n\'est pas du JSON valide'; } i++; }
    // Raccourci du cas le plus courant : « que reçoit un agent qui ouvre ce fichier ? »
    else if (k === '--file') { a.toolName = a.toolName || 'Read'; a.toolInput = { file_path: v }; i++; }
    else if (k === '--doc') { a.doc = v; i++; }
    else if (k === '--cwd') { a.cwd = v; i++; }
    else if (k === '--json') a.json = true;
  }
  return a;
}

// ── VERDICT : ce qui s'injecterait RÉELLEMENT (autorité = la porte) ─────
// ⚠️ state = {} : session NEUVE. Une session réelle a un état (once déjà
//    consommé, compteurs smart) — le dire, ne jamais le faire croire.
function verdict(config, payload) {
  const acc = collectAll(config, payload);
  const r = gate.decide(config, acc.decls, acc.matched, payload.toolName, {}, 0);
  return { acc, decision: r.decision, inject: r.inject };
}

// ── PROBES : le « pourquoi PAS », par ré-interrogation des vraies sources ──
// ⚠️ Chaque probe rappelle matchingDocs avec une règle AMPUTÉE d'un opérateur.
//    C'est une DÉCOMPOSITION de la vraie décision, pas une 2ᵉ implémentation.
function matcheAvec(rules, payload) {
  return fileSource.matchingDocs(rules, payload).length > 0;
}
const sansFiltres = (rules) => rules.map((r) => ({ pattern: r.pattern, doc: r.doc }));
const sansScope = (rules) => rules.map((r) => {
  const out = { pattern: r.pattern, doc: r.doc };
  if (r.exclude) out.exclude = r.exclude;
  return out;
});

// Contextes RÉELLEMENT confrontés aux patterns (mêmes fonctions que la source).
function contextesTestes(payload) {
  const { toolName, toolInput } = payload;
  const out = fileSource.extractFilePaths(toolName, toolInput).slice();
  const command = typeof toolInput.command === 'string' ? toolInput.command : '';
  if (toolName === 'Bash' && command) out.push(...fileSource.bashCandidates(command));
  return out;
}

// Diagnostic d'UNE doc du corpus fichier face à UN payload.
function diagnostiquer(docId, text, payload) {
  const { data: fm, body } = parse(text);
  const declares = DECLENCHEURS.filter((k) => k in fm);
  const base = { doc: docId, declares, fm };

  const errs = validate(fm);
  if (errs.length > 0) {
    return { ...base, injecte: false, motif: 'FRONTMATTER INVALIDE — le loader ignore la doc (loader.js), elle est morte pour TOUS les payloads', detail: errs };
  }
  if (fm.inject === 'never') {
    return { ...base, injecte: false, motif: 'SILENCE VOULU (`inject: never`) — doc de référence, jamais auto-injectée' };
  }
  if (body.trim() === '') {
    return { ...base, injecte: false, motif: 'CORPS VIDE après retrait du frontmatter — filtré par l\'adaptateur (parité protect-files)' };
  }

  // ── Axe FICHIER ──
  const rules = rulesFromCorpus([{ doc: docId, text }]);
  if (fileSource.matchingDocs(rules, payload).length > 0) {
    return { ...base, injecte: true, motif: 'MATCH par le chemin/la commande (`match`/`rules`)', axe: 'fichier' };
  }
  // ── Axe OUTIL ──
  if ('tool' in fm) {
    if (toolSource.matchingDocs([{ doc: docId, fm }], payload).length > 0) {
      return { ...base, injecte: true, motif: 'MATCH par le NOM D\'OUTIL (`tool`)', axe: 'outil' };
    }
    const noms = toolSource.toolList(fm);
    if (!noms.includes(payload.toolName)) {
      const d = { ...base, injecte: false, axe: 'outil', motif: `\`tool\` déclaré mais l'outil reçu n'y figure PAS — déclarés: ${JSON.stringify(noms)}, reçu: ${JSON.stringify(payload.toolName)}` };
      // ⚠️ Le piège n°1 mesuré le 31/07 : `*` est accepté par validate() et
      //    ne matche rien. Le NOMMER ici, sinon l'auteur accuse le moteur.
      if (noms.includes('*')) d.piege = '⚠️ `*` n\'est PAS un joker : les noms d\'outils sont comparés à l\'IDENTIQUE (===). Énumère les outils. Cible REFACTOR-PLAN §B.';
      return d;
    }
    // Le nom matche : c'est donc scope ou exclude qui a rejeté (axe outil,
    // où le « contexte » d'exclude est le NOM D'OUTIL — cf sources/tool.js).
    const nu = { ...fm };
    delete nu.scope; delete nu.exclude;
    if (toolSource.matchingDocs([{ doc: docId, fm: { ...fm, scope: undefined } }], payload).length > 0) {
      return { ...base, injecte: false, axe: 'outil', motif: `\`scope\` NON SATISFAIT — attend l'une de ${JSON.stringify(fm.scope)} dans les paramètres de l'outil` };
    }
    return { ...base, injecte: false, axe: 'outil', motif: `\`exclude\` a REJETÉ le nom d'outil — exclus: ${JSON.stringify(fm.exclude)}` };
  }

  // ── Aucun déclencheur consommable par ce corpus ──
  if (rules.length === 0) {
    const inertes = declares.filter((k) => k !== 'match' && k !== 'rules' && k !== 'tool');
    if (inertes.length > 0) {
      // ⚠️ Faux vert §A : `mcp:` est une clé CONNUE, donc validate() l'accepte,
      //    et AUCUNE source ne la consomme pour le corpus fichier.
      return { ...base, injecte: false, motif: `DÉCLENCHEUR INERTE ICI : \`${inertes.join('`/`')}\` n'est consommé par AUCUNE source du corpus fichier`, piege: 'Une doc MCP se déclenche par son CHEMIN (docs/mcp/{serveur}.md), jamais par une clé de frontmatter. Déplace le fichier. Cible REFACTOR-PLAN §A.' };
    }
    return { ...base, injecte: false, motif: 'AUCUN déclencheur exploitable' };
  }

  // ── Le pattern a-t-il matché avant les filtres ? ──
  const command = typeof payload.toolInput.command === 'string' ? payload.toolInput.command : '';
  if (payload.toolName === 'Bash' && /^\s*git\s+/.test(command)) {
    return { ...base, injecte: false, motif: 'COMMANDE GIT IGNORÉE PAR CONSTRUCTION (sources/file.js) — un nom de fichier dans un message de commit produirait un faux positif', piege: 'Teste avec une commande NON-git : le silence ici ne dit rien de ta règle.' };
  }
  if (!matcheAvec(sansFiltres(rules), payload)) {
    return { ...base, injecte: false, axe: 'fichier', motif: 'AUCUN PATTERN ne matche', detail: { patterns: rules.map((r) => r.pattern), contextesTestes: contextesTestes(payload) },
      piege: '⚠️ `match` regarde des CHEMINS (+ la commande du shell POSIX), JAMAIS tous les paramètres. Pour réagir à un GESTE : `tool` + `scope`.' };
  }
  if (!matcheAvec(sansScope(rules), payload)) {
    return { ...base, injecte: false, axe: 'fichier', motif: `\`exclude\` a REJETÉ le chemin — exclus: ${JSON.stringify(rules.map((r) => r.exclude).filter(Boolean))}` };
  }
  return { ...base, injecte: false, axe: 'fichier', motif: `\`scope\` NON SATISFAIT — attend l'une de ${JSON.stringify(rules.map((r) => r.scope).filter(Boolean))} dans les paramètres de l'outil` };
}

// ── CORPUS : retrouver une doc par fragment de nom ──────────────────────
function trouverDoc(fragment) {
  const n = String(fragment).replace(/\\/g, '/').toLowerCase();
  for (const d of readCorpus(paths.fileDocsDir(), 'docs/')) {
    if (d.doc.toLowerCase().includes(n)) return d;
  }
  return null;
}

// ── RENDU ──────────────────────────────────────────────────────────────
function rendre(a, res, diag) {
  const L = [];
  L.push('PAYLOAD');
  L.push('  outil  : ' + (a.toolName || '(aucun)'));
  L.push('  params : ' + JSON.stringify(a.toolInput));
  L.push('');
  if (diag) {
    L.push('DOC  ' + diag.doc);
    L.push('  déclencheurs : ' + (diag.declares.length ? diag.declares.join(', ') : '(aucun)'));
    L.push('  VERDICT      : ' + (diag.injecte ? '✓ INJECTÉE' : '✗ NON INJECTÉE'));
    L.push('  MOTIF        : ' + diag.motif);
    if (diag.detail) L.push('  DÉTAIL       : ' + JSON.stringify(diag.detail, null, 2).split('\n').join('\n                 '));
    if (diag.piege) L.push('  ' + diag.piege);
    L.push('');
  }
  L.push('INJECTÉ — ' + res.inject.length + ' doc(s)   [session NEUVE simulée : une session réelle a déjà consommé ses `once`]');
  for (const d of res.inject) {
    L.push('  ✓ ' + d + '   source=' + (res.acc.owner[d] || '?') + '   cadence=' + gate.modeForDoc(loadConfig(), res.acc.decls[d]));
  }
  const ecartes = res.acc.matched.filter((d) => !res.inject.includes(d));
  if (ecartes.length) {
    L.push('');
    L.push('MATCHÉ MAIS ÉCARTÉ PAR LA CADENCE — ' + ecartes.length);
    for (const d of ecartes) L.push('  ~ ' + d);
  }
  L.push('');
  L.push('DÉCISION : ' + res.decision);
  return L.join('\n');
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.bad) { console.error(a.bad); process.exit(2); }
  const config = loadConfig();
  const payload = { toolName: a.toolName, toolInput: a.toolInput, cwd: a.cwd };
  const res = verdict(config, payload);

  let diag = null;
  if (a.doc) {
    const found = trouverDoc(a.doc);
    if (!found) { console.error('doc introuvable dans le corpus fichier : ' + a.doc); process.exit(2); }
    diag = diagnostiquer(found.doc, found.text, payload);
  }

  if (a.json) {
    console.log(JSON.stringify({ payload: { toolName: a.toolName, toolInput: a.toolInput }, inject: res.inject, decision: res.decision, matched: res.acc.matched, diagnostic: diag ? { doc: diag.doc, injecte: diag.injecte, motif: diag.motif, piege: diag.piege || null, detail: diag.detail || null } : null }, null, 2));
  } else {
    console.log(rendre(a, res, diag));
  }
  process.exit(0);
}

// ⚠️ FAIL-LOUD, à l'INVERSE des hooks (fail-open muet) : un diagnostic qui
//    se tait sur sa propre panne rendrait un « rien ne s'injecte » qu'on
//    prendrait pour un verdict sur le moteur — la faute exacte du 31/07.
//    Message court + exit 2, jamais une stack brute de 10 lignes.
if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('[explain] PANNE DE L\'OUTIL (ce n\'est PAS un verdict sur le moteur) : ' + (e && e.message));
    console.error('  parc lu : ' + paths.fileDocsDir());
    process.exit(2);
  }
}

module.exports = { parseArgs, verdict, diagnostiquer, contextesTestes, trouverDoc };
