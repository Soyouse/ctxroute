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
import { planifier, planifierPaquets, capacitePaquet, DEFAUT_BUDGET, TAILLE_MARQUEUR, empreinte, tailleEnveloppe } from './budget.js';

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

test('SEGMENT GÉANT : MORCELÉ et LIVRÉ — l\'indélivrabilité est impossible', () => {
  // ⚠️ CONTRAT INVERSÉ le 03/08/2026 (décision le mainteneur) : AVANT, un segment plus
  //    lourd qu'une trame était seulement ANNONCÉ — donc jamais livré. Le
  //    framework LIVRE : il découpe. Ne JAMAIS revenir à « annoncer au lieu de
  //    livrer », c'est faire porter à l'auteur un défaut du transport.
  // ⚠️ Contenus DISTINCTS ('x' vs 'y') : sans ça, compter les caractères
  //    recollés mélangerait les deux docs et le test certifierait à faux.
  const p = planifierPaquets([seg('enorme', 5000), { id: 'petit', text: 'y'.repeat(100), label: 'petit.md' }], 1200, 9);
  const emis = p.flatMap((x) => x.emis);
  assert.deepStrictEqual(emis.filter((id) => id.startsWith('enorme')),
    ['enorme#1', 'enorme#2', 'enorme#3', 'enorme#4', 'enorme#5', 'enorme#6', 'enorme#7'],
    'le géant est découpé en 7 morceaux, TOUS livrés');
  assert.ok(emis.includes('petit'), 'et il ne stérilise aucun paquet');
  assert.deepStrictEqual(p.flatMap((x) => x.differes.map((d) => d.id)), [], 'RIEN de différé : tout est passé');
  // CONSERVATION DU CONTENU : recoller les morceaux redonne le texte d'origine.
  const recolle = p.flatMap((x) => x.texte.split('⟦').slice(1))
    .map((m) => m.slice(m.indexOf('⟧\n') + 2))
    .join('')
    .replace(/\n\n---\n\n|\n\n###FIN:[0-9a-f]{8}###/g, '');
  assert.strictEqual(recolle.replace(/[^x]/g, '').length, 5000, 'les 5000 caractères sont tous arrivés');
});

test('MORCEAUX : chacun s\'ANNONCE comme fragment (jamais un extrait qui a l\'air complet)', () => {
  // ⚠️ C'est CET en-tête qui autorise la découpe : sans lui on livrerait un
  //    fragment déguisé en doc entière — le mensonge que le module combat.
  const p = planifierPaquets([seg('gros', 5000)], 1200, 8);
  const morceaux = p.filter((x) => x.texte).map((x) => /MORCEAU (\d+)\/(\d+)/.exec(x.texte));
  assert.ok(morceaux.length >= 2 && morceaux.every(Boolean), 'chaque trame porte son numéro de morceau');
  const total = Number(morceaux[0][2]);
  assert.deepStrictEqual(morceaux.map((m) => Number(m[1])), Array.from({ length: total }, (_, i) => i + 1),
    'les morceaux sont numérotés 1..m, dans l\'ordre, sans trou');
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

// ── Fixtures de PAQUETS, calibrées au caractère (mesurées 03/08/2026) ──
// Enveloppe d'un paquet (en-tête k/n à 1 chiffre + pied) = 339 · SEPARATEUR = 7.
// ⚠️ Ces nombres sont ÉCRITS EN DUR, jamais dérivés du module à l'exécution :
//    un attendu calculé par le code muté mute AVEC lui et ne prouve rien.
const trois400 = () => [seg('a', 400), seg('b', 400), seg('c', 400)];
const quatre400 = () => [seg('a', 400), seg('b', 400), seg('c', 400), seg('d', 400)];

test('EN-TÊTE de paquet : texte EXACT, ancré au caractère', () => {
  // ⚠️ Ancre les libellés : sans ça, un mutant qui vide une ligne de l'en-tête
  //    survit — et l'agent perdrait la consigne de recollage sans que rien ne
  //    rougisse. Le numéro de séquence est la garantie anti-perte silencieuse.
  const p = planifierPaquets(trois400(), 739, 3);
  const m = p[0].marqueur;
  const attendu =
    '⚠️ INJECTION SCELLÉE — PAQUET 1/3, fin marquée ###FIN:' + m + '###\n' +
    '   Les 3 paquets portent le MÊME marqueur et arrivent DANS LE DÉSORDRE : recolle-les par leur numéro.\n' +
    '   Un numéro qui manque, ou un marqueur absent = contenu tronqué par le harnais :\n' +
    '   lis alors toi-même les fichiers cités ci-dessous. Ne devine pas.\n\n';
  assert.strictEqual(p[0].texte, attendu + 'x'.repeat(400) + '\n\n###FIN:' + m + '###');
  assert.strictEqual(p[0].texte.length, 739);
});

test('RÉPARTITION EXACTE : un budget donné produit UN découpage précis', () => {
  // Trois cas mesurés — ils ancrent les bornes des DEUX boucles de remplissage.
  assert.deepStrictEqual(planifierPaquets(trois400(), 739, 3).map((p) => p.emis), [['a'], ['b'], ['c']]);
  assert.deepStrictEqual(planifierPaquets(trois400(), 1200, 3).map((p) => p.emis), [['a', 'b'], ['c'], []]);
  assert.deepStrictEqual(planifierPaquets(quatre400(), 1146, 2).map((p) => p.emis), [['a', 'b'], ['c', 'd']]);
});

test('FRONTIÈRE du morcellement : à la taille EXACTE la doc reste ENTIÈRE, au-delà elle se découpe', () => {
  // 339 (enveloppe) + 400 (segment) = 739. À 739 chaque doc tient telle quelle…
  assert.deepStrictEqual(planifierPaquets(trois400(), 739, 3).map((p) => p.emis), [['a'], ['b'], ['c']]);
  // …à 738 elle ne tient plus : elle est MORCELÉE, jamais abandonnée.
  // ⚠️ Un morceau porte un id suffixé `#j` — c'est la trace du découpage.
  const serre = planifierPaquets(trois400(), 738, 6);
  const emis = serre.flatMap((p) => p.emis);
  assert.ok(emis.every((id) => id.includes('#')), 'toutes les docs sont découpées');
  assert.ok(['a', 'b', 'c'].every((d) => emis.some((id) => id.startsWith(d + '#'))), 'les 3 docs sont livrées');
});

test('FRONTIÈRE du remplissage : un paquet PLEIN À RAS BORD est valide', () => {
  // 339 + 400 + 7 (séparateur) + 400 = 1146. À 1146 les deux tiennent.
  const pile = planifierPaquets(quatre400(), 1146, 2);
  assert.deepStrictEqual(pile.map((p) => p.emis), [['a', 'b'], ['c', 'd']]);
  assert.deepStrictEqual(pile.map((p) => p.texte.length), [1146, 1146]);
  // Un caractère de moins : le 2e segment ne tient plus, le reste est annoncé.
  const serre = planifierPaquets(quatre400(), 1145, 2);
  assert.deepStrictEqual(serre.map((p) => p.emis), [['a'], ['b']]);
  assert.deepStrictEqual(serre[1].differes.map((d) => d.id), ['c', 'd']);
});

test('RELIQUAT = « pas assez de TRAMES », jamais « trop gros » (erreur de CONFIG)', () => {
  // ⚠️ Sémantique NEUVE (03/08/2026) : plus rien n'est « trop gros » — tout est
  //    morcelable. S'il reste des morceaux, c'est que `--paquets N` est trop
  //    petit : une erreur d'exploitation, avec sa solution dans le message.
  const p = planifierPaquets(quatre400(), 1145, 2);
  const dernier = p[p.length - 1];
  assert.ok(dernier.differes.length > 0, 'avec 2 trames pour 4 docs, il reste forcément des morceaux');
  assert.ok(dernier.texte.includes('le nombre de paquets déclarés est TROP PETIT'));
  assert.ok(dernier.texte.includes('--paquets N'), 'le message dit COMMENT corriger');
  // …et avec assez de trames, le reliquat disparaît : rien n'était trop gros.
  const assez = planifierPaquets(quatre400(), 1145, 8);
  assert.deepStrictEqual(assez.flatMap((x) => x.differes), [], 'assez de trames ⇒ tout passe');
});

test('TRAME MINUSCULE : on découpe plus fin, on ne renonce JAMAIS', () => {
  // ⚠️ Il n'existe AUCUN budget où le framework refuse de livrer : plus la
  //    trame est petite, plus les morceaux sont petits. C'est le remplacement
  //    du vieux « rien ne rentre, on annonce » — qui n'a plus lieu d'être.
  const p = planifierPaquets(trois400(), 500, 24); // trame minuscule ⇒ beaucoup de morceaux ⇒ beaucoup de trames
  const emis = p.flatMap((x) => x.emis);
  assert.ok(emis.length > 3, 'la trame est petite ⇒ beaucoup de morceaux');
  for (const d of ['a', 'b', 'c']) {
    assert.ok(emis.some((id) => id === d || id.startsWith(d + '#')), 'doc ' + d + ' livrée');
  }
});

test('PAQUET VIDE : ni contenu ni annonce ⇒ rendu VIDE (jamais une enveloppe creuse)', () => {
  // Émettre une enveloppe pour annoncer du néant coûterait des tokens à chaque geste.
  const p = planifierPaquets(trois400(), 1200, 3);
  assert.deepStrictEqual(p[2], { texte: '', emis: [], differes: [], marqueur: '' });
  assert.notStrictEqual(p[1].texte, '', 'le paquet qui porte du contenu, lui, est bien rendu');
});

test('MARQUEUR : sensible au CONTENU et au NOMBRE de paquets', () => {
  // ⚠️ Deux émissions distinctes ne doivent pas partager de marqueur, sinon un
  //    recollage croisé passerait pour valide.
  const m3 = planifierPaquets(trois400(), 739, 3)[0].marqueur;
  const m4 = planifierPaquets(trois400(), 739, 4)[0].marqueur;
  assert.notStrictEqual(m3, m4, 'le nombre de paquets entre dans le marqueur');
  const autreTexte = [{ id: 'a', text: 'y'.repeat(400), label: 'a.md' }, seg('b', 400), seg('c', 400)];
  assert.notStrictEqual(planifierPaquets(autreTexte, 739, 3)[0].marqueur, m3, 'le contenu aussi');
});

test('PAQUETS — nbPaquets invalide ⇒ trame UNIQUE (cascade, jamais un découpage bancal)', () => {
  const l = () => segs(6, 300);
  for (const mauvais of [undefined, null, 0, 1, -3, 2.5, NaN, 'x']) {
    const p = planifierPaquets(l(), 1200, mauvais);
    assert.strictEqual(p.length, 1, 'nbPaquets=' + String(mauvais));
    assert.deepStrictEqual(p, [planifier(l(), 1200)]);
  }
  assert.strictEqual(planifierPaquets(l(), 1200, 2).length, 2, 'le premier nombre VALIDE est 2');
});

test('PAQUETS — n=1 AVEC éviction : strictement le rendu de planifier()', () => {
  // ⚠️ Le chemin de parité doit tenir MÊME quand il y a des différés — sinon un
  //    harnais mono-paquet recevrait un format de paquet sans raison.
  const l = () => segs(6, 300);
  assert.deepStrictEqual(planifierPaquets(l(), 1200, 1), [planifier(l(), 1200)]);
});

test('PAQUETS — budget absurde ⇒ défaut FRAMEWORK (cascade autorité ①)', () => {
  for (const mauvais of [undefined, null, 0, -1, NaN, Infinity, 'x']) {
    const p = planifierPaquets(trois400(), mauvais, 3);
    assert.deepStrictEqual(p[0].emis, ['a', 'b', 'c'], 'budget ' + String(mauvais));
    assert.deepStrictEqual(p[1], { texte: '', emis: [], differes: [], marqueur: '' });
  }
});

test('PAQUETS — entrée non-tableau ⇒ traitée comme vide (fail-soft, jamais un throw)', () => {
  // La porte est fail-open : un budget qui lèverait ferait TAIRE l'injection.
  for (const mauvais of [undefined, null, 'texte', 42, {}]) {
    const p = planifierPaquets(mauvais, 1000, 3);
    assert.strictEqual(p.length, 3);
    for (const x of p) assert.deepStrictEqual(x, { texte: '', emis: [], differes: [], marqueur: '' });
  }
});

test('FRONTIÈRE du sceau : à 50 % pile → nominal ; juste au-dessus → scellé', () => {
  // Ancre la constante SEUIL_SCEAU_RATIO : un mutant qui la déplace est tué.
  const nu = planifier([seg('a', 500)], 1000);   // 500 = 50 % de 1000 → nominal
  assert.strictEqual(nu.marqueur, '');
  const scelle = planifier([seg('a', 501)], 1000); // 501 > 50 % → scellé
  assert.notStrictEqual(scelle.marqueur, '');
});

test('capacitePaquet : borne PHYSIQUE dérivée de l\'en-tête réel, jamais une constante', () => {
  // ⚠️ Valeur EXACTE ancrée (budget 8000, en-tête à 1 chiffre + pied = 339) :
  //    sans elle, un mutant qui additionne au lieu de soustraire survit et le
  //    gate de taille laisserait passer des docs jamais livrables.
  assert.strictEqual(capacitePaquet(8000, 3), 7661);
  assert.strictEqual(capacitePaquet(), DEFAUT_BUDGET - 339, 'budget absent ⇒ défaut framework');
  assert.ok(capacitePaquet(8000, 3) < 8000, 'la capacité est TOUJOURS sous le budget (l\'enveloppe coûte)');
  // ⚠️ Le nombre de paquets ÉLARGIT l'en-tête (« PAQUET 10/10 » > « PAQUET 3/3 »)
  //    donc RÉDUIT la capacité. Sans ce cas à deux chiffres, tous les mutants
  //    sur `nbPaquets` sont équivalents (2 à 9 donnent la même largeur) et
  //    survivent — mesuré 03/08/2026.
  assert.ok(capacitePaquet(8000, 10) < capacitePaquet(8000, 3), 'plus de paquets ⇒ en-tête plus large ⇒ moins de place');
  for (const mauvais of [undefined, null, 1, 0, -4, 2.5, 'x']) {
    assert.strictEqual(capacitePaquet(8000, mauvais), 7661, 'nbPaquets absurde ⇒ largeur minimale (2), jamais un throw');
  }
});

test('capacitePaquet : à la capacité EXACTE la doc reste entière, un caractère de plus ⇒ 2 morceaux', () => {
  // Le lien entre la borne annoncée et le comportement réel — sans lui, la
  // constante pourrait dériver du moteur sans que rien ne rougisse.
  const cap = capacitePaquet(8000, 3);
  const pile = planifierPaquets([seg('a', cap), seg('b', 5000)], 8000, 3);
  assert.ok(pile.some((p) => p.emis.includes('a')), 'à la capacité exacte : livrée ENTIÈRE, sans découpe');
  const trop = planifierPaquets([seg('a', cap + 1), seg('b', 5000)], 8000, 3);
  const emisA = trop.flatMap((p) => p.emis).filter((id) => id.startsWith('a'));
  assert.deepStrictEqual(emisA, ['a#1', 'a#2'], 'un caractère de plus ⇒ découpée en 2, et LIVRÉE');
});

test('LIGNE MONSTRE : une seule ligne plus longue qu\'une trame est débitée', () => {
  // ⚠️ Chemin JAMAIS exercé avant le 03/08/2026 (mutation : 4 mutants sans
  //    couverture). C'est le SEUL endroit où l'on tranche au milieu d'un mot —
  //    une ligne de 20 000 caractères n'a aucune frontière où couper proprement.
  const uneLigne = { id: 'mono', text: 'z'.repeat(9000), label: 'mono.md' };
  const p = planifierPaquets([uneLigne], 1200, 24);
  const emis = p.flatMap((x) => x.emis);
  assert.ok(emis.length > 5, 'la ligne monstre est débitée en morceaux');
  assert.ok(emis.every((id) => id.startsWith('mono#')));
  const z = p.map((x) => x.texte).join('').split('').filter((c) => c === 'z').length;
  assert.strictEqual(z, 9000, 'les 9000 caractères sont TOUS arrivés');
});

test('LIGNE MONSTRE mêlée à des lignes normales : le tampon en cours est vidé d\'abord', () => {
  // Garantit l'ORDRE : ce qui précède la ligne monstre sort AVANT elle.
  const mixte = { id: 'mix', text: 'debut\n' + 'z'.repeat(3000) + '\nfin', label: 'mix.md' };
  const p = planifierPaquets([mixte], 1200, 24);
  const textes = p.map((x) => x.texte).join('');
  assert.ok(textes.indexOf('debut') < textes.indexOf('zzz'), 'le début sort avant la ligne monstre');
  assert.ok(textes.includes('fin'), 'et la suite arrive quand même');
});

test('EN-TÊTE DE MORCEAU : texte EXACT (les 3 champs du motif RFC 2046)', () => {
  // ⚠️ `id` (marqueur commun), `number` à partir de 1, `total` — en retirer un
  //    supprime une garantie de réassemblage. Ancré au caractère.
  const p = planifierPaquets([seg('doc', 3000)], 1200, 24);
  const premier = p.find((x) => x.texte.includes('MORCEAU 1/'));
  const m = /⟦ (.+?) — MORCEAU (\d+)\/(\d+) : recolle les (\d+) morceaux dans l'ordre avant de lire ⟧\n/.exec(premier.texte);
  assert.ok(m, 'en-tête au format exact');
  assert.strictEqual(m[1], 'doc.md', 'le LABEL identifie la doc');
  assert.strictEqual(m[2], '1', 'la numérotation commence à 1 (RFC 2046)');
  assert.strictEqual(m[3], m[4], 'le TOTAL est cohérent dans la phrase');
});

test('RELIQUAT : message EXACT, avec la solution dedans', () => {
  const p = planifierPaquets(quatre400(), 1145, 2);
  const t = p[1].texte;
  assert.ok(t.includes('⚠️ 2 morceau(x) non émis : le nombre de paquets déclarés est TROP PETIT.'));
  assert.ok(t.includes("   Augmente `--paquets N` dans la configuration des hooks — rien n'est trop gros, il manque des trames."));
});

test('capacitePaquet : nbPaquets NON entier retombe sur la largeur minimale', () => {
  // ⚠️ Sans ce cas, le garde `Number.isInteger` est intuable : 10.5 et 2 donnent
  //    des largeurs d'en-tête différentes, donc des capacités différentes.
  assert.strictEqual(capacitePaquet(8000, 10.5), capacitePaquet(8000, 2));
  assert.notStrictEqual(capacitePaquet(8000, 11), capacitePaquet(8000, 2));
});
