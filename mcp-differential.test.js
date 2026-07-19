// ═══════════════════════════════════════════════════════════════════════
// DIFFÉRENTIEL MCP — vieux moteur (mcp-doc-inject.js) vs porte unique
// (doc-inject.js, source sources/mcp.js), par SPAWN RÉEL sur corpus tmpdir.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Gate de parité du RETRAIT de mcp-doc-inject.js (fusion 17/07/2026) :
//    pour chaque séquence d'appels, les DEUX moteurs doivent injecter aux
//    MÊMES instants, avec le MÊME additionalContext (octet) et le MÊME
//    systemMessage. Rouge ici = la fusion a changé le comportement MCP.
//
// ⚠️ Les appels « étrangers » des séquences smart sont d'AUTRES serveurs MCP
//    (jamais des outils natifs) : les deux moteurs les voient quel que soit
//    leur matcher — le différentiel ne teste pas le câblage, il teste le moteur.
//
// ⚠️ Chaque moteur a SON state dir (même session_id) ; GC désactivée (proba 0).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

import { test as base, expect } from 'vitest';

// ⚠️ 7 spawns × 2 moteurs par séquence : sous la suite complète (machine
//    chargée), le défaut vitest (5 s) expire — 60 s = signal réel uniquement.
const test = (name, fn) => base(name, { timeout: 60000 }, fn);
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = import.meta.dirname;
const OLD = path.join(REPO, 'mcp-doc-inject.js');
const NEW = path.join(REPO, 'doc-inject.js');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-diff-'));
}

// Spawne un moteur sur un payload, retourne { context, systemMessage } (null si silence).
function run(engine, payload, env) {
  const r = spawnSync(process.execPath, [engine], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env, MCP_DOC_GC_PROBABILITY: '0' },
    timeout: 30000,
  });
  expect(r.status).toBe(0); // fail-open TOUJOURS exit 0
  const out = r.stdout.trim();
  if (!out) return null;
  const json = JSON.parse(out);
  return {
    context: json.hookSpecificOutput ? json.hookSpecificOutput.additionalContext : undefined,
    systemMessage: json.systemMessage,
  };
}

// Rejoue la MÊME séquence sur les deux moteurs (state dirs séparés) et exige
// des sorties IDENTIQUES appel par appel. Retourne les sorties (asserts inclus).
function differential(t, config, docs, sequence) {
  const base = mkTmp();
  try {
    const docsDir = path.join(base, 'docs-mcp');
    const emptyFileDocs = path.join(base, 'filedocs'); // corpus FICHIER vide → la porte n'a que la source MCP
    fs.mkdirSync(emptyFileDocs, { recursive: true });
    for (const [rel, content] of Object.entries(docs)) {
      const full = path.join(docsDir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    const configPath = path.join(base, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    const mkEnv = (stateDir) => ({
      MCP_DOC_CONFIG_PATH: configPath,
      MCP_DOC_DOCS_DIR: docsDir,
      MCP_DOC_STATE_DIR: stateDir,
      MCP_DOC_FILEDOCS_DIR: emptyFileDocs,
    });
    const envOld = mkEnv(path.join(base, 'state-old'));
    const envNew = mkEnv(path.join(base, 'state-new'));
    fs.mkdirSync(envOld.MCP_DOC_STATE_DIR);
    fs.mkdirSync(envNew.MCP_DOC_STATE_DIR);

    const outs = [];
    sequence.forEach((payload, i) => {
      const a = run(OLD, payload, envOld);
      const b = run(NEW, payload, envNew);
      expect(b, `appel #${i} (${payload.tool_name}) : sorties divergentes`).toEqual(a);
      outs.push(a);
    });
    return outs;
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

const SID = 'diff-session';
const call = (toolName, toolInput = {}) => ({ tool_name: toolName, tool_input: toolInput, session_id: SID });

const STRIPE_DOC = '⚠️ Ne jamais cliquer un bouton de paiement réel.\n';
const ODOO_DOC = '⚠️ Pas de payment.token stocké ici.\n';

test('dumb : réinjection à CHAQUE appel, contenu et badge identiques', () => {
  const outs = differential(test, { mode: 'dumb' }, { 'stripe.md': STRIPE_DOC }, [
    call('mcp__stripe__authenticate'),
    call('mcp__stripe__authenticate'),
    call('mcp__stripe__complete_authentication'),
  ]);
  for (const o of outs) {
    expect(o).not.toBeNull();
    expect(o.context).toContain('[source: docs/mcp/stripe.md]');
  }
});

test('once : 1er appel injecte, rappels silencieux', () => {
  const outs = differential(test, { mode: 'once' }, { 'stripe.md': STRIPE_DOC }, [
    call('mcp__stripe__authenticate'),
    call('mcp__stripe__authenticate'),
    call('mcp__stripe__authenticate'),
  ]);
  expect(outs[0]).not.toBeNull();
  expect(outs[1]).toBeNull();
  expect(outs[2]).toBeNull();
});

test('smart seuil 2 : réinjection après 2 appels MCP étrangers, pas avant', () => {
  const outs = differential(
    test,
    { mode: 'smart', defaultThreshold: 2 },
    { 'stripe.md': STRIPE_DOC, 'odoo.md': ODOO_DOC },
    [
      call('mcp__stripe__authenticate'), // stripe injecté (1er)
      call('mcp__stripe__authenticate'), // silence (compteur 0)
      call('mcp__odoo__odoo_call'),      // odoo injecté (1er) · stripe compteur 1
      call('mcp__stripe__authenticate'), // silence (1 < 2)
      call('mcp__odoo__odoo_call'),      // odoo silence · stripe compteur 1 (remis à 0 à l'appel 4)
      call('mcp__odoo__odoo_call'),      // odoo silence · stripe compteur 2
      call('mcp__stripe__authenticate'), // stripe RÉINJECTÉ (2 ≥ 2)
    ]
  );
  expect(outs.map((o) => (o ? 1 : 0))).toEqual([1, 0, 1, 0, 0, 0, 1]);
});

test('override serveur : stripe dumb/seuil 1 pendant que le global est smart', () => {
  const outs = differential(
    test,
    { mode: 'smart', defaultThreshold: 4, servers: { stripe: { mode: 'dumb', threshold: 1 } } },
    { 'stripe.md': STRIPE_DOC, 'odoo.md': ODOO_DOC },
    [
      call('mcp__stripe__authenticate'),
      call('mcp__stripe__authenticate'), // dumb → réinjecte quand même
      call('mcp__odoo__odoo_call'),
      call('mcp__odoo__odoo_call'),      // smart → silence
    ]
  );
  expect(outs.map((o) => (o ? 1 : 0))).toEqual([1, 1, 1, 0]);
});

test('granularité : server + tool + subTool concaténés, ordre et séparateur identiques', () => {
  const outs = differential(
    test,
    { mode: 'dumb', servers: { odoo: { subToolParam: 'args.tool' } } },
    {
      'odoo.md': ODOO_DOC,
      'odoo/odoo_call.md': 'Doc outil odoo_call.\n',
      'odoo/delete_record.md': '⚠️ delete_record est IRRÉVERSIBLE.\n',
    },
    [call('mcp__odoo__odoo_call', { args: { tool: 'delete_record' } })]
  );
  const ctx = outs[0].context;
  expect(ctx).toContain('[source: docs/mcp/odoo.md]');
  expect(ctx).toContain('[source: docs/mcp/odoo/odoo_call.md]');
  expect(ctx).toContain('[source: docs/mcp/odoo/delete_record.md]');
});

test('filtre whitelist : serveur exclu = silence des DEUX moteurs', () => {
  const outs = differential(
    test,
    { mode: 'dumb', filterMode: 'whitelist', filterList: ['odoo'] },
    { 'stripe.md': STRIPE_DOC },
    [call('mcp__stripe__authenticate')]
  );
  expect(outs[0]).toBeNull();
});

test('serveur sans doc : silence des deux moteurs', () => {
  const outs = differential(test, { mode: 'dumb' }, { 'stripe.md': STRIPE_DOC }, [
    call('mcp__umami__umami_call'),
  ]);
  expect(outs[0]).toBeNull();
});

test('showNotification: false → injection réelle, badge absent, des deux côtés', () => {
  const outs = differential(
    test,
    { mode: 'dumb', showNotification: false },
    { 'stripe.md': STRIPE_DOC },
    [call('mcp__stripe__authenticate')]
  );
  expect(outs[0].context).toContain('paiement');
  expect(outs[0].systemMessage).toBeUndefined();
});

test('enabled: false → silence total des deux moteurs', () => {
  const outs = differential(test, { mode: 'dumb', enabled: false }, { 'stripe.md': STRIPE_DOC }, [
    call('mcp__stripe__authenticate'),
  ]);
  expect(outs[0]).toBeNull();
});
