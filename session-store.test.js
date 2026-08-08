// ═══════════════════════════════════════════════════════════════════════
// session-store.js — L'ÉCRITURE DOIT ÊTRE ATOMIQUE (07/08/2026)
// ═══════════════════════════════════════════════════════════════════════
// 🔴 DÉFAUT RÉEL, MESURÉ : `fs.writeFileSync` TRONQUE le fichier avant de le
//    remplir. Un lecteur concurrent voit donc un fichier VIDE ou PARTIEL,
//    `JSON.parse` lève, `loadState` rend `{}` — c'est-à-dire l'AFFIRMATION
//    « aucune doc n'a jamais été injectée ». Mesure sur l'état RÉEL du parc
//    (209 octets, médiane mesurée 63) : **9 596 lectures fantômes sur 24 147**.
//
// ⚠️ POURQUOI ÇA COMPTE DEPUIS LE 07/08/2026 : le repli sans verrou de
//    `porte-core.js` LIT désormais l'état (il le devinait avant). Cette lecture
//    est SANS verrou par construction — c'est tout l'intérêt du repli. Sans
//    écriture atomique, elle retombe sur le même morceau fantôme qu'elle
//    corrige. Les deux correctifs sont SOLIDAIRES : l'un sans l'autre ne tient pas.
//
// 🛑 LE CORRECTIF N'EST PAS « lire sous verrou » : un lecteur qui exige le
//    verrou n'est plus un repli. C'est l'ÉCRIVAIN qui doit rendre l'état
//    ininterruptible (tmp + rename, `rename` étant atomique sur POSIX comme
//    sur Windows). Même motif que `canari-check.js`, qui le faisait déjà.
// ⚠️ NE JAMAIS revenir à un `writeFileSync` direct sur le fichier de
//    destination, même « parce que c'est plus simple » : la simplicité se paie
//    ici en réinjections silencieuses, invisibles à tous les autres tests.
import { test, afterAll } from 'vitest';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-atomique-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

// Sonde EXTERNE : parent = lecteur, enfant = écrivain. Deux PROCESSUS réels —
// un test in-process ne prouverait rien (pas de concurrence d'écriture disque).
const SONDE = path.join(TMP, 'sonde.cjs');
fs.writeFileSync(SONDE, `
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const DIR = process.argv[2];
process.env.CTXROUTE_STATE_DIR = DIR;
const store = require(${JSON.stringify(path.join(__dirname, 'session-store.js').replace(/\\/g, '/'))});
// État de taille RÉALISTE (mesuré sur le parc : médiane 63 o, max 268 o).
const etat = {};
for (let i = 0; i < 4; i++) etat['docs/fichier-' + i + '.md'] = { seen: true, sinceLastCall: i };
const ECRIVAIN = path.join(DIR, 'ecrivain.cjs');
fs.writeFileSync(ECRIVAIN, [
  "process.env.CTXROUTE_STATE_DIR = " + JSON.stringify(DIR) + ";",
  "const store = require(" + JSON.stringify(path.join(${JSON.stringify(__dirname.replace(/\\/g, '/'))}, 'session-store.js').replace(/\\\\/g, '/')) + ");",
  "const etat = " + JSON.stringify(etat) + ";",
  "const fin = Date.now() + 1500;",
  "while (Date.now() < fin) store.saveState('doc-seen-', 'course', etat);",
  // Témoin de fin PROPRE : c'est lui qui distingue « l'écrivain a terminé »
  // de « l'écrivain a été tué » — seul le premier cas peut promettre 0 .tmp.
  // ⚠️ Chemin INLINE : le script écrivain ne require PAS le module path —
  //    l'y appeler levait une ReferenceError, le témoin n'était jamais écrit,
  //    et l'attente partait au bout de ses 10 s (vert, mais 12 s au lieu de 2).
  "require('fs').writeFileSync(" + JSON.stringify(path.join(DIR, 'fini.flag')) + ", 'ok');",
].join('\\n'));
const enfant = spawn(process.execPath, [ECRIVAIN], { stdio: 'ignore' });
// 🛑 ATTENDRE LE PREMIER ÉTAT AVANT DE COMPTER — sans ça on compte la latence
//    de spawn de l'écrivain comme des lectures fantômes. MESURÉ : 756 ENOENT
//    de pur démarrage, qui faisaient ROUGIR un correctif pourtant PARFAIT
//    (23 131/23 131 lectures saines une fois la fenêtre exclue).
//    Un fichier ABSENT rend {} et ce {} est VRAI — ce n'est pas le défaut visé.
const DEST = path.join(DIR, 'doc-seen-course.json');
const limite = Date.now() + 10000;
while (!fs.existsSync(DEST) && Date.now() < limite) { /* attente du 1er état */ }
if (!fs.existsSync(DEST)) { console.log(JSON.stringify({ lectures: 0, vides: 0, restes: 0 })); process.exit(0); }
let lectures = 0, vides = 0;
const fin = Date.now() + 1500;
while (Date.now() < fin) {
  const s = store.loadState('doc-seen-', 'course');
  lectures++;
  if (Object.keys(s).length === 0) vides++;
}
// 🛑 NE JAMAIS TUER L'ÉCRIVAIN AVANT DE COMPTER LES .tmp — CI ROUGE sur macOS
//    le 08/08/2026. Un processus TUÉ entre le \`writeFileSync(tmp)\` et le
//    \`rename\` laisse forcément son temporaire : aucun programme ne peut y
//    survivre, l'assertion exigeait donc l'impossible. L'invariant RÉEL est
//    « un écrivain qui termine NORMALEMENT ne laisse rien ».
//    (Un tmp de processus tué n'est pas un déchet éternel : il porte le préfixe
//    du store, donc \`ctxroute-reset.js\` le balaie à la compaction suivante.)
// ⚠️ Attente par FICHIER TÉMOIN, pas par événement : la boucle de lecture est
//    un busy-wait synchrone, elle bloquerait la réception d'un \`exit\`.
const FINI = path.join(DIR, 'fini.flag');
// ⚠️ ATTENTE QUI DORT (Atomics.wait, même primitive que lock.js) plutôt qu'une
//    boucle serrée : sur un runner CI à 2 cœurs, brûler un cœur à attendre
//    ralentit l'écrivain qu'on attend. Coût nul, bénéfice réel.
// 🛑 J'AI D'ABORD IMPUTÉ À CETTE BOUCLE UN RALENTISSEMENT DE 12 s — C'ÉTAIT
//    FAUX. La vraie cause : le script écrivain n'avait pas le module path,
//    donc le témoin n'était JAMAIS écrit et l'attente allait au bout de ses
//    10 s. Le test était VERT en mesurant le mauvais phénomène. Le passage à
//    Atomics.wait reste bon, mais il n'a rien corrigé — ne pas croire ce
//    commentaire sur parole : la durée observée est de ~2 s.
const dors = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* env restreint */ } };
const limiteFin = Date.now() + 10000;
while (!fs.existsSync(FINI) && Date.now() < limiteFin) dors(20);
enfant.kill(); // filet seulement : normalement déjà terminé
const restes = fs.readdirSync(DIR).filter((f) => f.endsWith('.tmp'));
console.log(JSON.stringify({ lectures, vides, restes: restes.length }));
`);

function courir() {
  const dir = fs.mkdtempSync(path.join(TMP, 'run-'));
  const r = spawnSync(process.execPath, [SONDE, dir.replace(/\\/g, '/')], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'sonde en echec : ' + r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

test('ATOMICITÉ : un lecteur sans verrou ne voit JAMAIS un état vide pendant une écriture', { timeout: 30000 }, () => {
  const r = courir();
  // ⚠️ TÉMOIN ANTI-SONDE-MUETTE : sans lecture, « 0 vide » serait un faux vert.
  //    C'est le piège qui a coûté 5 sondes fausses sur ce dépôt.
  assert.ok(r.lectures > 100, `sonde muette : seulement ${r.lectures} lectures`);
  assert.strictEqual(r.vides, 0,
    `${r.vides} lecture(s) sur ${r.lectures} ont rendu {} alors que l'état EXISTE — `
    + 'écriture NON atomique : le lecteur voit un fichier tronqué. '
    + 'Mesuré AVANT correctif : 9 596 / 24 147.');
});

test('ATOMICITÉ : aucun fichier temporaire ne survit aux écritures', { timeout: 30000 }, () => {
  // Un tmp abandonné s'accumulerait dans state/ sans que personne le voie.
  assert.strictEqual(courir().restes, 0, 'fichier(s) .tmp abandonné(s) dans state/');
});

// CONTRE-ÉPREUVE — sans elle, un `loadState` qui renverrait TOUJOURS un objet
// non vide (bug) passerait le test ci-dessus. Le fail-open doit rester intact.
test('FAIL-OPEN INTACT : un état ABSENT rend bien {} (et ce {} là est VRAI)', () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'vide-'));
  const r = spawnSync(process.execPath, ['-e', `
    process.env.CTXROUTE_STATE_DIR = ${JSON.stringify(dir.replace(/\\/g, '/'))};
    const s = require(${JSON.stringify(path.join(__dirname, 'session-store.js').replace(/\\/g, '/'))});
    console.log(JSON.stringify(s.loadState('doc-seen-', 'jamais-vu')));
  `], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(JSON.parse(r.stdout.trim()), {});
});

// CONTRE-ÉPREUVE — l'atomicité ne doit pas se payer en ÉCRITURES PERDUES.
// `rename` peut échouer (verrou Windows) ; si le catch l'avalait, l'état ne
// serait jamais sauvé et la cadence `once` ne tiendrait plus.
test('AUCUNE ÉCRITURE PERDUE : après sauvegarde, l\'état est relu à l\'identique', () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'ecrit-'));
  const r = spawnSync(process.execPath, ['-e', `
    process.env.CTXROUTE_STATE_DIR = ${JSON.stringify(dir.replace(/\\/g, '/'))};
    const s = require(${JSON.stringify(path.join(__dirname, 'session-store.js').replace(/\\/g, '/'))});
    const etat = { 'docs/a.md': { seen: true, sinceLastCall: 3 } };
    for (let i = 0; i < 50; i++) s.saveState('doc-seen-', 'boucle', etat);
    console.log(JSON.stringify(s.loadState('doc-seen-', 'boucle')));
  `], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(JSON.parse(r.stdout.trim()), { 'docs/a.md': { seen: true, sinceLastCall: 3 } });
});
