#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// DÉPOUILLEMENT DU SHADOW — rejoue l'ORACLE sur le journal, signale les divergences.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ OFFLINE, à la demande (`node shadow-reconcile.js`) — jamais dans le chemin
//    chaud. C'est LUI qui donne le verdict de bascule : « N jours de vrai trafic,
//    zéro divergence ». Diagnostic → il HURLE (exit 1) à la première divergence,
//    exit 2 si le journal est VIDE (« pas pu mesurer » ≠ « rien à signaler » —
//    un shadow mort qui ne logge rien ressemblerait à un shadow parfait).
//
// ⚠️ DÉDUP par payload : le journal contient chaque appel d'outil ; rejouer
//    l'oracle (un spawn ≈ 440 ms) sur des milliers de doublons serait inutile.
//    ZÉRO plafond silencieux : tous les payloads UNIQUES sont rejoués, comptés,
//    annoncés.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const paths = require('./paths');
const { legacyDocs } = require('./oracle');

const LEGACY = process.env.MCP_DOC_LEGACY_PATH || path.join(os.homedir(), '.claude', 'hooks', 'protect-files.js');

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const stateDir = paths.stateDir();
  const journaux = fs.existsSync(stateDir)
    ? fs.readdirSync(stateDir).filter((f) => /^shadow-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    : [];

  const uniques = new Map(); // clé payload -> { toolName, toolInput, docs }
  let lignes = 0;
  for (const j of journaux) {
    for (const l of fs.readFileSync(path.join(stateDir, j), 'utf8').split('\n')) {
      if (!l.trim()) continue;
      lignes++;
      let e;
      try { e = JSON.parse(l); } catch (err) { continue; } // ligne corrompue (crash mi-écriture) : ignorée, comptée quand même
      uniques.set(JSON.stringify([e.toolName, e.toolInput]), e);
    }
  }

  console.log(`journaux: ${journaux.length} · appels loggés: ${lignes} · payloads uniques: ${uniques.size}`);
  if (uniques.size === 0) {
    console.error('⚠️ JOURNAL VIDE — le shadow n\'a rien mesuré (hook mort ? pas encore de trafic ?). Rien à conclure.');
    process.exit(2);
  }

  const entries = [...uniques.values()];
  const divergences = (
    await mapPool(entries, 12, async (e) => {
      const attendu = await legacyDocs(LEGACY, { toolName: e.toolName, toolInput: e.toolInput });
      return attendu.join('|') === (e.docs || []).join('|')
        ? null
        : { toolName: e.toolName, toolInput: e.toolInput, ancien: attendu, nouveau: e.docs };
    })
  ).filter(Boolean);

  if (divergences.length) {
    console.error(`✖ ${divergences.length}/${entries.length} DIVERGENCES (5 premières) :`);
    for (const d of divergences.slice(0, 5)) console.error(JSON.stringify(d));
    process.exit(1);
  }
  console.log(`✔ 0 divergence sur ${entries.length} payloads uniques de trafic RÉEL.`);
}

main();
