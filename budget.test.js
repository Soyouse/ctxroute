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
import { planifier, planifierPaquets, capacitePaquet, morceler, baseId, ordonner, DEFAUT_BUDGET, TAILLE_MARQUEUR, empreinte, tailleEnveloppe } from './budget.js';

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
  assert.ok(r.texte.includes(r.differes.length + ' doc(s) DIFFÉRÉE(S)'));
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
  assert.ok(r.texte.includes('\n\n⚠️ ' + r.differes.length + ' doc(s) DIFFÉRÉE(S) — la trame est pleine, elles suivent au(x) prochain(s) appel(s) d\'outil.\n'));
  assert.ok(r.texte.includes("   Rien n'est perdu : elles sont en file, dans l'ordre. Si ton geste les touche MAINTENANT, lis-les :\n"));
  assert.ok(r.texte.includes('   - ' + r.differes[0].label));
  // Le joint entre deux différés DOIT être un retour ligne (sinon liste illisible).
  assert.ok(r.texte.includes('   - ' + r.differes[0].label + '\n   - ' + r.differes[1].label));
});

test('SCELLÉ SANS différé : aucune annonce parasite', () => {
  // ⚠️ Tue le mutant qui supprimerait le court-circuit `differes.length === 0` :
  //    on annoncerait « 0 doc(s) DIFFÉRÉE(S) » sur un bloc complet.
  const r = planifier([seg('a', 600)], 1000);
  assert.deepStrictEqual(r.differes, []);
  assert.ok(!r.texte.includes('DIFFÉRÉE'));
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
  // ⚠️ CONTRAT INVERSÉ le 03/08/2026 (décision du mainteneur) : AVANT, un segment plus
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

test('RELIQUAT = un DÉLAI, jamais « trop gros » NI une erreur de CONFIG', () => {
  // ⚠️ Sémantique NEUVE (05/08/2026), et c'est la 2ᵉ révision de ce test — la
  //    1ʳᵉ (03/08) disait « c'est `--paquets N` qui est trop petit, corrige ta
  //    config ». C'était encore un jugement porté sur l'EXPLOITANT. Depuis la
  //    file d'émission (`porte-core.js`), le reliquat n'est plus qu'une fenêtre
  //    pleine : il part au geste suivant, comme dans tout protocole de
  //    transport. `--paquets N` est un DÉBIT, plus un plafond.
  // 🛑 NE JAMAIS refaire dire à ce message « augmente N » : ce serait remettre
  //    un humain dans la boucle pour un phénomène normal — le toil que ce
  //    framework existe pour supprimer.
  const p = planifierPaquets(quatre400(), 1145, 2);
  const dernier = p[p.length - 1];
  assert.ok(dernier.differes.length > 0, 'avec 2 trames pour 4 docs, il reste forcément des morceaux');
  assert.ok(dernier.texte.includes('DIFFÉRÉE(S)'), 'différé, pas perdu');
  assert.ok(!dernier.texte.includes('TROP PETIT'), 'aucune accusation portée sur la configuration');
  assert.ok(!dernier.texte.includes('non émis'), 'ne jamais annoncer une perte là où il y a une attente');
  for (const d of dernier.differes) {
    assert.ok(dernier.texte.includes(d.label), 'tout différé reste NOMMÉ : ' + d.label);
  }
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

// ── SCANNER `morceler` — scellé DIRECTEMENT ────────────────────────────────
// ⚠️ POURQUOI EN DIRECT : `morceler` interprète un format (des lignes) pour
//    produire des tranches — c'est un SCANNER, et la doctrine du parc impose de
//    le sceller à ce titre. Testé seulement à travers `planifierPaquets`, ses
//    frontières restaient intestables : 6 mutants y survivaient le 03/08/2026
//    alors que TOUT le reste du module était à 100 %.
// ⚠️ Les attendus ci-dessous sont MESURÉS sur le code réel, jamais devinés.
const H_MORCEAU = '⟦ A — MORCEAU 999/999 : recolle les 999 morceaux dans l\'ordre avant de lire ⟧\n'.length;
const CAP5 = H_MORCEAU + 5; // ⇒ `utile` = 5 caractères de contenu par tranche
const tranchesDe = (texte, capacite = CAP5) =>
  morceler([{ id: 'a', label: 'A', text: texte }], capacite).map((m) => m.text.replace(/^⟦[^⟧]*⟧\n/, ''));

test('SCANNER : les lignes courtes sont GROUPÉES tant qu\'elles tiennent, séparateur PRÉSERVÉ', () => {
  const src = 'ab\ncd\nef\ngh\nij\nkl\nmn\nop\nqr\nst\nuv\nwx\nyz\nAB\nCD\nEF\nGH\nIJ\nKL\nMN\nOP\nQR\nST\nUV\nWX\nYZ\n01\n23\n45';
  assert.ok(src.length > CAP5, 'prémisse : le texte dépasse la trame, donc il se découpe');
  assert.deepStrictEqual(tranchesDe(src), [
    'ab\ncd', 'ef\ngh', 'ij\nkl', 'mn\nop', 'qr\nst', 'uv\nwx', 'yz\nAB', 'CD\nEF',
    'GH\nIJ', 'KL\nMN', 'OP\nQR', 'ST\nUV', 'WX\nYZ', '01\n23', '45',
  ]);
});

test('SCANNER : une LIGNE MONSTRE est débitée, et le tampon en cours est vidé AVANT', () => {
  // ⚠️ Vider le tampon d'abord est ce qui garde l'ORDRE de lecture : sans ça,
  //    le début du texte sortirait APRÈS le milieu.
  assert.deepStrictEqual(tranchesDe('ab\n' + 'x'.repeat(12) + '\ncd\n' + 'y'.repeat(90)).slice(0, 4), [
    'ab', 'xxxxx', 'xxxxx', 'xx\ncd',
  ]);
});

test('SCANNER : tampon VIDE en fin de texte ⇒ AUCUNE tranche vide ajoutée', () => {
  // ⚠️ CAS PRÉCIS, mesuré : une ligne monstre d'un multiple EXACT de `utile`
  //    SUIVIE d'une ligne vide (texte terminé par un saut) laisse réellement le
  //    tampon vide. Pousser quand même produirait une tranche vide — un morceau
  //    qui n'annonce RIEN, et un total `j/m` faussé pour TOUS les autres.
  //    ⚠️ Sans le saut final, le tampon n'est PAS vide (il porte la dernière
  //    tranche) : la variante ci-dessous ne prouverait rien.
  const vide = tranchesDe('x'.repeat(100) + '\n');
  assert.strictEqual(vide.length, 20, '100 / 5 = 20 tranches, pas 21');
  assert.ok(vide.every((x) => x.length > 0), 'aucune tranche vide');
  // Variante sans saut final : même compte, mais par le chemin « tampon plein ».
  assert.strictEqual(tranchesDe('x'.repeat(100)).length, 20);
});

test('SCANNER : un texte finissant par une nouvelle ligne la CONSERVE', () => {
  const src = 'ab\ncd\nef\ngh\nij\nkl\nmn\nop\nqr\nst\nuv\nwx\nyz\nAB\nCD\nEF\nGH\nIJ\nKL\nMN\nOP\nQR\nST\nUV\nWX\nYZ\n01\n23\n45\n';
  const t = tranchesDe(src);
  assert.strictEqual(t[t.length - 1], '45\n', 'le saut final fait partie du contenu, il ne se perd pas');
});

test('SCANNER : capacité NÉGATIVE ⇒ progression d\'un caractère, jamais un blocage', () => {
  // ⚠️ Sans le plancher `Math.max(1, …)`, ce cas produisait une boucle infinie
  //    ou faisait DISPARAÎTRE le contenu (bug réel, 03/08/2026).
  assert.deepStrictEqual(tranchesDe('abc', -99), ['a', 'b', 'c']);
});

test('SCANNER : ce qui TIENT n\'est jamais touché (chemin 1 — ni en-tête ni découpe)', () => {
  const m = morceler([{ id: 'a', label: 'A', text: 'court' }], CAP5);
  assert.deepStrictEqual(m, [{ id: 'a', label: 'A', text: 'court' }], 'segment rendu tel quel, id inchangé');
});

test("BUDGET SOUS L'ENVELOPPE : c'est l'ENVELOPPE qui cède, jamais le contenu", () => {
  // ⚠️ BUG RÉEL du 03/08/2026, scellé ici : quand le budget est plus petit que
  //    l'enveloppe de scellement, `capacitePaquet` devient NÉGATIVE. Avant ce
  //    correctif, AUCUNE doc ne sortait (0 émis) et le message accusait
  //    `--paquets N` — une indélivrabilité par construction, DOUBLÉE d'un
  //    message qui ment sur sa cause. Le sceau est un confort de détection ;
  //    LIVRER est le contrat. Quand les deux ne tiennent pas, on livre.
  assert.ok(capacitePaquet(300, 12) < 0, "prémisse : à ce budget l'enveloppe ne rentre pas");
  const p = planifierPaquets([{ id: 'a', label: 'A', text: 'x'.repeat(400) }], 300, 12);
  const emis = p.flatMap((x) => x.emis);
  assert.ok(emis.length > 0, 'INDÉLIVRABILITÉ INTERDITE : au moins un morceau sort');
  // ⚠️ Retirer les en-têtes de morceau AVANT de compter : ils contiennent le mot
  //    « morceaux », donc un « x » — compter naïvement gonfle le total de 1 par
  //    morceau et rend un faux ROUGE (mesuré en écrivant ce test).
  const livre = p.map((x) => x.texte).join('').replace(/⟦[^⟧]*⟧\n/g, '').replace(/[^x]/g, '').length;
  assert.strictEqual(livre, 400, 'tout le contenu est livré, à la lettre près');
  // Descellé ⇒ on n'ANNONCE pas un sceau qui n'existe pas (« vert qui ment »).
  for (const x of p) {
    assert.strictEqual(x.marqueur, '', 'aucun marqueur annoncé quand rien n\'est scellé');
    assert.ok(!x.texte.includes('###FIN:'), 'aucun sceau dans le texte');
  }
  // …et la BORNE tient quand même sur toute trame porteuse de contenu.
  for (const x of p) {
    if (x.emis.length > 0) assert.ok(x.texte.length <= 300, 'trame de contenu bornée');
  }
});

test('FRONTIÈRE DU DESCELLEMENT : capacité PILE à zéro ⇒ descellé (il ne reste aucune place)', () => {
  // ⚠️ `capacite > 0` et non `>= 0` : à zéro, l'enveloppe occupe la trame
  //    ENTIÈRE — la sceller ne laisserait pas UN caractère de contenu. Livrer
  //    passe avant sceller, donc on descelle. Budget MESURÉ, pas deviné.
  assert.strictEqual(capacitePaquet(342, 12), 0, 'prémisse : ce budget donne une capacité de zéro');
  const p = planifierPaquets([{ id: 'a', label: 'A', text: 'x'.repeat(400) }], 342, 12);
  assert.ok(p.flatMap((x) => x.emis).length > 0, 'du contenu sort quand même');
  assert.ok(!p.some((x) => x.texte.includes('###FIN:')), 'aucun sceau : il n\'y avait pas la place');
  // Un caractère de budget en plus et le sceau redevient possible.
  const q = planifierPaquets([{ id: 'a', label: 'A', text: 'x'.repeat(400) }], 343, 12);
  assert.ok(q.some((x) => x.texte.includes('###FIN:')), 'à capacité 1, on scelle');
});

test('DIFFÉRÉS : seul le DERNIER paquet les porte (les autres ont une liste vide)', () => {
  // ⚠️ C'est le dernier qui porte l'annonce : la lui retirer, ou la donner à
  //    tous, ferait répéter N fois la même liste — ou la perdrait.
  const p = planifierPaquets(quatre400(), 1145, 3);
  assert.ok(p[p.length - 1].differes.length > 0, 'prémisse : il reste des morceaux');
  for (let i = 0; i < p.length - 1; i++) {
    assert.deepStrictEqual(p[i].differes, [], 'paquet ' + (i + 1) + ' ne porte aucun différé');
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
  // ⚠️ RÉVISÉ LE 05/08/2026 : « trame unique » veut toujours dire UNE trame —
  //    mais plus « on renonce au surplus ». Un nombre de paquets invalide ne
  //    doit jamais faire perdre du contenu, seulement réduire le DÉBIT.
  const l = () => segs(6, 300);
  for (const mauvais of [undefined, null, 0, 1, -3, 2.5, NaN, 'x']) {
    const p = planifierPaquets(l(), 1200, mauvais);
    assert.strictEqual(p.length, 1, 'nbPaquets=' + String(mauvais));
    assert.deepStrictEqual(p, planifierPaquets(l(), 1200, 1), 'toutes les valeurs invalides sont ÉQUIVALENTES à 1');
  }
  assert.strictEqual(planifierPaquets(l(), 1200, 2).length, 2, 'le premier nombre VALIDE est 2');
});

test('PAQUETS — n=1 : parité PARFAITE si tout tient, MORCELAGE dès qu\'il y a du surplus', () => {
  // ⚠️ CE TEST A ÉTÉ INVERSÉ LE 05/08/2026, et c'est le cœur du chantier.
  //    Il exigeait « n=1 avec éviction ⇒ STRICTEMENT le rendu de planifier() ».
  //    C'était un TROU déguisé en parité : `planifier` ne morcelle pas, donc une
  //    doc plus lourde que la trame n'arrivait JAMAIS sur un harnais mono-trame
  //    (Codex). Avec la file, ce n'était plus une perte mais une BOUCLE.
  //    La parité qui compte est celle du cas QUI TIENT — la voici, à l'octet.
  const tient = () => segs(2, 300);
  assert.deepStrictEqual(planifierPaquets(tient(), 8000, 1), [planifier(tient(), 8000)]);

  // Dès qu'il y a du surplus, on morcelle et on émet — au lieu de renoncer.
  const deborde = () => segs(6, 300);
  const p = planifierPaquets(deborde(), 1200, 1);
  assert.strictEqual(p.length, 1, 'toujours UNE seule trame');
  assert.ok(p[0].emis.length > 0, 'du contenu SORT, contrairement au comportement d\'avant');
  assert.ok(p[0].differes.length > 0, 'le reste est rendu à l\'appelant, qui le met en file');
  // ⚠️ Une trame seule ne doit JAMAIS porter l'en-tête « PAQUET k/N » : elle
  //    dirait « recolle les 1 paquets », une consigne fausse.
  assert.ok(!p[0].texte.includes('PAQUET '), 'en-tête simple, jamais un en-tête de paquet');
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

test('RELIQUAT : message EXACT — UNE seule annonce pour les DEUX chemins', () => {
  // ⚠️ Ce test scelle la FUSION du 05/08/2026 : `annonce()` (trame unique) et
  //    `annonceConfig()` (dernier paquet) disaient deux choses différentes pour
  //    UNE seule situation — la fenêtre est pleine. Deux textes = deux vérités
  //    qui divergent au premier changement. Ici on vérifie que le dernier
  //    paquet rend EXACTEMENT la même phrase que la trame unique.
  const p = planifierPaquets(quatre400(), 1145, 2);
  const t = p[1].texte;
  const n = p[1].differes.length;
  assert.ok(t.includes('\n\n⚠️ ' + n + ' doc(s) DIFFÉRÉE(S) — la trame est pleine, elles suivent au(x) prochain(s) appel(s) d\'outil.\n'));
  assert.ok(t.includes("   Rien n'est perdu : elles sont en file, dans l'ordre. Si ton geste les touche MAINTENANT, lis-les :\n"));
  // MÊME phrase que le chemin trame unique — sinon la fusion serait cosmétique.
  const solo = planifier(segs(6, 300), 1200);
  const ligne = (x) => x.split('\n').find((l) => l.includes('DIFFÉRÉE(S)')).replace(/\d+/, 'N');
  assert.strictEqual(ligne(t), ligne(solo.texte), 'une seule formulation, partagée');
});

// ⚠️ CE TEST VIT ICI, PAS DANS LE FICHIER PROPERTY — ET C'EST UNE RÈGLE, PAS UN
//    RANGEMENT. Stryker n'exécute PAS les property-tests (lents, non
//    déterministes) : une garde prouvée UNIQUEMENT par property laisse ses
//    mutants SURVIVRE, et le score ment. Mesuré le 05/08/2026 : l'annonce
//    bornée écrite en property a fait tomber la mutation de 100 % à 98,85 %
//    (5 survivants sur `MAX_CITES`), alors que le comportement ÉTAIT testé.
// 🛑 Toute nouvelle garde déterministe : son cas va dans `budget.test.js`.
// ⚠️ CAS FONDATEUR DE LA FILE — le blocage RÉEL trouvé le 05/08/2026 par
//    simulation de la boucle de `porte-core.js`, AVANT toute mise en prod.
//    Trame UNIQUE (le régime de Codex), budget 600, doc de 5 000 c ⇒ 56
//    morceaux ⇒ l'annonce citait les 56 et remplissait la trame à elle seule
//    ⇒ ZÉRO contenu émis, à chaque geste, POUR TOUJOURS.
// ⚠️ IL VIT ICI ET PAS EN PROPERTY, pour la MÊME raison que l'annonce bornée :
//    Stryker n'exécute pas les property-tests. Écrit là-bas, il laissait 5
//    mutants survivre sur la garantie de progrès — le filet le plus critique du
//    module n'était donc prouvé par AUCUN test que la mutation puisse voir.
// 🛑 Ne JAMAIS le supprimer : si le comportement change, on INVERSE l'attendu.
test('CAS FONDATEUR (file) : trame unique + doc geante => progres STRICT, jamais de boucle', () => {
  const doc = () => ({ id: 'geante', text: 'x'.repeat(5000), label: 'geante.md' });
  let file = [doc()];
  let tours = 0;
  const livres = new Set();
  while (file.length > 0) {
    assert.ok(tours++ < 200, 'progres strict exige : au-dela, il y a une boucle');
    const paquets = planifierPaquets(file, 600, 1);
    const emis = paquets.flatMap((p) => p.emis);
    assert.ok(emis.length > 0, 'chaque geste avance d\'au moins un morceau');
    for (const id of emis) livres.add(id);
    file = paquets[paquets.length - 1].differes;
  }
  assert.ok(tours > 1, 'la doc a bien ete livree en PLUSIEURS gestes');
  assert.ok(livres.size > 1, 'plusieurs morceaux distincts livres');
});

test('PROGRÈS FORCÉ : la trame SACRIFIE l\'annonce, mais rend TOUJOURS le reliquat', () => {
  // ⚠️ C'est le point le plus subtil du module : ce qu'on COMPOSE (sans annonce,
  //    faute de place) diffère de ce qu'on RAPPORTE (le reliquat complet, que
  //    l'appelant remet en file). Les deux DOIVENT diverger ici — les réaligner
  //    « par symétrie » ferait soit étouffer la trame, soit PERDRE le reliquat.
  const p = planifierPaquets([{ id: 'g', text: 'x'.repeat(5000), label: 'geante.md' }], 600, 1);
  const seule = p[0];
  assert.ok(seule.emis.length > 0, 'du contenu SORT malgré tout (garantie de progrès)');
  assert.ok(seule.differes.length > 0, 'et le reliquat est RENDU à l\'appelant');
  // Le texte, lui, ne porte AUCUNE annonce : il n'y avait pas la place.
  assert.ok(!seule.texte.includes('DIFFÉRÉE'), 'annonce sacrifiée : livrer passe avant décrire');
  assert.ok(!seule.texte.includes('Stryker'), 'aucun label parasite dans la trame');
});

test('ANNONCE : SEUL le dernier paquet la porte — jamais les précédents', () => {
  // ⚠️ Sans ce cas, `i === n - 1` est indiscernable de `true` : chaque trame
  //    répéterait la liste des différés, multipliant le bruit par N et
  //    risquant de faire déborder des paquets qui tenaient.
  const docs = Array.from({ length: 30 }, (_, k) => ({
    id: 'e' + k, text: 'w'.repeat(900), label: 'e' + k + '.md',
  }));
  const p = planifierPaquets(docs, 3000, 3);
  assert.ok(p[p.length - 1].texte.includes('DIFFÉRÉE(S)'), 'le DERNIER annonce');
  for (let i = 0; i < p.length - 1; i++) {
    assert.ok(!p[i].texte.includes('DIFFÉRÉE'), 'le paquet ' + (i + 1) + ' se tait');
    assert.deepStrictEqual(p[i].differes, [], 'et ne rapporte aucun reliquat');
  }
});

test('MORCELER : le morceau ne dépasse JAMAIS sa capacité, sur TOUTE la plage', () => {
  // ⚠️ BALAYAGE, pas un point : la frontière critique est là où l'en-tête de
  //    morceau vaut EXACTEMENT la capacité. Un `>` mis en `>=` y donnerait une
  //    part utile NULLE — donc une boucle infinie et un morceau hors borne.
  //    Tester une seule capacité laisse ce point de bascule invisible.
  const doc = () => [{ id: 'd', text: Array.from({ length: 40 }, (_, i) => 'ligne' + i).join('\n'), label: 'd.md' }];
  for (let cap = 20; cap <= 120; cap++) {
    const m = morceler(doc(), cap);
    assert.ok(m.length > 0, 'capacité ' + cap + ' : au moins un morceau');
    for (const x of m) {
      assert.ok(x.text.length > 0, 'capacité ' + cap + ' : jamais un morceau VIDE');
      assert.ok(x.text.length <= cap, 'capacité ' + cap + ' dépassée : ' + x.text.length);
    }
  }
});

test('PAQUET VIDE : ni contenu ni reliquat ⇒ rendu STRICTEMENT vide (silence)', () => {
  // ⚠️ Émettre une enveloppe pour annoncer du néant coûterait des tokens à
  //    CHAQUE geste de CHAQUE agent. La coquille sort en silence sur texte vide.
  const p = planifierPaquets(segs(6, 300), 1200, 4);
  const vides = p.filter((x) => x.emis.length === 0 && x.differes.length === 0);
  assert.ok(vides.length > 0, 'avec 4 trames pour un petit corpus, il en reste des vides');
  for (const v of vides) {
    assert.deepStrictEqual(v, { texte: '', emis: [], differes: [], marqueur: '' });
  }
});

test('ANNONCE BORNÉE : elle compte des DOCUMENTS et ne peut pas manger la trame', () => {
  const docs = Array.from({ length: 30 }, (_, k) => ({
    id: 'd' + k, text: 'y'.repeat(900), label: 'doc' + k + '.md',
  }));
  const p = planifierPaquets(docs, 3000, 2);
  const dernier = p[p.length - 1];
  const t = dernier.texte;
  assert.ok(dernier.differes.length > 5, 'le cas est bien atteint');

  // ① DÉDUP : le compte annoncé est celui des DOCUMENTS distincts.
  const attendus = new Set(dernier.differes.map((d) => d.label)).size;
  assert.ok(t.includes(attendus + ' doc(s) DIFFÉRÉE(S)'), 'compte en DOCUMENTS');

  // ② PLAFOND : la liste est tronquée, avec le reliquat CHIFFRÉ.
  assert.ok(t.includes('… et ' + (attendus - 5) + ' autre(s)'), 'liste tronquée et chiffrée');
  const lignes = t.split('\n').filter((l) => l.startsWith('   - '));
  assert.strictEqual(lignes.length, 6, '5 citations + la ligne de reste, jamais plus');

  // ③ FRONTIÈRE EXACTE du plafond : à 5 docs on cite TOUT, à 6 on tronque.
  //    ⚠️ Sans ces deux cas, `>` et `>=` sont indiscernables (mutant survivant).
  const nDocs = (n) => Array.from({ length: n }, (_, k) => ({ id: 'x' + k, text: 'z'.repeat(700), label: 'x' + k + '.md' }));
  const cinq = planifierPaquets(nDocs(6), 1500, 1);
  assert.ok(!cinq[0].texte.includes('autre(s)'), '5 différés ⇒ tous cités, aucune troncature');
  const six = planifierPaquets(nDocs(7), 1500, 1);
  assert.ok(six[0].texte.includes('… et 1 autre(s)'), '6 différés ⇒ on tronque à 5 + 1 restant');
});

test('capacitePaquet : nbPaquets NON entier retombe sur la largeur minimale', () => {
  // ⚠️ Sans ce cas, le garde `Number.isInteger` est intuable : 10.5 et 2 donnent
  //    des largeurs d'en-tête différentes, donc des capacités différentes.
  assert.strictEqual(capacitePaquet(8000, 10.5), capacitePaquet(8000, 2));
  assert.notStrictEqual(capacitePaquet(8000, 11), capacitePaquet(8000, 2));
});

// ═══════════════════════════════════════════════════════════════════════
// IDENTITE DE DOCUMENT ET ORDRE D'EMISSION (remontes de porte-core.js le
// 05/08/2026 avec la couche d'emission : ce sont des regles du TRANSPORT).
// ⚠️ Ces cas vivent ICI et pas dans le fichier property : Stryker N'EXECUTE PAS
//    les property-tests. Une garde prouvee seulement par property laisse des
//    mutants survivants et le score MENT (paye deux fois le 05/08/2026).
// ═══════════════════════════════════════════════════════════════════════

test('BASE_ID : un morceau retrouve son document, un document reste lui-meme', () => {
  assert.strictEqual(baseId('docs/foo.md'), 'docs/foo.md');
  assert.strictEqual(baseId('docs/foo.md#3'), 'docs/foo.md');
  // Premier '#' seulement : un id qui en contient deux ne doit pas se couper au dernier.
  assert.strictEqual(baseId('a#1#2'), 'a');
});

test('ORDONNER : la file passe DEVANT le frais (RFC 6455, jamais entrelace)', () => {
  const file = [{ id: 'a#1', text: 'A1' }];
  const frais = [{ id: 'b', text: 'B' }];
  assert.deepStrictEqual(ordonner(file, frais).map((s) => s.id), ['a#1', 'b']);
});

test('ORDONNER : une doc DEJA en file nest pas re-empilee (dedup par DOCUMENT)', () => {
  // ⚠️ LE CAS FONDATEUR : une doc `dumb` est re-decidee a CHAQUE geste. Sans la
  //    dedup, elle serait re-empilee ENTIERE derriere ses propres morceaux —
  //    doublon de tokens ET recollage impossible.
  const file = [{ id: 'a#2', text: 'A2' }, { id: 'a#3', text: 'A3' }];
  const frais = [{ id: 'a', text: 'A ENTIER' }, { id: 'b', text: 'B' }];
  assert.deepStrictEqual(ordonner(file, frais).map((s) => s.id), ['a#2', 'a#3', 'b']);
});

test('ORDONNER : la dedup compare des DOCUMENTS des DEUX cotes, pas des ids bruts', () => {
  // Sans baseId cote frais, un morceau frais `a#1` passerait alors que `a` est
  // deja en file — deux versions du meme document en vol.
  const file = [{ id: 'a', text: 'A' }];
  const frais = [{ id: 'a#1', text: 'A1' }];
  assert.deepStrictEqual(ordonner(file, frais).map((s) => s.id), ['a']);
});

test('ORDONNER : entrees absentes/invalides = degradation, jamais un crash', () => {
  assert.deepStrictEqual(ordonner(undefined, [{ id: 'x', text: 'X' }]).map((s) => s.id), ['x']);
  assert.deepStrictEqual(ordonner([{ id: 'y', text: 'Y' }], undefined).map((s) => s.id), ['y']);
  assert.deepStrictEqual(ordonner(null, null), []);
});

// ═══════════════════════════════════════════════════════════════════════
// BUDGET INFINI = « CE HARNAIS NE BORNE RIEN » (05/08/2026)
// ⚠️ Cas DETERMINISTES obligatoires ici : Stryker n'execute PAS les
//    property-tests. Une garde prouvee seulement par property laisse des
//    mutants survivants et le score MENT (paye deux fois le 05/08).
// ⚠️ DEFAUT REEL qu'ils scellent : `Number.isFinite(Infinity)` est FAUX, donc
//    l'infini retombait sur le PLANCHER de 8 000 — on morcelait un skill en
//    11 gestes alors que Codex acceptait tout d'un bloc, en SILENCE.
// ═══════════════════════════════════════════════════════════════════════

test('BUDGET INFINI : tout part en UNE trame, zero differe, contenu INTACT', () => {
  const gros = 'X'.repeat(76000);
  const p = planifierPaquets([{ id: 'gros', text: gros, label: 'skill' }], Infinity, 1);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].differes.length, 0, 'un budget infini ne differe RIEN');
  assert.ok(p[0].texte.includes(gros), 'contenu integral, jamais tronque');
});

test('BUDGET INFINI : ni sceau ni en-tete (rendu HISTORIQUE, donc parite)', () => {
  // Le sceau ne sert qu'a rendre une TRONCATURE bruyante. Sans borne, il n'y a
  // rien a signaler : annoncer un marqueur de fin serait du bruit pur.
  const p = planifierPaquets([{ id: 'a', text: 'A'.repeat(50000), label: 'a' }], Infinity, 1);
  assert.ok(!/###FIN:/.test(p[0].texte), 'aucun sceau quand rien ne peut etre tronque');
  assert.ok(!/MORCEAU/.test(p[0].texte), 'aucun morcelage');
});

test('BUDGET INFINI vs PLANCHER : le meme corpus differe a 8000 et PAS a l infini', () => {
  // ⚠️ LE TEMOIN DU BUG. Sans lui, un mutant qui retire le chemin `Infinity`
  //    survit : les deux branches rendraient « 1 paquet », et seul le nombre
  //    de DIFFERES distingue le plancher de l'absence de borne.
  const segs = () => [{ id: 'g', text: 'Y'.repeat(76000), label: 'g' }];
  assert.ok(planifierPaquets(segs(), 8000, 1)[0].differes.length > 0, 'temoin : a 8000 ca deborde');
  assert.strictEqual(planifierPaquets(segs(), Infinity, 1)[0].differes.length, 0);
});

test('BUDGET : -Infinity et NaN retombent sur le PLANCHER (jamais un infini devine)', () => {
  // Seul `Infinity` POSITIF veut dire « aucune limite ». Tout le reste est une
  // valeur illisible : plancher, jamais une borne inventee.
  const seg = () => [{ id: 'a', text: 'A'.repeat(20000), label: 'a' }];
  assert.ok(planifierPaquets(seg(), -Infinity, 1)[0].differes.length > 0);
  assert.ok(planifierPaquets(seg(), NaN, 1)[0].differes.length > 0);
});
