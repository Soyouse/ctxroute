// ═══════════════════════════════════════════════════════════════════════
// SESSION-STORE — I/O du state par session (fichier JSON sous state/). PARTAGÉ.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Extrait le 16/07/2026 (gate jscpd) : legacy-mcp-inject.js (dédup par SERVEUR,
//    préfixe 'ctxroute-seen-') et doc-inject.js (dédup par DOC, 'doc-seen-')
//    portaient le MÊME trio storeFile/loadState/saveState — deux copies d'une
//    même vérité qui divergent en silence.
// ⚠️ FAIL-OPEN : state illisible = {} (repartir de zéro), state inécrivable =
//    silence (ne jamais casser l'injection pour un problème de disque).
// ⚠️ Préfixes DISTINCTS obligatoires : les deux hooks coexistent dans state/,
//    un préfixe partagé mélangerait serveurs et docs dans le même fichier.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizeSessionId } = require('./lib-pure');
const paths = require('./paths');

// Nombre de reprises IMMÉDIATES du `rename` (aucune attente, cf saveState).
// 20 mesuré suffisant sous une charge pathologique (lecteur en boucle serrée) :
// 1 045 échecs → 0. En production la contention est sans commune mesure.
const RENAME_TENTATIVES = 20;

function storeFile(prefix, sessionId) {
  return path.join(paths.stateDir(), `${prefix}${sanitizeSessionId(sessionId)}.json`);
}

function loadState(prefix, sessionId) {
  try {
    return JSON.parse(fs.readFileSync(storeFile(prefix, sessionId), 'utf8'));
  } catch {
    return {};
  }
}

// 🛑 ÉCRITURE ATOMIQUE OBLIGATOIRE — tmp + `rename`, JAMAIS un `writeFileSync`
//    direct sur la destination. Celui-ci TRONQUE avant de remplir : un lecteur
//    concurrent voit un fichier vide, `loadState` rend `{}`, et ce `{}` AFFIRME
//    « rien n'a jamais été injecté » ⇒ réinjection fantôme. MESURÉ sur la taille
//    réelle du parc : 9 596 lectures creuses sur 24 147.
//    Le repli sans verrou de `porte-core.js` lit SANS verrou par construction —
//    c'est donc à l'écrivain de rendre l'état ininterruptible. `rename` est
//    atomique sur POSIX comme sur Windows. Même motif que `canari-check.js`.
// ⚠️ Nom de tmp UNIQUE (pid + aléa) : deux écrivains de sessions différentes
//    ne sont pas sérialisés entre eux. Il porte le PRÉFIXE du store, donc
//    `ctxroute-reset.js` le balaie comme le reste — jamais un déchet orphelin.
function saveState(prefix, sessionId, state) {
  const dest = storeFile(prefix, sessionId);
  const tmp = `${dest}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fs.mkdirSync(paths.stateDir(), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(state));
    // ⚠️ REPRISE BORNÉE OBLIGATOIRE — SOUS WINDOWS, REMPLACER UN FICHIER EN
    //    COURS DE LECTURE ÉCHOUE EN `EPERM`. MESURÉ : 1 045 échecs sur un run
    //    de 2 s, tous avalés par le `catch` ⇒ ÉCRITURE PERDUE EN SILENCE, donc
    //    un `once` non mémorisé, donc la réinjection qu'on vient de corriger.
    //    L'écriture atomique SEULE déplaçait le défaut au lieu de le fermer.
    // ⚠️ Ce n'est PAS un délai (aucun `sleep`, aucun timer) : la fenêtre dure
    //    quelques microsecondes, une reprise IMMÉDIATE suffit. Mesuré après
    //    reprise : 0 lecture creuse ET 0 écriture perdue.
    for (let i = 0; i < RENAME_TENTATIVES; i++) {
      try { fs.renameSync(tmp, dest); return; } catch { /* réessayer tout de suite */ }
    }
    fs.unlinkSync(tmp); // épuisé : jamais de déchet abandonné dans state/
  } catch {
    /* fail-open : un store inécrivable ne casse jamais l'injection */
    try { fs.unlinkSync(tmp); } catch { /* rien à nettoyer */ }
  }
}

module.exports = { storeFile, loadState, saveState };
