// ═══════════════════════════════════════════════════════════════════════
// REGISTRE DES SOURCES — LE point d'extension du framework (plugins).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ AJOUTER UNE SOURCE = 1 module PUR dans sources/ + 1 adaptateur ICI.
//    La porte (doc-inject.js) ne se touche JAMAIS : elle itère ADAPTERS.
//    gate.js/lock/stores/doctor non plus. C'est le contrat qui rend le
//    framework « no-limit » sans jamais rouvrir le moteur (doctrine du
//    patrimoine : le moteur est un actif figé, les sources s'empilent).
//
// CONTRAT D'ADAPTATEUR (les 2 exemples ci-dessous font foi) :
//   { id, collect(config, payload, acc), message(injected, ctx) }
//   - `collect` : lit SON corpus (I/O locale) et pose dans `acc` :
//       acc.matched.push(docId)   — ordre intra-source = ordre d'injection
//       acc.decls[docId]  = decl gate.js ({mode, threshold?, confirm?})
//       acc.bodies[docId] = corps SANS frontmatter (trim par la porte)
//       acc.labels[docId] = tag [source: …] (vocabulaire PROPRE à la source)
//       acc.owner[docId]  = this.id · acc.meta[docId] = libre (pour message)
//     ⚠️ docId UNIQUE inter-sources (préfixe : 'docs/…' fichier, 'mcp/…' MCP).
//     ⚠️ FAIL-OPEN LOCAL : si la panne de CETTE source ne doit pas faire
//        taire les autres, try/catch ICI (cf mcp) — jamais dans la porte.
//   - `message(injected, {fullDoc, config, acc})` : systemMessage de la
//     source ('' = rien). La porte joint les messages par ' · '.
//   - L'ordre du tableau ADAPTERS = ordre de concaténation inter-sources.
//
// ⚠️ PARITÉ scellée : porte-differential (fichier, octet) + mcp-differential
//    (MCP, vieux vs nouveau). Toute modif ici = relancer LES DEUX.
// ⚠️ Une source INFORME, ne bloque jamais (deny/ask hors moteur, décision
//    le mainteneur 17/07/2026). Le `confirm` d'une decl reste le seul « ask » légal.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib-pure');
const gate = require('./gate');
const { parse, validate } = require('./frontmatter');
const { readCorpus } = require('./corpus');
const { rulesFromCorpus } = require('./loader');
const fileSource = require('./sources/file');
const toolSource = require('./sources/tool');
const mcpSource = require('./sources/mcp');
const skillSource = require('./sources/skill');
const paths = require('./paths');

// ── SOURCE « FICHIER » : frontmatters du parc ~/.claude/hooks/docs/ ──
// ⚠️ PAS de try/catch local : un parc illisible = panne TOTALE légitime,
//    avalée par le fail-open global de la porte (comportement d'origine).
const fileAdapter = {
  id: 'file',
  collect(config, payload, acc) {
    const corpus = readCorpus(paths.fileDocsDir(), 'docs/');
    const rules = rulesFromCorpus(corpus);
    for (const d of corpus) {
      const { data: fm, body } = parse(d.text);
      if (validate(fm).length === 0) acc.decls[d.doc] = fm;
      acc.bodies[d.doc] = body;
    }
    // ⚠️ PARITÉ protect-files : doc au corps VIDE (après strip frontmatter)
    //    = inexistante, y compris pour la décision ask. Filtrer AVANT decide().
    for (const m of fileSource.matchingDocs(rules, payload)) {
      if ((acc.bodies[m.doc] || '').trim() === '') continue;
      acc.matched.push(m.doc);
      acc.labels[m.doc] = '.claude/hooks/' + m.doc;
      acc.owner[m.doc] = this.id;
    }
  },
  // '📄 doc: …' — la PARITÉ protect-files exige que ce badge IGNORE
  // `showNotification`, contrairement à ceux de MCP et tool. Ne PAS
  // « harmoniser » : ce serait changer une voie en production pour de
  // l'esthétique. Le LABEL, lui, est partagé (cf labelDoc).
  message(injected, ctx) {
    const label = labelDoc(injected, ctx);
    return label ? '📄 doc: ' + label : '';
  },
};

/**
 * Nom court du document annoncé par le badge « 📄 doc: … ».
 *
 * ⚠️ DEUX SOURCES, DANS CET ORDRE, et ce n'est pas un détail (06/08/2026) :
 *    ① le tag `[source: …]` du texte émis — c'est la PARITÉ protect-files, à
 *       l'octet, et elle doit rester le chemin nominal ;
 *    ② à défaut, le label que l'adaptateur a DÉJÀ posé dans `acc.labels`.
 * ⚠️ ② N'EST PAS DÉCORATIF — BUG RÉEL : le tag `[source:]` vit à la FIN du
 *    document, donc **aucun morceau sauf le dernier ne le porte**. Une doc
 *    morcelée tombait alors sur le fallback « titre markdown » de `docLabel`,
 *    qui attrapait le PIED DE SCEAU : le badge affichait
 *    « 📄 doc: ##FIN:7426e64b### ». Corrigé des deux côtés (regex ATX conforme
 *    CommonMark dans gate.js + ce repli), parce qu'une seule des deux
 *    corrections laisserait soit un faux nom, soit AUCUN nom.
 * 🛑 NE JAMAIS inverser l'ordre : lire `acc.labels` d'abord changerait le badge
 *    du cas nominal et casserait les différentiels de parité.
 */
function labelDoc(injected, ctx) {
  const parTag = gate.docLabel(ctx.fullDoc);
  if (parTag) return parTag;
  const brut = ctx.acc.labels[injected[0]];
  return brut ? String(brut).split(/[\\/]/).pop().replace(/\.md$/, '') : '';
}

// ── SOURCE « MCP » : docs/mcp/ du repo, sélection pure sources/mcp.js ──
const mcpAdapter = {
  id: 'mcp',
  collect(config, payload, acc) {
    // Lecture du corpus MCP UNIQUEMENT sur outil mcp__ (perf : zéro I/O
    // ajoutée sur Read/Edit/Bash). Les compteurs « étrangers » des docs MCP
    // avancent quand même sur tout appel : gate.decide itère le STATE.
    if (!payload.toolName.startsWith('mcp__')) return;
    try {
      const cands = mcpSource.matchingDocs(config, payload);
      if (cands.length === 0) return;
      const byId = new Map(readCorpus(paths.docsDir(), 'mcp/').map((d) => [d.doc, d.text]));
      for (const c of cands) {
        const text = byId.get(c.doc);
        if (text === undefined) continue; // doc absente pour ce niveau = silence (parité)
        const { data: fm, body } = parse(text);
        if (body.trim() === '') continue;
        acc.bodies[c.doc] = body;
        // Le frontmatter de la doc MCP propose sa cadence (mode/threshold),
        // la config dispose en fallback — précédence documentée dans sources/mcp.js.
        acc.decls[c.doc] = mcpSource.declFor(config, c.server, fm);
        acc.labels[c.doc] = c.sourceLabel;
        acc.owner[c.doc] = this.id;
        acc.meta[c.doc] = c;
        acc.matched.push(c.doc);
      }
    } catch {
      /* fail-open LOCAL — un corpus MCP illisible ne fait jamais taire les docs fichier */
    }
  },
  // Badge '[ctxroute] server(+levels)' — parité legacy-mcp-inject,
  // respecte showNotification (le badge fichier ne le lisait pas : parité).
  message(injected, ctx) {
    if (!lib.shouldShowNotification(ctx.config)) return '';
    const meta = ctx.acc.meta;
    return lib.formatSystemMessage(meta[injected[0]].server, injected.map((d) => meta[d].level));
  },
};

// ── SOURCE « SKILL » : registre config.skills, matcher fichier RÉUTILISÉ ──
// Injecte le CORPS DU SKILL lu EN DIRECT depuis le store du harnais (décision
// le mainteneur 18/07/2026 : injection MÉCANIQUE garantie, jamais un pointeur qui
// espère que l'agent obéisse). Zéro doublon : le fichier du skill reste la
// SEULE vérité — lu à chaque injection, jamais copié nulle part. Fallback
// pointeur UNIQUEMENT si le fichier est illisible (fail-open : le périmètre
// signale quand même). Cadence libre (once par défaut).
const skillAdapter = {
  id: 'skill',
  collect(config, payload, acc) {
    try {
      const skills = (config && config.skills) || {};
      for (const m of skillSource.matchingSkills(config, payload)) {
        const name = skillSource.skillNameFromDoc(m.doc);
        let body = null;
        try {
          // parse().body = skill SANS son frontmatter (métadonnées du harnais :
          // description/allowed-tools — du bruit dans le contexte, pas du savoir).
          body = parse(fs.readFileSync(path.join(paths.skillsDir(), name + '.md'), 'utf8')).body;
        } catch { /* fichier illisible → fallback pointeur ci-dessous */ }
        acc.bodies[m.doc] = body && body.trim() !== '' ? body : skillSource.pointerBody(name);
        // ⚠️ On POSE l'entrée du registre, on ne résout RIEN : la cascade complète
        //    (defaults.skill > global > défaut framework 'once') vit dans gate.js,
        //    point UNIQUE. `acc.owner` ci-dessous est ce qui la rend possible.
        acc.decls[m.doc] = skillSource.declFor(skills[name]);
        acc.labels[m.doc] = m.doc; // 'skill/{nom}' — tag [source:] propre à la source
        acc.owner[m.doc] = this.id;
        acc.meta[m.doc] = { name };
        acc.matched.push(m.doc);
      }
    } catch {
      /* fail-open LOCAL — un registre skills illisible ne fait jamais taire les autres sources */
    }
  },
  message(injected, ctx) {
    if (!lib.shouldShowNotification(ctx.config)) return '';
    return '🧩 skill: ' + injected.map((d) => ctx.acc.meta[d].name).join(', ');
  },
};

// ── SOURCE « TOOL » : déclencheur = nom EXACT d'un outil natif (19/07/2026) ──
// Même corpus que la source fichier (les docs vivent au même endroit, seule la
// CLÉ de déclenchement diffère : `tool:` vs `match:`). Angle mort comblé :
// WebFetch/WebSearch & co (ni chemin, ni mcp__) — prouvé muet par spawn avant.
// ⚠️ Dédup docId : une doc déjà matchée par la source fichier n'est PAS
//    re-poussée (même docId 'docs/…' = même corps ; première source gagnante).
const toolAdapter = {
  id: 'tool',
  collect(config, payload, acc) {
    try {
      // ⚠️ ZÉRO I/O AJOUTÉE : la source fichier (juste avant dans ADAPTERS) a
      //    DÉJÀ parsé tout le corpus dans acc.decls/acc.bodies — les relire ici
      //    doublerait la lecture des ~320 docs À CHAQUE appel d'outil. On
      //    réutilise l'accumulateur ; l'ordre fileAdapter→toolAdapter est donc
      //    une DÉPENDANCE (scellée par le commentaire d'ordre d'ADAPTERS).
      const docs = [];
      for (const doc of Object.keys(acc.decls)) {
        const fm = acc.decls[doc];
        if (!fm || !('tool' in fm)) continue;
        if ((acc.bodies[doc] || '').trim() === '') continue;
        docs.push({ doc, fm });
      }
      for (const m of toolSource.matchingDocs(docs, payload)) {
        if (acc.matched.includes(m.doc)) continue;
        acc.labels[m.doc] = '.claude/hooks/' + m.doc;
        acc.owner[m.doc] = this.id;
        acc.matched.push(m.doc);
      }
    } catch {
      /* fail-open LOCAL — une panne ici ne fait jamais taire les autres sources */
    }
  },
  // Contrairement au badge FICHIER, celui-ci respecte `showNotification` —
  // asymétrie héritée, volontaire, documentée. Label partagé (cf labelDoc).
  message(injected, ctx) {
    if (!lib.shouldShowNotification(ctx.config)) return '';
    const label = labelDoc(injected, ctx);
    return label ? '📄 doc: ' + label : '';
  },
};

// ⚠️ ORDRE = ordre de concaténation dans le contexte (fichier avant MCP,
//    comme avant la fusion). Skill EN DERNIER : préserve la parité octet
//    fichier/MCP (les différentiels ne voient rien changer). Nouvelle source :
//    l'ajouter ICI, à sa place. TOOL après FILE (dédup docId : file gagne),
//    avant MCP (une doc = du contexte fichier, même famille de label).
const ADAPTERS = [fileAdapter, toolAdapter, mcpAdapter, skillAdapter];

module.exports = { ADAPTERS };
