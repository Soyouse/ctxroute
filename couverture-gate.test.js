// ═══════════════════════════════════════════════════════════════════════
// GATE DE COUVERTURE — le repo se documente LUI-MÊME, ou il rougit.
// ═══════════════════════════════════════════════════════════════════════
//
// RAISON D'ÊTRE (31/07/2026) : un audit a trouvé TROIS classes d'oubli, et
// chacune avait déjà frappé — dont deux AVANT ce chantier, sans que personne
// ne les voie :
//   ① 3 suites sans doc injectable (2 de ce chantier + 1 préexistante) ;
//   ② 7 fichiers TRACKÉS absents de l'arbo du skill (dont 5 d'un chantier
//      antérieur) ;
//   ③ `porte-core.js`/`guard-core.js` absents de l'`includeOnly` de
//      dependency-cruiser — donc JAMAIS analysés, faux négatif silencieux.
// Elles ont été comblées à la main. ⚠️ C'est exactement ce que la doctrine
// interdit : « une classe d'erreur non scellée REVIENDRA ». Ce fichier la
// scelle — l'oubli devient ROUGE au lieu d'attendre le prochain audit.
//
// ⚠️ AUCUNE LISTE RECOPIÉE : tout est DÉRIVÉ (fichiers = `git ls-files`,
//    règles = le parc réel via le loader). Une liste à maintenir à la main
//    serait la 4ᵉ classe du même bug.
//
// ⚠️ Volets ① et ② dépendent du PARC/SKILL (hors repo) ⇒ skip propre sur
//    clone vierge, comme parc-sync-gate. Le volet ③ est 100 % repo : il vaut
//    partout, tout le temps.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from './corpus.js';
import { rulesFromCorpus } from './loader.js';
import fileSource from './sources/file.js';
import { DEFAUT_BUDGET } from './budget.js';

// ⚠️ DÉRIVÉ du moteur, jamais recopié : le plafond des skills NEUFS est le
//    budget d'émission lui-même. Un chiffre en dur ici divergerait de
//    budget.js en silence — la classe de bug que tout ce fichier combat.
const BUDGET_NEUF = DEFAUT_BUDGET;

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PARC = path.join(os.homedir(), '.claude', 'hooks', 'docs');
const SKILL = path.join(os.homedir(), '.claude', 'commands', 'ctxroute.md');
// Arbo sortie du skill le 31/07/2026 (progressive disclosure) — cf volet ②.
const ARBO = path.join(ICI, 'ARBORESCENCE.md');

const fichiersTrackes = () =>
  execFileSync('git', ['ls-files'], { cwd: ICI, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

// Un fichier est « couvert » si une règle du parc le matche RÉELLEMENT —
// mesuré par la vraie source, jamais par une heuristique de nom.
function docsPour(rules, relPath) {
  const abs = path.join(ICI, relPath).replace(/\\/g, '/');
  return fileSource.matchingDocs(rules, { toolName: 'Read', toolInput: { file_path: abs } });
}

test('① tout module et toute suite du repo reçoit une doc injectable', () => {
  if (!fs.existsSync(PARC)) return; // clone vierge : rien à mesurer
  const rules = rulesFromCorpus(readCorpus(PARC, 'docs/'));
  assert.ok(rules.length > 0, 'parc lu mais AUCUNE règle : la sonde ne prouverait rien');

  // Périmètre DÉRIVÉ : les .js à la racine et dans sources/ (le code et ses
  // suites). Exclut les .example/config — leur doc est portée autrement.
  const cibles = fichiersTrackes().filter(
    (f) => f.endsWith('.js') && (!f.includes('/') || f.startsWith('sources/'))
  );
  assert.ok(cibles.length > 20, 'périmètre suspect (trop peu de fichiers) : gate aveugle');

  const nus = cibles.filter((f) => docsPour(rules, f).length === 0);
  assert.deepStrictEqual(nus, [],
    'Ces fichiers n\'ont AUCUNE doc injectable — un agent qui les touche ne reçoit RIEN.\n' +
    '      Ajoute leur nom au `rules:` de la doc concernée (ou crée la doc).');
});

test('② tout fichier TRACKÉ figure dans l\'arbo du skill (filet d\'exhaustivité)', () => {
  if (!fs.existsSync(SKILL)) return; // clone vierge
  // ⚠️ L'arbo VIT DANS `ARBORESCENCE.md` depuis le 31/07/2026 (progressive
  //    disclosure : 48 % du skill, qui passait donc au-dessus du budget et se
  //    faisait ÉVINCER en entier). Le filet d'exhaustivité couvre LES DEUX
  //    fichiers — chercher dans le skill seul rendrait ce volet aveugle à
  //    tout le repo, donc VERT en n'analysant rien.
  const skill = fs.readFileSync(SKILL, 'utf8') + '\n' +
    (fs.existsSync(ARBO) ? fs.readFileSync(ARBO, 'utf8') : '');
  // Les docs perso (gitignorées) et les .example n'ont pas à y figurer.
  const cibles = fichiersTrackes().filter(
    (f) => !f.startsWith('docs/framework/') && !f.startsWith('docs/mcp/') && !f.endsWith('.md.example')
  );
  const absents = cibles.filter((f) => !skill.includes(path.basename(f)));
  assert.deepStrictEqual(absents, [],
    'Fichiers hors de l\'arbo du skill. L\'arbo est le filet d\'exhaustivité :\n' +
    '      un fichier hors liste est un trou PAR DÉFINITION, sans jugement d\'importance.');
});

test('③ tout `.js` du repo est analysé par dependency-cruiser (`includeOnly`)', () => {
  // ⚠️ Volet 100 % repo : vaut sur un clone vierge aussi.
  const conf = JSON.parse(fs.readFileSync(path.join(ICI, '.dependency-cruiser.json'), 'utf8'));
  const re = new RegExp(conf.options.includeOnly);
  const cibles = fichiersTrackes().filter(
    (f) => f.endsWith('.js') && !f.endsWith('.test.js') && (!f.includes('/') || f.startsWith('sources/'))
  );
  const invisibles = cibles.filter((f) => !re.test(f));
  assert.deepStrictEqual(invisibles, [],
    'Ces modules ne sont PAS dans `includeOnly` : dependency-cruiser ne les voit pas.\n' +
    '      Le gate de couplage est alors VERT en n\'analysant rien — faux négatif silencieux\n' +
    '      (vécu : porte-core.js et guard-core.js, invisibles depuis leur création).');
});

test('NEGATIVE-CHECK : les 3 volets DÉTECTENT vraiment un oubli', () => {
  // ⚠️ Sans ceci, ce gate pourrait certifier au lieu de protéger — la faute
  //    exacte déjà commise par une 1ʳᵉ version de `deadline-gate` (verte en
  //    n'analysant AUCUN hook réel).
  const conf = JSON.parse(fs.readFileSync(path.join(ICI, '.dependency-cruiser.json'), 'utf8'));
  const re = new RegExp(conf.options.includeOnly);
  assert.equal(re.test('module-jamais-declare.js'), false, 'volet ③ ne détecterait pas un module absent');

  if (fs.existsSync(SKILL)) {
    const skill = fs.readFileSync(SKILL, 'utf8');
    assert.equal(skill.includes('fichier-fantome-xyz.js'), false, 'volet ② ne détecterait pas un absent');
  }
  if (fs.existsSync(PARC)) {
    const rules = rulesFromCorpus(readCorpus(PARC, 'docs/'));
    assert.equal(docsPour(rules, 'fichier-sans-aucune-doc-xyz.js').length, 0,
      'volet ① ne détecterait pas un fichier sans doc');
  }
});

// ⚠️ VOLET ④ SUPPRIMÉ le 03/08/2026 (décision du mainteneur) — NE PAS le réintroduire.
//    Il plafonnait la LONGUEUR des docs (cliquet en lignes), au motif qu'une
//    doc trop grosse serait tronquée ou évincée. Ce motif est MORT : depuis le
//    transport multi-trames, une doc trop lourde est MORCELÉE et livrée —
//    l'indélivrabilité est impossible par construction (cf `budget.morceler`).
//    ⚠️ Le framework LIVRE, il ne juge JAMAIS la taille de ce qu'on lui confie.
//    Un plafond de longueur ferait porter à l'AUTEUR d'une doc un défaut du
//    TRANSPORT, et imposerait à tous les utilisateurs une convention de style
//    qui ne regarde que le parc du mainteneur. Si un jour des morceaux ne
//    sortent pas, ce n'est pas « trop gros » : c'est `--paquets N` trop petit,
//    et le message d'exécution le dit avec sa solution.
//
// ⚠️ VOLET ⑤ SUPPRIMÉ AUSSI (03/08/2026) — et pour une raison DIFFÉRENTE de
//    celle qui l'avait mis en pause. Il plafonnait le POIDS DES SKILLS. Il
//    avait été suspendu le 02/08 au motif « l'injection auto des skills n'est
//    pas au point », avec une condition de réactivation : « injection prouvée
//    par spawn réel ». ⚠️ CETTE CONDITION EST DÉSORMAIS REMPLIE (le doctor
//    prouve l'injection du corps du skill, et le skill de 28 Ko arrive en
//    MORCEAUX numérotés) — la relire telle quelle conduirait à RESSUSCITER un
//    cliquet de taille. C'est exactement l'inverse de ce qu'il faut faire :
//    la condition est CADUQUE, pas remplie. Un skill lourd est LIVRÉ, donc son
//    poids n'est plus un défaut à sanctionner. NE JAMAIS le réintroduire, et
//    ne JAMAIS conseiller de scinder un skill : il s'injecte EN ENTIER.

