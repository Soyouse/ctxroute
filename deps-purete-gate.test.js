// ═══════════════════════════════════════════════════════════════════════
// LE GATE QUI VÉRIFIE QUE LES GATES DE PURETÉ PEUVENT ROUGIR.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ BUG RÉEL, TROUVÉ LE 03/08/2026 : `lib-pure-must-stay-pure` — le plus
//    ancien gate d'architecture du repo, documenté partout comme LA garantie de
//    pureté — était INERTE. Un `require('fs')` ajouté en tête de `lib-pure.js`
//    passait VERT. Idem pour toutes les autres règles `*-must-stay-pure`.
//
// ⚠️ CAUSE RACINE (doc OFFICIELLE dependency-cruiser 18.1.0, options-reference :
//    « includeOnly … will discard all files not matching the pattern ») :
//    `includeOnly` filtre AUSSI LES DÉPENDANCES. Notre motif ne listait que des
//    fichiers `*.js` locaux ⇒ `fs`, `path`, `child_process` n'entraient JAMAIS
//    dans le graphe ⇒ aucune règle ne pouvait les voir. Le gate ne protégeait
//    rien, et l'affichait en vert. Mesure : 41 modules / 99 dépendances avant
//    correction, 47 / 143 après.
//
// ⚠️ CE FICHIER EXISTE POUR QUE ÇA NE REVIENNE PAS. Un gate qui ne peut pas
//    échouer CERTIFIE au lieu de protéger — et c'est pire que pas de gate, car
//    on cesse de regarder. NE JAMAIS le supprimer ni l'assouplir.
// ═══════════════════════════════════════════════════════════════════════
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(ICI, '.dependency-cruiser.json');

const lireConfig = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

// Extrait les modules cœur interdits par les règles, DEPUIS LES RÈGLES.
// ⚠️ Jamais une liste recopiée : ce serait la même classe de bug (une vérité en
//    double qui diverge). Ajouter une règle qui interdit `os` doit SUFFIRE à
//    faire exiger `os` dans includeOnly.
function coeursInterdits(config) {
  const trouves = new Set();
  for (const r of config.forbidden) {
    const to = (r.to && r.to.path) || '';
    if (!(r.to && Array.isArray(r.to.dependencyTypes) && r.to.dependencyTypes.includes('core'))) continue;
    for (const m of to.matchAll(/[a-z_]+/g)) trouves.add(m[0]);
  }
  return [...trouves];
}

test('DÉRIVÉ : tout module cœur interdit par une règle ENTRE dans le graphe', () => {
  // ⚠️ C'est LA condition pour qu'une règle de pureté puisse se déclencher.
  //    Sans elle, la règle existe, se lit bien, et ne sert à RIEN.
  const config = lireConfig();
  const coeurs = coeursInterdits(config);
  assert.ok(coeurs.length > 0, 'prémisse : au moins une règle interdit un module cœur');
  for (const c of coeurs) {
    assert.ok(
      new RegExp(config.options.includeOnly).test(c),
      `« ${c} » est interdit par une règle mais EXCLU du graphe par includeOnly ⇒ la règle est INERTE. `
      + 'Ajoute-le à includeOnly (doc dependency-cruiser : includeOnly filtre aussi les dépendances).',
    );
  }
});

test('SABOTAGE RÉEL : chaque module « pur » fait ROUGIR son gate quand on l\'impurifie', () => {
  // ⚠️ Le test statique ci-dessus prouve la CONDITION ; celui-ci prouve l'EFFET.
  //    Les deux sont nécessaires : c'est en croyant la condition suffisante
  //    qu'on a laissé un gate inerte pendant des semaines.
  const config = lireConfig();
  const cibles = config.forbidden
    .filter((r) => r.name.endsWith('-must-stay-pure'))
    .map((r) => (r.from.path || '').replace(/[\^$]/g, '').replace(/\\\./g, '.'))
    .filter((f) => f.endsWith('.js') && fs.existsSync(path.join(ICI, f)));

  assert.ok(cibles.length >= 2, 'prémisse : plusieurs modules sont déclarés purs');

  for (const cible of cibles) {
    // ⚠️ SABOTAGE SUR COPIE, JAMAIS SUR LE FICHIER RÉEL — motif imposé par le
    //    repo (cf doctor.test.js). Erreur commise en écrivant ce test : saboter
    //    `lib-pure.js` en place a fait tomber **38 tests** d'autres suites qui
    //    l'importaient EN PARALLÈLE. Un test qui casse ses voisins est un test
    //    qu'on finit par désactiver. Les modules visés sont PURS (zéro import
    //    local, c'est justement ce qu'on vérifie) : copier le seul fichier suffit.
    const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'purete-'));
    fs.writeFileSync(
      path.join(bac, cible),
      "const fs = require('fs');\n" + fs.readFileSync(path.join(ICI, cible), 'utf8'),
    );
    // ⚠️ BINAIRE LOCAL, JAMAIS `npx` : lancé depuis un dossier temporaire, `npx`
    //    ne trouve pas le `node_modules` du repo et VA CHERCHER LE PAQUET SUR LE
    //    RÉSEAU — il a ramené un placeholder anti-dependency-confusion (mesuré
    //    03/08/2026). Un test qui dépend du réseau est un test qui ment un jour
    //    de coupure, et un vecteur d'exécution de code non voulu.
    const BIN = path.join(ICI, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruise.mjs');
    let sortie = '';
    try {
      execFileSync(process.execPath, [BIN, '--config', CONFIG, '.'], { cwd: bac, encoding: 'utf8' });
    } catch (e) {
      sortie = String(e.stdout || '') + String(e.stderr || '');
    }
    assert.match(
      sortie, new RegExp(cible.replace('.', '\\.') + '.*fs|must-stay-pure'),
      `${cible} a été impurifié et AUCUN gate n'a rougi — la règle qui le protège est INERTE.`,
    );
  }
}, 120000);
