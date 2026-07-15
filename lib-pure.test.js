#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Tests UNITAIRES PURS de lib-pure.js — zéro I/O, zéro spawn, zéro process.
// Cible Stryker (stryker.conf.json → mutate: ["lib-pure.js"]) : chaque
// branche/opérateur de lib-pure.js DOIT être couvert ici pour que la
// mutation testing ait un sens (un mutant survivant = un cas non couvert).
// ═══════════════════════════════════════════════════════════════════════

const lib = require('./lib-pure');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

console.log('lib-pure.test.js\n');

// ── sanitizeSessionId ──
ok('sanitizeSessionId: caractères sûrs conservés', lib.sanitizeSessionId('abc-123_XYZ') === 'abc-123_XYZ');
ok('sanitizeSessionId: caractères dangereux retirés', lib.sanitizeSessionId('../../etc/passwd') === 'etcpasswd');
ok('sanitizeSessionId: vide → "unknown"', lib.sanitizeSessionId('') === 'unknown');
ok('sanitizeSessionId: undefined → "unknown"', lib.sanitizeSessionId(undefined) === 'unknown');
ok('sanitizeSessionId: null → "unknown"', lib.sanitizeSessionId(null) === 'unknown');
ok('sanitizeSessionId: uniquement caractères dangereux → "unknown"', lib.sanitizeSessionId('///') === 'unknown');

// ── serverName ──
ok('serverName: extrait le serveur simple', lib.serverName('mcp__stripe__authenticate') === 'stripe');
ok('serverName: gère les serveurs à underscore multiple', lib.serverName('mcp__plugin_discord_discord__reply') === 'plugin_discord_discord');
ok('serverName: outil natif (pas de préfixe mcp__) → null', lib.serverName('Bash') === null);
ok('serverName: chaîne vide → null', lib.serverName('') === null);
ok('serverName: undefined → null', lib.serverName(undefined) === null);
ok('serverName: préfixe mcp__ mais serveur vide → null', lib.serverName('mcp____tool') === null);

// ── toolSuffix ──
ok('toolSuffix: extrait le suffixe correct', lib.toolSuffix('mcp__stripe__authenticate', 'stripe') === 'authenticate');
ok('toolSuffix: server null → null', lib.toolSuffix('mcp__stripe__authenticate', null) === null);
ok('toolSuffix: tool_name ne correspond pas au préfixe attendu → null', lib.toolSuffix('mcp__odoo__x', 'stripe') === null);
ok('toolSuffix: tool_name vide → null', lib.toolSuffix('', 'stripe') === null);
ok('toolSuffix: suffixe lui-même avec underscores', lib.toolSuffix('mcp__odoo__odoo_call', 'odoo') === 'odoo_call');
ok('toolSuffix: garde explicite server=null empêche un match accidentel sur un tool_name littéral "mcp__null__..."', lib.toolSuffix('mcp__null__foo', null) === null);

// ── getByPath ──
ok('getByPath: chemin simple', lib.getByPath({ a: 'x' }, 'a') === 'x');
ok('getByPath: chemin imbriqué', lib.getByPath({ args: { tool: 'delete_record' } }, 'args.tool') === 'delete_record');
ok('getByPath: chemin absent → null', lib.getByPath({ args: {} }, 'args.tool') === null);
ok('getByPath: objet racine null → null', lib.getByPath(null, 'a.b') === null);
ok('getByPath: dottedPath non-string → null', lib.getByPath({ a: 1 }, null) === null);
ok('getByPath: valeur nombre convertie en string', lib.getByPath({ args: { id: 42 } }, 'args.id') === '42');
ok('getByPath: valeur objet (pas scalaire) → null', lib.getByPath({ args: { tool: {} } }, 'args.tool') === null);
ok('getByPath: valeur array (pas scalaire) → null', lib.getByPath({ args: { tool: [] } }, 'args.tool') === null);
ok('getByPath: chemin traverse un null intermédiaire → null (pas de crash)', lib.getByPath({ args: null }, 'args.tool') === null);

// ── thresholdFor ──
ok('thresholdFor: pas de config → défaut 4', lib.thresholdFor({}, 'stripe') === 4);
ok('thresholdFor: defaultThreshold custom', lib.thresholdFor({ defaultThreshold: 10 }, 'stripe') === 10);
ok('thresholdFor: override serveur prime sur defaultThreshold', lib.thresholdFor({ defaultThreshold: 10, servers: { stripe: { threshold: 1 } } }, 'stripe') === 1);
ok('thresholdFor: override non-entier ignoré → fallback', lib.thresholdFor({ defaultThreshold: 10, servers: { stripe: { threshold: 'oops' } } }, 'stripe') === 10);
ok('thresholdFor: defaultThreshold non-entier → fallback dur 4', lib.thresholdFor({ defaultThreshold: 'oops' }, 'stripe') === 4);
ok('thresholdFor: threshold=0 explicite respecté (falsy mais valide)', lib.thresholdFor({ servers: { stripe: { threshold: 0 } } }, 'stripe') === 0);

// ── modeFor ──
ok('modeFor: pas de config → "smart"', lib.modeFor({}, 'stripe') === 'smart');
ok('modeFor: mode global respecté', lib.modeFor({ mode: 'once' }, 'stripe') === 'once');
ok('modeFor: override serveur prime sur mode global', lib.modeFor({ mode: 'once', servers: { stripe: { mode: 'dumb' } } }, 'stripe') === 'dumb');
ok('modeFor: serveur sans override reste sur le mode global', lib.modeFor({ mode: 'once', servers: { odoo: { mode: 'dumb' } } }, 'stripe') === 'once');

// ── isServerActive ──
ok('isServerActive: filterMode "none" (défaut) → tout actif', lib.isServerActive({}, 'stripe') === true);
ok('isServerActive: whitelist contient le serveur → actif', lib.isServerActive({ filterMode: 'whitelist', filterList: ['stripe'] }, 'stripe') === true);
ok('isServerActive: whitelist ne contient pas le serveur → inactif', lib.isServerActive({ filterMode: 'whitelist', filterList: ['odoo'] }, 'stripe') === false);
ok('isServerActive: blacklist contient le serveur → inactif', lib.isServerActive({ filterMode: 'blacklist', filterList: ['stripe'] }, 'stripe') === false);
ok('isServerActive: blacklist ne contient pas le serveur → actif', lib.isServerActive({ filterMode: 'blacklist', filterList: ['odoo'] }, 'stripe') === true);
ok('isServerActive: filterList absent (whitelist) → tout inactif (liste vide)', lib.isServerActive({ filterMode: 'whitelist' }, 'stripe') === false);
ok('isServerActive: filterList non-array → traité comme vide', lib.isServerActive({ filterMode: 'whitelist', filterList: 'stripe' }, 'stripe') === false);
ok('isServerActive: filterMode inconnu → fail-open (actif)', lib.isServerActive({ filterMode: 'n-importe-quoi' }, 'stripe') === true);
ok('isServerActive: filterMode "none" AVEC filterList non-vide → ignore quand même la liste (pas un blacklist implicite)', lib.isServerActive({ filterMode: 'none', filterList: ['stripe'] }, 'stripe') === true);
ok('isServerActive: filterMode absent AVEC filterList non-vide → même comportement que "none" explicite', lib.isServerActive({ filterList: ['stripe'] }, 'stripe') === true);

// ── isFrameworkEnabled (interrupteur GLOBAL — coupe injection ET tracking) ──
ok('isFrameworkEnabled: pas de champ "enabled" → ON par défaut', lib.isFrameworkEnabled({}) === true);
ok('isFrameworkEnabled: enabled=true explicite → ON', lib.isFrameworkEnabled({ enabled: true }) === true);
ok('isFrameworkEnabled: enabled=false explicite → OFF', lib.isFrameworkEnabled({ enabled: false }) === false);
ok('isFrameworkEnabled: valeur inattendue (ni true ni false) → fail-open ON (pas false littéral)', lib.isFrameworkEnabled({ enabled: 'oops' }) === true);
ok('isFrameworkEnabled: enabled=0 (falsy mais pas false) → ON (seul `false` littéral désactive)', lib.isFrameworkEnabled({ enabled: 0 }) === true);
ok('isFrameworkEnabled: enabled=null → ON (fail-open)', lib.isFrameworkEnabled({ enabled: null }) === true);

// ── shouldShowNotification (contrôle UNIQUEMENT le systemMessage visible, jamais l'injection) ──
ok('shouldShowNotification: pas de champ "showNotification" → ON par défaut', lib.shouldShowNotification({}) === true);
ok('shouldShowNotification: showNotification=true explicite → ON', lib.shouldShowNotification({ showNotification: true }) === true);
ok('shouldShowNotification: showNotification=false explicite → OFF', lib.shouldShowNotification({ showNotification: false }) === false);
ok('shouldShowNotification: valeur inattendue (ni true ni false) → fail-open ON (pas false littéral)', lib.shouldShowNotification({ showNotification: 'oops' }) === true);
ok('shouldShowNotification: showNotification=0 (falsy mais pas false) → ON (seul `false` littéral désactive)', lib.shouldShowNotification({ showNotification: 0 }) === true);
ok('shouldShowNotification: showNotification=null → ON (fail-open)', lib.shouldShowNotification({ showNotification: null }) === true);

// ── formatSystemMessage ──
ok('formatSystemMessage: préfixe explicite [mcp-doc-hooks] pour distinguer des autres sources', lib.formatSystemMessage('stripe', ['server']) === '📄 [mcp-doc-hooks] stripe');
ok('formatSystemMessage: 1 seul niveau (server) → pas de suffixe', lib.formatSystemMessage('stripe', ['server']).includes('(') === false);
ok('formatSystemMessage: 2 niveaux (server+tool) → suffixe avec le niveau additionnel', lib.formatSystemMessage('stripe', ['server', 'tool']) === '📄 [mcp-doc-hooks] stripe (tool)');
ok('formatSystemMessage: 3 niveaux (server+tool+subTool) → les 2 niveaux additionnels listés', lib.formatSystemMessage('odoo', ['server', 'tool', 'subTool']) === '📄 [mcp-doc-hooks] odoo (tool+subTool)');
ok('formatSystemMessage: levels absent/vide → pas de crash, pas de suffixe', lib.formatSystemMessage('stripe', []) === '📄 [mcp-doc-hooks] stripe');
ok('formatSystemMessage: levels non-array → pas de crash, pas de suffixe', lib.formatSystemMessage('stripe', undefined) === '📄 [mcp-doc-hooks] stripe');

// ── shouldInjectFor ──
ok('shouldInjectFor: mode dumb → toujours true', lib.shouldInjectFor('dumb', true, 999, 1) === true);
ok('shouldInjectFor: 1er appel (entrySeen=false) → true, tous modes', lib.shouldInjectFor('once', false, 0, 4) === true);
ok('shouldInjectFor: mode once, déjà vu → false', lib.shouldInjectFor('once', true, 999, 4) === false);
ok('shouldInjectFor: mode smart, sous le seuil → false', lib.shouldInjectFor('smart', true, 2, 4) === false);
ok('shouldInjectFor: mode smart, seuil atteint (égalité) → true', lib.shouldInjectFor('smart', true, 4, 4) === true);
ok('shouldInjectFor: mode smart, au-dessus du seuil → true', lib.shouldInjectFor('smart', true, 5, 4) === true);
ok('shouldInjectFor: mode inconnu, déjà vu → false (comportement "once" par défaut)', lib.shouldInjectFor('n-importe-quoi', true, 999, 4) === false);

// ── docCandidatePaths ──
{
  const c1 = lib.docCandidatePaths({}, 'stripe', 'mcp__stripe__authenticate', {});
  const lvl1 = c1.find((c) => c.relPath === 'stripe.md');
  const lvl2 = c1.find((c) => c.relPath === 'stripe/authenticate.md');
  ok('docCandidatePaths: niveau 1 (serveur) toujours présent', !!lvl1);
  ok('docCandidatePaths: niveau 1 sourceLabel correct', lvl1 && lvl1.sourceLabel === 'docs/mcp/stripe.md');
  ok('docCandidatePaths: niveau 1 label "server"', lvl1 && lvl1.level === 'server');
  ok('docCandidatePaths: niveau 2 (outil) présent si suffixe extrait', !!lvl2);
  ok('docCandidatePaths: niveau 2 sourceLabel correct', lvl2 && lvl2.sourceLabel === 'docs/mcp/stripe/authenticate.md');
  ok('docCandidatePaths: niveau 2 label "tool"', lvl2 && lvl2.level === 'tool');
  ok('docCandidatePaths: pas de niveau 3 sans subToolParam configuré', c1.length === 2);
}
{
  const c2 = lib.docCandidatePaths(
    { servers: { odoo: { subToolParam: 'args.tool' } } },
    'odoo', 'mcp__odoo__odoo_call', { args: { tool: 'delete_record' } }
  );
  const lvl3 = c2.find((c) => c.relPath === 'odoo/delete_record.md');
  ok('docCandidatePaths: niveau 3 (sous-outil) ajouté si subToolParam configuré et résolu', !!lvl3);
  ok('docCandidatePaths: niveau 3 sourceLabel correct', lvl3 && lvl3.sourceLabel === 'docs/mcp/odoo/delete_record.md');
  ok('docCandidatePaths: niveau 3 label "subTool"', lvl3 && lvl3.level === 'subTool');
  ok('docCandidatePaths: niveau 2 aussi présent (odoo_call) en plus du niveau 3', c2.some((c) => c.relPath === 'odoo/odoo_call.md'));
  ok('docCandidatePaths: 3 niveaux distincts quand tool !== subTool', c2.length === 3);
}
{
  // ⚠️ Cas de dédoublonnage : le "tool" ET le "subTool" pointent vers le même nom.
  const c3 = lib.docCandidatePaths(
    { servers: { same: { subToolParam: 'args.tool' } } },
    'same', 'mcp__same__foo', { args: { tool: 'foo' } }
  );
  ok('docCandidatePaths: dédoublonne si subTool === suffix (pas de doublon)', c3.filter((c) => c.relPath === 'same/foo.md').length === 1);
  ok('docCandidatePaths: total 2 candidats (serveur + outil, pas de 3e dupliqué)', c3.length === 2);
}
{
  const c4 = lib.docCandidatePaths({}, 'bash-like', 'Bash', {});
  ok('docCandidatePaths: tool_name ne matchant pas le préfixe attendu → pas de niveau 2', c4.length === 1);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
