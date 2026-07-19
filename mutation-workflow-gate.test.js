// ═══════════════════════════════════════════════════════════════════════
// GATE — le workflow de mutation DOIT être le miroir de stryker.conf.json
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RAISON D'ÊTRE : `paths:` de GitHub Actions et `mutate`/`commandRunner` de
//    Stryker sont DEUX VÉRITÉS sur une seule question — « quels fichiers
//    justifient de relancer la mutation ? ». Sans ce gate, ajouter un module à
//    `mutate` en oubliant `paths:` donne : le module est muté, mais le job ne
//    se déclenche JAMAIS quand il change ⇒ perte de couverture TOTALE et
//    SILENCIEUSE, avec une CI qui reste verte.
//
//    C'est la classe de bug exacte que tout ce repo combat (deux sources qui
//    dérivent sans rien afficher) — l'introduire dans le gate ANTI-dérive
//    serait l'ironie ultime. Posé dans le MÊME geste que le workflow.
//
// ⚠️ VOLONTAIREMENT PAS un test pur : il valide des ARTEFACTS LIVRÉS (comme
//    config-gate.test.js), donc il lit les vrais fichiers, en dur, sans passer
//    par paths.js — il doit rester aveugle à toute surcharge d'environnement.
//    Il n'est PAS dans le runner Stryker (il n'y a aucune décision à muter).
//
// ⚠️ PARSING VOLONTAIREMENT BÊTE (regex sur les lignes `- 'x'`) : dépendre
//    d'un parser YAML pour lire notre propre workflow ajouterait une dépendance
//    et une surface de bug pour lire 13 lignes connues. Même doctrine que le
//    sous-ensemble YAML de frontmatter.js.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const WF = path.join(RACINE, '.github', 'workflows', 'mutation.yml');
const STRYKER = path.join(RACINE, 'stryker.conf.json');
const VITEST_STRYKER = path.join(RACINE, 'vitest.stryker.config.mjs');

const yml = fs.readFileSync(WF, 'utf8');
const conf = JSON.parse(fs.readFileSync(STRYKER, 'utf8'));
const vitestStryker = fs.readFileSync(VITEST_STRYKER, 'utf8');

// Extrait les entrées `- 'x'` du bloc `paths:` (jusqu'à la prochaine clé).
function pathsDuWorkflow() {
  const bloc = /\n\s*paths:\s*\n([\s\S]*?)\n\s{2}\w+:/.exec(yml);
  assert.ok(bloc, 'bloc `paths:` introuvable dans mutation.yml — le filtre a disparu ?');
  return [...bloc[1].matchAll(/^\s*-\s*'([^']+)'/gm)].map((m) => m[1]);
}

// Les suites réellement lancées par Stryker = l'`include` de la config vitest
// DÉDIÉE (vitest.stryker.config.mjs). Même doctrine de parsing bête : regex
// sur les littéraux `'x.test.js'`, pas d'import ESM dynamique pour lire 5 lignes.
function suitesDuRunner() {
  return [...vitestStryker.matchAll(/'([^']+\.test\.js)'/g)].map((m) => m[1]);
}

test('GATE : tout module muté déclenche le workflow de mutation', () => {
  const paths = pathsDuWorkflow();
  assert.ok(Array.isArray(conf.mutate) && conf.mutate.length > 0, 'stryker `mutate` vide — le harnais ne prouve rien');
  for (const f of conf.mutate) {
    assert.ok(paths.includes(f),
      `\`${f}\` est MUTÉ par Stryker mais absent des \`paths:\` de mutation.yml :\n` +
      '      le job ne se déclenchera JAMAIS quand ce fichier change = couverture perdue EN SILENCE.');
  }
});

test('GATE : toute suite lancée par Stryker déclenche le workflow', () => {
  const paths = pathsDuWorkflow();
  const suites = suitesDuRunner();
  assert.ok(suites.length > 0, 'aucune suite trouvée dans `vitest.stryker.config.mjs` — le harnais ne prouve rien');
  for (const s of suites) {
    assert.ok(paths.includes(s),
      `\`${s}\` est lancée par Stryker mais absente des \`paths:\` : une modif de ce test\n` +
      '      pourrait casser le score sans que personne ne le voie.');
  }
});

// ⚠️ Sans ça, un `paths:` pourrait citer un fichier SUPPRIMÉ depuis longtemps :
//    le filtre paraîtrait complet alors qu'il protège un fantôme.
test('GATE : aucun `paths:` ne vise un fichier inexistant', () => {
  for (const p of pathsDuWorkflow()) {
    assert.ok(fs.existsSync(path.join(RACINE, p)), `\`${p}\` est filtré dans mutation.yml mais n'existe pas.`);
  }
});

// ⚠️ La config de mutation ET les deps DOIVENT re-déclencher : changer un seuil
//    ou une version de Stryker sans relancer = un score périmé qui fait autorité.
test('GATE : la config de mutation et les deps re-déclenchent le job', () => {
  const paths = pathsDuWorkflow();
  for (const f of ['stryker.conf.json', 'vitest.stryker.config.mjs', 'package.json', 'package-lock.json', '.github/workflows/mutation.yml']) {
    assert.ok(paths.includes(f), `\`${f}\` doit re-déclencher la mutation (sinon score périmé qui fait autorité).`);
  }
});

// ⚠️ NEGATIVE-CHECK : un gate qui ne peut pas échouer est pire qu'absent (leçon
//    du 15/07 : un test VERT qui n'exerce RIEN, 7 occurrences). On prouve que
//    la détection MORD, sans jamais toucher aux vrais fichiers.
test('NEGATIVE-CHECK : le gate DÉTECTE vraiment un module absent des paths', () => {
  const paths = pathsDuWorkflow();
  const faux = [...conf.mutate, 'module-jamais-filtre.js'];
  const manquants = faux.filter((f) => !paths.includes(f));
  assert.deepStrictEqual(manquants, ['module-jamais-filtre.js'],
    'le gate ne détecte pas un module absent : il ne prouve RIEN.');
});

// ⚠️ GATE ANTI-RÉGRESSION RUNNER (décision mainteneur 16/07/2026, cf
//    stryker-runner-choice.md) : node:test/commandRunner = le mode dégradé qui
//    coûtait 12 min PAR RUN (1 process Node par mutant, coverage off). Revenir
//    en arrière doit être IMPOSSIBLE en silence — pas une préférence, un gate.
test('GATE : le runner Stryker est vitest, JAMAIS command/commandRunner', () => {
  assert.strictEqual(conf.testRunner, 'vitest',
    `testRunner="${conf.testRunner}" : le mode dégradé commandRunner est BANNI (12 min/run mesurées le 15/07/2026).`);
  assert.ok(!('commandRunner' in conf),
    'clé `commandRunner` présente dans stryker.conf.json : vestige du mode dégradé, à supprimer.');
  assert.strictEqual(conf.coverageAnalysis, 'perTest',
    'coverageAnalysis doit rester "perTest" : c\'est TOUT le gain du runner vitest (un mutant ne relance que les tests qui le couvrent).');
});

// ⚠️ Le gain perTest exige des test() GRANULAIRES : un retour de node:test dans
//    une suite Stryker (require/import de node:test) recréerait la dette bannie.
test('GATE : aucune suite Stryker n\'importe node:test', () => {
  for (const s of suitesDuRunner()) {
    const src = fs.readFileSync(path.join(RACINE, s), 'utf8');
    assert.ok(!/['"]node:test['"]/.test(src),
      `\`${s}\` importe node:test : BANNI (16/07/2026) — vitest uniquement.`);
  }
});

test('NEGATIVE-CHECK : le parseur de `paths:` lit vraiment le fichier', () => {
  const paths = pathsDuWorkflow();
  assert.ok(paths.length >= 10, `parsing suspect : ${paths.length} paths lus, attendu >= 10`);
  assert.ok(paths.includes('lib-pure.js'), 'parsing cassé : lib-pure.js devrait être filtré');
});
