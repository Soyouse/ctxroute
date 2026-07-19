// Intégration de la PORTE SESSION (spawn réel, corpus/config tmpdir jetables —
// JAMAIS les fichiers livrés, cf paths.js). Contrat SessionStart de Claude Code.
import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(fileURLToPath(new URL('.', import.meta.url)), 'session-inject.js');

function run({ docs = null, config = null, stdin } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'session-inject-'));
  const docsDir = join(base, 'session');
  if (docs) {
    mkdirSync(docsDir, { recursive: true });
    for (const [name, text] of Object.entries(docs)) writeFileSync(join(docsDir, name), text);
  }
  const configPath = join(base, 'config.json');
  if (config) writeFileSync(configPath, JSON.stringify(config));
  return spawnSync(process.execPath, [HOOK], {
    input: stdin !== undefined ? stdin : JSON.stringify({ hook_event_name: 'SessionStart', source: 'compact' }),
    encoding: 'utf8',
    env: {
      ...process.env,
      MCP_DOC_SESSIONDOCS_DIR: docsDir,
      MCP_DOC_CONFIG_PATH: configPath,
      MCP_DOC_STATE_DIR: join(base, 'state'),
    },
  });
}

test('injecte toutes les docs session, ordre alpha, contrat SessionStart', () => {
  const r = run({ docs: { 'b.md': 'DOC-B', 'a.md': '---\nrank: 1\n---\nDOC-A' } });
  expect(r.status).toBe(0);
  const out = JSON.parse(r.stdout);
  expect(out.hookSpecificOutput.hookEventName).toBe('SessionStart');
  const ctx = out.hookSpecificOutput.additionalContext;
  // Ordre alpha + frontmatter retiré + label [source:] par doc.
  expect(ctx).toBe(
    'DOC-A\n[source: docs/session/a.md]\n\n---\n\nDOC-B\n[source: docs/session/b.md]'
  );
});

test('dossier vide = silence total (exit 0, aucun stdout)', () => {
  const r = run({ docs: {} });
  expect(r.status).toBe(0);
  expect(r.stdout).toBe('');
});

test('dossier docs/session ABSENT = fail-open silencieux', () => {
  const r = run({});
  expect(r.status).toBe(0);
  expect(r.stdout).toBe('');
});

test('stdin malformé = fail-open silencieux', () => {
  const r = run({ docs: { 'a.md': 'A' }, stdin: 'pas du json{{' });
  expect(r.status).toBe(0);
  expect(r.stdout).toBe('');
});

test('enabled: false coupe la porte session comme le reste du framework', () => {
  const r = run({ docs: { 'a.md': 'A' }, config: { enabled: false } });
  expect(r.status).toBe(0);
  expect(r.stdout).toBe('');
});

test('config absente = défauts fail-open : le framework INJECTE', () => {
  const r = run({ docs: { 'a.md': 'A' } });
  expect(r.status).toBe(0);
  expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toContain('A');
});
