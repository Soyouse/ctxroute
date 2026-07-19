#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// PORTE SESSION — hook SessionStart : injecte docs/session/*.md à CHAQUE
// début de session (startup/resume/clear/compact), comme CLAUDE.md.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ PORTE SŒUR de doc-inject.js, JAMAIS fusionnée avec elle : SessionStart
//    et PreToolUse sont deux événements au contrat de sortie différent.
//    Le MOTEUR est partagé (corpus.js + sources/session.js purs) ; seule
//    cette coquille parle le dialecte SessionStart de Claude Code.
//
// ⚠️ SEUL POINT D'I/O de sa chaîne : lire corpus → décision pure
//    (sources/session.js) → stdout. ZÉRO logique ici.
//
// ⚠️ FAIL-OPEN intégral : dossier absent, corpus illisible, stdin malformé,
//    config illisible → exit 0 sans stdout. Un hook qui crash bloque le
//    démarrage de session — jamais acceptable. (Sa vivacité est couverte
//    par doctor.js, pattern dead-man : fail-open ici, hurlement là-bas.)
//
// ⚠️ AUCUN ÉTAT, AUCUN LOCK : injection inconditionnelle à chaque
//    SessionStart — c'est le contrat « comme CLAUDE.md » (pas de dédup,
//    la compaction vide le contexte donc la réinjection est le BUT).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ Échéance AVANT toute I/O (bug #68626 : 875 zombies le 15/07/2026).
require('./deadline').arm();

const fs = require('fs');
const lib = require('./lib-pure');
const { readCorpus } = require('./corpus');
const { sessionDocs } = require('./sources/session');
const { readStdinJson } = require('./stdin-json');
const paths = require('./paths');

readStdinJson(
  () => {
    try {
      let config;
      try {
        config = JSON.parse(fs.readFileSync(paths.configPath(), 'utf8'));
      } catch {
        config = {}; // config absente = défauts (framework actif)
      }
      // Même interrupteur global que la porte PreToolUse (enabled: false coupe TOUT).
      if (!lib.isFrameworkEnabled(config)) process.exit(0);

      const docs = sessionDocs(readCorpus(paths.sessionDocsDir(), 'session/'));
      if (docs.length === 0) process.exit(0);

      // [source: …] par doc — même vocabulaire que la porte PreToolUse.
      const fullDoc = docs
        .map((d) => d.body + '\n[source: docs/' + d.doc + ']')
        .join('\n\n---\n\n');
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: fullDoc,
        },
      }));
      process.exit(0);
    } catch {
      process.exit(0); // fail-open (dossier docs/session absent inclus)
    }
  },
  () => process.exit(0)
);
