// ═══════════════════════════════════════════════════════════════════════
// Tests UNITAIRES PURS de lib-pure.js — zéro I/O, zéro spawn, zéro process.
// Cible Stryker (stryker.conf.json → mutate: ["lib-pure.js"]) : chaque
// branche/opérateur de lib-pure.js DOIT être couvert ici pour que la
// mutation testing ait un sens (un mutant survivant = un cas non couvert).
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import lib from './lib-pure.js';

// Chaque ok(name, cond) = EXACTEMENT UN test vitest (même nom, même cond).
// cond est évaluée séquentiellement au niveau module (ordre d'origine préservé).
// ⚠️ cond est un THUNK évalué DANS le callback du test — JAMAIS au niveau
// module : sous Stryker perTest, une expression évaluée au chargement du
// fichier n'est couverte par AUCUN test individuel (mutant « statique ») et
// ses mutants SURVIVENT (mesuré 16/07/2026 : 42 survivants, score 76,67%).
function ok(name, cond) {
  test(name, () => { assert.ok(cond(), name); });
}

// ── sanitizeSessionId ──
ok('sanitizeSessionId: caractères sûrs conservés', () => lib.sanitizeSessionId('abc-123_XYZ') === 'abc-123_XYZ');
ok('sanitizeSessionId: caractères dangereux retirés', () => lib.sanitizeSessionId('../../etc/passwd') === 'etcpasswd');
ok('sanitizeSessionId: vide → "unknown"', () => lib.sanitizeSessionId('') === 'unknown');
ok('sanitizeSessionId: undefined → "unknown"', () => lib.sanitizeSessionId(undefined) === 'unknown');
ok('sanitizeSessionId: null → "unknown"', () => lib.sanitizeSessionId(null) === 'unknown');
ok('sanitizeSessionId: uniquement caractères dangereux → "unknown"', () => lib.sanitizeSessionId('///') === 'unknown');

// ── scopeId (état par agent, 19/07/2026) ──
// ⚠️ Sans agent_id, la clé DOIT être octet-identique à sanitizeSessionId :
// c'est la rétro-compat qui garde la parité différentielle + Codex intacts.
ok('scopeId: sans agent_id = clé historique inchangée', () => lib.scopeId('s1') === lib.sanitizeSessionId('s1'));
ok('scopeId: agent_id null/vide = clé historique (jamais "--agent-unknown")', () => lib.scopeId('s1', null) === 's1' && lib.scopeId('s1', '') === 's1');
ok('scopeId: agent_id présent → suffixe --agent-', () => lib.scopeId('s1', 'a2') === 's1--agent-a2');
ok('scopeId: deux agents distincts → clés distinctes', () => lib.scopeId('s1', 'aaa') !== lib.scopeId('s1', 'bbb'));
ok('scopeId: agent ≠ maître (jamais de collision)', () => lib.scopeId('s1', 'a2') !== lib.scopeId('s1'));
ok('scopeId: agent_id sale sanitisé (pas de traversée)', () => lib.scopeId('s1', '../x') === 's1--agent-x');

// ── serverName ──
ok('serverName: extrait le serveur simple', () => lib.serverName('mcp__stripe__authenticate') === 'stripe');
ok('serverName: gère les serveurs à underscore multiple', () => lib.serverName('mcp__plugin_discord_discord__reply') === 'plugin_discord_discord');
ok('serverName: outil natif (pas de préfixe mcp__) → null', () => lib.serverName('Bash') === null);
ok('serverName: chaîne vide → null', () => lib.serverName('') === null);
ok('serverName: undefined → null', () => lib.serverName(undefined) === null);
ok('serverName: préfixe mcp__ mais serveur vide → null', () => lib.serverName('mcp____tool') === null);

// ── toolSuffix ──
ok('toolSuffix: extrait le suffixe correct', () => lib.toolSuffix('mcp__stripe__authenticate', 'stripe') === 'authenticate');
ok('toolSuffix: server null → null', () => lib.toolSuffix('mcp__stripe__authenticate', null) === null);
ok('toolSuffix: tool_name ne correspond pas au préfixe attendu → null', () => lib.toolSuffix('mcp__odoo__x', 'stripe') === null);
ok('toolSuffix: tool_name vide → null', () => lib.toolSuffix('', 'stripe') === null);
ok('toolSuffix: suffixe lui-même avec underscores', () => lib.toolSuffix('mcp__odoo__odoo_call', 'odoo') === 'odoo_call');
ok('toolSuffix: garde explicite server=null empêche un match accidentel sur un tool_name littéral "mcp__null__..."', () => lib.toolSuffix('mcp__null__foo', null) === null);

// ── getByPath ──
ok('getByPath: chemin simple', () => lib.getByPath({ a: 'x' }, 'a') === 'x');
ok('getByPath: chemin imbriqué', () => lib.getByPath({ args: { tool: 'delete_record' } }, 'args.tool') === 'delete_record');
ok('getByPath: chemin absent → null', () => lib.getByPath({ args: {} }, 'args.tool') === null);
ok('getByPath: objet racine null → null', () => lib.getByPath(null, 'a.b') === null);
ok('getByPath: dottedPath non-string → null', () => lib.getByPath({ a: 1 }, null) === null);
ok('getByPath: valeur nombre convertie en string', () => lib.getByPath({ args: { id: 42 } }, 'args.id') === '42');
ok('getByPath: valeur objet (pas scalaire) → null', () => lib.getByPath({ args: { tool: {} } }, 'args.tool') === null);
ok('getByPath: valeur array (pas scalaire) → null', () => lib.getByPath({ args: { tool: [] } }, 'args.tool') === null);
ok('getByPath: chemin traverse un null intermédiaire → null (pas de crash)', () => lib.getByPath({ args: null }, 'args.tool') === null);

// ── thresholdFor ──
ok('thresholdFor: pas de config → défaut 4', () => lib.thresholdFor({}, 'stripe') === 4);
ok('thresholdFor: defaultThreshold custom', () => lib.thresholdFor({ defaultThreshold: 10 }, 'stripe') === 10);
ok('thresholdFor: override serveur prime sur defaultThreshold', () => lib.thresholdFor({ defaultThreshold: 10, servers: { stripe: { threshold: 1 } } }, 'stripe') === 1);
ok('thresholdFor: override non-entier ignoré → fallback', () => lib.thresholdFor({ defaultThreshold: 10, servers: { stripe: { threshold: 'oops' } } }, 'stripe') === 10);
ok('thresholdFor: defaultThreshold non-entier → fallback dur 4', () => lib.thresholdFor({ defaultThreshold: 'oops' }, 'stripe') === 4);
ok('thresholdFor: threshold=0 explicite respecté (falsy mais valide)', () => lib.thresholdFor({ servers: { stripe: { threshold: 0 } } }, 'stripe') === 0);

// ── modeFor ──
ok('modeFor: pas de config → "smart"', () => lib.modeFor({}, 'stripe') === 'smart');
ok('modeFor: mode global respecté', () => lib.modeFor({ mode: 'once' }, 'stripe') === 'once');
ok('modeFor: override serveur prime sur mode global', () => lib.modeFor({ mode: 'once', servers: { stripe: { mode: 'dumb' } } }, 'stripe') === 'dumb');
ok('modeFor: serveur sans override reste sur le mode global', () => lib.modeFor({ mode: 'once', servers: { odoo: { mode: 'dumb' } } }, 'stripe') === 'once');

// ── isServerActive ──
ok('isServerActive: filterMode "none" (défaut) → tout actif', () => lib.isServerActive({}, 'stripe') === true);
ok('isServerActive: whitelist contient le serveur → actif', () => lib.isServerActive({ filterMode: 'whitelist', filterList: ['stripe'] }, 'stripe') === true);
ok('isServerActive: whitelist ne contient pas le serveur → inactif', () => lib.isServerActive({ filterMode: 'whitelist', filterList: ['odoo'] }, 'stripe') === false);
ok('isServerActive: blacklist contient le serveur → inactif', () => lib.isServerActive({ filterMode: 'blacklist', filterList: ['stripe'] }, 'stripe') === false);
ok('isServerActive: blacklist ne contient pas le serveur → actif', () => lib.isServerActive({ filterMode: 'blacklist', filterList: ['odoo'] }, 'stripe') === true);
ok('isServerActive: filterList absent (whitelist) → tout inactif (liste vide)', () => lib.isServerActive({ filterMode: 'whitelist' }, 'stripe') === false);
ok('isServerActive: filterList non-array → traité comme vide', () => lib.isServerActive({ filterMode: 'whitelist', filterList: 'stripe' }, 'stripe') === false);
ok('isServerActive: filterMode inconnu → fail-open (actif)', () => lib.isServerActive({ filterMode: 'n-importe-quoi' }, 'stripe') === true);
ok('isServerActive: filterMode "none" AVEC filterList non-vide → ignore quand même la liste (pas un blacklist implicite)', () => lib.isServerActive({ filterMode: 'none', filterList: ['stripe'] }, 'stripe') === true);
ok('isServerActive: filterMode absent AVEC filterList non-vide → même comportement que "none" explicite', () => lib.isServerActive({ filterList: ['stripe'] }, 'stripe') === true);

// ── confirmFor (#4 : le futur remplaçant du fichier sentinelle .rush) ──
ok('confirmFor: frontmatter confirm:true + config muette → ask', () => lib.confirmFor({}, { confirm: true }) === true);
ok('confirmFor: config.confirm=false ÉTEINT tout (le rush, mais dans le JSON)', () => lib.confirmFor({ confirm: false }, { confirm: true }) === false);
ok('confirmFor: doc sans confirm → jamais d\'ask (true littéral exigé)', () => lib.confirmFor({}, {}) === false);
ok('confirmFor: confirm non-booléen ("oui") → jamais d\'ask (corruption ≠ ask inventé)', () => lib.confirmFor({}, { confirm: 'oui' }) === false);
ok('confirmFor: config.confirm=true explicite ne FORCE pas un ask sur doc muette', () => lib.confirmFor({ confirm: true }, {}) === false);
ok('confirmFor: config/decl null → false, jamais un throw (totalité)', () => lib.confirmFor(null, null) === false);
ok('confirmFor: config cassée (confirm:"off") ≠ rush — l\'ask déclaré reste', () => lib.confirmFor({ confirm: 'off' }, { confirm: true }) === true);

// ── isFrameworkEnabled (interrupteur GLOBAL — coupe injection ET tracking) ──
ok('isFrameworkEnabled: pas de champ "enabled" → ON par défaut', () => lib.isFrameworkEnabled({}) === true);
ok('isFrameworkEnabled: enabled=true explicite → ON', () => lib.isFrameworkEnabled({ enabled: true }) === true);
ok('isFrameworkEnabled: enabled=false explicite → OFF', () => lib.isFrameworkEnabled({ enabled: false }) === false);
ok('isFrameworkEnabled: valeur inattendue (ni true ni false) → fail-open ON (pas false littéral)', () => lib.isFrameworkEnabled({ enabled: 'oops' }) === true);
ok('isFrameworkEnabled: enabled=0 (falsy mais pas false) → ON (seul `false` littéral désactive)', () => lib.isFrameworkEnabled({ enabled: 0 }) === true);
ok('isFrameworkEnabled: enabled=null → ON (fail-open)', () => lib.isFrameworkEnabled({ enabled: null }) === true);

// ── shouldShowNotification (contrôle UNIQUEMENT le systemMessage visible, jamais l'injection) ──
ok('shouldShowNotification: pas de champ "showNotification" → ON par défaut', () => lib.shouldShowNotification({}) === true);
ok('shouldShowNotification: showNotification=true explicite → ON', () => lib.shouldShowNotification({ showNotification: true }) === true);
ok('shouldShowNotification: showNotification=false explicite → OFF', () => lib.shouldShowNotification({ showNotification: false }) === false);
ok('shouldShowNotification: valeur inattendue (ni true ni false) → fail-open ON (pas false littéral)', () => lib.shouldShowNotification({ showNotification: 'oops' }) === true);
ok('shouldShowNotification: showNotification=0 (falsy mais pas false) → ON (seul `false` littéral désactive)', () => lib.shouldShowNotification({ showNotification: 0 }) === true);
ok('shouldShowNotification: showNotification=null → ON (fail-open)', () => lib.shouldShowNotification({ showNotification: null }) === true);

// ── formatSystemMessage ──
ok('formatSystemMessage: préfixe explicite [ctxroute] pour distinguer des autres sources', () => lib.formatSystemMessage('stripe', ['server']) === '📄 [ctxroute] stripe');
ok('formatSystemMessage: 1 seul niveau (server) → pas de suffixe', () => lib.formatSystemMessage('stripe', ['server']).includes('(') === false);
ok('formatSystemMessage: 2 niveaux (server+tool) → suffixe avec le niveau additionnel', () => lib.formatSystemMessage('stripe', ['server', 'tool']) === '📄 [ctxroute] stripe (tool)');
ok('formatSystemMessage: 3 niveaux (server+tool+subTool) → les 2 niveaux additionnels listés', () => lib.formatSystemMessage('odoo', ['server', 'tool', 'subTool']) === '📄 [ctxroute] odoo (tool+subTool)');
ok('formatSystemMessage: levels absent/vide → pas de crash, pas de suffixe', () => lib.formatSystemMessage('stripe', []) === '📄 [ctxroute] stripe');
ok('formatSystemMessage: levels non-array → pas de crash, pas de suffixe', () => lib.formatSystemMessage('stripe', undefined) === '📄 [ctxroute] stripe');

// ── shouldInjectFor ──
ok('shouldInjectFor: mode dumb → toujours true', () => lib.shouldInjectFor('dumb', true, 999, 1) === true);
ok('shouldInjectFor: 1er appel (entrySeen=false) → true, tous modes', () => lib.shouldInjectFor('once', false, 0, 4) === true);
ok('shouldInjectFor: mode once, déjà vu → false', () => lib.shouldInjectFor('once', true, 999, 4) === false);
ok('shouldInjectFor: mode smart, sous le seuil → false', () => lib.shouldInjectFor('smart', true, 2, 4) === false);
ok('shouldInjectFor: mode smart, seuil atteint (égalité) → true', () => lib.shouldInjectFor('smart', true, 4, 4) === true);
ok('shouldInjectFor: mode smart, au-dessus du seuil → true', () => lib.shouldInjectFor('smart', true, 5, 4) === true);
ok('shouldInjectFor: mode inconnu, déjà vu → false (comportement "once" par défaut)', () => lib.shouldInjectFor('n-importe-quoi', true, 999, 4) === false);

// ── docCandidatePaths ──
// ⚠️ Les fixtures sont des THUNKS (recalculées DANS chaque test) — un `const`
//    de niveau module serait évalué au chargement = mutant statique survivant.
{
  const c1 = () => lib.docCandidatePaths({}, 'stripe', 'mcp__stripe__authenticate', {});
  const lvl1 = () => c1().find((c) => c.relPath === 'stripe.md');
  const lvl2 = () => c1().find((c) => c.relPath === 'stripe/authenticate.md');
  ok('docCandidatePaths: niveau 1 (serveur) toujours présent', () => !!lvl1());
  ok('docCandidatePaths: niveau 1 sourceLabel correct', () => lvl1() && lvl1().sourceLabel === 'docs/mcp/stripe.md');
  ok('docCandidatePaths: niveau 1 label "server"', () => lvl1() && lvl1().level === 'server');
  ok('docCandidatePaths: niveau 2 (outil) présent si suffixe extrait', () => !!lvl2());
  ok('docCandidatePaths: niveau 2 sourceLabel correct', () => lvl2() && lvl2().sourceLabel === 'docs/mcp/stripe/authenticate.md');
  ok('docCandidatePaths: niveau 2 label "tool"', () => lvl2() && lvl2().level === 'tool');
  ok('docCandidatePaths: pas de niveau 3 sans subToolParam configuré', () => c1().length === 2);
}
{
  const c2 = () => lib.docCandidatePaths(
    { servers: { odoo: { subToolParam: 'args.tool' } } },
    'odoo', 'mcp__odoo__odoo_call', { args: { tool: 'delete_record' } }
  );
  const lvl3 = () => c2().find((c) => c.relPath === 'odoo/delete_record.md');
  ok('docCandidatePaths: niveau 3 (sous-outil) ajouté si subToolParam configuré et résolu', () => !!lvl3());
  ok('docCandidatePaths: niveau 3 sourceLabel correct', () => lvl3() && lvl3().sourceLabel === 'docs/mcp/odoo/delete_record.md');
  ok('docCandidatePaths: niveau 3 label "subTool"', () => lvl3() && lvl3().level === 'subTool');
  ok('docCandidatePaths: niveau 2 aussi présent (odoo_call) en plus du niveau 3', () => c2().some((c) => c.relPath === 'odoo/odoo_call.md'));
  ok('docCandidatePaths: 3 niveaux distincts quand tool !== subTool', () => c2().length === 3);
}
{
  // ⚠️ Cas de dédoublonnage : le "tool" ET le "subTool" pointent vers le même nom.
  const c3 = () => lib.docCandidatePaths(
    { servers: { same: { subToolParam: 'args.tool' } } },
    'same', 'mcp__same__foo', { args: { tool: 'foo' } }
  );
  ok('docCandidatePaths: dédoublonne si subTool === suffix (pas de doublon)', () => c3().filter((c) => c.relPath === 'same/foo.md').length === 1);
  ok('docCandidatePaths: total 2 candidats (serveur + outil, pas de 3e dupliqué)', () => c3().length === 2);
}
{
  const c4 = () => lib.docCandidatePaths({}, 'bash-like', 'Bash', {});
  ok('docCandidatePaths: tool_name ne matchant pas le préfixe attendu → pas de niveau 2', () => c4().length === 1);
}

// ── isSafePathSegment — SÉCURITÉ (traversal). ⚠️ NE JAMAIS SUPPRIMER ──
// `subTool` sort de tool_input, donc d'une valeur potentiellement dérivée de
// données EXTERNES. Sans filtre, "../../.." fait sortir path.join() de
// docs/mcp/ et injecte un .md arbitraire du disque dans le contexte de
// l'agent COMME UNE CONSIGNE FAISANT AUTORITÉ (injection de prompt).
ok('isSafePathSegment: nom simple → sûr', () => lib.isSafePathSegment('delete_record') === true);
ok('isSafePathSegment: ".." → rejeté', () => lib.isSafePathSegment('..') === false);
ok('isSafePathSegment: "." → rejeté', () => lib.isSafePathSegment('.') === false);
ok('isSafePathSegment: slash POSIX → rejeté', () => lib.isSafePathSegment('../../etc/passwd') === false);
ok('isSafePathSegment: backslash Windows → rejeté', () => lib.isSafePathSegment('..\\..\\secrets') === false);
ok('isSafePathSegment: octet NUL → rejeté', () => lib.isSafePathSegment('foo\0bar') === false);
ok('isSafePathSegment: chaîne vide → rejeté', () => lib.isSafePathSegment('') === false);
ok('isSafePathSegment: non-string → rejeté', () => lib.isSafePathSegment(null) === false);
ok('isSafePathSegment: chemin absolu → rejeté', () => lib.isSafePathSegment('/etc/passwd') === false);

// ── TOTALITÉ : objet à toString cassé. ⚠️ NE JAMAIS SUPPRIMER ──
// `{"toString": 0}` est du JSON VALIDE, donc atteignable depuis un payload de
// hook. String(x)/exec(x) LÈVENT dessus ("Cannot convert object to primitive
// value") — la coercion JS ne protège PAS, contrairement à ce que le
// commentaire du code affirmait avant le 15/07/2026 (trouvé par property-based).
// Un throw ici = fail-open du hook = silence total.
{
  const evil = JSON.parse('{"toString": 0}');
  ok('serverName: objet à toString cassé → null, ne lève pas', () => lib.serverName(evil) === null);
  ok('toolSuffix: objet à toString cassé → null, ne lève pas', () => lib.toolSuffix(evil, 'stripe') === null);
  ok('sanitizeSessionId: objet à toString cassé → "unknown", ne lève pas', () => lib.sanitizeSessionId(evil) === 'unknown');
  ok('docCandidatePaths: tool_name objet cassé → ne lève pas', () => lib.docCandidatePaths({}, 'stripe', evil, {}).length === 1);
  ok('sanitizeSessionId: nombre accepté (session_id numérique)', () => lib.sanitizeSessionId(42) === '42');
  ok('sanitizeSessionId: objet ordinaire → "unknown" (pas "objectObject")', () => lib.sanitizeSessionId({}) === 'unknown');
  ok('sanitizeSessionId: tableau → "unknown"', () => lib.sanitizeSessionId([1, 2]) === 'unknown');
}

// ── SÉCURITÉ : nom de SERVEUR hostile. ⚠️ NE JAMAIS SUPPRIMER ──
// Trou RÉEL trouvé par property-based (pas par relecture) le 15/07/2026 :
// serverName() utilisait `[^_]+`, qui matche `/` et `.` → `mcp__../../etc__x`
// donnait server="../../etc". Ces cas sont la version DÉTERMINISTE du property
// test (Stryker ne lance que lib-pure.test.js : sans eux, la garde survivrait
// aux mutants et le trou pourrait revenir sans que rien ne devienne rouge).
ok('serverName: nom de serveur avec traversal → null (regex restrictive)', () => lib.serverName('mcp__../../etc__x') === null);
ok('serverName: nom de serveur avec slash → null', () => lib.serverName('mcp__a/b__x') === null);
ok('serverName: nom de serveur avec backslash → null', () => lib.serverName('mcp__a\\b__x') === null);
ok('serverName: nom de serveur avec point → null', () => lib.serverName('mcp__a.b__x') === null);
ok('serverName: nom légitime à tirets conservé', () => lib.serverName('mcp__qa-seo__do') === 'qa-seo');
ok('serverName: nom légitime à underscores conservé', () => lib.serverName('mcp__plugin_discord_discord__do') === 'plugin_discord_discord');
ok('docCandidatePaths: serveur non sûr → ZÉRO candidat', () => lib.docCandidatePaths({}, '../../etc', 'mcp__x__y', {}).length === 0);
ok('docCandidatePaths: serveur avec slash → ZÉRO candidat', () => lib.docCandidatePaths({}, 'a/b', 'mcp__x__y', {}).length === 0);
ok('docCandidatePaths: serveur vide → ZÉRO candidat', () => lib.docCandidatePaths({}, '', 'mcp__x__y', {}).length === 0);
ok('docCandidatePaths: serveur null → ZÉRO candidat', () => lib.docCandidatePaths({}, null, 'mcp__x__y', {}).length === 0);
ok('docCandidatePaths: serveur sûr → candidat serveur présent', () => lib.docCandidatePaths({}, 'stripe', 'mcp__stripe__pay', {})[0].relPath === 'stripe.md');

{
  // Le traversal doit disparaître des CANDIDATS eux-mêmes (défense à la source,
  // jamais un filtre côté I/O qu'on pourrait oublier dans un futur caller).
  const evil = () => lib.docCandidatePaths(
    { servers: { odoo: { subToolParam: 'args.tool' } } },
    'odoo', 'mcp__odoo__odoo_call', { args: { tool: '../../../../secrets' } }
  );
  ok('docCandidatePaths: subTool avec traversal → AUCUN candidat niveau 3', () => evil().every((c) => !c.relPath.includes('..')));
  ok('docCandidatePaths: subTool malveillant → seul le niveau serveur+outil subsiste', () => evil().length === 2);

  const evilSuffix = () => lib.docCandidatePaths({}, 'srv', 'mcp__srv__../../etc/passwd', {});
  ok('docCandidatePaths: suffixe outil avec traversal → AUCUN candidat niveau 2', () => evilSuffix().length === 1 && evilSuffix()[0].level === 'server');
}

// ── MUTANT lib-pure L147 : le fallback filterList est VIDE, jamais peuplé ──
// ⚠️ `: []` muté en `["Stryker was here"]` (survivant réel 16/07/2026) : en
//    whitelist avec filterList invalide, un serveur portant LE nom du littéral
//    deviendrait actif. Contrat : filterList invalide + whitelist = AUCUN serveur
//    actif, quel que soit son nom — y compris celui que Stryker fabrique.
ok('isServerActive: whitelist + filterList invalide → inactif même pour "Stryker was here"', () => lib.isServerActive({ filterMode: 'whitelist', filterList: 'pas-un-tableau' }, 'Stryker was here') === false);

// ═══════════════════════════════════════════════════════════════════════
// parsePaquetArgs — déclaration du transport multi-trames (config, pas code)
// ═══════════════════════════════════════════════════════════════════════

test('parsePaquetArgs : lit --paquet / --paquets', () => {
  assert.deepStrictEqual(lib.parsePaquetArgs(['node', 'h.js', '--paquet', '2', '--paquets', '4']), { paquet: 2, nbPaquets: 4 });
  assert.deepStrictEqual(lib.parsePaquetArgs(['node', 'h.js', '--paquets', '3', '--paquet', '3']), { paquet: 3, nbPaquets: 3 });
});

test('parsePaquetArgs : rien de déclaré → trame unique (comportement d\'aujourd\'hui)', () => {
  assert.deepStrictEqual(lib.parsePaquetArgs(['node', 'h.js']), { paquet: 1, nbPaquets: 1 });
  assert.deepStrictEqual(lib.parsePaquetArgs([]), { paquet: 1, nbPaquets: 1 });
});

test('parsePaquetArgs : entrée absurde → trame unique, JAMAIS un throw', () => {
  // ⚠️ Une déclaration mal écrite DÉGRADE, elle ne casse jamais l'injection.
  for (const mauvais of [undefined, null, 'texte', 42, {}]) {
    assert.deepStrictEqual(lib.parsePaquetArgs(mauvais), { paquet: 1, nbPaquets: 1 });
  }
  for (const v of ['0', '-2', '2.5', 'x', '', undefined]) {
    assert.deepStrictEqual(lib.parsePaquetArgs(['--paquet', v, '--paquets', v]), { paquet: 1, nbPaquets: 1 });
  }
});

test('parsePaquetArgs : valeur manquante après le drapeau → trame unique', () => {
  assert.deepStrictEqual(lib.parsePaquetArgs(['node', 'h.js', '--paquets']), { paquet: 1, nbPaquets: 1 });
});

test('parsePaquetArgs : un NOMBRE NU dans la ligne de commande n\'est PAS une déclaration', () => {
  // ⚠️ Trouvé par mutation le 03/08/2026 : sans la sortie « drapeau absent »,
  //    `argv[i + 1]` avec i = -1 lit `argv[0]` — un argument numérique
  //    quelconque serait alors pris pour un nombre de paquets, et la porte
  //    découperait une injection que personne n'a demandé de fragmenter.
  assert.deepStrictEqual(lib.parsePaquetArgs(['3', '5']), { paquet: 1, nbPaquets: 1 });
  assert.deepStrictEqual(lib.parsePaquetArgs(['2']), { paquet: 1, nbPaquets: 1 });
});

test('parsePaquetArgs : valeur PLANCHER — 0 et négatifs sont ramenés à 1, jamais en dessous', () => {
  assert.deepStrictEqual(lib.parsePaquetArgs(['--paquets', '0']), { paquet: 1, nbPaquets: 1 });
  assert.deepStrictEqual(lib.parsePaquetArgs(['--paquets', '-7']), { paquet: 1, nbPaquets: 1 });
  assert.deepStrictEqual(lib.parsePaquetArgs(['--paquet', '2', '--paquets', '6']), { paquet: 2, nbPaquets: 6 });
});

test('parsePaquetArgs : indice HORS BORNES → repli sûr, jamais le paquet d\'un autre', () => {
  // ⚠️ Émettre le paquet 1 quand on demande le 9e sur 3 mentirait sur le contenu.
  assert.deepStrictEqual(lib.parsePaquetArgs(['--paquet', '9', '--paquets', '3']), { paquet: 1, nbPaquets: 1 });
  assert.deepStrictEqual(lib.parsePaquetArgs(['--paquet', '4', '--paquets', '4']), { paquet: 4, nbPaquets: 4 });
});
