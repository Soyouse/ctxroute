// ═══════════════════════════════════════════════════════════════════════
// budget.js — suite DÉTERMINISTE (celle que Stryker mute).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI CETTE SUITE EXISTE EN PLUS DU PROPERTY-BASED : `vitest.stryker.
//    config.mjs` n'inclut QUE des suites déterministes — un property-test
//    rejoué par mutant rendrait le score flaky, donc MENTEUR. La règle du repo
//    est explicite : « leur invariant DOIT avoir son cas déterministe ici ».
//    Les deux sont complémentaires : property = preuve sur entrées générées,
//    ici = ancrage reproductible + matière à mutation.
//
// ⚠️ perTest : TOUTE évaluation du code muté vit DANS un `test()` — jamais une
//    const de fixture au niveau module (mutant « statique » couvert par aucun
//    test ⇒ survivant fantôme, mesuré 16/07/2026 : score 76,67 % au lieu de
//    99,33 %). Les fixtures ci-dessous sont donc des FONCTIONS.
//
// ⚠️ IMPORT DIRECT du module muté (jamais via un re-export) : le mapping
//    coverage perTest rate les tests passés par un re-export.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { planifier, planifierPaquets, DEFAUT_BUDGET, TAILLE_MARQUEUR, empreinte, tailleEnveloppe } from './budget.js';

// Fixtures = THUNKS (cf. perTest ci-dessus).
const seg = (id, n, label) => ({ id, text: 'x'.repeat(n), label: label || id + '.md' });
const segs = (n, taille) => Array.from({ length: n }, (_, k) => seg('d' + k, taille));

test('liste vide → rendu vide, aucune émission, aucun différé', () => {
  const r = planifier([], 5000);
  assert.strictEqual(r.texte, '');
  assert.deepStrictEqual(r.emis, []);
  assert.deepStrictEqual(r.differes, []);
  assert.strictEqual(r.marqueur, '');
});

test('entrée non-tableau → traitée comme vide (fail-soft, jamais un throw)', () => {
  // La porte est fail-open : un budget qui lèverait ferait taire l'injection.
  for (const mauvais of [undefined, null, 'texte', 42, {}]) {
    const r = planifier(mauvais, 5000);
    assert.strictEqual(r.texte, '');
    assert.deepStrictEqual(r.emis, []);
  }
});

test('CHEMIN NOMINAL : sous 50 % du budget → format HISTORIQUE, zéro enveloppe', () => {
  // ⚠️ C'est CE cas qui garantit la bascule sûre : le rendu doit être
  //    EXACTEMENT la concaténation d'avant, à l'octet.
  const liste = [seg('a', 100), seg('b', 100)];
  const r = planifier(liste, 5000);
  assert.strictEqual(r.texte, liste[0].text + '\n\n---\n\n' + liste[1].text);
  assert.deepStrictEqual(r.emis, ['a', 'b']);
  assert.deepStrictEqual(r.differes, []);
  assert.strictEqual(r.marqueur, '');
  assert.ok(!r.texte.includes('###FIN:'));
  assert.ok(!r.texte.includes('INJECTION SCELLÉE'));
});

test('un seul segment sous le seuil → rendu = son texte NU (pas de séparateur parasite)', () => {
  const r = planifier([seg('solo', 50)], 5000);
  assert.strictEqual(r.texte, 'x'.repeat(50));
});

test('AU-DELÀ de 50 % du budget → SCELLÉ (en-tête + marqueur de fin concordants)', () => {
  const r = planifier([seg('a', 600)], 1000);
  assert.ok(r.texte.startsWith('⚠️ INJECTION SCELLÉE'));
  assert.strictEqual(r.marqueur.length, TAILLE_MARQUEUR);
  assert.ok(r.texte.includes('###FIN:' + r.marqueur + '###'));
  assert.ok(r.texte.endsWith('###FIN:' + r.marqueur + '###'));
  assert.deepStrictEqual(r.emis, ['a']);
});

test('l\'en-tête ANNONCE le marqueur AVANT le contenu (survit à une troncature)', () => {
  // ⚠️ Une troncature garde le DÉBUT : si l'avertissement passait en pied, il
  //    serait coupé précisément dans le cas qu'il est censé couvrir.
  const r = planifier([seg('a', 600)], 1000);
  const posAnnonce = r.texte.indexOf('###FIN:' + r.marqueur + '###');
  const posContenu = r.texte.indexOf('xxx');
  assert.ok(posAnnonce < posContenu, 'le marqueur doit être annoncé avant le contenu');
});

test('MIXTE : ce qui ne rentre pas est DIFFÉRÉ, compté et NOMMÉ', () => {
  const liste = segs(6, 300);
  const r = planifier(liste, 1200);
  assert.ok(r.emis.length > 0, 'au moins un émis');
  assert.ok(r.differes.length > 0, 'au moins un différé');
  assert.strictEqual(r.emis.length + r.differes.length, 6); // CONSERVATION
  assert.ok(r.texte.includes(r.differes.length + ' doc(s) NON injectée(s)'));
  for (const d of r.differes) assert.ok(r.texte.includes(d.label), 'label cité : ' + d.label);
});

test('les émis sont un PRÉFIXE de l\'entrée (priorité `rank` honorée)', () => {
  const liste = segs(6, 300);
  const r = planifier(liste, 1200);
  assert.deepStrictEqual(r.emis, liste.slice(0, r.emis.length).map((s) => s.id));
});

test('RIEN ne rentre → annonce NUE, contenu jamais tronqué, rien perdu', () => {
  // ⚠️ On n'émet JAMAIS le segment coupé : ce serait rendre au harnais le pavé
  //    qu'il tronque en silence, c'est-à-dire le défaut d'origine.
  const r = planifier([seg('enorme', 50000)], 400);
  assert.deepStrictEqual(r.emis, []);
  assert.deepStrictEqual(r.differes.map((d) => d.id), ['enorme']);
  assert.ok(r.texte.includes('enorme.md'));
  assert.ok(!r.texte.includes('x'.repeat(1000)), 'le contenu ne doit PAS être émis');
});

test('le rendu tient dans le budget dès qu\'il porte du contenu', () => {
  for (const b of [900, 1500, 3000, 7000]) {
    const r = planifier(segs(8, 400), b);
    if (r.emis.length > 0) assert.ok(r.texte.length <= b, 'budget ' + b + ' dépassé : ' + r.texte.length);
  }
});

test('budget invalide → défaut FRAMEWORK (cascade autorité ①, jamais de blocage)', () => {
  for (const mauvais of [undefined, null, 0, -1, NaN, Infinity, 'x']) {
    const r = planifier([seg('a', 100)], mauvais);
    assert.deepStrictEqual(r.emis, ['a'], 'budget ' + String(mauvais));
  }
  assert.ok(DEFAUT_BUDGET > 0);
  assert.ok(Number.isInteger(DEFAUT_BUDGET));
});

test('DÉFAUT_BUDGET reste sous le plus bas seuil de harnais mesuré (10 000)', () => {
  // ⚠️ CLIQUET : Claude Code 2.1.220 coupe à 10 000 caractères par hook.
  //    Le défaut DOIT garder une marge — un seuil piloté à distance peut
  //    baisser sans mise à jour. Monter cette valeur = se remettre à découvert.
  assert.ok(DEFAUT_BUDGET < 10000, 'défaut au-dessus du seuil mesuré du harnais');
});

test('empreinte : déterministe, longueur fixe, sensible au contenu', () => {
  assert.strictEqual(empreinte('abc'), empreinte('abc'));
  assert.strictEqual(empreinte('abc').length, TAILLE_MARQUEUR);
  assert.notStrictEqual(empreinte('abc'), empreinte('abd'));
  assert.strictEqual(empreinte('').length, TAILLE_MARQUEUR);
});

test('empreinte : deux plans DIFFÉRENTS ne partagent pas le marqueur', () => {
  // Sinon un bloc tronqué pourrait « valider » le marqueur d'un autre bloc.
  const a = planifier([seg('a', 600)], 1000);
  const b = planifier([seg('b', 700)], 1000);
  assert.notStrictEqual(a.marqueur, b.marqueur);
});

test('tailleEnveloppe : valeur EXACTE (somme en-tête + pied, marqueur compris)', () => {
  // ⚠️ Ancrée au caractère : c'est ce qui rend le budget une BORNE sûre. Sans
  //    valeur exacte, un mutant qui soustrait au lieu d'additionner (ou qui
  //    vide le remplissage du marqueur) survit — et le budget devient faux
  //    en silence, donc la troncature revient (mesuré 31/07/2026).
  assert.strictEqual(tailleEnveloppe(), 223);
});

test('tailleEnveloppe : c\'est bien le SURCOÛT réel d\'un rendu scellé', () => {
  // Lien entre la constante et l'observable : un bloc scellé d'un seul segment
  // sans différé pèse exactement contenu + enveloppe.
  const r = planifier([seg('a', 600)], 1000);
  assert.deepStrictEqual(r.differes, []);
  assert.strictEqual(r.texte.length, 600 + tailleEnveloppe());
});

test('BORNE INCLUSIVE : un rendu qui pèse EXACTEMENT le budget est accepté', () => {
  // ⚠️ Tue le mutant `<=` → `<`. Un budget exclusif évincerait une doc alors
  //    qu'elle tient au caractère près — perte gratuite, et invisible.
  // ⚠️ Le cas de référence DOIT être en régime SCELLÉ : sous 50 % du budget on
  //    passe par le chemin nominal, et re-planifier avec la taille obtenue
  //    changerait de régime — on ne testerait plus la borne.
  const liste = segs(4, 300);
  const large = planifier(liste, 2000);
  assert.notStrictEqual(large.marqueur, '', 'cas de référence non scellé : le test ne prouverait rien');
  assert.deepStrictEqual(large.differes, []);
  const exact = planifier(liste, large.texte.length);
  assert.deepStrictEqual(exact.emis, large.emis);
  assert.strictEqual(exact.texte.length, large.texte.length);
});

test('DÉTERMINISME : deux appels identiques rendent le même octet', () => {
  const liste = segs(5, 350);
  assert.deepStrictEqual(planifier(liste, 1400), planifier(liste, 1400));
});

test('segment au texte vide : conservé, jamais silencieusement écarté', () => {
  const r = planifier([seg('vide', 0), seg('plein', 100)], 5000);
  assert.deepStrictEqual(r.emis, ['vide', 'plein']);
});

test('empreinte : valeurs de RÉFÉRENCE (ancre la boucle et le padding)', () => {
  // ⚠️ Valeurs figées volontairement : elles ancrent les BORNES de la boucle
  //    (un `i <= texte.length` lirait un charCodeAt hors chaîne = NaN) et le
  //    zéro-padding. Sans elles, ces mutants survivent (mesuré 31/07/2026).
  assert.strictEqual(empreinte('abc'), '0b873285');
  assert.strictEqual(empreinte(''), '00001505'); // padding à gauche visible
});

test('EN-TÊTE : texte EXACT — c\'est le contrat lu par l\'agent, pas un ornement', () => {
  // ⚠️ Ancré au caractère près : ces phrases SONT le mécanisme (elles disent à
  //    l'agent quoi faire s'il ne voit pas le marqueur). Une reformulation doit
  //    être un choix conscient, pas une dérive silencieuse.
  const r = planifier([seg('a', 600)], 1000);
  assert.ok(r.texte.includes('⚠️ INJECTION SCELLÉE — ce bloc se termine par ###FIN:' + r.marqueur + '###\n'));
  assert.ok(r.texte.includes('   Marqueur absent en fin de bloc = contenu TRONQUÉ par le harnais :\n'));
  assert.ok(r.texte.includes('   lis alors toi-même les fichiers cités ci-dessous. Ne devine pas.\n\n'));
});

test('ANNONCE : texte EXACT, préfixe de liste et séparateur de lignes', () => {
  const r = planifier(segs(6, 300), 1200);
  assert.ok(r.differes.length >= 2, 'il faut ≥ 2 différés pour observer le joint');
  assert.ok(r.texte.includes('\n\n⚠️ ' + r.differes.length + ' doc(s) NON injectée(s) faute de place dans cette trame.\n'));
  assert.ok(r.texte.includes('   Elles ne sont PAS optionnelles — lis-les si ton geste les touche :\n'));
  assert.ok(r.texte.includes('   - ' + r.differes[0].label));
  // Le joint entre deux différés DOIT être un retour ligne (sinon liste illisible).
  assert.ok(r.texte.includes('   - ' + r.differes[0].label + '\n   - ' + r.differes[1].label));
});

test('SCELLÉ SANS différé : aucune annonce parasite', () => {
  // ⚠️ Tue le mutant qui supprimerait le court-circuit `differes.length === 0` :
  //    on annoncerait « 0 doc(s) NON injectée(s) » sur un bloc complet.
  const r = planifier([seg('a', 600)], 1000);
  assert.deepStrictEqual(r.differes, []);
  assert.ok(!r.texte.includes('NON injectée'));
  assert.ok(!r.texte.includes('Stryker'));
});

// ═══════════════════════════════════════════════════════════════════════
// PAQUETS — cas déterministes (cf. property-based pour la conservation générée)
// ═══════════════════════════════════════════════════════════════════════

test('PARITÉ : nbPaquets absent/1 → strictement identique à planifier()', () => {
  const s = () => [seg('a', 300), seg('b', 300)];
  assert.deepStrictEqual(planifierPaquets(s(), 1000, 1), [planifier(s(), 1000)]);
  assert.deepStrictEqual(planifierPaquets(s(), 1000), [planifier(s(), 1000)]);
});

test('PARITÉ : tout tient en une trame → paquet 1 identique à planifier, les autres VIDES', () => {
  // ⚠️ LA garantie de bascule : le multi-paquets ne s'engage QUE sur une
  //    éviction. Un mutant qui passerait toujours par le chemin paquets casse ici.
  const s = () => [seg('a', 300)];
  const p = planifierPaquets(s(), 1000, 4);
  assert.strictEqual(p.length, 4);
  assert.deepStrictEqual(p[0], planifier(s(), 1000));
  for (let i = 1; i < 4; i++) assert.deepStrictEqual(p[i], { texte: '', emis: [], differes: [], marqueur: '' });
});

test('CONSERVATION : chaque segment est dans EXACTEMENT un paquet, ou annoncé', () => {
  const liste = segs(8, 400);
  const p = planifierPaquets(liste, 1200, 4);
  const emis = p.flatMap((x) => x.emis);
  const differes = p.flatMap((x) => x.differes.map((d) => d.id));
  assert.strictEqual(new Set(emis).size, emis.length, 'aucun DOUBLON entre paquets');
  assert.deepStrictEqual([...emis, ...differes].sort(), liste.map((s) => s.id).sort());
});

test('SÉQUENCE : chaque paquet non vide porte son numéro k/N et le marqueur COMMUN', () => {
  // ⚠️ Sans numéro, un paquet manquant est indétectable (hooks parallèles,
  //    ordre non garanti) — c'est la perte silencieuse qu'on rend impossible.
  const p = planifierPaquets(segs(8, 400), 1200, 4).filter((x) => x.texte !== '');
  assert.ok(p.length >= 2, 'le cas doit bien engager plusieurs paquets');
  const marqueurs = new Set(p.map((x) => x.marqueur));
  assert.strictEqual(marqueurs.size, 1, 'UN seul marqueur pour toute l’émission');
  p.forEach((x, i) => {
    assert.ok(x.texte.includes('PAQUET ' + (i + 1) + '/4'), 'numéro de séquence présent');
    assert.ok(x.texte.includes('###FIN:' + x.marqueur + '###'), 'sceau fermé');
  });
});

test('BORNE : aucun paquet ne dépasse le budget', () => {
  for (const p of planifierPaquets(segs(10, 500), 1500, 5)) {
    assert.ok(p.texte.length <= 1500, 'paquet de ' + p.texte.length + ' > 1500');
  }
});

test('SEGMENT GÉANT : jamais tronqué, jamais bloquant — annoncé, les autres passent', () => {
  const liste = [seg('enorme', 5000), seg('petit', 100)];
  const p = planifierPaquets(liste, 1000, 3);
  const emis = p.flatMap((x) => x.emis);
  const differes = p.flatMap((x) => x.differes.map((d) => d.id));
  assert.deepStrictEqual(differes, ['enorme']);
  assert.deepStrictEqual(emis, ['petit'], 'le géant ne stérilise AUCUN paquet');
  assert.ok(!p.some((x) => x.texte.includes('x'.repeat(1500))), 'jamais un géant tronqué');
});

test('DÉTERMINISME : deux calculs indépendants rendent le MÊME découpage', () => {
  // ⚠️ C'EST LA CONDITION DE VIE DU MÉCANISME : les N processus parallèles ne
  //    peuvent pas se parler, ils ne s'accordent que par déterminisme pur.
  const a = planifierPaquets(segs(9, 450), 1300, 4);
  const b = planifierPaquets(segs(9, 450), 1300, 4);
  assert.deepStrictEqual(a, b);
});

test('ORDRE DE PRIORITÉ conservé : le mieux classé est dans le premier paquet', () => {
  const p = planifierPaquets(segs(8, 400), 1200, 4);
  assert.strictEqual(p[0].emis[0], 'd0');
});

test('FRONTIÈRE du sceau : à 50 % pile → nominal ; juste au-dessus → scellé', () => {
  // Ancre la constante SEUIL_SCEAU_RATIO : un mutant qui la déplace est tué.
  const nu = planifier([seg('a', 500)], 1000);   // 500 = 50 % de 1000 → nominal
  assert.strictEqual(nu.marqueur, '');
  const scelle = planifier([seg('a', 501)], 1000); // 501 > 50 % → scellé
  assert.notStrictEqual(scelle.marqueur, '');
});
