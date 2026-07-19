// Tests DÉTERMINISTES de sources/session.js — cible Stryker (import DIRECT
// du module muté, toute évaluation DANS les callbacks — contrat perTest).
import { test, expect } from 'vitest';
import { sessionDocs } from './sources/session.js';

test('doc sans frontmatter : body trimé, id conservé', () => {
  const out = sessionDocs([{ doc: 'session/a.md', text: '  contenu A\n' }]);
  expect(out).toEqual([{ doc: 'session/a.md', body: 'contenu A' }]);
});

test('frontmatter retiré : seul le body est injecté', () => {
  const text = '---\nrank: 1\n---\ncorps utile\n';
  const out = sessionDocs([{ doc: 'session/b.md', text }]);
  expect(out).toEqual([{ doc: 'session/b.md', body: 'corps utile' }]);
});

test('ordre ALPHA par id, indépendant de l\'ordre du corpus', () => {
  const out = sessionDocs([
    { doc: 'session/z.md', text: 'Z' },
    { doc: 'session/a.md', text: 'A' },
    { doc: 'session/m.md', text: 'M' },
  ]);
  expect(out.map((d) => d.doc)).toEqual(['session/a.md', 'session/m.md', 'session/z.md']);
});

test('doc vide (ou vide après strip du frontmatter) = ignorée', () => {
  const out = sessionDocs([
    { doc: 'session/vide.md', text: '   \n' },
    { doc: 'session/fm-seul.md', text: '---\nrank: 2\n---\n\n' },
    { doc: 'session/ok.md', text: 'ok' },
  ]);
  expect(out).toEqual([{ doc: 'session/ok.md', body: 'ok' }]);
});

test('corpus vide = liste vide', () => {
  expect(sessionDocs([])).toEqual([]);
});
