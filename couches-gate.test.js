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
import os from 'node:os';
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

// ⚠️ LE BINAIRE EN DIRECT, JAMAIS `npx` NI UN SHELL (corrigé le 06/08/2026,
//    CI ROUGE au premier push). Avec `shell: true`, la commande est passée à
//    l'interpréteur du système : sous `cmd` (Windows) ça marche, sous `/bin/sh`
//    (Linux, donc la CI) les PARENTHÈSES de `process.exit($$$)` sont une erreur
//    de syntaxe — `/bin/sh: Syntax error: "(" unexpected`. Le scan rendait donc
//    ZÉRO résultat et le gate serait passé VERT EN ÉTANT AVEUGLE.
// ⚠️ C'EST LE VOLET « EXISTENCE » QUI A ATTRAPÉ ÇA, pas un humain : il a refusé
//    d'être vert avec un scan vide. Ne JAMAIS le retirer comme un doublon.
// ⚠️ LEÇON PLUS LARGE : une mesure faite sur UNE machine ne prouve rien. Le
//    local lit la config réelle du poste, la CI un clone vierge sur un autre OS.
function binaireAstGrep() {
  const nom = process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep';
  const bin = path.join(repo, 'node_modules', '@ast-grep', 'cli', nom);
  // ⚠️ PANNE BRUYANTE, jamais un scan vide : un gate qui ne trouve rien parce
  //    que son OUTIL manque passerait au vert en étant aveugle. C'est la même
  //    classe que les `*-must-stay-pure` inertes — le pire des deux mondes.
  if (!fs.existsSync(bin)) {
    throw new Error('ast-grep INTROUVABLE (' + bin + ') — le gate des couches ne peut pas juger. `npm ci`.');
  }
  return bin;
}

// ⚠️ DEUX FORMES, ET LE CHOIX N'EST PAS COSMÉTIQUE (mesuré le 06/08/2026) :
//    · `pattern` — suffit pour une expression (`process.exit($$$)`).
//    · `regle` — OBLIGATOIRE dès qu'on vise une PROPRIÉTÉ d'objet. Le motif
//      `{ shell: true }` ne trouve QUE l'objet à une seule propriété : le cas
//      réel `{ encoding: 'utf8', shell: true, maxBuffer: N }` lui échappe, et
//      `$$$` ne le rattrape pas. Une règle `kind: pair` attrape les 3 formes.
//    🛑 Un motif là où il faut une règle = une règle INERTE, verte en étant
//       aveugle. C'est précisément ce que ce gate existe pour rendre impossible
//       — d'où la VÉRIFICATION par sabotage plus bas, sur chaque capacité.
function argumentsScan(def, cible) {
  const base = def.pattern
    ? ['run', '--pattern', def.pattern, '--lang', 'js', '--json=compact']
    : ['scan', '--inline-rules',
        ['id: couche-capacite', 'language: JavaScript', 'severity: error', 'rule:']
          .concat(def.regle.map((l) => '  ' + l)).join('\n'),
        '--json=compact'];
  return cible ? base.concat([cible]) : base;
}

/**
 * @param {object} def  capacité (pattern OU regle)
 * @param {string} [cible]  chemin ABSOLU à scanner ; absent ⇒ tout le dépôt.
 *
 * ⚠️ `ast-grep` RESPECTE `.gitignore` (mesuré le 06/08/2026, 3e aveuglement de
 *    la journée). Les témoins écrits dans `state/` — ignoré — étaient donc
 *    INVISIBLES, et le test anti-inerte accusait à tort les 5 capacités. Ils
 *    vivent maintenant dans le tmpdir de l'OS, hors de toute portée de
 *    `.gitignore`. 🛑 Conséquence à retenir : si quelqu'un gitignore un jour un
 *    dossier de SOURCES, ce gate deviendrait aveugle dessus SANS RIEN DIRE.
 *    C'est le volet « existence » qui l'attraperait — ne jamais le retirer.
 */
function occurrences(def, cible) {
  let out = '';
  try {
    out = execFileSync(binaireAstGrep(), argumentsScan(def, cible), {
      cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    out = (e && e.stdout) || '';
  }
  let r = [];
  try { r = JSON.parse(out || '[]'); } catch { r = []; }
  const rels = [];
  for (const m of r) {
    let rel = String(m.file).split(SEP).join('/');
    // Cible explicite (témoin hors dépôt) : on rend le chemin tel quel.
    if (cible) { rels.push(rel); continue; }
    if (rel.startsWith(repo.split(SEP).join('/'))) rel = rel.slice(repo.length + 1);
    if (pertinent(rel)) rels.push(rel);
  }
  return [...new Set(rels)];
}

test('GATE : aucune couche n exerce une capacité qu elle n a pas', () => {
  const purs = noyauPur();
  const fautes = [];
  for (const [cap, def] of Object.entries(manifeste.capacites)) {
    for (const rel of occurrences(def)) {
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

// ═══════════════════════════════════════════════════════════════════════
// ⚠️ LA GARANTIE QUI TIENT TOUT LE RESTE : AUCUNE RÈGLE NE PEUT ÊTRE INERTE
// ═══════════════════════════════════════════════════════════════════════
// Le défaut le plus DANGEREUX de ce dépôt n'est pas un gate rouge, c'est un
// gate VERT QUI NE VOIT RIEN. Il est arrivé deux fois le 06/08/2026 :
//   ① `shell: true` faisait rendre un scan VIDE sous `/bin/sh` (CI rouge) ;
//   ② le motif `{ shell: true }` ne trouvait PAS `{ encoding, shell: true, … }`,
//      c'est-à-dire la forme EXACTE qui venait de causer ①.
// Dans les deux cas, la règle « existait » et ne protégeait RIEN.
// ⇒ CHAQUE capacité porte un TÉMOIN : une ligne de code réelle qu'elle DOIT
//   détecter. On l'écrit sur disque, on scanne, on exige la détection.
// ⚠️ DÉRIVÉ du manifeste : une capacité AJOUTÉE demain est couverte le jour où
//   elle est écrite, sans que personne pense à rien. C'est la seule forme qui
//   tienne dans un dépôt écrit par des agents et relu par personne.
// ⚠️ Le témoin DOIT être la forme RÉELLE rencontrée, jamais un cas d'école
//   simplifié — sinon il prouve la détection d'un cas qui n'arrive pas.
test('ANTI-INERTE : chaque capacité DÉTECTE réellement son témoin', () => {
  // ⚠️ HORS DU DÉPÔT, et ce n'est pas un détail : `ast-grep` respecte
  //    `.gitignore`. Écrits dans `state/` (ignoré), les témoins étaient
  //    INVISIBLES et ce test accusait les 5 capacités d'être inertes alors
  //    qu'elles fonctionnaient. Le tmpdir de l'OS échappe à toute règle
  //    d'ignore — et ne pollue pas l'arbre de travail.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-temoins-'));
  const aveugles = [];
  const sansTemoin = [];
  try {
    for (const [cap, def] of Object.entries(manifeste.capacites)) {
      if (typeof def.temoin !== 'string' || def.temoin === '') { sansTemoin.push(cap); continue; }
      const tmp = path.join(dir, 'temoin-' + cap + '.js');
      fs.writeFileSync(tmp, def.temoin + '\n');
      const vu = occurrences(def, tmp).length > 0;
      if (!vu) aveugles.push(cap + ' — témoin NON détecté : ' + def.temoin);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.deepStrictEqual(sansTemoin, [], 'Capacité(s) SANS témoin — impossible de prouver qu elles voient quoi que ce soit : ' + sansTemoin.join(', '));
  assert.deepStrictEqual(
    aveugles, [],
    'RÈGLE(S) INERTE(S) — elles passent au vert en ne voyant RIEN :\n  ' + aveugles.join('\n  ')
      + '\n⇒ un `pattern` ne suffit pas pour une PROPRIÉTÉ d objet : passer à `regle` (kind: pair).'
  );
});

test('GATE (existence) : le scan voit bien du code', () => {
  // ⚠️ Un gate qui n'analyse RIEN passe au vert : c'est le pire des deux mondes.
  //    Vécu avec les règles `*-must-stay-pure`, inertes pendant des mois.
  //    `process.exit` existe forcément — toutes les coquilles en ont une.
  assert.ok(occurrences({ pattern: 'process.exit($$$)' }).length >= 5,
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
    if (!occurrences(def).includes(rel)) mortes.push(cle + ' (le fichier ne fait plus ça)');
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
    const trouves = occurrences({ pattern: 'process.exit($$$)' });
    assert.ok(!trouves.some((f) => f.endsWith('.tmp-couches-negatif.js')),
      'ast-grep a compté une MENTION comme un appel — le gate produirait des faux positifs.');
  } finally {
    fs.unlinkSync(tmp);
  }
});
