// ═══════════════════════════════════════════════════════════════════════
// GATE — TOUT ÉMETTEUR DE CONTEXTE TRAVERSE LA COUCHE D'ÉMISSION
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI CE GATE EXISTE (05/08/2026, REFACTOR-PLAN ⑯). Le transport
//    (budget · morcelage · sceau · file) vivait DANS `porte-core.js`, donc dans
//    l'orchestration d'UN SEUL émetteur. `session-inject.js` ne le traversait
//    pas et sortait d'un bloc — spill silencieux garanti dès que son corpus
//    grossirait. Ce n'était pas un oubli mais un DÉFAUT DE SQUELETTE : le
//    transport était un CHOIX D'APPELANT, donc de l'opt-in par recopie, donc un
//    trou qui se serait reproduit au 3ᵉ émetteur (PostCompact Codex,
//    SubagentStart, Stop… — 5 événements déjà listés).
//
// ⚠️ EXTRAIRE LA COUCHE NE SUFFIT PAS. Dans un framework web on ne PEUT pas
//    contourner le pipeline : on ne possède pas le transport. Ici on possède
//    tout ⇒ la couche resterait FACULTATIVE et on n'aurait fait que déplacer le
//    problème. Seule une MACHINE peut l'imposer. C'est ce fichier.
//
// ⚠️ DÉRIVÉ DU CODE, JAMAIS UNE LISTE ÉCRITE : le gate SCANNE les fichiers qui
//    écrivent la clé `additionalContext` et exige qu'ils atteignent
//    `emission-core`. Un émetteur FUTUR est donc couvert le jour où il est
//    écrit, sans que personne pense à l'inscrire quelque part. Une liste en dur
//    aurait exactement le défaut qu'on corrige : elle dépend de la vigilance.
//
// ⚠️ TRAVERSÉE TRANSITIVE, et c'est VOULU : les coquilles de harnais
//    (`doc-inject.js`, `codex-doc-inject.js`) ne connaissent que leur dialecte
//    de sortie et délèguent à `porte-core.js`. Exiger un import DIRECT les
//    forcerait à importer une couche qu'elles n'utilisent pas — soit
//    exactement le couplage que l'architecture en couches interdit.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const COUCHE = 'emission-core.js';

/**
 * EXEMPTIONS DÉCLARÉES — même doctrine que `ASYMETRIES_JUSTIFIEES`
 * (frontmatter.test.js) : une dérogation existe, elle porte son POURQUOI par
 * écrit, et le volet INVERSE la rend mortelle dès qu'elle devient périmée.
 *
 * ⚠️ NE PAS Y AJOUTER UN ÉMETTEUR VIVANT. Le seul motif recevable est un
 *    fichier qui n'émet PLUS (relique conservée comme oracle) : il doit rester
 *    figé à son comportement d'origine, sinon il cesse d'être un oracle.
 */
const EXEMPTIONS = {
  'legacy-mcp-inject.js':
    "RELIQUE DÉCÂBLÉE le 17/07/2026, conservée comme ORACLE du différentiel. "
    + "Elle DOIT rester figée au comportement d'avant la porte unique : lui "
    + "ajouter le transport détruirait la seule référence contre laquelle on "
    + "prouve la parité. Le doctor exige d'ailleurs son ABSENCE du câblage.",
};

// Fichiers source du repo (racine + sources/), hors tests et hors node_modules.
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

// ⚠️ LA CLÉ, PAS LA MENTION. `additionalContext:` en position de propriété =
//    une ÉMISSION. Les commentaires du repo écrivent `additionalContext` entre
//    accents graves — les compter ferait rougir des fichiers qui n'émettent
//    rien (doctor.js, gate.js…), et un gate qui crie sur du sain est un gate
//    qu'on finit par débrancher.
function emetteurs() {
  return fichiersSource().filter((f) =>
    /additionalContext\s*:/.test(fs.readFileSync(path.join(repo, f), 'utf8'))
  );
}

// Requires LOCAUX d'un fichier (`require('./x')`), résolus en chemin repo.
function requiresLocaux(rel, source) {
  const dir = path.dirname(rel);
  const out = [];
  for (const m of source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    let cible = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, m[1]));
    if (!cible.endsWith('.js')) cible += '.js';
    out.push(cible);
  }
  return out;
}

// Atteint-il la couche, directement ou à travers ses propres requires ?
function atteintLaCouche(rel, lire) {
  const vus = new Set();
  const pile = [rel];
  while (pile.length > 0) {
    const cur = pile.pop();
    if (vus.has(cur)) continue;
    vus.add(cur);
    if (cur === COUCHE) return true;
    const src = lire(cur);
    if (src === null) continue;
    for (const dep of requiresLocaux(cur, src)) pile.push(dep);
  }
  return false;
}

const lireReel = (rel) => {
  const abs = path.join(repo, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
};

test('GATE : tout fichier qui écrit `additionalContext` traverse emission-core', () => {
  const trouves = emetteurs();
  // Filet d'existence : si le scan ne trouve plus rien, c'est le GATE qui est
  // cassé (motif changé, fichiers déplacés), pas le repo qui est devenu pur.
  // Un gate qui passe au vert en ne regardant rien est le pire des deux mondes.
  assert.ok(trouves.length >= 3, `scan suspect : ${trouves.length} émetteur(s) trouvé(s)`);

  const fautifs = trouves.filter(
    (f) => !EXEMPTIONS[f] && !atteintLaCouche(f, lireReel)
  );
  assert.deepStrictEqual(
    fautifs,
    [],
    `Ces émetteurs composent leur sortie SANS traverser ${COUCHE} :\n  `
      + fautifs.join('\n  ')
      + `\n⇒ leur contenu part en spill silencieux dès qu'il dépasse la trame.`
  );
});

test('GATE (volet inverse) : une exemption périmée rougit', () => {
  const trouves = new Set(emetteurs());
  const perimees = Object.keys(EXEMPTIONS).filter((f) => !trouves.has(f));
  assert.deepStrictEqual(
    perimees,
    [],
    'Exemption(s) déclarée(s) pour un fichier qui n\'émet plus : la retirer.\n  '
      + perimees.join('\n  ')
  );
});

// ⚠️ NEGATIVE-CHECK OBLIGATOIRE — leçon des `*-must-stay-pure` (03/08/2026),
//    qui étaient documentés partout comme LA garantie et ne pouvaient pas
//    rougir. Un gate non saboté est un gate présumé inerte.
// ⚠️ LE SABOTAGE NE TOUCHE AUCUN FICHIER RÉEL : on substitue le LECTEUR, en
//    mémoire. La 1re version d'un negative-check du repo écrivait sur disque et
//    a fait tomber 38 tests d'autres suites qui importaient le fichier EN
//    PARALLÈLE.
test('NEGATIVE : un émetteur privé de la couche est DÉTECTÉ (gate non inerte)', () => {
  const cible = 'session-inject.js';
  assert.ok(emetteurs().includes(cible), 'la cible du sabotage doit être un émetteur réel');

  // Copie en mémoire, import de la couche RETIRÉ de toute la chaîne.
  const lireSabote = (rel) => {
    const src = lireReel(rel);
    if (src === null) return null;
    return src.replace(/require\(\s*['"]\.\/emission-core['"]\s*\)/g, 'null');
  };

  assert.ok(atteintLaCouche(cible, lireReel), 'témoin : intact, la cible atteint la couche');
  assert.strictEqual(
    atteintLaCouche(cible, lireSabote),
    false,
    'SABOTAGE NON DÉTECTÉ : le gate est INERTE — il passerait au vert sur un émetteur sans transport.'
  );
});
