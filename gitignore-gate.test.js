// ═══════════════════════════════════════════════════════════════════════
// GATE — AUCUN fichier de state/ n'est tracké par git.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Né d'un incident RÉEL (16/07/2026) : `state/*.json` ne couvrait pas `.jsonl`
//    → le journal SHADOW (payloads réels : chemins, commandes des sessions de
//    le mainteneur) est parti sur GitHub dans un commit. `state/` = runtime, PRIVÉ,
//    jamais committable — quel que soit le format qu'un futur hook y écrira.
//    Le pattern par-extension re-cassera au prochain format ; ce gate, non.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

test('GATE : git ne tracke AUCUN fichier sous state/', () => {
  const out = execFileSync('git', ['ls-files', 'state/'], { cwd: __dirname, encoding: 'utf8' }).trim();
  assert.strictEqual(out, '', `fichiers de state/ TRACKÉS (données runtime privées → GitHub) :\n${out}`);
});
