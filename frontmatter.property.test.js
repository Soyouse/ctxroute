// ═══════════════════════════════════════════════════════════════════════
// PROPERTY-BASED — frontmatter.js (parser → property-based AUTOMATIQUE)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Un parser reçoit des octets écrits par des HUMAINS et des SCRIPTS DE MIGRATION.
//    Les cas à la main ne couvrent que ce à quoi l'auteur a pensé — c'est
//    exactement ce trou qui a laissé passer le bug `serverName` de lib-pure.js
//    (trouvé par fast-check en 259 runs, raté par 117 tests déterministes).
//
// ⚠️ PAS lancé par Stryker (unit only) : toute garde prouvée ici DOIT AUSSI avoir
//    son cas déterministe dans frontmatter.test.js, sinon le mutant survit.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fc from 'fast-check';
import { parse, validate } from './frontmatter.js';

const RUNS = { numRuns: 1000 };

test('TOTALITÉ — parse ne throw JAMAIS, sur n\'importe quelle chaîne', () => {
  fc.assert(
    fc.property(fc.string(), (s) => {
      parse(s);
      return true;
    }),
    RUNS
  );
});

test('TOTALITÉ — parse ne throw JAMAIS, même sur du faux frontmatter généré', () => {
  // Générateur qui vise la ZONE DE DANGER : de vrais délimiteurs, du contenu hostile.
  const inner = fc.string();
  const doc = fc.tuple(inner, fc.string()).map(([a, b]) => `---\n${a}\n---\n${b}`);
  fc.assert(
    fc.property(doc, (s) => {
      parse(s);
      return true;
    }),
    RUNS
  );
});

test('TOTALITÉ — validate ne throw JAMAIS sur un objet arbitraire', () => {
  fc.assert(
    fc.property(fc.object(), (o) => {
      assert.ok(Array.isArray(validate(o)));
      return true;
    }),
    RUNS
  );
});

test('SANS FRONTMATTER — le body est le texte INTÉGRAL, jamais tronqué', () => {
  // ⚠️ Invariant critique : une doc sans déclaration doit garder son contenu entier.
  //    Tronquer = amputer silencieusement une doc dans le contexte de l'agent.
  fc.assert(
    fc.property(
      fc.string().filter((s) => !/^﻿?---[ \t]*\r?\n/.test(s)),
      (s) => {
        const r = parse(s);
        assert.strictEqual(r.body, s);
        assert.strictEqual(r.hasFrontmatter, false);
        assert.deepStrictEqual(r.data, {});
        return true;
      }
    ),
    RUNS
  );
});

test('ROUND-TRIP — une déclaration écrite est relue à l\'identique', () => {
  const key = fc.constantFrom('match', 'mode', 'rank', 'confirm');
  const safeStr = fc
    .string({ minLength: 1 })
    .filter((s) => s.trim() === s && s !== '' && !/[\r\n:'"\[\]#]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) && s !== 'true' && s !== 'false');

  fc.assert(
    fc.property(safeStr, fc.string(), (v, body) => {
      const r = parse(`---\nmatch: ${v}\n---\n${body}`);
      assert.strictEqual(r.data.match, v);
      assert.strictEqual(r.body, body);
      return true;
    }),
    RUNS
  );
  void key;
});

test('ROUND-TRIP — une liste écrite [a, b] est relue comme tableau', () => {
  const item = fc
    .string({ minLength: 1 })
    .filter((s) => s.trim() === s && !/[\r\n,:'"\[\]#]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) && s !== 'true' && s !== 'false');
  fc.assert(
    fc.property(fc.array(item, { minLength: 1, maxLength: 5 }), (items) => {
      const r = parse(`---\nmatch: x\nscope: [${items.join(', ')}]\n---\nbody`);
      assert.deepStrictEqual(r.data.scope, items);
      return true;
    }),
    RUNS
  );
});

test('SÉCURITÉ — une doc SANS `match` est TOUJOURS invalide (jamais silencieuse)', () => {
  // ⚠️ LA property qui protège du bug que ce refactor est censé tuer :
  //    une doc sans déclencheur ne doit jamais être « acceptée mais inerte ».
  fc.assert(
    fc.property(fc.object(), (o) => {
      const data = { ...o };
      delete data.match;
      assert.ok(validate(data).length > 0, 'doc sans match acceptée = doc morte en silence');
      return true;
    }),
    RUNS
  );
});

test('MULTI-MATCH — une liste de patterns est TOUJOURS acceptée', () => {
  // ⚠️ RÉGRESSION SCELLÉE (15/07/2026) : validate() n'acceptait que `match: <chaîne>`.
  //    Mesuré sur les vraies règles : 98 des 288 docs sont visées par PLUSIEURS
  //    patterns → un tiers du parc aurait été rejeté par le gate de migration.
  const pat = fc.string({ minLength: 1 }).filter((s) => s.trim() !== '');
  fc.assert(
    fc.property(fc.array(pat, { minLength: 1, maxLength: 6 }), (pats) => {
      assert.deepStrictEqual(validate({ match: pats }), [], `liste rejetée: ${JSON.stringify(pats)}`);
      return true;
    }),
    RUNS
  );
});

test('MULTI-MATCH — une liste VIDE ou mal typée reste TOUJOURS rejetée', () => {
  // La contrepartie : accepter les listes ne doit pas ouvrir la porte aux déclencheurs vides.
  fc.assert(
    fc.property(fc.oneof(fc.constant([]), fc.array(fc.integer(), { minLength: 1 }), fc.constant(''), fc.constant('   ')), (bad) => {
      assert.ok(validate({ match: bad }).length > 0, `match invalide accepté: ${JSON.stringify(bad)}`);
      return true;
    }),
    RUNS
  );
});

test('SÉCURITÉ — une clé inconnue est TOUJOURS rejetée (typo = doc morte)', () => {
  const typo = fc.string({ minLength: 1 }).filter((s) => !['match', 'scope', 'exclude', 'mode', 'confirm', 'rank'].includes(s));
  fc.assert(
    fc.property(typo, (k) => {
      const errs = validate({ match: 'x', [k]: 'v' });
      assert.ok(errs.length > 0, `clé inconnue ${JSON.stringify(k)} acceptée`);
      return true;
    }),
    RUNS
  );
});

test('IDEMPOTENCE — reparser un body déjà extrait ne le change plus', () => {
  fc.assert(
    fc.property(fc.string(), (body) => {
      const once = parse(`---\nmatch: x\n---\n${body}`).body;
      const twice = parse(once).body;
      // ⚠️ Sauf si le body commence lui-même par un frontmatter — cas légitime,
      //    on vérifie alors juste l'absence de crash (totalité déjà couverte).
      if (!/^﻿?---[ \t]*\r?\n/.test(once)) assert.strictEqual(twice, once);
      return true;
    }),
    RUNS
  );
});
