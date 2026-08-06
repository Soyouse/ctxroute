// ═══════════════════════════════════════════════════════════════════════
// frontmatter.js — tests DÉTERMINISTES (cible Stryker)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CRÉÉ LE 15/07/2026 APRÈS AUDIT DOCTRINE : ce module n'avait QUE des
//    property-tests. Or Stryker ne lance PAS les properties (unit only) →
//    100% de ses mutants auraient survécu, score muet sur le parser qui décide
//    si 292 docs sont vivantes ou mortes.
//    Le property test cherche l'INCONNU ; le cas déterministe verrouille le CONNU.
//    Les deux, jamais l'un à la place de l'autre.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { parse, validate, validateMcp, isMatchDecl, toolList, MODES, DRIFT_UNITS, KNOWN, DECLENCHEURS, WILDCARD } from './frontmatter.js';

// ── parse : détection du bloc ──
test('parse : frontmatter en tête → data + body séparés', () => {
  const r = parse('---\nmatch: a.js\n---\ncorps');
  assert.deepStrictEqual(r.data, { match: 'a.js' });
  assert.strictEqual(r.body, 'corps');
  assert.strictEqual(r.hasFrontmatter, true);
});
test('parse : sans frontmatter → body INTÉGRAL, jamais tronqué', () => {
  const r = parse('# doc\ntexte');
  assert.strictEqual(r.body, '# doc\ntexte');
  assert.strictEqual(r.hasFrontmatter, false);
  assert.deepStrictEqual(r.data, {});
});
test('parse : CRLF (Windows) supporté', () => {
  // ⚠️ Sans ça, 100% des docs éditées sous Windows seraient sans frontmatter.
  assert.strictEqual(parse('---\r\nmatch: a.js\r\n---\r\ncorps').data.match, 'a.js');
});
test('parse : BOM UTF-8 supporté', () => {
  assert.strictEqual(parse('﻿---\nmatch: a.js\n---\nc').data.match, 'a.js');
});
test('parse : `---` PAS en tête → pas un frontmatter', () => {
  const r = parse('texte\n---\nmatch: a.js\n---\n');
  assert.strictEqual(r.hasFrontmatter, false);
});
test('parse : non-string → totalité (jamais un throw)', () => {
  for (const v of [null, undefined, 42, {}, []]) {
    const r = parse(v);
    assert.strictEqual(r.hasFrontmatter, false);
    assert.strictEqual(r.body, '');
  }
});

// ── parse : scalaires ──
test('parse : booléens', () => {
  // ⚠️ Portait sur `confirm` jusqu'au 05/08/2026 (retiré). `enforce` est le
  //    booléen du vocabulaire — le parser DOIT rendre un vrai booléen, pas la
  //    chaîne "true" : une valeur non booléenne est REFUSÉE par validate().
  assert.strictEqual(parse('---\nenforce: true\n---\n').data.enforce, true);
  assert.strictEqual(parse('---\nenforce: false\n---\n').data.enforce, false);
});
test('parse : nombres — SEULEMENT si toute la chaîne est un nombre', () => {
  // ⚠️ Number() seul accepterait trop : "12-factor" deviendrait 12.
  assert.strictEqual(parse('---\nrank: 42\n---\n').data.rank, 42);
  assert.strictEqual(parse('---\nrank: -3\n---\n').data.rank, -3);
  assert.strictEqual(parse('---\nrank: 1.5\n---\n').data.rank, 1.5);
  assert.strictEqual(parse('---\nmatch: 12-factor\n---\n').data.match, '12-factor');
});
test('parse : guillemets retirés seulement s’ils enveloppent TOUT', () => {
  assert.strictEqual(parse('---\nmatch: "a.js"\n---\n').data.match, 'a.js');
  assert.strictEqual(parse("---\nmatch: 'a.js'\n---\n").data.match, 'a.js');
});
test('parse : listes inline [a, b]', () => {
  assert.deepStrictEqual(parse('---\nscope: [a, b]\n---\n').data.scope, ['a', 'b']);
  assert.deepStrictEqual(parse('---\nscope: []\n---\n').data.scope, []);
});
test('parse : commentaires et lignes vides ignorés', () => {
  assert.deepStrictEqual(parse('---\n# note\n\nmatch: a.js\n---\n').data, { match: 'a.js' });
});
test('parse : ligne non conforme IGNORÉE, jamais un throw (totalité)', () => {
  assert.deepStrictEqual(parse('---\nn importe quoi\nmatch: a.js\n---\n').data, { match: 'a.js' });
});

// ── validate : LE gate ──
test('validate : déclaration minimale valide', () => {
  assert.deepStrictEqual(validate({ match: 'a.js' }), []);
});
test('validate : `match` manquant/vide/mal typé → ERREUR (jamais une doc muette)', () => {
  for (const bad of [undefined, '', '   ', 42, [], [42], ['']]) {
    assert.ok(validate({ match: bad }).length > 0, `match invalide accepté : ${JSON.stringify(bad)}`);
  }
});
test('validate : `match` accepte chaîne OU liste (98 des 292 docs sont multi-patterns)', () => {
  assert.deepStrictEqual(validate({ match: 'a.js' }), []);
  assert.deepStrictEqual(validate({ match: ['a.js', 'b.js'] }), []);
});
test('validate : scope/exclude doivent être des listes', () => {
  assert.ok(validate({ match: 'a', scope: 'x' }).length > 0);
  assert.ok(validate({ match: 'a', exclude: 'x' }).length > 0);
  assert.deepStrictEqual(validate({ match: 'a', scope: ['x'], exclude: ['y'] }), []);
});
test('validate : mode limité à dumb|once|smart', () => {
  // ⚠️ Valeurs EN DUR, jamais `for (const m of MODES)` : un test qui dérive son
  //    attendu de la valeur qu'il vérifie MUTE AVEC ELLE → mutant survivant
  //    (vécu le 15/07/2026 : muter 'once' → "" passait inaperçu).
  //    `mode` est un CONTRAT public (frontmatter des docs), pas un détail interne.
  assert.deepStrictEqual(validate({ match: 'a', mode: 'dumb' }), []);
  assert.deepStrictEqual(validate({ match: 'a', mode: 'once' }), []);
  assert.deepStrictEqual(validate({ match: 'a', mode: 'smart' }), []);
  assert.ok(validate({ match: 'a', mode: 'turbo' }).length > 0);
  assert.ok(validate({ match: 'a', mode: '' }).length > 0);
  assert.deepStrictEqual(MODES, ['dumb', 'once', 'smart'], 'le contrat des modes a changé');
});
test('validate : rank numérique', () => {
  assert.ok(validate({ match: 'a', rank: '3' }).length > 0);
  assert.deepStrictEqual(validate({ match: 'a', rank: 0 }), []);
});
test('validate : clé INCONNUE rejetée (typo `mach:` = doc morte en silence)', () => {
  assert.ok(validate({ match: 'a', mach: 'b' }).length > 0);
  assert.ok(validate({ match: 'a', Match: 'b' }).length > 0);
});
// ⚠️ PAS de test « toutes les clés connues ensemble » : c'est devenu IMPOSSIBLE
//    par conception — `inject: never` EXCLUT tout déclencheur. Un tel test
//    exigerait d'accepter une contradiction. Les 2 familles se testent séparément.
test('validate : toutes les clés COMPATIBLES acceptées ensemble', () => {
  // ⚠️ `mcp` RETIRÉ de ce cas le 31/07/2026 : il n'est plus un déclencheur du
  //    corpus fichier (§A) — l'y laisser reviendrait à re-certifier le faux vert.
  assert.deepStrictEqual(validate({ match: 'a', scope: ['s'], exclude: ['e'], mode: 'dumb', rank: 1, threshold: 3 }), []);
  // ⚠️ Contrat écrit EN DUR — ne JAMAIS le dériver de KNOWN (il muterait avec le code).
  // ⚠️ `note` AJOUTÉE le 04/08/2026 — commentaire d'auteur, JAMAIS lue par le moteur.
  // ⚠️ MISE À JOUR DÉLIBÉRÉE (05/08/2026) : `enforce` ajouté. Ce test a rougi
  //    en premier — c'est son rôle : le vocabulaire ne s'étend jamais par
  //    accident. Ajouter une clé DOIT coûter une décision explicite ici.
  assert.deepStrictEqual(KNOWN, ['match', 'mcp', 'rules', 'tool', 'inject', 'scope', 'exclude', 'mode', 'rank', 'threshold', 'driftUnit', 'note', 'enforce']);
  // ⚠️ Contrat EN DUR aussi pour DRIFT_UNITS (source unique du vocabulaire d'unité).
  assert.deepStrictEqual(DRIFT_UNITS, ['tool', 'turn']);
  // ⚠️ Contrat EN DUR des DÉCLENCHEURS (4 depuis 19/07/2026 : + `tool`).
  assert.deepStrictEqual(DECLENCHEURS, ['match', 'rules', 'tool']);
});

test('validate : `tool` SEUL = déclencheur suffisant ; vide/mal typé = ROUGE', () => {
  assert.deepStrictEqual(validate({ tool: 'WebFetch', mode: 'dumb' }), []);
  assert.deepStrictEqual(validate({ tool: ['WebFetch', 'WebSearch'], mode: 'dumb' }), []);
  assert.ok(validate({ tool: '', mode: 'dumb' }).length > 0);
  assert.ok(validate({ tool: [], mode: 'dumb' }).length > 0);
});

// ── `rules:` — JSON par-entrée (31/103 docs à scopes divergents, mesuré 16/07) ──
test('parse : `rules:` JSON inline → objets relus tels quels', () => {
  const d = parse('---\nrules: [{"pattern":"a.js","scope":["s"]},{"pattern":"b.js"}]\n---\nc').data;
  assert.deepStrictEqual(d.rules, [{ pattern: 'a.js', scope: ['s'] }, { pattern: 'b.js' }]);
});
test('parse : `rules:` JSON CASSÉ → valeur brute, jamais un throw (totalité)', () => {
  const d = parse('---\nrules: [{oups\n---\nc').data;
  assert.strictEqual(typeof d.rules, 'string');
  assert.ok(validate(d).length > 0, 'un rules illisible DOIT être rouge, pas silencieux');
});
test('validate : `rules` valide SEUL = déclencheur suffisant (0 erreur)', () => {
  assert.deepStrictEqual(validate({ rules: [{ pattern: 'a.js' }] }), []);
});
test('validate : `rules` + `match`/`scope`/`exclude` = CONTRADICTION', () => {
  for (const extra of [{ match: 'a.js' }, { scope: ['s'] }, { exclude: ['e'] }]) {
    assert.ok(validate({ rules: [{ pattern: 'a.js' }], ...extra }).length > 0, JSON.stringify(extra));
  }
});
test('validate : entrée `rules` sans pattern, clé inconnue, ou scope non-liste = ROUGE', () => {
  assert.ok(validate({ rules: [{}] }).length > 0, 'pattern manquant');
  assert.ok(validate({ rules: [{ pattern: '  ' }] }).length > 0, 'pattern vide');
  assert.ok(validate({ rules: [{ pattern: 'a.js', patern: 'b' }] }).length > 0, 'clé inconnue (typo patern)');
  assert.ok(validate({ rules: [{ pattern: 'a.js', scope: 'oups' }] }).length > 0, 'scope non-liste');
  assert.ok(validate({ rules: [{ pattern: 'a.js', exclude: [''] }] }).length > 0, 'exclude avec chaîne vide');
  assert.ok(validate({ rules: ['a.js'] }).length > 0, 'entrée non-objet');
  assert.ok(validate({ rules: [] }).length > 0, 'liste vide = doc morte');
});
test('validate : `rules` avec scope/exclude VALIDES = 0 erreur (jamais de faux rouge)', () => {
  // ⚠️ Tue les mutants qui rendraient la validation toujours-rouge : 31 docs
  //    réelles partent en `rules:` — un faux rouge les bloquerait TOUTES au gate.
  assert.deepStrictEqual(validate({ rules: [{ pattern: 'a.js', scope: ['s'], exclude: ['e'] }] }), []);
});
// ── Piège n°1 (vécu 19/07) : `rules:` écrit en YAML-BLOC au lieu du JSON inline ──
// ⚠️ Le message d'erreur DOIT être AUTO-RÉPARANT : il donne le snippet exact à coller.
//    Ce test scelle que (a) le YAML-bloc est rouge, (b) le snippet MONTRÉ est valide —
//    sinon on renverrait un exemple faux, pire que pas d'exemple.
test('validate : `rules:` en YAML-bloc = ROUGE + message donne le format canonique', () => {
  // parse() rend un tableau d'objets pour le YAML-bloc `- pattern:` → forme {pattern} sans les autres clés.
  // Le piège réel = l'utilisateur écrit une CHAÎNE ou une forme non conforme ; ici on teste la forme non-liste.
  const errs = validate({ rules: 'foo' }); // chaîne au lieu de liste (résultat d'un JSON cassé, cf parse total)
  assert.ok(errs.length > 0, 'un rules non-liste DOIT être rouge');
  assert.ok(errs.some((e) => /rules: \[\{/.test(e)), 'le message DOIT contenir le snippet canonique prêt à coller');
  // Le snippet montré dans le message est LUI-MÊME valide (jamais un faux exemple) :
  const canonique = [{ pattern: 'foo.js' }, { pattern: 'bar.js', scope: ['projet'] }];
  assert.deepStrictEqual(validate({ rules: canonique }), []);
});
test('validate : liste MIXTE (un valide + un invalide) = ROUGE (every, jamais some)', () => {
  assert.ok(validate({ rules: [{ pattern: 'a.js', scope: ['ok', ''] }] }).length > 0, 'scope [ok, ""]');
  assert.ok(validate({ rules: [{ pattern: 'a.js', scope: ['ok', 42] }] }).length > 0, 'scope [ok, 42]');
  assert.ok(validate({ rules: [{ pattern: 'a.js', exclude: ['ok', '  '] }] }).length > 0, 'exclude [ok, blank]');
});
test('validate : `rules[].rank` nombre = valide, non-nombre = ROUGE', () => {
  assert.deepStrictEqual(validate({ rules: [{ pattern: 'a.js', rank: 5 }] }), []);
  assert.ok(validate({ rules: [{ pattern: 'a.js', rank: '5' }] }).length > 0);
});
test('validate : `inject: never` + `rules` = CONTRADICTION', () => {
  assert.ok(validate({ inject: 'never', rules: [{ pattern: 'a.js' }] }).length > 0);
});

// ── `inject: never` — le silence déclaré (14 docs muettes mesurées le 15/07) ──
test('validate : `inject: never` SEUL = valide (doc de référence, on-demand)', () => {
  assert.deepStrictEqual(validate({ inject: 'never' }), []);
  assert.deepStrictEqual(validate({ inject: 'never', mode: 'dumb' }), []);
});
test('validate : `inject: never` + déclencheur = CONTRADICTION (jamais une précédence devinée)', () => {
  assert.ok(validate({ inject: 'never', match: 'a.js' }).length > 0);
  assert.ok(validate({ inject: 'never', mcp: 'stripe' }).length > 0);
});
// ⚠️ TEST FAIBLE CORRIGÉ (mutant survivant en CI, 15/07/2026) : la 1ʳᵉ version
//    faisait `validate({ inject: v })` SANS déclencheur — elle passait grâce à
//    l'erreur « aucun déclencheur », JAMAIS grâce au check d'`inject`, qui
//    n'était donc jamais exercé. Il FAUT un `match` valide pour isoler le check.
//    Leçon : un test vert qui passe pour la mauvaise raison ne teste rien.
test('validate : `inject` n\'accepte QUE "never" (pas de 2e façon de dire match:)', () => {
  for (const v of ['always', 'auto', 'Never', true, 1, '', 0]) {
    const errs = validate({ match: 'a.js', inject: v });
    assert.ok(errs.length > 0, `inject: ${JSON.stringify(v)} devrait être rejeté`);
    assert.ok(errs.some((e) => e.includes('inject')), `l'erreur doit viser \`inject\`, pas autre chose : ${errs}`);
  }
});

// ── Déclencheurs du corpus FICHIER : `match` / `rules` / `tool` ──
// ⚠️ RÉÉCRIT le 31/07/2026 (§A). Ces tests certifiaient qu'une doc FICHIER
//    portant `mcp:` est VALIDE — c'était le FAUX VERT lui-même, gravé dans la
//    suite : validate() rendait 0 erreur et la doc était MUETTE (aucune source
//    ne consomme cette clé pour ce corpus ; le canal MCP se déclenche par le
//    CHEMIN docs/mcp/{serveur}.md et se valide par validateMcp).
//    ⚠️ Un test qui certifie du mort est PIRE qu'une absence de test : il
//    transforme le bug en contrat, et le prochain agent le défend.
test('§A : `mcp:` dans une doc FICHIER = ROUGE (avant : 0 erreur, doc muette)', () => {
  assert.ok(validate({ mcp: 'stripe' }).length > 0);
  assert.ok(validate({ mcp: ['stripe', 'odoo'] }).length > 0);
  // Même avec un déclencheur VALIDE à côté : la clé inerte reste une erreur —
  // l'auteur croirait sinon avoir branché deux canaux, il n'en a qu'un.
  assert.ok(validate({ match: 'ssh-helper.js', mcp: ['ssh'] }).length > 0);
});
test('§A : le message dit OÙ la doc aurait dû aller (paved road, pas juste un refus)', () => {
  const texte = validate({ mcp: 'stripe' }).join(' | ');
  assert.ok(/CHEMIN/.test(texte));
  assert.ok(/docs\/mcp\//.test(texte));
});
test('validate : une doc FICHIER seule reste valide', () => {
  assert.deepStrictEqual(validate({ match: 'lock.js' }), []);
});
test('validate : ZÉRO déclencheur = ROUGE (doc morte en silence = le bug qu\'on tue)', () => {
  assert.ok(validate({}).length > 0);
  assert.ok(validate({ mode: 'dumb' }).length > 0);
});
test('validate : un déclencheur PRÉSENT mais vide/mal typé = ROUGE', () => {
  assert.ok(validate({ match: '' }).length > 0);
  assert.ok(validate({ match: [] }).length > 0);
  assert.ok(validate({ match: 42 }).length > 0);
  assert.ok(validate({ match: [''] }).length > 0);
  assert.ok(validate({ tool: '' }).length > 0);
  assert.ok(validate({ match: 'a', tool: [''] }).length > 0);
});

// ── isMatchDecl ──
test('isMatchDecl : contrat exact', () => {
  assert.strictEqual(isMatchDecl('a.js'), true);
  assert.strictEqual(isMatchDecl(['a.js']), true);
  assert.strictEqual(isMatchDecl(''), false);
  assert.strictEqual(isMatchDecl('  '), false);
  assert.strictEqual(isMatchDecl([]), false);
  assert.strictEqual(isMatchDecl(['a', '']), false);
  assert.strictEqual(isMatchDecl([42]), false);
  assert.strictEqual(isMatchDecl(null), false);
});

// ═══════════════════════════════════════════════════════════════════════
// TUEURS DE MUTANTS (Stryker, 15/07/2026 — 91,30%, 12 survivants)
// ⚠️ Les survivants restants sont les LIBELLÉS des messages d'erreur : muter le
//    texte ne change AUCUN comportement (`validate` rend une liste non vide dans
//    les deux cas). Coupler un test au libellé exact serait de la fragilité pure
//    — mutants ÉQUIVALENTS assumés, cf `_survivor_connu` dans stryker.conf.json.
// ═══════════════════════════════════════════════════════════════════════

test('MUTANT L68 — une ligne VIDE est ignorée (pas traitée comme une clé)', () => {
  assert.deepStrictEqual(parse('---\n\nmatch: a.js\n\n---\n').data, { match: 'a.js' });
});

test('MUTANT L68 — un COMMENTAIRE est ignoré, même s’il ressemble à une clé', () => {
  // ⚠️ `||` → `&&` : un commentaire `# match: piege` serait alors PARSÉ comme clé.
  assert.deepStrictEqual(parse('---\n# match: piege\nmatch: vrai.js\n---\n').data, { match: 'vrai.js' });
});

test('MUTANT L68 — une ligne d’espaces seuls est ignorée (trim, pas la ligne brute)', () => {
  assert.deepStrictEqual(parse('---\n   \nmatch: a.js\n---\n').data, { match: 'a.js' });
});

test('MUTANT L96 — match liste : TOUS les éléments doivent être des chaînes non vides', () => {
  // ⚠️ `.every` → `.some` : ['a.js', 42] passerait → un pattern numérique invisible.
  assert.strictEqual(isMatchDecl(['a.js', 42]), false);
  assert.strictEqual(isMatchDecl(['a.js', '']), false);
  assert.strictEqual(isMatchDecl(['a.js', '   ']), false);
  assert.strictEqual(isMatchDecl(['a.js', 'b.js']), true);
});

// ── `threshold` (17/07/2026) : seuil smart PAR DOC, entier >= 1 ──
test('threshold entier >= 1 = valide (clé CONNUE, jamais « inconnue »), borne 1 INCLUSE', () => {
  assert.deepStrictEqual(validate({ match: 'x.js', threshold: 2 }), []);
  assert.deepStrictEqual(validate({ match: 'x.js', threshold: 1 }), []);
});

// ── `driftUnit` (18/07/2026) : unité du compteur smart, tool|turn ──
test('driftUnit tool/turn = valide (clé CONNUE) ; autre valeur = ROUGE', () => {
  assert.deepStrictEqual(validate({ match: 'x.js', driftUnit: 'tool' }), []);
  assert.deepStrictEqual(validate({ match: 'x.js', driftUnit: 'turn' }), []);
  assert.ok(validate({ match: 'x.js', driftUnit: 'message' }).length > 0);
  assert.ok(validate({ match: 'x.js', driftUnit: 42 }).length > 0);
});

test('threshold invalide = ROUGE : 0, float, string', () => {
  assert.ok(validate({ match: 'x.js', threshold: 0 }).length > 0);
  assert.ok(validate({ match: 'x.js', threshold: 2.5 }).length > 0);
  assert.ok(validate({ match: 'x.js', threshold: '3' }).length > 0);
});

// ── validateMcp — SEULE autorité « doc MCP saine ? » (clés mode/threshold) ──
test('validateMcp : frontmatter vide ou mode/threshold valides = 0 erreur (borne 1 incluse)', () => {
  assert.deepStrictEqual(validateMcp({}), []);
  assert.deepStrictEqual(validateMcp({ mode: 'dumb' }), []);
  assert.deepStrictEqual(validateMcp({ mode: 'smart', threshold: 1 }), []);
});

test('validateMcp : clé hors mode/threshold = ROUGE (match/mach/rules interdits sur doc MCP)', () => {
  assert.ok(validateMcp({ match: 'x.js' }).length > 0);
  assert.ok(validateMcp({ mod: 'dumb' }).length > 0);
});

test('validateMcp : driftUnit tool/turn admis, autre valeur = ROUGE', () => {
  assert.deepStrictEqual(validateMcp({ mode: 'smart', driftUnit: 'turn' }), []);
  assert.deepStrictEqual(validateMcp({ driftUnit: 'tool' }), []);
  assert.ok(validateMcp({ driftUnit: 'message' }).length > 0);
});

test('validateMcp : mode inconnu et threshold 0/float/string = ROUGE', () => {
  assert.ok(validateMcp({ mode: 'weekly' }).length > 0);
  assert.ok(validateMcp({ threshold: 0 }).length > 0);
  assert.ok(validateMcp({ threshold: 2.5 }).length > 0);
  assert.ok(validateMcp({ threshold: '3' }).length > 0);
});

// ── JOKER `*` de l'axe outil (31/07/2026, §B) ──
test('§B : `tool: ["*"]` avec un filtre = VALIDE (le geste devient exprimable)', () => {
  assert.deepStrictEqual(validate({ tool: ['*'], scope: ['docker run'], mode: 'dumb' }), []);
  assert.deepStrictEqual(validate({ tool: ['*'], exclude: ['Read'] }), []);
});

test('§B : `tool: ["*"]` NU = ROUGE (il s\'injecterait à CHAQUE appel d\'outil)', () => {
  // ⚠️ AVANT le 31/07 : accepté ET inerte — le seul état inacceptable. Désormais
  //    le joker est soit vivant (avec filtre), soit refusé, jamais toléré muet.
  const errs = validate({ tool: ['*'], mode: 'dumb' });
  assert.ok(errs.length > 0);
  assert.ok(/scope/.test(errs.join(' ')), 'le message doit dire comment réparer');
  // ⚠️ Un scope/exclude VIDE ou mal typé ne compte PAS pour un filtre — sinon
  //    `exclude: []` rouvrirait la porte au joker nu, en silence.
  assert.ok(validate({ tool: ['*'], scope: [] }).length > 0);
  assert.ok(validate({ tool: ['*'], exclude: [] }).length > 0);
  assert.ok(validate({ tool: '*' }).length > 0, 'forme chaîne couverte aussi');
});

test('§B : le joker ne contamine PAS les déclarations sans `*`', () => {
  assert.deepStrictEqual(validate({ tool: ['Bash'], mode: 'dumb' }), [],
    'une énumération sans joker n\'a jamais eu besoin de filtre');
});

test('§B : WILDCARD est un CONTRAT (valeur en dur, jamais dérivée du code)', () => {
  assert.strictEqual(WILDCARD, '*');
});

test('toolList : lecture de `tool:` — chaîne, liste, absent, mal typé', () => {
  // ⚠️ IMPORT DIRECT depuis frontmatter.js, JAMAIS via le ré-export de
  //    sources/tool.js : le mapping coverage perTest de Stryker RATE les tests
  //    passés par un re-export (piège documenté dans ce repo, revécu ici — le
  //    mutant `[] -> ["Stryker was here"]` a survécu tant que ce test n'existait
  //    qu'en aval). Un module muté se teste en direct, point.
  assert.deepStrictEqual(toolList({ tool: 'WebFetch' }), ['WebFetch']);
  assert.deepStrictEqual(toolList({ tool: ['A', 'B'] }), ['A', 'B']);
  assert.deepStrictEqual(toolList({}), []);
  assert.deepStrictEqual(toolList({ tool: 42 }), []);
  assert.deepStrictEqual(toolList({ tool: null }), []);
});

// ═══════════════════════════════════════════════════════════════════════
// `note` — commentaire d'auteur, INVISIBLE à l'agent qui agit (04/08/2026)
// ═══════════════════════════════════════════════════════════════════════
test('note : admise dans une doc FICHIER, texte ou liste de textes', () => {
  assert.deepStrictEqual(validate({ match: 'x.js', note: 'dumb car garde-fou' }), []);
  assert.deepStrictEqual(validate({ match: 'x.js', note: ['a', 'b'] }), []);
});

test('note : admise dans une doc MCP (parité de vocabulaire)', () => {
  assert.deepStrictEqual(validateMcp({ mode: 'dumb', note: 'paiement reel' }), []);
});

test('note : FORME validée, jamais le contenu (valider le sens en ferait de la config)', () => {
  assert.strictEqual(validate({ match: 'x.js', note: 42 }).length, 1);
  assert.strictEqual(validate({ match: 'x.js', note: ['ok', 7] }).length, 1);
  assert.strictEqual(validateMcp({ note: {} }).length, 1);
});

// ⚠️ LE CAS QUI PORTE TOUTE LA FEATURE. Si la note atteignait le corps injecté,
//    elle deviendrait du bruit réinjecté à chaque geste — l'inverse exact du but.
//    Elle est invisible PAR CONSTRUCTION (parse() retire tout le frontmatter),
//    mais « par construction » sans test = une promesse. Ici, c'est un contrat.
test('note : N\'ATTEINT JAMAIS le corps injecté', () => {
  const r = parse('---\nmatch: x.js\nnote: SECRET_DE_REGLAGE\n---\ncorps visible\n');
  assert.strictEqual(r.data.note, 'SECRET_DE_REGLAGE');
  assert.strictEqual(r.body.includes('SECRET_DE_REGLAGE'), false);
  assert.strictEqual(r.body.includes('note'), false);
  assert.strictEqual(r.body.trim(), 'corps visible');
});

// ⚠️ PIÈGE CONNU, FIGÉ PAR CE TEST — pas encore scellé (04/08/2026).
//    Un bloc YAML `|` rend la valeur « | » et PERD les lignes suivantes en
//    silence. Trouvé par simulation adversariale.
// 🛑 UNE GARDE A ÉTÉ TENTÉE DANS `validate()` PUIS RETIRÉE LE MÊME JOUR — ne pas
//    la refaire telle quelle. La CI (property-test ROUND-TRIP de `migrate`) l'a
//    mise en ROUGE en quelques minutes : elle rejetait `match: "|"`, un pattern
//    LÉGITIME. À cette couche, `cle: |` (bloc) et `cle: "|"` (pipe littéral) sont
//    INDISTINGUABLES — les deux valent la chaîne « | ». Une garde incapable de
//    distinguer interdit du sain, et une garde qui interdit du sain finit
//    débranchée. Le fix correct vit dans `parse()`, seul endroit qui voit le
//    TEXTE (valeur `|` ET ligne suivante indentée). Inscrit au REFACTOR-PLAN.
// ✅ PIÈGE FERMÉ LE 06/08/2026 — ce test figeait la PERTE comme comportement
//    connu ; il figera désormais la CONSERVATION. Il n'est pas supprimé : c'est
//    le témoin de la régression, et il doit rougir si quelqu'un revient en
//    arrière. Le fix a été posé dans `parse()` (la couche qui voit la ligne
//    suivante), exactement là où le commentaire ci-dessus l'avait prédit.
test('bloc YAML `|` : les lignes indentées sont CONSERVÉES (ex-piège, fermé)', () => {
  const { data } = parse('---\nmatch: x.js\nnote: |\n  perdue un\n  perdue deux\n---\ncorps\n');
  assert.strictEqual(data.note, 'perdue un\nperdue deux');
  assert.strictEqual(JSON.stringify(data).includes('perdue'), true, 'plus AUCUNE ligne perdue');
  assert.deepStrictEqual(validate(data), []);
  // ⚠️ `match: "|"` DOIT rester valide : c'est ce que la garde retirée cassait.
  assert.deepStrictEqual(validate({ match: '|' }), []);
  assert.deepStrictEqual(validateMcp({ mode: 'dumb', note: '|' }), []);
  // La forme SÛRE, à préférer toujours :
  assert.deepStrictEqual(validate({ match: 'x.js', note: ['ligne un', 'ligne deux'] }), []);
});

test('`enforce` non booléen = REJETÉ (jamais interprété comme un oui)', () => {
  const errs = validate({ match: 'x', enforce: 'oui' });
  assert.ok(errs.some((e) => e.includes('`enforce` doit être true ou false')), JSON.stringify(errs));
  assert.deepStrictEqual(validate({ match: 'x', enforce: true, mode: 'once' }), []);
  assert.deepStrictEqual(validate({ match: 'x', enforce: false }), []);
});

test('`enforce` est admis AUSSI dans une doc MCP (même vocabulaire partout)', () => {
  assert.deepStrictEqual(validateMcp({ mode: 'once', enforce: true }), []);
  assert.ok(validateMcp({ enforce: 3 }).some((e) => e.includes('`enforce`')));
});

// ═══════════════════════════════════════════════════════════════════════
// VOCABULAIRE PAR CORPUS — gate de SYMÉTRIE (05/08/2026).
// ⚠️ Fige QUELLE clé vit dans QUEL corpus. Toute divergence future devient une
//    DÉCISION explicite (ce test rougit) au lieu d'un écart qui s'installe.
//    Né d'une vraie question : « tout est-il symétrique ? » — la réponse était
//    NON pour `confirm`, et personne ne l'avait écrit nulle part. Depuis son
//    retrait, la réponse est OUI, et ce gate est ce qui la maintient vraie.
// ═══════════════════════════════════════════════════════════════════════
test('SYMÉTRIE : la cadence est IDENTIQUE dans les 2 corpus de docs', () => {
  // Ces 5 clés ont le MÊME sens partout ⇒ elles DOIVENT être partout.
  for (const k of ['mode', 'threshold', 'driftUnit', 'note', 'enforce']) {
    assert.ok(KNOWN.includes(k), `\`${k}\` absent des docs fichier`);
  }
  assert.deepStrictEqual(validateMcp({ mode: 'once', threshold: 2, driftUnit: 'turn', note: 'x', enforce: true }), [],
    'une doc MCP doit accepter TOUTE la cadence, enforce compris');
});

test('ANTI-RETOUR : `confirm` n\'est plus du vocabulaire, dans AUCUN corpus', () => {
  // 🛑 RETIRÉ le 05/08/2026, après mesure — ne JAMAIS le réintroduire :
  //    · 390 frontmatters le portaient (convention recopiée depuis
  //      protect-files.js pour la parité de bascule du 17/07/2026) ;
  //    · l'interrupteur GLOBAL était à `false` ⇒ ils ne déclenchaient RIEN,
  //      et personne ne s'en était aperçu — définition d'une clé morte ;
  //    · Codex ne supporte pas `ask` : il y était dégradé en simple injection,
  //      donc un même mot avait DEUX sens selon le harnais ;
  //    · `ask` remet un HUMAIN dans la boucle = contraire au 0-human, qui est
  //      le mur porteur du framework.
  // ⚠️ Le besoin « arrêter un geste » est couvert par `enforce` : automatique,
  //    identique sur les 2 harnais, et il LIVRE le savoir avec le refus.
  //    Deux mots pour un besoin = loi anti-synonyme violée.
  assert.ok(!KNOWN.includes('confirm'), 'confirm ne doit plus être une clé admise');
  assert.ok(validate({ match: 'a.js', confirm: true }).length > 0, 'confirm doit être REFUSÉ en doc fichier');
  assert.ok(validateMcp({ confirm: true }).length > 0, 'confirm doit être REFUSÉ en doc MCP');
});

// ═══════════════════════════════════════════════════════════════════════
// GATE DE SYMÉTRIE DU VOCABULAIRE (05/08/2026) — anti-décalage PERMANENT.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI : le framework a 4 corpus (doc fichier · doc MCP · entrée skill ·
//    defaults.{source}). Une clé de COMPORTEMENT qui n'atterrit que dans l'un
//    d'eux crée un décalage que PERSONNE ne voit — c'est arrivé à `confirm`,
//    resté fichier-only depuis le 1er commit sans que ce soit une décision,
//    jusqu'à son retrait le 05/08/2026. Ce gate existe pour que ça ne se
//    reproduise pas : la prochaine clé asymétrique rougira le jour même.
//
// ⚠️ PRINCIPE : **symétrie par DÉFAUT, exception DÉCLARÉE.** Aucune liste de
//    clés en dur ici : les clés de comportement sont DÉRIVÉES (vocabulaire
//    moins les opérateurs de matching, qui sont propres à chaque corpus par
//    nature). Une asymétrie non déclarée = ROUGE. Une déclaration devenue
//    fausse = ROUGE aussi (sinon les justifications périmées s'accumulent).
//
// ⚠️ Les corpus sont SONDÉS, jamais lus dans une constante : on appelle le vrai
//    validateur et on lit le vrai schéma. Un gate qui lit une liste au lieu de
//    tester le comportement peut rester vert sur un moteur cassé.

// Opérateurs de MATCHING — propres au corpus par nature (un skill n'a pas de
// `rank`, une doc MCP se déclenche par son CHEMIN). Contrat écrit en dur : les
// dériver du code testé les ferait muter avec lui.
const MATCHING = ['match', 'mcp', 'rules', 'tool', 'inject', 'scope', 'exclude', 'rank'];

// Échantillon VALIDE par clé de comportement. Toute clé sans échantillon = ROUGE
// (volet ⓪) : impossible d'ajouter une clé en la rendant invisible au gate.
const ECHANTILLON = { mode: 'once', threshold: 2, driftUnit: 'turn', note: 'x', enforce: true };

// 🛑 LES SEULES ASYMÉTRIES ADMISES — chacune avec sa RAISON MESURÉE.
//    Ajouter une entrée ici est une DÉCISION, jamais un contournement.
const ASYMETRIES_JUSTIFIEES = {
  // ⚠️ VIDE, et c'est le but : le vocabulaire de comportement est INTÉGRALEMENT
  //    symétrique depuis le retrait de `confirm` (05/08/2026). Une entrée ici
  //    est une DÉCISION écrite, jamais un contournement pour faire passer le gate.
};

test('GATE SYMÉTRIE ⓪ : toute clé de comportement a un échantillon (rien ne peut se cacher)', () => {
  const comportement = KNOWN.filter((k) => !MATCHING.includes(k));
  for (const k of comportement) {
    assert.ok(k in ECHANTILLON,
      `\`${k}\` est une clé de COMPORTEMENT sans échantillon : ajoute-la à ECHANTILLON, sinon le gate de symétrie ne la voit pas.`);
  }
  assert.ok(comportement.length >= 5, 'vocabulaire de comportement suspect');
});

test('GATE SYMÉTRIE ① : une clé présente dans un corpus et absente d\'un autre DOIT être justifiée', async () => {
  const sch = (await import('./ctxroute-config.schema.json', { with: { type: 'json' } })).default;
  const skillProps = sch.properties.skills.additionalProperties.properties;
  const cadenceProps = sch.definitions.cadence.properties;

  for (const [k, v] of Object.entries(ECHANTILLON)) {
    // Les 4 corpus, SONDÉS (validateur réel + schéma réel).
    const presence = {
      'doc fichier': validate({ match: 'x', [k]: v }).length === 0,
      'doc MCP': validateMcp({ [k]: v }).length === 0,
      'entrée skill': Object.prototype.hasOwnProperty.call(skillProps, k),
      'defaults.{source}': Object.prototype.hasOwnProperty.call(cadenceProps, k),
    };
    const absents = Object.keys(presence).filter((c) => !presence[c]);
    const justif = ASYMETRIES_JUSTIFIEES[k];

    if (absents.length === 0) {
      // ⚠️ Volet INVERSE : une justification qui ne correspond plus à rien doit
      //    disparaître, sinon on garde des excuses pour des problèmes réglés.
      assert.ok(!justif,
        `\`${k}\` est SYMÉTRIQUE partout : retire son entrée de ASYMETRIES_JUSTIFIEES (justification périmée).`);
    } else {
      assert.ok(typeof justif === 'string' && justif.trim().length > 40,
        `DÉCALAGE NON JUSTIFIÉ — \`${k}\` manque dans : ${absents.join(', ')}.\n`
        + `   Soit tu l'ajoutes à ces corpus (symétrie = le défaut), soit tu écris POURQUOI dans `
        + `ASYMETRIES_JUSTIFIEES avec une raison MESURÉE. Le silence n'est pas une option.`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BLOCS YAML — la perte silencieuse est FERMÉE (06/08/2026)
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 DÉFAUT RÉEL : `note: |` rendait `"|"` et AVALAIT les lignes indentées. Comme
//    le frontmatter est retiré du corps, elles disparaissaient des DEUX côtés,
//    avec `validate` VERT. `note` est le champ qui invite à écrire long.
// 🛑 AUCUNE EXCEPTION PAR CLÉ : la règle est « `|`/`>` SUIVI d'une ligne
//    INDENTÉE », valable partout. Une exception sur `note` seule aurait laissé
//    le piège armé sur toutes les autres clés — et la clé suivante retomberait
//    dedans sans que personne ne comprenne pourquoi.

test('BLOC | : les lignes indentées sont CONSERVÉES, pas avalées', () => {
  const { data } = parse('---\nmatch: a.js\nnote: |\n  ligne un\n  ligne deux\n---\ncorps\n');
  assert.strictEqual(data.note, 'ligne un\nligne deux');
  assert.strictEqual(data.match, 'a.js', 'le bloc ne mange pas les clés voisines');
});

test('BLOC > : les lignes sont REPLIÉES par une espace (sémantique YAML)', () => {
  const { data } = parse('---\nnote: >\n  ligne un\n  ligne deux\n---\ncorps\n');
  assert.strictEqual(data.note, 'ligne un ligne deux');
});

test('BLOC : une ligne VIDE interne est gardée, la finale est coupée', () => {
  // Sans la garde « vide + suivante indentée », un paragraphe séparé par un
  // blanc serait tronqué à sa première moitié — perte silencieuse à nouveau.
  const { data } = parse('---\nnote: |\n  para un\n\n  para deux\n---\ncorps\n');
  assert.strictEqual(data.note, 'para un\n\npara deux');
});

test('BLOC : désindentation sur la PLUS PETITE indentation, pas un nombre fixe', () => {
  const { data } = parse('---\nnote: |\n    profond\n    aussi\n---\ncorps\n');
  assert.strictEqual(data.note, 'profond\naussi', 'un slice(2) codé en dur mangerait un caractère');
});

test('CAS FONDATEUR : `match: |` SANS ligne indentée reste la CHAÎNE "|"', () => {
  // 🛑 NE JAMAIS SUPPRIMER CE TEST. C'est lui qui a tué la garde du 05/08/2026,
  //    posée dans `validate()` : elle rejetait toute valeur `|`, alors que
  //    `match: "|"` est un pattern LÉGITIME (la CI l'a mise en rouge en minutes
  //    via le property round-trip du migrateur). La bonne couche est `parse`,
  //    parce qu'elle SEULE voit la ligne suivante et lève l'ambiguïté.
  const { data } = parse('---\nmatch: |\nmode: dumb\n---\ncorps\n');
  assert.strictEqual(data.match, '|');
  assert.strictEqual(data.mode, 'dumb', 'la clé suivante est intacte');
});

test('BLOC en DERNIÈRE ligne du frontmatter → aucun crash (totalité)', () => {
  // `lignes[i + 2]` vaut alors `undefined` : sans la garde de type dans
  // `estIndentee`, le parser jetterait — donc PLUS AUCUNE doc injectée nulle
  // part, pour tout le parc. La totalité de `parse` n'est pas négociable.
  assert.doesNotThrow(() => parse('---\nnote: |\n  seule\n---\ncorps\n'));
  assert.strictEqual(parse('---\nnote: |\n  seule\n---\ncorps\n').data.note, 'seule');
});

test('BLOC : le corps de la doc reste INTACT (le bloc ne déborde pas du frontmatter)', () => {
  const { body } = parse('---\nnote: |\n  interne\n---\n# Titre\ntexte\n');
  assert.strictEqual(body, '# Titre\ntexte\n');
});

test('BLOC : indentations INÉGALES → désindente sur la PLUS PETITE, jamais la plus grande', () => {
  // ⚠️ Tue le mutant `Math.min` → `Math.max` : avec max, la ligne la moins
  //    indentée serait TRONQUÉE dans son texte. L'indentation relative d'un
  //    sous-niveau (liste, code) doit être PRÉSERVÉE, c'est du YAML.
  const { data } = parse('---\nnote: |\n  base\n      profond\n---\ncorps\n');
  assert.strictEqual(data.note, 'base\n    profond');
});

test('BLOC : une ligne d ESPACES SEULS ne fausse pas l indentation de référence', () => {
  // ⚠️ Tue le mutant `l.trim() !== ''` → `l !== ''` : une ligne de 2 espaces
  //    serait comptée comme indentation 2 et écraserait le minimum réel (4),
  //    laissant tout le bloc décalé.
  const { data } = parse('---\nnote: |\n    un\n  \n    deux\n---\ncorps\n');
  assert.strictEqual(data.note, 'un\n\ndeux');
});

test('BLOC > : chaque ligne est TRIMÉE avant le repli (pas d espaces parasites)', () => {
  // ⚠️ Tue le mutant `nues.map(l => l.trim())` → `nues.map(l => l)` : sans trim,
  //    une indentation relative laisserait des espaces au milieu du texte replié.
  const { data } = parse('---\nnote: >\n  un\n      deux\n---\ncorps\n');
  assert.strictEqual(data.note, 'un deux');
});

test('BLOC : la ligne vide FINALE est coupée (chomping « clip » de YAML)', () => {
  // ⚠️ Tue le mutant qui retire `.trimEnd()` : sans lui, le saut de ligne qui
  //    précède le `---` de fermeture entrerait dans la valeur.
  const { data } = parse('---\nnote: |\n  seule\n\nmode: dumb\n---\ncorps\n');
  assert.strictEqual(data.note, 'seule', 'aucun \n résiduel en fin de valeur');
});

test('BLOC : les espaces en FIN de valeur sont coupés', () => {
  // ⚠️ Tue le mutant qui retire `.trimEnd()`. Cas réel et invisible à l'œil :
  //    un éditeur laisse des espaces en fin de ligne, la valeur les emporterait.
  const { data } = parse('---\nnote: |\n  texte   \n---\ncorps\n');
  assert.strictEqual(data.note, 'texte');
});

test('BLOC : `|` suivi d ESPACES reste un bloc (le marqueur est trimé)', () => {
  // ⚠️ Tue le mutant `raw.trim()` → `raw` : sans le trim, une espace invisible
  //    après le `|` ferait retomber la doc dans le PIÈGE d'origine (valeur "|",
  //    lignes avalées) — une régression indétectable à la relecture.
  const { data } = parse('---\nnote: |   \n  contenu\n---\ncorps\n');
  assert.strictEqual(data.note, 'contenu');
});
