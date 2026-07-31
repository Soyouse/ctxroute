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

// ═══════════════════════════════════════════════════════════════════════
// JOKER `*` (31/07/2026, REFACTOR-PLAN §B/§B0)
// ⚠️ AVANT : `tool: ["*"]` était accepté par validate() ET ne matchait RIEN —
//    la syntaxe que tout le monde essaie spontanément était silencieusement
//    morte ET certifiée valide. Un PIÈGE ACTIF, pas une fonction absente.
// ⚠️ Ces tests scellent aussi §B0 : la NÉGATION devient utilisable sur l'axe
//    outil (`*` + exclude = « tous SAUF X »), qui était INEXPRIMABLE.
// ═══════════════════════════════════════════════════════════════════════

test('JOKER : `*` matche N\'IMPORTE QUEL outil (le geste, pas le lieu)', () => {
  const docs = [doc('geste', { tool: ['*'], scope: ['docker run'] })];
  // 4 canaux distincts : shell POSIX, shell Windows, outil MCP, outil natif.
  for (const outil of ['Bash', 'PowerShell', 'mcp__ssh__ssh_exec', 'OutilInventeDemain']) {
    assert.strictEqual(matchingDocs(docs, payload(outil, { command: 'docker run -d nginx' })).length, 1,
      `le joker doit matcher ${outil} — c'est tout son objet : ne PAS énumérer`);
  }
});

test('JOKER : cas NÉGATIF — nom d\'outil vide/absent ne matche JAMAIS', () => {
  // ⚠️ « n'importe quel outil » suppose qu'il y AIT un outil. Sans cette garde,
  //    un payload dégradé déclencherait toutes les docs joker du parc.
  const docs = [doc('geste', { tool: ['*'], scope: ['docker'] })];
  assert.strictEqual(matchingDocs(docs, payload('', { command: 'docker run' })).length, 0);
  assert.strictEqual(matchingDocs(docs, payload(undefined, { command: 'docker run' })).length, 0);
  assert.strictEqual(matchingDocs(docs, { toolInput: { command: 'docker run' } }).length, 0);
});

test('JOKER : `scope` FILTRE toujours — le joker n\'est pas un passe-droit', () => {
  const docs = [doc('geste', { tool: ['*'], scope: ['docker run'] })];
  assert.strictEqual(matchingDocs(docs, payload('Bash', { command: 'ls -la' })).length, 0,
    'sans le geste visé, le joker ne doit RIEN injecter');
});

test('§B0 : `*` + `exclude` = « TOUS LES OUTILS SAUF X » (inexprimable avant)', () => {
  const docs = [doc('partout', { tool: ['*'], exclude: ['Read'] })];
  assert.strictEqual(matchingDocs(docs, payload('Bash')).length, 1);
  assert.strictEqual(matchingDocs(docs, payload('Write')).length, 1);
  assert.strictEqual(matchingDocs(docs, payload('Read')).length, 0, 'l\'outil exclu ne doit PAS matcher');
});

test('JOKER : `*` mélangé à des noms explicites reste un joker (absorbe)', () => {
  const docs = [doc('mix', { tool: ['Bash', '*'], exclude: ['Read'] })];
  assert.strictEqual(matchingDocs(docs, payload('Bash')).length, 1);
  assert.strictEqual(matchingDocs(docs, payload('WebFetch')).length, 1);
  assert.strictEqual(matchingDocs(docs, payload('Read')).length, 0);
});

test('NON-RÉGRESSION : sans `*`, le matching reste EXACT (jamais substring)', () => {
  const docs = [doc('exact', { tool: ['Web'] })];
  assert.strictEqual(matchingDocs(docs, payload('WebFetch')).length, 0,
    'un nom partiel ne doit jamais matcher : la sémantique === est le contrat de cet axe');
  assert.strictEqual(matchingDocs(docs, payload('Web')).length, 1);
});
