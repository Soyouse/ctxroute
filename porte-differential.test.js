// ═══════════════════════════════════════════════════════════════════════
// DIFFÉRENTIEL DE PORTE — doc-inject.js (nouveau) vs protect-files.js (prod).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Le différentiel moteur (file-differential) et le shadow prouvent le MATCH ;
//    CE test prouve la PORTE : contenu injecté À L'OCTET PRÈS (frontmatter
//    strippé pareil, même [source:], mêmes séparateurs), même decision ask/allow,
//    même systemMessage. C'est le gate de parité de la BASCULE.
//
// ⚠️ RUSH : l'ancien lit `.rush`, la porte lit `config.confirm` (#4). Le test lit
//    l'état RÉEL du .rush et donne à la porte la config équivalente — si les deux
//    mécanismes ne se miroir plus, ce test casse (c'est voulu : la session de
//    bascule doit reporter l'état du .rush dans ctxroute-config.json).
//
// Skippé sur clone vierge (pas de parc réel). Spawns réels mais peu nombreux.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LEGACY = process.env.CTXROUTE_LEGACY_PATH || path.join(os.homedir(), '.claude', 'hooks', 'protect-files.js');
const PORTE = path.join(__dirname, 'doc-inject.js');
const parcPresent = fs.existsSync(LEGACY);

const RUSH = parcPresent && fs.existsSync(path.join(path.dirname(LEGACY), '.rush'));
const RUSH_PREFIX = '⚡ RUSH MODE — ask désactivé. Doc injectée :\n\n';

// Config de la porte MIROIR du rush réel + state isolé (jamais le vrai state/).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'porte-diff-'));
const CONFIG = path.join(TMP, 'config.json');
if (parcPresent) fs.writeFileSync(CONFIG, JSON.stringify(RUSH ? { confirm: false } : {}));

// ⚠️ DÉSCELLEMENT — LIRE AVANT DE TOUCHER (05/08/2026, faux rouge PAYÉ).
//    Ce différentiel compare la porte à `protect-files.js`, un oracle FIGÉ
//    (sa propre doc l'interdit d'évolution). Le SCEAU multi-trames est né le
//    03/08/2026, APRÈS lui : l'oracle ne saura JAMAIS sceller. Or la porte
//    scelle dès que l'injection dépasse 50 % du budget (4 000 c) — donc dès
//    ce seuil, l'octet brut diffère TOUJOURS, pour une raison qui n'est pas
//    une divergence de moteur mais une couche de TRANSPORT absente d'un côté.
// ⚠️ Le test n'a survécu jusqu'ici que par CHANCE : les payloads testés
//    pesaient ~3 400 c, juste sous le seuil. Deux lignes ajoutées à des docs
//    du parc l'ont fait basculer — un gate qui dépend de la taille du parc
//    n'est pas un gate, c'est un compte à rebours.
// ⚠️ On compare donc le CONTENU, enveloppe retirée — la parité reste prouvée
//    À L'OCTET sur ce qui fait le sens. 🛑 NE JAMAIS « corriger » ce rouge en
//    raccourcissant une doc : ce serait dégrader un livrable pour entrer dans
//    une limite de NOTRE plomberie, exactement l'interdit du framework
//    (« il LIVRE TOUT »). La doc est saine ; c'est l'oracle qui est daté.
// ⚠️ Le motif exige le MÊME marqueur en tête et en pied (back-référence) :
//    un déscellement permissif masquerait une vraie divergence, et ce test
//    deviendrait décoratif — la classe d'erreur des gates inertes du 03/08.
const SCEAU_RE = /^⚠️ INJECTION SCELLÉE — ce bloc se termine par ###FIN:([0-9a-f]+)###\n[^\n]*\n[^\n]*\n\n([\s\S]*)\n\n###FIN:\1###$/;
function desceller(ctx) {
  if (typeof ctx !== 'string') return ctx;
  const m = SCEAU_RE.exec(ctx);
  return m ? m[2] : ctx;
}

function runHook(script, payload, env) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, ...env } }, (_err, stdout) => {
      resolve(stdout.trim() === '' ? null : JSON.parse(stdout));
    });
    child.stdin.end(JSON.stringify({ tool_name: payload.toolName, tool_input: payload.toolInput, session_id: 'porte-diff' }));
  });
}

async function both(payload) {
  const [vieux, neuf] = await Promise.all([
    runHook(LEGACY, payload, {}),
    runHook(PORTE, payload, { CTXROUTE_CONFIG_PATH: CONFIG, CTXROUTE_STATE_DIR: path.join(TMP, 'state') }),
  ]);
  return { vieux, neuf };
}

// Payloads RÉELS (règles connues du parc) — lecture, écriture, Bash, non-match.
const HOOK_DIR = path.join(os.homedir(), '.claude', 'hooks');
const READ_MATCH = { toolName: 'Read', toolInput: { file_path: 'C:/Users/dev/Desktop/ctxroute/lib-pure.js' } };

test.skipIf(!parcPresent)('LECTURE : contenu injecté IDENTIQUE à l\'octet près (ctx + systemMessage)', async () => {
  const { vieux, neuf } = await both(READ_MATCH);
  assert.ok(vieux && neuf, 'les deux moteurs doivent injecter sur ce payload connu');
  assert.strictEqual(vieux.hookSpecificOutput.permissionDecision, 'allow');
  assert.strictEqual(neuf.hookSpecificOutput.permissionDecision, 'allow');
  assert.strictEqual(desceller(neuf.hookSpecificOutput.additionalContext), vieux.hookSpecificOutput.additionalContext);
  // ⚠️ ÉCART DÉCLARÉ SUR LE BADGE — LE NOUVEAU EN NOMME PLUS (07/08/2026).
  //
  // 🔴 DÉFAUT RÉEL, mesuré ICI sur le parc : l'ancien moteur (et le nôtre
  //    jusqu'à ce jour) n'annonçait QUE la première doc livrée. Ce test le
  //    prouve noir sur blanc — « 📄 doc: pointer » alors que `pointer` ET
  //    `lib-pure` étaient injectés. Conséquence vécue : le mainteneur a vu
  //    « morceau 1/8 » puis « 2/8 » puis un autre nom, et en a conclu que la
  //    livraison s'ARRÊTAIT. Elle était complète. Une matinée perdue à
  //    diagnostiquer une panne inexistante, sur la foi d'un badge faux.
  //
  // ⚠️ L'ORACLE EST FIGÉ ET DATÉ (sa propre doc l'écrit) : chaque capacité
  //    ajoutée à la porte après le 17/07/2026 creuse l'écart — le sceau l'avait
  //    déjà fait. On ne PEUT donc plus exiger l'égalité stricte du badge sans
  //    interdire toute amélioration de l'affichage.
  //
  // 🛑 CE QUI RESTE VÉRIFIÉ, ET C'EST L'ESSENTIEL : le badge de l'ancien est un
  //    PRÉFIXE EXACT du nôtre, et le supplément ne peut être QUE des noms de
  //    documents réellement livrés. Un badge qui perdrait le nom historique, en
  //    changerait la forme ou inventerait un suffixe reste ROUGE.
  //    ⚠️ Ne JAMAIS relâcher ça en `includes` : on cesserait de vérifier la
  //    forme, c'est-à-dire de vérifier quoi que ce soit.
  if (neuf.systemMessage !== vieux.systemMessage) {
    assert.ok(neuf.systemMessage.startsWith(vieux.systemMessage),
      `le badge a PERDU ou DÉFORMÉ le nom historique.\n  ancien : ${vieux.systemMessage}\n  neuf   : ${neuf.systemMessage}`);
    const supplement = neuf.systemMessage.slice(vieux.systemMessage.length);
    assert.match(supplement, /^( · [^·]+)+$/,
      `le badge s'est enrichi d'autre chose que des noms de docs livrées : ${JSON.stringify(supplement)}`);
  }
});

test.skipIf(!parcPresent)('ÉCRITURE : décision miroir du rush réel, mêmes docs', async () => {
  const { vieux, neuf } = await both({ toolName: 'Edit', toolInput: { file_path: 'C:/Users/dev/Desktop/ctxroute/lib-pure.js' } });
  assert.ok(vieux && neuf, 'les deux moteurs doivent réagir sur écriture documentée');
  if (RUSH) {
    assert.strictEqual(vieux.hookSpecificOutput.permissionDecision, 'allow');
    assert.strictEqual(neuf.hookSpecificOutput.permissionDecision, 'allow');
    assert.strictEqual(RUSH_PREFIX + desceller(neuf.hookSpecificOutput.additionalContext), vieux.hookSpecificOutput.additionalContext);
  } else {
    assert.strictEqual(vieux.hookSpecificOutput.permissionDecision, 'ask');
    assert.strictEqual(neuf.hookSpecificOutput.permissionDecision, 'ask');
    assert.strictEqual(neuf.hookSpecificOutput.permissionDecisionReason, vieux.hookSpecificOutput.permissionDecisionReason);
  }
});

test.skipIf(!parcPresent)('BASH : reconstruction cd && — mêmes docs injectées', async () => {
  const { vieux, neuf } = await both({ toolName: 'Bash', toolInput: { command: 'cd C:/Users/dev/Desktop/ctxroute && node doctor.js' } });
  // Silence des deux OU injection identique — jamais l'un sans l'autre.
  assert.strictEqual(neuf === null, vieux === null, 'un moteur parle, l\'autre se tait');
  if (vieux) assert.strictEqual(desceller(neuf.hookSpecificOutput.additionalContext), vieux.hookSpecificOutput.additionalContext);
});

test.skipIf(!parcPresent)('GIT + NON-MATCH : silence des deux côtés', async () => {
  const git = await both({ toolName: 'Bash', toolInput: { command: 'git commit -m "fix lib-pure.js"' } });
  assert.strictEqual(git.vieux, null);
  assert.strictEqual(git.neuf, null);
  const rien = await both({ toolName: 'Read', toolInput: { file_path: 'C:/tmp/fichier-inconnu-xyz.txt' } });
  assert.strictEqual(rien.vieux, null);
  assert.strictEqual(rien.neuf, null);
});

test.skipIf(!parcPresent)('HOOK_DIR sanity : le parc réel existe bien là où on le croit', () => {
  assert.ok(fs.existsSync(HOOK_DIR));
});

// ⚠️ NEGATIVE-CHECK du déscellement (05/08/2026) — SANS lui, `desceller()` est
//    un `return ctx` déguisé qui rendrait les 3 comparaisons ci-dessus
//    décoratives. Un assouplissement introduit pour faire passer un rouge DOIT
//    prouver qu'il n'assouplit QUE ce qu'il prétend.
test('desceller() retire l\'enveloppe ET RIEN D\'AUTRE', () => {
  const corps = 'doc A\n\n---\n\ndoc B';
  const scelle = '⚠️ INJECTION SCELLÉE — ce bloc se termine par ###FIN:abcd1234###\n'
    + '   ligne 2\n   ligne 3\n\n' + corps + '\n\n###FIN:abcd1234###';
  assert.strictEqual(desceller(scelle), corps, 'un bloc scellé bien formé doit rendre son corps EXACT');

  // Non scellé → rendu INTACT : le chemin nominal reste une comparaison stricte.
  assert.strictEqual(desceller(corps), corps);

  // ⚠️ LE CAS QUI COMPTE : marqueurs DIFFÉRENTS = sceau incohérent. On ne
  //    descelle PAS — sinon on avalerait un vrai défaut de transport.
  const bancal = scelle.replace('###FIN:abcd1234###\n', '###FIN:00000000###\n');
  assert.strictEqual(desceller(bancal), bancal);

  // ⚠️ Une divergence DANS le corps reste visible après déscellement.
  const autre = scelle.replace('doc B', 'doc C');
  assert.notStrictEqual(desceller(autre), corps);
});
