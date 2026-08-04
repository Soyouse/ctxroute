// ═══════════════════════════════════════════════════════════════════════
// Tests DÉTERMINISTES de gate.js (cible Stryker — cf vitest.stryker.config.mjs).
// ⚠️ Valeurs de CONTRAT écrites EN DUR (jamais dérivées du code testé).
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { decide, docLabel, WRITE_TOOLS, modeForDoc, thresholdForDoc, driftUnitForDoc } from './gate.js';

const DUMB = { mode: 'dumb', confirm: true };

// ── WRITE_TOOLS = contrat épinglé (copie de protect-files.js) ──
test('WRITE_TOOLS : liste EXACTE héritée de protect-files.js', () => {
  assert.deepStrictEqual(WRITE_TOOLS, ['mcp__ssh__ssh_edit_file', 'mcp__ssh__ssh_write_file', 'mcp__ssh__ssh_upload_file', 'Edit', 'Write', 'apply_patch']);
});

// ── modeForDoc : précédence frontmatter > config global > smart ──
test('modeForDoc : decl.mode gagne sur config.mode', () => {
  assert.strictEqual(modeForDoc({ mode: 'smart' }, { mode: 'dumb' }), 'dumb');
});
test('modeForDoc : config.mode si decl muet, smart par défaut', () => {
  assert.strictEqual(modeForDoc({ mode: 'once' }, {}), 'once');
  assert.strictEqual(modeForDoc({}, undefined), 'smart');
});

// ── dumb : injecte toujours, N'ÉCRIT JAMAIS d'état ──
test('dumb : injecte à chaque appel, state intact, changed=false', () => {
  const decls = { 'docs/a.md': DUMB };
  const r1 = decide({}, decls, ['docs/a.md'], 'Read', {});
  assert.deepStrictEqual(r1.inject, ['docs/a.md']);
  assert.strictEqual(r1.decision, 'allow');
  assert.strictEqual(r1.changed, false);
  assert.deepStrictEqual(r1.state, {});
  const r2 = decide({}, decls, ['docs/a.md'], 'Read', r1.state);
  assert.deepStrictEqual(r2.inject, ['docs/a.md']); // toujours, pas « une fois »
});

// ── ordre d'injection = ordre matché ──
test('inject préserve l\'ordre de matched (parent→enfant)', () => {
  const decls = { 'docs/p.md': DUMB, 'docs/e.md': DUMB };
  const r = decide({}, decls, ['docs/p.md', 'docs/e.md'], 'Read', {});
  assert.deepStrictEqual(r.inject, ['docs/p.md', 'docs/e.md']);
});

// ── ask : outil d'écriture + doc confirm: true injectée ──
test('ask sur Edit quand une doc injectée a confirm: true', () => {
  const r = decide({}, { 'docs/a.md': DUMB }, ['docs/a.md'], 'Edit', {});
  assert.strictEqual(r.decision, 'ask');
});
test('allow sur Read même avec confirm: true', () => {
  const r = decide({}, { 'docs/a.md': DUMB }, ['docs/a.md'], 'Read', {});
  assert.strictEqual(r.decision, 'allow');
});
test('allow sur Edit quand AUCUNE doc injectée ne confirme', () => {
  const r = decide({}, { 'docs/a.md': { mode: 'dumb' } }, ['docs/a.md'], 'Edit', {});
  assert.strictEqual(r.decision, 'allow');
});
test('config.confirm === false (rush) éteint le ask, l\'injection continue', () => {
  const r = decide({ confirm: false }, { 'docs/a.md': DUMB }, ['docs/a.md'], 'Write', {});
  assert.strictEqual(r.decision, 'allow');
  assert.deepStrictEqual(r.inject, ['docs/a.md']);
});
test('ask si AU MOINS une des docs injectées confirme (mix)', () => {
  const decls = { 'docs/a.md': { mode: 'dumb' }, 'docs/b.md': DUMB };
  const r = decide({}, decls, ['docs/a.md', 'docs/b.md'], 'apply_patch', {});
  assert.strictEqual(r.decision, 'ask');
});

// ── decl absente pour une doc matchée : jamais de throw, jamais d'ask inventé ──
test('doc matchée sans decl : mode global appliqué, pas de throw, pas d\'ask', () => {
  const r = decide({ mode: 'dumb' }, {}, ['docs/x.md'], 'Edit', {});
  assert.deepStrictEqual(r.inject, ['docs/x.md']);
  assert.strictEqual(r.decision, 'allow');
});

// ── none : rien d'injecté ──
test('none quand matched est vide', () => {
  const r = decide({}, {}, [], 'Edit', {});
  assert.strictEqual(r.decision, 'none');
  assert.deepStrictEqual(r.inject, []);
});

// ── smart : 1er appel injecte, rappel immédiat se tait, seuil réinjecte ──
test('smart : inject au 1er appel, état écrit (changed=true)', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  // ⚠️ CONTRAT depuis driftUnit (18/07/2026) : l'appelant passe TOUJOURS un
  //    entier turnCount (0 si inconnu) et l'état porte l'horodatage `turn`.
  const r = decide({}, decls, ['docs/s.md'], 'Read', {}, 0);
  assert.deepStrictEqual(r.inject, ['docs/s.md']);
  assert.strictEqual(r.changed, true);
  assert.deepStrictEqual(r.state, { 'docs/s.md': { seen: true, sinceLastCall: 0, turn: 0 } });
});
test('smart : rappel immédiat = silencieux, changed=false (état identique)', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  const state = { 'docs/s.md': { seen: true, sinceLastCall: 0 } };
  const r = decide({}, decls, ['docs/s.md'], 'Read', state);
  assert.deepStrictEqual(r.inject, []);
  assert.strictEqual(r.decision, 'none');
  assert.strictEqual(r.changed, false);
});
test('smart : appel étranger incrémente le compteur (changed=true)', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  const state = { 'docs/s.md': { seen: true, sinceLastCall: 0 } };
  const r = decide({}, decls, [], 'Bash', state);
  assert.deepStrictEqual(r.state, { 'docs/s.md': { seen: true, sinceLastCall: 1 } });
  assert.strictEqual(r.changed, true);
});
test('smart : réinjecte au seuil (défaut 4), compteur remis à 0', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  const state = { 'docs/s.md': { seen: true, sinceLastCall: 4, turn: 0 } };
  const r = decide({}, decls, ['docs/s.md'], 'Read', state, 0);
  assert.deepStrictEqual(r.inject, ['docs/s.md']);
  assert.deepStrictEqual(r.state, { 'docs/s.md': { seen: true, sinceLastCall: 0, turn: 0 } });
  assert.strictEqual(r.changed, true); // sinceLastCall 4 → 0
});
test('smart : sous le seuil = silencieux (3 < 4)', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  const r = decide({}, decls, ['docs/s.md'], 'Read', { 'docs/s.md': { seen: true, sinceLastCall: 3 } });
  assert.deepStrictEqual(r.inject, []);
});
test('defaultThreshold de la config est honoré (2)', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  const r = decide({ defaultThreshold: 2 }, decls, ['docs/s.md'], 'Read', { 'docs/s.md': { seen: true, sinceLastCall: 2 } });
  assert.deepStrictEqual(r.inject, ['docs/s.md']);
});
test('defaultThreshold non entier → retombe sur 4', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  const r = decide({ defaultThreshold: 'trois' }, decls, ['docs/s.md'], 'Read', { 'docs/s.md': { seen: true, sinceLastCall: 3 } });
  assert.deepStrictEqual(r.inject, []);
});

// ── once : 1er appel seulement, jamais d'incrément étranger ──
test('once : injecte au 1er appel puis plus jamais', () => {
  const decls = { 'docs/o.md': { mode: 'once' } };
  const r1 = decide({}, decls, ['docs/o.md'], 'Read', {});
  assert.deepStrictEqual(r1.inject, ['docs/o.md']);
  const r2 = decide({}, decls, ['docs/o.md'], 'Read', r1.state);
  assert.deepStrictEqual(r2.inject, []);
});
test('once : un appel étranger ne touche NI son compteur NI changed', () => {
  const decls = { 'docs/o.md': { mode: 'once' } };
  const state = { 'docs/o.md': { seen: true, sinceLastCall: 0 } };
  const r = decide({}, decls, [], 'Bash', state);
  assert.deepStrictEqual(r.state, state);
  assert.strictEqual(r.changed, false);
});

// ── state corrompu : une entrée null ne fait JAMAIS throw (fail-open pur) ──
test('entrée de state null : passthrough sans throw, changed=false', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  const r = decide({}, decls, [], 'Bash', { 'docs/s.md': null });
  assert.deepStrictEqual(r.state, { 'docs/s.md': null });
  assert.strictEqual(r.changed, false);
});

// ── pureté : les arguments ne sont JAMAIS mutés ──
test('decide ne mute pas le state passé en argument', () => {
  const decls = { 'docs/s.md': { mode: 'smart' } };
  const state = { 'docs/s.md': { seen: true, sinceLastCall: 1 } };
  decide({}, decls, [], 'Bash', state);
  assert.deepStrictEqual(state, { 'docs/s.md': { seen: true, sinceLastCall: 1 } });
});

// ── docLabel : réplique protect-files (PREMIER [source:], titre en secours) ──
test('docLabel : premier tag [source:], basename sans .md', () => {
  assert.strictEqual(docLabel('blabla\n[source: .claude/hooks/docs/foo.md]\n[source: .claude/hooks/docs/bar.md]'), 'foo');
});
test('docLabel : titre markdown en secours, tronqué à 40', () => {
  assert.strictEqual(docLabel('# Un titre'), 'Un titre');
  assert.strictEqual(docLabel('# ' + 'x'.repeat(60)), 'x'.repeat(40));
});
test('docLabel : rien → chaîne vide (pas de systemMessage)', () => {
  assert.strictEqual(docLabel('texte sans marqueur ni titre'), '');
  assert.strictEqual(docLabel(null), '');
});

// ── thresholdForDoc (fusion MCP 17/07/2026) ─────────────────────────────
// decl.threshold (posé par une source, ex. MCP) > defaultThreshold > 4.
// Cas déterministes OBLIGATOIRES (Stryker ne lance jamais les property).

test('thresholdForDoc : decl.threshold entier > defaultThreshold > défaut 4', () => {
  assert.equal(thresholdForDoc({ defaultThreshold: 6 }, { threshold: 2 }), 2);
  assert.equal(thresholdForDoc({ defaultThreshold: 6 }, {}), 6);
  assert.equal(thresholdForDoc({}, {}), 4);
  assert.equal(thresholdForDoc({}, undefined), 4);
  // non-entier = ignoré (jamais un NaN silencieux dans la comparaison)
  assert.equal(thresholdForDoc({ defaultThreshold: 6 }, { threshold: '2' }), 6);
  assert.equal(thresholdForDoc({ defaultThreshold: '6' }, {}), 4);
  // ⚠️ 0 est un entier LÉGITIME (réinjection à chaque outil étranger) — un
  // `||` l'avalerait : cas anti-mutant ET anti-régression.
  assert.equal(thresholdForDoc({ defaultThreshold: 6 }, { threshold: 0 }), 0);
});

test('decide : le seuil PAR DOC gouverne la réinjection smart (deux docs, deux seuils)', () => {
  const config = { defaultThreshold: 4 };
  const decls = { 'mcp/a.md': { mode: 'smart', threshold: 1 }, 'mcp/b.md': { mode: 'smart', threshold: 3 } };
  // a et b vues, 1 outil étranger écoulé chacun.
  const state = {
    'mcp/a.md': { seen: true, sinceLastCall: 1 },
    'mcp/b.md': { seen: true, sinceLastCall: 1 },
  };
  const r = decide(config, decls, ['mcp/a.md', 'mcp/b.md'], 'Read', state);
  // a (seuil 1) réinjecte, b (seuil 3) se tait — le seuil est bien PAR doc.
  assert.deepEqual(r.inject, ['mcp/a.md']);
});

// ── driftUnit (18/07/2026) : unité du compteur smart, cascade 3 autorités ──

import { driftUnitForDoc } from './gate.js';

test('driftUnitForDoc : decl > defaultDriftUnit global > défaut framework tool', () => {
  assert.equal(driftUnitForDoc({ defaultDriftUnit: 'turn' }, { driftUnit: 'tool' }), 'tool');
  assert.equal(driftUnitForDoc({ defaultDriftUnit: 'turn' }, {}), 'turn');
  assert.equal(driftUnitForDoc({}, {}), 'tool');
  assert.equal(driftUnitForDoc(undefined, undefined), 'tool');
  // invalide à un étage = on DESCEND (fallback total), jamais un NaN d'unité
  assert.equal(driftUnitForDoc({ defaultDriftUnit: 'turn' }, { driftUnit: 'bogus' }), 'turn');
  assert.equal(driftUnitForDoc({ defaultDriftUnit: 'bogus' }, {}), 'tool');
});

test('decide/turn : smart driftUnit turn — réinjecte quand N TOURS se sont écoulés, pas avant', () => {
  const decls = { 'skill/a': { mode: 'smart', threshold: 2, driftUnit: 'turn' } };
  // vue au tour 3 : au tour 4 (écoulé 1 < 2) silence, au tour 5 (écoulé 2 >= 2) réinjection.
  const state = { 'skill/a': { seen: true, sinceLastCall: 0, turn: 3 } };
  assert.deepEqual(decide({}, decls, ['skill/a'], 'Read', state, 4).inject, []);
  assert.deepEqual(decide({}, decls, ['skill/a'], 'Read', state, 5).inject, ['skill/a']);
});

test('decide/turn : les appels d\'outils étrangers ne comptent PAS pour une doc turn', () => {
  const decls = { 'skill/a': { mode: 'smart', threshold: 1, driftUnit: 'turn' } };
  // 1er match au tour 2 : injecte + écrit turn=2.
  const r1 = decide({}, decls, ['skill/a'], 'Read', {}, 2);
  assert.deepEqual(r1.inject, ['skill/a']);
  assert.deepEqual(r1.state['skill/a'], { seen: true, sinceLastCall: 0, turn: 2 });
  // appel étranger (doc non matchée) : le compteur OUTIL de la doc turn ne bouge PAS
  // (et donc AUCUNE écriture d'état — changed=false).
  const r2 = decide({}, decls, [], 'Bash', r1.state, 2);
  assert.deepEqual(r2.state['skill/a'], { seen: true, sinceLastCall: 0, turn: 2 });
  assert.equal(r2.changed, false);
  // re-match au MÊME tour : 0 tour écoulé → silence.
  assert.deepEqual(decide({}, decls, ['skill/a'], 'Read', r2.state, 2).inject, []);
});

test('decide/turn : la réinjection RÉARME l\'horodatage turn (pas de réinjection en rafale)', () => {
  const decls = { 'skill/a': { mode: 'smart', threshold: 1, driftUnit: 'turn' } };
  const state = { 'skill/a': { seen: true, sinceLastCall: 0, turn: 1 } };
  const r = decide({}, decls, ['skill/a'], 'Read', state, 3);
  assert.deepEqual(r.inject, ['skill/a']);
  // turn réécrit à 3 + changed=true (sinon l'état garde turn=1 et la doc
  // réinjecterait à CHAQUE match suivant — dumb déguisé).
  assert.deepEqual(r.state['skill/a'], { seen: true, sinceLastCall: 0, turn: 3 });
  assert.equal(r.changed, true);
});

test('decide/tool : une doc smart tool IGNORE turnCount (parité historique stricte)', () => {
  const decls = { 'mcp/a.md': { mode: 'smart', threshold: 2 } };
  const state = { 'mcp/a.md': { seen: true, sinceLastCall: 1, turn: 0 } };
  // turnCount énorme : sans effet — seule sinceLastCall compte pour l'unité tool.
  assert.deepEqual(decide({}, decls, ['mcp/a.md'], 'Read', state, 999).inject, []);
});

test('decide : defaultDriftUnit turn GLOBAL s\'applique aux docs sans driftUnit propre', () => {
  const config = { defaultDriftUnit: 'turn' };
  const decls = { 'mcp/a.md': { mode: 'smart', threshold: 1 } };
  const state = { 'mcp/a.md': { seen: true, sinceLastCall: 0, turn: 1 } };
  assert.deepEqual(decide(config, decls, ['mcp/a.md'], 'Read', state, 1).inject, []);
  assert.deepEqual(decide(config, decls, ['mcp/a.md'], 'Read', state, 2).inject, ['mcp/a.md']);
});

// ═══════════════════════════════════════════════════════════════════════
// CASCADE 4 ÉTAGES — `defaults.{source}` (04/08/2026)
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ POINT UNIQUE de résolution. Ces cas sont le CONTRAT : entrée >
//    defaults.{source} > global > défaut FRAMEWORK, avec fallback TOTAL
//    (valeur invalide à un étage ⇒ on DESCEND, jamais d'erreur).
// ⚠️ Valeurs attendues écrites EN DUR, jamais dérivées du code sous test.
const eq = (a, b, m) => assert.strictEqual(a, b, m);

test('cascade : SANS defaults, comportement d\'AVANT à l\'identique (parité)', () => {
  eq(modeForDoc({}, {}, 'file'), 'smart');
  eq(modeForDoc({ mode: 'once' }, {}, 'file'), 'once');
  eq(modeForDoc({ mode: 'once' }, { mode: 'dumb' }, 'file'), 'dumb');
  eq(modeForDoc({}, {}, 'skill'), 'once');
});

test('cascade : defaults.{source} s\'applique à SA catégorie et à elle seule', () => {
  const c = { defaults: { mcp: { mode: 'dumb' }, skill: { mode: 'smart' } } };
  eq(modeForDoc(c, {}, 'mcp'), 'dumb');
  eq(modeForDoc(c, {}, 'skill'), 'smart');
  eq(modeForDoc(c, {}, 'file'), 'smart');
  eq(modeForDoc(c, {}, 'tool'), 'smart');
});

test('cascade : l\'ENTRÉE garde le dernier mot sur defaults.{source}', () => {
  eq(modeForDoc({ defaults: { mcp: { mode: 'dumb' } } }, { mode: 'once' }, 'mcp'), 'once');
});

test('cascade : defaults.{source} écrase le GLOBAL (étage plus spécifique)', () => {
  const c = { mode: 'once', defaults: { file: { mode: 'dumb' } } };
  eq(modeForDoc(c, {}, 'file'), 'dumb');
  eq(modeForDoc(c, {}, 'mcp'), 'once');
});

test('cascade : valeur INVALIDE à un étage -> on DESCEND (fallback total)', () => {
  eq(modeForDoc({ defaults: { file: { mode: 'bogus' } }, mode: 'once' }, {}, 'file'), 'once');
  eq(modeForDoc({ defaults: { file: { mode: 'bogus' } } }, {}, 'file'), 'smart');
  eq(modeForDoc({ defaults: { file: { mode: 'dumb' } } }, { mode: 'bogus' }, 'file'), 'dumb');
});

test('cascade : source INCONNUE/absente -> règles génériques (jamais un plantage)', () => {
  const c = { defaults: { file: { mode: 'dumb' } } };
  eq(modeForDoc(c, {}, 'inexistante'), 'smart');
  eq(modeForDoc(c, {}, undefined), 'smart');
  eq(modeForDoc(null, null, null), 'smart');
});

// ⚠️ ASYMÉTRIE VOLONTAIRE — un skill NE consulte PAS le mode global. Sans ce cas,
//    « uniformiser les sources » passerait vert et ferait basculer TOUS les skills
//    à la première config globale posée (régression silencieuse).
test('cascade : le GLOBAL ne touche JAMAIS les skills (asymétrie scellée)', () => {
  eq(modeForDoc({ mode: 'dumb' }, {}, 'skill'), 'once');
  eq(modeForDoc({ mode: 'smart' }, {}, 'skill'), 'once');
  eq(modeForDoc({ mode: 'dumb', defaults: { skill: { mode: 'smart' } } }, {}, 'skill'), 'smart');
});

test('cascade : threshold — entrée > defaults.{source} > global > 4', () => {
  eq(thresholdForDoc({}, {}, 'file'), 4);
  eq(thresholdForDoc({ defaultThreshold: 7 }, {}, 'file'), 7);
  eq(thresholdForDoc({ defaultThreshold: 7, defaults: { file: { threshold: 2 } } }, {}, 'file'), 2);
  eq(thresholdForDoc({ defaults: { file: { threshold: 2 } } }, { threshold: 9 }, 'file'), 9);
  eq(thresholdForDoc({ defaults: { file: { threshold: 1 } } }, {}, 'file'), 1);
  eq(thresholdForDoc({ defaultThreshold: 7, defaults: { file: { threshold: 0 } } }, {}, 'file'), 7);
  eq(thresholdForDoc({ defaults: { mcp: { threshold: 2 } } }, {}, 'file'), 4);
});

test('cascade : driftUnit — entrée > defaults.{source} > defaultDriftUnit > tool', () => {
  eq(driftUnitForDoc({}, {}, 'file'), 'tool');
  eq(driftUnitForDoc({ defaultDriftUnit: 'turn' }, {}, 'file'), 'turn');
  eq(driftUnitForDoc({ defaultDriftUnit: 'turn', defaults: { file: { driftUnit: 'tool' } } }, {}, 'file'), 'tool');
  eq(driftUnitForDoc({ defaults: { file: { driftUnit: 'turn' } } }, { driftUnit: 'tool' }, 'file'), 'tool');
  eq(driftUnitForDoc({ defaults: { file: { driftUnit: 'bogus' } }, defaultDriftUnit: 'turn' }, {}, 'file'), 'turn');
});

// ⚠️ decide() DOIT transmettre la source à la cascade. Sans ce cas, `defaults`
//    pourrait être accepté par le schéma et rester SANS EFFET — exactement le
//    faux vert que ce repo combat. On prouve l'EFFET, pas la présence du param.
test('cascade : decide() consomme owners — defaults.{source} a un EFFET réel', () => {
  // `dumb` réinjecte TOUJOURS · `smart` (défaut d'avant) se tait tant que le
  // seuil n'est pas atteint. Les deux branches DOIVENT donc différer — sinon le
  // cas serait décoratif (piège vérifié : avec `once`, les deux se taisent).
  const config = { defaults: { mcp: { mode: 'dumb' } } };
  const decls = { 'mcp/x': {} };
  const etat = () => ({ 'mcp/x': { seen: true, sinceLastCall: 0 } });
  const avec = decide(config, decls, ['mcp/x'], 'Read', etat(), 0, { 'mcp/x': 'mcp' });
  assert.deepStrictEqual(avec.inject, ['mcp/x'], 'defaults.mcp = dumb => réinjecte');
  const sans = decide(config, decls, ['mcp/x'], 'Read', etat(), 0, undefined);
  assert.deepStrictEqual(sans.inject, [], 'sans owners => cascade d\'avant (smart, seuil non atteint)');
});
