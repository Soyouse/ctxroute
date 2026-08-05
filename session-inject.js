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
// ⚠️ AUCUN ÉTAT DE CADENCE : injection inconditionnelle à chaque SessionStart
//    — c'est le contrat « comme CLAUDE.md » (pas de dédup, la compaction vide
//    le contexte donc la réinjection est le BUT). Le seul état touché ici est
//    la FILE D'ÉMISSION, qui n'est pas une cadence mais du transport.
//
// ⚠️ TRANSPORT (05/08/2026, REFACTOR-PLAN ⑯/⑮) — CE HOOK N'EN AVAIT AUCUN.
//    Il sortait d'un bloc : ni sceau, ni morcelage, ni file. Ça « marchait »
//    UNIQUEMENT parce que `docs/session/` pesait ~1,2 Ko — du dimensionnement
//    statique, exactement ce que la file a éliminé partout ailleurs. Le jour
//    où quelqu'un y met un vrai document, il partait en fichier de spill EN
//    SILENCE, sans sceau donc sans aucune détection de troncature.
//    Il traverse maintenant `emission-core.js` comme tout émetteur.
//
// ⚠️ UNE SEULE TRAME ICI, VOLONTAIREMENT (`nbPaquets: 1`). Le multi-trames
//    exige de savoir si le harnais spawne bien N fois un hook SessionStart
//    déclaré N fois — ce n'est PAS mesuré (la dédup par commande + args n'est
//    prouvée que sur PreToolUse). On ne rétro-ingénierise pas : à une trame,
//    le morcelage livre quand même TOUT, simplement plus lentement. Passer à N
//    est un réglage, pas une reconception — mais il exige la mesure d'abord.
//
// ⚠️ LA FILE EST PARTAGÉE AVEC LA PORTE PreToolUse, ET C'EST LE POINT CLÉ :
//    à SessionStart il n'y a pas de « geste suivant » où drainer un reliquat.
//    Le store commun (même préfixe, même scope d'agent) fait que ce que cette
//    porte n'a pas pu livrer est repris par la porte PreToolUse au TOUT
//    PREMIER appel d'outil. Ne JAMAIS lui donner une file privée.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ Échéance AVANT toute I/O (bug #68626 : 875 zombies le 15/07/2026).
require('./deadline').arm();

const fs = require('fs');
const path = require('path');
const lib = require('./lib-pure');
const { readCorpus } = require('./corpus');
const { sessionDocs } = require('./sources/session');
const { readStdinJson } = require('./stdin-json');
const paths = require('./paths');
// ⚠️ COUCHE D'ÉMISSION OBLIGATOIRE — aucun émetteur ne compose sa sortie
//    lui-même. Scellé par `emission-core-gate.test.js` : tout fichier qui
//    écrit `additionalContext` DOIT importer ce module.
const emission = require('./emission-core');
const { withLock } = require('./lock');

readStdinJson(
  (data) => {
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
      // ⚠️ SEGMENTS, plus une chaîne jointe : la couche d'émission raisonne par
      //    DOCUMENT (c'est ce qui lui permet de morceler, de dédupliquer avec la
      //    file et de nommer ce qui est différé). Le séparateur qu'elle applique
      //    est le MÊME (`\n\n---\n\n`) ⇒ tant que le corpus tient dans la trame,
      //    la sortie est identique À L'OCTET à celle d'avant.
      const frais = docs.map((d) => ({
        id: 'session/' + d.doc,
        text: d.body + '\n[source: docs/' + d.doc + ']',
        label: 'docs/' + d.doc,
      }));

      // ⚠️ SCOPE PAR AGENT, comme la porte PreToolUse — c'est ce qui fait que
      //    les deux portes partagent LA MÊME file. Une clé différente ici
      //    rendrait le reliquat de session indrainable.
      const scopeId = lib.scopeId(data && data.session_id, data && data.agent_id);
      const budgetMax = require('./budget').DEFAUT_BUDGET;

      // ⚠️ LOCK OBLIGATOIRE AUTOUR DE LA FILE (lire puis réécrire). Sans
      //    exclusion mutuelle, deux processus qui se croisent en perdent une
      //    partie. Lock indisponible ⇒ on DÉGRADE au frais seul (découpage sans
      //    file, file laissée intacte) — jamais se taire, jamais écrire sans
      //    lock. C'est exactement le contrat de porte-core.js.
      const lockDir = path.join(paths.stateDir(), `.lock-doc-${lib.sanitizeSessionId(scopeId)}`);
      const res = withLock(
        lockDir,
        () => emission.emettre({ frais, budgetMax, nbPaquets: 1, indice: 1, scopeId }),
        { fallback: null }
      );
      const plan = res ? res.plan : emission.decouper(frais, budgetMax, 1)[0];

      // Trame vide (ni contenu ni annonce) ⇒ silence, comme la porte PreToolUse.
      if (!plan || plan.texte === '') process.exit(0);
      const fullDoc = plan.texte;
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
