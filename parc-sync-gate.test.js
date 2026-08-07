// ═══════════════════════════════════════════════════════════════════════
// GATE PARC↔REPO — le repo est AUTO-SUFFISANT pour un fork (19/07/2026).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RAISON D'ÊTRE (décision mainteneur) : un fork/mainteneur externe doit
//    trouver DANS le repo la totale — skill du framework + docs injectables
//    DU framework. Or ces fichiers VIVENT câblés dans le parc du mainteneur
//    (~/.claude/commands/ctxroute.md + ~/.claude/hooks/docs/ctxroute/)
//    → deux copies. Ce gate rend la dérive IMPOSSIBLE : tout écart = ROUGE.
//
// ⚠️ SENS DE LA VÉRITÉ : le PARC est la copie CÂBLÉE (ce que les agents
//    reçoivent), docs/framework/ est le MIROIR VERSIONNÉ. Éditer le parc →
//    recopier ici (cp) dans le MÊME geste. Un fork sans parc édite le repo.
//
// ⚠️ SKIP PROPRE si le parc n'existe pas (CI, checkout frais, machine fork) :
//    l'égalité n'a de sens que là où les deux copies existent. Sur la machine
//    du mainteneur, ce gate tourne à CHAQUE npm test.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_DIR = path.join(import.meta.dirname, 'docs', 'framework');
const PARC_SKILL = path.join(os.homedir(), '.claude', 'commands', 'ctxroute.md');
const PARC_DOCS = path.join(os.homedir(), '.claude', 'hooks', 'docs', 'ctxroute');

const parcExists = fs.existsSync(PARC_DOCS) && fs.existsSync(PARC_SKILL);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('docs/framework/ existe et n\'est pas vide (la totale pour un fork)', () => {
  const files = fs.readdirSync(REPO_DIR).filter((f) => f.endsWith('.md'));
  assert.ok(files.includes('SKILL.md'), 'SKILL.md absent de docs/framework/ — un fork n\'a pas le skill.');
  assert.ok(files.length >= 20, `docs/framework/ ne contient que ${files.length} fichiers — docs injectables manquantes.`);
});

test.skipIf(!parcExists)('SKILL.md du repo == skill câblé du parc (dérive = ROUGE, recopier)', () => {
  assert.strictEqual(read(path.join(REPO_DIR, 'SKILL.md')), read(PARC_SKILL),
    'docs/framework/SKILL.md diverge de ~/.claude/commands/ctxroute.md — recopier le parc vers le repo (ou l\'inverse sur un fork).');
});

test.skipIf(!parcExists)('chaque doc injectable du parc a son miroir IDENTIQUE dans le repo (aucune oubliée)', () => {
  for (const f of fs.readdirSync(PARC_DOCS).filter((x) => x.endsWith('.md'))) {
    const mirror = path.join(REPO_DIR, f);
    assert.ok(fs.existsSync(mirror), `doc du parc SANS miroir repo : ${f} — un fork ne l'aura pas.`);
    assert.strictEqual(read(mirror), read(path.join(PARC_DOCS, f)),
      `dérive parc↔repo sur ${f} — recopier dans le même geste que l'édition.`);
  }
});

test.skipIf(!parcExists)('aucun fichier repo orphelin (doc supprimée du parc mais laissée dans le repo)', () => {
  const parcFiles = new Set(fs.readdirSync(PARC_DOCS).filter((x) => x.endsWith('.md')));
  for (const f of fs.readdirSync(REPO_DIR).filter((x) => x.endsWith('.md') && x !== 'SKILL.md')) {
    assert.ok(parcFiles.has(f), `fichier repo orphelin : docs/framework/${f} (absent du parc) — le supprimer ou re-câbler.`);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// VOLET ④ — LE CONTRAT CANARI ⟷ AFFICHEUR (07/08/2026)
// ═══════════════════════════════════════════════════════════════════════
//
// 🔴 IL S'EST DÉJÀ PAYÉ, ET CHER. `statusline.js` lisait
//    `Desktop/mcp-doc-hooks/state/canari.json` — le nom du repo AVANT son
//    renommage en `ctxroute` (04/08/2026). Dossier inexistant ⇒ le `catch`
//    fail-open de l'afficheur avalait tout ⇒ pendant TROIS JOURS le canari a
//    écrit son verdict POUR PERSONNE. Un dead-man switch dont l'afficheur est
//    mort ne signale rien tout en donnant l'impression d'une surveillance :
//    la pire forme de panne, puisqu'elle fabrique de la confiance.
//
// ⚠️ CE VOLET NE CRÉE AUCUNE DÉPENDANCE, et c'est la condition pour qu'il
//    existe. Le framework ne FOURNIT toujours aucun afficheur (c'est ce qui le
//    garde installable par n'importe qui) et l'alarme ne passe toujours pas
//    par le tuyau qu'elle teste. On vérifie seulement, QUAND un afficheur
//    existe sur la machine, que ce qu'il demande au repo existe encore.
//
// ⚠️ TROIS LIENS, CHACUN CASSE EN SILENCE : ① le CHEMIN du repo · ② l'EXPORT
//    appelé · ③ la CLÉ du verdict. Le renommage n'a cassé que ①, mais renommer
//    `etiquette` ou la clé `verdict` produirait exactement la même panne muette
//    — et ② comme ③ sont du couplage par le STOCKAGE/l'INTERFACE, invisible
//    aux imports (dependency-cruiser) comme aux globals (couches-gate).
//
// ⚠️ DEUX SKIPS, tous deux volontaires : pas de parc (clone vierge, fork) ET
//    aucun afficheur qui cite le canari — ne rien afficher est un choix
//    légitime. Le gate ne RÉCLAME pas un afficheur, il protège celui qui existe.

const PARC_HOOKS = path.join(os.homedir(), '.claude', 'hooks');
// 🛑 LE MOTIF NE FILTRE PAS SUR `ctxroute`, ET C'EST TOUT L'ENJEU. Ma 1re
//    version ne retenait que les chemins CITANT `ctxroute` — elle n'aurait donc
//    PAS vu le bug qui l'a motivée : le chemin périmé citait `mcp-doc-hooks`,
//    l'ANCIEN nom. Un gate qui rate précisément son cas fondateur est pire
//    qu'absent, il rassure. ⇒ TOUT chemin absolu d'un afficheur doit exister.
// ⚠️ MESURÉ AVANT D'ÉLARGIR (07/08/2026) : 5 chemins absolus dans les
//    afficheurs du parc, **0 mort** ⇒ zéro exemption à prévoir. Sans cette
//    mesure, la version large aurait pu être un générateur de faux rouges.
const CHEMIN_ABSOLU = /['"]([A-Za-z]:[\\/][^'"]+)['"]/g;

function afficheursDuCanari() {
  if (!fs.existsSync(PARC_HOOKS)) return [];
  return fs
    .readdirSync(PARC_HOOKS)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, src: read(path.join(PARC_HOOKS, f)) }))
    .filter((h) => /canari/i.test(h.src));
}

/** Les noms exportés par un module CommonJS (`module.exports = { a, b }`). */
function exportsDe(src) {
  const m = src.match(/module\.exports\s*=\s*\{([^}]*)\}/);
  if (m === null) return new Set();
  return new Set(m[1].split(',').map((s) => s.split(':')[0].trim()).filter(Boolean));
}

/** Les ruptures de contrat, DÉRIVÉES des deux côtés. `[]` = contrat tenu. */
function contratRompu(afficheurs, canariSrc, checkSrc) {
  const casses = [];
  for (const a of afficheurs) {
    // ① CHEMINS — la panne RÉELLE du 04→07/08.
    for (const m of a.src.matchAll(CHEMIN_ABSOLU)) {
      // ⚠️ `state/canari.json` n'existe qu'après un 1er verdict : le DOSSIER
      //    parent suffit — sinon ROUGE dès la première installation, un faux
      //    positif qui discréditerait le gate avant son premier service.
      if (!fs.existsSync(m[1]) && !fs.existsSync(path.dirname(m[1]))) {
        casses.push(`${a.name} : chemin mort → ${m[1]}`);
      }
    }
    // ② EXPORT — chaque nom destructuré depuis canari.js doit être exporté.
    // ⚠️ COMPARAISON D'ENSEMBLES, JAMAIS UNE REGEX CONSTRUITE : la 1re version
    //    interpolait le nom dans un template literal, où `\b` n'est PAS une
    //    frontière de mot mais le caractère BACKSPACE — le contrôle accusait
    //    donc `etiquette`, pourtant bel et bien exporté. Un faux positif qui
    //    aurait discrédité tout le gate.
    for (const m of a.src.matchAll(/const\s*\{([^}]*)\}\s*=\s*require\([^)]*canari\.js[^)]*\)/g)) {
      for (const nom of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!exportsDe(canariSrc).has(nom)) {
          casses.push(`${a.name} : canari.js n'exporte pas \`${nom}\``);
        }
      }
    }
  }
  // ③ CLÉ DU VERDICT — l'afficheur lit `.verdict`, la coquille l'écrit.
  if (afficheurs.some((a) => /\.verdict\b/.test(a.src)) && !/verdict:/.test(checkSrc)) {
    casses.push('canari-check.js n\'écrit plus la clé `verdict` que l\'afficheur lit');
  }
  return casses;
}

const CANARI_SRC = read(path.join(import.meta.dirname, 'canari.js'));
const CHECK_SRC = read(path.join(import.meta.dirname, 'canari-check.js'));

test.skipIf(!parcExists)('④ contrat canari ⟷ afficheur : chemins, export et clé du verdict tiennent', () => {
  const afficheurs = afficheursDuCanari();
  if (afficheurs.length === 0) return; // aucun afficheur = choix légitime
  const casses = contratRompu(afficheurs, CANARI_SRC, CHECK_SRC);
  assert.deepStrictEqual(casses, [],
    'Contrat canari ⟷ afficheur ROMPU — l\'alarme écrirait pour PERSONNE, en silence :\n  ' +
    casses.join('\n  '));
});

test('④ NEGATIVE : le volet rougit vraiment sur les 3 ruptures (sabotage EN MÉMOIRE)', () => {
  // ⚠️ EN MÉMOIRE, jamais un fichier réel : `statusline.js` est EN PRODUCTION,
  //    d'autres agents l'exécutent à chaque rendu.
  // ① LE CAS EXACT DU 04/08 : l'ANCIEN nom du repo, qui ne contient pas
  //    « ctxroute » — c'est précisément ce que la 1re version du motif ratait.
  const perime = [{ name: 'faux.js', src: "require('C:/Users/dev/Desktop/mcp-doc-hooks/canari.js')" }];
  assert.strictEqual(contratRompu(perime, CANARI_SRC, CHECK_SRC).length, 1,
    'le volet ne voit pas le chemin PÉRIMÉ du 04/08 : il rate son cas fondateur');

  // …et un chemin bien vivant ne déclenche rien (sinon 5 faux rouges au parc).
  // ⚠️ DÉRIVÉ À L'EXÉCUTION, jamais écrit en dur : ce dépôt est PUBLIC et le
  //    gate anti-fuite refuse tout chemin utilisateur réel — il a mordu ici
  //    même, sur la 1re version de cette fixture.
  const ici = import.meta.dirname.replace(/\\/g, '/');
  const vivant = [{ name: 'ok.js', src: `require('${ici}/canari.js')` }];
  assert.deepStrictEqual(contratRompu(vivant, CANARI_SRC, CHECK_SRC), [],
    'faux positif sur un chemin pourtant existant');

  // ② Un export qui n'existe pas.
  const exportFantome = [{ name: 'faux.js', src: "const { marqueurFantome } = require('./canari.js');" }];
  assert.match(contratRompu(exportFantome, CANARI_SRC, CHECK_SRC)[0] || '', /n'exporte pas/,
    'le volet ne voit pas un export disparu');

  // ③ La clé du verdict renommée côté coquille.
  const lecteur = [{ name: 'faux.js', src: 'const v = JSON.parse(x); v.verdict;' }];
  assert.strictEqual(contratRompu(lecteur, CANARI_SRC, 'fs.writeFileSync(t, JSON.stringify({ etat: v }))').length, 1,
    'le volet ne voit pas la clé `verdict` disparue de la coquille');

  // …et il se TAIT sur un afficheur sain (sinon il finirait débranché).
  const sain = [{ name: 'ok.js', src: "const { etiquette } = require('./canari.js');\nconst v = j.verdict;" }];
  assert.deepStrictEqual(contratRompu(sain, CANARI_SRC, CHECK_SRC), [],
    'faux positif sur un afficheur pourtant conforme');
});
