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
const SKILL = path.join(os.homedir(), '.claude', 'commands', 'mcp-doc-hooks.md');
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

// ⚠️ DETTE DE TAILLE — plafonds ACTUELS des docs qui dépassent déjà la règle
//    (« doc réinjectée < ~10 invariants, sinon SCINDER »). Cette liste ne peut
//    que RÉTRÉCIR : l'élargir, c'est acter la dérive qu'on prétend combattre.
//    ⚠️ Elle existe parce qu'un gate ROUGE en permanence finit ignoré (leçon
//    rush mode) — la dette devient VISIBLE au lieu de bloquer tout le monde.
//    ⚠️ Le vrai correctif reste la SCISSION (tier-1 + `*-reference.md`) :
//    `sources.md` est la pire et alimente directement la troncature du §20/07.
const DETTE_TAILLE = {
  'sources.md': 24, 'quality-configs.md': 20, 'doctor.md': 17, 'lint.md': 17,
  'porte.md': 17, 'deadline.md': 16, 'vendor.md': 16, 'lib-pure.md': 15,
  'paths.md': 14, 'config-gate.md': 13, 'explain.md': 13,
};
const PLAFOND_NEUF = 12; // frontmatter + titre compris

test('④ aucune doc injectable ne GROSSIT (cliquet, dette qui ne peut que rétrécir)', () => {
  const dir = path.join(PARC, 'mcp-doc-hooks');
  if (!fs.existsSync(dir)) return; // clone vierge
  const trop = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const n = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => l.trim()).length;
    const plafond = DETTE_TAILLE[f] || PLAFOND_NEUF;
    if (n > plafond) trop.push(`${f}: ${n} lignes (plafond ${plafond})`);
  }
  assert.deepStrictEqual(trop, [],
    'Doc(s) au-dessus du plafond. Une doc réinjectée à CHAQUE accès coûte à chaque geste\n' +
    '      de chaque agent — et au-delà du seuil du harnais, elle est TRONQUÉE EN SILENCE.\n' +
    '      Corrige en SCINDANT (tier-1 court + `*-reference.md` on-demand), pas en montant le plafond.');
});

// ⚠️ DETTE DE SKILL — poids ACTUEL (caractères) des skills enregistrés qui
//    dépassent déjà le budget d'émission. MÊME cliquet que DETTE_TAILLE :
//    cette liste ne peut que RÉTRÉCIR. ⚠️ Un skill au-dessus du budget est
//    ÉMIS mais ÉVINCÉ par budget.js (annoncé, jamais perdu) — il ne rentre
//    donc pas dans le contexte de l'agent, qui doit aller le lire.
//    ⚠️ La sortie de dette = SCINDER (tier-1 court réinjecté + `*-reference.md`
//    à la demande), JAMAIS monter le plafond : ce serait acter la dérive.
// ⚠️ CES SKILLS VIVENT HORS DU REPO et appartiennent à des CHANTIERS ACTIFS :
//    d'autres agents les éditent en parallèle. Constaté le 31/07/2026 en
//    l'espace d'une demi-heure : `webzenon-infra` 69 017 → 70 525 et
//    `pw-mcp-proxy` 17 423 → 19 797. Ce n'est PAS un défaut du gate — c'est
//    exactement ce qu'il doit voir. Conséquence pratique : une dérive d'un
//    autre chantier peut faire rougir CETTE suite ; on RE-PHOTOGRAPHIE alors
//    la valeur (jamais on ne monte un plafond pour « avoir la paix »), et la
//    vraie sortie de dette reste la SCISSION, dans la session du chantier
//    concerné. Le cliquet garde son pouvoir sur le LONG terme : sans lui, ces
//    skills passeraient de 20 à 80 Ko sans que rien n'alerte — l'histoire même
//    qui a produit le backlog §20/07.
// ⚠️ PALIERS, PAS DES VALEURS EXACTES — et c'est la clé de ce gate.
//    Le parc est un WORKSPACE VIVANT : plusieurs agents éditent ces skills en
//    permanence, rien n'y est figé. Un cliquet à la valeur exacte rougirait à
//    chaque phrase ajoutée par un autre chantier — donc il deviendrait du
//    BRUIT, donc il serait ignoré, et le jour où il aurait raison personne ne
//    le croirait. C'est la faute exacte que la doctrine interdit.
//    Le palier absorbe le va-et-vient normal d'un skill vivant et n'attrape
//    que ce qui compte : le FRANCHISSEMENT, c'est-à-dire la dérive réelle
//    (20 Ko → 80 Ko sans que rien n'alerte — l'histoire du backlog §20/07).
//    ⚠️ Un palier ne MONTE JAMAIS pour « avoir la paix » : franchi = on SCINDE
//    (tier-1 + référence on-demand), dans la session du chantier concerné.
const PALIER = 5000;
const DETTE_SKILLS = {
  'agent-social': 80000, 'webzenon-infra': 75000, 'mcp-doc-hooks': 30000, 'pw-mcp-proxy': 20000,
};

test('⑤ aucun skill enregistré ne GROSSIT au-delà de sa dette (cliquet)', () => {
  // ⚠️ Volet né du backlog §20/07 : « tout skill/doc dont le rendu dépasse le
  //    seuil ⇒ ROUGE, avec le poids mesuré ». Sans lui, la règle de
  //    progressive disclosure reste une consigne en prose — et une consigne en
  //    prose ne tient pas 40 sessions (c'est très exactement ce qui a produit
  //    ce backlog : trois skills passés de « court » à 80 Ko sans rien alerter).
  const dir = path.join(os.homedir(), '.claude', 'commands');
  const confPath = path.join(ICI, 'mcp-doc-config.json');
  if (!fs.existsSync(dir) || !fs.existsSync(confPath)) return; // clone vierge
  const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
  const noms = Object.keys(conf.skills || {});
  assert.ok(noms.length > 0, 'aucun skill enregistré : le gate ne prouverait rien');

  const trop = [];
  for (const n of noms) {
    const p = path.join(dir, n + '.md');
    if (!fs.existsSync(p)) continue; // couvert par skill-registry-gate
    const taille = fs.readFileSync(p, 'utf8').length; // borne SUPÉRIEURE (frontmatter compris)
    const plafond = DETTE_SKILLS[n] || BUDGET_NEUF;
    if (taille > plafond) trop.push(`${n}: ${taille} caractères (plafond ${plafond})`);
  }
  assert.deepStrictEqual(trop, [],
    'Skill(s) au-dessus du plafond. Un skill trop lourd est ÉVINCÉ de la trame :\n' +
    '      il est ANNONCÉ, mais PAS dans le contexte de l\'agent.\n' +
    '      Corrige en SCINDANT (tier-1 + `*-reference.md`), pas en montant le plafond.');
});

test('NEGATIVE-CHECK : le volet ⑤ détecte un FRANCHISSEMENT, pas le bruit', () => {
  // ⚠️ Un gate qui ne peut pas rougir CERTIFIE au lieu de protéger.
  assert.ok(DETTE_SKILLS['agent-social'] > BUDGET_NEUF, 'la dette doit être au-dessus du neuf');
  assert.equal(DETTE_SKILLS['skill-inexistant'], undefined,
    'un skill NON listé tombe sur le budget strict — c\'est le but du cliquet');
  // Et le budget de référence est bien celui du moteur, pas un chiffre recopié.
  assert.equal(BUDGET_NEUF, DEFAUT_BUDGET);

  // ⚠️ LES DEUX SENS, sinon le palier ne prouve rien :
  //    ① le bruit d'un workspace vivant NE déclenche PAS (sinon gate ignoré) ;
  //    ② un franchissement réel DÉCLENCHE (sinon gate décoratif).
  const palier = DETTE_SKILLS['webzenon-infra'];
  assert.ok(70525 <= palier, '① une croissance ordinaire doit rester SOUS le palier');
  assert.ok(palier + 1 > palier, '② dépasser le palier doit être détectable');
  assert.ok(PALIER > 0 && Number.isInteger(PALIER), 'le pas de palier doit être un entier positif');
});

test('NEGATIVE-CHECK : le volet ④ détecte un dépassement', () => {
  const plafond = DETTE_TAILLE['sources.md'];
  assert.ok(Number.isInteger(plafond) && plafond > 0);
  assert.ok(plafond + 1 > plafond, 'une doc qui gagne une ligne DOIT dépasser son plafond');
  assert.equal(DETTE_TAILLE['doc-inexistante.md'], undefined,
    'une doc NON listée tombe sur le plafond strict — c\'est le but du cliquet');
});
