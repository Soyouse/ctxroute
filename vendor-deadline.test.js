// ═══════════════════════════════════════════════════════════════════════
// PREUVE AVANT DE TOUCHER LA PROD — vendor-deadline.js sur COPIE tmpdir
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CES HOOKS SONT EN PRODUCTION : d'autres agents (Claude Code, Codex) les
//    exécutent à CHAQUE appel d'outil, en parallèle. Une coquille dans
//    `protect-files.js` casse leur travail en direct et brûle des tokens réels.
//    Donc : tout le risque est absorbé ICI, sur des COPIES jetables. Le patch
//    n'est appliqué en vrai QUE si ces tests sont verts. Même patron que
//    `doctor.test.js` (sabotage sur copie, jamais sur les fichiers livrés).
//
// ⚠️ LA PREUVE EST UN SPAWN RÉEL, JAMAIS UNE LECTURE DE CODE. « Le require est
//    là » ne prouve pas « le process meurt ». Le seul fait qui compte :
//    ce hook, stdin jamais fermé (= le bug réel #68626), est-il MORT ?
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PARC = path.join(os.homedir(), '.claude', 'hooks');
const present = fs.existsSync(PARC);
const skip = !present && 'pas de ~/.claude/hooks/ (clone vierge / autre machine)';

// Copie le parc dans un tmpdir jetable. ⚠️ Fichiers .js + .json seulement :
// on teste le patch, pas le contenu perso (docs, secrets, state).
function clonerParc(avecDocs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parc-test-'));
  for (const f of fs.readdirSync(PARC)) {
    const abs = path.join(PARC, f);
    if (!fs.statSync(abs).isFile()) continue;
    if (!/\.(js|json)$/.test(f)) continue;
    fs.copyFileSync(abs, path.join(dir, f));
  }
  // Les suites des hooks lisent parfois docs/ — copié seulement si demandé.
  if (avecDocs && fs.existsSync(path.join(PARC, 'docs'))) {
    fs.cpSync(path.join(PARC, 'docs'), path.join(dir, 'docs'), { recursive: true });
  }
  return dir;
}

function patcher(dir, write) {
  return spawnSync(process.execPath, [path.join(__dirname, 'vendor-deadline.js'), ...(write ? ['--write'] : [])], {
    env: { ...process.env, VENDOR_TARGET_DIR: dir },
    encoding: 'utf8',
  });
}

// Lance un hook SANS jamais fermer son stdin = reproduction exacte du bug réel.
function hookSurvit(fichier, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fichier], { stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
    const t = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ mort: false });
    }, timeoutMs);
    child.on('exit', (code) => {
      clearTimeout(t);
      resolve({ mort: true, code });
    });
    // ⚠️ On écrit un payload plausible mais on n'appelle JAMAIS end().
    try {
      child.stdin.write(JSON.stringify({ session_id: 'test', tool_name: 'Read', tool_input: {} }));
    } catch (e) {}
  });
}

// ⚠️ DÉNUDE une copie : retire l'échéance pour reconstituer l'état AVANT patch.
//    OBLIGATOIRE — ces tests ne DOIVENT PAS supposer que le parc est nu. Depuis
//    l'application du 15/07/2026 il ne l'est plus, et 2 tests sont devenus FAUX
//    (ils testaient l'état du monde, pas le code). Un test qui dépend d'un état
//    extérieur ment dès que le monde change : il fabrique lui-même sa condition.
function denuder(dir) {
  fs.rmSync(path.join(dir, 'deadline.js'), { force: true });
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const abs = path.join(dir, f);
    const src = fs.readFileSync(abs, 'utf8');
    if (!/require\(['"]\.\/deadline['"]\)/.test(src)) continue;
    const nu = src
      .split(/\r?\n/)
      .filter((l) => !/require\(['"]\.\/deadline['"]\)/.test(l) && !/^deadline\.arm\(\);?$/.test(l.trim()) && !/ÉCHÉANCE — ne JAMAIS retirer/.test(l))
      .join('\n');
    fs.writeFileSync(abs, nu);
  }
  return dir;
}

test('DRY-RUN ne modifie AUCUN fichier', { skip, timeout: 300000 }, () => {
  const dir = denuder(clonerParc());
  const avant = fs.readdirSync(dir).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]);
  const r = patcher(dir, false);
  assert.strictEqual(r.status, 0, r.stderr);
  for (const [f, contenu] of avant) {
    assert.strictEqual(fs.readFileSync(path.join(dir, f), 'utf8'), contenu, `dry-run a modifié ${f}`);
  }
  assert.ok(!fs.existsSync(path.join(dir, 'deadline.js')), 'dry-run a copié deadline.js');
});

test('IDEMPOTENT — rejouer ne double jamais un arm()', { skip, timeout: 300000 }, () => {
  const dir = denuder(clonerParc());
  patcher(dir, true);
  const apres1 = fs.readFileSync(path.join(dir, 'statusline.js'), 'utf8');
  const r2 = patcher(dir, true);
  const apres2 = fs.readFileSync(path.join(dir, 'statusline.js'), 'utf8');
  assert.strictEqual(apres2, apres1, 'le 2ᵉ passage a re-modifié le fichier');
  assert.match(r2.stdout, /à armer\s+: 0/, 'le 2ᵉ passage croit encore devoir armer');
  assert.strictEqual((apres2.match(/deadline\.arm\(\)/g) || []).length, 1, 'arm() dupliqué');
});

test('AUCUN hook ne reste "manuel" — le patch couvre 100% du parc', { skip, timeout: 300000 }, () => {
  // ⚠️ RÉGRESSION SCELLÉE (15/07/2026) : la 1ʳᵉ règle d'insertion cherchait
  //    « après le dernier require de tête » et ratait `browser-recover.js`
  //    (aucun require : il lit process.stdin directement) → 6 armés sur 7.
  //    Un parc couvert à 86% laisse un zombie possible : c'est un échec, pas un détail.
  //
  // ⚠️ denuder() OBLIGATOIRE : sans lui, on cloneraient un parc DÉJÀ armé → « 0 à
  //    armer » → « 0 manuel » TRIVIALEMENT vrai, y compris si le patcher était
  //    entièrement cassé. Un test qui passe sans rien exercer CERTIFIE au lieu de
  //    protéger (3ᵉ occurrence de ce motif le 15/07/2026 — toujours le même piège).
  const dir = denuder(clonerParc());
  const r = patcher(dir, false);
  assert.match(r.stdout, /à armer\s+: 7/, `le parc dénudé doit exposer 7 hooks à armer :\n${r.stdout}`);
  assert.match(r.stdout, /⚠️ MANUELS\s+: 0/, `hook(s) non patchables → couverture incomplète :\n${r.stdout}`);
});

test('les hooks patchés restent du JS VALIDE', { skip, timeout: 300000 }, () => {
  const dir = denuder(clonerParc());
  patcher(dir, true);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const r = spawnSync(process.execPath, ['--check', path.join(dir, f)], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `SYNTAXE CASSÉE dans ${f} :\n${r.stderr}`);
  }
});

test('ANTI-RÉGRESSION — les 9 suites du parc restent VERTES après patch', { skip, timeout: 300000 }, () => {
  // ⚠️ LE test qui compte vraiment. « Le process meurt » ne prouve PAS qu'il fait
  //    encore son travail — un process qui CRASHE meurt aussi (vécu le 15/07/2026 :
  //    browser-recover.js patché au milieu d'un `new RegExp(` multi-lignes était
  //    VERT au test de mort, et cassé). Ces 9 suites sont la seule preuve que
  //    protect-files bloque encore, que browser-recover détecte encore, etc.
  //
  // ⚠️ Comparaison AVANT/APRÈS : on n'exige pas « tout vert » (une suite peut être
  //    déjà rouge pour une raison étrangère au patch — ce n'est pas notre sujet).
  //    On exige que le patch ne CHANGE RIEN. C'est ça, l'anti-régression.
  const avant = denuder(clonerParc(true));
  const apres = denuder(clonerParc(true));
  patcher(apres, true);

  const suites = fs.readdirSync(PARC).filter((f) => f.endsWith('.test.js'));
  assert.ok(suites.length > 0, 'aucune suite trouvée dans le parc — test aveugle');

  const regressions = [];
  for (const s of suites) {
    if (!fs.existsSync(path.join(avant, s))) continue;
    const a = spawnSync(process.execPath, ['--test', s], { cwd: avant, encoding: 'utf8', timeout: 60000 });
    const b = spawnSync(process.execPath, ['--test', s], { cwd: apres, encoding: 'utf8', timeout: 60000 });
    if (a.status !== b.status) {
      regressions.push(`${s} : avant=${a.status} → après=${b.status}\n${(b.stdout || '').slice(-700)}`);
    }
  }

  assert.deepStrictEqual(regressions, [], `RÉGRESSION causée par le patch :\n${regressions.join('\n---\n')}`);
});

test('AVANT patch — un hook au stdin jamais fermé NE MEURT PAS (le bug réel)', { skip, timeout: 300000 }, async () => {
  // ⚠️ NEGATIVE-CHECK : prouve que le danger existe AVANT de prouver le remède.
  //    Sans lui, le test suivant pourrait passer au vert pour une autre raison.
  const dir = denuder(clonerParc());
  const r = await hookSurvit(path.join(dir, 'statusline.js'), 2500);
  assert.strictEqual(r.mort, false, 'le hook meurt déjà tout seul → le bug ne se reproduit plus ici');
});

test('APRÈS patch — CHAQUE hook du parc meurt tout seul', { skip, timeout: 300000 }, async () => {
  const dir = denuder(clonerParc());
  patcher(dir, true);
  fs.writeFileSync(
    path.join(dir, 'deadline-conf.js'),
    '' // placeholder inutilisé — laissé vide volontairement
  );

  const hooks = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js') && f !== 'deadline.js' && f !== 'deadline-conf.js')
    .filter((f) => /require\(['"]\.\/deadline['"]\)/.test(fs.readFileSync(path.join(dir, f), 'utf8')));

  assert.ok(hooks.length >= 7, `seulement ${hooks.length} hook(s) armé(s), 7 attendus`);

  const survivants = [];
  for (const f of hooks) {
    // Délai court forcé par env — la valeur exacte n'est pas le sujet, la MORT l'est.
    const r = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(dir, f)], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CTXROUTE_DEADLINE_MS: '400' },
      });
      child.stdout.on('data', () => {});
      child.stderr.on('data', () => {});
      const t = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({ mort: false });
      }, 4000);
      child.on('exit', (code) => {
        clearTimeout(t);
        resolve({ mort: true, code });
      });
      try {
        child.stdin.write(JSON.stringify({ session_id: 'test', tool_name: 'Read', tool_input: {} }));
      } catch (e) {}
    });
    if (!r.mort) survivants.push(f);
  }

  assert.deepStrictEqual(survivants, [], `ZOMBIE(S) malgré le patch : ${survivants.join(', ')}`);
});
