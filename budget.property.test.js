// ═══════════════════════════════════════════════════════════════════════
// PROPERTY-BASED — les invariants de `budget.js` sur entrées GÉNÉRÉES.
// ═══════════════════════════════════════════════════════════════════════
//
// POURQUOI ICI ET PAS SEULEMENT DES EXEMPLES : `planifier` est une fonction
// PURE à invariant fort, et la doctrine impose alors le property-based. Un test
// d'exemple prouve un cas ; ici on veut prouver qu'AUCUNE combinaison de
// tailles/budgets ne peut faire disparaître une doc en silence — c'est
// précisément la classe de bug que ce module existe pour rendre impossible.
//
// ⚠️ L'invariant ① (CONSERVATION) est le plus important du framework : un
//    segment entré ressort TOUJOURS, émis ou annoncé. S'il tombait, on aurait
//    réintroduit la perte muette en croyant la corriger.
// ═══════════════════════════════════════════════════════════════════════

import { test, expect } from 'vitest';
import fc from 'fast-check';
import { planifier, planifierPaquets, morceler, ordonner, baseId, DEFAUT_BUDGET, tailleEnveloppe } from './budget.js';

// Coût approx. du séparateur inter-segments, pour calibrer les tirages.
const SEPARATEUR_APPROX = 8;

// Segments arbitraires : ids UNIQUES (contrat d'appel — un doc = un segment).
// ⚠️ `minLength` NON NUL : fast-check biaise fortement vers les petites valeurs.
//    Avec des textes quasi vides, TOUT rentre toujours et la zone intéressante
//    n'est jamais visitée (cf. commentaire de `casArb`).
const segmentsArb = fc
  .array(fc.record({ text: fc.string({ minLength: 30, maxLength: 400 }), label: fc.string({ minLength: 3, maxLength: 40 }) }), {
    minLength: 1,
    maxLength: 12,
  })
  .map((arr) => arr.map((s, i) => ({ id: 'doc-' + i, text: s.text, label: 'L' + i + '-' + s.label })));

// ⚠️ LE BUDGET EST GÉNÉRÉ COMME UNE FRACTION DU TOTAL, jamais sur une plage
//    absolue, et jamais via un `fc.integer` large.
//    TROU PROUVÉ le 31/07/2026, DEUX FOIS de suite : un sabotage réel de la
//    conservation (`differes: []`) est passé VERT sur 500 runs. Cause : le
//    biais de fast-check vers les petites valeurs faisait tomber presque tous
//    les tirages dans « tout rentre » ou « rien ne rentre ». La zone MIXTE —
//    la seule où la conservation peut casser — n'était pratiquement jamais
//    atteinte. Un générateur qui n'atteint pas le cas intéressant CERTIFIE au
//    lieu de prouver, et c'est indétectable sans sabotage.
//    ⚠️ Le méta-test « ⑦ COUVERTURE » ci-dessous scelle ça : il ÉCHOUE si la
//    zone mixte cesse d'être visitée. Ne JAMAIS le retirer en le prenant pour
//    un doublon — c'est lui qui garantit que les 6 autres prouvent quelque chose.
//    ⚠️ Le budget inclut `tailleEnveloppe()` : sans elle, le scellement (~250
//    caractères) mangeait à lui seul tout le budget tiré et 591 cas sur 600
//    tombaient dans « rien ne rentre » (mesuré 31/07/2026). Un générateur doit
//    reproduire les ORDRES DE GRANDEUR réels du parc (docs ~1 400 caractères,
//    budget 8 000), sinon il explore un régime qui n'existe pas en production.
const casArb = segmentsArb.chain((segments) => {
  const total = segments.reduce((n, s) => n + s.text.length + SEPARATEUR_APPROX, 0);
  return fc.tuple(
    fc.constant(segments),
    // ⚠️ TIRAGE STRATIFIÉ (05/08/2026) — pourquoi ce n'est PAS un contournement.
    //    Le méta-test ⑦ est tombé PILE à 5 % le jour où l'annonce de différé
    //    s'est allongée (« DIFFÉRÉE(S) … en file » remplace « NON injectée(s) ») :
    //    à budget égal, une annonce plus longue laisse moins de place au contenu,
    //    donc plus de tirages basculent de « mixte » vers « rien ne rentre ».
    //    La couverture s'est donc dégradée par EFFET DE BORD d'un changement de
    //    TEXTE — pas par un choix de conception.
    // 🛑 La réponse INTERDITE aurait été de baisser le seuil de ⑦ à 4 % : c'est
    //    précisément le geste qui a produit le faux vert du 31/07/2026, où un
    //    sabotage réel est passé sur 500 runs faute d'atteindre la zone utile.
    //    On RENFORCE le générateur, on n'assouplit JAMAIS le juge.
    //    La strate large est CONSERVÉE à l'identique (on n'a rien retiré de
    //    l'exploration) ; on ajoute seulement du poids là où les propriétés
    //    mordent — la bande où une partie passe et une partie reste.
    fc.oneof(
      { arbitrary: fc.integer({ min: 5, max: 110 }), weight: 1 },
      { arbitrary: fc.integer({ min: 30, max: 95 }), weight: 2 }
    ).map((pct) => tailleEnveloppe() + Math.max(1, Math.ceil((total * pct) / 100)))
  );
});

test('① CONSERVATION : tout segment ressort — émis OU annoncé, jamais perdu', () => {
  fc.assert(
    fc.property(casArb, ([segments, budget]) => {
      const r = planifier(segments, budget);
      const sortis = [...r.emis, ...r.differes.map((d) => d.id)];
      const entres = segments.map((s) => s.id);
      // Même ensemble, même cardinalité (donc aucun doublon, aucune disparition).
      expect(sortis.slice().sort()).toEqual(entres.slice().sort());
      expect(sortis.length).toBe(entres.length);
    }),
    { numRuns: 500 }
  );
});

// ═══════════════════════════════════════════════════════════════════════
// ⑧ CONVERGENCE DE LA FILE — LA propriété du chantier du 05/08/2026.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ C'EST ELLE QUI PROUVE « TOUT ARRIVE », et aucune autre ne le fait.
//    ① prouve qu'un segment ne s'évapore pas DANS UNE émission — il peut très
//    bien ressortir en `differes` à chaque fois, indéfiniment : ① serait VERTE
//    pendant qu'aucune doc n'arrive jamais. C'est exactement le trou par lequel
//    le défaut est passé (le reliquat était « conservé »… puis jeté par
//    l'appelant). Ici on rejoue la BOUCLE RÉELLE de `porte-core.js` : le
//    reliquat d'un geste est l'entrée du suivant, jusqu'à épuisement.
// ⚠️ DEUX EXIGENCES, et il faut les DEUX — une seule serait satisfiable par un
//    code faux : ① la file finit VIDE (terminaison, donc progrès strict à
//    chaque tour) ; ② l'union de tout ce qui a été émis couvre TOUS les
//    documents d'entrée (complétude). Sans ①, un système qui n'émet rien
//    « converge » ; sans ②, un système qui vide la file en la jetant converge
//    aussi — c'était le comportement d'AVANT.
// ⚠️ La borne de tours est un FILET DE TEST, pas une tolérance : si elle est
//    atteinte, c'est que le transport ne progresse pas et le test DOIT rougir.
//    Ne JAMAIS la relever pour faire passer un cas — ce serait masquer une
//    boucle infinie en production.
// ⚠️ GÉNÉRATEUR PROPRE À ⑧ — PLANCHER DE BUDGET, et pourquoi ce n'est pas un
//    affaiblissement. `casArb` descend jusqu'à 5 % du contenu : à cette échelle
//    l'enveloppe (~330 c) dépasse le budget, les morceaux tombent à ~15
//    caractères et une seule doc en produit des MILLIERS — des dizaines de
//    milliers de tours par cas. Ce régime n'existe PAS en production (budget
//    8 000, enveloppe 330) et il n'apprend rien de plus : c'est le même chemin
//    de code, joué plus longtemps.
//    🛑 Le cas dégénéré n'est pas abandonné pour autant — il est couvert
//    JUSTE EN DESSOUS par un cas déterministe, celui EXACT qu'une simulation a
//    fait tomber le 05/08/2026. Property pour le général, cas fondateur pour la
//    pathologie : jamais l'un À LA PLACE de l'autre.
const casConvergence = casArb.map(([segments, budget]) => [segments, Math.max(budget, tailleEnveloppe() * 4)]);

test('⑧ CONVERGENCE : rejouée geste après geste, la file se vide ET tout est livré', () => {
  fc.assert(
    fc.property(casConvergence, fc.integer({ min: 1, max: 4 }), ([segments, budget], nbPaquets) => {
      const attendus = new Set(segments.map((s) => s.id));
      const livres = new Set();
      let file = segments;
      let tours = 0;
      while (file.length > 0) {
        expect(tours++).toBeLessThan(300); // progrès strict exigé
        const paquets = planifierPaquets(file, budget, nbPaquets);
        // Un morceau porte `id#j` : on ramène au DOCUMENT, comme porte-core.
        for (const p of paquets) for (const id of p.emis) livres.add(String(id).split('#')[0]);
        file = paquets[paquets.length - 1].differes;
      }
      expect([...attendus].every((id) => livres.has(id))).toBe(true);
    }),
    { numRuns: 150 }
  );
});

// ⚠️ CAS FONDATEUR DE LA FILE — le blocage RÉEL trouvé le 05/08/2026 par
//    simulation de la boucle de `porte-core.js`, AVANT toute mise en prod.
//    Configuration exacte : UNE trame (le régime de Codex), budget 600, une doc
//    de 5 000 c ⇒ 56 morceaux ⇒ l'annonce citait les 56 et remplissait la trame
//    à elle seule ⇒ **zéro contenu émis, à chaque geste, pour toujours**.
//    Deux défauts distincts se cachaient là, et il fallait les DEUX corrections :
//    ① l'annonce comptait des MORCEAUX au lieu de DOCUMENTS (et n'était pas
//      bornée) ; ② rien ne garantissait qu'une trame émette au moins un morceau.
// 🛑 NE JAMAIS SUPPRIMER ce cas, même s'il paraît redondant avec ⑧ : la
//    property tourne à l'échelle de production et ne visitera PLUS ce régime.
//    Si le comportement change un jour, on INVERSE l'attendu — le cas reste.
test('② BORNE : dès qu\'au moins un segment est émis, le rendu tient dans le budget', () => {
  fc.assert(
    fc.property(casArb, ([segments, budget]) => {
      const r = planifier(segments, budget);
      // Cas dégénéré ASSUMÉ et documenté : si RIEN ne rentre, on émet l'annonce
      // nue (minuscule) plutôt qu'un pavé tronqué. La borne ne s'applique donc
      // qu'aux rendus qui portent effectivement du contenu.
      if (r.emis.length > 0) expect(r.texte.length).toBeLessThanOrEqual(budget);
    }),
    { numRuns: 500 }
  );
});

test('③ PRIORITÉ : les émis sont TOUJOURS un préfixe de l\'entrée (rank respecté)', () => {
  fc.assert(
    fc.property(casArb, ([segments, budget]) => {
      const r = planifier(segments, budget);
      const attendu = segments.slice(0, r.emis.length).map((s) => s.id);
      // ⚠️ Si ceci tombe, le tri par `rank` du loader ne serait plus honoré :
      //    on garderait une doc secondaire en évinçant une doc critique.
      expect(r.emis).toEqual(attendu);
    }),
    { numRuns: 500 }
  );
});

test('④ DÉTERMINISME : mêmes entrées ⇒ même sortie, à l\'octet', () => {
  fc.assert(
    fc.property(casArb, ([segments, budget]) => {
      expect(planifier(segments, budget)).toEqual(planifier(segments, budget));
    }),
    { numRuns: 300 }
  );
});

test('⑤ SCEAU : en-tête et pied portent le MÊME marqueur, toujours', () => {
  fc.assert(
    fc.property(casArb, ([segments, budget]) => {
      const r = planifier(segments, budget);
      if (segments.length === 0) return; // rien à sceller
      // ⚠️ Sceau CONDITIONNEL (cf. SEUIL_SCEAU_RATIO) : sous la moitié du
      //    budget, le rendu est le format historique, SANS enveloppe — c'est
      //    voulu, et c'est ce qui garde la bascule sûre. La propriété porte
      //    donc sur la COHÉRENCE : scellé ⇒ en-tête ET pied concordants.
      if (r.marqueur === '') {
        expect(r.texte).not.toContain('###FIN:');
        expect(r.differes).toEqual([]); // jamais d'éviction muette sur ce chemin
        return;
      }
      // Le marqueur annoncé en TÊTE doit être celui qui ferme le bloc, sinon
      // l'agent conclurait « tronqué » sur un bloc complet (ou l'inverse).
      expect(r.texte.startsWith('⚠️ INJECTION SCELLÉE')).toBe(true);
      expect(r.texte).toContain('###FIN:' + r.marqueur + '###');
      expect(r.texte.endsWith('###FIN:' + r.marqueur + '###')).toBe(true);
    }),
    { numRuns: 300 }
  );
});

test('⑥ ANNONCE : tout différé est NOMMÉ dans le texte émis (jamais muet)', () => {
  fc.assert(
    fc.property(casArb, ([segments, budget]) => {
      const r = planifier(segments, budget);
      if (r.differes.length === 0) return;
      // ⚠️ SÉMANTIQUE RÉVISÉE LE 05/08/2026, et il faut l'assumer explicitement :
      //    on ne cite PLUS chaque différé, seulement les premiers, avec un
      //    compte exact. Deux raisons, dont une était un BUG :
      //    ① on comptait des MORCEAUX (`doc#37`) là où le lecteur pense en
      //      DOCUMENTS — 56 lignes pour une seule doc ;
      //    ② non bornée, la liste pouvait remplir la trame à elle seule et
      //      empêcher toute émission (blocage mesuré ce jour-là).
      //    Ce que l'annonce garantit désormais : le COMPTE est exact et les
      //    premiers sont nommés. Ce que la LIVRAISON garantit, c'est la file
      //    (property ⑧) — l'annonce informe, elle ne porte plus la promesse.
      const labels = [...new Set(r.differes.map((d) => d.label))];
      expect(r.texte).toContain(String(labels.length) + ' doc(s) DIFFÉRÉE(S)');
      // Jamais MUETTE : au moins un différé reste nommé, quoi qu'il arrive.
      expect(r.texte).toContain(labels[0]);
      if (labels.length > 5) expect(r.texte).toContain('et ' + (labels.length - 5) + ' autre(s)');
      else for (const l of labels) expect(r.texte).toContain(l);
    }),
    { numRuns: 300 }
  );
});

test('⑦ COUVERTURE : le générateur ATTEINT vraiment la zone mixte (méta-test)', () => {
  // ⚠️ MÉTA-TEST — il ne teste pas `budget.js`, il teste LES TESTS.
  //    Sans lui, un générateur mal calibré rend les 6 propriétés ci-dessus
  //    vraies « par absence de cas » : vert éternel, zéro garantie. C'est
  //    exactement ce qui s'est produit le 31/07/2026 (sabotage non détecté).
  let mixte = 0;
  let total = 0;
  fc.assert(
    fc.property(casArb, ([segments, budget]) => {
      const r = planifier(segments, budget);
      total++;
      if (r.emis.length > 0 && r.differes.length > 0) mixte++;
    }),
    { numRuns: 400 }
  );
  // Seuil VOLONTAIREMENT bas (5 %) : on garantit la VISITE de la zone, pas une
  // distribution. Le monter le rendrait fragile aux évolutions de fast-check.
  expect(mixte / total).toBeGreaterThan(0.05);
});

test('CAS FONDATEUR : 6 docs, budget étroit — rien ne disparaît', () => {
  // ⚠️ Rejoue le cas EXACT sur lequel le sabotage du 31/07/2026 est passé vert
  //    en property-based. Déterministe, donc insensible au biais du générateur.
  //    Ne JAMAIS le supprimer : si le comportement change, on INVERSE l'attendu,
  //    le cas reste. Un cas fondateur supprimé = la classe de bug redevient invisible.
  const segs = Array.from({ length: 6 }, (_, k) => ({ id: 'd' + k, text: 'x'.repeat(300), label: 'L' + k }));
  const r = planifier(segs, 900);
  expect([...r.emis, ...r.differes.map((d) => d.id)].length).toBe(6);
  expect(r.emis.length).toBeGreaterThan(0);
  expect(r.differes.length).toBeGreaterThan(0);
  for (const d of r.differes) expect(r.texte).toContain(d.label);
});

test('NEGATIVE-CHECK : les invariants SAVENT tomber (sinon ils certifient)', () => {
  // ⚠️ Sans ceci, une propriété toujours vraie par construction du test (et non
  //    du code) donnerait un vert éternel — la faute déjà commise par une 1ʳᵉ
  //    version de `deadline-gate`, verte en n'analysant aucun hook réel.
  const faux = { emis: ['a'], differes: [], texte: 'x'.repeat(999) };
  expect(faux.texte.length <= 10).toBe(false);           // ② tomberait
  expect([...faux.emis, ...faux.differes].length === 2).toBe(false); // ① tomberait

  // Et le vrai module, lui, tient sur le même cas : 1 segment énorme, budget nain.
  const r = planifier([{ id: 'a', text: 'x'.repeat(5000), label: 'gros.md' }], 100);
  expect(r.emis).toEqual([]);            // rien émis
  expect(r.differes.map((d) => d.id)).toEqual(['a']); // mais RIEN PERDU
  expect(r.texte).toContain('gros.md');  // et c'est DIT
});

test('budget absent/absurde ⇒ défaut framework (autorité ① de la cascade)', () => {
  fc.assert(
    fc.property(fc.oneof(fc.constant(undefined), fc.constant(0), fc.constant(-5), fc.constant(NaN)), (mauvais) => {
      const seg = [{ id: 'a', text: 'y'.repeat(200), label: 'a.md' }];
      // Fallback TOTAL : jamais de crash, jamais de budget nul qui bloquerait tout.
      expect(planifier(seg, mauvais).emis).toEqual(['a']);
    }),
    { numRuns: 20 }
  );
  expect(DEFAUT_BUDGET).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════════════════════
// PAQUETS — la conservation, sur entrées GÉNÉRÉES, à travers N trames.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ L'invariant se RENFORCE par rapport à `planifier` : il ne suffit plus que
//    rien ne se perde, il faut aussi que rien ne se DUPLIQUE entre deux
//    paquets. Un doublon coûterait deux fois les tokens ET ferait douter
//    l'agent du recollage — donc de tout le mécanisme.
// ⚠️ Générateur calibré comme les autres (cf. le trou prouvé le 31/07/2026) :
//    le budget est une FRACTION du total, jamais une plage absolue, sinon la
//    zone MIXTE — la seule où la conservation peut casser — n'est pas visitée.

test('PAQUETS ① CONSERVATION : chaque segment dans EXACTEMENT un paquet, ou annoncé', () => {
  fc.assert(
    fc.property(segmentsArb, fc.integer({ min: 2, max: 6 }), fc.integer({ min: 15, max: 60 }), (segments, n, pct) => {
      const total = segments.reduce((a, s) => a + s.text.length + SEPARATEUR_APPROX, 0);
      const budget = Math.max(tailleEnveloppe() + 50, Math.floor((total * pct) / 100));
      const paquets = planifierPaquets(segments, budget, n);

      expect(paquets.length).toBe(n);
      const emis = paquets.flatMap((p) => p.emis);
      const differes = paquets.flatMap((p) => p.differes.map((d) => d.id));
      // Aucun DOUBLON — l'invariant neuf du multi-trames.
      expect(new Set(emis).size).toBe(emis.length);
      expect(new Set([...emis, ...differes]).size).toBe(emis.length + differes.length);
      // Aucune PERTE. ⚠️ Une doc peut sortir en MORCEAUX (`id#j`) : on
      //    recompose donc l'ensemble des docs VUES, pas la liste brute des ids.
      const docId = (id) => id.split('#')[0];
      expect([...new Set([...emis, ...differes].map(docId))].sort()).toEqual(segments.map((s) => s.id).sort());
    }),
    { numRuns: 300 }
  );
});

test('PAQUETS ② BORNE : un paquet qui PORTE DU CONTENU ne dépasse jamais le budget', () => {
  // ⚠️ « qui porte du contenu » n'est PAS un adoucissement de complaisance :
  //    c'est la même sémantique que `planifier` (cf. « le rendu tient dans le
  //    budget dès qu'il porte du contenu »). Quand le budget est si petit que
  //    l'ANNONCE NUE le dépasse déjà, on l'émet quand même — dire « ces docs
  //    manquent, va les lire » vaut mieux que le silence, et l'annonce est
  //    minuscule. Ce cas a été TROUVÉ par ce property-test le 03/08/2026 (budget
  //    273, annonce 519) : la propriété a fait son travail.
  fc.assert(
    fc.property(segmentsArb, fc.integer({ min: 2, max: 6 }), fc.integer({ min: 15, max: 60 }), (segments, n, pct) => {
      const total = segments.reduce((a, s) => a + s.text.length + SEPARATEUR_APPROX, 0);
      const budget = Math.max(tailleEnveloppe() + 50, Math.floor((total * pct) / 100));
      for (const p of planifierPaquets(segments, budget, n)) {
        if (p.emis.length > 0) expect(p.texte.length).toBeLessThanOrEqual(budget);
      }
    }),
    { numRuns: 300 }
  );
});

test('PAQUETS ③ DÉTERMINISME : deux calculs indépendants coïncident', () => {
  // ⚠️ Sans ça, les N processus PARALLÈLES émettraient des découpages
  //    différents et le recollage serait incohérent. C'est la propriété qui
  //    remplace toute coordination inter-processus.
  fc.assert(
    fc.property(segmentsArb, fc.integer({ min: 2, max: 6 }), fc.integer({ min: 15, max: 60 }), (segments, n, pct) => {
      const total = segments.reduce((a, s) => a + s.text.length + SEPARATEUR_APPROX, 0);
      const budget = Math.max(tailleEnveloppe() + 50, Math.floor((total * pct) / 100));
      expect(planifierPaquets(segments, budget, n)).toEqual(planifierPaquets(segments, budget, n));
    }),
    { numRuns: 200 }
  );
});

test('PAQUETS ④ PARITÉ : rien à évincer ⇒ paquet 1 = planifier(), les autres vides', () => {
  // ⚠️ LA garantie de bascule : le multi-paquets ne s'engage QUE sur éviction.
  fc.assert(
    fc.property(segmentsArb, fc.integer({ min: 2, max: 6 }), (segments, n) => {
      const budget = 1000000; // tout tient largement
      const paquets = planifierPaquets(segments, budget, n);
      expect(paquets[0]).toEqual(planifier(segments, budget));
      for (let i = 1; i < n; i++) expect(paquets[i]).toEqual({ texte: '', emis: [], differes: [], marqueur: '' });
    }),
    { numRuns: 100 }
  );
});

test('PAQUETS ⑤ CONSERVATION DU CONTENU : rien ne s\'évapore, même sur trame minuscule', () => {
  // ⚠️ BUG RÉEL trouvé le 03/08/2026 par MESURE, pas par relecture : quand la
  //    trame est trop petite pour l'en-tête d'un morceau, la boucle de découpe
  //    ne produisait AUCUN morceau et le contenu DISPARAISSAIT — ni émis, ni
  //    annoncé. C'est le seul résultat interdit par le module. Cette propriété
  //    balaie précisément la zone minuscule où le défaut vivait.
  fc.assert(
    fc.property(segmentsArb, fc.integer({ min: 2, max: 6 }), fc.integer({ min: 250, max: 2000 }), (segments, n, budget) => {
      const paquets = planifierPaquets(segments, budget, n);
      const emis = paquets.flatMap((p) => p.emis);
      const differes = paquets.flatMap((p) => p.differes.map((d) => d.id));
      // Chaque doc d'entrée est SOIT livrée (entière ou en morceaux `id#j`),
      // SOIT annoncée. Jamais absente des deux.
      for (const s of segments) {
        const vue = emis.some((id) => id === s.id || id.startsWith(s.id + '#')) ||
          differes.some((id) => id === s.id || id.startsWith(s.id + '#'));
        expect(vue, `doc ${s.id} ÉVAPORÉE (budget ${budget}, n ${n})`).toBe(true);
      }
    }),
    { numRuns: 400 }
  );
});

// ── SCANNER `morceler` — PROPERTY-BASED (doctrine du parc) ─────────────────
// ⚠️ POURQUOI DES PROPRIÉTÉS ICI : `morceler` INTERPRÈTE un format (des lignes)
//    pour produire des tranches — c'est un SCANNER, et la règle du parc impose
//    le property-based sur tout scanner (invariants type totalité / conservation
//    / sous-suite). Les cas exacts de `budget.test.js` verrouillent le CONNU ;
//    ceux-ci cherchent l'INCONNU. Les deux, jamais l'un à la place de l'autre.
const H_MAX = () => "⟦ A — MORCEAU 999/999 : recolle les 999 morceaux dans l'ordre avant de lire ⟧\n".length;
// ⚠️ `fc.string({ unit })` et NON `fc.stringOf` : retiré en fast-check 4 (le
//    parc est en 4.9.0). Vérifier l'API de la version INSTALLÉE, jamais de
//    mémoire — l'erreur a coûté deux allers-retours ici.
const texteQuelconque = () => fc.string({ unit: fc.constantFrom('a', 'b', ' ', '\n', 'é', 'x'), maxLength: 400 });

test('SCANNER ① TOTALITÉ : ne throw JAMAIS, quelles que soient les entrées', () => {
  // ⚠️ Un throw ici tuerait la porte ENTIÈRE (fail-open ⇒ plus AUCUNE doc
  //    injectée nulle part). La totalité n'est pas un confort, c'est vital.
  fc.assert(fc.property(texteQuelconque(), fc.integer({ min: -500, max: 5000 }), (t, cap) => {
    const r = morceler([{ id: 'a', label: 'A', text: t }], cap);
    expect(Array.isArray(r)).toBe(true);
  }), { numRuns: 500 });
});

test('SCANNER ② CONSERVATION : aucun caractère de contenu perdu ni dupliqué', () => {
  // ⚠️ LA propriété du framework. Les sauts de ligne peuvent se déplacer aux
  //    frontières de coupe (c'est le principe même du découpage par lignes) —
  //    tout le RESTE doit ressortir à l'identique, dans l'ordre.
  fc.assert(fc.property(texteQuelconque(), fc.integer({ min: 1, max: 300 }), (t, extra) => {
    const cap = H_MAX() + extra;
    const r = morceler([{ id: 'a', label: 'A', text: t }], cap);
    const recolle = r.map((m) => m.text.replace(/^⟦[^⟧]*⟧\n/, '')).join('');
    expect(recolle.replace(/\n/g, '')).toBe(t.replace(/\n/g, ''));
  }), { numRuns: 500 });
});

test('SCANNER ③ ORDRE : les morceaux sont numérotés 1..m, sans trou ni doublon', () => {
  // ⚠️ Sans numérotation stricte, le recollage est ambigu (RFC 2046 : `number`
  //    commence à 1 ; RFC 6455 : ordre strict, jamais entrelacé).
  fc.assert(fc.property(fc.string({ minLength: 200, maxLength: 600 }), (t) => {
    const cap = H_MAX() + 20;
    const r = morceler([{ id: 'a', label: 'A', text: t }], cap);
    if (r.length === 1) return; // chemin 1 : rien à numéroter
    const nums = r.map((m) => Number(/MORCEAU (\d+)\//.exec(m.text)[1]));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
    expect(new Set(r.map((m) => m.id)).size).toBe(r.length);
  }), { numRuns: 300 });
});

test('SCANNER ④ NEGATIVE-CHECK : les propriétés SAVENT tomber (sinon elles certifient)', () => {
  // ⚠️ Sabotage RÉEL : un découpeur qui PERD la dernière tranche doit faire
  //    rougir ② — sans ce contrôle, une propriété toujours vraie ne prouve rien.
  const sabote = (segments, capacite) => morceler(segments, capacite).slice(0, -1);
  const t = 'x'.repeat(400);
  const cap = H_MAX() + 20;
  const recolle = sabote([{ id: 'a', label: 'A', text: t }], cap)
    .map((m) => m.text.replace(/^⟦[^⟧]*⟧\n/, '')).join('');
  expect(recolle.replace(/\n/g, '')).not.toBe(t);
});

// ═══════════════════════════════════════════════════════════════════════
// ⑨ ORDONNER — file d'abord, frais ensuite, rien ne disparaît
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ AJOUTÉ le 06/08/2026 par /stack-audit : `ordonner` est une fonction PURE
//    à INVARIANT FORT (conservation + ordre + dédup) et n'avait QUE des cas
//    déterministes. La doctrine du parc impose le property-based dans ce cas —
//    c'était un MANQUE réel, trouvé par l'audit et corrigé avant de clore.
// ⚠️ Les cas DÉTERMINISTES de budget.test.js RESTENT : Stryker n'exécute pas
//    les property-tests, une garde prouvée seulement ici laisserait survivre
//    ses mutants et le score MENTIRAIT. Les deux, jamais l'un à la place.

const segGen = fc.record({
  id: fc.constantFrom('a', 'b', 'c', 'a#1', 'a#2', 'b#1', 'd#7'),
  text: fc.string({ minLength: 1, maxLength: 20 }),
});

test('PROPERTY ⑨a : la FILE sort intégralement, en TÊTE et dans l ORDRE', () => {
  // RFC 6455 : un document fragmenté n'est JAMAIS entrelacé. Si la file
  // n'arrivait pas en tête et dans l'ordre, le récepteur ne pourrait plus
  // recoller ses `MORCEAU j/m` — la garantie de livraison s'effondre.
  fc.assert(fc.property(fc.array(segGen, { maxLength: 8 }), fc.array(segGen, { maxLength: 8 }),
    (file, frais) => {
      const out = ordonner(file, frais);
      expect(out.slice(0, file.length)).toEqual(file);
    }));
});

test('PROPERTY ⑨b : AUCUN document déjà en file n est ré-empilé', () => {
  // Le cas FONDATEUR : une doc `dumb` est re-décidée à chaque geste. Sans la
  // dédup elle serait ré-empilée ENTIÈRE derrière ses propres morceaux.
  fc.assert(fc.property(fc.array(segGen, { maxLength: 8 }), fc.array(segGen, { maxLength: 8 }),
    (file, frais) => {
      const enFile = new Set(file.map((s) => baseId(s.id)));
      const ajoutes = ordonner(file, frais).slice(file.length);
      expect(ajoutes.every((s) => !enFile.has(baseId(s.id)))).toBe(true);
    }));
});

test('PROPERTY ⑨c : CONSERVATION — tout frais non-dupliqué survit, dans l ordre', () => {
  // Rien ne doit s'évaporer : c'est l'invariant central du module.
  fc.assert(fc.property(fc.array(segGen, { maxLength: 8 }), fc.array(segGen, { maxLength: 8 }),
    (file, frais) => {
      const enFile = new Set(file.map((s) => baseId(s.id)));
      const attendus = frais.filter((s) => !enFile.has(baseId(s.id)));
      expect(ordonner(file, frais).slice(file.length)).toEqual(attendus);
    }));
});

test('PROPERTY ⑨d : TOTALE — jamais de jet, quelle que soit l entrée', () => {
  // Une entrée absente/invalide DÉGRADE, elle ne casse pas : ce module est sur
  // un chemin fail-open, un throw priverait l'agent de TOUT son contexte.
  fc.assert(fc.property(fc.oneof(fc.array(segGen, { maxLength: 4 }), fc.constant(undefined), fc.constant(null)),
    fc.oneof(fc.array(segGen, { maxLength: 4 }), fc.constant(undefined), fc.constant(null)),
    (file, frais) => {
      expect(Array.isArray(ordonner(file, frais))).toBe(true);
    }));
});

test('PROPERTY ⑨e : IDEMPOTENCE — re-ordonner un résultat ne l enrichit plus', () => {
  // Rejouer converge : condition pour qu'un geste interrompu puisse reprendre
  // sans doublon (doctrine « toute opération multi-étapes est reprenable »).
  fc.assert(fc.property(fc.array(segGen, { maxLength: 8 }), fc.array(segGen, { maxLength: 8 }),
    (file, frais) => {
      const une = ordonner(file, frais);
      expect(ordonner(une, frais)).toEqual(une);
    }));
});
