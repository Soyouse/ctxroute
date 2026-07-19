// ═══════════════════════════════════════════════════════════════════════
// PROPERTY-BASED — migrate.js : round-trip + convergence
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CE MODULE ÉCRIRA DANS 288 DOCS RÉELLES à l'étape 2. C'est le SEUL composant
//    du refactor qui MUTE les fichiers du mainteneur. Les cas à la main ne couvrent que
//    ce à quoi j'ai pensé — c'est exactement le trou qui a laissé passer le bug
//    `serverName` de lib-pure.js (trouvé par fast-check en 259 runs, raté par
//    117 tests déterministes).
//
// DEUX PROPERTIES EXIGÉES PAR LA DOCTRINE, aucune n'existait avant cet audit :
//  1. PAIRE ENCODE↔DECODE  -> round-trip `parse(serialize(x)) === x`.
//     Sans elle : `serialize` écrit un format que `parse` ne relit pas
//     -> 288 docs SILENCIEUSEMENT MORTES = le bug exact que ce refactor tue.
//  2. PLAN IDEMPOTENT      -> convergence : rejouer = ZÉRO action.
//     Sans elle : crash à mi-course + rejeu = frontmatters DOUBLÉS = corruption.
//
// ⚠️ PAS lancé par Stryker (unit only) : toute garde prouvée ici DOIT AUSSI avoir
//    son cas déterministe dans `migrate.test.js`, sinon le mutant survit.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fc from 'fast-check';
import { serialize, planifier, declaration, grouper } from './migrate.js';
import { parse, validate } from './frontmatter.js';

const RUNS = { numRuns: 1000 };

// Générateur de patterns RÉALISTES : ce que contient vraiment protected-paths.json
// (noms de fichiers, dossiers). ⚠️ Exclut les caractères que le format ne supporte
// pas (`,` `[` `]` `:` retours ligne) — les accepter serait une AUTRE property.
const pattern = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim() === s && s !== '' && !/[\r\n,:'"[\]#]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) && s !== 'true' && s !== 'false');

const regle = fc.record(
  {
    pattern,
    doc: fc.string({ minLength: 1, maxLength: 20 }).map((s) => 'docs/' + s.replace(/[\r\n]/g, '') + '.md'),
    scope: fc.option(fc.array(pattern, { minLength: 1, maxLength: 3 }), { nil: undefined }),
    exclude: fc.option(fc.array(pattern, { minLength: 1, maxLength: 2 }), { nil: undefined }),
  },
  { requiredKeys: ['pattern', 'doc'] }
);

test('ROUND-TRIP — parse(serialize(x)) rend EXACTEMENT x', () => {
  fc.assert(
    fc.property(fc.array(regle, { minLength: 1, maxLength: 4 }), fc.nat({ max: 500 }), (entries, rank) => {
      const decl = declaration(entries, rank);
      const relu = parse(serialize(decl) + 'corps de la doc').data;

      // ⚠️ Comparaison champ par champ : c'est le CONTRAT entre le migrateur
      //    (écrit) et le moteur (lit). S'il casse, les docs sont muettes.
      assert.deepStrictEqual(relu.match, decl.match, 'match perdu au round-trip');
      // ⚠️ Docs à scopes DIVERGENTS (31/103 mesurées) → `rules:` JSON par-entrée.
      //    Sans cette branche, la property serait AVEUGLE au format qui porte
      //    précisément les cas les plus dangereux (scope perdu = sur-injection).
      assert.deepStrictEqual(relu.rules, decl.rules, 'rules perdu au round-trip');
      assert.strictEqual(relu.confirm, true, 'confirm perdu → des `ask` disparaissent en silence');
      assert.strictEqual(relu.rank, rank, 'rank perdu → ordre parent→enfant cassé');
      if (decl.scope) assert.deepStrictEqual(relu.scope, decl.scope, 'scope perdu');
      if (decl.exclude) assert.deepStrictEqual(relu.exclude, decl.exclude, 'exclude perdu');
      return true;
    }),
    RUNS
  );
});

test('ROUND-TRIP — ce que serialize écrit est TOUJOURS valide pour le gate', () => {
  // ⚠️ Le gate de frontmatter refuse une déclaration invalide. Si le migrateur
  //    produisait un frontmatter que `validate` rejette, les 288 docs seraient
  //    rouges au gate — ou pire, acceptées et inertes.
  fc.assert(
    fc.property(fc.array(regle, { minLength: 1, maxLength: 4 }), fc.nat({ max: 500 }), (entries, rank) => {
      const relu = parse(serialize(declaration(entries, rank)) + 'corps').data;
      assert.deepStrictEqual(validate(relu), [], `le migrateur produit un frontmatter INVALIDE : ${JSON.stringify(relu)}`);
      return true;
    }),
    RUNS
  );
});

test('ROUND-TRIP — le CORPS de la doc est préservé intact', () => {
  // ⚠️ Le frontmatter est PRÉFIXÉ au .md existant : le contenu ne doit pas bouger
  //    d'un octet. Une doc amputée = un invariant perdu pour l'agent.
  fc.assert(
    fc.property(fc.string(), (corps) => {
      const decl = { match: 'x.js', confirm: true, rank: 0 };
      const r = parse(serialize(decl) + corps);
      if (!/^﻿?---[ \t]*\r?\n/.test(corps)) assert.strictEqual(r.body, corps, 'corps de la doc altéré');
      return true;
    }),
    RUNS
  );
});

// ── Faux état pour piloter le plan sans I/O ──
const etat = (docsExistants, docsAvecFm) => ({
  existe: (d) => docsExistants.has(d),
  aDejaFrontmatter: (d) => docsAvecFm.has(d),
});

test('CONVERGENCE — rejouer le plan donne ZÉRO action (idempotence)', () => {
  // ⚠️ LA property qui protège d'une corruption réelle : crash à mi-course +
  //    rejeu ne DOIT jamais doubler un frontmatter sur une doc du mainteneur.
  fc.assert(
    fc.property(fc.array(regle, { minLength: 1, maxLength: 8 }), (rules) => {
      const docs = new Set(rules.map((r) => r.doc));
      const avecFm = new Set();

      const p1 = planifier(rules, etat(docs, avecFm));
      // On simule l'application : chaque doc traitée porte désormais un frontmatter.
      for (const a of p1.actions) avecFm.add(a.doc);

      const p2 = planifier(rules, etat(docs, avecFm));
      assert.deepStrictEqual(p2.actions, [], 'le 2ᵉ passage veut RE-écrire → frontmatter doublé, doc corrompue');

      const p3 = planifier(rules, etat(docs, avecFm));
      assert.deepStrictEqual(p3.actions, [], 'non convergent au 3ᵉ passage');
      return true;
    }),
    RUNS
  );
});

test('CONVERGENCE — une reprise APRÈS CRASH à mi-course converge sans dégât', () => {
  // ⚠️ Crash réel : la moitié des docs écrites, l'autre non. Rejouer doit finir
  //    le travail SANS retoucher les premières.
  fc.assert(
    fc.property(fc.array(regle, { minLength: 2, maxLength: 8 }), (rules) => {
      const docs = new Set(rules.map((r) => r.doc));
      const avecFm = new Set();

      const p1 = planifier(rules, etat(docs, avecFm));
      const moitie = p1.actions.slice(0, Math.ceil(p1.actions.length / 2));
      for (const a of moitie) avecFm.add(a.doc); // crash ici

      const p2 = planifier(rules, etat(docs, avecFm));
      for (const a of p2.actions) {
        assert.ok(!avecFm.has(a.doc), `reprise veut RÉ-écrire une doc déjà migrée : ${a.doc}`);
      }
      // Le total couvre bien tout le parc, sans doublon.
      assert.strictEqual(moitie.length + p2.actions.length, p1.actions.length, 'reprise a perdu ou dupliqué des docs');
      return true;
    }),
    RUNS
  );
});

test('SÉCURITÉ — une règle sans .md est SIGNALÉE, jamais migrée en silence', () => {
  fc.assert(
    fc.property(fc.array(regle, { minLength: 1, maxLength: 6 }), (rules) => {
      const p = planifier(rules, etat(new Set(), new Set())); // aucun .md n'existe
      assert.deepStrictEqual(p.actions, [], 'a planifié une écriture sur un .md inexistant');
      assert.strictEqual(p.morts.length, new Set(rules.map((r) => r.doc)).size, 'règles mortes non signalées');
      return true;
    }),
    RUNS
  );
});

test('RANK — dérivé de l\'index JSON, jamais renuméroté', () => {
  // ⚠️ L'ordre parent→enfant vit dans l'ordre des LIGNES de protected-paths.json.
  //    Le rank DOIT refléter l'index de la PREMIÈRE règle visant la doc.
  fc.assert(
    fc.property(fc.array(regle, { minLength: 1, maxLength: 10 }), (rules) => {
      const groupes = grouper(rules);
      for (const [doc, { rank }] of groupes) {
        const premier = rules.findIndex((r) => r.doc === doc);
        assert.strictEqual(rank, premier, `rank ${rank} ≠ index de la 1ʳᵉ règle ${premier} pour ${doc}`);
      }
      return true;
    }),
    RUNS
  );
});
