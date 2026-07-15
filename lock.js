#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Lock inter-process, synchrone, basé sur fs.mkdirSync (I/O — pas de mutation)
// ═══════════════════════════════════════════════════════════════════════
//
// PROBLÈME RÉSOLU : Claude Code peut exécuter des appels d'outils INDÉPENDANTS
// en parallèle (documenté dans le system prompt : "make all independent tool
// calls in parallel"). Si deux appels MCP concurrents visent le MÊME
// session_id, deux process `node mcp-doc-inject.js` distincts peuvent
// lire→modifier→écrire state/mcp-doc-seen-<session_id>.json en même temps :
// race condition classique read-modify-write, perte d'écriture silencieuse
// (le 2e process écrase l'état du 1er sans voir ses changements).
// ⚠️ Signal doctrine : "concurrence NON SÉRIALISÉE sur état mutable partagé"
// → sérialisation obligatoire (pas juste une doc du risque).
//
// FIX : `fs.mkdirSync` est ATOMIQUE au niveau OS (Windows ET POSIX) — deux
// process qui tentent de créer le MÊME dossier, un seul réussit, l'autre
// reçoit EEXIST. On l'utilise comme primitive de lock cross-process : le
// process qui réussit le mkdir possède le lock, le supprime en le libérant.
//
// ⚠️ SYNCHRONE et bref par construction : chaque hook est un process
// court-lived (lit stdin, décide, exit). Pas de deadlock possible entre
// processes DIFFÉRENTS de ce hook (même lock, même ressource, jamais imbriqué).
// ⚠️ TIMEOUT + fichier stale : si un process meurt en tenant le lock (crash),
// le dossier de lock resterait orphelin pour toujours sans ce mécanisme —
// tout lock plus vieux que STALE_MS est considéré abandonné et forcé.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

const RETRY_DELAY_MS = 10;
const DEFAULT_TIMEOUT_MS = 2000;
const STALE_MS = 5000; // un lock plus vieux que ça = process mort, on le force

// Attente BLOQUANTE synchrone courte (fs.mkdirSync busy-wait). Pas de setTimeout
// possible en synchrone pur → boucle sur Atomics.wait (dispo Node >=8.10, zéro dep).
function sleepMs(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // Fallback si SharedArrayBuffer indisponible (environnement restreint) :
    // busy-loop CPU borné — coûteux mais seulement sur un délai de quelques ms.
    const end = Date.now() + ms;
    while (Date.now() < end) { /* busy-wait volontaire, borné à RETRY_DELAY_MS */ }
  }
}

// Acquiert le lock (bloquant, avec timeout), exécute `fn`, libère TOUJOURS le
// lock (même si `fn` lève). Retourne la valeur de `fn`, ou `fallback` si le
// lock n'a pas pu être acquis dans le timeout (FAIL-OPEN : ne jamais bloquer
// le hook indéfiniment à cause d'une contention lock).
function withLock(lockDir, fn, { timeoutMs = DEFAULT_TIMEOUT_MS, fallback = undefined } = {}) {
  // ⚠️ BUG RÉEL (trouvé en CI 15/07/2026, PAS en local) : sur un checkout
  // FRAIS, le dossier PARENT de lockDir (state/) n'existe pas encore →
  // fs.mkdirSync(lockDir) échoue en ENOENT (pas EEXIST) → interprété comme
  // "erreur inattendue" → lock jamais acquis → fallback partout. En local,
  // state/ existait déjà depuis des runs précédents, masquant le bug.
  // FIX : créer la chaîne de dossiers PARENTS une fois, en amont, avec
  // `recursive: true` (idempotent — sûr même si plusieurs process concurrents
  // l'appellent en même temps, aucun ne lève EEXIST). L'acquisition du lock
  // lui-même reste sur le mkdirSync SANS recursive juste après (seul ce
  // dernier niveau doit être atomique/exclusif).
  try { fs.mkdirSync(path.dirname(lockDir), { recursive: true }); } catch { /* fail-open plus bas si vraiment cassé */ }

  const deadline = Date.now() + timeoutMs;
  let acquired = false;

  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockDir); // atomique : échoue EEXIST si déjà pris
      acquired = true;
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') break; // erreur inattendue (permissions...) → fail-open, pas de lock
      // Lock déjà pris par un AUTRE process : si stale (crash), le forcer.
      try {
        const st = fs.statSync(lockDir);
        if (Date.now() - st.mtimeMs > STALE_MS) {
          fs.rmdirSync(lockDir); // libère le lock abandonné, retente immédiatement
          continue;
        }
      } catch {
        // lock disparu entre le mkdirSync et le statSync (l'autre l'a libéré) → retente
      }
      sleepMs(RETRY_DELAY_MS);
    }
  }

  if (!acquired) return fallback; // timeout : fail-open, ne bloque jamais le hook

  try {
    return fn();
  } finally {
    try { fs.rmdirSync(lockDir); } catch { /* déjà supprimé ou permission — fail-open */ }
  }
}

module.exports = { withLock };
