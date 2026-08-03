#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// COQUILLE DU CANARI — lit le transcript RÉEL, écrit un verdict hors-bande.
// ═══════════════════════════════════════════════════════════════════════
//
// Câblé sur UserPromptSubmit : une fois par TOUR de l'utilisateur, jamais par
// appel d'outil. ⚠️ Ce choix est un CHOIX DE COÛT, mesuré : un spawn node coûte
// ~330 ms sur le poste du mainteneur ; à l'appel d'outil, ce canari doublerait
// la facture pour une information qui ne change qu'à l'échelle de la session.
// NE JAMAIS le déplacer sur PreToolUse.
//
// ⚠️ MUET PAR CONTRAT (stdout VIDE, exit 0 TOUJOURS). Sur UserPromptSubmit,
//    stdout est injecté dans le contexte et un exit≠0 BLOQUE le prompt de
//    l'utilisateur. Un témoin de panne qui bloque le travail serait pire que la
//    panne. Il parle par son FICHIER, jamais par sa sortie.
//
// ⚠️ FAIL-OPEN INTÉGRAL, avec une nuance qui compte : en cas d'erreur on
//    n'écrit RIEN (on laisse le verdict précédent). Écrire « vivant » sur une
//    erreur serait fabriquer du vert — exactement le « vert qui ment ».
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ ÉCHÉANCE ARMÉE AVANT TOUTE I/O — obligation de TOUTE coquille du repo
//    (scellée par `deadline-gate`). Un hook qui lit stdin peut rester pendu si
//    le harnais n'écrit jamais : il bloquerait alors le prompt de
//    l'utilisateur. Oubli commis ici le 03/08/2026, attrapé par le gate.
require('./deadline').arm();

const fs = require('fs');
const path = require('path');
const canari = require('./canari');
const paths = require('./paths');
const { readStdinJson } = require('./stdin-json');

// ⚠️ DIALECTE DU HARNAIS — SA PLACE EST ICI, JAMAIS DANS `canari.js`.
//    Façon dont Claude Code note un appel d'outil dans son transcript JSONL,
//    MESURÉE le 03/08/2026 (2 734 lignes analysées, 310 entrées portantes).
//    Un autre harnais écrira autre chose : porter le canari = changer CETTE
//    ligne dans une coquille dédiée, et RIEN d'autre. Le noyau reste intact —
//    même contrat que `porte-core` ⟷ `doc-inject`/`codex-doc-inject`.
const MARQUE_APPEL_CLAUDE = '"type":"tool_use"';

// ⚠️ Chemin STABLE et unique : la statusline le lit sans rien savoir du
//    framework. Le poser ailleurs qu'ici dupliquerait une vérité de chemin.
function cheminSante() {
  return path.join(paths.stateDir(), 'canari.json');
}

// Lecture BORNÉE de la fin du transcript. ⚠️ Jamais `readFileSync` sur le
// fichier entier : 104 Mo mesurés dans ce parc (cf canari.js).
function lireQueue(fichier) {
  const st = fs.statSync(fichier);
  const taille = Math.min(canari.FENETRE_OCTETS, st.size);
  if (taille === 0) return '';
  const fd = fs.openSync(fichier, 'r');
  try {
    const buf = Buffer.alloc(taille);
    fs.readSync(fd, buf, 0, taille, st.size - taille);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function run(data) {
  const transcript = data && typeof data.transcript_path === 'string' ? data.transcript_path : '';
  // Pas de transcript = harnais qui ne l'expose pas ⇒ le canari se TAIT.
  // ⚠️ DÉGRADATION EXPLICITE, jamais une panne : ce témoin est propre à
  //    Claude Code. Un harnais sans transcript garde tout le reste du
  //    framework — il perd seulement CE filet, et il le perd en silence
  //    ASSUMÉ (rien à signaler à l'utilisateur d'un autre produit).
  if (!transcript) return;

  const extrait = lireQueue(transcript);
  const { appels, injections } = canari.compter(extrait, MARQUE_APPEL_CLAUDE);
  const v = canari.verdict(appels, injections);

  const dossier = paths.stateDir();
  fs.mkdirSync(dossier, { recursive: true });
  // Écriture ATOMIQUE (tmp + rename) : la statusline lit ce fichier en
  // permanence ; un JSON à moitié écrit lui ferait afficher n'importe quoi.
  const tmp = cheminSante() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ verdict: v, appels, injections, horodatage: Date.now() }));
  fs.renameSync(tmp, cheminSante());
}

/* istanbul ignore next — coquille d'entrée, prouvée par spawn réel */
if (require.main === module) {
  readStdinJson(
    (data) => {
      try { run(data); } catch { /* fail-open : on laisse le verdict précédent */ }
      process.exit(0);
    },
    () => process.exit(0)
  );
}

module.exports = { run, cheminSante, lireQueue };
