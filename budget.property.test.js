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
import { planifier, DEFAUT_BUDGET, tailleEnveloppe } from './budget.js';

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
    fc.integer({ min: 5, max: 110 }).map((pct) => tailleEnveloppe() + Math.max(1, Math.ceil((total * pct) / 100)))
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
      // C'est la garantie « pas de perte silencieuse » : le compte y est,
      // et chaque doc absente est citée par son label.
      expect(r.texte).toContain(String(r.differes.length) + ' doc(s) NON injectée(s)');
      for (const d of r.differes) expect(r.texte).toContain(d.label);
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
