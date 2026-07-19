#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// COQUILLE I/O DU LINT — lit le disque, NORMALISE, délègue à lint.js
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ SEUL point d'I/O de l'audit du parc. `lint.js` (pur) DÉCIDE, ce fichier
//    ne fait que lui fournir un état. Même séparation que
//    mcp-doc-inject.js / lib-pure.js — c'est la CONDITION pour muter la
//    décision sans bruit, pas un confort.
//
// ⚠️ LE POINT DE MAINTENABILITÉ CENTRAL — la NORMALISATION vit ICI :
//    une doc a un déclencheur qui vient AUJOURD'HUI de protected-paths.json,
//    DEMAIN de son propre frontmatter. Ce fichier traduit les deux vers UNE
//    `declaration` uniforme. Conséquence : `lint.js` ignore totalement
//    l'époque, et la migration ne fera mourir AUCUNE ligne du noyau.
//    ⚠️ NE JAMAIS remonter la notion « visée par une règle » dans lint.js :
//    ce serait rapatrier le transitoire dans le permanent.
//
// ⚠️ DIAGNOSTIC, PAS HOOK : il HURLE (exit ≠ 0) sur ERREUR. Ne JAMAIS le
//    rendre fail-open comme les hooks — un hook doit être silencieux et
//    non-bloquant, un diagnostic doit crier. Rôles opposés (cf doctor.js).
//
// Usage :
//   node lint-corpus.js                → niveau de la config (défaut warn)
//   node lint-corpus.js --level error  → override
//   node lint-corpus.js --quiet        → muet si sain, hurle si ERREUR
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const { analyser, filtrer, doitHurler, NIVEAU_DEFAUT } = require('./lint');
const frontmatter = require('./frontmatter');

// ⚠️ Le parc de docs FICHIER vit chez l'utilisateur (~/.claude/hooks/), PAS
//    dans ce repo : le framework est PUBLIC, il ne DOIT dépendre d'aucun
//    chemin du home de qui que ce soit. D'où l'env var + le défaut relatif.
//    ⚠️ NE JAMAIS coder en dur un chemin du mainteneur ici.
function hooksDir() {
  return process.env.MCP_DOC_HOOKS_DIR || path.join(require('os').homedir(), '.claude', 'hooks');
}

function lireJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null; // ⚠️ fichier absent/illisible = état vide, jamais un crash.
  }
}

// ⚠️ `protected-paths.json` a une racine OBJET (`{rules:[...]}`) — l'a-plat
//    a déjà piégé un script d'audit le 15/07 (`Array.isArray` faux → 0 règle
//    chargée → « 0 trou » triomphal sur un harnais creux). D'où la tolérance
//    aux 2 formes ET la sonde de vivacité plus bas.
function extraireRegles(brut) {
  if (Array.isArray(brut)) return brut;
  if (brut && Array.isArray(brut.rules)) return brut.rules;
  return [];
}

function listerMd(racine) {
  const out = [];
  const marcher = (d) => {
    let entrees;
    try {
      entrees = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) marcher(f);
      else if (e.name.endsWith('.md')) out.push(path.relative(racine, f).split(path.sep).join('/'));
    }
  };
  marcher(racine);
  return out;
}

/**
 * ⚠️ LA NORMALISATION. Rend une `declaration` uniforme, quelle que soit la
 *    source du déclencheur.
 *  - frontmatter présent  → il fait AUTORITÉ (monde d'après la migration) ;
 *  - sinon                → on la RECONSTRUIT depuis protected-paths.json
 *                           (monde d'aujourd'hui).
 * ⚠️ La forme rendue est EXACTEMENT celle que `frontmatter.validate()` juge :
 *    une seule autorité sur « cette déclaration est-elle saine ? ».
 */
function declarationDe(cheminAbs, cheminRel, reglesParDoc) {
  let texte = '';
  try {
    texte = fs.readFileSync(cheminAbs, 'utf8');
  } catch {
    return {};
  }
  const fm = frontmatter.parse(texte);
  if (fm.hasFrontmatter) return fm.data;

  const regles = reglesParDoc.get(cheminRel);
  if (!regles || !regles.length) return {}; // aucun déclencheur → validate() le dira
  const patterns = regles.map((r) => r.pattern).filter((p) => typeof p === 'string');
  const decl = { match: patterns.length === 1 ? patterns[0] : patterns };
  const premiere = regles[0];
  if (Array.isArray(premiere.scope) && premiere.scope.length) decl.scope = premiere.scope;
  if (Array.isArray(premiere.exclude) && premiere.exclude.length) decl.exclude = premiere.exclude;
  return decl;
}

// ⚠️ Les serveurs MCP branchés vivent dans PLUSIEURS fichiers (.claude.json ET
//    .mcp.json — 16 uniques mesurés le 15/07, 8 + 14 avec recouvrement). N'en
//    lire qu'un = sous-compter en silence, donc rater des serveurs sans doc.
function serveursMCP(home) {
  const noms = new Set();
  for (const f of ['.claude.json', '.mcp.json', path.join('.claude', 'settings.json')]) {
    const j = lireJSON(path.join(home, f));
    for (const n of Object.keys((j && j.mcpServers) || {})) noms.add(n);
  }
  return [...noms];
}

function collecter() {
  const HOOKS = hooksDir();
  const DOCS = path.join(HOOKS, 'docs');
  const home = process.env.MCP_DOC_HOME || require('os').homedir();

  const regles = extraireRegles(lireJSON(path.join(HOOKS, 'protected-paths.json')));

  // ⚠️ SONDE DE VIVACITÉ — un harnais creux annonce triomphalement « 0 problème ».
  //    Erreur commise 2× le 15/07 (script d'audit filtrant sur `scope`, puis
  //    `Array.isArray` sur une racine objet). Sans preuve d'avoir chargé
  //    quelque chose, un résultat vert ne vaut RIEN.
  if (!regles.length) {
    console.error(`🚨 lint-corpus : AUCUNE règle chargée depuis ${HOOKS}/protected-paths.json`);
    console.error('   Le lint ne peut RIEN prouver dans cet état (harnais creux). Vérifie MCP_DOC_HOOKS_DIR.');
    process.exit(2);
  }

  const reglesParDoc = new Map();
  for (const r of regles) {
    if (!r || typeof r.doc !== 'string' || typeof r.pattern !== 'string') continue;
    if (!reglesParDoc.has(r.doc)) reglesParDoc.set(r.doc, []);
    reglesParDoc.get(r.doc).push(r);
  }

  const surDisque = listerMd(DOCS).map((rel) => `docs/${rel}`);
  const docs = surDisque.map((rel) => ({
    chemin: rel,
    declaration: declarationDe(path.join(HOOKS, rel), rel, reglesParDoc),
  }));

  // ⚠️ Le miroir : une règle qui vise un .md absent du disque.
  const surDisqueSet = new Set(surDisque);
  const docsFantomes = [...reglesParDoc.keys()].filter((d) => !surDisqueSet.has(d));

  const config = lireJSON(path.join(__dirname, 'mcp-doc-config.json')) || {};
  const docsMcpDir = path.join(__dirname, 'docs', 'mcp');
  let serveursDocumentes = [];
  try {
    serveursDocumentes = fs
      .readdirSync(docsMcpDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
  } catch {
    /* dossier absent → aucun serveur documenté, le lint le dira */
  }

  return {
    etat: {
      docs,
      docsFantomes,
      serveursMCP: serveursMCP(home),
      serveursDocumentes,
      // ⚠️ `filterList` EST la déclaration « ce serveur est volontairement sans
      //    doc » — on ne réinvente pas un 2ᵉ champ pour dire la même chose.
      serveursDeclares: Array.isArray(config.filterList) ? config.filterList : [],
    },
    niveau: (config.lint && config.lint.level) || NIVEAU_DEFAUT,
    stats: { docs: docs.length, regles: regles.length },
  };
}

// ── Porte ────────────────────────────────────────────────────────────
const QUIET = process.argv.includes('--quiet');
const iLevel = process.argv.indexOf('--level');
const { etat, niveau, stats } = collecter();
const constats = filtrer(analyser(etat), iLevel !== -1 ? process.argv[iLevel + 1] : niveau);
const erreurs = constats.filter((c) => c.niveau === 'error').length;

if (!QUIET) {
  console.log(`lint du parc — ${stats.docs} docs, ${stats.regles} règles, ${etat.serveursMCP.length} serveurs MCP\n`);
}
for (const c of constats) {
  const ligne = `  ${c.niveau === 'error' ? '✗' : '⚠'} [${c.code}] ${c.cible}\n      ${c.message}`;
  if (c.niveau === 'error') console.error(ligne);
  else if (!QUIET) console.log(ligne);
}

if (doitHurler(constats)) {
  // ⚠️ BRUYANT VOLONTAIREMENT : le silence EST le bug qu'on traque.
  console.error(`\n🚨 ${erreurs} doc(s) MORTE(S) — elles ne seront JAMAIS injectées, et personne ne le verrait.`);
  process.exit(1);
}
if (!QUIET) console.log(constats.length ? `\n${constats.length} avertissement(s), 0 erreur` : '\n✅ parc sain');
