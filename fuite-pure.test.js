// ⚠️ CE QUE CETTE SUITE PROTÈGE : la DÉCISION « ce texte contient-il une
//    donnée personnelle ? ». Elle est PURE et mutée par Stryker ; l'I/O
//    (git ls-files, lecture des fichiers, liste privée) vit dans
//    `fuite-perso-gate.test.js`. Même séparation que canari ⟷ canari-check :
//    le runner de mutation doit rester rapide et déterministe.
//
// ⚠️ AUCUNE DONNÉE PERSONNELLE ICI : les valeurs de test sont inventées
//    (« dupont », « boulangerie-durand »). Un test qui écrirait le vrai
//    prénom à protéger SERAIT la fuite qu'il prétend empêcher.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { motifsInterdits, scanner, echapper, dernierSegment } from './fuite-pure.js';

// ── LES MOTIFS ──────────────────────────────────────────────────────────
test('sans contexte : seuls email et IP réelle restent couverts', () => {
  assert.equal(motifsInterdits(undefined, undefined, undefined).length, 2);
});

test('un terme trop court n\'invente AUCUN motif', () => {
  // ⚠️ Un terme de 1-2 caractères matcherait la moitié du dépôt : le gate
  //    serait rouge en permanence, donc débranché.
  assert.equal(motifsInterdits('ab', '', ['x']).length, 2);
  assert.equal(motifsInterdits('abc', '', []).length, 3);
  assert.equal(motifsInterdits('', '', ['abcd']).length, 3);
});

test('un terme présent 2× ne crée qu\'UN motif (dédup)', () => {
  const m = motifsInterdits('dupont', 'C:/Users/dupont', ['dupont']);
  assert.equal(m.filter((x) => x.nom.includes('dupont')).length, 1);
});

test('entrées non-chaîne / non-tableau : ignorées, jamais un throw', () => {
  assert.equal(motifsInterdits(42, {}, 'pas un tableau').length, 2);
  assert.equal(motifsInterdits(null, null, [42, null, 'valide']).length, 3);
});

// ── FRONTIÈRES DE MOT (le faux positif qui tue un gate) ─────────────────
test('FRONTIÈRES DE MOT : un prénom ne matche pas le mot qui le contient', () => {
  // ⚠️ Cas RÉEL du 04/08/2026 : le prénom du mainteneur est un sous-mot
  //    d'un mot courant — le gate rougissait sur `frontmatter.js` et le skill,
  //    deux faux positifs. Un gate qui crie sur du sain cesse d'être lu, et
  //    le jour où il a raison personne ne le croit.
  const m = motifsInterdits(undefined, undefined, ['Marc']);
  assert.deepEqual(scanner('un piège marchand', m), []);
  assert.deepEqual(scanner('sur le marché', m), []);
  assert.equal(scanner('écrit par Marc', m).length, 1);
  assert.equal(scanner('(Marc)', m).length, 1);
  assert.equal(scanner('Marc, le mainteneur', m).length, 1);
});

test('la casse est ignorée (une fuite en majuscules reste une fuite)', () => {
  const m = motifsInterdits(undefined, undefined, ['dupont']);
  assert.equal(scanner('DUPONT', m).length, 1);
});

// ── LE CHEMIN PERSONNEL ─────────────────────────────────────────────────
test('dernierSegment : le dossier UTILISATEUR, jamais la racine générique', () => {
  // ⚠️ Prendre TOUS les segments donnerait « Users », présent dans chaque
  //    chemin d'exemple du dépôt (`C:/Users/dev/...`, la convention
  //    documentée) : 6 faux positifs mesurés le 04/08/2026.
  assert.equal(dernierSegment('C:/Users/dev'), 'dev');
  assert.equal(dernierSegment('C:\\Users\\dev\\'), 'dev');
  assert.equal(dernierSegment('/home/dev'), 'dev');
  assert.equal(dernierSegment(''), '');
});

test('echapper : un chemin Windows devient un LITTÉRAL, jamais un joker', () => {
  // ⚠️ Sans échappement, `C:\Users\x` contient `\U` et `.` : la regex
  //    matcherait presque tout et le gate hurlerait sur le dépôt entier.
  const re = new RegExp(echapper('C:\\Users\\dev'));
  assert.ok(re.test('C:\\Users\\dev'));
  assert.ok(!re.test('CxUsersxdev'));
  assert.equal(echapper('a.b*c'), 'a\\.b\\*c');
});

// ── LES MOTIFS GÉNÉRIQUES ───────────────────────────────────────────────
test('EMAIL : un domaine réel est refusé, les domaines de documentation non', () => {
  // ⚠️ RFC 2606 réserve example./test. à la documentation : ce sont les
  //    SEULS emails admissibles dans un dépôt public.
  const m = motifsInterdits(undefined, undefined, []);
  assert.equal(scanner('contact: quelquun@societe.fr', m).length, 1);
  assert.deepEqual(scanner('contact: dev@example.com', m), []);
  assert.deepEqual(scanner('contact: qa@test.org', m), []);
});

test('IP : le bloc CGNAT (machines réelles) est refusé, ses bornes non', () => {
  const m = motifsInterdits(undefined, undefined, []);
  assert.equal(scanner('vps 100.88.41.95', m).length, 1);
  assert.equal(scanner('vps 100.64.0.0', m).length, 1);
  assert.equal(scanner('vps 100.127.255.255', m).length, 1);
  // Hors du bloc 100.64.0.0/10 : espace public quelconque, pas nos machines.
  assert.deepEqual(scanner('100.63.0.1', m), []);
  assert.deepEqual(scanner('100.128.0.1', m), []);
});

test('IP : les plages de DOCUMENTATION restent autorisées', () => {
  // ⚠️ La doctrine IMPOSE d'écrire 203.0.113.x dans les exemples. Un gate qui
  //    les interdirait rendrait sa propre règle inapplicable.
  const m = motifsInterdits(undefined, undefined, []);
  assert.deepEqual(scanner('demo 203.0.113.7', m), []);
  assert.deepEqual(scanner('local 127.0.0.1', m), []);
  assert.deepEqual(scanner('bind 0.0.0.0', m), []);
});

// ── TOTALITÉ ────────────────────────────────────────────────────────────
test('scanner : TOTAL — entrées absurdes, jamais un throw', () => {
  const m = motifsInterdits('dupont', 'C:/Users/dupont', []);
  for (const mauvais of [undefined, null, 42, {}, []]) {
    assert.deepEqual(scanner(mauvais, m), []);
    assert.deepEqual(scanner('texte', mauvais), []);
  }
});

test('scanner : rend le MOTIF et l\'EXTRAIT (un gate muet est inutilisable)', () => {
  // ⚠️ Le message doit dire QUOI retirer et OÙ : sans l'extrait, l'auteur
  //    cherche à l'aveugle et finit par débrancher le gate.
  const m = motifsInterdits(undefined, undefined, ['dupont']);
  const r = scanner('auteur : dupont', m);
  assert.equal(r.length, 1);
  assert.match(r[0].nom, /dupont/);
  assert.equal(r[0].extrait, 'dupont');
});

test('NEGATIVE-CHECK : un texte propre ne déclenche RIEN', () => {
  // ⚠️ Sans ce cas, « tout est une fuite » passerait tous les autres tests.
  const m = motifsInterdits('dupont', 'C:/Users/dupont', ['Marc', 'boulangerie-durand']);
  assert.deepEqual(scanner('const x = 1; // rien de personnel ici', m), []);
  assert.deepEqual(scanner('chemin de fixture : C:/Users/dev/projet', m), []);
});
