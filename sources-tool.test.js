// ═══════════════════════════════════════════════════════════════════════
// Tests DÉTERMINISTES de sources/tool.js (module PUR, muté Stryker).
// Déclencheur `tool:` = nom EXACT d'un outil natif — l'angle mort
// WebFetch/WebSearch comblé le 19/07/2026 (prouvé muet par spawn avant).
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { matchingDocs, toolList } from './sources/tool.js';

const doc = (name, fm) => ({ doc: `docs/${name}.md`, fm });
const payload = (toolName, toolInput = {}) => ({ toolName, toolInput });

test('toolList : chaîne → liste à 1, liste → telle quelle, absent/mal typé → []', () => {
  assert.deepStrictEqual(toolList({ tool: 'WebFetch' }), ['WebFetch']);
  assert.deepStrictEqual(toolList({ tool: ['WebFetch', 'WebSearch'] }), ['WebFetch', 'WebSearch']);
  assert.deepStrictEqual(toolList({}), []);
  assert.deepStrictEqual(toolList({ tool: 42 }), []);
});

test('match EXACT sur le nom d\'outil — jamais substring, sensible à la casse', () => {
  const docs = [doc('web', { tool: ['WebFetch', 'WebSearch'] })];
  assert.strictEqual(matchingDocs(docs, payload('WebFetch')).length, 1);
  assert.strictEqual(matchingDocs(docs, payload('WebSearch')).length, 1);
  // substring/casse = ZÉRO match (la disjonction des sémantiques, pas un détail)
  assert.strictEqual(matchingDocs(docs, payload('WebFetchPlus')).length, 0);
  assert.strictEqual(matchingDocs(docs, payload('webfetch')).length, 0);
  assert.strictEqual(matchingDocs(docs, payload('Read')).length, 0);
});

test('toolName vide/absent → silence total (jamais matcher "rien")', () => {
  const docs = [doc('web', { tool: 'WebFetch' })];
  assert.strictEqual(matchingDocs(docs, payload('')).length, 0);
  assert.strictEqual(matchingDocs(docs, {}).length, 0);
  assert.strictEqual(matchingDocs(docs, undefined).length, 0);
});

test('doc sans fm ou sans clé tool → ignorée sans throw (totalité)', () => {
  const docs = [{ doc: 'docs/x.md', fm: null }, doc('y', { match: 'a.js' })];
  assert.strictEqual(matchingDocs(docs, payload('WebFetch')).length, 0);
});

test('scope = ET sur les params concaténés (même sémantique que la source fichier)', () => {
  const docs = [doc('web', { tool: 'WebFetch', scope: ['docs.x.ai'] })];
  assert.strictEqual(matchingDocs(docs, payload('WebFetch', { url: 'https://docs.x.ai/api' })).length, 1);
  assert.strictEqual(matchingDocs(docs, payload('WebFetch', { url: 'https://autre.com' })).length, 0);
});

test('exclude = NON sur le contexte (ici le nom d\'outil)', () => {
  const docs = [doc('web', { tool: ['WebFetch', 'WebSearch'], exclude: ['WebSearch'] })];
  assert.strictEqual(matchingDocs(docs, payload('WebFetch')).length, 1);
  assert.strictEqual(matchingDocs(docs, payload('WebSearch')).length, 0);
});

test('ordre du corpus préservé + refs {doc}', () => {
  const docs = [doc('a', { tool: 'X' }), doc('b', { tool: 'X' })];
  assert.deepStrictEqual(matchingDocs(docs, payload('X')), [{ doc: 'docs/a.md' }, { doc: 'docs/b.md' }]);
});
