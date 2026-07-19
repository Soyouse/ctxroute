#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// SHADOW — le nouveau moteur tourne sur le VRAI trafic, sa réponse est JETÉE.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CE HOOK N'INJECTE JAMAIS RIEN. Aucun `hookSpecificOutput`, aucun stdout.
//    Il calcule « quels docs le NOUVEAU moteur aurait injectés » (loader +
//    sources/file) et l'ÉCRIT dans un journal JSONL. Point final.
//    Seul protect-files.js (l'ancien moteur) injecte pendant le shadow.
//    ⚠️ NE JAMAIS lui faire émettre du JSON de hook « pour tester » : ce serait
//    la bascule, qui exige un GO explicite du mainteneur (REFACTOR-PLAN, étape 3).
//
// ⚠️ RISQUE NUL PAR CONSTRUCTION = FAIL-OPEN INTÉGRAL : toute erreur (corpus
//    illisible, JSON cassé, disque plein) → exit 0 silencieux. Un shadow qui
//    bloque un appel d'outil aurait un pouvoir qu'il ne doit pas avoir.
//
// ⚠️ DÉPOUILLEMENT : le journal (state/shadow-YYYY-MM-DD.jsonl, gitignoré) est
//    relu par `shadow-reconcile.js` qui rejoue l'ORACLE (protect-files réel) sur
//    chaque payload unique et signale les divergences. La comparaison est OFFLINE
//    — jamais dans le chemin chaud (un spawn d'oracle par appel doublerait la prod).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ Échéance AVANT toute I/O (bug #68626 : 875 zombies le 15/07/2026).
require('./deadline').arm();

const fs = require('fs');
const path = require('path');
const { readStdinJson } = require('./stdin-json');
const paths = require('./paths');
const { readCorpus } = require('./corpus'); // partagé avec doc-inject.js (la porte)
const { rulesFromCorpus } = require('./loader');
const { matchingDocs } = require('./sources/file');

readStdinJson(
  (data) => {
    try {
      const toolName = data.tool_name;
      const toolInput = data.tool_input || {};
      if (typeof toolName !== 'string') return process.exit(0);

      const corpus = readCorpus(paths.fileDocsDir(), 'docs/');
      const rules = rulesFromCorpus(corpus);
      const docs = matchingDocs(rules, { toolName, toolInput }).map((d) => d.doc);

      // Journal append-only, un fichier par jour (borne naturelle de taille).
      // ⚠️ On logge AUSSI les non-matches ([]) : « le nouveau se tait là où
      //    l'ancien parle » est EXACTEMENT la divergence qu'on cherche.
      const jour = new Date().toISOString().slice(0, 10);
      const stateDir = paths.stateDir();
      fs.mkdirSync(stateDir, { recursive: true });
      fs.appendFileSync(
        path.join(stateDir, `shadow-${jour}.jsonl`),
        JSON.stringify({ ts: Date.now(), toolName, toolInput, docs }) + '\n'
      );
    } catch (e) {
      /* fail-open : le shadow n'a AUCUN droit de gêner la prod */
    }
    process.exit(0);
  },
  () => process.exit(0)
);
