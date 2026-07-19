// ═══════════════════════════════════════════════════════════════════════
// sources/file.js — tests DÉTERMINISTES (cible Stryker)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CRÉÉ LE 15/07/2026 APRÈS AUDIT DOCTRINE : ce module — le CŒUR du refactor —
//    n'avait AUCUN test unitaire. Sa seule couverture était `file-differential.test.js`
//    (75 min, 2081 spawns) : impossible à lancer par Stryker, donc ZÉRO preuve de
//    qualité des tests sur la logique de match des 546 règles.
//    Un différentiel vert prouve l'ÉQUIVALENCE à l'ancien moteur ; il ne prouve
//    RIEN sur la robustesse des tests. Les deux, jamais l'un à la place de l'autre.
//
// ⚠️ Chaque cas ici verrouille une SÉMANTIQUE de protect-files.js. La modifier
//    sans relancer le différentiel = régression silencieuse sur 546 règles.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { matchingDocs, norm, extractFilePaths, shouldSkip, bashCandidates } from './sources/file.js';

const R = (pattern, doc, extra) => Object.assign({ pattern, doc }, extra || {});
const docs = (rules, toolName, toolInput) => matchingDocs(rules, { toolName, toolInput }).map((d) => d.doc);

// ── norm() : le piège cross-platform ──
test('norm : backslash Windows → slash POSIX', () => {
  assert.strictEqual(norm('C:\\a\\b'), 'c:/a/b');
});
test('norm : minuscules (scope "api-site" doit matcher "API-SITE")', () => {
  assert.strictEqual(norm('API-Site'), 'api-site');
});
test('norm : null/undefined → chaîne vide, jamais un throw', () => {
  assert.strictEqual(norm(null), '');
  assert.strictEqual(norm(undefined), '');
  assert.strictEqual(norm(42), '42');
});

// ── Extraction des chemins ──
test('extractFilePaths : file_path, remotePath, path', () => {
  assert.deepStrictEqual(extractFilePaths('Read', { file_path: 'a', remotePath: 'b', path: 'c' }), ['a', 'b', 'c']);
});
test('extractFilePaths : ignore les params non-string', () => {
  assert.deepStrictEqual(extractFilePaths('Read', { file_path: 42, path: null }), []);
});
test('extractFilePaths : apply_patch (Codex) — chemins DANS le texte du patch', () => {
  // ⚠️ Mort côté Claude, VIVANT côté Codex : c'est la moitié du portage.
  const patch = '*** Update File: a.js\n*** Add File: b.js\n*** Delete File: c.js';
  assert.deepStrictEqual(extractFilePaths('apply_patch', { input: patch }), ['a.js', 'b.js', 'c.js']);
});
test('extractFilePaths : apply_patch accepte `patch` comme `input`', () => {
  assert.deepStrictEqual(extractFilePaths('apply_patch', { patch: '*** Update File: x.js' }), ['x.js']);
});
test('extractFilePaths : apply_patch accepte `command` — shape RÉEL Codex ≥ 0.144 (doc 19/07/2026)', () => {
  // ⚠️ CONTRAT MESURÉ : « Bash and apply_patch use tool_input.command ». Sans ce
  //    fallback, TOUTE écriture Codex passerait sous le radar du parc, en silence.
  assert.deepStrictEqual(extractFilePaths('apply_patch', { command: '*** Update File: y.js' }), ['y.js']);
  // Précédence : input (historique) gagne sur command s'ils coexistent.
  assert.deepStrictEqual(extractFilePaths('apply_patch', { input: '*** Update File: a.js', command: '*** Update File: b.js' }), ['a.js']);
});
test('extractFilePaths : apply_patch ignoré pour les autres outils', () => {
  assert.deepStrictEqual(extractFilePaths('Read', { input: '*** Update File: a.js' }), []);
});

// ── scope / exclude : l'asymétrie VOLONTAIRE ──
test('shouldSkip : exclude matche le CONTEXTE en cours', () => {
  assert.strictEqual(shouldSkip(R('x', 'd', { exclude: ['umami'] }), '/srv/umami/x', {}), true);
  assert.strictEqual(shouldSkip(R('x', 'd', { exclude: ['umami'] }), '/srv/autre/x', {}), false);
});
test('shouldSkip : scope matche TOUS les params concaténés, pas que le chemin', () => {
  // ⚠️ C'est l'asymétrie : un scope peut matcher `connectionId` ou `command`.
  const r = R('x', 'd', { scope: ['vps-prod'] });
  assert.strictEqual(shouldSkip(r, '/etc/x', { connectionId: 'vps-prod', file_path: '/etc/x' }), false);
  assert.strictEqual(shouldSkip(r, '/etc/x', { connectionId: 'vps-dev', file_path: '/etc/x' }), true);
});
test('shouldSkip : scope ABSENT ou VIDE = pas de filtre (jamais un skip silencieux)', () => {
  // ⚠️ Sans le check de longueur, `[].some()` = false → la règle serait SKIPPÉE.
  assert.strictEqual(shouldSkip(R('x', 'd'), '/a/x', {}), false);
  assert.strictEqual(shouldSkip(R('x', 'd', { scope: [] }), '/a/x', {}), false);
});
test('shouldSkip : scope ignore les params non-string', () => {
  assert.strictEqual(shouldSkip(R('x', 'd', { scope: ['abc'] }), '/x', { n: 42, s: 'abc' }), false);
});

// ── Reconstruction Bash ──
test('bashCandidates : `cd /srv && node a.js` → /srv/a.js', () => {
  assert.ok(bashCandidates('cd /srv && node a.js').includes('/srv/node'));
  assert.ok(bashCandidates('cd /srv && node a.js').includes('/srv/a.js'));
});
test('bashCandidates : la commande brute est toujours candidate', () => {
  assert.strictEqual(bashCandidates('cat a.js')[0], 'cat a.js');
});
test('bashCandidates : sans `cd`, aucune reconstruction', () => {
  assert.deepStrictEqual(bashCandidates('ls -la'), ['ls -la']);
});

// ── matchingDocs : le contrat central ──
test('matchingDocs : match simple par sous-chaîne', () => {
  assert.deepStrictEqual(docs([R('a.js', 'docs/a.md')], 'Read', { file_path: '/x/a.js' }), ['docs/a.md']);
});
test('matchingDocs : insensible à la casse ET aux backslashes', () => {
  assert.deepStrictEqual(docs([R('a.js', 'docs/a.md')], 'Read', { file_path: 'C:\\X\\A.JS' }), ['docs/a.md']);
});
test('ORDRE rule-major : l’ordre des RÈGLES gagne, jamais celui des chemins', () => {
  // ⚠️ C'est l'ordre parent→enfant de la concaténation. L'inverser casse le SENS.
  const rules = [R('parent/', 'docs/parent.md'), R('enfant.js', 'docs/enfant.md')];
  assert.deepStrictEqual(docs(rules, 'Read', { file_path: '/parent/enfant.js' }), ['docs/parent.md', 'docs/enfant.md']);
});
test('DÉDUP : la PREMIÈRE règle pointant sur un doc gagne', () => {
  const rules = [R('a.js', 'docs/x.md'), R('/dir/', 'docs/x.md')];
  assert.deepStrictEqual(docs(rules, 'Read', { file_path: '/dir/a.js' }), ['docs/x.md']);
});
test('matchingDocs : les commandes git sont IGNORÉES (faux positif de message de commit)', () => {
  assert.deepStrictEqual(docs([R('a.js', 'docs/a.md')], 'Bash', { command: 'git commit -m "fix a.js"' }), []);
});
test('matchingDocs : git ignoré SEULEMENT pour Bash', () => {
  assert.deepStrictEqual(docs([R('a.js', 'docs/a.md')], 'Read', { file_path: 'git/a.js' }), ['docs/a.md']);
});
test('matchingDocs : Bash + reconstruction cd', () => {
  assert.deepStrictEqual(docs([R('srv/a.js', 'docs/a.md')], 'Bash', { command: 'cd /srv && node a.js' }), ['docs/a.md']);
});
test('TOTALITÉ : rules non-tableau → [], jamais un throw', () => {
  assert.deepStrictEqual(docs(null, 'Read', { file_path: 'a' }), []);
  assert.deepStrictEqual(docs('x', 'Read', { file_path: 'a' }), []);
});
test('TOTALITÉ : payload vide/absent → [], jamais un throw', () => {
  assert.deepStrictEqual(matchingDocs([R('a', 'd')], undefined), []);
  assert.deepStrictEqual(matchingDocs([R('a', 'd')], {}), []);
});
test('TOTALITÉ : règles malformées ignorées', () => {
  assert.deepStrictEqual(docs([null, {}, { pattern: 42 }, { doc: 'd' }], 'Read', { file_path: 'a.js' }), []);
});
test('matchingDocs : une règle sans `doc` string n’est jamais ajoutée', () => {
  assert.deepStrictEqual(docs([R('a.js', 42)], 'Read', { file_path: 'a.js' }), []);
});
test('matchingDocs : exclude retire la règle', () => {
  const rules = [R('compose.yml', 'docs/c.md', { exclude: ['umami'] })];
  assert.deepStrictEqual(docs(rules, 'Read', { file_path: '/srv/umami/compose.yml' }), []);
  assert.deepStrictEqual(docs(rules, 'Read', { file_path: '/srv/blog/compose.yml' }), ['docs/c.md']);
});

// ═══════════════════════════════════════════════════════════════════════
// TUEURS DE MUTANTS — ajoutés le 15/07/2026 après le 1ᵉʳ run Stryker sur ce
// module (85,93% : 19 survivants). Chaque test ci-dessous tue un mutant PRÉCIS,
// c.-à-d. verrouille un cas limite qu'aucun test ne couvrait.
// ⚠️ NE PAS les supprimer en les croyant redondants : sans eux, le code peut
//    être cassé sur ces cas SANS qu'aucun test ne rougisse.
// ═══════════════════════════════════════════════════════════════════════

test('MUTANT L59 — exclude : UNE valeur qui matche suffit (some, jamais every)', () => {
  // ⚠️ `.some` → `.every` : avec 2 excludes dont 1 seul matche, `every` ne skiperait
  //    PAS → la doc serait injectée sur un chemin explicitement exclu.
  const r = R('compose.yml', 'docs/c.md', { exclude: ['umami', 'grafana'] });
  assert.strictEqual(shouldSkip(r, '/srv/umami/compose.yml', {}), true);
});

test('MUTANT L66 — scope : UNE valeur qui matche suffit (some, jamais every)', () => {
  // ⚠️ `.some` → `.every` : la règle ne s'activerait que si TOUS les scopes matchent
  //    → des centaines de docs scopées deviendraient muettes.
  const r = R('.env', 'docs/e.md', { scope: ['vps-prod', '203.0.113.5'] });
  assert.strictEqual(shouldSkip(r, '/etc/.env', { connectionId: 'vps-prod', file_path: '/etc/.env' }), false);
});

test('MUTANT L63 — scope ne regarde QUE les params string (un nombre ne satisfait rien)', () => {
  // ⚠️ Sans le filtre `typeof === 'string'`, un param NUMÉRIQUE serait stringifié
  //    et pourrait satisfaire un scope par accident.
  const r = R('.env', 'docs/e.md', { scope: ['42'] });
  assert.strictEqual(shouldSkip(r, '/etc/.env', { port: 42, file_path: '/etc/.env' }), true);
});

test('MUTANT L64 — les params sont joints par un ESPACE (jamais collés)', () => {
  // ⚠️ `join(' ')` → `join('')` : "ab"+"cd" formerait "abcd" et satisferait un
  //    scope "bc" qui n'existe dans AUCUN param. Faux positif silencieux.
  const r = R('x', 'docs/x.md', { scope: ['bc'] });
  assert.strictEqual(shouldSkip(r, '/x', { a: 'ab', b: 'cd', file_path: '/x' }), true);
});

test('MUTANT L44 — apply_patch sans `input` ni `patch` → aucun chemin, jamais un throw', () => {
  assert.deepStrictEqual(extractFilePaths('apply_patch', {}), []);
});

test('MUTANT L47 — le chemin extrait du patch est TRIMÉ', () => {
  // ⚠️ Sans `.trim()`, "a.js  " ne matcherait pas le pattern "a.js" côté Codex.
  assert.deepStrictEqual(extractFilePaths('apply_patch', { input: '*** Update File:   a.js   ' }), ['a.js']);
});

test('MUTANT L78 — `cd X && cmd` : le SEGMENT APRÈS le && est reconstruit (slice(1))', () => {
  // ⚠️ `.slice(1)` → `.slice()` inclurait "cd /srv" lui-même dans les candidats.
  const c = bashCandidates('cd /srv && node app.js');
  assert.ok(c.includes('/srv/app.js'), 'le fichier après && doit être reconstruit');
  assert.ok(!c.includes('/srv/cd'), 'le `cd` lui-même ne doit pas devenir un candidat');
});

test('MUTANT L78 — les mots après && sont séparés par un ESPACE avant reconstruction', () => {
  const c = bashCandidates('cd /srv && node a.js b.js');
  assert.ok(c.includes('/srv/a.js') && c.includes('/srv/b.js'), 'chaque mot doit devenir un candidat distinct');
});

test('MUTANT — `;` sépare aussi (pas seulement &&)', () => {
  assert.ok(bashCandidates('cd /srv ; cat a.js').includes('/srv/a.js'));
});

test('MUTANT L78 — DEUX séparateurs : les segments sont joints par un ESPACE', () => {
  // ⚠️ `join(' ')` → `join('')` : avec UN seul segment le bug est invisible.
  //    Il faut 2+ segments pour que "a.js"+"ls" collent en "a.jsls".
  const c = bashCandidates('cd /srv && node a.js && ls b.js');
  assert.ok(c.includes('/srv/a.js'), 'a.js doit rester un candidat distinct');
  assert.ok(c.includes('/srv/b.js'), 'b.js doit rester un candidat distinct');
  assert.ok(!c.some((x) => x.includes('a.jsls')), 'segments collés → candidat fantôme');
});

test('MUTANT L79 — afterCd est TRIMÉ (pas de candidat vide « /srv/ »)', () => {
  // ⚠️ Sans `.trim()`, split(/\s+/) rend un '' initial → candidat '/srv/' qui
  //    matcherait un pattern dossier et injecterait une doc à tort.
  assert.ok(!bashCandidates('cd /srv && node a.js').includes('/srv/'), 'candidat vide → faux positif');
});

test('MUTANT L125 — la logique Bash exige toolName==="Bash" ET une commande', () => {
  // ⚠️ `&&` → `||` : un Read portant un param `command` déclencherait la
  //    reconstruction `cd` → docs injectées sur des chemins jamais touchés.
  const rules = [R('srv/a.js', 'docs/a.md')];
  assert.deepStrictEqual(docs(rules, 'Read', { command: 'cd /srv && node a.js' }), [], 'Read ne doit JAMAIS déclencher la logique Bash');
  assert.deepStrictEqual(docs(rules, 'Bash', {}), [], 'Bash sans commande ne doit rien matcher');
  assert.deepStrictEqual(docs(rules, 'Bash', { command: 'cd /srv && node a.js' }), ['docs/a.md']);
});

test('MUTANT L78 — séparateurs COLLÉS : le join(" ") est indispensable', () => {
  // ⚠️ Mon 1ᵉʳ test avait des espaces autour des `&&` → les segments étaient DÉJÀ
  //    espacés → le mutant `join('')` restait invisible. Il faut `&&` collés pour
  //    que "a.js"+"ls" fusionnent en "a.jsls". Leçon : un test doit exercer le cas
  //    où la ligne mutée CHANGE quelque chose, pas juste passer à côté.
  const c = bashCandidates('cd /srv&&node a.js&&ls b.js');
  assert.ok(c.includes('/srv/a.js'), 'a.js doit rester distinct');
  assert.ok(c.includes('/srv/b.js'), 'b.js doit rester distinct');
  assert.ok(!c.some((x) => x.includes('a.jsls')), 'segments collés → candidat fantôme');
});

test('MUTANT L127 — la branche BASH applique aussi exclude/scope', () => {
  // ⚠️ Tous mes tests exclude passaient par `Read` : la branche Bash n'était pas
  //    couverte → `&&` → `||` y survivait, donc un exclude aurait pu être IGNORÉ
  //    sur une commande Bash sans qu'aucun test ne rougisse.
  const rules = [R('compose.yml', 'docs/c.md', { exclude: ['umami'] })];
  assert.deepStrictEqual(docs(rules, 'Bash', { command: 'cat /srv/umami/compose.yml' }), [], 'exclude ignoré en Bash');
  assert.deepStrictEqual(docs(rules, 'Bash', { command: 'cat /srv/blog/compose.yml' }), ['docs/c.md']);
});

test('MUTANT L127 — la branche BASH exige que le pattern matche VRAIMENT', () => {
  // ⚠️ `&&` → `true` : n'importe quelle commande injecterait n'importe quelle doc.
  assert.deepStrictEqual(docs([R('zzz-absent.js', 'docs/z.md')], 'Bash', { command: 'ls -la' }), []);
});

test('MUTANT L127 — la branche BASH applique aussi scope', () => {
  const rules = [R('.env', 'docs/e.md', { scope: ['vps-prod'] })];
  assert.deepStrictEqual(docs(rules, 'Bash', { command: 'cat /etc/.env' }), [], 'scope ignoré en Bash');
  assert.deepStrictEqual(docs(rules, 'Bash', { command: 'cat /srv/vps-prod/.env' }), ['docs/e.md']);
});

test('MUTANT L102 — un `command` NON-STRING ne doit jamais être traité comme une commande', () => {
  // ⚠️ `typeof === 'string' ? c : ''` → `true ? c : ''` : un command numérique
  //    arriverait dans bashCandidates → `42.match(...)` → TypeError → hook mort
  //    → PLUS AUCUNE doc injectée. Totalité obligatoire.
  const rules = [R('a.js', 'docs/a.md')];
  assert.deepStrictEqual(docs(rules, 'Bash', { command: 42 }), []);
  assert.deepStrictEqual(docs(rules, 'Bash', { command: null }), []);
  assert.deepStrictEqual(docs(rules, 'Bash', { command: { a: 1 } }), []);
});

test('MUTANT L103 — le skip `git` ne vaut QUE pour Bash', () => {
  // ⚠️ `toolName === 'Bash' && /git/` → `true && /git/` : un outil NON-Bash portant
  //    un param `command` git verrait TOUTES ses docs supprimées.
  const rules = [R('a.js', 'docs/a.md')];
  assert.deepStrictEqual(docs(rules, 'Read', { file_path: '/x/a.js', command: 'git status' }), ['docs/a.md'], 'un Read ne doit pas subir le skip git');
  assert.deepStrictEqual(docs(rules, 'Bash', { command: 'git commit -m "a.js"' }), [], 'Bash + git = skip');
});

test('MUTANT L102 — le fallback command est VIDE, jamais un littéral', () => {
  // ⚠️ `: ''` muté en `: "Stryker was here!"` (survivant réel 16/07/2026) :
  //    un `command` non-string deviendrait une chaîne MATCHABLE — toute règle dont
  //    le pattern est contenu dans le littéral du mutant injecterait sa doc sur un
  //    payload SANS commande. Le pattern du test vise exprès le littéral de Stryker.
  const rules = [R('was here', 'docs/piege.md')];
  assert.deepStrictEqual(docs(rules, 'Bash', { command: 42 }), []);
});

// ── cwd (18/07/2026) : chemin candidat — posé par la source skill UNIQUEMENT ──
test('extractFilePaths : toolInput.cwd = chemin candidat SI chaîne, ignoré sinon', () => {
  const rules = [{ pattern: 'mon-projet', doc: 'docs/p.md' }];
  // cwd chaîne qui contient le pattern → matche.
  assert.deepStrictEqual(
    matchingDocs(rules, { toolName: 'Bash', toolInput: { command: 'npm test', cwd: 'C:/dev/mon-projet' } }),
    [{ doc: 'docs/p.md' }]
  );
  // cwd NON-chaîne → jamais poussé (le typeof de extractFilePaths est la seule autorité).
  assert.deepStrictEqual(
    matchingDocs(rules, { toolName: 'Bash', toolInput: { command: 'npm test', cwd: 42 } }),
    []
  );
});
