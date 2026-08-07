// ═══════════════════════════════════════════════════════════════════════
// GATE — TOUT STORE DÉCLARÉ EST CONNU DU RESET (couplage par le STOCKAGE)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI CE GATE EXISTE (07/08/2026, REFACTOR-PLAN ㉕). `reset.md` porte
//    depuis des semaines la consigne « Tout nouveau store DOIT être ajouté ici
//    dans le MÊME geste » — **en PROSE**. Or la doctrine du repo est explicite :
//    un invariant qui dépend de la vigilance finit par être violé, et celui-ci
//    échoue en SILENCE (« en oublier un ne casse rien de visible : ça produit
//    des docs jamais réinjectées après compaction, découvert des sessions plus
//    tard »). Une consigne qu'aucune machine ne vérifie est un vœu.
//
// ⚠️ LA CLASSE QU'IL ADRESSE : le **couplage par le STOCKAGE** — deux fichiers
//    qui s'accordent sur un littéral de préfixe sans qu'aucun lien de code ne
//    les relie. `dependency-cruiser` voit les IMPORTS, `couches-gate` voit les
//    GLOBALS : ni l'un ni l'autre ne peut voir qu'un module écrit dans un store
//    que personne ne purge.
//
// 🛑 CE QU'IL NE FAIT **PAS**, ET IL FAUT LE SAVOIR POUR NE PAS S'Y FIER.
//    Il prouve qu'un store est CONNU du reset. Il ne prouve PAS qu'un lecteur
//    TOLÈRE la purge — c'est-à-dire exactement la régression du 07/08/2026
//    (`canari-check` s'est mis à dépendre d'un compteur purgé en PreCompact,
//    d'où une fenêtre d'aveuglement après chaque compaction). Cette part-là est
//    SÉMANTIQUE, donc indécidable : « ce composant a-t-il besoin de continuité ? »
//    ne se lit pas dans le code. Elle reste couverte par un TEST DE CAS
//    (« APRÈS COMPACTION » dans `canari-check.test.js`), pas par un gate.
//    ⇒ Ne JAMAIS présenter ce fichier comme fermant la classe entière. Un gate
//    vendu au-delà de ce qu'il prouve est pire qu'un gate absent : on cesse de
//    chercher.
//
// ⚠️ DÉRIVÉ DES DEUX CÔTÉS, jamais une liste recopiée : les préfixes purgés
//    sont lus DANS `ctxroute-reset.js`, les préfixes utilisés DANS les sources.
//    Une liste en dur ici aurait le défaut même qu'on corrige.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const RESET = 'ctxroute-reset.js';

function fichiersSource() {
  const out = [];
  for (const d of ['.', 'sources']) {
    const abs = path.join(repo, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith('.js') || f.includes('.test.')) continue;
      out.push(path.join(d === '.' ? '' : d, f).replace(/\\/g, '/'));
    }
  }
  return out;
}

/**
 * Préfixes que le reset BALAIE, lus dans sa boucle de purge.
 * ⚠️ On lit la BOUCLE (`for (const prefix of [...])`), pas le fichier entier :
 *    ses commentaires citent les préfixes eux aussi, et les compter rendrait le
 *    gate VERT même si la boucle réelle en oubliait un — un gate qui se
 *    contente d'une mention est un gate qui certifie de la prose.
 */
function prefixesPurges(source) {
  const bloc = /for\s*\(\s*const\s+prefix\s+of\s*\[([^\]]*)\]/.exec(source);
  if (!bloc) return null;                       // boucle introuvable ⇒ gate cassé
  return new Set([...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
}

/**
 * Préfixes DÉCLARÉS par un module comme clé de store.
 *
 * ⚠️ DEUX CONDITIONS, ET LA SECONDE A ÉTÉ PAYÉE AU PREMIER RUN : le fichier doit
 *    déclarer un `…PREFIX = '…'` **ET** utiliser `session-store`. Sans la
 *    seconde, le gate accusait `sources/skill.js`, qui déclare
 *    `PREFIX = 'skill/'` — un préfixe d'IDENTIFIANT DE DOC, pas un store.
 *    Ce module est PUR : il ne touche aucun état, il n'a rien à faire purger.
 * 🛑 LA LEÇON, PLUS UTILE QUE LE FIX : mon commentaire affirmait que le motif
 *    visait « la déclaration d'un store », alors que le code capturait TOUTE
 *    constante nommée PREFIX. Un gate se juge sur ce qu'il matche RÉELLEMENT,
 *    jamais sur ce que son commentaire prétend. Le faux positif est apparu au
 *    premier run parce que le gate a été lancé sur le repo réel avant d'être
 *    déclaré fini — c'est la seule façon de les voir.
 * ⚠️ Ne PAS « corriger » ça en exigeant que le préfixe finisse par `-` : ça
 *    marcherait par ACCIDENT (`skill/` ne finit pas par `-`) et non par
 *    sémantique. Le jour où un vrai store s'appellerait `cache/`, le gate
 *    redeviendrait aveugle sans que personne le sache.
 */
function prefixesDeclares(source) {
  if (!/require\(\s*['"]\.\/session-store['"]\s*\)/.test(source)) return [];
  return [...source.matchAll(/(?:STORE_)?PREFIX\s*=\s*'([^']+)'/g)].map((m) => m[1]);
}

const lireReel = (rel) => fs.readFileSync(path.join(repo, rel), 'utf8');

test('GATE : tout store déclaré dans le repo est PURGÉ par le reset', () => {
  const purges = prefixesPurges(lireReel(RESET));
  assert.ok(purges, `la boucle de purge est introuvable dans ${RESET} : c'est le GATE qui est cassé, pas le repo.`);

  // Filet d'existence : un scan qui ne trouve plus rien serait VERT en
  // n'analysant RIEN — le mode de panne le plus traître d'un gate dérivé.
  assert.ok(purges.size >= 3, `seulement ${purges.size} préfixe(s) purgé(s) trouvé(s) : motif de lecture cassé.`);

  const orphelins = [];
  for (const f of fichiersSource()) {
    for (const p of prefixesDeclares(lireReel(f))) {
      if (!purges.has(p)) orphelins.push(`${f} déclare le store '${p}'`);
    }
  }
  assert.deepStrictEqual(
    orphelins, [],
    'STORE NON PURGÉ — il survivrait à la compaction, et RIEN ne le dirait :\n  '
    + orphelins.join('\n  ')
    + `\n⇒ ajoute le préfixe à la boucle de ${RESET}. Un état qui traverse une `
    + 'compaction fait réinjecter (ou taire) des docs sur la foi d\'un contexte qui n\'existe plus.',
  );
});

test('GATE : aucune purge MORTE (un préfixe balayé que plus personne n\'écrit)', () => {
  // ⚠️ VOLET INVERSE, même doctrine que les exemptions périmées ailleurs : une
  //    purge dont le store a disparu est un vestige qui fait CROIRE à une
  //    couverture. Elle doit être retirée, ou le store réintroduit.
  // ⚠️ TOLÉRANCE ASSUMÉE : `ctxroute-seen-` appartient à `legacy-mcp-inject.js`,
  //    relique conservée comme oracle du différentiel — elle déclare bien son
  //    préfixe, donc elle passe. Si la relique disparaissait un jour, ce volet
  //    rougirait et rappellerait de nettoyer la boucle : c'est voulu.
  const purges = prefixesPurges(lireReel(RESET));
  const declares = new Set(fichiersSource().flatMap((f) => prefixesDeclares(lireReel(f))));
  const morts = [...purges].filter((p) => !declares.has(p));
  assert.deepStrictEqual(
    morts, [],
    'PURGE MORTE — la boucle balaie un store que plus aucun module n\'écrit :\n  '
    + morts.join(', ')
    + '\n⇒ retire-le de la boucle, ou explique par écrit pourquoi il doit survivre.',
  );
});

test('NEGATIVE-CHECK : le gate ROUGIT sur un store non purgé (sabotage EN MÉMOIRE)', () => {
  // ⚠️ SABOTAGE EN MÉMOIRE, JAMAIS SUR UN FICHIER RÉEL : la 1re version d'un
  //    negative-check de ce repo modifiait un fichier en place et a fait tomber
  //    38 tests d'autres suites qui le lisaient EN PARALLÈLE.
  // ⚠️ SANS CE VOLET, le gate ci-dessus est VERT aujourd'hui (mesuré : 5 purgés
  //    couvrent 6 usages) et personne ne saurait jamais s'il PEUT rougir. Un
  //    gate jamais vu rouge est un gate qu'on CROIT posé.
  const purges = prefixesPurges(lireReel(RESET));
  // ⚠️ Le sabotage DOIT inclure le `require('./session-store')` : c'est la
  //    condition même du motif. Sans lui, ce negative-check passerait pour une
  //    mauvaise raison (zéro préfixe trouvé) et serait INERTE — le piège qu'il
  //    existe pour éviter.
  const sabote = "const store = require('./session-store');\nconst STORE_PREFIX = 'canari-brouillon-';";
  const orphelins = prefixesDeclares(sabote).filter((p) => !purges.has(p));
  assert.deepStrictEqual(
    orphelins, ['canari-brouillon-'],
    'le gate NE VOIT PAS un store non purgé : il certifie au lieu de protéger.',
  );

  // …et il ne crie PAS sur un store légitime (sinon il serait bruyant, donc mort).
  assert.deepStrictEqual(
    prefixesDeclares("const store = require('./session-store');\nconst STORE_PREFIX = 'doc-seen-';")
      .filter((p) => !purges.has(p)),
    [],
    'le gate accuse un store pourtant purgé : faux positif, il finira débranché.',
  );

  // …et il IGNORE un préfixe qui n'est PAS un store (le faux positif RÉEL du
  // premier run : `sources/skill.js`, module PUR, préfixe d'identifiant de doc).
  assert.deepStrictEqual(
    prefixesDeclares("const PREFIX = 'skill/';"), [],
    'le gate prend un préfixe d\'IDENTIFIANT pour un store : il crierait sur du code pur.',
  );
});
