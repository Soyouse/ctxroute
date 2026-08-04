// ═══════════════════════════════════════════════════════════════════════
// Intégration de la porte TOUR (turn-count.js, UserPromptSubmit) — spawn réel.
// ⚠️ MUETTE PAR CONTRAT : sur UserPromptSubmit, tout stdout devient du CONTEXTE
//    injecté à côté du prompt — chaque test vérifie stdout VIDE, toujours.
// ═══════════════════════════════════════════════════════════════════════

import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOOK = path.join(__dirname, 'turn-count.js');

function makeEnv(extra = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'turn-count-test-'));
  const stateDir = path.join(tmp, 'state');
  const configPath = path.join(tmp, 'config.json');
  return {
    tmp,
    stateDir,
    configPath,
    env: {
      ...process.env,
      CTXROUTE_CONFIG_PATH: configPath,
      CTXROUTE_STATE_DIR: stateDir,
      ...extra,
    },
  };
}

function run(env, payload) {
  return spawnSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env,
    timeout: 30000,
  });
}

function readTurns(stateDir, sessionId) {
  return JSON.parse(fs.readFileSync(path.join(stateDir, `turn-count-${sessionId}.json`), 'utf8')).turns;
}

test('chaque tour incrémente le compteur de 1, stdout TOUJOURS vide (contrat UserPromptSubmit)', () => {
  const { stateDir, env, tmp } = makeEnv();
  try {
    for (let i = 1; i <= 3; i++) {
      const r = run(env, { hook_event_name: 'UserPromptSubmit', session_id: 'sess-a', prompt: 'x' });
      expect(r.status).toBe(0);
      expect((r.stdout || '').trim()).toBe(''); // un stdout ici = pollution de CHAQUE tour
      expect(readTurns(stateDir, 'sess-a')).toBe(i);
    }
    // sessions ISOLÉES : compter sess-b ne touche pas sess-a.
    run(env, { hook_event_name: 'UserPromptSubmit', session_id: 'sess-b', prompt: 'x' });
    expect(readTurns(stateDir, 'sess-a')).toBe(3);
    expect(readTurns(stateDir, 'sess-b')).toBe(1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('enabled: false coupe le compteur comme le reste du framework', () => {
  const { stateDir, configPath, env, tmp } = makeEnv();
  try {
    fs.writeFileSync(configPath, JSON.stringify({ enabled: false }));
    const r = run(env, { hook_event_name: 'UserPromptSubmit', session_id: 'sess-off', prompt: 'x' });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(stateDir, 'turn-count-sess-off.json'))).toBe(false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('FAIL-OPEN : stdin poubelle et store corrompu → exit 0 muet, compteur repart de 0', () => {
  const { stateDir, env, tmp } = makeEnv();
  try {
    // stdin poubelle : exit 0, rien d'écrit.
    const r1 = run(env, 'ceci n\'est pas du JSON');
    expect(r1.status).toBe(0);
    expect((r1.stdout || '').trim()).toBe('');
    // store corrompu = repartir de 0 (jamais un crash) : le tour suivant écrit 1.
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'turn-count-sess-c.json'), '{corrompu');
    const r2 = run(env, { hook_event_name: 'UserPromptSubmit', session_id: 'sess-c', prompt: 'x' });
    expect(r2.status).toBe(0);
    expect(readTurns(stateDir, 'sess-c')).toBe(1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ctxroute-reset.js (PreCompact) remet AUSSI le compteur de tours à zéro', () => {
  const { stateDir, env, tmp } = makeEnv();
  try {
    run(env, { hook_event_name: 'UserPromptSubmit', session_id: 'sess-r', prompt: 'x' });
    expect(readTurns(stateDir, 'sess-r')).toBe(1);
    const rr = spawnSync(process.execPath, [path.join(__dirname, 'ctxroute-reset.js')], {
      input: JSON.stringify({ hook_event_name: 'PreCompact', session_id: 'sess-r', trigger: 'auto' }),
      encoding: 'utf8',
      env,
      timeout: 30000,
    });
    expect(rr.status).toBe(0);
    expect(fs.existsSync(path.join(stateDir, 'turn-count-sess-r.json'))).toBe(false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
