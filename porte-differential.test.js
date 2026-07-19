// ═══════════════════════════════════════════════════════════════════════
// DIFFÉRENTIEL DE PORTE — doc-inject.js (nouveau) vs protect-files.js (prod).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Le différentiel moteur (file-differential) et le shadow prouvent le MATCH ;
//    CE test prouve la PORTE : contenu injecté À L'OCTET PRÈS (frontmatter
//    strippé pareil, même [source:], mêmes séparateurs), même decision ask/allow,
//    même systemMessage. C'est le gate de parité de la BASCULE.
//
// ⚠️ RUSH : l'ancien lit `.rush`, la porte lit `config.confirm` (#4). Le test lit
//    l'état RÉEL du .rush et donne à la porte la config équivalente — si les deux
//    mécanismes ne se miroir plus, ce test casse (c'est voulu : la session de
//    bascule doit reporter l'état du .rush dans mcp-doc-config.json).
//
// Skippé sur clone vierge (pas de parc réel). Spawns réels mais peu nombreux.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LEGACY = process.env.MCP_DOC_LEGACY_PATH || path.join(os.homedir(), '.claude', 'hooks', 'protect-files.js');
const PORTE = path.join(__dirname, 'doc-inject.js');
const parcPresent = fs.existsSync(LEGACY);

const RUSH = parcPresent && fs.existsSync(path.join(path.dirname(LEGACY), '.rush'));
const RUSH_PREFIX = '⚡ RUSH MODE — ask désactivé. Doc injectée :\n\n';

// Config de la porte MIROIR du rush réel + state isolé (jamais le vrai state/).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'porte-diff-'));
const CONFIG = path.join(TMP, 'config.json');
if (parcPresent) fs.writeFileSync(CONFIG, JSON.stringify(RUSH ? { confirm: false } : {}));

function runHook(script, payload, env) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, ...env } }, (_err, stdout) => {
      resolve(stdout.trim() === '' ? null : JSON.parse(stdout));
    });
    child.stdin.end(JSON.stringify({ tool_name: payload.toolName, tool_input: payload.toolInput, session_id: 'porte-diff' }));
  });
}

async function both(payload) {
  const [vieux, neuf] = await Promise.all([
    runHook(LEGACY, payload, {}),
    runHook(PORTE, payload, { MCP_DOC_CONFIG_PATH: CONFIG, MCP_DOC_STATE_DIR: path.join(TMP, 'state') }),
  ]);
  return { vieux, neuf };
}

// Payloads RÉELS (règles connues du parc) — lecture, écriture, Bash, non-match.
const HOOK_DIR = path.join(os.homedir(), '.claude', 'hooks');
const READ_MATCH = { toolName: 'Read', toolInput: { file_path: 'C:/Users/dev/Desktop/mcp-doc-hooks/lib-pure.js' } };

test.skipIf(!parcPresent)('LECTURE : contenu injecté IDENTIQUE à l\'octet près (ctx + systemMessage)', async () => {
  const { vieux, neuf } = await both(READ_MATCH);
  assert.ok(vieux && neuf, 'les deux moteurs doivent injecter sur ce payload connu');
  assert.strictEqual(vieux.hookSpecificOutput.permissionDecision, 'allow');
  assert.strictEqual(neuf.hookSpecificOutput.permissionDecision, 'allow');
  assert.strictEqual(neuf.hookSpecificOutput.additionalContext, vieux.hookSpecificOutput.additionalContext);
  assert.strictEqual(neuf.systemMessage, vieux.systemMessage);
});

test.skipIf(!parcPresent)('ÉCRITURE : décision miroir du rush réel, mêmes docs', async () => {
  const { vieux, neuf } = await both({ toolName: 'Edit', toolInput: { file_path: 'C:/Users/dev/Desktop/mcp-doc-hooks/lib-pure.js' } });
  assert.ok(vieux && neuf, 'les deux moteurs doivent réagir sur écriture documentée');
  if (RUSH) {
    assert.strictEqual(vieux.hookSpecificOutput.permissionDecision, 'allow');
    assert.strictEqual(neuf.hookSpecificOutput.permissionDecision, 'allow');
    assert.strictEqual(RUSH_PREFIX + neuf.hookSpecificOutput.additionalContext, vieux.hookSpecificOutput.additionalContext);
  } else {
    assert.strictEqual(vieux.hookSpecificOutput.permissionDecision, 'ask');
    assert.strictEqual(neuf.hookSpecificOutput.permissionDecision, 'ask');
    assert.strictEqual(neuf.hookSpecificOutput.permissionDecisionReason, vieux.hookSpecificOutput.permissionDecisionReason);
  }
});

test.skipIf(!parcPresent)('BASH : reconstruction cd && — mêmes docs injectées', async () => {
  const { vieux, neuf } = await both({ toolName: 'Bash', toolInput: { command: 'cd C:/Users/dev/Desktop/mcp-doc-hooks && node doctor.js' } });
  // Silence des deux OU injection identique — jamais l'un sans l'autre.
  assert.strictEqual(neuf === null, vieux === null, 'un moteur parle, l\'autre se tait');
  if (vieux) assert.strictEqual(neuf.hookSpecificOutput.additionalContext, vieux.hookSpecificOutput.additionalContext);
});

test.skipIf(!parcPresent)('GIT + NON-MATCH : silence des deux côtés', async () => {
  const git = await both({ toolName: 'Bash', toolInput: { command: 'git commit -m "fix lib-pure.js"' } });
  assert.strictEqual(git.vieux, null);
  assert.strictEqual(git.neuf, null);
  const rien = await both({ toolName: 'Read', toolInput: { file_path: 'C:/tmp/fichier-inconnu-xyz.txt' } });
  assert.strictEqual(rien.vieux, null);
  assert.strictEqual(rien.neuf, null);
});

test.skipIf(!parcPresent)('HOOK_DIR sanity : le parc réel existe bien là où on le croit', () => {
  assert.ok(fs.existsSync(HOOK_DIR));
});
