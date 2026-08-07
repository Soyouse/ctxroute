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
const emission = require('./emission-core');
const lib = require('./lib-pure');
const paths = require('./paths');
const { readStdinJson } = require('./stdin-json');

// ⚠️ CETTE COQUILLE EST COMMUNE AUX DEUX HARNAIS — il n'y a PLUS de dialecte
//    à déclarer (07/08/2026, portage Codex). Elle portait
//    `MARQUE_APPEL_CLAUDE = '"type":"tool_use"'`, le motif par lequel Claude
//    Code note un appel d'outil dans son transcript, et porter le canari
//    consistait à deviner l'équivalent chez l'autre produit.
// 🛑 CE PLAN A ÉTÉ ABANDONNÉ SUR PREUVE DOCUMENTAIRE, pas par goût.
//    Doc officielle des hooks Codex (learn.chatgpt.com/docs/hooks, lue le
//    07/08/2026) : « the transcript format isn't a stable interface for hooks
//    and may change over time ». Le backlog prévoyait de chercher
//    `response_item`/`custom_tool_call` : c'était rétro-ingénierer un format
//    que l'éditeur se réserve le droit de casser — donc un canari qui serait
//    mort en silence à la première mise à jour. Un dead-man switch qui meurt
//    sans le dire est PIRE que pas de dead-man switch.
// ✅ Le dénominateur vient désormais de `emission-core.compteurEmissions` :
//    NOTRE donnée, identique sur tous les harnais. Ce qu'on cherche encore dans
//    le transcript, c'est UNIQUEMENT notre propre marque `[source:` — une
//    sous-chaîne, jamais un champ de schéma.
// ⚠️ CE QUI REND LE PARTAGE LÉGITIME — VÉRIFIÉ DANS LES DEUX DOCS OFFICIELLES,
//    pas déduit (07/08/2026). Claude Code (`code.claude.com/docs/en/hooks`) ET
//    Codex (`learn.chatgpt.com/docs/hooks`) documentent tous deux, en champs
//    d'entrée COMMUNS : `transcript_path` (« Path to conversation JSON ») et
//    `session_id`. Et côté Claude le contrat de sortie admet explicitement le
//    silence : « Exit 0 means success […] For most events, stdout is written to
//    the debug log but not shown ». Un harnais qui différerait sur l'un de ces
//    trois points exigerait une coquille — jamais un `if` ici.
//
// ⚠️ FAIT DÉCOUVERT EN VÉRIFIANT, ET IL COMPTE : le transcript est écrit de
//    façon ASYNCHRONE. Doc Claude, verbatim : « The transcript file is written
//    asynchronously and may lag the in-memory conversation, so it may not yet
//    include the current turn's most recent messages when a hook fires ».
//    ⇒ une injection qui vient d'atterrir peut ne PAS encore être dans le
//    fichier. C'est INOFFENSIF ICI, et il faut comprendre pourquoi avant de
//    toucher au seuil : le retard porte sur les DERNIERS messages d'un tour,
//    alors qu'on exige 25 ÉMISSIONS et qu'on lit 2 Mo d'historique. Le décalage
//    est absorbé par l'échantillon.
// 🛑 CE FAIT INTERDIT UNE « AMÉLIORATION » QUI SEMBLERAIT ÉVIDENTE : baisser le
//    seuil à 1 ou 2, ou ne regarder que le tour courant. On lirait alors un
//    transcript en retard et on crierait à la mort d'un canal parfaitement
//    vivant. Le seuil n'est pas de la prudence, c'est ce qui rend la lecture
//    d'un fichier asynchrone DÉCIDABLE.

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
  const injections = canari.compterInjections(extrait);
  // ⚠️ MÊME CLÉ DE SCOPE QUE LA PORTE (`lib.scopeId`, SOURCE UNIQUE) : le
  //    compteur d'émissions est écrit par `emission-core` sous cette clé. La
  //    composer autrement ici lirait un compteur qui n'existe pas — donc un
  //    dénominateur à 0, donc un canari éternellement `indecidable` : muet, vert,
  //    et parfaitement inutile. C'est le mode de panne le plus dangereux d'un
  //    dead-man switch, et rien d'autre que la sonde du doctor ne le verrait.
  const scopeId = lib.scopeId(data.session_id, data.agent_id);
  const emissions = emission.compteurEmissions(scopeId);
  const v = canari.verdict(emissions, injections);

  const dossier = paths.stateDir();
  fs.mkdirSync(dossier, { recursive: true });
  // Écriture ATOMIQUE (tmp + rename) : la statusline lit ce fichier en
  // permanence ; un JSON à moitié écrit lui ferait afficher n'importe quoi.
  const tmp = cheminSante() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ verdict: v, emissions, injections, horodatage: Date.now() }));
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
