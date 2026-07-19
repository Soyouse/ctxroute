// ═══════════════════════════════════════════════════════════════════════
// Property-based de gate.js (fast-check) — invariants sur inputs GÉNÉRÉS.
// ⚠️ JAMAIS lancé par Stryker (non déterministe) : chaque invariant trouvé ici
//    DOIT avoir son cas déterministe dans gate.test.js (doctrine lib-pure.md).
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fc from 'fast-check';
import { decide } from './gate.js';

const docId = fc.constantFrom('docs/a.md', 'docs/b.md', 'docs/c.md', 'docs/d.md');
const mode = fc.constantFrom('dumb', 'once', 'smart', undefined);
const decl = fc.record({ mode, confirm: fc.option(fc.boolean(), { nil: undefined }) });
const decls = fc.dictionary(docId, decl, { maxKeys: 4 });
const entry = fc.oneof(
  fc.constant(null),
  fc.record({ seen: fc.constant(true), sinceLastCall: fc.nat({ max: 10 }) })
);
const state = fc.dictionary(docId, entry, { maxKeys: 4 });
const matched = fc.uniqueArray(docId, { maxLength: 4 });
const toolName = fc.constantFrom('Read', 'Edit', 'Write', 'Bash', 'mcp__ssh__ssh_exec');
const config = fc.record({
  mode,
  defaultThreshold: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
  confirm: fc.option(fc.boolean(), { nil: undefined }),
});

test('TOTALITÉ : jamais de throw, decision ∈ {none, allow, ask}', () => {
  fc.assert(fc.property(config, decls, matched, toolName, state, (c, d, m, t, s) => {
    const r = decide(c, d, m, t, s);
    assert.ok(['none', 'allow', 'ask'].includes(r.decision));
  }));
});

test('SOUS-SUITE : inject ⊆ matched, ordre préservé', () => {
  fc.assert(fc.property(config, decls, matched, toolName, state, (c, d, m, t, s) => {
    const r = decide(c, d, m, t, s);
    let i = 0;
    for (const doc of m) if (r.inject[i] === doc) i++;
    assert.strictEqual(i, r.inject.length, 'inject doit être une sous-suite ordonnée de matched');
  }));
});

test('PURETÉ : le state passé en argument n\'est JAMAIS muté', () => {
  fc.assert(fc.property(config, decls, matched, toolName, state, (c, d, m, t, s) => {
    const avant = JSON.stringify(s);
    decide(c, d, m, t, s);
    assert.strictEqual(JSON.stringify(s), avant);
  }));
});

test('none ⟺ inject vide (jamais un ask/allow sans doc)', () => {
  fc.assert(fc.property(config, decls, matched, toolName, state, (c, d, m, t, s) => {
    const r = decide(c, d, m, t, s);
    assert.strictEqual(r.decision === 'none', r.inject.length === 0);
  }));
});

test('CORPUS 100% DUMB : injecte tout, changed=false, state passthrough', () => {
  const dumbDecls = fc.dictionary(docId, fc.record({ mode: fc.constant('dumb') }), { maxKeys: 4 });
  fc.assert(fc.property(dumbDecls, matched, toolName, (d, m, t) => {
    const r = decide({ mode: 'dumb' }, d, m, t, {});
    assert.deepStrictEqual(r.inject, m);
    assert.strictEqual(r.changed, false);
    assert.deepStrictEqual(r.state, {});
  }));
});

test('CONVERGENCE once/smart : rejouer immédiatement le même appel = silence', () => {
  const quietDecls = fc.dictionary(docId, fc.record({ mode: fc.constantFrom('once', 'smart') }), { maxKeys: 4 });
  fc.assert(fc.property(quietDecls, fc.uniqueArray(docId, { minLength: 1, maxLength: 4 }), (d, m) => {
    // decls complètes pour toutes les docs matchées (mode non-dumb garanti).
    const full = { ...Object.fromEntries(m.map((x) => [x, { mode: 'once' }])), ...d };
    const r1 = decide({}, full, m, 'Read', {});
    const r2 = decide({}, full, m, 'Read', r1.state);
    assert.deepStrictEqual(r2.inject, [], 'le rejeu immédiat doit être silencieux');
    assert.strictEqual(r2.changed, false, 'le rejeu immédiat ne doit rien réécrire');
  }));
});
