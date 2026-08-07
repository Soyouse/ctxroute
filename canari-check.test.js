// ⚠️ CE QUE CETTE SUITE PROTÈGE : le SEUL témoin qui regarde l'autre bout du
//    tuyau. S'il se trompe, on croit être surveillé alors qu'on ne l'est pas —
//    une fausse confiance vaut moins que pas de témoin du tout.
//
// ⚠️ REFONTE DU 07/08/2026 — LIRE AVANT DE MODIFIER. Le dénominateur du canari
//    ne se compte PLUS dans le transcript. Doc officielle des hooks Codex
//    (learn.chatgpt.com/docs/hooks) : « the transcript format isn't a stable
//    interface for hooks and may change over time ». On ne bâtit rien sur un
//    format que l'éditeur se réserve le droit de casser. Le dénominateur vient
//    donc du compteur d'ÉMISSIONS écrit par `emission-core` — notre donnée.
//    Conséquence directe : cette suite POSE un état d'émissions au lieu de
//    fabriquer des lignes d'appel d'outils.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  etiquette, SEUIL_EMISSIONS, FENETRE_OCTETS,
} from './canari.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));

const SID = 'canari-test-session';
// Bruit propre au harnais : il ne DOIT jamais peser sur le verdict.
const bruitHarnais = () => '{"type":"tool_use","name":"Read"}\n';
const injection = () => 'ma doc\n[source: .claude/hooks/docs/x.md]\n';

// ── BOUT EN BOUT, PAR SPAWN RÉEL ────────────────────────────────────────
function lancer(payload, stateDir) {
  execFileSync(process.execPath, [path.join(ICI, 'canari-check.js')], {
    input: JSON.stringify(payload),
    // ⚠️ Nom EXACT de l'env var du framework (`CTXROUTE_STATE_DIR`) : avec un
    //    nom approchant, le test écrit dans le VRAI dossier d'état et croit
    //    échouer. Erreur commise en écrivant cette suite.
    env: { ...process.env, CTXROUTE_STATE_DIR: stateDir },
  });
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'canari-'));
}

/**
 * Pose le compteur d'émissions comme le ferait `emission-core` après N gestes.
 * ⚠️ MÊME préfixe et MÊME clé que la couche d'émission : si l'un des deux
 *    changeait, le canari lirait 0 et resterait éternellement « indecidable » —
 *    muet, vert, inutile. C'est ce couplage que ces tests scellent.
 */
function poserEmissions(stateDir, n) {
  fs.writeFileSync(
    path.join(stateDir, `reliquat-${SID}.json`),
    JSON.stringify({ segments: [], emissions: n }),
  );
}

test("SPAWN RÉEL : une injection ATTERRIE ⇒ verdict « vivant », quel que soit le volume émis", () => {
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, bruitHarnais().repeat(40) + injection());
  poserEmissions(d, 40);
  lancer({ transcript_path: t, session_id: SID }, d);
  const sante = JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8'));
  assert.equal(sante.verdict, 'vivant');
  assert.equal(sante.injections, 1);
});

test('SPAWN RÉEL — LE CAS QUI JUSTIFIE TOUT : canal MORT ⇒ verdict « mort »', () => {
  // ⚠️ C'est LE scénario que rien d'autre ne peut voir : le framework émet, et
  //    plus AUCUNE injection n'atterrit. Nos hooks seraient verts, le doctor
  //    aussi. Seul ce fichier le sait.
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, bruitHarnais().repeat(SEUIL_EMISSIONS));
  poserEmissions(d, SEUIL_EMISSIONS);
  lancer({ transcript_path: t, session_id: SID }, d);
  const sante = JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8'));
  assert.equal(sante.verdict, 'mort');
  assert.equal(sante.emissions, SEUIL_EMISSIONS);
  assert.equal(etiquette(sante.verdict), '💉⚠️ INJECTION MORTE');
});

test("SPAWN RÉEL — NEGATIVE : un transcript BRUYANT sans émission n'accuse JAMAIS", () => {
  // ⚠️ CE CAS EST LA RAISON D'ÊTRE DU NOUVEAU DÉNOMINATEUR. Avant le
  //    07/08/2026, l'activité du harnais SUFFISAIT à déclencher l'accusation :
  //    un utilisateur travaillant sur des fichiers non couverts par une doc
  //    voyait « INJECTION MORTE » alors que tout allait bien. Désormais, sans
  //    émission de NOTRE part, il n'y a rien à attendre en face — donc rien à
  //    reprocher. Une alarme qui crie sur du sain cesse d'être lue.
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, bruitHarnais().repeat(SEUIL_EMISSIONS * 10));
  // Aucun `poserEmissions` : le framework n'a rien émis.
  lancer({ transcript_path: t, session_id: SID }, d);
  const sante = JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8'));
  assert.equal(sante.verdict, 'indecidable');
  assert.equal(sante.emissions, 0);
  assert.equal(etiquette(sante.verdict), '', 'silence obligatoire tant que rien ne prouve la panne');
});

test('SPAWN RÉEL : MUET par contrat — stdout VIDE et exit 0 (ne bloque jamais un prompt)', () => {
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, bruitHarnais().repeat(SEUIL_EMISSIONS));
  poserEmissions(d, SEUIL_EMISSIONS);
  const out = execFileSync(process.execPath, [path.join(ICI, 'canari-check.js')], {
    input: JSON.stringify({ transcript_path: t, session_id: SID }),
    env: { ...process.env, CTXROUTE_STATE_DIR: d },
  });
  assert.equal(out.toString(), '', 'stdout DOIT rester vide : il serait injecté dans le contexte');
});

test('SPAWN RÉEL : transcript ABSENT ou payload vide ⇒ silence, aucun fichier écrit', () => {
  const d = tmp();
  lancer({}, d);
  assert.equal(fs.existsSync(path.join(d, 'canari.json')), false, 'aucun verdict fabriqué sans preuve');
  // Chemin qui n'existe pas : erreur d'I/O ⇒ fail-open, toujours exit 0.
  lancer({ transcript_path: path.join(d, 'nexiste-pas.jsonl') }, d);
  assert.equal(fs.existsSync(path.join(d, 'canari.json')), false);
});

test("SPAWN RÉEL : sur erreur, le verdict PRÉCÉDENT est PRÉSERVÉ (jamais repeint en vert)", () => {
  // ⚠️ Écrire « vivant » quand on n'a pas pu mesurer serait fabriquer du vert —
  //    le « vert qui ment » que tout ce framework combat.
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, bruitHarnais().repeat(SEUIL_EMISSIONS));
  poserEmissions(d, SEUIL_EMISSIONS);
  lancer({ transcript_path: t, session_id: SID }, d);
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8')).verdict, 'mort');
  lancer({ transcript_path: path.join(d, 'disparu.jsonl'), session_id: SID }, d);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8')).verdict, 'mort',
    "l'alerte survit à une mesure ratée",
  );
});

test('SPAWN RÉEL : lecture BORNÉE — un gros transcript ne coûte pas sa taille', () => {
  // ⚠️ Mesuré 03/08/2026 : un transcript du parc pesait 104 Mo ; le lire en
  //    entier coûtait 524 ms À CHAQUE TOUR. Ce test scelle la borne.
  const d = tmp();
  const t = path.join(d, 'gros.jsonl');
  // Injections ANCIENNES, puis assez de bruit pour les repousser HORS fenêtre.
  // ⚠️ Il ne suffit pas que le fichier soit gros : il faut que le remplissage
  //    SÉPARE les vieilles injections de la fin (erreur commise en écrivant ce
  //    test — la fenêtre les rattrapait encore et le verdict restait « vivant »).
  const bourrage = bruitHarnais().repeat(Math.ceil((FENETRE_OCTETS * 1.5) / bruitHarnais().length));
  fs.writeFileSync(t, injection().repeat(1000) + bourrage);
  assert.ok(fs.statSync(t).size > FENETRE_OCTETS, 'prémisse : le fichier dépasse la fenêtre');
  poserEmissions(d, SEUIL_EMISSIONS);
  lancer({ transcript_path: t, session_id: SID }, d);
  const sante = JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8'));
  assert.equal(sante.verdict, 'mort', 'les vieilles injections hors fenêtre ne masquent pas la panne EN COURS');
});

test("CONTRAT DE FRONTIÈRE : le canari lit la clé QUE la couche d'émission écrit", () => {
  // ⚠️ CE TEST EXISTE PARCE QUE LA PANNE SERAIT INVISIBLE. `emission-core` écrit
  //    `emissions` dans le store `reliquat-`, `canari-check` l'y relit. Si l'un
  //    des deux changeait de clé, de préfixe ou de scope, le canari lirait 0 et
  //    resterait « indecidable » POUR TOUJOURS : muet, vert, et incapable de
  //    signaler la panne qu'il existe pour détecter. Aucun autre test ne verrait
  //    ça — les deux fichiers passeraient leurs suites respectives.
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, bruitHarnais());

  // On écrit par la VRAIE couche d'émission, jamais par une imitation.
  const ecrire = `
    process.env.CTXROUTE_STATE_DIR = ${JSON.stringify(d)};
    const em = require(${JSON.stringify(path.join(ICI, 'emission-core.js'))});
    for (let i = 0; i < ${SEUIL_EMISSIONS}; i++) {
      em.emettre({ frais: [{ id: 'd' + i, text: 'x' }], budgetMax: 8000, nbPaquets: 1, indice: 1, scopeId: ${JSON.stringify(SID)} });
    }
  `;
  execFileSync(process.execPath, ['-e', ecrire], { env: { ...process.env, CTXROUTE_STATE_DIR: d } });

  lancer({ transcript_path: t, session_id: SID }, d);
  const sante = JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8'));
  assert.equal(
    sante.emissions, SEUIL_EMISSIONS,
    "le canari ne voit pas les émissions RÉELLEMENT écrites par la couche : la frontière a divergé",
  );
  assert.equal(sante.verdict, 'mort');
});
