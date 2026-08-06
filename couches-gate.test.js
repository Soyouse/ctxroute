// ═══════════════════════════════════════════════════════════════════════
// GATE — LE TABLEAU CAPACITÉS × COUCHES (06/08/2026)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI CE FICHIER EXISTE. Trois défauts d'architecture en trois jours —
//    transport orchestré dans un seul émetteur, `process.exit` dans deux coeurs
//    partagés, `console.log` dans guard-core. Deux ont été trouvés par une
//    revue humaine, c'est-à-dire par CHANCE. Or ce dépôt est écrit par des
//    agents et relu par personne : un garde-fou qui dépend d'un regard n'existe
//    pas.
//
// ⚠️ LE RENVERSEMENT. On n'écrit plus un gate PAR FAUTE DÉCOUVERTE (réactif,
//    donc sans fin) : on déclare ce que chaque couche a le DROIT de faire. Les
//    trois défauts ci-dessus sont trois CASES de ce tableau — ils n'auraient pas
//    été « attrapés », ils auraient été IMPOSSIBLES. Et ce qu'un programme peut
//    faire est une liste FINIE (tuer le processus, écrire la sortie, lire
//    l'environnement, lire les arguments…) : le tableau se remplit une fois,
//    il ne se découvre pas au fil des bugs. Même raisonnement que la base
//    booléenne OU/ET/NON du matching : une base fermée, pas une liste ouverte.
//
// ⚠️ AST, JAMAIS REGEX — règle du parc, et elle est justifiée ici : un
//    `process.exit` CITÉ dans un commentaire ou une chaîne est un faux positif.
//    Le parsing vient d'`ast-grep` (`files`/`ignores`/`severity` confirmés sur
//    la doc officielle le 06/08/2026 — ⚠️ `ast-grep.github.io` REDIRIGE en 301
//    vers `astgrep.com`, l'ancienne URL traîne dans tous les tutos).
//    Le premier jet de ce gate était en regex avec dé-commentarisation maison :
//    exactement ce que la doctrine interdit.
//
// ⚠️ LES IMPORTS NE SONT PAS ICI. `fs`, `path`, `child_process`, les modules de
//    harnais = graphe de dépendances = `dependency-cruiser`, DÉJÀ en place. Les
//    dupliquer ici ferait deux outils pour un même invariant, donc une
//    divergence garantie. Ce gate ne couvre QUE ce qu'un graphe ne voit pas.
//    (Vérifié le 06/08/2026 : eslint-plugin-boundaries et Sheriff font eux
//    aussi des frontières de MODULES — donc rien de plus que dependency-cruiser
//    ici, au prix d'une dépendance neuve. Écartés.)
//
// ⚠️ CE QUE CE GATE NE PRÉTEND PAS FAIRE : trouver un bug de logique, un
//    invariant faux ou un mauvais choix produit. C'est le travail des tests et
//    de la mutation. Il ferme UNE classe — celle qui échappe à tout le reste.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const SEP = String.fromCharCode(92);
const manifeste = JSON.parse(fs.readFileSync(path.join(repo, 'couches.json'), 'utf8'));

// ⚠️ LE NOYAU PUR EST DÉRIVÉ DE `stryker.conf.json`, PAS RECOPIÉ. Ce fichier
//    déclare déjà « TOUS les modules PURS » et c'est lui qui fait autorité :
//    une 2e liste divergerait, et c'est précisément le couplage implicite que
//    tout ce dépôt combat. Ajouter un module pur à Stryker le protège ici
//    d'office — aucun geste à ne pas oublier.
function noyauPur() {
  const conf = JSON.parse(fs.readFileSync(path.join(repo, 'stryker.conf.json'), 'utf8'));
  return new Set(conf.mutate);
}

// Couche d'un fichier. ⚠️ ORDRE SIGNIFIANT : du plus contraint au plus permis.
// Un fichier n'appartient jamais à deux couches — la première qui matche gagne.
function coucheDe(rel, purs) {
  if (purs.has(rel)) return 'noyau-pur';
  if (/-core\.js$/.test(rel)) return 'coeur-partage';
  return 'coquille';
}

function autorisees(couche) {
  const c = manifeste.couches.find((x) => x.nom === couche);
  return new Set(c ? c.autorise : []);
}

// Fichiers scannés : sources du dépôt uniquement. Les TESTS sont hors tableau
// (ils orchestrent des spawns, écrivent, sortent — c'est leur métier).
function pertinent(rel) {
  return rel.endsWith('.js')
    && !rel.includes('node_modules')
    && !rel.includes('.test.')
    && !rel.startsWith('reports/')
    && !rel.startsWith('coverage/');
}

// ⚠️ ast-grep PARSE, nous DÉCIDONS. On ne lui délègue pas la notion de couche :
//    elle vit ici, en un seul endroit, lisible et testable.
function occurrences(pattern) {
  let out = '';
  try {
    out = execFileSync(
      'npx',
      ['ast-grep', 'run', '--pattern', pattern, '--lang', 'js', '--json=compact'],
      { cwd: repo, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (e) {
    out = (e && e.stdout) || '';
  }
  let r = [];
  try { r = JSON.parse(out || '[]'); } catch { r = []; }
  const rels = [];
  for (const m of r) {
    let rel = String(m.file).split(SEP).join('/');
    if (rel.startsWith(repo.split(SEP).join('/'))) rel = rel.slice(repo.length + 1);
    if (pertinent(rel)) rels.push(rel);
  }
  return [...new Set(rels)];
}

test('GATE : aucune couche n exerce une capacité qu elle n a pas', () => {
  const purs = noyauPur();
  const fautes = [];
  for (const [cap, def] of Object.entries(manifeste.capacites)) {
    for (const rel of occurrences(def.pattern)) {
      const couche = coucheDe(rel, purs);
      if (autorisees(couche).has(cap)) continue;
      if (manifeste.justifications[rel + '/' + cap]) continue;
      fautes.push(`${rel} [${couche}] ne peut pas « ${def.libelle} » (${cap}) — ${def.pourquoi}`);
    }
  }
  assert.deepStrictEqual(
    fautes.sort(), [],
    'VIOLATION(S) DU TABLEAU DES COUCHES :\n  ' + fautes.sort().join('\n  ')
      + '\n\n🛑 Élargir `couches.json` est PRESQUE TOUJOURS la mauvaise réponse.'
      + '\n   Le fichier est dans la mauvaise couche, ou il fait un travail qui ne'
      + '\n   lui appartient pas. Corrige le FICHIER, pas le tableau.'
  );
});

test('GATE (existence) : le scan voit bien du code', () => {
  // ⚠️ Un gate qui n'analyse RIEN passe au vert : c'est le pire des deux mondes.
  //    Vécu avec les règles `*-must-stay-pure`, inertes pendant des mois.
  //    `process.exit` existe forcément — toutes les coquilles en ont une.
  assert.ok(occurrences('process.exit($$$)').length >= 5,
    'scan suspect : ast-grep ne trouve presque rien, le GATE est cassé (pas le dépôt)');
});

test('GATE (volet inverse) : une justification périmée rougit', () => {
  // Même doctrine que `ASYMETRIES_JUSTIFIEES` : une dérogation qui ne sert plus
  // doit MOURIR, sinon le tableau s'élargit pour toujours, en silence.
  const purs = noyauPur();
  const mortes = [];
  for (const cle of Object.keys(manifeste.justifications)) {
    const i = cle.lastIndexOf('/');
    const rel = cle.slice(0, i);
    const cap = cle.slice(i + 1);
    const def = manifeste.capacites[cap];
    if (!def) { mortes.push(cle + ' (capacité inconnue)'); continue; }
    if (autorisees(coucheDe(rel, purs)).has(cap)) { mortes.push(cle + ' (déjà autorisé par sa couche)'); continue; }
    if (!occurrences(def.pattern).includes(rel)) mortes.push(cle + ' (le fichier ne fait plus ça)');
  }
  assert.deepStrictEqual(mortes, [], 'Justification(s) PÉRIMÉE(S), à retirer :\n  ' + mortes.join('\n  '));
});

// ⚠️ NEGATIVE-CHECK OBLIGATOIRE — un gate non saboté est un gate présumé
//    INERTE (leçon des `*-must-stay-pure`, 03/08/2026). Sabotage EN MÉMOIRE :
//    on n'écrit JAMAIS dans un fichier réel, une 1re version l'avait fait et
//    38 tests d'autres suites étaient tombés.
test('NEGATIVE : une capacité exercée hors droit est DÉTECTÉE', () => {
  const purs = new Set(['gate.js']);
  assert.strictEqual(coucheDe('gate.js', purs), 'noyau-pur');
  assert.strictEqual(autorisees('noyau-pur').has('exit'), false,
    'SABOTAGE NON DÉTECTÉ : le noyau pur aurait le droit de tuer le processus.');

  assert.strictEqual(coucheDe('porte-core.js', purs), 'coeur-partage');
  assert.strictEqual(autorisees('coeur-partage').has('stdout'), false,
    'SABOTAGE NON DÉTECTÉ : un coeur partagé aurait le droit d écrire la sortie.');

  // La coquille, elle, DOIT pouvoir : sans ça le gate serait rouge partout et
  // finirait débranché — un gate qui crie sur du sain ne protège plus rien.
  assert.strictEqual(coucheDe('doc-inject.js', purs), 'coquille');
  assert.strictEqual(autorisees('coquille').has('exit'), true);
});

test('NEGATIVE : ast-grep ignore une MENTION en commentaire ou en chaîne', () => {
  // ⚠️ C'est LA raison de l'AST contre la regex. Le 1er jet de ce gate était en
  //    regex avec dé-commentarisation maison — fragile et interdit par le parc.
  const tmp = path.join(repo, 'state', '.tmp-couches-negatif.js');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, "// process.exit(0) en commentaire\nconst s = 'process.exit(0)';\nmodule.exports = s;\n");
  try {
    const trouves = occurrences('process.exit($$$)');
    assert.ok(!trouves.some((f) => f.endsWith('.tmp-couches-negatif.js')),
      'ast-grep a compté une MENTION comme un appel — le gate produirait des faux positifs.');
  } finally {
    fs.unlinkSync(tmp);
  }
});
