// ═══════════════════════════════════════════════════════════════════════
// L'ÉCHÉANCE NE DOIT JAMAIS TUER DU TRAVAIL LÉGITIME — MESURÉ SOUS CHARGE
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RÉGRESSION RÉELLE, EN PROD, LE 15/07/2026 — ce test EST sa preuve.
//    L'échéance valait 2000 ms, « justifiée » par un raisonnement JAMAIS mesuré
//    (« le délai n'est jamais payé dans le cas normal »). Sous 24 spawns
//    parallèles : 19/24 `protect-files.js` sortaient AVANT d'avoir injecté.
//    Docs silencieusement non injectées — LA classe de bug que ce framework
//    existe pour tuer, réintroduite par son propre garde-fou.
//
// ⚠️ L'ERREUR À NE PAS REFAIRE : `.unref()` empêche le timer de RETENIR la boucle
//    d'événements ; il ne l'empêche PAS de TIRER pendant un travail en cours.
//    Le cas « normal » d'une machine chargée n'est PAS le cas « cassé ».
//
// ⚠️ POURQUOI SOUS CHARGE ET PAS AU REPOS : au repos, 2000 ms passait. Le bug
//    n'apparaît QUE sous contention CPU (boot de node ~1 s au repos, bien plus
//    à 12+ spawns). Un test au repos aurait certifié le seuil cassé.
//    NE JAMAIS remplacer ce test par une version « plus rapide » sans charge.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { DEFAULT_MS } from './deadline';

const PARC = path.join(os.homedir(), '.claude', 'hooks');
const LEGACY = path.join(PARC, 'protect-files.js');
const skip = !fs.existsSync(LEGACY) && 'pas de protect-files.js (clone vierge)';

const N = 24; // ⚠️ ≥ 2× les cœurs : c'est la CONTENTION qui révèle le bug.

test('SEUIL — l\'échéance borne l\'infini, elle n\'optimise rien', { timeout: 60000 }, () => {
  // ⚠️ Gate sur la VALEUR elle-même : 2000 ms a causé une panne réelle.
  //    Un seuil serré tue du travail légitime EN SILENCE — pire que le zombie
  //    qu'il prétend éviter. Les zombies vivaient 20 h : 30 s est déjà 2400× mieux.
  assert.ok(
    DEFAULT_MS >= 15000,
    `DEFAULT_MS=${DEFAULT_MS} — seuil trop serré. Il tuera du travail légitime sous charge ` +
      `(mesuré le 15/07/2026 : 2000 ms → 19/24 hooks sortaient sans injecter). ` +
      `Ne JAMAIS le baisser sans relancer CE test sous charge.`
  );
});

// ⚠️ Le chemin sondé est DÉRIVÉ des vraies règles, jamais écrit à la main :
//    la 1ʳᵉ version visait `protect-files.js`, qui ne matche AUCUNE règle → 0 doc
//    → « 24/24 vides » → faux ROUGE accusant l'échéance. Un test doit VALIDER SON
//    PROPRE MONTAGE avant de mesurer, sinon il ne distingue pas « le remède tue »
//    de « il n'y avait rien à injecter ».
function cheminQuiMatche() {
  const { rules } = JSON.parse(fs.readFileSync(path.join(PARC, 'protected-paths.json'), 'utf8'));
  const r = rules.find((x) => typeof x.pattern === 'string' && x.pattern.endsWith('.js') && !x.scope);
  return r ? path.join(os.homedir(), 'Desktop', r.pattern) : null;
}

function lance(payload) {
  return new Promise((resolve) => {
    const c = execFile(process.execPath, [LEGACY], { cwd: PARC, encoding: 'utf8' }, (_e, out) => resolve(out || ''));
    c.stdin.end(payload);
  });
}

test.skipIf(skip)('SOUS CHARGE — les hooks armés injectent TOUJOURS (0 sortie vide)', { timeout: 60000 }, async () => {
  const cible = cheminQuiMatche();
  assert.ok(cible, 'aucune règle exploitable trouvée — le test serait aveugle');
  const payload = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: cible } });

  // ⚠️ AUTO-VALIDATION OBLIGATOIRE : au repos, ce payload DOIT injecter. Sans ce
  //    contrôle, un payload qui ne matche rien rendrait le test vert-aveugle sous
  //    charge (0 injecté = 0 « perdu par l'échéance »… et 0 preuve).
  const temoin = await lance(payload);
  assert.match(temoin, /\[source:/, `montage invalide : ${cible} n'injecte rien AU REPOS — le test ne prouverait rien`);

  // ⚠️ TOUS lancés d'un coup, JAMAIS en pool : la contention EST le sujet du test.
  const sorties = await Promise.all(Array.from({ length: N }, () => lance(payload)));

  const vides = sorties.filter((o) => !o.includes('[source:')).length;
  assert.strictEqual(
    vides,
    0,
    `${vides}/${N} hooks sont sortis SANS injecter sous charge → l'échéance tue du travail ` +
      `légitime. La doc n'est plus injectée, EN SILENCE. Remonter DEFAULT_MS (actuel : ${DEFAULT_MS} ms).`
  );
});
