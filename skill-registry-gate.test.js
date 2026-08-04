// ═══════════════════════════════════════════════════════════════════════
// GATE — tout skill du registre config.skills EXISTE dans le harnais.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Le registre `config.skills` nomme des skills PAR NOM (clé). Renommer ou
//    supprimer un skill sans MAJ le registre = pointeur qui déclenche « charge
//    le skill X » alors que X n'existe plus = pointeur fantôme, découvert en
//    prod. Ce gate le rend ROUGE au pre-push (le « mot de sync » scellé).
//
// ⚠️ Emplacement des skills = SPÉCIFIQUE AU HARNAIS (Claude Code :
//    ~/.claude/commands/{nom}.md). C'est la seule ligne « qui connaît le
//    harnais » — le reste du moteur reste agnostique. Portage Codex = une
//    variante de CE gate pointant vers le store de skills de Codex.
//
// ⚠️ Skippé sur clone vierge / CI (dir skills absent), comme source-drift-gate,
//    porte-differential, loader-differential : le parc du harnais n'y est pas.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_DIR = path.dirname(fileURLToPath(import.meta.url));
// Config utilisateur gitignorée (19/07/2026) : réelle si présente, sinon .example.
const REAL_CONFIG = path.join(REPO_DIR, 'ctxroute-config.json');
const CONFIG_PATH = fs.existsSync(REAL_CONFIG) ? REAL_CONFIG : path.join(REPO_DIR, 'ctxroute-config.json.example');
// ⚠️ SOURCE UNIQUE du chemin = paths.skillsDir() (partagée avec l'adaptateur
//    skill qui LIT le corps des skills — deux définitions divergeraient en silence).
const { skillsDir } = await import('./paths.js').then((m) => m.default || m);
const SKILLS_DIR = skillsDir();

// PUR : quels noms n'ont pas de fichier ? (existsFn injectable = négative-check).
const findMissing = (names, existsFn) => names.filter((n) => !existsFn(n));

test('findMissing détecte les absents (auto-validation : le gate MORD)', () => {
  assert.deepStrictEqual(findMissing(['a', 'b', 'c'], (n) => n === 'a' || n === 'c'), ['b']);
  assert.deepStrictEqual(findMissing(['x'], () => true), []);
  assert.deepStrictEqual(findMissing([], () => false), []);
});

test('tout skill de config.skills existe dans le harnais (ou skip si dir absent)', () => {
  if (!fs.existsSync(SKILLS_DIR)) return; // clone vierge / CI — parc harnais absent
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const names = Object.keys(config.skills || {});
  const missing = findMissing(names, (n) => fs.existsSync(path.join(SKILLS_DIR, n + '.md')));
  assert.deepStrictEqual(
    missing,
    [],
    `Skills du registre SANS fichier .md dans ${SKILLS_DIR} : [${missing.join(', ')}]. ` +
      'Renommé/supprimé ? Corrige config.skills OU restaure le skill — un pointeur fantôme est interdit.'
  );
});

// PUR : quels skills du harnais ne sont déclarés NULLE PART ? (négative-checkable)
const findUndeclared = (allSkills, registered, withoutPerimeter) =>
  allSkills.filter((n) => !registered.includes(n) && !withoutPerimeter.includes(n));

test('findUndeclared détecte les non-déclarés (auto-validation : le gate INVERSE mord)', () => {
  assert.deepStrictEqual(findUndeclared(['a', 'b', 'c'], ['a'], ['c']), ['b']);
  assert.deepStrictEqual(findUndeclared(['a'], [], ['a']), []);
  assert.deepStrictEqual(findUndeclared([], ['x'], []), []);
});

// ── SENS INVERSE (19/07/2026) : tout skill du HARNAIS doit être déclaré ──
// ⚠️ Le gate ci-dessus est DIRECTIONNEL (registre → fichier) : il est
//    structurellement AVEUGLE à un skill créé et jamais enregistré — le même
//    trou que « serveur MCP sans doc » et « doc sans règle » (classes déjà
//    scellées). Un périmètre OUBLIÉ et un skill volontairement sans périmètre
//    sont INDISCERNABLES sans déclaration explicite : `skillsWithoutPerimeter`
//    rend le silence impossible. Réflexe « nouveau projet » MÉCANISÉ : créer
//    un skill sans le déclarer = ROUGE au prochain test/push.
test('tout skill du harnais est SOIT enregistré (périmètre) SOIT déclaré sans périmètre', () => {
  if (!fs.existsSync(SKILLS_DIR)) return; // clone vierge / CI
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  // ⚠️ OPT-IN EXPLICITE (framework LIBRE — un langage n'impose jamais une
  //    POLITIQUE) : utiliser la fonctionnalité skills ≠ adopter l'exhaustivité.
  //    Enregistrer 2 skills sans vouloir trier les 40 autres est un usage
  //    LÉGITIME. La discipline « zéro silence » ne s'active que si l'utilisateur
  //    déclare la clé `skillsWithoutPerimeter` (même vide []) — c'est ELLE
  //    l'interrupteur d'adoption. Le moteur livre l'outil, pas le règlement.
  if (!('skillsWithoutPerimeter' in config)) return;
  const all = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  const undeclared = findUndeclared(all, Object.keys(config.skills || {}), config.skillsWithoutPerimeter || []);
  assert.deepStrictEqual(
    undeclared,
    [],
    `Skills du harnais déclarés NULLE PART : [${undeclared.join(', ')}]. ` +
      'Pour chacun : ajoute un périmètre dans config.skills (auto-injection) OU liste-le dans ' +
      'skillsWithoutPerimeter (volontairement on-demand). Le silence n\'est pas une option.'
  );
});
