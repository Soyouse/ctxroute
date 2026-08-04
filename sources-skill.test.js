// Tests DÉTERMINISTES de sources/skill.js — cible Stryker (import DIRECT,
// toute évaluation DANS les callbacks — contrat perTest).
import { test, expect } from 'vitest';
import {
  skillRules,
  matchingSkills,
  serverMatches,
  declFor,
  skillNameFromDoc,
  pointerBody,
  DOC_PREFIX,
  MODES,
} from './sources/skill.js';

// Contrat EN DUR (jamais dérivé du code) : les modes valides. Tue le mutant
// MODES[i]->"" que declFor ne peut pas attraper seul (fallback 'once' coïncide).
test('MODES = contrat exact des cadences valides', () => {
  expect(MODES).toEqual(['dumb', 'once', 'smart']);
});

// ── skillRules : registre config -> règles plates ──
test('skillRules : 1 règle par pattern de périmètre, doc préfixée', () => {
  const rules = skillRules({ skills: { 'acme-infra': { match: ['infra-mcp', 'acme-infra'] } } });
  expect(rules).toEqual([
    { pattern: 'infra-mcp', doc: 'skill/acme-infra' },
    { pattern: 'acme-infra', doc: 'skill/acme-infra' },
  ]);
});

test('skillRules : préfixe EXACT (skill/), pas un autre', () => {
  const rules = skillRules({ skills: { foo: { match: ['x'] } } });
  expect(rules[0].doc).toBe('skill/foo');
  expect(DOC_PREFIX).toBe('skill/');
});

test('skillRules : exclude propagé SI tableau, sinon absent (shape stable)', () => {
  const withArr = skillRules({ skills: { a: { match: ['x'], exclude: ['node_modules'] } } });
  expect(withArr[0].exclude).toEqual(['node_modules']);
  const strExclude = skillRules({ skills: { a: { match: ['x'], exclude: 'node_modules' } } });
  expect('exclude' in strExclude[0]).toBe(false);
  const noExclude = skillRules({ skills: { a: { match: ['x'] } } });
  expect('exclude' in noExclude[0]).toBe(false);
});

test('skillRules : scope propagé SI tableau, sinon absent (parité docs fichier)', () => {
  const withScope = skillRules({ skills: { a: { match: ['x'], scope: ['api-site'] } } });
  expect(withScope[0].scope).toEqual(['api-site']);
  const noScope = skillRules({ skills: { a: { match: ['x'] } } });
  expect('scope' in noScope[0]).toBe(false);
});

test('matchingSkills : scope RESSERRE — match matche mais scope absent des params => rien', () => {
  const config = { skills: { a: { match: ['x.js'], scope: ['api-site'] } } };
  // match matche le path, mais aucun param ne contient 'api-site' => filtré
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/x.js' } })).toEqual([]);
  // un param contient 'api-site' => passe
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/api-site/x.js' } })).toEqual([{ doc: 'skill/a' }]);
});

test('skillRules : pattern non-string ignoré, strings gardés', () => {
  const rules = skillRules({ skills: { a: { match: ['ok', 42, 'ok2'] } } });
  expect(rules.map((r) => r.pattern)).toEqual(['ok', 'ok2']);
});

test('skillRules : match absent/non-tableau = 0 règle ; skills absent = []', () => {
  expect(skillRules({ skills: { a: {} } })).toEqual([]);
  expect(skillRules({ skills: { a: { match: 'infra-mcp' } } })).toEqual([]);
  expect(skillRules({})).toEqual([]);
  expect(skillRules(null)).toEqual([]);
});

// ── matchingSkills : réutilise le matcher fichier ──
test('matchingSkills : périmètre touché -> skill déclenché', () => {
  const config = { skills: { 'acme-infra': { match: ['infra-mcp'] } } };
  const hit = matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/Users/x/Desktop/infra-mcp/server.js' } });
  expect(hit).toEqual([{ doc: 'skill/acme-infra' }]);
});

test('matchingSkills : hors périmètre -> rien', () => {
  const config = { skills: { 'acme-infra': { match: ['infra-mcp'] } } };
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/autre/projet/index.js' } })).toEqual([]);
});

test('matchingSkills : 2 patterns du MÊME skill matchent -> 1 seul pointeur (dédup)', () => {
  const config = { skills: { a: { match: ['infra', 'infra-mcp'] } } };
  const hit = matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'x/infra-mcp/y.js' } });
  expect(hit).toEqual([{ doc: 'skill/a' }]);
});

test('matchingSkills : matche aussi une commande Bash (cd &&)', () => {
  const config = { skills: { a: { match: ['acme-infra'] } } };
  const hit = matchingSkills(config, { toolName: 'Bash', toolInput: { command: 'cd /root/acme-infra && ls scripts' } });
  expect(hit).toEqual([{ doc: 'skill/a' }]);
});

// ── serverMatches : dimension MCP, réutilise lib.serverName ──
test('serverMatches : appel MCP d\'un serveur listé -> skill déclenché', () => {
  const config = { skills: { 'acme-infra': { match: ['x'], servers: ['infra', 'blog'] } } };
  expect(serverMatches(config, { toolName: 'mcp__infra__infra_call', toolInput: {} })).toEqual([{ doc: 'skill/acme-infra' }]);
  expect(serverMatches(config, { toolName: 'mcp__blog__blog_call', toolInput: {} })).toEqual([{ doc: 'skill/acme-infra' }]);
});

test('serverMatches : serveur NON listé -> rien', () => {
  const config = { skills: { a: { match: ['x'], servers: ['infra'] } } };
  expect(serverMatches(config, { toolName: 'mcp__stripe__authenticate', toolInput: {} })).toEqual([]);
});

test('serverMatches : outil NON-MCP (pas de serveur) -> rien', () => {
  const config = { skills: { a: { match: ['x'], servers: ['infra'] } } };
  expect(serverMatches(config, { toolName: 'Read', toolInput: { file_path: 'y.js' } })).toEqual([]);
  expect(serverMatches(config, {})).toEqual([]);
});

test('serverMatches : servers absent/non-tableau -> rien', () => {
  expect(serverMatches({ skills: { a: { match: ['x'] } } }, { toolName: 'mcp__infra__x', toolInput: {} })).toEqual([]);
  expect(serverMatches({ skills: { a: { match: ['x'], servers: 'infra' } } }, { toolName: 'mcp__infra__x', toolInput: {} })).toEqual([]);
});

// ── matchingSkills : UNION fichier + serveur, dédupée ──
test('matchingSkills : déclenché par le SERVEUR même sans toucher de fichier', () => {
  const config = { skills: { 'acme-infra': { match: ['infra-mcp'], servers: ['infra'] } } };
  expect(matchingSkills(config, { toolName: 'mcp__infra__infra_call', toolInput: {} })).toEqual([{ doc: 'skill/acme-infra' }]);
});

test('matchingSkills : fichier ET serveur matchent le même skill -> 1 SEUL pointeur (dédup)', () => {
  const config = { skills: { a: { match: ['infra-mcp'], servers: ['infra'] } } };
  // un appel mcp__infra__ dont un param contient aussi "infra-mcp" : les 2 dimensions matchent
  const hit = matchingSkills(config, { toolName: 'mcp__infra__infra_call', toolInput: { path: 'x/infra-mcp/y' } });
  expect(hit).toEqual([{ doc: 'skill/a' }]);
});

test('matchingSkills : 2 skills distincts, un par fichier un par serveur -> les 2', () => {
  const config = {
    skills: {
      f: { match: ['projet-f'] },
      s: { match: ['zzz'], servers: ['infra'] },
    },
  };
  const hit = matchingSkills(config, { toolName: 'mcp__infra__x', toolInput: { file_path: 'projet-f/main.js' } });
  expect(hit).toEqual([{ doc: 'skill/f' }, { doc: 'skill/s' }]);
});

// ── declFor : POSE l'entrée, ne résout AUCUNE cascade (04/08/2026) ──
// ⚠️ CONTRAT CHANGÉ, couverture CONSERVÉE. Avant, declFor résolvait
//    `config.skillDefaults` ET forçait `mode: 'once'` : c'était un SECOND point de
//    cascade, en plus de gate.js. Le jour où un étage bougeait dans gate, celui-ci
//    restait en arrière et les skills suivaient une autre règle que les docs, en
//    SILENCE. Les 6 cas qui certifiaient ce comportement sont REMPLACÉS ici ; la
//    cascade complète (defaults.skill > global > framework 'once') est prouvée
//    dans gate.test.js, à son unique point de résolution.
test('declFor : rien de déclaré -> objet VIDE (aucun défaut posé ici)', () => {
  expect(declFor(undefined)).toEqual({});
  expect(declFor({})).toEqual({});
});

test('declFor : une valeur valide de l\'entrée est POSÉE telle quelle', () => {
  expect(declFor({ mode: 'dumb' })).toEqual({ mode: 'dumb' });
  expect(declFor({ mode: 'smart' })).toEqual({ mode: 'smart' });
  expect(declFor({ mode: 'once' })).toEqual({ mode: 'once' });
});

test('declFor : une valeur INVALIDE est OMISE (jamais posée) -> la cascade tranchera', () => {
  expect(declFor({ mode: 'bogus' })).toEqual({});
  expect(declFor({ threshold: 0 })).toEqual({});
  expect(declFor({ threshold: -1 })).toEqual({});
  expect(declFor({ threshold: 2.5 })).toEqual({});
  expect(declFor({ driftUnit: 'bogus' })).toEqual({});
});

test('declFor : threshold — borne 1 INCLUSE, entiers >= 1 posés', () => {
  expect(declFor({ mode: 'smart', threshold: 1 })).toEqual({ mode: 'smart', threshold: 1 });
  expect(declFor({ mode: 'smart', threshold: 5 })).toEqual({ mode: 'smart', threshold: 5 });
});

// ⚠️ Ce cas est le GARDE-FOU anti-retour : si declFor se remettait un jour à lire
//    un 2ᵉ argument, la double cascade renaîtrait sans bruit. Ici, elle ROUGIT.
test('declFor : IGNORE tout second argument (plus aucune résolution de defaults ici)', () => {
  expect(declFor({}, { mode: 'smart' })).toEqual({});
  expect(declFor({ mode: 'dumb' }, { mode: 'smart', threshold: 9 })).toEqual({ mode: 'dumb' });
});

// ── skillNameFromDoc : inverse exact de skillRules ──
test('skillNameFromDoc : retire le préfixe skill/', () => {
  expect(skillNameFromDoc('skill/acme-infra')).toBe('acme-infra');
  expect(skillNameFromDoc('skill/a')).toBe('a');
});

// ── pointerBody : pointeur, jamais le corps du skill ──
test('pointerBody : nomme le skill + ordonne le chargement', () => {
  const body = pointerBody('acme-infra');
  expect(body).toContain('acme-infra');
  expect(body).toContain('charge');
  expect(body).toContain('Skill');
});

// ── driftUnit : valide POSÉ, absent OMIS — la cascade (defaults.skill >
//    defaultDriftUnit > 'tool') vit dans gate.driftUnitForDoc, point unique ──
test('declFor : driftUnit — valide posé, invalide et absent OMIS', () => {
  expect(declFor({ driftUnit: 'turn' }).driftUnit).toBe('turn');
  expect(declFor({ driftUnit: 'tool' }).driftUnit).toBe('tool');
  expect('driftUnit' in declFor({ driftUnit: 'bogus' })).toBe(false);
  expect('driftUnit' in declFor({})).toBe(false);
  expect('driftUnit' in declFor(undefined)).toBe(false);
});

// ── serverMatches : 3 GRAINS (18/07/2026) — serveur / outil / sous-outil ──
test('serverMatches grain OUTIL : "srv/outil" ne matche que CET outil du serveur', () => {
  const config = { skills: { a: { match: ['x'], servers: ['gworkspace/send_mail'] } } };
  expect(serverMatches(config, { toolName: 'mcp__gworkspace__send_mail', toolInput: {} })).toEqual([{ doc: 'skill/a' }]);
  expect(serverMatches(config, { toolName: 'mcp__gworkspace__list_events', toolInput: {} })).toEqual([]);
  expect(serverMatches(config, { toolName: 'mcp__autre__send_mail', toolInput: {} })).toEqual([]);
});

test('serverMatches grain SOUS-OUTIL : "srv/sub" via servers.{srv}.subToolParam', () => {
  const config = {
    servers: { odoo: { subToolParam: 'args.tool' } },
    skills: { a: { match: ['x'], servers: ['odoo/create_invoice'] } },
  };
  expect(serverMatches(config, { toolName: 'mcp__odoo__odoo_call', toolInput: { args: { tool: 'create_invoice' } } })).toEqual([{ doc: 'skill/a' }]);
  expect(serverMatches(config, { toolName: 'mcp__odoo__odoo_call', toolInput: { args: { tool: 'read_lead' } } })).toEqual([]);
});

test('serverMatches : grain serveur ENTIER continue de matcher tous ses outils', () => {
  const config = { skills: { a: { match: ['x'], servers: ['gworkspace'] } } };
  expect(serverMatches(config, { toolName: 'mcp__gworkspace__send_mail', toolInput: {} })).toEqual([{ doc: 'skill/a' }]);
  expect(serverMatches(config, { toolName: 'mcp__gworkspace__nimporte', toolInput: {} })).toEqual([{ doc: 'skill/a' }]);
});

test('serverMatches : garde server==null — une entrée pathologique "null/null" ne matche JAMAIS un outil non-MCP', () => {
  const config = { skills: { a: { match: ['x'], servers: ['null/null'] } } };
  expect(serverMatches(config, { toolName: 'Read', toolInput: { file_path: 'y.js' } })).toEqual([]);
  expect(serverMatches(config, {})).toEqual([]);
});

test('serverMatches : sans sous-outil résolu, une entrée pathologique "srv/null" ne matche JAMAIS', () => {
  // subToolParam absent => subTool null => le candidat sous-outil N'EXISTE PAS
  // (jamais la chaîne 'gworkspace/null').
  const config = { skills: { a: { match: ['x'], servers: ['gworkspace/null'] } } };
  expect(serverMatches(config, { toolName: 'mcp__gworkspace__send_mail', toolInput: {} })).toEqual([]);
});

// ── cwd (18/07/2026, ajouté APRÈS mesure doc-first : champ commun des contrats
//    de hooks Claude Code ET Codex) : le répertoire courant EST un param matchable ──
test('matchingSkills/cwd : `npm test` lancé DANS le projet (aucun chemin dans la commande) → skill déclenché par le cwd', () => {
  const config = { skills: { a: { match: ['mon-projet'] } } };
  const payload = { toolName: 'Bash', toolInput: { command: 'npm test' }, cwd: 'C:/Users/dev/Desktop/mon-projet' };
  expect(matchingSkills(config, payload)).toEqual([{ doc: 'skill/a' }]);
  // hors du projet : rien.
  expect(matchingSkills(config, { toolName: 'Bash', toolInput: { command: 'npm test' }, cwd: 'C:/ailleurs' })).toEqual([]);
  // FAIL-SOFT : harnais sans cwd → comportement d'avant, pas de crash.
  expect(matchingSkills(config, { toolName: 'Bash', toolInput: { command: 'npm test' } })).toEqual([]);
});

test('matchingSkills/cwd : scope satisfait par le cwd aussi (tous les params, cwd inclus)', () => {
  const config = { skills: { a: { match: ['x.js'], scope: ['mon-projet'] } } };
  const payload = { toolName: 'Read', toolInput: { file_path: 'x.js' }, cwd: 'C:/dev/mon-projet' };
  expect(matchingSkills(config, payload)).toEqual([{ doc: 'skill/a' }]);
});

// ── rules (19/07/2026, parité docs) : conditions PAR ENTRÉE pour un skill ──
test('skillRules/rules : un scope PAR pattern — hétérogène sans dupliquer le skill', () => {
  const config = { skills: { a: { rules: [
    { pattern: 'deploy.sh', scope: ['projet-a'] },
    { pattern: 'clients-seo' },
  ] } } };
  // deploy.sh HORS projet-a : filtré par SON scope.
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/autre/deploy.sh' } })).toEqual([]);
  // deploy.sh DANS projet-a : passe.
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/projet-a/deploy.sh' } })).toEqual([{ doc: 'skill/a' }]);
  // clients-seo : AUCUN scope, passe partout.
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/x/clients-seo/y.md' } })).toEqual([{ doc: 'skill/a' }]);
});

test('skillRules/rules : exclude PAR entrée + entrée invalide ignorée (total, jamais de throw)', () => {
  const config = { skills: { a: { rules: [
    { pattern: 'lock.js', exclude: ['node_modules'] },
    { bogus: true }, null, { pattern: 42 },
  ] } } };
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/p/lock.js' } })).toEqual([{ doc: 'skill/a' }]);
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/p/node_modules/lock.js' } })).toEqual([]);
});

test('skillRules/rules : PRÉCÉDENCE sur match/scope/exclude (déterministe, jamais les deux)', () => {
  const config = { skills: { a: { rules: [{ pattern: 'via-rules' }], match: ['via-match'] } } };
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/via-rules/x.js' } })).toEqual([{ doc: 'skill/a' }]);
  expect(matchingSkills(config, { toolName: 'Read', toolInput: { file_path: 'C:/via-match/x.js' } })).toEqual([]);
});

// ── `enforce` (05/08/2026) : POSÉ tel quel, `false` COMPRIS ──
test('declFor : enforce booléen posé tel quel, `false` conservé (désinscription)', () => {
  // ⚠️ `false` NE DOIT PAS être filtré comme une valeur « vide » : c'est lui qui
  //    permet à un skill de se désinscrire d'un `defaults.skill.enforce: true`.
  //    Sans ce cas, la désinscription serait impossible et personne ne le verrait.
  expect(declFor({ match: ['x'], enforce: true })).toEqual({ enforce: true });
  expect(declFor({ match: ['x'], enforce: false })).toEqual({ enforce: false });
});
test('declFor : enforce NON booléen => clé OMISE (jamais un blocage deviné)', () => {
  for (const v of ['oui', 1, 0, null, [], {}]) {
    expect(declFor({ match: ['x'], enforce: v })).toEqual({});
  }
});
