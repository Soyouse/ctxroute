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
  assert.strictEqual(parse('---\nconfirm: true\n---\n').data.confirm, true);
  assert.strictEqual(parse('---\nconfirm: false\n---\n').data.confirm, false);
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
test('validate : confirm booléen, rank numérique', () => {
  assert.ok(validate({ match: 'a', confirm: 'oui' }).length > 0);
  assert.ok(validate({ match: 'a', rank: '3' }).length > 0);
  assert.deepStrictEqual(validate({ match: 'a', confirm: false, rank: 0 }), []);
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
  assert.deepStrictEqual(validate({ match: 'a', scope: ['s'], exclude: ['e'], mode: 'dumb', confirm: true, rank: 1, threshold: 3 }), []);
  // ⚠️ Contrat écrit EN DUR — ne JAMAIS le dériver de KNOWN (il muterait avec le code).
  // ⚠️ `note` AJOUTÉE le 04/08/2026 — commentaire d'auteur, JAMAIS lue par le moteur.
  assert.deepStrictEqual(KNOWN, ['match', 'mcp', 'rules', 'tool', 'inject', 'scope', 'exclude', 'mode', 'confirm', 'rank', 'threshold', 'driftUnit', 'note']);
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
  assert.deepStrictEqual(validate({ inject: 'never', mode: 'dumb', confirm: false }), []);
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
  assert.ok(validate({ mode: 'dumb', confirm: true }).length > 0);
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
