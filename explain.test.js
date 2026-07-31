// ═══════════════════════════════════════════════════════════════════════
// SUITE D'EXPLAIN — par SPAWN RÉEL sur un parc jetable (tmpdir).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ SPAWN, jamais d'appel in-process : l'outil doit être prouvé TEL QU'UN
//    HUMAIN L'UTILISE (CLI + argv + exit code). Un test in-process validerait
//    des fonctions, pas l'outil.
//
// ⚠️ PARC JETABLE OBLIGATOIRE (MCP_DOC_FILEDOCS_DIR) : écrire une doc de test
//    dans le vrai parc l'injecterait CHEZ TOUS LES AGENTS qui tournent en
//    parallèle. Le parc réel est de la PROD.
//
// ⚠️ LES 2 CAS FONDATEURS (a) et (b) REJOUENT les faux verts qui ont coûté la
//    session du 31/07/2026. Ils ne sont pas illustratifs : ils sont la RAISON
//    D'ÊTRE de l'outil. Ne JAMAIS les supprimer — si un jour le joker est
//    implémenté (§B), le cas (a) doit être MIS À JOUR (verdict inversé),
//    jamais retiré : il devient la preuve que le joker marche.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const EXPLAIN = path.join(ICI, 'explain.js');

// Parc jetable + doc(s) écrites par le test lui-même (thunk : rien au niveau
// module, cf doctrine perTest).
function parcAvec(docs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explain-parc-'));
  for (const [nom, contenu] of Object.entries(docs)) {
    fs.writeFileSync(path.join(dir, nom), contenu, 'utf8');
  }
  return dir;
}

function lancer(args, parc) {
  return execFileSync(process.execPath, [EXPLAIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, MCP_DOC_FILEDOCS_DIR: parc },
  });
}
const json = (args, parc) => JSON.parse(lancer([...args, '--json'], parc));

test('VERDICT : une doc qui matche par le chemin est rendue INJECTÉE', () => {
  const parc = parcAvec({ 'cible.md': '---\nmatch: gate.js\nmode: dumb\n---\nCorps.\n' });
  const r = json(['--file', 'C:/projet/gate.js'], parc);
  assert.ok(r.inject.includes('docs/cible.md'), 'la doc devrait être injectée');
  assert.equal(r.decision, 'allow');
});

test('CAS FONDATEUR (a) — `tool: ["*"]` : le joker INJECTE (verdict inversé le 31/07)', () => {
  // ⚠️ CE TEST A CHANGÉ DE VERDICT, il n'a PAS été supprimé (cf en-tête) : il
  //    prouvait le faux vert (`*` accepté ET inerte), il prouve maintenant que
  //    le joker VIT. C'est le même cas fondateur, devenu preuve de la fonction.
  const parc = parcAvec({ 'joker.md': '---\ntool: ["*"]\nscope: ["docker run"]\nmode: dumb\n---\nCorps.\n' });
  const r = json(['--doc', 'joker', '--tool', 'Bash', '--input', '{"command":"docker run -d nginx"}'], parc);
  assert.equal(r.diagnostic.injecte, true, 'le joker doit désormais matcher n\'importe quel outil');
  assert.ok(r.inject.includes('docs/joker.md'));
});

test('CAS FONDATEUR (a bis) — joker + geste ABSENT : motif = `scope`, jamais « outil non listé »', () => {
  // ⚠️ RÉGRESSION GUETTÉE : avec un `includes` réécrit dans explain, ce cas
  //    rendait « l'outil n'y figure pas » (FAUX MOTIF) au lieu du scope. Un
  //    diagnostic qui se trompe de cause est pire que pas de diagnostic.
  const parc = parcAvec({ 'joker.md': '---\ntool: ["*"]\nscope: ["docker run"]\nmode: dumb\n---\nCorps.\n' });
  const r = json(['--doc', 'joker', '--tool', 'Bash', '--input', '{"command":"ls -la"}'], parc);
  assert.equal(r.diagnostic.injecte, false);
  assert.ok(/scope/.test(r.diagnostic.motif), 'motif attendu: scope, reçu: ' + r.diagnostic.motif);
});

test('CAS FONDATEUR (b) — `mcp:` dans le corpus fichier : muette, et on dit OÙ aller', () => {
  // ⚠️ Depuis le durcissement du 31/07 (§A), ce cas est attrapé PLUS TÔT : par
  //    `validate()`, donc aussi par la garde d'écriture (l'auteur est bloqué à
  //    la seconde où il écrit, il ne découvre plus le silence des jours après).
  //    explain le confirme et RELAIE le message qui répare. Le test suit la
  //    réalité du moteur — il ne fige pas un chemin de code particulier.
  const parc = parcAvec({ 'mauvais.md': '---\nmcp: stripe\n---\nCorps.\n' });
  const r = json(['--doc', 'mauvais', '--tool', 'mcp__stripe__foo', '--input', '{}'], parc);
  assert.equal(r.diagnostic.injecte, false);
  const tout = [r.diagnostic.motif, r.diagnostic.piege, JSON.stringify(r.diagnostic.detail)].join(' | ');
  assert.ok(/CHEMIN/.test(tout), 'le diagnostic DOIT dire où la doc aurait dû aller, reçu: ' + tout);
  assert.ok(/docs\/mcp\//.test(tout), 'le chemin exact doit être donné (paved road)');
});

test('MOTIF `scope` non satisfait — distingué de « pattern absent »', () => {
  const parc = parcAvec({ 's.md': '---\nmatch: gate.js\nscope: [projet-x]\nmode: dumb\n---\nCorps.\n' });
  const r = json(['--file', 'C:/autre/gate.js'], parc);
  assert.equal(r.diagnostic, null, 'sans --doc, pas de diagnostic ciblé');
  const d = json(['--doc', 's.md', '--file', 'C:/autre/gate.js'], parc).diagnostic;
  assert.equal(d.injecte, false);
  assert.ok(/scope/.test(d.motif), 'motif attendu: scope non satisfait, reçu: ' + d.motif);
});

test('MOTIF `exclude` — distingué de `scope`', () => {
  const parc = parcAvec({ 'e.md': '---\nmatch: gate.js\nexclude: [node_modules]\nmode: dumb\n---\nCorps.\n' });
  const d = json(['--doc', 'e.md', '--file', 'C:/p/node_modules/gate.js'], parc).diagnostic;
  assert.equal(d.injecte, false);
  assert.ok(/exclude/.test(d.motif), 'motif attendu: exclude, reçu: ' + d.motif);
});

test('MOTIF « aucun pattern ne matche » liste les CONTEXTES réellement testés', () => {
  const parc = parcAvec({ 'p.md': '---\nmatch: introuvable.js\nmode: dumb\n---\nCorps.\n' });
  const d = json(['--doc', 'p.md', '--file', 'C:/projet/gate.js'], parc).diagnostic;
  assert.equal(d.injecte, false);
  assert.ok(d.detail.contextesTestes.some((c) => /gate\.js/.test(c)),
    'le diagnostic DOIT montrer ce qui a été confronté aux patterns');
});

test('MOTIF commande git — le silence PAR CONSTRUCTION est nommé', () => {
  // ⚠️ sources/file.js ignore toute commande git (faux positifs de messages de
  //    commit). Sans ce motif, un auteur testant avec `git ...` voit un silence
  //    inexplicable et accuse sa règle.
  const parc = parcAvec({ 'g.md': '---\nmatch: gate.js\nmode: dumb\n---\nCorps.\n' });
  const d = json(['--doc', 'g.md', '--tool', 'Bash', '--input', '{"command":"git add gate.js"}'], parc).diagnostic;
  assert.equal(d.injecte, false);
  assert.ok(/GIT/.test(d.motif), 'motif attendu: commande git ignorée, reçu: ' + d.motif);
});

test('MOTIF frontmatter INVALIDE — la doc est morte pour TOUS les payloads', () => {
  const parc = parcAvec({ 'bad.md': '---\nmach: gate.js\nmode: dumb\n---\nCorps.\n' });
  const d = json(['--doc', 'bad', '--file', 'C:/projet/gate.js'], parc).diagnostic;
  assert.equal(d.injecte, false);
  assert.ok(/INVALIDE/.test(d.motif));
  assert.ok(d.detail.some((e) => /mach/.test(e)), 'les erreurs de validate doivent être rendues');
});

test('MOTIF `inject: never` — silence VOULU, jamais confondu avec un oubli', () => {
  const parc = parcAvec({ 'ref.md': '---\ninject: never\n---\nCorps.\n' });
  const d = json(['--doc', 'ref', '--file', 'C:/projet/gate.js'], parc).diagnostic;
  assert.equal(d.injecte, false);
  assert.ok(/VOULU/.test(d.motif));
});

test('LECTURE SEULE : explain n\'écrit JAMAIS dans le store de session', () => {
  // ⚠️ Une doc `once` consommée par un simple diagnostic priverait la vraie
  //    session de son injection. L'outil doit être sans effet de bord.
  const parc = parcAvec({ 'o.md': '---\nmatch: gate.js\nmode: once\n---\nCorps.\n' });
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explain-state-'));
  execFileSync(process.execPath, [EXPLAIN, '--file', 'C:/projet/gate.js', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, MCP_DOC_FILEDOCS_DIR: parc, MCP_DOC_STATE_DIR: stateDir },
  });
  assert.deepEqual(fs.readdirSync(stateDir), [], 'aucun fichier d\'état ne doit être créé');
});

test('FAIL-LOUD : parc introuvable → exit 2 + message qui dit que c\'est L\'OUTIL', () => {
  // ⚠️ L'inverse des hooks (fail-open muet) : un diagnostic silencieux sur sa
  //    propre panne se lit comme « rien ne s'injecte » = faux verdict moteur.
  let sortie = null;
  try {
    lancer(['--file', 'C:/projet/gate.js'], path.join(os.tmpdir(), 'parc-qui-n-existe-pas-' + Date.now()));
    assert.fail('explain aurait dû sortir en erreur');
  } catch (e) {
    sortie = e;
  }
  assert.equal(sortie.status, 2, 'exit code 2 attendu');
  assert.ok(/PANNE DE L'OUTIL/.test(String(sortie.stderr)),
    'le message doit dire explicitement que ce n\'est PAS un verdict sur le moteur');
});

test('NEGATIVE-CHECK : le harnais de test peut vraiment RATER (sinon il certifie du vide)', () => {
  // ⚠️ Sans ce test, une suite qui n'appelle rien resterait verte à vie —
  //    exactement le « gate aveugle qui certifie au lieu de protéger ».
  const parc = parcAvec({ 'x.md': '---\nmatch: jamais-ce-nom.js\nmode: dumb\n---\nCorps.\n' });
  const r = json(['--file', 'C:/projet/gate.js'], parc);
  assert.equal(r.inject.includes('docs/x.md'), false,
    'une doc dont le pattern ne matche pas NE DOIT PAS être rendue injectée');
});
