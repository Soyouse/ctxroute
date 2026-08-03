// ⚠️ CE QUE CETTE SUITE PROTÈGE : le SEUL témoin qui regarde l'autre bout du
//    tuyau. S'il se trompe, on croit être surveillé alors qu'on ne l'est pas —
//    une fausse confiance vaut moins que pas de témoin du tout.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  verdict, etiquette, compter, SEUIL_APPELS, FENETRE_OCTETS, MARQUE_INJECTION,
} from './canari.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));

const appel = () => '{"type":"tool_use","name":"Read"}\n';
const injection = () => 'ma doc\n[source: .claude/hooks/docs/x.md]\n';

// ── BOUT EN BOUT, PAR SPAWN RÉEL ────────────────────────────────────────
function lancer(payload, stateDir) {
  execFileSync(process.execPath, [path.join(ICI, 'canari-check.js')], {
    input: JSON.stringify(payload),
    // ⚠️ Nom EXACT de l'env var du framework (`MCP_DOC_STATE_DIR`) : avec un
    //    nom approchant, le test écrit dans le VRAI dossier d'état et croit
    //    échouer. Erreur commise en écrivant cette suite.
    env: { ...process.env, MCP_DOC_STATE_DIR: stateDir },
  });
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'canari-'));
}

test("SPAWN RÉEL : un transcript SAIN laisse le verdict « vivant »", () => {
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, appel().repeat(40) + injection());
  lancer({ transcript_path: t }, d);
  const sante = JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8'));
  assert.equal(sante.verdict, 'vivant');
  assert.equal(sante.injections, 1);
});

test('SPAWN RÉEL — LE CAS QUI JUSTIFIE TOUT : canal MORT ⇒ verdict « mort »', () => {
  // ⚠️ C'est LE scénario que rien d'autre ne peut voir : le harnais tourne, les
  //    outils s'appellent, et plus AUCUNE injection n'atterrit. Nos hooks
  //    seraient verts, le doctor aussi. Seul ce fichier le sait.
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, appel().repeat(SEUIL_APPELS));
  lancer({ transcript_path: t }, d);
  const sante = JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8'));
  assert.equal(sante.verdict, 'mort');
  assert.equal(sante.appels, SEUIL_APPELS);
  assert.equal(etiquette(sante.verdict), '💉⚠️ INJECTION MORTE');
});

test('SPAWN RÉEL : MUET par contrat — stdout VIDE et exit 0 (ne bloque jamais un prompt)', () => {
  const d = tmp();
  const t = path.join(d, 'transcript.jsonl');
  fs.writeFileSync(t, appel().repeat(SEUIL_APPELS));
  const out = execFileSync(process.execPath, [path.join(ICI, 'canari-check.js')], {
    input: JSON.stringify({ transcript_path: t }),
    env: { ...process.env, MCP_DOC_STATE_DIR: d },
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
  fs.writeFileSync(t, appel().repeat(SEUIL_APPELS));
  lancer({ transcript_path: t }, d);
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8')).verdict, 'mort');
  lancer({ transcript_path: path.join(d, 'disparu.jsonl') }, d);
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
  // Injections ANCIENNES, puis assez d'appels pour les repousser HORS fenêtre.
  // ⚠️ Il ne suffit pas que le fichier soit gros : il faut que le remplissage
  //    SÉPARE les vieilles injections de la fin (erreur commise en écrivant ce
  //    test — la fenêtre les rattrapait encore et le verdict restait « vivant »).
  const bourrage = appel().repeat(Math.ceil((FENETRE_OCTETS * 1.5) / appel().length));
  fs.writeFileSync(t, injection().repeat(1000) + bourrage);
  assert.ok(fs.statSync(t).size > FENETRE_OCTETS, 'prémisse : le fichier dépasse la fenêtre');
  lancer({ transcript_path: t }, d);
  const sante = JSON.parse(fs.readFileSync(path.join(d, 'canari.json'), 'utf8'));
  assert.equal(sante.verdict, 'mort', 'les vieilles injections hors fenêtre ne masquent pas la panne EN COURS');
});

