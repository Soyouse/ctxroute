// ═══════════════════════════════════════════════════════════════════════
// GATE STATIQUE — tout hook qui lit stdin DOIT armer une échéance
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI CE GATE EXISTE (et pas juste une règle écrite quelque part) :
//    Le 15/07/2026, 875 zombies `statusline.js`, dont un de 20 HEURES.
//    7 hooks de ~/.claude/hooks/ lisaient stdin. ZÉRO n'avait d'échéance.
//    100% de la famille vulnérable, 0% protégé — parce que la règle n'existait
//    nulle part sous forme MÉCANIQUE. Une consigne en prose ne relit personne.
//
// ⚠️ CE GATE EST LA SEULE CHOSE qui empêche le 10ᵉ hook d'oublier. `deadline.js`
//    rend la bonne chose FACILE ; ce gate rend l'oubli IMPOSSIBLE. Les deux,
//    jamais l'un à la place de l'autre (defense-in-depth).
//
// ⚠️ ANALYSE STATIQUE, jamais un spawn : on ne peut pas « tester » l'absence de
//    zombie en conditions réelles (il faudrait reproduire le bug d'Anthropic,
//    qui est non-déterministe). On vérifie donc la CAUSE dans le code source,
//    pas le symptôme à l'exécution.
//
// ⚠️ NE JAMAIS assouplir en ajoutant une exception « ce hook-là n'en a pas besoin ».
//    Le hook « qui n'en a pas besoin » est exactement celui qui zombifiera.
//    Un hook ne lit pas stdin OU il porte une échéance. Pas de 3ᵉ cas.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Fichiers du repo qui sont des HOOKS (spawné par un harnais, lit stdin, meurt).
// ⚠️ Dérivé du CONTENU, jamais d'une liste à la main : une liste manuelle oublie
//    le prochain fichier ajouté — le trou exact que ce gate est censé fermer.
//
// ⚠️ DEUX FAÇONS DE LIRE STDIN, LES DEUX COMPTENT — piège vécu le 15/07/2026 :
//    la 1ʳᵉ version de ce gate ne cherchait que `process.stdin` et passait au VERT
//    en n'analysant AUCUN hook réel (ils lisent tous via `stdin-json.js`). Un gate
//    aveugle est pire qu'absent : il certifie. Toute évolution de cette détection
//    DOIT être vérifiée par negative-check (saboter un hook → le gate doit rougir).
function hookFiles() {
  return fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
    .map((f) => ({ name: f, src: fs.readFileSync(path.join(ROOT, f), 'utf8') }))
    .filter((f) => /process\.stdin/.test(f.src) || /require\(['"]\.\/stdin-json['"]\)/.test(f.src));
}

test('tout fichier qui lit stdin arme une échéance (deadline.arm)', () => {
  const hooks = hookFiles();

  // ⚠️ Zéro hook détecté = le gate ne teste RIEN et passerait au vert pour toujours.
  //    Un gate vide est pire qu'aucun gate : il MENT (« vert » = « protégé »).
  assert.ok(hooks.length > 0, 'aucun fichier lisant stdin détecté — le gate est aveugle, vérifier hookFiles()');

  const nus = hooks
    .filter((h) => h.name !== 'deadline.js')
    // Exempté : l'utilitaire d'I/O partagé, qui DOIT rester autonome
    // (règle `stdin-json-stays-standalone` de .dependency-cruiser.json — il est
    // copiable tel quel dans un autre projet, donc il ne peut RIEN importer d'ici).
    // ⚠️ L'échéance est donc la responsabilité de ses APPELANTS, jamais la sienne.
    .filter((h) => h.name !== 'stdin-json.js')
    .filter((h) => !/require\(['"]\.\/deadline['"]\)/.test(h.src) || !/\barm\s*\(/.test(h.src))
    .map((h) => h.name);

  assert.deepStrictEqual(
    nus,
    [],
    `Hook(s) SANS échéance → zombie garanti si le harnais ne ferme pas stdin ` +
      `(bug Claude Code Windows #68626). Ajouter: const deadline = require('./deadline'); deadline.arm();`
  );
});

test('deadline.js : le .unref() est présent (sinon latence sur CHAQUE appel)', () => {
  // ⚠️ NEGATIVE-CHECK du garde-fou lui-même. Sans unref(), le timer retient la
  //    boucle d'événements → chaque appel d'outil attendrait le délai COMPLET.
  //    Le remède deviendrait pire que le mal, en silence (juste « c'est lent »).
  const src = fs.readFileSync(path.join(ROOT, 'deadline.js'), 'utf8');
  assert.match(src, /\.unref\(\)/, 'deadline.js sans unref() = latence ajoutée à chaque appel d\'outil');
  assert.match(src, /process\.exit\(0\)/, 'deadline.js doit sortir en 0 (fail-open, jamais bloquer un outil)');
});
