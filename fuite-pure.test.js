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
import { motifsInterdits, scanner, echapper, dernierSegment, COMPTES_GENERIQUES } from './fuite-pure.js';

// ⚠️ ON N'ÉCRIT JAMAIS UNE IP DU BLOC CGNAT EN CLAIR ICI : ce fichier est
//    TRACKÉ, et le gate de ce même fichier l'interdit — à raison (il a
//    attrapé une IP de production RÉELLE écrite ici le 04/08/2026). On
//    l'assemble donc à l'exécution : le littéral n'existe dans aucun fichier.
const ip = (...o) => o.join('.');
// Même raison pour un email hors domaine réservé : on l'assemble.

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
  assert.equal(scanner('contact: ' + 'quelquun' + '@' + 'societe.fr', m).length, 1);
  assert.deepEqual(scanner('contact: dev@example.com', m), []);
  assert.deepEqual(scanner('contact: qa@test.org', m), []);
});

test('IP : le bloc CGNAT (machines réelles) est refusé, ses bornes non', () => {
  const m = motifsInterdits(undefined, undefined, []);
  assert.equal(scanner('vps ' + ip(100, 88, 41, 95), m).length, 1);
  assert.equal(scanner('vps ' + ip(100, 64, 0, 0), m).length, 1);
  assert.equal(scanner('vps ' + ip(100, 127, 255, 255), m).length, 1);
  // Hors du bloc 100.64/10 : espace public quelconque, pas nos machines.
  assert.deepEqual(scanner(ip(100, 63, 0, 1), m), []);
  assert.deepEqual(scanner(ip(100, 128, 0, 1), m), []);
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

// ── TROUS RÉVÉLÉS PAR LA MUTATION (04/08/2026, 10 survivants) ───────────
test('le DOSSIER PERSONNEL apporte son propre motif, distinct du compte OS', () => {
  // ⚠️ Sans ce cas, supprimer toute la branche « dossier personnel » passait
  //    VERT : les autres tests utilisaient un dossier dont le dernier segment
  //    ÉGALE le compte OS, donc la dédup masquait la perte.
  const m = motifsInterdits('compte', 'C:/Users/autre-dossier', []);
  assert.equal(m.length, 4, 'email + IP + compte + dossier');
  assert.equal(scanner('chemin C:/Users/autre-dossier/x', m).length, 1);
});

test('SEUIL de 3 caractères : exactement 3 compte, 2 ne compte pas', () => {
  // ⚠️ Frontière EXACTE, écrite en dur : un `>` au lieu d'un `>=` laisserait
  //    passer les termes de 3 lettres sans qu'aucun test ne bronche.
  assert.equal(motifsInterdits('', '/home/abc', []).length, 3, 'dossier de 3 = retenu');
  assert.equal(motifsInterdits('', '/home/ab', []).length, 2, 'dossier de 2 = ignoré');
  assert.equal(motifsInterdits('', '', ['abc']).length, 3, 'terme de 3 = retenu');
  assert.equal(motifsInterdits('', '', ['ab']).length, 2, 'terme de 2 = ignoré');
});

test('FRONTIÈRE GAUCHE : un terme collé à la fin d\'un mot ne compte pas', () => {
  // ⚠️ Trou trouvé par Stryker : seule la frontière DROITE était prouvée
  //    (« Marc » ⊄ « marchand »). Sans ce cas, retirer le `\b` de GAUCHE
  //    passait vert — et le gate aurait crié sur tout mot finissant par le
  //    terme. Les deux frontières, jamais une seule.
  const m = motifsInterdits(undefined, undefined, ['dupont']);
  assert.deepEqual(scanner('grandupont', m), [], 'collé à gauche : pas une occurrence');
  assert.equal(scanner('grand dupont', m).length, 1, 'détaché : occurrence');
});

test('chaque motif porte un LIBELLÉ qui dit ce qui a été trouvé', () => {
  // ⚠️ Un gate qui rend « violation » sans dire laquelle est inutilisable :
  //    l'auteur cherche à l'aveugle et finit par le débrancher. Les libellés
  //    sont donc du CONTRAT, pas de la décoration.
  const m = motifsInterdits(undefined, undefined, []);
  assert.equal(scanner('a' + '@' + 'societe.fr', m)[0].nom, 'email réel');
  assert.equal(scanner(ip(100, 88, 41, 95), m)[0].nom, 'IP de machine réelle (CGNAT/Tailscale)');
  assert.equal(
    scanner('dupont', motifsInterdits(undefined, undefined, ['dupont']))[0].nom,
    'donnée personnelle : dupont'
  );
});

// ── COMPTES GÉNÉRIQUES (régression CI du 04/08/2026) ────────────────────
test('un compte SYSTÈME/CI n\'est jamais traité comme une identité', () => {
  // ⚠️ RÉGRESSION RÉELLE : sur GitHub Actions le compte s'appelle `runner`.
  //    Dérivé tel quel, il matchait « test runner », « tap-runner »,
  //    « commandRunner »… → 13 faux positifs, CI ROUGE au premier push.
  //    Un gate rouge sur du sain finit débranché : ces noms sont ÉCARTÉS.
  //    Risque inverse nul — personne ne s'appelle « root » ni « runner ».
  const m = motifsInterdits('runner', '/home/runner', []);
  assert.equal(m.length, 2, 'aucun motif tiré d\'un compte générique');
  assert.deepEqual(scanner('le test runner vitest', m), []);
  assert.deepEqual(scanner('/home/runner/work/projet', m), []);
});

test('la casse ne contourne PAS le filtre des comptes génériques', () => {
  assert.equal(motifsInterdits('Runner', '/home/ROOT', []).length, 2);
});

test('un compte NON générique reste protégé (le filtre ne désarme pas tout)', () => {
  // ⚠️ Sans ce cas, écarter TOUS les comptes passerait vert : le gate
  //    n'aurait plus qu'email + IP et personne ne le verrait.
  const m = motifsInterdits('jdupont', '/home/jdupont', []);
  assert.equal(m.length, 3);
  assert.equal(scanner('/home/jdupont/x', m).length, 1);
});

test('un terme DÉCLARÉ générique est écarté lui aussi', () => {
  // Le filtre porte sur le littéral, jamais sur sa provenance.
  assert.equal(motifsInterdits('', '', ['runner', 'jdupont']).length, 3);
});

test('la liste des comptes génériques est un CONTRAT écrit en dur', () => {
  // ⚠️ Écrite EN DUR, jamais dérivée du code testé : un attendu qui mute AVEC
  //    le code rendrait chaque mutant invisible (précédent du parc, cf
  //    quality-configs). Ajouter un compte ici = choix DÉLIBÉRÉ, car chaque
  //    entrée DÉSARME une protection — la liste doit rester courte et justifiée.
  assert.deepEqual([...COMPTES_GENERIQUES].sort(), [
    'admin', 'administrator', 'build', 'builder', 'docker', 'github', 'home',
    'jenkins', 'root', 'runner', 'ubuntu', 'user', 'users', 'vagrant',
  ]);
});
