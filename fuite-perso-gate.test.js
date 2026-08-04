// ⚠️ CE QUE CE GATE PROTÈGE : ce dépôt est PUBLIC. Une donnée personnelle
//    poussée NE SE RETIRE PLUS — elle survit dans `git log -p`, même après
//    correction de l'arbre. Constaté le 04/08/2026 : 5 fuites fraîches dans
//    des fichiers trackés (corrigées à la main, SANS filet), et la config
//    utilisateur devenue trackée parce qu'un codemod avait raté `.gitignore`.
//    ⇒ Le filet, c'est ce fichier. Une classe d'erreur non scellée REVIENT.
//
// ⚠️ AUCUNE DONNÉE PERSONNELLE ICI, PAR CONSTRUCTION. Un gate qui listerait
//    en dur le prénom ou les clients à protéger SERAIT LUI-MÊME LA FUITE.
//    Tout vient de l'EXTÉRIEUR : l'environnement, et un fichier privé hors
//    du dépôt. NE JAMAIS écrire ici une chaîne à protéger.
//
// ⚠️ DOIT RESTER VERT SUR UN CLONE VIERGE (règle `gitignore.md`) : sans
//    fichier privé, le gate tourne en mode GÉNÉRIQUE — il protège moins,
//    mais il ne ment pas et ne casse la CI de personne.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { motifsInterdits, scanner, echapper, dernierSegment } from './fuite-pure.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));

// ⚠️ HORS DU DÉPÔT, par nécessité : les termes privés (prénom, comptes) ne
//    peuvent pas voyager dans un artefact public. Ils vivent avec la config
//    personnelle de l'utilisateur, donc ils suivent la machine, pas le repo.
//    `CTXROUTE_FUITE_LISTE` = échappatoire pour les tests et les CI privées.
function cheminListePrivee() {
  return process.env.CTXROUTE_FUITE_LISTE || path.join(os.homedir(), '.claude', 'secrets', 'ctxroute-fuite.json');
}

/**
 * Termes privés = ceux DÉCLARÉS + ceux DÉRIVÉS de dossiers réels.
 * ⚠️ La dérivation est le point important : une liste de clients tenue à la
 *    main serait PÉRIMÉE au client suivant, et le gate protégerait moins
 *    SANS RIEN DIRE. On lit donc les dossiers qui font autorité — un dossier
 *    client est celui qui contient son marqueur (`brief.md`), ce qui écarte
 *    au passage `.git`, `node_modules` et l'outillage.
 */
function termesPrives() {
  let decl;
  try {
    decl = JSON.parse(fs.readFileSync(cheminListePrivee(), 'utf8'));
  } catch {
    return []; // clone vierge / autre machine : mode générique, jamais rouge
  }
  const termes = Array.isArray(decl.termes) ? [...decl.termes] : [];
  for (const src of Array.isArray(decl.dossiersDerives) ? decl.dossiersDerives : []) {
    try {
      for (const e of fs.readdirSync(src.racine, { withFileTypes: true })) {
        if (e.isDirectory() && fs.existsSync(path.join(src.racine, e.name, src.marqueur))) {
          termes.push(e.name);
        }
      }
    } catch { /* source absente sur cette machine : on n'invente rien */ }
  }
  return termes;
}

function motifs() {
  return motifsInterdits(os.userInfo().username, os.homedir(), termesPrives());
}

function fichiersTrackes(cwd) {
  return execFileSync('git', ['ls-files'], { cwd, encoding: 'utf8' }).split('\n').filter(Boolean);
}

function scannerDepot(racine, m) {
  const violations = [];
  for (const rel of fichiersTrackes(racine)) {
    let texte;
    try {
      texte = fs.readFileSync(path.join(racine, rel), 'utf8');
    } catch {
      continue; // binaire ou illisible : hors périmètre
    }
    for (const v of scanner(texte, m)) violations.push(`${rel} → ${v.nom} (${v.extrait})`);
  }
  return violations;
}

// ⚠️ ON N'ÉCRIT JAMAIS UNE IP DU BLOC CGNAT EN CLAIR ICI : ce fichier est
//    TRACKÉ, et le gate de ce même fichier l'interdit — à raison (il a
//    attrapé une IP de production RÉELLE écrite ici le 04/08/2026). On
//    l'assemble donc à l'exécution : le littéral n'existe dans aucun fichier.
const ip = (...o) => o.join('.');

// ── LE GATE ─────────────────────────────────────────────────────────────
test('AUCUN fichier TRACKÉ ne porte de donnée personnelle', () => {
  const violations = scannerDepot(ICI, motifs());
  assert.deepEqual(
    violations,
    [],
    'DÉPÔT PUBLIC — retirer ces données AVANT de committer :\n' + violations.join('\n')
  );
});

test('le gate ne regarde que le TRACKÉ', () => {
  // ⚠️ `state/`, `docs/mcp/`, `ctxroute-config.json` sont gitignorés PAR
  //    DESIGN et contiennent légitimement du personnel. Les scanner rendrait
  //    le gate rouge en permanence — donc illisible, donc mort.
  const trackes = fichiersTrackes(ICI);
  assert.ok(trackes.length > 50, 'git ls-files doit répondre');
  assert.ok(!trackes.includes('ctxroute-config.json'), 'la config utilisateur reste gitignorée');
});

// ── NEGATIVE-CHECK ──────────────────────────────────────────────────────
test('NEGATIVE-CHECK : le gate SAIT rougir (sabotage sur une COPIE)', () => {
  // ⚠️ SABOTAGE SUR COPIE, JAMAIS EN PLACE : le 03/08/2026, un sabotage sur
  //    un fichier réel a fait tomber 38 tests d'autres suites qui le lisaient
  //    EN PARALLÈLE.
  // ⚠️ LE TERME SABOTÉ EST FABRIQUÉ, JAMAIS TIRÉ DE L'ENVIRONNEMENT :
  //    la 1re version utilisait le compte OS — sur la CI il s'appelle
  //    « runner », donc écarté comme générique, donc RIEN n'était détecté et
  //    le negative-check tombait (CI rouge, 04/08/2026). Un filet qui dépend
  //    de l'environnement peut être DÉSARMÉ par un changement ailleurs.
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-fuite-'));
  const liste = path.join(bac, 'liste.json');
  const TERME = 'zzfuitetemoin';
  try {
    execFileSync('git', ['init', '-q'], { cwd: bac });
    fs.writeFileSync(path.join(bac, 'piege.md'), 'auteur : ' + TERME + '\n');
    execFileSync('git', ['add', 'piege.md'], { cwd: bac });
    fs.writeFileSync(liste, JSON.stringify({ termes: [TERME], dossiersDerives: [] }));

    const avant = process.env.CTXROUTE_FUITE_LISTE;
    process.env.CTXROUTE_FUITE_LISTE = liste;
    try {
      const violations = scannerDepot(bac, motifs());
      assert.ok(violations.length > 0, 'un dépôt saboté DOIT être détecté');
      assert.match(violations[0], /piege\.md/);
    } finally {
      if (avant === undefined) delete process.env.CTXROUTE_FUITE_LISTE;
      else process.env.CTXROUTE_FUITE_LISTE = avant;
    }
  } finally {
    fs.rmSync(bac, { recursive: true, force: true });
  }
});

test('NEGATIVE-CHECK : les plages de DOCUMENTATION restent autorisées', () => {
  // ⚠️ La doctrine IMPOSE d'écrire 203.0.113.x dans les exemples. Un gate qui
  //    les interdirait rendrait la règle inapplicable — donc serait débranché.
  const m = motifs();
  assert.deepEqual(scanner('serveur de demo : 203.0.113.7', m), []);
  assert.deepEqual(scanner('local : 127.0.0.1:8080', m), []);
  assert.deepEqual(scanner('ecrire a dev@example.com', m), []);
});

test('une IP de MACHINE RÉELLE (bloc CGNAT/Tailscale) est refusée', () => {
  const m = motifs();
  assert.equal(scanner('vps : ' + ip(100, 88, 41, 95), m).length, 1);
  // Bornes du bloc 100.64/10 — au-delà c'est de l'espace public, pas nous.
  assert.equal(scanner(ip(100, 63, 0, 1), m).length, 0);
  assert.equal(scanner(ip(100, 128, 0, 1), m).length, 0);
});

// ── LA DÉRIVATION (le cœur : zéro liste à maintenir) ────────────────────
test('DÉRIVATION : les clients viennent des DOSSIERS, jamais d\'une liste écrite', () => {
  // ⚠️ Une liste tenue à la main serait périmée au client suivant : le gate
  //    protégerait moins EN SILENCE. On vérifie ici que la dérivation
  //    fonctionne ET qu'elle écarte l'outillage (`.git`, `node_modules`) —
  //    sans ce filtre, un terme comme « scripts » rendrait le gate rouge
  //    partout (mesuré le 04/08/2026 : 4 collisions, 3 fausses).
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-derive-'));
  const liste = path.join(bac, 'liste.json');
  try {
    fs.mkdirSync(path.join(bac, 'clients', 'boulangerie-durand'), { recursive: true });
    fs.writeFileSync(path.join(bac, 'clients', 'boulangerie-durand', 'brief.md'), '# brief');
    fs.mkdirSync(path.join(bac, 'clients', 'node_modules'), { recursive: true }); // PAS un client
    fs.writeFileSync(liste, JSON.stringify({
      termes: [],
      dossiersDerives: [{ racine: path.join(bac, 'clients'), marqueur: 'brief.md' }],
    }));

    const avant = process.env.CTXROUTE_FUITE_LISTE;
    process.env.CTXROUTE_FUITE_LISTE = liste;
    try {
      const m = motifs();
      assert.equal(scanner('client : boulangerie-durand', m).length, 1, 'le client DOIT être dérivé');
      assert.equal(scanner('cf node_modules/x', m).length, 0, 'un dossier sans marqueur n\'est PAS un client');
    } finally {
      if (avant === undefined) delete process.env.CTXROUTE_FUITE_LISTE;
      else process.env.CTXROUTE_FUITE_LISTE = avant;
    }
  } finally {
    fs.rmSync(bac, { recursive: true, force: true });
  }
});

test('CLONE VIERGE : liste privée absente ⇒ mode générique, jamais une panne', () => {
  // ⚠️ « Un gate de repo doit valoir sur un clone VIERGE » (gitignore.md).
  //    Exiger le fichier privé rendrait la CI rouge pour tout le monde.
  const avant = process.env.CTXROUTE_FUITE_LISTE;
  process.env.CTXROUTE_FUITE_LISTE = path.join(os.tmpdir(), 'ctxroute-liste-absente-xyz.json');
  try {
    const m = motifs();
    assert.ok(m.length >= 2, 'email + IP restent couverts sans fichier privé');
    assert.equal(scanner('vps : ' + ip(100, 88, 41, 95), m).length, 1, 'le générique protège encore');
  } finally {
    if (avant === undefined) delete process.env.CTXROUTE_FUITE_LISTE;
    else process.env.CTXROUTE_FUITE_LISTE = avant;
  }
});

// ── LE MODULE PUR ───────────────────────────────────────────────────────
test('echapper : un chemin Windows devient un littéral, jamais un joker', () => {
  // ⚠️ Sans échappement, `C:\Users\x` contient `\U` et `.` : la regex
  //    matcherait presque tout et le gate hurlerait sur le dépôt entier.
  const re = new RegExp(echapper('C:\\Users\\dev'));
  assert.ok(re.test('C:\\Users\\dev'));
  assert.ok(!re.test('CxUsersxdev'));
});

test('dernierSegment : le dossier UTILISATEUR, jamais la racine generique', () => {
  // ⚠️ Prendre tous les segments donnerait « Users », present dans tous les
  //    chemins d'exemple du depot — 6 faux positifs mesures le 04/08/2026.
  assert.equal(dernierSegment('C:/Users/dev'), 'dev');
  assert.equal(dernierSegment('C:\\Users\\dev\\'), 'dev');
  assert.equal(dernierSegment(''), '');
});

test('FRONTIERES DE MOT : un prenom ne matche pas le mot qui le contient', () => {
  // ⚠️ Cas REEL du 04/08/2026 : « un prénom » ⊂ « théorique » faisait rougir
  //    frontmatter.js et le skill. Un gate qui crie sur du sain meurt.
  const m = motifsInterdits(undefined, undefined, ['un prénom']);
  assert.deepEqual(scanner('un piege reel, pas theorique', m), []);
  assert.deepEqual(scanner('probleme théorique', m), []);
  assert.equal(scanner('ecrit par un prénom', m).length, 1);
  assert.equal(scanner('(un prénom)', m).length, 1);
});

test('scanner : TOTAL — entrées absurdes, jamais un throw', () => {
  const m = motifs();
  for (const mauvais of [undefined, null, 42, {}, []]) {
    assert.deepEqual(scanner(mauvais, m), []);
    assert.deepEqual(scanner('texte', mauvais), []);
  }
});

test('motifsInterdits : une entrée absente ou trop courte n\'invente aucun motif', () => {
  // ⚠️ Un terme de 1-2 caractères matcherait la moitié du dépôt : le gate
  //    serait rouge en permanence, donc mort.
  assert.equal(motifsInterdits(undefined, undefined, undefined).length, 2);
  assert.equal(motifsInterdits('ab', '', ['x']).length, 2);
  assert.equal(motifsInterdits('abc', '', []).length, 3);
});

test('motifsInterdits : un terme présent 2× ne crée qu\'UN motif', () => {
  const m = motifsInterdits('dupont', 'C:/Users/dupont', ['dupont']);
  assert.equal(m.filter((x) => x.nom.includes('dupont')).length, 1);
});
